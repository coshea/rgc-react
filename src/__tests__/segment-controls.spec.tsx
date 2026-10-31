import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { DirectoryFilters } from "@/components/membership/DirectoryFilters";
import { ShirtSizePicker } from "@/components/profile/shirt-size-picker";
import { DIRECTORY_FILTER } from "@/utils/memberDirectory";
import MoneyListPage from "@/pages/money-list";

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true, loading: false }),
}));
vi.mock("@/hooks/usePageTracking", () => ({ usePageTracking: () => {} }));
vi.mock("@/components/yearly-winnings-standings", () => ({
  YearlyWinningsStandings: () => <p>standings view</p>,
}));
vi.mock("@/components/tournament-breakdown", () => ({
  TournamentBreakdown: () => <p>breakdown view</p>,
}));
vi.mock("@/components/yearly-team-winners", () => ({
  YearlyTeamWinners: () => <p>teams view</p>,
}));

describe("DirectoryFilters", () => {
  function renderFilters(showActiveFilter: boolean) {
    const onFilterChange = vi.fn();
    render(
      <DirectoryFilters
        query=""
        onQueryChange={vi.fn()}
        filter={DIRECTORY_FILTER.ALL}
        onFilterChange={onFilterChange}
        showActiveFilter={showActiveFilter}
      />,
    );
    return onFilterChange;
  }

  it("marks the current filter and reports a new one", () => {
    const onFilterChange = renderFilters(false);

    expect(screen.getByRole("radio", { name: "All" })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: "Board" }));
    expect(onFilterChange).toHaveBeenCalledWith(DIRECTORY_FILTER.BOARD);
  });

  it("only offers the active filter to admins", () => {
    renderFilters(false);
    expect(
      screen.queryByRole("radio", { name: "Active, last 2 years" }),
    ).not.toBeInTheDocument();
  });

  it("offers the active filter when allowed", () => {
    const onFilterChange = renderFilters(true);
    fireEvent.click(
      screen.getByRole("radio", { name: "Active, last 2 years" }),
    );
    expect(onFilterChange).toHaveBeenCalledWith(DIRECTORY_FILTER.ACTIVE);
  });
});

describe("ShirtSizePicker", () => {
  it("shows every size and selects one", () => {
    const onChange = vi.fn();
    render(<ShirtSizePicker value="M" onChange={onChange} />);

    expect(
      screen.getByRole("radiogroup", { name: "T-shirt size" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(7);
    expect(screen.getByRole("radio", { name: "M" })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "2XL" }));
    expect(onChange).toHaveBeenCalledWith("2XL");
  });

  it("has no selection when no size is saved", () => {
    render(<ShirtSizePicker value="" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("clears the highlight when the size is reset", () => {
    const { rerender } = render(
      <ShirtSizePicker value="M" onChange={vi.fn()} />,
    );
    expect(screen.getByRole("radio", { name: "M" })).toBeChecked();

    rerender(<ShirtSizePicker value="" onChange={vi.fn()} />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).not.toBeChecked();
    }
  });

  it("marks the picker invalid", () => {
    render(<ShirtSizePicker value="" onChange={vi.fn()} isInvalid />);
    expect(screen.getByRole("radiogroup")).toHaveAttribute(
      "data-invalid",
      "true",
    );
  });
});

describe("MoneyListPage views", () => {
  it("switches between the three views with one segmented control", () => {
    render(<MoneyListPage />);

    expect(screen.getByRole("radio", { name: "Standings" })).toBeChecked();
    expect(screen.getByText("standings view")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Tournaments" }));
    expect(screen.getByText("breakdown view")).toBeInTheDocument();
    expect(screen.queryByText("standings view")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "Teams" }));
    expect(screen.getByText("teams view")).toBeInTheDocument();
  });
});
