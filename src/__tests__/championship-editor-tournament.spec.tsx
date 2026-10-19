import { describe, it, expect, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { UnifiedChampionship } from "@/types/championship";
import type { Tournament } from "@/types/tournament";

const updateHistoricalChampionship = vi.fn();
const createHistoricalChampionship = vi.fn();

vi.mock("@/api/championships", () => ({
  updateHistoricalChampionship: (...args: unknown[]) =>
    updateHistoricalChampionship(...args),
  createHistoricalChampionship: (...args: unknown[]) =>
    createHistoricalChampionship(...args),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsers: () => ({ users: [], isLoading: false }),
}));

vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

let mockTournaments: Tournament[] = [];
vi.mock("@/hooks/useYearlyTournaments", () => ({
  useYearlyTournaments: () => ({
    tournaments: mockTournaments,
    isLoading: false,
  }),
}));

import { ChampionshipEditorModal } from "@/components/championship-editor-modal";

function tournament(firestoreId: string, title: string, date: string): Tournament {
  return {
    firestoreId,
    title,
    date: new Date(`${date}T00:00:00Z`),
    description: "",
    players: 0,
    prizePool: 0,
  };
}

const pisano: UnifiedChampionship = {
  id: "champ-1",
  year: 2026,
  championshipType: "pisano-cup",
  winnerNames: ["Al Price"],
  winnerIds: [],
  isHistorical: true,
};

async function save() {
  fireEvent.click(await screen.findByRole("button", { name: /update/i }));
  await waitFor(() => expect(updateHistoricalChampionship).toHaveBeenCalled());
  return updateHistoricalChampionship.mock.calls[0][1];
}

describe("ChampionshipEditorModal tournament link", () => {
  beforeEach(() => {
    updateHistoricalChampionship.mockReset().mockResolvedValue(undefined);
    createHistoricalChampionship.mockReset();
    mockTournaments = [
      tournament("member-guest", "Member Guest", "2026-06-14"),
      tournament("pisano-id", "The Pisano Cup", "2026-08-09"),
    ];
  });

  it("saves the title guess for an unlinked record", async () => {
    render(
      <ChampionshipEditorModal isOpen onClose={vi.fn()} championship={pisano} />,
    );
    expect(await save()).toMatchObject({ tournamentId: "pisano-id" });
  });

  it("keeps an existing link over the guess", async () => {
    render(
      <ChampionshipEditorModal
        isOpen
        onClose={vi.fn()}
        championship={{ ...pisano, tournamentId: "member-guest" }}
      />,
    );
    expect(await save()).toMatchObject({ tournamentId: "member-guest" });
  });

  it("clears the link when nothing matches", async () => {
    mockTournaments = [tournament("member-guest", "Member Guest", "2026-06-14")];
    render(
      <ChampionshipEditorModal isOpen onClose={vi.fn()} championship={pisano} />,
    );
    expect(await save()).toMatchObject({ tournamentId: null });
  });
});
