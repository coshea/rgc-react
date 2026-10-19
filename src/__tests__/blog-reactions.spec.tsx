import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import {
  BLOG_REACTION_KEYS,
  BlogCategory,
  BlogPostStatus,
  type BlogReaction,
} from "@/types/blog";

const authState = vi.hoisted(() => ({
  value: {
    user: { uid: "me" } as { uid: string } | null,
    userLoggedIn: true,
    loading: false,
  },
}));
vi.mock("@/providers/AuthProvider", () => ({
  useAuth: () => authState.value,
}));

const api = vi.hoisted(() => ({
  getBlogReactions: vi.fn<(postId: string) => Promise<BlogReaction[]>>(),
  setMyBlogReactions: vi.fn<
    (postId: string, uid: string, emojis: string[]) => Promise<void>
  >(async () => undefined),
}));
vi.mock("@/api/blogReactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/blogReactions")>()),
  getBlogReactions: api.getBlogReactions,
  setMyBlogReactions: api.setMyBlogReactions,
}));

vi.mock("@/hooks/useUsers", () => ({
  useUsersMap: () => ({
    usersMap: new Map([
      ["a", { id: "a", firstName: "Pat", lastName: "Smith" }],
      ["b", { id: "b", firstName: "Jo", lastName: "Lee" }],
    ]),
    isLoading: false,
  }),
}));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/providers/toast", () => ({ addToast: toast }));

vi.mock("@/api/blog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/blog")>()),
  onPublishedBlogPosts: (
    next: (snap: { docs: { id: string; data: () => object }[] }) => void,
  ) => {
    next({
      docs: [
        {
          id: "post1",
          data: () => ({
            title: "Spring opener",
            slug: "spring-opener",
            status: BlogPostStatus.Published,
            category: BlogCategory.ClubNews,
            authorName: "Admin",
          }),
        },
      ],
    });
    return () => undefined;
  },
}));

import {
  summarizeReactions,
  useToggleBlogReaction,
  blogReactionsKey,
} from "@/hooks/useBlogReactions";
import { BlogReactions } from "@/components/blog-reactions";
import { RecentBlogPosts } from "@/components/recent-blog-posts";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderWithClient(ui: React.ReactElement, client = makeClient()) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  authState.value = {
    user: { uid: "me" },
    userLoggedIn: true,
    loading: false,
  };
  api.getBlogReactions.mockReset();
  api.setMyBlogReactions.mockReset();
  api.setMyBlogReactions.mockResolvedValue(undefined);
  toast.mockReset();
});

describe("summarizeReactions", () => {
  it("counts each emoji and finds my reactions", () => {
    const summary = summarizeReactions(
      [
        { uid: "a", emojis: ["thumbsUp", "birdie"] },
        { uid: "me", emojis: ["birdie"] },
      ],
      "me",
    );
    expect(summary.counts.birdie).toBe(2);
    expect(summary.counts.thumbsUp).toBe(1);
    expect(summary.counts.eagle).toBe(0);
    expect(summary.reactors.birdie).toEqual(["a", "me"]);
    expect(summary.mine).toEqual(["birdie"]);
    expect(summary.total).toBe(3);
  });
});

describe("useToggleBlogReaction", () => {
  function setup(initial: BlogReaction[]) {
    const client = makeClient();
    client.setQueryData(blogReactionsKey("post1"), initial);
    const { result } = renderHook(() => useToggleBlogReaction("post1"), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });
    return { client, result };
  }

  it("adds an emoji in BLOG_REACTIONS order and saves the full list", async () => {
    api.getBlogReactions.mockResolvedValue([]);
    const { result } = setup([{ uid: "me", emojis: ["eagle"] }]);
    act(() => result.current.toggle("thumbsUp"));
    await waitFor(() =>
      expect(api.setMyBlogReactions).toHaveBeenCalledWith("post1", "me", [
        "thumbsUp",
        "eagle",
      ]),
    );
  });

  it("removes an emoji I already picked", async () => {
    api.getBlogReactions.mockResolvedValue([]);
    const { result } = setup([{ uid: "me", emojis: ["eagle", "heart"] }]);
    act(() => result.current.toggle("eagle"));
    await waitFor(() =>
      expect(api.setMyBlogReactions).toHaveBeenCalledWith("post1", "me", [
        "heart",
      ]),
    );
  });

  it("rolls back the optimistic update and shows a toast on failure", async () => {
    const initial: BlogReaction[] = [{ uid: "a", emojis: ["clap"] }];
    let rejectSave: (e: Error) => void = () => undefined;
    api.setMyBlogReactions.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSave = reject;
        }),
    );
    api.getBlogReactions.mockResolvedValue(initial);
    const { client, result } = setup(initial);

    act(() => result.current.toggle("clap"));
    await waitFor(() =>
      expect(client.getQueryData(blogReactionsKey("post1"))).toEqual([
        { uid: "a", emojis: ["clap"] },
        { uid: "me", emojis: ["clap"] },
      ]),
    );

    await act(async () => rejectSave(new Error("offline")));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(client.getQueryData(blogReactionsKey("post1"))).toEqual(initial);
  });
});

describe("BlogReactions", () => {
  it("renders nothing for logged-out visitors and never reads reactions", () => {
    authState.value = { user: null, userLoggedIn: false, loading: false };
    const { container } = renderWithClient(<BlogReactions postId="post1" />);
    expect(container.innerHTML).toBe("");
    expect(api.getBlogReactions).not.toHaveBeenCalled();
  });

  it("shows counts for emojis in use, marking mine as pressed", async () => {
    api.getBlogReactions.mockResolvedValue([
      { uid: "a", emojis: ["birdie", "clap"] },
      { uid: "me", emojis: ["birdie"] },
    ]);
    renderWithClient(<BlogReactions postId="post1" />);

    const birdie = await screen.findByRole("button", {
      name: "Birdie, 2 reactions",
    });
    expect(birdie.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen
        .getByRole("button", { name: "Applause, 1 reaction" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
    expect(screen.queryByRole("button", { name: /^Eagle/ })).toBeNull();
  });

  it("compact mode shows the top 3 emojis", async () => {
    api.getBlogReactions.mockResolvedValue([
      { uid: "a", emojis: ["thumbsUp", "heart", "laugh", "eagle"] },
      { uid: "b", emojis: ["eagle", "laugh"] },
    ]);
    renderWithClient(<BlogReactions postId="post1" compact />);

    await screen.findByRole("button", { name: "Eagle, 2 reactions" });
    expect(
      screen.getByRole("button", { name: "Haha, 2 reactions" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Thumbs up, 1 reaction" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Love/ })).toBeNull();
    expect(screen.getByText("+1 more")).toBeTruthy();
  });
});

describe("who reacted", () => {
  it("lists who reacted when a chip gets keyboard focus", async () => {
    api.getBlogReactions.mockResolvedValue([
      { uid: "a", emojis: ["birdie"] },
      { uid: "me", emojis: ["birdie"] },
    ]);
    renderWithClient(<BlogReactions postId="post1" />);
    const chip = await screen.findByRole("button", {
      name: "Birdie, 2 reactions",
    });
    // Tooltips open on hover or keyboard focus; jsdom can't hover.
    fireEvent.keyDown(document.body, { key: "Tab" });
    act(() => chip.focus());
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain("You");
    expect(tooltip.textContent).toContain("Pat Smith");
  });

  function pointer(type: string, pointerType: string) {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: 0,
      clientY: 0,
    });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    return event;
  }

  it("press and hold on touch shows names without toggling", async () => {
    api.getBlogReactions.mockResolvedValue([{ uid: "a", emojis: ["birdie"] }]);
    renderWithClient(<BlogReactions postId="post1" />);
    const chip = await screen.findByRole("button", {
      name: "Birdie, 1 reaction",
    });

    act(() => {
      chip.dispatchEvent(pointer("pointerdown", "touch"));
    });
    const dialog = await screen.findByRole(
      "dialog",
      { name: "Birdie reactions" },
      { timeout: 1500 },
    );
    expect(dialog.textContent).toContain("Pat Smith");

    // The release that ends the hold must not toggle the reaction.
    act(() => {
      chip.dispatchEvent(pointer("pointerup", "touch"));
    });
    fireEvent.click(chip);
    expect(api.setMyBlogReactions).not.toHaveBeenCalled();
  });

  it("a mouse press doesn't start a hold", async () => {
    api.getBlogReactions.mockResolvedValue([{ uid: "a", emojis: ["birdie"] }]);
    renderWithClient(<BlogReactions postId="post1" />);
    const chip = await screen.findByRole("button", {
      name: "Birdie, 1 reaction",
    });
    act(() => {
      chip.dispatchEvent(pointer("pointerdown", "mouse"));
    });
    await new Promise((r) => setTimeout(r, 700));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("gives screen readers the names", async () => {
    api.getBlogReactions.mockResolvedValue([
      { uid: "a", emojis: ["birdie"] },
      { uid: "me", emojis: ["birdie"] },
    ]);
    renderWithClient(<BlogReactions postId="post1" />);
    const chip = await screen.findByRole("button", {
      name: "Birdie, 2 reactions",
    });
    const id = chip.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(id)?.textContent).toBe("You, Pat Smith");
  });

  it("'+N more' opens the hidden reactions with names", async () => {
    api.getBlogReactions.mockResolvedValue([
      { uid: "a", emojis: ["thumbsUp", "heart", "laugh", "eagle"] },
      { uid: "b", emojis: ["eagle", "laugh"] },
    ]);
    renderWithClient(<BlogReactions postId="post1" compact />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Show 1 more reaction" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "1 more reaction",
    });
    const love = screen.getByRole("button", { name: "Love, 1 reaction" });
    expect(dialog.contains(love)).toBe(true);
    expect(dialog.textContent).toContain("Pat Smith");
  });
});

describe("RecentBlogPosts card", () => {
  it("keeps reaction buttons outside the post link", async () => {
    api.getBlogReactions.mockResolvedValue([{ uid: "a", emojis: ["birdie"] }]);
    renderWithClient(<RecentBlogPosts limit={1} />);

    const link = await screen.findByRole("link", { name: /Spring opener/ });
    expect(link.getAttribute("href")).toBe("/announcements/spring-opener");
    const reaction = await screen.findByRole("button", {
      name: "Birdie, 1 reaction",
    });
    expect(link.contains(reaction)).toBe(false);
    expect(link.querySelector("button")).toBeNull();
  });
});

describe("firestore.rules", () => {
  it("allows exactly the BLOG_REACTIONS keys", () => {
    const rules = readFileSync(
      resolve(__dirname, "../../firestore.rules"),
      "utf8",
    );
    const block = rules.slice(rules.indexOf("match /reactions/{uid}"));
    const list = block.match(/emojis\.hasOnly\(\[([^\]]*)\]\)/);
    expect(list).not.toBeNull();
    const keys = [...(list?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(keys).toEqual([...BLOG_REACTION_KEYS]);
  });
});
