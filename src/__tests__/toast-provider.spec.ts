/**
 * Verifies the addToast wrapper delegates correctly to the underlying HeroUI v3
 * toast() helper methods based on the `color` argument.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const toastMock = Object.assign(vi.fn(), {
  success: vi.fn(),
  danger: vi.fn(),
  warning: vi.fn(),
});

vi.mock("@heroui/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@heroui/react")>();
  return {
    ...actual,
    toast: toastMock,
  };
});

// Import after mock so the wrapper picks up the mocked toast
import { addToast } from "@/providers/toast";

describe("addToast provider wrapper", () => {
  beforeEach(() => {
    toastMock.mockClear();
    toastMock.success.mockClear();
    toastMock.danger.mockClear();
    toastMock.warning.mockClear();
  });

  it("passes title and color through to HeroUI addToast", () => {
    addToast({ title: "Saved", color: "success" });

    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(toastMock.success).toHaveBeenCalledWith("Saved", undefined);
  });

  it("passes description through when supplied", () => {
    addToast({
      title: "Error",
      description: "Something went wrong",
      color: "danger",
    });

    expect(toastMock.danger).toHaveBeenCalledWith("Error", {
      description: "Something went wrong",
    });
  });

  it("calls toast.warning for warning color", () => {
    addToast({ title: "Heads up", color: "warning" });

    expect(toastMock.warning).toHaveBeenCalledWith("Heads up", undefined);
  });

  it("calls base toast() for default/unrecognized colors", () => {
    addToast({ title: "Info" });

    expect(toastMock).toHaveBeenCalledWith("Info", undefined);
  });
});
