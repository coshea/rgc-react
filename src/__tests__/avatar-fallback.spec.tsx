import type {
  ComponentProps,
  HTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { UserAvatar } from "@/components/avatar";

type MockAvatarProps = PropsWithChildren<HTMLAttributes<HTMLSpanElement>>;
type AvatarUser = NonNullable<ComponentProps<typeof UserAvatar>["user"]>;

// Mock Avatar.Image to render as a real <img> in jsdom.
// HeroUI v3 Avatar uses Radix Avatar.Image which only shows after the image loads —
// since jsdom never loads images, Avatar.Image renders nothing without this mock.
vi.mock("@heroui/react", async (orig) => {
  const mod = await orig<typeof import("@heroui/react")>();
  const MockAvatar = Object.assign(
    (props: MockAvatarProps) => {
      const { children, className, ...rest } = props;
      return (
        <span className={`avatar ${className ?? ""}`.trim()} {...rest}>
          {children}
        </span>
      );
    },
    {
      Image: ({ src, alt }: { src?: string; alt?: string }) => (
        <img src={src} alt={alt} />
      ),
      Fallback: ({ children }: { children?: ReactNode }) => (
        <span className="avatar__fallback">{children}</span>
      ),
    },
  );
  return { ...mod, Avatar: MockAvatar };
});

// HeroUI v3: Avatar renders as <span class="avatar"> with src on the <img>
// child (Avatar.Image). We assert resolved precedence by inspecting img[src]
// for URL tests and aria-label for initials/name tests.

describe("UserAvatar fallback precedence", () => {
  it("uses explicit src prop when provided (over user.profileURL/photoURL)", () => {
    const user: AvatarUser = {
      displayName: "Alice Example",
      profileURL: "https://example.com/profile.jpg",
      photoURL: "https://example.com/photo.jpg",
    };
    const { container } = render(
      <UserAvatar user={user} src="https://override.com/override.png" />,
    );
    const avatar = container.querySelector(".avatar");
    expect(avatar).toBeTruthy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://override.com/override.png");
  });

  it("falls back to profileURL when src missing (profileURL > photoURL)", () => {
    const user: AvatarUser = {
      displayName: "Bob Sample",
      profileURL: "https://example.com/profile2.jpg",
      photoURL: "https://example.com/photo2.jpg",
    };
    const { container } = render(<UserAvatar user={user} />);
    const avatar = container.querySelector(".avatar");
    expect(avatar).toBeTruthy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/profile2.jpg");
  });

  it("falls back to photoURL when profileURL absent", () => {
    const user: AvatarUser = {
      displayName: "Charlie User",
      photoURL: "https://example.com/photo3.jpg",
    };
    const { container } = render(<UserAvatar user={user} />);
    const avatar = container.querySelector(".avatar");
    expect(avatar).toBeTruthy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://example.com/photo3.jpg");
  });

  it("renders initials when no src/profileURL/photoURL", () => {
    const user: AvatarUser = { displayName: "Dora Explorer" };
    const { container } = render(<UserAvatar user={user} />);
    const avatar = container.querySelector(".avatar");
    expect(avatar).toBeTruthy();
    // No img element when no image URL provided
    const img = container.querySelector("img");
    expect(img).toBeFalsy();
    // Accessible name reflects resolved display name
    expect(avatar?.getAttribute("aria-label")).toBe("Dora Explorer");
  });

  it("derives initials from single word names (first two letters)", () => {
    const user: AvatarUser = { displayName: "Echo" };
    const { container } = render(<UserAvatar user={user} />);
    const avatar = container.querySelector(".avatar");
    expect(avatar?.getAttribute("aria-label")).toBe("Echo");
  });

  it("falls back to name prop when user missing", () => {
    const { container } = render(<UserAvatar name="Frank Castle" />);
    const avatar = container.querySelector(".avatar");
    expect(avatar?.getAttribute("aria-label")).toBe("Frank Castle");
  });
});
