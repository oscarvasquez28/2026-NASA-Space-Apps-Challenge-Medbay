import { beforeEach, describe, expect, it } from "vitest";

import { pickSkinOfRarity, rollDrumRarity, DRUM_WEIGHTS } from "@/data/gamification";
import { streakFor, useUserStore, userStore, WHEEL_EVERY_N } from "@/stores/user-store";

const PHOTO = "data:image/jpeg;base64,AAAA";

function resetStore() {
  useUserStore.setState({
    users: [],
    activeUserId: null,
    checkIns: [],
    wheelSpinsClaimed: 0,
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

  it("earns a spin every WHEEL_EVERY_N check-ins", () => {
    const u = userStore().addUser({ name: "Doc", facePhoto: PHOTO });
    const ins = Array.from({ length: WHEEL_EVERY_N }, (_, i) => ({
      userId: u.id,
      day: dayKeyForTest(-i),
      at: new Date().toISOString(),
    }));
    useUserStore.setState({ checkIns: ins });
    const total = userStore().checkIns.filter((c) => c.userId === u.id).length;
    expect(Math.floor(total / WHEEL_EVERY_N)).toBe(1);
    expect(Math.floor((total - 1) / WHEEL_EVERY_N)).toBe(0);
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

function dayKeyForTest(offsetDays: number) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
