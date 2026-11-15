"""Service layer for NASA HRP 5-Hazards modeling and operational location context."""

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.context.models import (
    HazardMultipliers,
    LocationContextResponse,
    LocationContextUpdate,
    LocationSetting,
)
from app.db.models import LocationContextRecord

BASELINE_PROFILES: dict[LocationSetting, dict[str, Any]] = {
    LocationSetting.SPACE_STATION_0G: {
        "gravity_g": 0.0,
        "space_radiation": 1.2,
        "isolation_and_confinement": 1.1,
        "distance_from_earth": 1.0,
        "gravity_fields": 1.8,
        "hostile_closed_environments": 1.2,
        "default_latency": 0.05,
        "default_offline": False,
    },
    LocationSetting.SPACECRAFT_0G_TRANSIT: {
        "gravity_g": 0.0,
        "space_radiation": 2.5,
        "isolation_and_confinement": 2.0,
        "distance_from_earth": 2.2,
        "gravity_fields": 2.0,
        "hostile_closed_environments": 1.8,
        "default_latency": 45.0,
        "default_offline": True,
    },
    LocationSetting.MOON_1_6G: {
        "gravity_g": 0.166,
        "space_radiation": 1.8,
        "isolation_and_confinement": 1.4,
        "distance_from_earth": 1.3,
        "gravity_fields": 1.4,
        "hostile_closed_environments": 1.5,
        "default_latency": 1.3,
        "default_offline": False,
    },
    LocationSetting.MARS_3_8G: {
        "gravity_g": 0.376,
        "space_radiation": 2.8,
        "isolation_and_confinement": 2.8,
        "distance_from_earth": 3.0,
        "gravity_fields": 1.3,
        "hostile_closed_environments": 2.2,
        "default_latency": 720.0,
        "default_offline": True,
    },
    LocationSetting.ROVER_EVA: {
        "gravity_g": 0.166,
        "space_radiation": 3.0,
        "isolation_and_confinement": 1.8,
        "distance_from_earth": 2.0,
        "gravity_fields": 1.5,
        "hostile_closed_environments": 3.0,
        "default_latency": 180.0,
        "default_offline": True,
    },
}


def calculate_hazard_multipliers(
    setting: LocationSetting,
    co2_mmhg: float,
    pressure_kpa: float,
    microbial_cfu_m3: float,
    noise_dba: float,
) -> HazardMultipliers:
    """Calculate baseline and dynamic NASA HRP 5-hazard multipliers."""
    profile = BASELINE_PROFILES.get(setting, BASELINE_PROFILES[LocationSetting.SPACE_STATION_0G])

    radiation = profile["space_radiation"]
    isolation = profile["isolation_and_confinement"]
    distance = profile["distance_from_earth"]
    gravity = profile["gravity_fields"]
    hostile_closed = profile["hostile_closed_environments"]

    # Dynamic adjustments based on environmental sensors
    if co2_mmhg > 4.0:
        hostile_closed += max(0.3, round((co2_mmhg - 3.0) * 0.15, 2))
    if pressure_kpa < 90.0:
        hostile_closed += 0.4
    if microbial_cfu_m3 > 500.0:
        hostile_closed += 0.2
    if noise_dba > 65.0:
        isolation += 0.1
        hostile_closed += 0.1

    # Clamp each multiplier to [1.0, 5.0]
    radiation = min(5.0, max(1.0, round(radiation, 2)))
    isolation = min(5.0, max(1.0, round(isolation, 2)))
    distance = min(5.0, max(1.0, round(distance, 2)))
    gravity = min(5.0, max(1.0, round(gravity, 2)))
    hostile_closed = min(5.0, max(1.0, round(hostile_closed, 2)))

    composite = round(
        (radiation + isolation + distance + gravity + hostile_closed) / 5.0,
        2,
    )
    composite = min(5.0, max(1.0, composite))

    return HazardMultipliers(
        space_radiation=radiation,
        isolation_and_confinement=isolation,
        distance_from_earth=distance,
        gravity_fields=gravity,
        hostile_closed_environments=hostile_closed,
        composite_multiplier=composite,
    )


def _evaluate_context_status(
    record: LocationContextRecord,
    multipliers: HazardMultipliers,
) -> tuple[str, str, str]:
    """Derive standardized status severity token and dual-view summaries for operational context."""
    if record.pressure_kpa < 75.0 or record.co2_mmhg > 6.0:
        status = "critical"
    elif (
        multipliers.composite_multiplier >= 2.0
        or record.offline_fallback_active
        or record.co2_mmhg > 4.0
        or record.pressure_kpa < 90.0
    ):
        status = "caution"
    else:
        status = "nominal"

    comms_mode = (
        f"Offline local AI/TTS active (Earth delay {record.earth_comm_latency_sec:.1f}s)"
        if record.offline_fallback_active
        else f"Nominal Earth link ({record.earth_comm_latency_sec:.2f}s latency)"
    )
    high_level = (
        f"Mission environment set to {record.location_setting}. {comms_mode}. "
        f"Cabin temp {record.temperature_c:.1f} C, pressure {record.pressure_kpa:.1f} kPa, "
        f"CO2 {record.co2_mmhg:.1f} mmHg."
    )
    technical = (
        f"Environment={record.location_setting}; ECLSS[T={record.temperature_c:.1f}C, "
        f"P={record.pressure_kpa:.1f}kPa, CO2={record.co2_mmhg:.1f}mmHg, "
        f"Noise={record.noise_dba:.1f}dBA, CFU={record.microbial_cfu_m3:.0f}/m3]; "
        f"5-Hazards[rad={multipliers.space_radiation}, iso={multipliers.isolation_and_confinement}, "
        f"dist={multipliers.distance_from_earth}, grav={multipliers.gravity_fields}, "
        f"closed={multipliers.hostile_closed_environments}, composite={multipliers.composite_multiplier}]; "
        f"offline_fallback={record.offline_fallback_active}."
    )
    return status, high_level, technical


def record_to_response(record: LocationContextRecord) -> LocationContextResponse:
    """Transform a LocationContextRecord into a validated LocationContextResponse."""
    multipliers_data = json.loads(record.hazard_multipliers_json) if record.hazard_multipliers_json else {}
    multipliers = HazardMultipliers(**multipliers_data)
    setting = LocationSetting(record.location_setting)
    profile = BASELINE_PROFILES.get(setting, BASELINE_PROFILES[LocationSetting.SPACE_STATION_0G])
    status, high_level, technical = _evaluate_context_status(record, multipliers)

    return LocationContextResponse(
        id=record.id,
        location_setting=setting,
        gravity_g=profile["gravity_g"],
        temperature_c=record.temperature_c,
        pressure_kpa=record.pressure_kpa,
        lighting_lux=record.lighting_lux,
        noise_dba=record.noise_dba,
        microbial_cfu_m3=record.microbial_cfu_m3,
        co2_mmhg=record.co2_mmhg,
        earth_comm_latency_sec=record.earth_comm_latency_sec,
        offline_fallback_active=record.offline_fallback_active,
        hazard_multipliers=multipliers,
        status=status,
        high_level=high_level,
        technical=technical,
        updated_at=record.updated_at,
    )


async def get_current_location_context(session: AsyncSession) -> LocationContextResponse:
    """Retrieve the most recent operational location context record."""
    statement = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    result = await session.execute(statement)
    record = result.scalar_one_or_none()

    if record is None:
        # Fallback to create default if database was reset
        hazards = calculate_hazard_multipliers(
            LocationSetting.SPACE_STATION_0G,
            co2_mmhg=3.0,
            pressure_kpa=101.3,
            microbial_cfu_m3=200.0,
            noise_dba=55.0,
        )
        record = LocationContextRecord(
            location_setting=LocationSetting.SPACE_STATION_0G.value,
            temperature_c=21.5,
            pressure_kpa=101.3,
            lighting_lux=450.0,
            noise_dba=55.0,
            microbial_cfu_m3=200.0,
            co2_mmhg=3.0,
            earth_comm_latency_sec=0.05,
            offline_fallback_active=False,
            hazard_multipliers_json=json.dumps(hazards.model_dump()),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)

    return record_to_response(record)


async def update_location_context(
    session: AsyncSession,
    update: LocationContextUpdate,
) -> LocationContextResponse:
    """Update current location context, recalculate hazard multipliers, and persist."""
    statement = select(LocationContextRecord).order_by(LocationContextRecord.id.desc()).limit(1)
    result = await session.execute(statement)
    current_record = result.scalar_one_or_none()

    new_setting = update.location_setting or (
        LocationSetting(current_record.location_setting)
        if current_record
        else LocationSetting.SPACE_STATION_0G
    )

    profile = BASELINE_PROFILES.get(new_setting, BASELINE_PROFILES[LocationSetting.SPACE_STATION_0G])

    # If setting changed and latency was not explicitly provided, apply profile default
    if update.earth_comm_latency_sec is not None:
        new_latency = update.earth_comm_latency_sec
    elif current_record and current_record.location_setting == new_setting.value:
        new_latency = current_record.earth_comm_latency_sec
    else:
        new_latency = profile["default_latency"]

    # Latency threshold > 10.0 seconds automatically forces offline_fallback_active
    if new_latency > 10.0:
        new_offline = True
    elif update.offline_fallback_active is not None:
        new_offline = update.offline_fallback_active
    elif current_record and current_record.location_setting == new_setting.value:
        new_offline = current_record.offline_fallback_active
    else:
        new_offline = profile["default_offline"]

    new_temp = update.temperature_c if update.temperature_c is not None else (current_record.temperature_c if current_record else 21.5)
    new_pressure = update.pressure_kpa if update.pressure_kpa is not None else (current_record.pressure_kpa if current_record else 101.3)
    new_lighting = update.lighting_lux if update.lighting_lux is not None else (current_record.lighting_lux if current_record else 450.0)
    new_noise = update.noise_dba if update.noise_dba is not None else (current_record.noise_dba if current_record else 55.0)
    new_microbial = update.microbial_cfu_m3 if update.microbial_cfu_m3 is not None else (current_record.microbial_cfu_m3 if current_record else 200.0)
    new_co2 = update.co2_mmhg if update.co2_mmhg is not None else (current_record.co2_mmhg if current_record else 3.0)

    hazards = calculate_hazard_multipliers(
        setting=new_setting,
        co2_mmhg=new_co2,
        pressure_kpa=new_pressure,
        microbial_cfu_m3=new_microbial,
        noise_dba=new_noise,
    )

    if current_record:
        current_record.location_setting = new_setting.value
        current_record.temperature_c = new_temp
        current_record.pressure_kpa = new_pressure
        current_record.lighting_lux = new_lighting
        current_record.noise_dba = new_noise
        current_record.microbial_cfu_m3 = new_microbial
        current_record.co2_mmhg = new_co2
        current_record.earth_comm_latency_sec = new_latency
        current_record.offline_fallback_active = new_offline
        current_record.hazard_multipliers_json = json.dumps(hazards.model_dump())
        current_record.updated_at = datetime.now(timezone.utc)
        record = current_record
    else:
        record = LocationContextRecord(
            location_setting=new_setting.value,
            temperature_c=new_temp,
            pressure_kpa=new_pressure,
            lighting_lux=new_lighting,
            noise_dba=new_noise,
            microbial_cfu_m3=new_microbial,
            co2_mmhg=new_co2,
            earth_comm_latency_sec=new_latency,
            offline_fallback_active=new_offline,
            hazard_multipliers_json=json.dumps(hazards.model_dump()),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(record)

    await session.commit()
    await session.refresh(record)
    return record_to_response(record)
