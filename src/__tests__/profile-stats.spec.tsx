import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { ProfileStats } from "@/components/profile/profile-stats";

describe("ProfileStats", () => {
  it("formats currency and plain counts", () => {
    render(
      <ProfileStats
        stats={[
          { label: "Lifetime winnings", value: 1240, isCurrency: true },
          { label: "Tournament wins", value: 3 },
        ]}
      />,
    );

    const stats = screen.getByLabelText("Stats");
    expect(stats).toHaveTextContent("$1,240Lifetime winnings");
    expect(stats).toHaveTextContent("3Tournament wins");
  });

  it("shows a skeleton instead of the value while loading", () => {
    render(
      <ProfileStats
        stats={[
          {
            label: "Championships",
            value: 2,
            isLoading: true,
            trend: { delta: 1, label: "vs 2025" },
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("Stats")).toHaveTextContent(/^Championships$/);
  });

  it("shows how much winnings went up against last year", () => {
    render(
      <ProfileStats
        stats={[
          {
            label: "2026 winnings",
            value: 300,
            isCurrency: true,
            trend: { delta: 120, label: "vs 2025" },
          },
        ]}
      />,
    );

    expect(screen.getByText(/\$120 vs 2025/)).toBeInTheDocument();
    expect(screen.getByText("Up")).toHaveClass("sr-only");
  });

  it("shows a drop as a positive amount marked down", () => {
    render(
      <ProfileStats
        stats={[
          {
            label: "2026 winnings",
            value: 50,
            isCurrency: true,
            trend: { delta: -75, label: "vs 2025" },
          },
        ]}
      />,
    );

    expect(screen.getByText(/\$75 vs 2025/)).toBeInTheDocument();
    expect(screen.getByText("Down")).toHaveClass("sr-only");
  });
});
