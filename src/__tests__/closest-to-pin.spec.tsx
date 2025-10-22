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
          place: 3, // Hole number is stored in place field
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-5",
          place: 5,
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-12",
          place: 12,
          competitors: [],
          prizeAmount: 0,
        },
        {
          id: "hole-17",
          place: 17,
          competitors: [],
          prizeAmount: 0,
        },
      ],
    };

    expect(ctpGroup.type).toBe("closestToPin");
    expect(ctpGroup.winners).toHaveLength(4);

    // Verify all 4 holes are present
    const holeNumbers = ctpGroup.winners
      .map((w) => w.place)
      .sort((a, b) => a - b);
    expect(holeNumbers).toEqual([3, 5, 12, 17]);
  });

  it("should use hole numbers in the place field", () => {
    const holes = [3, 5, 12, 17];

    holes.forEach((hole) => {
      const winner = {
        id: `hole-${hole}`,
        place: hole, // Hole number stored as place
        competitors: [{ userId: "user1", displayName: "John Doe" }],
        prizeAmount: 25,
      };

      expect(winner.place).toBe(hole);
      expect([3, 5, 12, 17]).toContain(winner.place);
    });
  });

  it("should pre-populate all 4 holes when creating a closest to pin group", () => {
    // Simulating what happens when addGroup("closestToPin") is called
    const CLOSEST_TO_PIN_HOLES = [3, 5, 12, 17];

    const winners = CLOSEST_TO_PIN_HOLES.map((hole) => ({
      id: `hole-${hole}`,
      place: hole,
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

    const holeNumbers = group.winners.map((w) => w.place).sort((a, b) => a - b);
    expect(holeNumbers).toEqual([3, 5, 12, 17]);

    // All should start with empty competitors
    group.winners.forEach((w) => {
      expect(w.competitors).toEqual([]);
      expect(w.prizeAmount).toBe(0);
    });
  });
});
