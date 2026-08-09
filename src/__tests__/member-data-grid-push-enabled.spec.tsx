import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MemberDataGridTab } from "@/components/admin-dashboard/member-data-grid-tab";

vi.mock("@iconify/react", () => ({
  Icon: ({ icon, className }: { icon: string; className?: string }) => (
    <span data-icon={icon} className={className} aria-hidden="true" />
  ),
}));

vi.mock("@heroui-pro/react/data-grid", () => ({
  DataGrid: ({
    columns,
    data,
  }: {
    columns: Array<{
      id: string;
      header: string;
      cell?: (row: unknown) => React.ReactNode;
    }>;
    data: Array<Record<string, unknown>>;
  }) => (
    <table aria-label="Members">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.id}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row) => (
          <tr key={String(row.id)}>
            {columns.map((column) => (
              <td key={column.id}>
                {column.cell ? column.cell(row) : String(row[column.id] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

vi.mock("@/components/search-input", () => ({
  SearchInput: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <input
      aria-label="Search members"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock("@/components/membership", () => ({
  EditMemberModal: () => null,
}));

vi.mock("@/components/avatar", () => ({
  UserAvatar: ({
    user,
  }: {
    user: { displayName?: string; email?: string };
  }) => <span>{user.displayName ?? user.email ?? "Avatar"}</span>,
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "admin-1" } }),
}));

const useMembersMock = vi.fn();
vi.mock("@/hooks/useMembers", () => ({
  useMembers: (...args: unknown[]) => useMembersMock(...args),
}));

const useAdminFlagMock = vi.fn();
const useMembersPushStatusMock = vi.fn();
vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: (...args: unknown[]) => useAdminFlagMock(...args),
  useMembersPushStatus: (...args: unknown[]) =>
    useMembersPushStatusMock(...args),
}));

describe("MemberDataGridTab push enabled column", () => {
  it("marks members enabled from stored push preferences or FCM tokens", () => {
    useAdminFlagMock.mockReturnValue({ isAdmin: true });
    useMembersPushStatusMock.mockReturnValue({
      pushEnabledUids: new Set(["token-user"]),
      loading: false,
    });
    useMembersMock.mockReturnValue({
      loading: false,
      activeSet: new Set<string>(),
      allMembers: [
        {
          id: "prefs-user",
          displayName: "Prefs User",
          email: "prefs@example.com",
          notificationPreferences: {
            tournamentRegistration: true,
            tournamentUpdates: true,
            generalAnnouncements: true,
            newFeatures: true,
            emailTournamentRegistration: true,
            emailTournamentUpdates: true,
            emailGeneralAnnouncements: true,
            emailNewFeatures: true,
          },
        },
        {
          id: "token-user",
          displayName: "Token User",
          email: "token@example.com",
        },
        {
          id: "off-user",
          displayName: "Off User",
          email: "off@example.com",
          notificationPreferences: {
            tournamentRegistration: false,
            tournamentUpdates: false,
            generalAnnouncements: false,
            newFeatures: false,
            emailTournamentRegistration: true,
            emailTournamentUpdates: true,
            emailGeneralAnnouncements: true,
            emailNewFeatures: true,
          },
        },
      ],
    });

    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemberDataGridTab />
      </QueryClientProvider>,
    );

    const prefsRow = screen.getByText("prefs@example.com").closest("tr");
    const tokenRow = screen.getByText("token@example.com").closest("tr");
    const offRow = screen.getByText("off@example.com").closest("tr");

    expect(prefsRow).not.toBeNull();
    expect(tokenRow).not.toBeNull();
    expect(offRow).not.toBeNull();

    expect(
      within(prefsRow as HTMLTableRowElement)
        .getAllByRole("cell")
        .some((cell) => cell.querySelector('[data-icon="lucide:bell"]')),
    ).toBe(true);
    expect(
      within(tokenRow as HTMLTableRowElement)
        .getAllByRole("cell")
        .some((cell) => cell.querySelector('[data-icon="lucide:bell"]')),
    ).toBe(true);
    expect(
      within(offRow as HTMLTableRowElement)
        .getAllByRole("cell")
        .some((cell) => cell.querySelector('[data-icon="lucide:bell-off"]')),
    ).toBe(true);
  });
});
