import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MemberHoverCard } from "@/components/member-hover-card";

const authState = vi.hoisted(() => ({
  value: { loading: false, userLoggedIn: true },
}));

vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => authState.value,
}));

vi.mock("@/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/users")>()),
  getUserProfile: vi.fn(async () => ({ displayName: "Pat Golfer" })),
}));

function renderCard(userId?: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <MemberHoverCard userId={userId}>
          <span>Pat Golfer</span>
        </MemberHoverCard>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const trigger = () =>
  document.querySelector('[data-slot="hover-card-trigger"]');

describe("MemberHoverCard", () => {
  beforeEach(() => {
    authState.value = { loading: false, userLoggedIn: true };
  });

  it("wraps the name in a hover trigger for signed-in members", () => {
    renderCard("uid-1");
    expect(screen.getByText("Pat Golfer")).toBeTruthy();
    expect(trigger()?.textContent).toBe("Pat Golfer");
  });

  it("renders plain children for visitors, who can't read profiles", () => {
    authState.value = { loading: false, userLoggedIn: false };
    renderCard("uid-1");
    expect(screen.getByText("Pat Golfer")).toBeTruthy();
    expect(trigger()).toBeNull();
  });

  it("renders plain children without a user id", () => {
    renderCard(undefined);
    expect(trigger()).toBeNull();
  });
});
