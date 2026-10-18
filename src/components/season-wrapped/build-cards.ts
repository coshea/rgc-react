import type {
  MajorCard,
  SeasonWrappedMember,
  SeasonWrappedSeason,
  TributeCard,
} from "@@/seasonWrapped/types";

/** One screen of the story. Cards a member doesn't qualify for are left out. */
export type WrappedCardSpec =
  | { id: "intro" }
  | { id: "events" }
  | { id: "signup" }
  | { id: "crew" }
  | { id: "money" }
  | { id: "closest-to-pin" }
  | { id: "bracket" }
  | { id: "club" }
  | { id: "podium" }
  | { id: `major:${string}`; major: MajorCard }
  | { id: "tribute"; tribute: TributeCard }
  | { id: "share" };

export function buildCards(
  season: SeasonWrappedSeason,
  story: SeasonWrappedMember,
): WrappedCardSpec[] {
  const cards: WrappedCardSpec[] = [{ id: "intro" }];

  // The member's season
  if (story.events) cards.push({ id: "events" });
  if (story.signup) cards.push({ id: "signup" });
  if (story.crew?.topPartner || (story.crew?.distinctTeammates ?? 0) > 1) {
    cards.push({ id: "crew" });
  }
  if (story.money) cards.push({ id: "money" });
  if (story.closestToPin) cards.push({ id: "closest-to-pin" });
  if (story.bracket) cards.push({ id: "bracket" });

  // The club's season (everyone)
  cards.push({ id: "club" });
  if (season.club.podium.length > 0) cards.push({ id: "podium" });
  for (const major of season.club.majors) {
    cards.push({ id: `major:${major.key}`, major });
  }
  if (season.club.tribute) {
    cards.push({ id: "tribute", tribute: season.club.tribute });
  }

  cards.push({ id: "share" });
  return cards;
}
