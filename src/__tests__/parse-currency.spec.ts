import { describe, it, expect } from "vitest";
import { parseCurrencyInput } from "@/utils/currency";

describe("parseCurrencyInput", () => {
  it("returns 0 for empty or whitespace", () => {
    expect(parseCurrencyInput("")).toBe(0);
    expect(parseCurrencyInput("   ")).toBe(0);
  });

  it("returns 0 for zero or negative values", () => {
    expect(parseCurrencyInput("0")).toBe(0);
    expect(parseCurrencyInput("-5")).toBe(0);
    expect(parseCurrencyInput("0.00")).toBe(0);
  });

  it("parses valid positive numbers", () => {
    expect(parseCurrencyInput("12.34")).toBeCloseTo(12.34);
    expect(parseCurrencyInput("  5.5 ")).toBeCloseTo(5.5);
  });
});
