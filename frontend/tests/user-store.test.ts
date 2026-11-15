import { beforeEach, describe, expect, it } from "vitest";

import { pickSkinOfRarity, rollDrumRarity, DRUM_WEIGHTS } from "@/data/gamification";
import { earnedSpinsFor, streakFor, useUserStore, userStore, } from "@/stores/user-store";

const PHOTO = "data:image/jpeg;base64,AAAA";

function resetStore() {
  useUserStore.setState({
    users: [],
    activeUserId: null,
    checkIns: [],
    wheelSpinsClaimed: 0,
    idleTimeoutMs: 180_000,
    sessionLocked: false,
    unrecognizedFacePhoto: null,
    hydrated: true,
  });
}

describe("user-store enrollment", () => {
  beforeEach(resetStore);

  it("forces the first enrolled operator to the medic role", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO, role: "user" });
    expect(u.role).toBe("medic");
    expect(userStore().activeUserId).toBe(u.id);
  });

  it("lets later enrollees pick a role and auto-assigns AST-U ids", () => {
    userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    const u2 = userStore().addUser({ name: "Crew", facePhoto: PHOTO });
    expect(u2.role).toBe("user");
    expect(u2.astronautId).toBe("AST-U02");
    const u3 = userStore().addUser({ name: "Surgeon", facePhoto: PHOTO, role: "medic" });
    expect(u3.role).toBe("medic");
  });

  it("clears the session when the active user is removed", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    userStore().recordCheckIn(u.id);
    userStore().removeUser(u.id);
    expect(userStore().activeUserId).toBeNull();
    expect(userStore().checkIns).toHaveLength(0);
  });
});

describe("daily check-in", () => {
  beforeEach(resetStore);

  it("is idempotent per user and day", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    expect(userStore().recordCheckIn(u.id)).toBe(true);
    expect(userStore().recordCheckIn(u.id)).toBe(false);
    expect(userStore().checkIns).toHaveLength(1);
  });

  it("computes consecutive-day streaks ending today", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    const days = [-3, -2, -1].map((off) => ({
      userId: u.id,
      day: dayKeyForTest(off),
      at: new Date().toISOString(),
    }));
    useUserStore.setState({ checkIns: days });
    expect(streakFor(userStore().checkIns, u.id)).toBe(3);
    // a gap yesterday breaks the streak; only today or a run ending
    // yesterday counts
    useUserStore.setState({
      checkIns: [
        { userId: u.id, day: dayKeyForTest(-3), at: "" },
        { userId: u.id, day: dayKeyForTest(-1), at: "" },
      ],
    });
    expect(streakFor(userStore().checkIns, u.id)).toBe(1);
    useUserStore.setState({
      checkIns: [{ userId: u.id, day: dayKeyForTest(-2), at: "" }],
    });
    expect(streakFor(userStore().checkIns, u.id)).toBe(0);
  });
});

describe("prize drum roll", () => {
  beforeEach(resetStore);

  it("earns a spin per WHEEL_EVERY_N-day consecutive streak", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    const ins = (days: number[]) =>
      days.map((i) => ({ userId: u.id, day: dayKeyForTest(-i), at: "" }));
    // 6 consecutive days → no milestone yet
    useUserStore.setState({ checkIns: ins([0, 1, 2, 3, 4, 5]) });
    expect(earnedSpinsFor(userStore().checkIns, u.id)).toBe(0);
    // 7 consecutive days → first weekly spin
    useUserStore.setState({ checkIns: ins([0, 1, 2, 3, 4, 5, 6]) });
    expect(earnedSpinsFor(userStore().checkIns, u.id)).toBe(1);
    // 14 consecutive days → two weekly spins
    useUserStore.setState({
      checkIns: ins([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]),
    });
    expect(earnedSpinsFor(userStore().checkIns, u.id)).toBe(2);
    // a gap resets the run: 8 scattered days with a hole earn nothing
    useUserStore.setState({ checkIns: ins([0, 1, 2, 3, 5, 6, 7, 8]) });
    expect(earnedSpinsFor(userStore().checkIns, u.id)).toBe(0);
    // two separate 7-day runs both count
    useUserStore.setState({
      checkIns: ins([0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 15, 16]),
    });
    expect(earnedSpinsFor(userStore().checkIns, u.id)).toBe(2);
  });

  it("rolls only common/rare/legendary and respects weights", () => {
    expect(rollDrumRarity(() => 0.0)).toBe("common");
    expect(rollDrumRarity(() => 0.999)).toBe("legendary");
    const commonEnd = DRUM_WEIGHTS.common / 100;
    expect(rollDrumRarity(() => commonEnd + 0.01)).toBe("rare");
  });

  it("prefers locked skins of the rolled rarity", () => {
    const ownedCommon = [
      "skin_standard_suit",
      "skin_flight_suit",
      "skin_exercise_apparel",
    ];
    const skin = pickSkinOfRarity("common", ownedCommon, () => 0);
    // all commons owned → falls back to full tier pool
    expect(skin?.rarity).toBe("common");
    const rare = pickSkinOfRarity("rare", ownedCommon, () => 0);
    expect(rare?.rarity).toBe("rare");
    expect(ownedCommon).not.toContain(rare?.id);
  });
});

describe("idle lock & backend sync state", () => {
  beforeEach(resetStore);

  it("tracks sessionLocked, idleTimeoutMs, and unrecognizedFacePhoto", () => {
    expect(userStore().sessionLocked).toBe(false);
    expect(userStore().idleTimeoutMs).toBe(180_000);
    userStore().setIdleTimeoutMs(60_000);
    userStore().setSessionLocked(true);
    userStore().setUnrecognizedFacePhoto(PHOTO);
    expect(userStore().idleTimeoutMs).toBe(60_000);
    expect(userStore().sessionLocked).toBe(true);
    expect(userStore().unrecognizedFacePhoto).toBe(PHOTO);
  });

  it("syncs remote operators and check-ins from backend session-state", () => {
    userStore().syncFromServer({
      users: [
        {
          id: "usr_srv_1",
          name: "Dr. Server",
          role: "medic",
          facePhoto: PHOTO,
          astronautId: "AST-U01",
          wheelSpinsClaimed: 2,
          createdAt: "2026-11-14T00:00:00Z",
        },
      ],
      checkIns: [
        {
          userId: "usr_srv_1",
          day: dayKeyForTest(0),
          at: "2026-11-14T12:00:00Z",
        },
      ],
    });
    expect(userStore().users).toHaveLength(1);
    expect(userStore().activeUserId).toBe("usr_srv_1");
    expect(userStore().wheelSpinsClaimed).toBe(2);
    expect(userStore().checkIns).toHaveLength(1);
  });
});

function dayKeyForTest(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
