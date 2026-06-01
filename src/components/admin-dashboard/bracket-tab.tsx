/**
 * BracketTab – admin dashboard tab for generating and managing tournament brackets.
 *
 * Flow:
 * 1. Select a tournament from the dropdown.
 * 2. If no bracket exists → show registered teams, optionally mark seed #1, generate.
 * 3. If bracket exists → show the interactive bracket; admins can advance teams.
 * 4. Regenerate (with confirmation) always available when a bracket exists.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Modal,
  Label,
  ListBox,
  Select,
  Spinner,
  SearchField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { BracketView } from "@/components/bracket/BracketView";
import {
  mapTournamentDoc,
  onAllTournaments,
  fetchAllRegistrations,
} from "@/api/tournaments";
import {
  onBracket,
  saveBracket,
  saveMatchResults,
  deleteBracket,
} from "@/api/brackets";
import { generateBracket, shuffleTeams } from "@/utils/bracketGenerator";
import { addToast } from "@/providers/toast";
import type { Tournament } from "@/types/tournament";
import type { TournamentBracket, BracketTeam } from "@/types/bracket";

// ── Registration shape (minimal, matches what tournaments API returns) ─────────

interface RegistrationDoc {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function registrationToTeam(reg: RegistrationDoc, seed?: number): BracketTeam {
  const members = reg.team ?? [];

  const memberNames = members
    .map((m) => m.displayName?.trim())
    .filter((n): n is string => Boolean(n));

  const name =
    memberNames.length > 0
      ? memberNames.join(", ")
      : `Team ${reg.id.slice(-4).toUpperCase()}`;

  return {
    id: reg.id,
    name,
    memberIds: members.map((m) => m.id),
    memberNames: memberNames.length > 0 ? memberNames : undefined,
    seed,
  };
}

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

// ── SortableTeamRow ────────────────────────────────────────────────────────────

interface SortableTeamRowProps {
  id: string;
  label: string;
  seed: number;
}

function SortableTeamRow({ id, label, seed }: SortableTeamRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg px-3 py-2 border bg-surface select-none"
    >
      {/* Drag handle */}
      <button
        className="touch-none cursor-grab active:cursor-grabbing text-muted hover:text-foreground shrink-0 p-0.5"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <Icon icon="lucide:grip-vertical" className="w-4 h-4" />
      </button>

      <Chip
        size="sm"
        variant="tertiary"
        color={seed === 1 ? "warning" : "default"}
        className="shrink-0 min-w-10 justify-center"
      >
        #{seed}
      </Chip>

      <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
    </div>
  );
}

// ── Hook: all tournaments ─────────────────────────────────────────────────────

function useAllTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAllTournaments(
      (snap: { docs: unknown[] }) => {
        const all = (snap.docs as Parameters<typeof mapTournamentDoc>[0][]).map(
          mapTournamentDoc,
        );
        setTournaments(all.sort((a, b) => b.date.getTime() - a.date.getTime()));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  return { tournaments, loading };
}

// ── Main component ────────────────────────────────────────────────────────────

export function BracketTab() {
  const { tournaments, loading: tournamentsLoading } = useAllTournaments();

  const [selectedId, setSelectedId] = useState<string>("");

  // Registrations for the selected tournament
  const [registrations, setRegistrations] = useState<RegistrationDoc[]>([]);
  const [regsLoading, setRegsLoading] = useState(false);

  // Seeding order — array of registration IDs in seed order (index 0 = seed #1)
  const [seedOrder, setSeedOrder] = useState<string[]>([]);

  // Current bracket (real-time)
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(false);

  // Modals
  const [_generating, setGenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pending match winner selections (matchId → winnerId) – not yet saved
  const [pendingWinners, setPendingWinners] = useState<Record<string, string>>(
    {},
  );
  const [resultsSearch, setResultsSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // When the bracket changes (real-time or after save), reset pending selections
  // so the form reflects the saved state.
  useEffect(() => {
    setPendingWinners({});
  }, [bracket]);

  // Load registrations + bracket when tournament changes
  useEffect(() => {
    if (!selectedId) {
      setRegistrations([]);
      setBracket(null);
      setSeedOrder([]);
      return;
    }

    setRegsLoading(true);
    setBracketLoading(true);

    // Registrations (one-off fetch, enough for generation)
    fetchAllRegistrations(selectedId)
      .then((docs) => {
        const list = docs as RegistrationDoc[];
        setRegistrations(list);
        // Initialise seed order as natural registration order (randomised by default)
        setSeedOrder(
          shuffleTeams(list.map((r) => registrationToTeam(r))).map((t) => t.id),
        );
      })
      .catch(() =>
        addToast({
          title: "Error",
          description: "Failed to load registrations",
          color: "danger",
        }),
      )
      .finally(() => setRegsLoading(false));

    // Bracket (real-time)
    const unsub = onBracket(
      selectedId,
      (b) => {
        setBracket(b);
        setBracketLoading(false);
      },
      () => setBracketLoading(false),
    );
    return unsub;
  }, [selectedId]);

  // ── Generate bracket ────────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!selectedId || registrations.length < 2) return;
    setGenerating(true);
    try {
      // Build teams in seed order
      const regMap = new Map(registrations.map((r) => [r.id, r]));
      const orderedTeams = seedOrder
        .map((id) => regMap.get(id))
        .filter((r): r is RegistrationDoc => r !== undefined)
        .map((r) => registrationToTeam(r));
      const newBracket = generateBracket(selectedId, orderedTeams);
      await saveBracket(newBracket);
      addToast({ title: "Bracket generated!", color: "success" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate bracket";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setGenerating(false);
      setShowRegenConfirm(false);
    }
  }, [selectedId, registrations, seedOrder]);

  // ── Advance team ────────────────────────────────────────────────────────────

  const handleSaveResults = useCallback(async () => {
    if (!selectedId || !bracket) return;
    const effectiveUpdates: Record<string, string> = {};
    const matchMap = new Map(bracket.matches.map((m) => [m.id, m]));
    for (const [matchId, winnerId] of Object.entries(pendingWinners)) {
      const current = matchMap.get(matchId);
      if (!current) continue;
      const savedWinner = current.winnerId ?? "";
      if (winnerId !== savedWinner) {
        effectiveUpdates[matchId] = winnerId;
      }
    }
    if (Object.keys(effectiveUpdates).length === 0) return;
    setSaving(true);
    try {
      await saveMatchResults(selectedId, bracket, effectiveUpdates);
      addToast({ title: "Results saved!", color: "success" });
      // pendingWinners will be reset via the useEffect that watches `bracket`
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save results";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setSaving(false);
    }
  }, [selectedId, bracket, pendingWinners]);

  // ── Delete / regenerate ─────────────────────────────────────────────────────

  const handleDeleteAndRegen = async () => {
    if (!selectedId) return;
    setSeedOrder([]);
    await deleteBracket(selectedId);
    // bracket will go null via real-time listener, then regen
    await handleGenerate();
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await deleteBracket(selectedId);
      setSeedOrder([]);
      setShowDeleteConfirm(false);
      addToast({ title: "Bracket deleted", color: "success" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to delete bracket";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  // ── DnD sensors ─────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSeedOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  }, []);

  // Map regId → display label for the DnD list
  const regLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const reg of registrations) {
      map.set(reg.id, registrationToTeam(reg).name);
    }
    return map;
  }, [registrations]);

  // ── Derived state ───────────────────────────────────────────────────────────

  const isLoading = tournamentsLoading || regsLoading || bracketLoading;
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Tournament selector */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex-1 max-w-xs">
          {tournamentsLoading ? (
            <Spinner size="sm" />
          ) : (
            <Select
              placeholder="Select a tournament"
              value={selectedId || null}
              onChange={(key) => {
                setSelectedId(typeof key === "string" ? key : "");
              }}
              aria-label="Select tournament"
            >
              <Label>Tournament</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {tournaments.map((t) => (
                    <ListBox.Item
                      key={t.firestoreId!}
                      id={t.firestoreId!}
                      textValue={t.title}
                    >
                      <span className="text-sm">{t.title}</span>
                      <span className="text-xs text-muted ml-2">
                        {t.date.getFullYear()}
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        </div>

        {bracket && selectedId && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => setShowRegenConfirm(true)}
            >
              <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              onPress={() => setShowDeleteConfirm(true)}
            >
              <Icon icon="lucide:trash-2" className="w-4 h-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {!selectedId && (
        <div className="flex flex-col items-center gap-2 py-12 text-muted">
          <Icon icon="lucide:git-branch" className="w-10 h-10 opacity-40" />
          <p className="text-sm">Select a tournament to manage its bracket.</p>
        </div>
      )}

      {selectedId &&
        (isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : bracket ? (
          /* ── Bracket exists: show viewer + match results form ── */
          <div className="space-y-4">
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

            <Card>
              <Card.Header>
                <p className="font-semibold">Bracket</p>
                <p className="text-xs text-muted ml-2">
                  {bracket.size} slots · {bracket.teams.length} teams ·{" "}
                  {bracket.teams.length < bracket.size &&
                    `${bracket.size - bracket.teams.length} bye${bracket.size - bracket.teams.length !== 1 ? "s" : ""}`}
                </p>
              </Card.Header>
              <Card.Content className="overflow-x-auto">
                <BracketView bracket={bracket} />
              </Card.Content>
            </Card>

            {/* Match results form */}
            <Card>
              <Card.Header className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-semibold text-sm">Match Results</p>
                  <SearchField
                    name="admin-bracket-results-search"
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
                  isDisabled={Object.keys(pendingWinners).length === 0}
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
                  const searchTerm = resultsSearch.trim().toLowerCase();

                  return rounds.map((round) => {
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

                            // Bye match: one team, one null slot
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

                            // Future-round match: both slots are empty
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
                                        // Mark as explicitly cleared (empty string = unset)
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
                    const hasAnyMatch = bracket.matches.some((m) => {
                      const teamMap = new Map(
                        bracket.teams.map((t) => [t.id, t]),
                      );
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

            {/* Summary of teams */}
            <Card>
              <Card.Header>
                <p className="font-semibold text-sm">
                  Teams ({bracket.teams.length})
                </p>
              </Card.Header>
              <Card.Content className="flex flex-wrap gap-2 pb-4">
                {bracket.teams.map((t) => (
                  <Chip
                    key={t.id}
                    size="sm"
                    variant="tertiary"
                    color={t.seed === 1 ? "warning" : "default"}
                  >
                    {t.seed === 1 && (
                      <Icon
                        icon="lucide:star"
                        className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                      />
                    )}
                    {t.name}
                  </Chip>
                ))}
              </Card.Content>
            </Card>
          </div>
        ) : (
          /* ── No bracket: show generator ── */
          <div className="space-y-4">
            <Card>
              <Card.Header>
                <p className="font-semibold">Generate Bracket</p>
              </Card.Header>
              <Card.Content className="space-y-4">
                {registrations.length < 2 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted">
                    <Icon icon="lucide:users" className="w-8 h-8 opacity-40" />
                    <p className="text-sm">
                      {registrations.length === 0
                        ? "No teams registered yet."
                        : "At least 2 registered teams are needed."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted">
                      {registrations.length} team
                      {registrations.length !== 1 ? "s" : ""} registered. Drag
                      to reorder teams — the top position is seed #1 and
                      receives the first bye.
                    </p>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() =>
                          setSeedOrder((prev) =>
                            shuffleTeams(
                              prev.map((id) => ({ id }) as BracketTeam),
                            ).map((t) => t.id),
                          )
                        }
                      >
                        <Icon icon="lucide:shuffle" className="w-4 h-4" />
                        Randomize Order
                      </Button>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={seedOrder}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1.5">
                          {seedOrder.map((id, index) => (
                            <SortableTeamRow
                              key={id}
                              id={id}
                              label={regLabelMap.get(id) ?? id}
                              seed={index + 1}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>

                    <Button
                      onPress={handleGenerate}
                      isDisabled={registrations.length < 2}
                      className="mt-2"
                    >
                      <Icon icon="lucide:git-branch" className="w-4 h-4" />
                      Generate Bracket
                    </Button>
                  </>
                )}
              </Card.Content>
            </Card>
          </div>
        ))}

      {/* Delete confirmation modal */}
      <Modal.Backdrop
        isOpen={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(false);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>Delete Bracket?</Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground">
                This will permanently delete the bracket and all match results.
                This action cannot be undone.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => setShowDeleteConfirm(false)}
                isDisabled={deleting}
              >
                Cancel
              </Button>
              <Button variant="danger" onPress={handleDelete}>
                Delete Bracket
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Regenerate confirmation modal */}
      <Modal.Backdrop
        isOpen={showRegenConfirm}
        onOpenChange={(open) => {
          if (!open) setShowRegenConfirm(false);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>Regenerate Bracket?</Modal.Header>
            <Modal.Body>
              <p className="text-sm text-foreground">
                This will replace the existing bracket with a freshly randomised
                draw. All current match results will be lost.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                variant="tertiary"
                onPress={() => setShowRegenConfirm(false)}
              >
                Cancel
              </Button>
              <Button variant="danger" onPress={handleDeleteAndRegen}>
                Regenerate
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>{" "}
      </Modal.Backdrop>
    </div>
  );
}
