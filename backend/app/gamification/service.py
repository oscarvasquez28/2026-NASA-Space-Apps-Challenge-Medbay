"""Service layer for Routine Measurement Scheduler and Gachapon Reward Engine."""

from datetime import datetime, timezone
import json
import logging
import random
from typing import Any, Dict, List, Optional, Set

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.gamification.models import (
    CheckupCompleteRequest,
    CheckupCompleteResponse,
    CompanionSkinSchema,
    GachaponRollResult,
    GamificationProfileRecord,
    GamificationStatusResponse,
    RoutineTaskSchema,
    ROUTINE_MEASUREMENT_TASKS,
    SKIN_ALIASES,
    SKIN_CATALOG,
    TASK_ALIASES,
    TIER_WEIGHTS,
)

logger = logging.getLogger(__name__)


def _build_skin_schema(
    skin_dict: Dict[str, Any],
    unlocked_skins: Set[str],
    equipped_skin_id: str,
) -> CompanionSkinSchema:
    skin_id = skin_dict["skin_id"]
    return CompanionSkinSchema(
        skin_id=skin_id,
        name=skin_dict["name"],
        rarity=skin_dict["rarity"],
        description=skin_dict["description"],
        unlocked=skin_id in unlocked_skins,
        equipped=skin_id == equipped_skin_id,
        probability_percent=skin_dict["probability_percent"],
    )


async def get_or_create_profile(
    session: AsyncSession,
    astronaut_id: str = "AST-01",
) -> GamificationProfileRecord:
    """Retrieve astronaut gamification profile, auto-seeding if missing."""
    stmt = select(GamificationProfileRecord).where(
        GamificationProfileRecord.astronaut_id == astronaut_id
    )
    result = await session.execute(stmt)
    profile = result.scalar_one_or_none()

    if profile is None:
        profile = GamificationProfileRecord(
            astronaut_id=astronaut_id,
            readiness_streak_days=1,
            total_checkups_completed=0,
            gachapon_tokens=1,
            unlocked_skins_json=json.dumps(["skin_standard_suit"]),
            equipped_skin_id="skin_standard_suit",
            completed_tasks_today_json=json.dumps([]),
            last_checkup_at=None,
            updated_at=datetime.now(timezone.utc),
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)
        logger.info("Auto-seeded new gamification profile for astronaut %s", astronaut_id)

    return profile


async def get_gamification_status(
    session: AsyncSession,
    astronaut_id: str = "AST-01",
) -> GamificationStatusResponse:
    """Retrieve complete gamification status, routine tasks compliance, and companion skin catalog."""
    profile = await get_or_create_profile(session, astronaut_id)
    unlocked_skins = set(profile.unlocked_skins)
    completed_tasks = set(profile.completed_tasks_today)

    # Build routine tasks list
    tasks: List[RoutineTaskSchema] = []
    for task in ROUTINE_MEASUREMENT_TASKS:
        tid = task["task_id"]
        alias = next((k for k, v in TASK_ALIASES.items() if v == tid), None)
        is_done = tid in completed_tasks or (alias is not None and alias in completed_tasks)
        tasks.append(
            RoutineTaskSchema(
                task_id=tid,
                title=task["title"],
                frequency=task["frequency"],
                category=task["category"],
                completed=is_done,
                description=task.get("description"),
            )
        )

    total_tasks = len(ROUTINE_MEASUREMENT_TASKS)
    done_count = sum(1 for t in tasks if t.completed)
    compliance_rate = round((done_count / total_tasks * 100.0) if total_tasks else 0.0, 1)

    # Build catalog
    catalog = [
        _build_skin_schema(skin, unlocked_skins, profile.equipped_skin_id)
        for skin in SKIN_CATALOG
    ]

    equipped_dict = next(
        (s for s in SKIN_CATALOG if s["skin_id"] == profile.equipped_skin_id),
        SKIN_CATALOG[0],
    )
    equipped_skin = _build_skin_schema(equipped_dict, unlocked_skins, profile.equipped_skin_id)

    # Status: nominal by default on new day / baseline, caution if low compliance after checkups
    status = "nominal" if (compliance_rate >= 40.0 or profile.total_checkups_completed == 0) else "caution"

    high_level = (
        f"Astronaut {astronaut_id} maintains a {profile.readiness_streak_days}-day readiness streak "
        f"with {profile.gachapon_tokens} Gachapon tokens available. Routine health compliance is at {compliance_rate}%. "
        f"Equipped companion skin: {equipped_skin.name}."
    )
    technical = (
        f"Gamification Telemetry [AST: {astronaut_id}]: Tasks={done_count}/{total_tasks} ({compliance_rate}%); "
        f"Streak={profile.readiness_streak_days}d; TotalCheckups={profile.total_checkups_completed}; "
        f"Tokens={profile.gachapon_tokens}; Unlocked={len(unlocked_skins)}/{len(SKIN_CATALOG)}; "
        f"ActiveSkin={profile.equipped_skin_id}; LastCheckup={profile.last_checkup_at.isoformat() if profile.last_checkup_at else 'None'}."
    )

    return GamificationStatusResponse(
        status=status,
        high_level=high_level,
        technical=technical,
        astronaut_id=astronaut_id,
        readiness_streak_days=profile.readiness_streak_days,
        total_checkups_completed=profile.total_checkups_completed,
        gachapon_tokens=profile.gachapon_tokens,
        compliance_rate_percent=compliance_rate,
        equipped_skin=equipped_skin,
        routine_tasks=tasks,
        unlocked_skins_count=len(unlocked_skins),
        total_skins_count=len(SKIN_CATALOG),
        catalog=catalog,
    )


async def complete_checkup_and_roll(
    session: AsyncSession,
    request: CheckupCompleteRequest,
) -> CheckupCompleteResponse:
    """Record completed routine tasks, update streak, award tokens, and perform weighted Gachapon roll."""
    profile = await get_or_create_profile(session, request.astronaut_id)
    unlocked_skins = set(profile.unlocked_skins)

    # 0. Unlock explicit prize-drum reward skin if supplied
    if request.unlock_skin_id:
        normalized_unlock = SKIN_ALIASES.get(request.unlock_skin_id, request.unlock_skin_id)
        valid_skin_ids = {s["skin_id"] for s in SKIN_CATALOG}
        if normalized_unlock not in valid_skin_ids:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown skin '{request.unlock_skin_id}'.",
            )
        if normalized_unlock not in unlocked_skins:
            unlocked_skins.add(normalized_unlock)
            profile.set_unlocked_skins(list(unlocked_skins))

    # 1. Validate skin equipping request before mutations
    target_skin_id: Optional[str] = None
    if request.equip_skin_id:
        normalized_skin_id = SKIN_ALIASES.get(request.equip_skin_id, request.equip_skin_id)
        if normalized_skin_id not in unlocked_skins and request.equip_skin_id not in unlocked_skins:
            raise HTTPException(
                status_code=400,
                detail=f"Skin '{request.equip_skin_id}' is not unlocked.",
            )
        target_skin_id = normalized_skin_id if normalized_skin_id in unlocked_skins else request.equip_skin_id

    # 2. Update completed routine tasks
    valid_task_ids = {t["task_id"] for t in ROUTINE_MEASUREMENT_TASKS}
    new_valid_tasks: List[str] = []
    for raw_id in request.completed_tasks:
        canonical_id = TASK_ALIASES.get(raw_id, raw_id)
        if canonical_id in valid_task_ids:
            new_valid_tasks.append(canonical_id)

    current_tasks = set(profile.completed_tasks_today)
    updated_tasks = current_tasks.union(new_valid_tasks)
    profile.set_completed_tasks_today(list(updated_tasks))

    # 3. Increment checkup counter, streak, and award tokens
    profile.total_checkups_completed += 1
    profile.readiness_streak_days += 1
    tokens_awarded = 1
    profile.gachapon_tokens += tokens_awarded

    # 4. Perform weighted Gachapon roll if requested
    roll_performed = False
    roll_result: Optional[GachaponRollResult] = None

    if request.perform_gachapon_roll and profile.gachapon_tokens >= 1:
        profile.gachapon_tokens -= 1
        roll_performed = True

        rng = random.Random(request.deterministic_seed) if request.deterministic_seed is not None else random.Random()
        tiers = list(TIER_WEIGHTS.keys())
        weights = list(TIER_WEIGHTS.values())
        selected_tier = rng.choices(tiers, weights=weights, k=1)[0]

        tier_skins = [s for s in SKIN_CATALOG if s["rarity"] == selected_tier]
        rolled_skin_dict = rng.choice(tier_skins)
        skin_id = rolled_skin_dict["skin_id"]

        is_new_unlock = skin_id not in unlocked_skins
        if is_new_unlock:
            unlocked_skins.add(skin_id)
            profile.set_unlocked_skins(list(unlocked_skins))
            if not target_skin_id:
                profile.equipped_skin_id = skin_id

        rolled_schema = CompanionSkinSchema(
            skin_id=skin_id,
            name=rolled_skin_dict["name"],
            rarity=rolled_skin_dict["rarity"],
            description=rolled_skin_dict["description"],
            unlocked=True,
            equipped=(profile.equipped_skin_id == skin_id),
            probability_percent=rolled_skin_dict["probability_percent"],
        )

        message = (
            f"Unlocked new {selected_tier} companion skin: '{rolled_skin_dict['name']}'!"
            if is_new_unlock
            else f"Rolled duplicate {selected_tier} skin: '{rolled_skin_dict['name']}'."
        )

        roll_result = GachaponRollResult(
            rolled_skin=rolled_schema,
            is_new_unlock=is_new_unlock,
            rarity=selected_tier,
            probability_percent=rolled_skin_dict["probability_percent"],
            message=message,
        )

    # 5. Handle explicit skin equipping if requested
    if target_skin_id:
        profile.equipped_skin_id = target_skin_id

    # 6. Timestamp and DB commit
    now = datetime.now(timezone.utc)
    profile.last_checkup_at = now
    profile.updated_at = now

    session.add(profile)
    await session.commit()
    await session.refresh(profile)

    # 7. Response synthesis
    total_tasks = len(ROUTINE_MEASUREMENT_TASKS)
    completed_today = profile.completed_tasks_today
    completed_count = len(set(completed_today).intersection(valid_task_ids))
    compliance_rate = round((completed_count / total_tasks * 100.0) if total_tasks else 0.0, 1)

    equipped_dict = next(
        (s for s in SKIN_CATALOG if s["skin_id"] == profile.equipped_skin_id),
        SKIN_CATALOG[0],
    )
    equipped_schema = _build_skin_schema(equipped_dict, set(profile.unlocked_skins), profile.equipped_skin_id)

    status = "nominal"

    high_level = (
        f"Routine checkup logged successfully for Astronaut {request.astronaut_id}. "
        f"Readiness streak increased to {profile.readiness_streak_days} days. "
        f"Gachapon tokens balance: {profile.gachapon_tokens}. "
        + (f"Roll result: {roll_result.message} " if roll_result else "No roll performed. ")
        + f"Equipped companion skin: {equipped_schema.name}."
    )
    technical = (
        f"Checkup audit logged: AST={request.astronaut_id}, tasks_added={len(new_valid_tasks)}, "
        f"total_tasks_completed={completed_count}/{total_tasks} ({compliance_rate}%), "
        f"streak={profile.readiness_streak_days}d, tokens={profile.gachapon_tokens}, "
        f"roll_performed={roll_performed}, "
        f"active_skin={profile.equipped_skin_id}."
    )

    return CheckupCompleteResponse(
        status=status,
        high_level=high_level,
        technical=technical,
        astronaut_id=request.astronaut_id,
        readiness_streak_days=profile.readiness_streak_days,
        total_checkups_completed=profile.total_checkups_completed,
        gachapon_tokens=profile.gachapon_tokens,
        tokens_awarded=tokens_awarded,
        roll_performed=roll_performed,
        roll_result=roll_result,
        equipped_skin=equipped_schema,
        completed_tasks_today=completed_today,
        compliance_rate_percent=compliance_rate,
    )
