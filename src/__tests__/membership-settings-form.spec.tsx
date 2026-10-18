import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

import { MembershipSettingsForm } from "@/components/membership/membership-settings-form";
import type { MembershipSettings } from "@/types/membershipSettings";

const adminState = vi.hoisted(() => ({ isAdmin: true }));
const apiState = vi.hoisted(() => ({
  update: vi.fn(),
  settings: {} as MembershipSettings,
  /** When set, the next subscription reports this error instead of data. */
  subscribeError: null as Error | null,
}));

vi.mock("@/components/membership/hooks", () => ({
  useAdminFlag: () => ({ isAdmin: adminState.isAdmin, loadingAdmin: false }),
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "admin-1" }, loading: false }),
}));

vi.mock("@/api/membership", () => ({
  subscribeMembershipSettings: (
    cb: (s: MembershipSettings) => void,
    onError: (error: Error) => void,
  ) => {
    if (apiState.subscribeError) {
      onError(apiState.subscribeError);
      apiState.subscribeError = null;
    } else {
      cb(apiState.settings);
    }
    return () => {};
  },
  updateMembershipSettings: apiState.update,
}));

vi.mock("@/api/storage", () => ({
  listPublicDocs: vi.fn(async () => []),
}));

vi.mock("@/providers/toast", () => ({ addToast: vi.fn() }));

describe("MembershipSettingsForm", () => {
  beforeEach(() => {
    adminState.isAdmin = true;
    apiState.update.mockReset().mockResolvedValue(undefined);
    apiState.subscribeError = null;
    apiState.settings = {
      registrationOpen: true,
      fullMembershipPrice: 100,
      handicapMembershipPrice: 50,
      closedMessage: "Closed for the season.",
    };
  });

  it("toggles registration status and automated emails, then saves both", async () => {
    const onDone = vi.fn();
    render(<MembershipSettingsForm layout="modal" onDone={onDone} />);

    const registration = await screen.findByRole("switch", {
      name: "Toggle registration status",
    });
    const emails = screen.getByRole("switch", {
      name: "Automated Member Emails",
    });
    expect(registration).toBeChecked();
    expect(emails).not.toBeChecked();
    expect(screen.getByRole("button", { name: /Save Changes/ })).toBeDisabled();

    fireEvent.click(registration);
    fireEvent.click(emails);

    expect(registration).not.toBeChecked();
    expect(emails).toBeChecked();
    expect(screen.getByText("Closed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Changes/ }));

    await waitFor(() =>
      expect(apiState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          registrationOpen: false,
          automatedMemberEmailsEnabled: true,
        }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it("offers a retry when settings fail to load", async () => {
    apiState.subscribeError = new Error("offline");
    render(<MembershipSettingsForm layout="page" />);

    fireEvent.click(await screen.findByRole("button", { name: /Try again/ }));

    expect(
      await screen.findByRole("switch", { name: "Toggle registration status" }),
    ).toBeInTheDocument();
  });

  it("shows the saved flag state", async () => {
    apiState.settings = { ...apiState.settings, automatedMemberEmailsEnabled: true };
    render(<MembershipSettingsForm layout="page" />);

    expect(
      await screen.findByRole("switch", { name: "Automated Member Emails" }),
    ).toBeChecked();
  });

  it("is read-only for non-admins (board members)", async () => {
    adminState.isAdmin = false;
    render(<MembershipSettingsForm layout="page" />);

    expect(
      await screen.findByText("Only admins can change membership settings."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Automated Member Emails" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /Save Changes/ }),
    ).not.toBeInTheDocument();
  });
});
