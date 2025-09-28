import { describe, it, expect } from "vitest";
import { normalizePhone, formatPhone } from "@/utils/phone";

describe("phone utils", () => {
  it("normalizes digits", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("5551234567");
    expect(normalizePhone("555-1234")).toBe("5551234");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone(undefined)).toBe("");
  });

  it("formats 10-digit numbers", () => {
    expect(formatPhone("5551234567")).toBe("(555) 123-4567");
    expect(formatPhone("(555)123-4567")).toBe("(555) 123-4567");
  });

  it("formats 7-digit numbers", () => {
    expect(formatPhone("5551234")).toBe("555-1234");
  });

  it("returns trimmed original for other lengths", () => {
    expect(formatPhone("123")).toBe("123");
    expect(formatPhone("  123  ")).toBe("123");
  });
});
