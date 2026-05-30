import { describe, expect, it } from "vitest";

import { buildBracketMatchupEmailHtml } from "../sendBracketMatchupEmails";

const BASE_PARAMS = {
  firstName: "Alice",
  tournamentTitle: "Club Championship",
  roundLabel: "Quarter Finals",
  yourTeamName: "Alice +1",
  opponentTeamName: "Bob +1",
  matchupLabel: "Alice +1 vs Bob +1",
  tournamentUrl: "https://ridgefieldgolfclub.org/tournaments/abc123",
};

describe("buildBracketMatchupEmailHtml", () => {
  it("is valid HTML with doctype and closing tags", () => {
    const html = buildBracketMatchupEmailHtml(BASE_PARAMS);
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/i);
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
  });

  it("renders matchup details", () => {
    const html = buildBracketMatchupEmailHtml(BASE_PARAMS);
    expect(html).toContain("Club Championship");
    expect(html).toContain("Quarter Finals");
    expect(html).toContain("Alice +1 vs Bob +1");
    expect(html).toContain("Your Team:");
    expect(html).toContain("Opponent:");
  });

  it("includes tracked URL parameters", () => {
    const html = buildBracketMatchupEmailHtml(BASE_PARAMS);
    expect(html).toContain("utm_source=email");
    expect(html).toContain("utm_campaign=bracket_matchup");
    expect(html).toContain("utm_content=player_alert");
  });

  it("escapes user-provided values", () => {
    const html = buildBracketMatchupEmailHtml({
      ...BASE_PARAMS,
      firstName: '<img src=x onerror="alert(1)">',
      opponentTeamName: '<script>alert("xss")</script>',
    });

    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
});
