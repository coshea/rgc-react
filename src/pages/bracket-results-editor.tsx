/**
 * BracketResultsEditorPage — admin-only standalone page for entering
 * bracket match results without opening the full tournament editor.
 *
 * Route: /tournaments/:firestoreId/bracket-results
 * Wrapped in RequireAdmin in App.tsx.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button, Card, SearchField, Separator, Spinner } from "@heroui/react";
import { Icon } from "@iconify/react";

import { onTournament, mapTournamentDoc } from "@/api/tournaments";
import { onBracket, saveMatchResults } from "@/api/brackets";
import { BracketView } from "@/components/bracket/BracketView";
import { addToast } from "@/providers/toast";
import { useUsersMap } from "@/hooks/useUsers";
import BackButton from "@/components/back-button";
import { usePageTracking } from "@/hooks/usePageTracking";
import type { Tournament } from "@/types/tournament";
import type { TournamentBracket, BracketTeam } from "@/types/bracket";

// ── Helpers ───────────────────────────────────────────────────────────────────

function bracketTeamDisplayName(team: BracketTeam | undefined): string {
  if (!team) return "Unknown";
  if (team.memberNames && team.memberNames.length > 0) {
    return team.memberNames.join(", ");
  }
  return team.name;
}

function bracketTeamSearchText(team: BracketTeam | undefined): string {
  if (!team) return "";
  return [team.name, ...(team.memberNames ?? []), ...team.memberIds]
    .join(" ")
    .toLowerCase();
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BracketResultsEditorPage() {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tournamentLoading, setTournamentLoading] = useState(true);

  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(true);

  const [pendingWinners, setPendingWinners] = useState<Record<string, string>>(
    {},
  );
  const [resultsSearch, setResultsSearch] = useState("");
  const [saving, setSaving] = useState(false);

  usePageTracking(
    tournament ? `Bracket Results — ${tournament.title}` : undefined,
    tournamentLoading,
  );

  const { usersMap } = useUsersMap();

  const userPhotoMap = useMemo(() => {
    const m = new Map<string, string>();
    usersMap.forEach((u, id) => {
      const photo = u.profileURL || u.photoURL;
      if (photo) m.set(id, photo);
    });
    return m;
  }, [usersMap]);

  // Subscribe to tournament
  useEffect(() => {
    if (!firestoreId) return;
    setTournamentLoading(true);
    const unsub = onTournament(
      firestoreId,
      (snap) => {
        if (snap.exists()) {
          setTournament(mapTournamentDoc(snap));
        } else {
          setTournament(null);
        }
        setTournamentLoading(false);
      },
      () => setTournamentLoading(false),
    );
    return unsub;
  }, [firestoreId]);

  // Subscribe to bracket
  useEffect(() => {
    if (!firestoreId) return;
    setBracketLoading(true);
    const unsub = onBracket(
      firestoreId,
      (b) => {
        setBracket(b);
        setBracketLoading(false);
      },
      () => setBracketLoading(false),
    );
    return unsub;
  }, [firestoreId]);

  // Reset pending winners when saved bracket changes
  useEffect(() => {
    setPendingWinners({});
  }, [bracket]);

  const handleSaveResults = useCallback(async () => {
    if (!bracket || !firestoreId) return;

    const effectiveUpdates: Record<string, string> = {};
    const matchMap = new Map(bracket.matches.map((m) => [m.id, m]));
    for (const [matchId, winnerId] of Object.entries(pendingWinners)) {
      const current = matchMap.get(matchId);
      if (!current) continue;
      if (winnerId !== (current.winnerId ?? "")) {
        effectiveUpdates[matchId] = winnerId;
      }
    }
    if (Object.keys(effectiveUpdates).length === 0) return;

    setSaving(true);
    try {
      await saveMatchResults(firestoreId, bracket, effectiveUpdates);
      addToast({ title: "Results saved!", color: "success" });
    } catch (err: unknown) {
      console.error("Failed to save bracket results:", err);
      const code =
        typeof err === "object" && err !== null && "code" in err
          ? String((err as { code?: unknown }).code)
          : undefined;

      if (code === "permission-denied") {
        addToast({
          title: "Access Denied",
          description: "You do not have permission to perform this action.",
          color: "danger",
        });
      } else {
        addToast({
          title: "Error",
          description: "Failed to save results. Please try again.",
          color: "danger",
        });
      }
    }
      setSaving(false);
    }
  }, [firestoreId, bracket, pendingWinners]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const finalMatch = bracket?.matches.find((m) => m.nextMatchId === null);
  const champion = finalMatch?.winnerId
    ? bracket?.teams.find((t) => t.id === finalMatch.winnerId)
    : undefined;
  const runnerUp = finalMatch?.winnerId
    ? bracket?.teams.find(
        (t) =>
          t.id !== finalMatch.winnerId &&
          (t.id === finalMatch.team1Id || t.id === finalMatch.team2Id),
      )
    : undefined;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (tournamentLoading || bracketLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <BackButton />
        <p className="text-muted mt-4">Tournament not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="tertiary"
            onPress={() =>
              navigate(`/tournaments/${firestoreId}`, { replace: false })
            }
            aria-label="Back to tournament"
          >
            <Icon icon="lucide:arrow-left" className="w-4 h-4" />
            Back
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div>
            <h1 className="text-xl font-bold leading-tight">Bracket Results</h1>
            <p className="text-sm text-muted">{tournament.title}</p>
          </div>
        </div>
        {bracket && (
          <Button
            onPress={handleSaveResults}
            isDisabled={Object.keys(pendingWinners).length === 0 || saving}
          >
            {!saving && <Icon icon="lucide:save" className="w-4 h-4" />}
            Save Results
          </Button>
        )}
      </div>

      {!bracket ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted">
          <Icon icon="lucide:git-branch" className="w-10 h-10 opacity-30" />
          <p className="text-sm">
            No bracket has been generated for this tournament yet.
          </p>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => navigate(`/tournaments/${firestoreId}`)}
          >
            Go to Tournament
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Champion / runner-up banners */}
          {(champion || runnerUp) && (
            <div className="space-y-2">
              {champion && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-warning dark:bg-warning/20 border border-warning-200">
                  <Icon
                    icon="lucide:trophy"
                    className="w-5 h-5 text-warning mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold text-sm">
                      Champion: {champion.name}
                    </span>
                    {champion.memberNames &&
                      champion.memberNames.length > 1 && (
                        <p className="text-xs text-muted mt-0.5">
                          {champion.memberNames.join(" · ")}
                        </p>
                      )}
                  </div>
                </div>
              )}
              {runnerUp && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-default/60 dark:bg-default/60/30 border">
                  <Icon
                    icon="lucide:medal"
                    className="w-5 h-5 text-muted mt-0.5 shrink-0"
                  />
                  <div>
                    <span className="font-semibold text-sm">
                      Runner-up: {runnerUp.name}
                    </span>
                    {runnerUp.memberNames &&
                      runnerUp.memberNames.length > 1 && (
                        <p className="text-xs text-muted mt-0.5">
                          {runnerUp.memberNames.join(" · ")}
                        </p>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Bracket visualisation */}
          <Card>
            <Card.Header>
              <p className="font-semibold">Bracket</p>
              <p className="text-xs text-muted ml-2">
                {bracket.size} slots · {bracket.teams.length} teams
                {bracket.teams.length < bracket.size &&
                  ` · ${bracket.size - bracket.teams.length} bye${bracket.size - bracket.teams.length !== 1 ? "s" : ""}`}
              </p>
            </Card.Header>
            <Card.Content>
              <BracketView bracket={bracket} userPhotoMap={userPhotoMap} />
            </Card.Content>
          </Card>

          {/* Match results */}
          <Card>
            <Card.Header className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="font-semibold text-sm">Match Results</p>
                <SearchField
                  name="bracket-results-search"
                  aria-label="Search bracket matches by player"
                  className="w-full sm:w-72"
                >
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input
                      placeholder="Search by player..."
                      value={resultsSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setResultsSearch(e.target.value)
                      }
                      aria-label="Search bracket matches by player"
                    />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              <Button
                size="sm"
                onPress={handleSaveResults}
                isDisabled={Object.keys(pendingWinners).length === 0 || saving}
              >
                {!saving && <Icon icon="lucide:save" className="w-4 h-4" />}
                Save Results
              </Button>
            </Card.Header>
            <Card.Content className="space-y-5 pb-4">
              {(() => {
                const teamMap = new Map(bracket.teams.map((t) => [t.id, t]));
                const numRounds = Math.log2(bracket.size);
                const rounds = Array.from(
                  new Set(bracket.matches.map((m) => m.round)),
                ).sort((a, b) => a - b);

                return rounds.map((round) => {
                  const searchTerm = resultsSearch.trim().toLowerCase();

                  const roundMatches = bracket.matches
                    .filter((m) => m.round === round)
                    .filter((m) => {
                      if (!searchTerm) return true;
                      const team1 = m.team1Id
                        ? teamMap.get(m.team1Id)
                        : undefined;
                      const team2 = m.team2Id
                        ? teamMap.get(m.team2Id)
                        : undefined;
                      return (
                        bracketTeamSearchText(team1).includes(searchTerm) ||
                        bracketTeamSearchText(team2).includes(searchTerm)
                      );
                    })
                    .sort((a, b) => a.position - b.position);

                  if (roundMatches.length === 0) return null;

                  const label =
                    round === numRounds
                      ? "Final"
                      : round === numRounds - 1
                        ? "Semi-final"
                        : `Round ${round}`;

                  return (
                    <div key={round}>
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                        {label}
                      </p>
                      <div className="space-y-2">
                        {roundMatches.map((m) => {
                          const team1 = m.team1Id
                            ? teamMap.get(m.team1Id)
                            : undefined;
                          const team2 = m.team2Id
                            ? teamMap.get(m.team2Id)
                            : undefined;

                          // BYE match: one real team vs empty slot
                          const isByeMatch =
                            (!!m.team1Id && !m.team2Id) ||
                            (!m.team1Id && !!m.team2Id);

                          if (isByeMatch) {
                            const byeTeam = team1 ?? team2;
                            const byeTeamId = m.team1Id ?? m.team2Id;
                            const selectedWinner =
                              pendingWinners[m.id] ?? m.winnerId;
                            return (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 flex-wrap"
                              >
                                <Button
                                  size="sm"
                                  variant={
                                    selectedWinner === byeTeamId
                                      ? "primary"
                                      : "tertiary"
                                  }
                                  onPress={() =>
                                    setPendingWinners((prev) => ({
                                      ...prev,
                                      [m.id]: byeTeamId!,
                                    }))
                                  }
                                  className="flex-1 min-w-0"
                                >
                                  {selectedWinner === byeTeamId && (
                                    <Icon
                                      icon="lucide:trophy"
                                      className="w-3.5 h-3.5"
                                    />
                                  )}
                                  <span className="truncate">
                                    {bracketTeamDisplayName(byeTeam)}
                                  </span>
                                </Button>
                                <span className="text-xs text-muted shrink-0">
                                  vs bye
                                </span>
                                {selectedWinner && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    isIconOnly
                                    aria-label="Clear winner"
                                    onPress={() =>
                                      setPendingWinners((prev) => ({
                                        ...prev,
                                        [m.id]: "",
                                      }))
                                    }
                                  >
                                    <Icon
                                      icon="lucide:x"
                                      className="w-3.5 h-3.5"
                                    />
                                  </Button>
                                )}
                              </div>
                            );
                          }

                          // Future round: teams not yet determined
                          if (!m.team1Id || !m.team2Id) {
                            return (
                              <div
                                key={m.id}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed text-muted"
                              >
                                <Icon
                                  icon="lucide:clock"
                                  className="w-4 h-4 shrink-0"
                                />
                                <span className="text-xs">
                                  Waiting for previous round
                                </span>
                              </div>
                            );
                          }

                          if (!team1 || !team2) return null;

                          const selectedWinner =
                            pendingWinners[m.id] ?? m.winnerId;

                          return (
                            <div
                              key={m.id}
                              className="flex items-center gap-2 flex-wrap"
                            >
                              <Button
                                size="sm"
                                variant={
                                  selectedWinner === m.team1Id
                                    ? "primary"
                                    : "tertiary"
                                }
                                onPress={() =>
                                  setPendingWinners((prev) => ({
                                    ...prev,
                                    [m.id]: m.team1Id!,
                                  }))
                                }
                                className="flex-1 min-w-0"
                              >
                                {selectedWinner === m.team1Id && (
                                  <Icon
                                    icon="lucide:trophy"
                                    className="w-3.5 h-3.5"
                                  />
                                )}
                                <span className="truncate">
                                  {bracketTeamDisplayName(team1)}
                                </span>
                              </Button>

                              <span className="text-xs text-muted shrink-0">
                                vs
                              </span>

                              <Button
                                size="sm"
                                variant={
                                  selectedWinner === m.team2Id
                                    ? "primary"
                                    : "tertiary"
                                }
                                onPress={() =>
                                  setPendingWinners((prev) => ({
                                    ...prev,
                                    [m.id]: m.team2Id!,
                                  }))
                                }
                                className="flex-1 min-w-0"
                              >
                                {selectedWinner === m.team2Id && (
                                  <Icon
                                    icon="lucide:trophy"
                                    className="w-3.5 h-3.5"
                                  />
                                )}
                                <span className="truncate">
                                  {bracketTeamDisplayName(team2)}
                                </span>
                              </Button>

                              {selectedWinner && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isIconOnly
                                  aria-label="Clear winner"
                                  onPress={() =>
                                    setPendingWinners((prev) => {
                                      const next = { ...prev };
                                      next[m.id] = "";
                                      return next;
                                    })
                                  }
                                >
                                  <Icon
                                    icon="lucide:x"
                                    className="w-3.5 h-3.5"
                                  />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}

              {resultsSearch.trim() &&
                (() => {
                  const searchTerm = resultsSearch.trim().toLowerCase();
                  const teamMap = new Map(bracket.teams.map((t) => [t.id, t]));
                  const hasAnyMatch = bracket.matches.some((m) => {
                    const team1 = m.team1Id
                      ? teamMap.get(m.team1Id)
                      : undefined;
                    const team2 = m.team2Id
                      ? teamMap.get(m.team2Id)
                      : undefined;
                    return (
                      bracketTeamSearchText(team1).includes(searchTerm) ||
                      bracketTeamSearchText(team2).includes(searchTerm)
                    );
                  });

                  return hasAnyMatch ? null : (
                    <div className="text-xs text-muted">
                      No matches found for that player.
                    </div>
                  );
                })()}
            </Card.Content>
          </Card>
        </div>
      )}
    </div>
  );
}
