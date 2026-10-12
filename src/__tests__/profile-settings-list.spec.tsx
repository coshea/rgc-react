import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { ProfileSettingsList } from "@/components/profile/profile-settings-list";

const saveMock = vi.fn();
const addToastMock = vi.fn();

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "u1", email: "pat@example.com", photoURL: null },
  }),
}));

vi.mock("@/hooks/useUserProfile", () => ({
  useUserProfile: () => ({
    userProfile: {
      firstName: "Pat",
      lastName: "Morgan",
      email: "pat@example.com",
      phone: "2035550142",
      ghinNumber: "1234567",
      tShirtSize: "L",
      defaultGoldTee: false,
      photoURL: "https://example.com/p.png",
    },
    save: (vars: unknown) => saveMock(vars),
    isSaving: false,
    isLoading: false,
  }),
}));

vi.mock("@/providers/toast", () => ({
  addToast: (args: unknown) => addToastMock(args),
}));

function renderList() {
  return render(
    <MemoryRouter>
      <ProfileSettingsList />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  saveMock.mockReset().mockResolvedValue(null);
  addToastMock.mockReset();
});

describe("ProfileSettingsList (phone edit)", () => {
  it("shows each field's current value in its row", () => {
    renderList();
    expect(screen.getByRole("button", { name: /Name\s*Pat Morgan/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GHIN number\s*1234567/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /T-shirt size\s*L/ })).toBeInTheDocument();
  });

  it("edits the name in a sheet and saves the whole profile", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Name\s*Pat Morgan/ }));

    const first = await screen.findByLabelText(/First name/);
    fireEvent.change(first, { target: { value: "Patricia" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const { data } = saveMock.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.firstName).toBe("Patricia");
    expect(data.displayName).toBe("Patricia Morgan");
    // Untouched fields are preserved.
    expect(data.ghinNumber).toBe("1234567");
    expect(data.tShirtSize).toBe("L");
    expect(data.photoURL).toBe("https://example.com/p.png");
  });

  it("blocks saving an empty last name", async () => {
    renderList();
    fireEvent.click(screen.getByRole("button", { name: /Name\s*Pat Morgan/ }));
    const last = await screen.findByLabelText(/Last name/);
    fireEvent.change(last, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Last name is required")).toBeInTheDocument();
    expect(saveMock).not.toHaveBeenCalled();
  });

  it("saves the gold-tee preference as soon as it is toggled", async () => {
    renderList();
    fireEvent.click(screen.getByRole("switch", { name: /Default to gold tees/ }));
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    const { data } = saveMock.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data.defaultGoldTee).toBe(true);
  });
});
