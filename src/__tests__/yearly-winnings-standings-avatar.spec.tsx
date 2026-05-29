import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { YearlyWinningsStandings } from "@/components/yearly-winnings-standings";

// Mock auth
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => ({ userLoggedIn: true }),
}));

// Mock winnings hook
vi.mock("@/hooks/useYearlyWinnings", () => ({
  useYearlyWinnings: () => ({
    isLoading: false,
    winnings: [
      { userId: "u1", displayName: "Alpha Player", total: 100, breakdown: [] },
    ],
  }),
}));

// Mock users map with profileURL so avatar should render an <img src>
vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      [
        "u1",
        {
          id: "u1",
          displayName: "Alpha Player",
          profileURL: "https://example.com/avatar-alpha.png",
        },
      ],
    ]),
    isLoading: false,
  }),
}));

// Mock Avatar.Image to render as a real <img> in jsdom.
// HeroUI v3 Avatar.Image (Radix) only shows when the image loads;
// jsdom never loads images so Avatar.Image renders nothing without this mock.
vi.mock("@heroui/react", async (orig) => {
  const mod = await orig();
  const MockAvatar = Object.assign(
    (props: any) => {
      const { children, name, className, ...rest } = props;
      return (
        <span
          className={`avatar ${className ?? ""}`.trim()}
          name={name}
          {...rest}
        >
          {children}
        </span>
      );
    },
    {
      Image: ({ src, alt }: { src?: string; alt?: string }) => (
        <img src={src} alt={alt} />
      ),
      Fallback: ({ children }: { children?: any }) => (
        <span className="avatar__fallback">{children}</span>
      ),
    },
  );
  return { ...(mod as any), Avatar: MockAvatar };
});

describe("YearlyWinningsStandings avatar rendering", () => {
  it("renders img avatar when profileURL available via usersMap", () => {
    const { container } = render(<YearlyWinningsStandings year={2025} />);
    // HeroUI v3 Avatar renders src on the <img> child (Avatar.Image), not on outer span
    const avatar = container.querySelector(".avatar");
    expect(avatar).toBeTruthy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe(
      "https://example.com/avatar-alpha.png",
    );
    // Ensure at least one textual occurrence of the player name (can appear multiple times: podium + table)
    const nameEls = screen.getAllByText("Alpha Player");
    expect(nameEls.length).toBeGreaterThan(0);
  });
});
