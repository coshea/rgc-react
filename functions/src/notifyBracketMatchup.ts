import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "./logger";
import { RESEND_API_KEY } from "./resendConfig";
import { sendBracketMatchupEmail } from "./sendBracketMatchupEmails";

interface BracketTeam {
  id: string;
  name?: string;
  memberIds?: string[];
  memberNames?: string[];
}

interface BracketMatch {
  id: string;
  round?: number;
  team1Id?: string | null;
  team2Id?: string | null;
}

interface BracketData {
  size?: number;
  teams?: BracketTeam[];
  matches?: BracketMatch[];
}

interface TournamentData {
  title?: string;
  bracketPublished?: boolean;
}

interface UserData {
  email?: string;
  firstName?: string;
  displayName?: string;
  notificationPreferences?: {
    emailTournamentUpdates?: boolean;
  };
}

interface NewMatchup {
  matchId: string;
  round: number;
  team1Id: string;
  team2Id: string;
}

function normalizePairKey(team1Id: string, team2Id: string): string {
  return [team1Id, team2Id].sort((a, b) => a.localeCompare(b)).join("||");
}

/**
 * Returns matches that newly became real head-to-head pairings (no BYE).
 */
export function collectNewHeadToHeadMatches(
  before: BracketData | undefined,
  after: BracketData | undefined,
): NewMatchup[] {
  const afterMatches = Array.isArray(after?.matches) ? after.matches : [];
  if (afterMatches.length === 0) return [];

  const beforeMap = new Map<string, string>();
  const beforeMatches = Array.isArray(before?.matches) ? before.matches : [];
  for (const m of beforeMatches) {
    if (!m.id || !m.team1Id || !m.team2Id) continue;
    beforeMap.set(m.id, normalizePairKey(m.team1Id, m.team2Id));
  }

  const result: NewMatchup[] = [];
  for (const m of afterMatches) {
    if (!m.id || !m.team1Id || !m.team2Id) continue;

    const nextPairKey = normalizePairKey(m.team1Id, m.team2Id);
    const previousPairKey = beforeMap.get(m.id);

    if (previousPairKey === nextPairKey) continue;

    result.push({
      matchId: m.id,
      round: m.round ?? 1,
      team1Id: m.team1Id,
      team2Id: m.team2Id,
    });
  }

  return result;
}

function firstWord(str: string | undefined): string {
  if (!str) return "";
  return str.trim().split(/\s+/)[0] || "";
}

function maskEmail(email: string | undefined): string {
  if (!email) return "MISSING";
  const at = email.indexOf("@");
  if (at < 1) return "[redacted]";
  return `${email[0]}***@***`;
}

function isEmailEligible(data: UserData | undefined): boolean {
  return data?.notificationPreferences?.emailTournamentUpdates !== false;
}

function buildRoundLabel(round: number, totalRounds: number): string {
  if (round >= totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semi Finals";
  if (round === totalRounds - 2) return "Quarter Finals";
  return `Round ${round}`;
}

function uniqueMemberIds(team: BracketTeam | undefined): string[] {
  if (!team?.memberIds || team.memberIds.length === 0) return [];
  return Array.from(new Set(team.memberIds.filter(Boolean)));
}

function buildTeamLabel(
  team: BracketTeam | undefined,
  fallback: string,
  userMap: Map<string, UserData>,
): string {
  if (!team) return fallback;

  const fromBracket = (team.memberNames ?? [])
    .map((name) => name?.toString().trim())
    .filter((name): name is string => Boolean(name));
  if (fromBracket.length > 0) return fromBracket.join(", ");

  const fromUsers = uniqueMemberIds(team)
    .map((uid) => {
      const user = userMap.get(uid);
      return (user?.displayName ?? user?.email ?? uid).toString().trim();
    })
    .filter((name): name is string => Boolean(name));
  if (fromUsers.length > 0) return fromUsers.join(", ");

  return team.name ?? fallback;
}

export const notify_bracket_matchup = onDocumentWritten(
  {
    document: "brackets/{tournamentId}",
    secrets: [RESEND_API_KEY],
  },
  async (event) => {
    const afterExists = event.data?.after.exists;
    if (!afterExists) return;

    const beforeData = event.data?.before.data() as BracketData | undefined;
    const afterData = event.data?.after.data() as BracketData | undefined;

    const newMatchups = collectNewHeadToHeadMatches(beforeData, afterData);
    if (newMatchups.length === 0) return;

    const apiKey = RESEND_API_KEY.value();
    if (!apiKey) {
      logger.error(
        "[notify_bracket_matchup] RESEND_API_KEY not configured - skipping emails",
      );
      return;
    }

    const { tournamentId } = event.params;
    const db = admin.firestore();

    const tournamentSnap = await db.doc(`tournaments/${tournamentId}`).get();
    const tournament = tournamentSnap.exists
      ? (tournamentSnap.data() as TournamentData)
      : undefined;

    if (tournament?.bracketPublished !== true) {
      logger.info(
        `[notify_bracket_matchup] Skipping sends because bracket is not published for tournament=${tournamentId}`,
      );
      return;
    }

    const tournamentTitle = tournament?.title ?? "Tournament";
    const tournamentUrl = `https://ridgefieldgolfclub.org/tournaments/${tournamentId}`;

    const teams = Array.isArray(afterData?.teams) ? afterData.teams : [];
    const teamMap = new Map(teams.map((team) => [team.id, team]));
    const totalRounds =
      teams.length > 1
        ? Math.max(1, Math.ceil(Math.log2(afterData?.size ?? teams.length)))
        : 1;

    const involvedUidSet = new Set<string>();
    for (const matchup of newMatchups) {
      const team1 = teamMap.get(matchup.team1Id);
      const team2 = teamMap.get(matchup.team2Id);
      uniqueMemberIds(team1).forEach((uid) => involvedUidSet.add(uid));
      uniqueMemberIds(team2).forEach((uid) => involvedUidSet.add(uid));
    }

    if (involvedUidSet.size === 0) {
      logger.warn(
        `[notify_bracket_matchup] No members found on paired teams for tournament=${tournamentId}`,
      );
      return;
    }

    const uids = Array.from(involvedUidSet);
    const userRefs = uids.map((uid) => db.doc(`users/${uid}`));
    const userSnaps = await db.getAll(...userRefs);
    const userMap = new Map<string, UserData>();

    for (const snap of userSnaps) {
      if (snap.exists) userMap.set(snap.id, snap.data() as UserData);
    }

    const sendTasks: Array<Promise<void>> = [];

    for (const matchup of newMatchups) {
      const team1 = teamMap.get(matchup.team1Id);
      const team2 = teamMap.get(matchup.team2Id);
      if (!team1 || !team2) continue;

      const team1MemberSet = new Set(uniqueMemberIds(team1));
      const team2MemberSet = new Set(uniqueMemberIds(team2));
      const recipients = new Set<string>([
        ...Array.from(team1MemberSet),
        ...Array.from(team2MemberSet),
      ]);

      const team1Name = buildTeamLabel(team1, "Team 1", userMap);
      const team2Name = buildTeamLabel(team2, "Team 2", userMap);
      const matchupLabel = `${team1Name} vs ${team2Name}`;
      const roundLabel = buildRoundLabel(matchup.round, totalRounds);

      for (const uid of recipients) {
        const user = userMap.get(uid);
        const email = user?.email?.trim();
        if (!email || !isEmailEligible(user)) continue;

        const onTeam1 = team1MemberSet.has(uid);
        const yourTeamName = onTeam1 ? team1Name : team2Name;
        const opponentTeamName = onTeam1 ? team2Name : team1Name;
        const firstName =
          user?.firstName ||
          firstWord(user?.displayName) ||
          firstWord(yourTeamName) ||
          "there";

        sendTasks.push(
          sendBracketMatchupEmail(apiKey, email, {
            firstName,
            tournamentTitle,
            roundLabel,
            yourTeamName,
            opponentTeamName,
            matchupLabel,
            tournamentUrl,
          }).then(() => {
            logger.info(
              `[notify_bracket_matchup] Sent matchup email for match=${matchup.matchId}, user=${uid}, email=${maskEmail(email)}`,
            );
          }),
        );
      }
    }

    if (sendTasks.length === 0) {
      logger.info(
        `[notify_bracket_matchup] No eligible email recipients for tournament=${tournamentId}`,
      );
      return;
    }

    const results = await Promise.allSettled(sendTasks);
    const failed = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );

    if (failed.length > 0) {
      logger.error(
        `[notify_bracket_matchup] Failed sends: ${failed.length} of ${results.length}`,
      );
      for (const failure of failed) {
        logger.error("[notify_bracket_matchup] Send error", failure.reason);
      }
    }

    logger.info(
      `[notify_bracket_matchup] Completed sends for tournament=${tournamentId}: sent=${results.length - failed.length}, failed=${failed.length}`,
    );
  },
);
