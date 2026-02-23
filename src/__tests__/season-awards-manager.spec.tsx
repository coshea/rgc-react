import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { SeasonAwardsManager } from "@/components/season-awards-manager";
import { SeasonAwardType } from "@/types/seasonAwards";

const upsertSeasonAwardMock = vi.fn();
const deleteSeasonAwardMock = vi.fn();
const onSeasonAwardsByYearMock = vi.fn();

vi.mock("@/api/seasonAwards", () => ({
  upsertSeasonAward: (...args: unknown[]) => upsertSeasonAwardMock(...args),
  deleteSeasonAward: (...args: unknown[]) => deleteSeasonAwardMock(...args),
  onSeasonAwardsByYear: (...args: unknown[]) =>
    onSeasonAwardsByYearMock(...args),
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      [
        "u1",
        {
          id: "u1",
          displayName: "Alice Member",
          email: "alice@example.com",
        },
      ],
    ]),
  }),
}));

vi.mock("@/components/UserSelect", () => ({
  __esModule: true,
  default: ({ value, onChange, label }: any) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select member</option>
        <option value="u1">Alice Member</option>
      </select>
    </label>
  ),
}));

describe("SeasonAwardsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onSeasonAwardsByYearMock.mockImplementation(
      (_year: number, next: (items: unknown[]) => void) => {
        next([]);
        return () => {};
      },
    );
  });

  it("saves with amount override when provided", async () => {
    upsertSeasonAwardMock.mockResolvedValue("award-1");

    render(<SeasonAwardsManager />);

    fireEvent.change(screen.getByLabelText("Member"), {
      target: { value: "u1" },
    });

    fireEvent.change(screen.getByLabelText("Amount override (optional)"), {
      target: { value: "75" },
    });

    fireEvent.click(screen.getByRole("button", { name: /add award/i }));

    await waitFor(() => {
      expect(upsertSeasonAwardMock).toHaveBeenCalledTimes(1);
    });

    const payload = upsertSeasonAwardMock.mock.calls[0][0];
    expect(payload.userId).toBe("u1");
    expect(payload.userDisplayName).toBe("Alice Member");
    expect(payload.awardType).toBe(SeasonAwardType.HoleInOne);
    expect(payload.amount).toBe(75);
    expect(payload.seasonYear).toBe(new Date().getFullYear());
  });
});
