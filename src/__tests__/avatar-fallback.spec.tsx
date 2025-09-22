import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { UserAvatar } from "@/components/avatar";

// HeroUI Avatar renders an <img> when src provided, fallback otherwise.
// We'll assert resolved precedence by inspecting the img src and fallback text.

describe("UserAvatar fallback precedence", () => {
  it("uses explicit src prop when provided (over user.profileURL/photoURL)", () => {
    const user: any = {
      displayName: "Alice Example",
      profileURL: "https://example.com/profile.jpg",
      photoURL: "https://example.com/photo.jpg",
    };
    const { container } = render(
      <UserAvatar user={user} src="https://override.com/override.png" />
    );
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://override.com/override.png");
  });

  it("falls back to profileURL when src missing (profileURL > photoURL)", () => {
    const user: any = {
      displayName: "Bob Sample",
      profileURL: "https://example.com/profile2.jpg",
      photoURL: "https://example.com/photo2.jpg",
    };
    const { container } = render(<UserAvatar user={user} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/profile2.jpg");
  });

  it("falls back to photoURL when profileURL absent", () => {
    const user: any = {
      displayName: "Charlie User",
      photoURL: "https://example.com/photo3.jpg",
    };
    const { container } = render(<UserAvatar user={user} />);
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/photo3.jpg");
  });

  it("renders initials when no src/profileURL/photoURL", () => {
    const user: any = { displayName: "Dora Explorer" };
    const { getByText, container } = render(<UserAvatar user={user} />);
    // Should not have an <img> with src
    const img = container.querySelector("img");
    if (img) {
      // Some avatar libs still render img with empty src; ensure no real URL
      expect(img.getAttribute("src") || "").toBe("");
    }
    // Initials should be DE
    getByText("DE");
  });

  it("derives initials from single word names (first two letters)", () => {
    const user: any = { displayName: "Echo" };
    const { getByText } = render(<UserAvatar user={user} />);
    getByText("EC");
  });

  it("falls back to name prop when user missing", () => {
    const { getByText } = render(<UserAvatar name="Frank Castle" />);
    getByText("FC");
  });
});
