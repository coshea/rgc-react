import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Tournament } from "@/types/tournament";

const navigateMock = vi.fn();
const addToastMock = vi.fn();
const routeState = vi.hoisted(() => ({
  params: {} as { firestoreId?: string },
  search: "",
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
  useParams: () => routeState.params,
  useSearchParams: () => [new URLSearchParams(routeState.search)],
}));

vi.mock("@/hooks/usePageTracking", () => ({ usePageTracking: vi.fn() }));

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

type SnapHandler = (snap: unknown) => void;
const tournamentListeners = vi.hoisted(() => new Map<string, SnapHandler>());
const fetchTournamentMock = vi.fn();

vi.mock("@/api/tournaments", () => ({
  onTournament: (id: string, next: SnapHandler) => {
    tournamentListeners.set(id, next);
    return () => tournamentListeners.delete(id);
  },
  mapTournamentDoc: (snap: { id: string; data: () => object }) => ({
    firestoreId: snap.id,
    ...snap.data(),
  }),
  fetchTournament: (id: string) => fetchTournamentMock(id),
}));

// The editor itself is covered in tournament-editor.spec.tsx; here we only
// check what the page hands it and how the page reacts to save/cancel.
vi.mock("@/components/tournament-editor", () => ({
  TournamentEditor: ({
    tournament,
    initialValues,
    onSave,
    onCancel,
  }: {
    tournament?: Tournament | null;
    initialValues?: Partial<Tournament>;
    onSave: (t: Tournament) => void;
    onCancel: () => void;
  }) => (
    <div data-testid="editor">
      <span data-testid="editor-tournament">{tournament?.title ?? "none"}</span>
      <span data-testid="editor-initial">
        {JSON.stringify(initialValues ?? null)}
      </span>
      <button
        type="button"
        onClick={() =>
          onSave({
            firestoreId: "2026-spring-open",
            title: "Spring Open",
          } as Tournament)
        }
      >
        save
      </button>
      <button type="button" onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));

import TournamentEditPage from "@/pages/tournament-edit";

const emit = (id: string, data: object | null) => {
  const handler = tournamentListeners.get(id);
  if (!handler) throw new Error(`no listener for ${id}`);
  handler({ id, exists: () => data !== null, data: () => data ?? {} });
};

describe("TournamentEditPage", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    addToastMock.mockReset();
    fetchTournamentMock.mockReset();
    tournamentListeners.clear();
    routeState.params = {};
    routeState.search = "";
  });

  describe("editing", () => {
    beforeEach(() => {
      routeState.params = { firestoreId: "2026-fall-better-ball" };
    });

    it("loads the tournament and hands it to the editor", async () => {
      render(<TournamentEditPage />);
      expect(screen.getByText(/Loading editor/i)).toBeInTheDocument();

      await waitFor(() =>
        expect(tournamentListeners.has("2026-fall-better-ball")).toBe(true),
      );
      emit("2026-fall-better-ball", { title: "Fall Better Ball" });

      expect(await screen.findByTestId("editor-tournament")).toHaveTextContent(
        "Fall Better Ball",
      );
    });

    it("stays on the page after saving and returns to the tournament on cancel", async () => {
      render(<TournamentEditPage />);
      await waitFor(() =>
        expect(tournamentListeners.has("2026-fall-better-ball")).toBe(true),
      );
      emit("2026-fall-better-ball", { title: "Fall Better Ball" });

      fireEvent.click(await screen.findByRole("button", { name: "save" }));
      expect(navigateMock).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "cancel" }));
      expect(navigateMock).toHaveBeenCalledWith(
        "/tournaments/2026-fall-better-ball",
      );
    });

    it("sends you back to the list when the tournament doesn't exist", async () => {
      render(<TournamentEditPage />);
      await waitFor(() =>
        expect(tournamentListeners.has("2026-fall-better-ball")).toBe(true),
      );
      emit("2026-fall-better-ball", null);

      expect(navigateMock).toHaveBeenCalledWith("/tournaments", {
        replace: true,
      });
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Not found", color: "danger" }),
      );
    });
  });

  describe("creating", () => {
    it("starts blank and opens the edit page after the tournament is created", async () => {
      render(<TournamentEditPage />);

      expect(await screen.findByTestId("editor-initial")).toHaveTextContent(
        "null",
      );
      fireEvent.click(screen.getByRole("button", { name: "save" }));
      expect(navigateMock).toHaveBeenCalledWith(
        "/tournaments/2026-spring-open/edit",
        { replace: true },
      );
    });

    it("prefills from the tournament named in ?from", async () => {
      routeState.search = "from=2025-fall-classic";
      fetchTournamentMock.mockResolvedValue({
        firestoreId: "2025-fall-classic",
        title: "Fall Classic",
        description: "Bracket event",
        players: 2,
        prizePool: 400,
        date: new Date("2025-08-14T00:00:00.000Z"),
        winnerGroups: [],
        bracketRoundPayouts: [{ round: 1, amount: 25 }],
      });

      render(<TournamentEditPage />);

      const initial = await screen.findByTestId("editor-initial");
      expect(fetchTournamentMock).toHaveBeenCalledWith("2025-fall-classic");
      expect(initial).toHaveTextContent('"title":"Fall Classic"');
      expect(initial).toHaveTextContent(
        '"bracketRoundPayouts":[{"round":1,"amount":25}]',
      );
    });

    it("falls back to a blank tournament when the template is missing", async () => {
      routeState.search = "from=missing";
      fetchTournamentMock.mockResolvedValue(null);

      render(<TournamentEditPage />);

      expect(await screen.findByTestId("editor-initial")).toHaveTextContent(
        "null",
      );
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Template not found" }),
      );
    });

    it("returns to the tournament list on cancel", async () => {
      render(<TournamentEditPage />);
      fireEvent.click(await screen.findByRole("button", { name: "cancel" }));
      expect(navigateMock).toHaveBeenCalledWith("/tournaments");
    });
  });
});
