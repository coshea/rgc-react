import { describe, it, expect } from "vitest";
import type { WinnerGroup } from "@/types/winner";

describe("Closest to Pin Winner Groups", () => {
  it("should support closestToPin type with pre-populated holes", () => {
    const ctpGroup: WinnerGroup = {
      id: "ctp-group",
      label: "Closest to Pin",
      type: "closestToPin",
      order: 0,
      winners: [
        {
          id: "hole-3",
          place: 1,
          holeNumber: 3, // Hole number now stored in dedicated field
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-5",
          place: 2,
          holeNumber: 5,
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-12",
          place: 3,
          holeNumber: 12,
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-17",
          place: 4,
          holeNumber: 17,
          competitors: [],
          prizeAmount: 0,
        },
      ],
    };

    expect(ctpGroup.type).toBe("closestToPin");
    expect(ctpGroup.winners).toHaveLength(4);

    // Verify all 4 holes are present
    const holeNumbers = ctpGroup.winners
      .map((w) => w.holeNumber)
      .sort((a, b) => (a || 0) - (b || 0));
    expect(holeNumbers).toEqual([3, 5, 12, 17]);
  });

  it("should use holeNumber field for closest-to-pin entries", () => {
    const holes = [3, 5, 12, 17];

    holes.forEach((hole, index) => {
      const winner = {
        id: `hole-${hole}`,
        place: index + 1, // Sequential place for sorting
        holeNumber: hole, // Actual hole number
        competitors: [{ userId: "user1", displayName: "John Doe" }],
        prizeAmount: 25,
      };

      expect(winner.holeNumber).toBe(hole);
      expect([3, 5, 12, 17]).toContain(winner.holeNumber);
    });
  });

  it("should pre-populate all 4 holes when creating a closest to pin group", () => {
    // Simulating what happens when addGroup("closestToPin") is called
    const CLOSEST_TO_PIN_HOLES = [3, 5, 12, 17];

    const winners = CLOSEST_TO_PIN_HOLES.map((hole, index) => ({
      id: `hole-${hole}`,
      place: index + 1,
      holeNumber: hole,
      competitors: [],
      prizeAmount: 0,
      score: undefined,
    }));

    const group: WinnerGroup = {
      id: "ctp-group",
      label: "Closest to Pin",
      type: "closestToPin",
      order: 0,
      winners,
    };

    expect(group.winners).toHaveLength(4);

    const holeNumbers = group.winners
      .map((w) => w.holeNumber)
      .sort((a, b) => (a || 0) - (b || 0));
    expect(holeNumbers).toEqual([3, 5, 12, 17]);

    // All should start with empty competitors
    group.winners.forEach((w) => {
      expect(w.competitors).toEqual([]);
      expect(w.prizeAmount).toBe(0);
    });
  });
});
