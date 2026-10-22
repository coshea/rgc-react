import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditMemberModal } from "@/components/membership/EditMemberModal";
import type { User } from "@/api/users";

const addToastMock = vi.fn();
vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

vi.mock("@/api/membership", () => ({
  getMembershipPayment: vi.fn().mockResolvedValue(null),
  updateMembershipPayment: vi.fn(),
  deleteMembershipPayment: vi.fn(),
}));

const savePrefsMock = vi.fn();
vi.mock("@/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/users")>()),
  saveMemberNotificationPreferences: (...args: unknown[]) =>
    savePrefsMock(...args),
}));

vi.mock("@iconify/react", () => ({
  Icon: ({ icon }: { icon: string }) => <span data-testid={`icon-${icon}`} />,
}));

const member: User = {
  id: "user-abc",
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  displayName: "Jane Smith",
  notificationPreferences: {
    tournamentRegistration: true,
    tournamentUpdates: true,
    generalAnnouncements: true,
    newFeatures: true,
    emailTournamentRegistration: true,
    emailTournamentUpdates: true,
    emailGeneralAnnouncements: false,
    emailNewFeatures: true,
  },
};

function renderModal(props: Partial<Parameters<typeof EditMemberModal>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <EditMemberModal
        open
        editing={member}
        form={{ firstName: "Jane", lastName: "Smith", email: "jane@example.com" }}
        onChange={vi.fn()}
        onClose={onClose}
        onSave={onSave}
        isAdmin
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSave, onClose };
}

function openNotificationsTab() {
  fireEvent.click(screen.getByRole("tab", { name: "Notifications" }));
}

describe("EditMemberModal – notification preferences", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savePrefsMock.mockResolvedValue(undefined);
  });

  it("shows the member's saved preferences", () => {
    renderModal();
    openNotificationsTab();
    expect(
      screen.getByRole("switch", { name: "Email: Tournament updates" }),
    ).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Email: Announcements" }),
    ).not.toBeChecked();
  });

  it("saves a changed preference for that member on Save", async () => {
    const { onSave, onClose } = renderModal();
    openNotificationsTab();

    fireEvent.click(
      screen.getByRole("switch", { name: "Email: Tournament updates" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalled();
    expect(savePrefsMock).toHaveBeenCalledWith(
      "user-abc",
      expect.objectContaining({
        emailTournamentUpdates: false,
        emailGeneralAnnouncements: false,
        tournamentUpdates: true,
      }),
    );
  });

  it("doesn't write preferences that weren't changed", async () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(savePrefsMock).not.toHaveBeenCalled();
  });

  it("keeps the modal open and warns when the preferences save fails", async () => {
    savePrefsMock.mockRejectedValue(new Error("permission-denied"));
    const { onClose } = renderModal();
    openNotificationsTab();

    fireEvent.click(screen.getByRole("switch", { name: "Push: New features" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(addToastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Preferences not saved" }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("is hidden when adding a new member", () => {
    renderModal({ editing: null });
    expect(screen.queryByRole("tab", { name: "Notifications" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add member" })).toBeInTheDocument();
  });
});
