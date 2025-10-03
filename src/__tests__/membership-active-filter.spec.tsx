import { describe, it, expect } from "vitest";
import { MembersList } from "@/components/membership";
import type { User } from "@/api/users";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Minimal test to assert filtering and badge rendering logic without Firestore.

const baseUser = (
  id: string,
  name: string,
  extra: Partial<User> = {}
): User => ({
  id,
  displayName: name,
  email: id + "@test.local",
  ...extra,
});

describe("MembersList active filtering", () => {
  const users: User[] = [
    baseUser("u1", "Alice"),
    baseUser("u2", "Bob", { membershipType: "full" }),
    baseUser("u3", "Charlie", { membershipType: "handicap" }),
  ];
  const activeSet = new Set(["u2"]);

  it("shows all users when activeOnly=false", () => {
    render(
      <MemoryRouter>
        <MembersList
          members={users}
          filter=""
          isAdmin={false}
          activeSet={activeSet}
          activeOnly={false}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>
    );
    // Each appears twice (desktop row + mobile card)
    expect(screen.getAllByText("u1@test.local").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText("u2@test.local").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText("u3@test.local").length).toBeGreaterThanOrEqual(
      1
    );
  });

  it("filters to only active when activeOnly=true", () => {
    render(
      <MemoryRouter>
        <MembersList
          members={users}
          filter=""
          isAdmin={false}
          activeSet={activeSet}
          activeOnly={true}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </MemoryRouter>
    );
    // Only active user (u2) should be present
    expect(screen.queryByText("u1@test.local")).toBeNull();
    expect(screen.getAllByText("u2@test.local").length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryByText("u3@test.local")).toBeNull();
  });
});
