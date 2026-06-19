import { describe, expect, it } from "vitest";

import {
  buildLeaderEmailHtml,
  buildMemberEmailHtml,
  buildRemovedMemberEmailHtml,
  buildTeamMembersHtml,
} from "../sendRegistrationEmails";

// ── Shared fixtures ──────────────────────────────────────────────────────────

const BASE_PARAMS = {
  firstName: "Alice",
  tournamentTitle: "Spring Scramble",
  tournamentDate: "Saturday, May 10, 2025",
  tournamentTee: "White tees",
  tournamentTeeTimes: "Assigned",
  teamMembersHtml: "<tr><td>Alice</td></tr>",
  tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/abc123",
};

const LEADER_PARAMS = { ...BASE_PARAMS };
const MEMBER_PARAMS = { ...BASE_PARAMS, leaderName: "Bob Smith" };
const REMOVED_MEMBER_PARAMS = { ...BASE_PARAMS, leaderName: "Bob Smith" };

// ── buildTeamMembersHtml ─────────────────────────────────────────────────────

describe("buildTeamMembersHtml", () => {
  const team = [
    { id: "u1", displayName: "Alice Anderson" },
    { id: "u2", displayName: "Bob Smith", goldTee: true },
    { id: "u3", displayName: "Carol Jones" },
  ];

  it("renders a row for each member", () => {
    const html = buildTeamMembersHtml(team, "u1");
    expect(html.match(/<tr>/g)).toHaveLength(3);
  });

  it("marks the owner with (Team Leader) badge", () => {
    const html = buildTeamMembersHtml(team, "u1");
    expect(html).toContain("Team Leader");
    // Non-owner rows should not contain the badge
    const rows = html.split("\n");
    // Only first row (Alice = owner) should have the badge
    expect(rows[0]).toContain("Team Leader");
    expect(rows[1]).not.toContain("Team Leader");
    expect(rows[2]).not.toContain("Team Leader");
  });

  it("shows gold tee badge only for members with goldTee=true", () => {
    const html = buildTeamMembersHtml(team, "u1");
    const rows = html.split("\n");
    expect(rows[0]).not.toContain("Gold Tees");
    expect(rows[1]).toContain("Gold Tees");
    expect(rows[2]).not.toContain("Gold Tees");
  });

  it("alternates row background colours", () => {
    const html = buildTeamMembersHtml(team, "u1");
    const rows = html.split("\n");
    expect(rows[0]).toContain("#ffffff");
    expect(rows[1]).toContain("#f9fafb");
    expect(rows[2]).toContain("#ffffff");
  });

  it("adds a bottom border between rows but not on the last row", () => {
    const html = buildTeamMembersHtml(team, "u1");
    const rows = html.split("\n");
    expect(rows[0]).toContain("border-bottom");
    expect(rows[1]).toContain("border-bottom");
    expect(rows[2]).not.toContain("border-bottom");
  });

  it("escapes HTML entities in member names", () => {
    const dangerous = [
      { id: "u1", displayName: '<script>alert("xss")</script>' },
    ];
    const html = buildTeamMembersHtml(dangerous, "u1");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("uses 'Unknown Member' fallback when displayName is missing", () => {
    const html = buildTeamMembersHtml([{ id: "u1" }], "u1");
    expect(html).toContain("Unknown Member");
  });
});

// ── buildLeaderEmailHtml ─────────────────────────────────────────────────────

describe("buildLeaderEmailHtml", () => {
  it("is valid HTML with DOCTYPE and closing tags", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
  });

  it("contains the tournament title", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("Spring Scramble");
  });

  it("contains the tournament date", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("Saturday, May 10, 2025");
  });

  it("contains the tee colour", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("White tees");
  });

  it("contains the tee times", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("Assigned");
  });

  it("renders Tee and Tee Times as separate labelled rows", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("<strong>Tee:</strong>");
    expect(html).toContain("<strong>Tee Times:</strong>");
  });

  it("greets the leader by first name", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("Alice");
  });

  it("includes the team members HTML", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain(BASE_PARAMS.teamMembersHtml);
  });

  it("CTA link has UTM parameters with content=leader", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).toContain("utm_source=email");
    expect(html).toContain("utm_campaign=tournament_registration");
    expect(html).toContain("utm_content=leader");
  });

  it("CTA link does NOT use the raw untracked URL", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    // The raw URL should only appear as the base of the tracked URL
    const rawHref = `href="${BASE_PARAMS.tournamentUrl}"`;
    expect(html).not.toContain(rawHref);
  });

  it("escapes HTML entities in tournament title", () => {
    const html = buildLeaderEmailHtml({
      ...LEADER_PARAMS,
      tournamentTitle: 'R&A "Open" <Classic>',
    });
    expect(html).not.toContain("<Classic>");
    expect(html).toContain("&lt;Classic&gt;");
    expect(html).toContain("&amp;");
    expect(html).toContain("&quot;");
  });

  it("preserves utm_content=leader when base URL already has a query string", () => {
    const html = buildLeaderEmailHtml({
      ...LEADER_PARAMS,
      tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/abc?ref=test",
    });
    // esc() encodes & as &amp; inside href attributes
    expect(html).toContain("&amp;utm_source=email");
    expect(html).toContain("utm_content=leader");
  });
});

// ── buildMemberEmailHtml ─────────────────────────────────────────────────────

describe("buildMemberEmailHtml", () => {
  it("is valid HTML with DOCTYPE and closing tags", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
  });

  it("contains the leader name in the greeting", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html).toContain("Bob Smith");
  });

  it("contains the tournament title", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html).toContain("Spring Scramble");
  });

  it("contains the tournament date", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html).toContain("Saturday, May 10, 2025");
  });

  it("renders Tee and Tee Times as separate labelled rows", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html).toContain("<strong>Tee:</strong>");
    expect(html).toContain("<strong>Tee Times:</strong>");
  });

  it("CTA link has UTM parameters with content=member", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    expect(html).toContain("utm_source=email");
    expect(html).toContain("utm_campaign=tournament_registration");
    expect(html).toContain("utm_content=member");
  });

  it("CTA link does NOT use the raw untracked URL", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    const rawHref = `href="${BASE_PARAMS.tournamentUrl}"`;
    expect(html).not.toContain(rawHref);
  });

  it("escapes HTML entities in leader name", () => {
    const html = buildMemberEmailHtml({
      ...MEMBER_PARAMS,
      leaderName: '<img src=x onerror="alert(1)">',
    });
    // The injected payload must be escaped — the raw tag must not appear
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("member email does NOT contain the team leader callout section", () => {
    const html = buildMemberEmailHtml(MEMBER_PARAMS);
    // Leader callout is exclusive to the leader email
    expect(html).not.toContain("As team leader, you can manage");
  });

  it("leader email does NOT mention the 'Need to make changes?' callout", () => {
    const html = buildLeaderEmailHtml(LEADER_PARAMS);
    expect(html).not.toContain("Need to make changes?");
  });
});

// ── buildRemovedMemberEmailHtml ─────────────────────────────────────────────

describe("buildRemovedMemberEmailHtml", () => {
  it("is valid HTML with DOCTYPE and closing tags", () => {
    const html = buildRemovedMemberEmailHtml(REMOVED_MEMBER_PARAMS);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
  });

  it("contains removal copy and leader name", () => {
    const html = buildRemovedMemberEmailHtml(REMOVED_MEMBER_PARAMS);
    expect(html).toContain("removed you from their team");
    expect(html).toContain("Bob Smith");
  });

  it("contains tournament details and previous team heading", () => {
    const html = buildRemovedMemberEmailHtml(REMOVED_MEMBER_PARAMS);
    expect(html).toContain("Spring Scramble");
    expect(html).toContain("Saturday, May 10, 2025");
    expect(html).toContain("Previous Team");
  });

  it("CTA link has UTM parameters with content=member_removed", () => {
    const html = buildRemovedMemberEmailHtml(REMOVED_MEMBER_PARAMS);
    expect(html).toContain("utm_source=email");
    expect(html).toContain("utm_campaign=tournament_registration");
    expect(html).toContain("utm_content=member_removed");
  });

  it("escapes HTML entities in leader name", () => {
    const html = buildRemovedMemberEmailHtml({
      ...REMOVED_MEMBER_PARAMS,
      leaderName: '<img src=x onerror="alert(1)">',
    });
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });
});
