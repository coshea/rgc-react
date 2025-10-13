import { describe, it, expect } from "vitest";
import { getPlaceMeta, formatPlaceLabel } from "@/utils/placeMeta";

/**
 * Dedicated tests for placement meta utility to ensure refactors
 * to icon or color logic surface intentional changes.
 */
describe("getPlaceMeta", () => {
  it("returns trophy + warning styles for first place", () => {
    const meta = getPlaceMeta(1);
    expect(meta.icon).toBe("lucide:trophy");
    expect(meta.colorClass).toContain("text-warning");
    expect(meta.badgeBg).toMatch(/amber|warning/i);
  });

  it("returns medal + neutral style for second place", () => {
    const meta = getPlaceMeta(2);
    expect(meta.icon).toBe("lucide:medal");
    expect(meta.colorClass).toContain("text-default-400");
    expect(meta.badgeBg).toMatch(/slate/i);
  });

  it("returns award bronze style for third place", () => {
    const meta = getPlaceMeta(3);
    expect(meta.icon).toBe("lucide:award");
    expect(meta.colorClass).toContain("text-amber-700");
    expect(meta.badgeBg).toMatch(/amber/i);
  });

  it("returns neutral award for other placements", () => {
    const meta = getPlaceMeta(7);
    expect(meta.icon).toBe("lucide:award");
    expect(meta.colorClass).toContain("text-default-400");
    expect(meta.badgeBg).toMatch(/default/i);
  });
});

describe("formatPlaceLabel", () => {
  it("formats labels as 'Place N'", () => {
    expect(formatPlaceLabel(1)).toBe("Place 1");
    expect(formatPlaceLabel(5)).toBe("Place 5");
  });
});
