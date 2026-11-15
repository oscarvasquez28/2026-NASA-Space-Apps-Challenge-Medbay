"""Automated tests for operator session auth, face_credentials table, local face engine, and gamification sync."""

import base64
import io

import numpy as np
import pytest
from httpx import AsyncClient
from PIL import Image

from app.auth.face_engine import FaceExtractionResult, cosine_similarity
from app.auth import service as auth_service


def _make_jpeg_data_url(rgb: tuple[int, int, int], size: tuple[int, int] = (64, 64)) -> str:
    img = Image.new("RGB", size, rgb)
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{b64}"


def _unit_vec(seed: int, dim: int = 128) -> list[float]:
    rng = np.random.default_rng(seed)
    v = rng.normal(size=dim).astype(np.float32)
    v /= float(np.linalg.norm(v))
    return v.tolist()


@pytest.mark.asyncio
async def test_identify_blank_frame_returns_no_face(async_client: AsyncClient) -> None:
    """Real face engine should classify a uniform/blank frame as no_face."""
    blank_data_url = _make_jpeg_data_url((10, 10, 10))
    resp = await async_client.post(
        "/api/v1/auth/identify",
        json={"face_photo": blank_data_url},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "no_face"
    assert body["matched_user"] is None


@pytest.mark.asyncio
async def test_register_rejects_blank_photo(async_client: AsyncClient) -> None:
    """Enrolling with a blank frame lacking a detectable face should fail with 422."""
    blank_data_url = _make_jpeg_data_url((0, 0, 0))
    resp = await async_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Blank Test",
            "role": "user",
            "face_photo": blank_data_url,
        },
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_full_auth_face_recognition_checkin_and_gamification_flow(
    async_client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """End-to-end test covering registration, face table mapping, identification, idle/daily check-in, and prize skin sync."""
    # Reset DB snapshot so operator tables start clean
    snap = await async_client.put("/api/v1/tests/dbsnapshot")
    assert snap.status_code == 200

    vec_alice = _unit_vec(101)
    # Slightly noisy capture of Alice's face (same person, different frame)
    rng = np.random.default_rng(999)
    noisy = np.asarray(vec_alice, dtype=np.float32) + rng.normal(scale=0.03, size=128).astype(np.float32)
    noisy /= float(np.linalg.norm(noisy))
    vec_alice_probe = noisy.tolist()

    # Completely different person (orthogonal / distinct seed)
    vec_stranger = _unit_vec(404)

    photo_alice = _make_jpeg_data_url((120, 140, 180))
    photo_bob = _make_jpeg_data_url((200, 160, 120))
    photo_stranger = _make_jpeg_data_url((80, 190, 90))

    vec_bob = _unit_vec(202)
    # Orthogonalize Bob relative to Alice just in case random seeds correlate slightly
    a_np = np.asarray(vec_alice, dtype=np.float32)
    b_np = np.asarray(vec_bob, dtype=np.float32)
    b_np = b_np - float(np.dot(b_np, a_np)) * a_np
    b_np /= float(np.linalg.norm(b_np))
    vec_bob = b_np.tolist()

    s_np = np.asarray(vec_stranger, dtype=np.float32)
    s_np = s_np - float(np.dot(s_np, a_np)) * a_np - float(np.dot(s_np, b_np)) * b_np
    s_np /= float(np.linalg.norm(s_np))
    vec_stranger = s_np.tolist()

    mapping = {
        photo_alice: FaceExtractionResult(True, vec_alice, "sface_2021dec", 0.99),
        "probe_alice_frame": FaceExtractionResult(True, vec_alice_probe, "sface_2021dec", 0.97),
        photo_bob: FaceExtractionResult(True, vec_bob, "sface_2021dec", 0.98),
        photo_stranger: FaceExtractionResult(True, vec_stranger, "sface_2021dec", 0.95),
        "blank_frame_payload": FaceExtractionResult(False, [], "sface_2021dec", 0.0, "No face"),
    }

    def fake_extract(image_input: str | bytes) -> FaceExtractionResult:
        key = image_input if isinstance(image_input, str) else "bytes"
        return mapping.get(key, FaceExtractionResult(False, [], "sface_2021dec", 0.0))

    monkeypatch.setattr(auth_service, "extract_face_embedding", fake_extract)

    # 1. First operator is forced to medic role even if role="user" is sent
    reg1 = await async_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Dr. Alice",
            "callsign": "AL-01",
            "role": "user",
            "face_photo": photo_alice,
        },
    )
    assert reg1.status_code == 200
    reg1_data = reg1.json()
    alice = reg1_data["user"]
    assert alice["role"] == "medic"
    assert alice["astronautId"] == "AST-U01"
    assert reg1_data["embedding_dim"] == 128

    # 2. Second operator respects role="user" and auto-assigns AST-U02
    reg2 = await async_client.post(
        "/api/v1/auth/register",
        json={
            "name": "Crew Bob",
            "role": "user",
            "face_photo": photo_bob,
        },
    )
    assert reg2.status_code == 200
    bob = reg2.json()["user"]
    assert bob["role"] == "user"
    assert bob["astronautId"] == "AST-U02"

    # 3. Face credentials table lists mapped face rows for Alice
    faces_resp = await async_client.get(f"/api/v1/auth/users/{alice['id']}/faces")
    assert faces_resp.status_code == 200
    faces = faces_resp.json()
    assert len(faces) == 1
    assert faces[0]["user_id"] == alice["id"]
    assert faces[0]["embedding_dim"] == 128

    # 4. Identify Alice using noisy probe frame -> matched
    id_alice = await async_client.post(
        "/api/v1/auth/identify",
        json={"face_photo": "probe_alice_frame"},
    )
    assert id_alice.status_code == 200
    id_alice_data = id_alice.json()
    assert id_alice_data["status"] == "matched"
    assert id_alice_data["matched_user"]["id"] == alice["id"]
    assert id_alice_data["confidence"] >= 0.363

    # 5. Identify unregistered stranger -> unknown_face
    id_stranger = await async_client.post(
        "/api/v1/auth/identify",
        json={"face_photo": photo_stranger},
    )
    assert id_stranger.status_code == 200
    id_stranger_data = id_stranger.json()
    assert id_stranger_data["status"] == "unknown_face"
    assert id_stranger_data["matched_user"] is None

    # 6. Identify blank frame -> no_face
    id_blank = await async_client.post(
        "/api/v1/auth/identify",
        json={"face_photo": "blank_frame_payload"},
    )
    assert id_blank.status_code == 200
    assert id_blank.json()["status"] == "no_face"

    # 7. Idempotent check-ins + streak + 5th check-in earns a wheel spin
    for offset, day_str in enumerate(
        ["2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14"]
    ):
        ci = await async_client.post(
            "/api/v1/auth/checkin",
            json={"user_id": alice["id"], "day": day_str},
        )
        assert ci.status_code == 200
        ci_data = ci.json()
        assert ci_data["is_new_day"] is True
        assert ci_data["streak"] == offset + 1
        assert ci_data["earned_spin"] is (offset == 4)

    # Repeat same day -> idempotent
    ci_dup = await async_client.post(
        "/api/v1/auth/checkin",
        json={"user_id": alice["id"], "day": "2026-11-14"},
    )
    assert ci_dup.status_code == 200
    assert ci_dup.json()["is_new_day"] is False
    assert ci_dup.json()["pending_spins"] == 1

    # 8. Claim Prize Drum spin and verify skin unlocks in GamificationProfileRecord
    spin_resp = await async_client.post(
        "/api/v1/auth/claim-wheel-spin",
        json={
            "user_id": alice["id"],
            "unlocked_skin_id": "skin_mars_vanguard",
            "equip": True,
        },
    )
    assert spin_resp.status_code == 200
    spin_data = spin_resp.json()
    assert spin_data["wheel_spins_claimed"] == 1
    assert spin_data["pending_spins"] == 0
    assert "skin_mars_vanguard" in spin_data["unlocked_skins"]

    gam_resp = await async_client.get(
        f"/api/v1/gamification/status?astronaut_id={alice['astronautId']}"
    )
    assert gam_resp.status_code == 200
    gam_data = gam_resp.json()
    assert gam_data["readiness_streak_days"] == 5
    assert gam_data["equipped_skin"]["skin_id"] == "skin_mars_vanguard"
    unlocked_ids = [s["skin_id"] for s in gam_data["catalog"] if s["unlocked"]]
    assert "skin_mars_vanguard" in unlocked_ids

    # 9. Checkup-complete with explicit unlock_skin_id also persists unlock
    cu_resp = await async_client.post(
        "/api/v1/gamification/checkup-complete",
        json={
            "astronaut_id": bob["astronautId"],
            "completed_tasks": ["task_morning_vitals"],
            "perform_gachapon_roll": False,
            "unlock_skin_id": "skin_lunar_explorer",
        },
    )
    assert cu_resp.status_code == 200
    bob_gam = (
        await async_client.get(
            f"/api/v1/gamification/status?astronaut_id={bob['astronautId']}"
        )
    ).json()
    bob_unlocked = [s["skin_id"] for s in bob_gam["catalog"] if s["unlocked"]]
    assert "skin_lunar_explorer" in bob_unlocked

    # 10. Session-state & user deletion
    state_resp = await async_client.get("/api/v1/auth/session-state")
    assert state_resp.status_code == 200
    assert len(state_resp.json()["users"]) == 2

    del_resp = await async_client.delete(f"/api/v1/auth/users/{bob['id']}")
    assert del_resp.status_code == 200
    state_after = (await async_client.get("/api/v1/auth/session-state")).json()
    assert len(state_after["users"]) == 1

    # Cosine similarity sanity check
    assert cosine_similarity(vec_alice, vec_alice) == pytest.approx(1.0, abs=1e-4)
    assert cosine_similarity(vec_alice, vec_stranger) == pytest.approx(0.0, abs=1e-4)
