import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { OfflineBanner } from "@/components/offline-banner";

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  window.dispatchEvent(new Event(value ? "online" : "offline"));
}

describe("OfflineBanner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing while online", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });

  it("appears when the connection drops and hides when it returns", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);

    act(() => setOnline(false));
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(
      screen.getByText(/tournaments and registrations saved on this device/i),
    ).toBeInTheDocument();

    act(() => setOnline(true));
    expect(screen.queryByText(/you're offline/i)).not.toBeInTheDocument();
  });
});
