import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import type { WrappedAdminRow } from "@/api/seasonWrapped";
import {
  GENERATION_ROW_STATE,
  STALE_PENDING_MS,
  generationProgress,
  generationRowStates,
  type GenerationRequests,
} from "@/components/admin-dashboard/season-wrapped/generation";
import { WrappedMemberList } from "@/components/admin-dashboard/season-wrapped/wrapped-member-list";
import {
  SEASON_WRAPPED_GENERATION_STATUS as STATUS,
  type SeasonWrappedGeneration,
  type SeasonWrappedGenerationStatus,
} from "@@/seasonWrapped/types";
import { makeStory } from "./season-wrapped-fixtures";

const NOW = Date.parse("2026-11-02T12:00:00.000Z");
const T0 = "2026-11-02T11:59:00.000Z";
const T1 = "2026-11-02T11:59:30.000Z";

function statusDoc(uid: string, status: SeasonWrappedGenerationStatus, updatedAt = T1): SeasonWrappedGeneration {
  return { uid, status, runId: "run", updatedAt };
}

function docs(...list: SeasonWrappedGeneration[]) {
  return new Map(list.map((d) => [d.uid, d]));
}

describe("generationRowStates", () => {
  it("keeps a requested member pending until the server writes for the new run", () => {
    const requests: GenerationRequests = new Map([["a", { prev: T0, run: 1 }]]);
    // Only last run's doc so far.
    expect(generationRowStates(docs(statusDoc("a", STATUS.DONE, T0)), requests, NOW).get("a")).toBe(
      GENERATION_ROW_STATE.PENDING,
    );
    // The new run finished it.
    expect(generationRowStates(docs(statusDoc("a", STATUS.DONE, T1)), requests, NOW).has("a")).toBe(false);
  });

  it("follows server pending docs nobody here requested, e.g. new members in a full run", () => {
    expect(generationRowStates(docs(statusDoc("new", STATUS.PENDING)), new Map(), NOW).get("new")).toBe(
      GENERATION_ROW_STATE.PENDING,
    );
  });

  it("treats a pending doc from a dead run as failed", () => {
    const old = new Date(NOW - STALE_PENDING_MS - 1000).toISOString();
    expect(generationRowStates(docs(statusDoc("a", STATUS.PENDING, old)), new Map(), NOW).get("a")).toBe(
      GENERATION_ROW_STATE.FAILED,
    );
  });

  it("shows skipped only while requested", () => {
    const skipped = docs(statusDoc("a", STATUS.SKIPPED));
    const requests: GenerationRequests = new Map([["a", { prev: null, run: 1 }]]);
    expect(generationRowStates(skipped, requests, NOW).get("a")).toBe(GENERATION_ROW_STATE.SKIPPED);
    expect(generationRowStates(skipped, new Map(), NOW).has("a")).toBe(false);
  });

  it("counts progress over everything in flight", () => {
    const requests: GenerationRequests = new Map([
      ["a", { prev: null, run: 1 }],
      ["b", { prev: null, run: 1 }],
    ]);
    const states = generationRowStates(docs(statusDoc("a", STATUS.DONE), statusDoc("c", STATUS.PENDING)), requests, NOW);
    expect(generationProgress(states, requests)).toEqual({ done: 1, total: 3 });
    expect(generationProgress(new Map(), new Map())).toBeNull();
  });
});

describe("WrappedMemberList while generating", () => {
  const row = (uid: string, displayName: string): WrappedAdminRow => ({ story: makeStory({ uid, displayName }) });
  const rows = [row("a", "Al Adams"), row("z", "Zed Zimmer")];

  function renderList(states: Map<string, (typeof GENERATION_ROW_STATE)[keyof typeof GENERATION_ROW_STATE]>) {
    render(
      <WrappedMemberList
        rows={rows}
        states={states}
        names={new Map([["new", "Nora New"], ["skip", "Sam Skip"]])}
        testingUid={null}
        onPreview={vi.fn()}
        onSendTest={vi.fn()}
        onRegenerate={vi.fn()}
      />,
    );
    return within(screen.getByRole("list")).getAllByRole("listitem");
  }

  it("pins pending members at the top, with placeholders for ones without a story", () => {
    const items = renderList(
      new Map([
        ["z", GENERATION_ROW_STATE.PENDING],
        ["new", GENERATION_ROW_STATE.PENDING],
        ["skip", GENERATION_ROW_STATE.SKIPPED],
      ]),
    );
    expect(items.map((li) => li.querySelector("p")?.textContent)).toEqual([
      "Nora New",
      "Sam Skip",
      "Zed Zimmer",
      "Al Adams",
    ]);
    expect(items[0].textContent).toContain("Generating…");
    expect(items[0].getAttribute("aria-busy")).toBe("true");
    expect(items[1].textContent).toContain("Not eligible");
    expect(items[2].textContent).toContain("Regenerating…");
    const actions = within(items[2]).getByRole("button", { name: "Actions for Zed Zimmer" });
    expect(actions.hasAttribute("disabled") || actions.getAttribute("aria-disabled") === "true").toBe(true);
  });

  it("keeps pending rows visible whatever the filter", () => {
    renderList(new Map([["z", GENERATION_ROW_STATE.PENDING]]));
    fireEvent.click(screen.getByRole("button", { name: "Shared" }));
    expect(screen.queryByText("Zed Zimmer")).not.toBeNull();
    expect(screen.queryByText("Al Adams")).toBeNull();
  });

  it("flags a member whose last run failed", () => {
    const items = renderList(new Map([["a", GENERATION_ROW_STATE.FAILED]]));
    expect(items[0].textContent).toContain("Al Adams");
    expect(items[0].textContent).toContain("Last generate failed");
  });

  it("shows when each story was generated next to its version", () => {
    const items = renderList(new Map());
    const when = new Date(rows[0].story.generatedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    expect(items[0].textContent).toContain(`v${rows[0].story.version} · ${when}`);
  });
});
