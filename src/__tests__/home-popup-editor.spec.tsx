import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { HOME_POPUP_STATUS } from "@/types/homePopup";
import { HOME_POPUP_TEMPLATES, formFromTemplate, ymdToUtcDate } from "@/utils/homePopup";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/hooks/useHomePopups", () => ({
  useSaveHomePopup: () => ({ mutateAsync: mocks.save, isPending: false }),
  useDeleteHomePopup: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/providers/toast", () => ({ addToast: mocks.toast }));

import { HomePopupEditor } from "@/components/admin-dashboard/home-popup/home-popup-editor";

const template = HOME_POPUP_TEMPLATES.find((t) => t.id === "membership-open")!;

function renderEditor(onSaved = vi.fn()) {
  render(
    <HomePopupEditor
      initialForm={formFromTemplate(template, ymdToUtcDate("2026-11-01"))}
      onSaved={onSaved}
      onClose={vi.fn()}
    />,
  );
  return { onSaved };
}

describe("HomePopupEditor", () => {
  beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue("new-id");
    mocks.toast.mockReset();
  });

  it("saves a draft before opening the preview, and the preview blocks links", async () => {
    const { onSaved } = renderEditor();
    const [previewButton] = screen.getAllByRole("button", { name: /Preview on this page/ });
    fireEvent.click(previewButton);

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0].input.status).toBe(HOME_POPUP_STATUS.DRAFT);
    expect(onSaved).toHaveBeenCalledWith("new-id");

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("links are off");
    fireEvent.click(screen.getAllByRole("button", { name: "Renew membership" }).at(-1)!);
    expect((await screen.findByText(/Links are off in preview/)).textContent).toContain("/membership");
  });

  it("uses the markdown editor for the message and shows its error", async () => {
    render(
      <HomePopupEditor
        initialForm={{
          ...formFromTemplate(template, ymdToUtcDate("2026-11-01")),
          title: "Hello",
          body: "",
        }}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const message = screen.getByLabelText("Message");
    expect(screen.getByRole("button", { name: "Bold" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Add a message.")).toBeTruthy();
    expect(message.getAttribute("aria-invalid")).toBe("true");
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("won't publish while template placeholders remain", async () => {
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(await screen.findByText(/Replace \[YEAR\] before publishing/)).toBeTruthy();
  });
});

describe("HomePopupEditor saving a new popup", () => {
  beforeEach(() => {
    mocks.save.mockReset().mockResolvedValue("new-id");
    mocks.toast.mockReset();
  });

  it("updates the popup it just created, even before the list refetches", async () => {
    // `popup` stays undefined, as when the list refetch hasn't landed.
    renderEditor();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(mocks.save.mock.calls[0][0].options.previous).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[1][0].options.previous).toEqual({
      id: "new-id",
      status: HOME_POPUP_STATUS.DRAFT,
    });
  });
});
