import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";

import { CountUp, scaleNumbers } from "@/components/season-wrapped/count-up";

function allowMotion(allow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: allow && query === "(prefers-reduced-motion: no-preference)",
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("scaleNumbers", () => {
  it("scales every number and keeps separators", () => {
    expect(scaleNumbers("$1,105", 0.5)).toBe("$553");
    expect(scaleNumbers("$1,105", 1)).toBe("$1,105");
    expect(scaleNumbers("3–1", 0)).toBe("0–0");
    expect(scaleNumbers("no digits", 0.5)).toBe("no digits");
  });
});

describe("CountUp", () => {
  afterEach(() => {
    vi.useRealTimers();
    allowMotion(false);
  });

  it("renders the final value when motion is reduced", () => {
    allowMotion(false);
    const { container } = render(<CountUp text="$1,105" />);
    expect(container).toHaveTextContent(/^\$1,105$/);
  });

  it("counts up from zero, keeping the final value for screen readers", () => {
    allowMotion(true);
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { container } = render(<CountUp text="$1,105" duration={900} />);

    expect(screen.getByText("$0")).toHaveAttribute("aria-hidden");
    expect(screen.getByText("$1,105")).toHaveClass("sr-only");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container).toHaveTextContent(/^\$1,105$/);
    expect(container.querySelector("[aria-hidden]")).toBeNull();
  });
});
