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
  const captain = members[0];
  const rest = members.slice(1);

  const name = captain?.displayName
    ? rest.length > 0
      ? `${captain.displayName} +${rest.length}`
      : captain.displayName
    : `Team ${reg.id.slice(-4).toUpperCase()}`;

  const memberNames = members
    .map((m) => m.displayName)
    .filter((n): n is string => Boolean(n));

  return {
    id: reg.id,
    name,
    memberIds: members.map((m) => m.id),
    memberNames: memberNames.length > 0 ? memberNames : undefined,
    seed,
  };
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
      className="flex items-center gap-3 rounded-lg px-3 py-2 border border-default-200 bg-content1 select-none"
    >
      {/* Drag handle */}
      <button
        className="touch-none cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 shrink-0 p-0.5"
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
              value={selectedId || undefined}
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
                      <span className="text-xs text-default-400 ml-2">
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
              startContent={
                <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
              }
              onPress={() => setShowRegenConfirm(true)}
            >
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="tertiary"
              startContent={<Icon icon="lucide:trash-2" className="w-4 h-4" />}
              onPress={() => setShowDeleteConfirm(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {!selectedId && (
        <div className="flex flex-col items-center gap-2 py-12 text-default-400">
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
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 dark:bg-warning-950/20 border border-warning-200">
                    <Icon
                      icon="lucide:trophy"
                      className="w-5 h-5 text-warning-500 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-sm">
                        Champion: {champion.name}
                      </span>
                      {champion.memberNames &&
                        champion.memberNames.length > 1 && (
                          <p className="text-xs text-default-500 mt-0.5">
                            {champion.memberNames.join(" · ")}
                          </p>
                        )}
                    </div>
                  </div>
                )}
                {runnerUp && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-default-50 dark:bg-default-900/30 border border-default-200">
                    <Icon
                      icon="lucide:medal"
                      className="w-5 h-5 text-default-500 mt-0.5 shrink-0"
                    />
                    <div>
                      <span className="font-semibold text-sm">
                        Runner-up: {runnerUp.name}
                      </span>
                      {runnerUp.memberNames &&
                        runnerUp.memberNames.length > 1 && (
                          <p className="text-xs text-default-500 mt-0.5">
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
                <p className="text-xs text-default-400 ml-2">
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
              <Card.Header className="flex items-center justify-between">
                <p className="font-semibold text-sm">Match Results</p>
                <Button
                  size="sm"
                  onPress={handleSaveResults}
                  isDisabled={Object.keys(pendingWinners).length === 0}
                  startContent={
                    !saving ? (
                      <Icon icon="lucide:save" className="w-4 h-4" />
                    ) : undefined
                  }
                >
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
                    const roundMatches = bracket.matches
                      .filter((m) => m.round === round)
                      .sort((a, b) => a.position - b.position);

                    const label =
                      round === numRounds
                        ? "Final"
                        : round === numRounds - 1
                          ? "Semi-final"
                          : `Round ${round}`;

                    return (
                      <div key={round}>
                        <p className="text-xs font-semibold text-default-500 uppercase tracking-wide mb-2">
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
                                    color={
                                      selectedWinner === byeTeamId
                                        ? "success"
                                        : "default"
                                    }
                                    startContent={
                                      selectedWinner === byeTeamId ? (
                                        <Icon
                                          icon="lucide:trophy"
                                          className="w-3.5 h-3.5"
                                        />
                                      ) : undefined
                                    }
                                    onPress={() =>
                                      setPendingWinners((prev) => ({
                                        ...prev,
                                        [m.id]: byeTeamId!,
                                      }))
                                    }
                                    className="flex-1 min-w-0"
                                  >
                                    <span className="truncate">
                                      {byeTeam?.name ?? "Unknown"}
                                    </span>
                                  </Button>
                                  <span className="text-xs text-default-400 shrink-0">
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
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-default-200 text-default-400"
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
                                  color={
                                    selectedWinner === m.team1Id
                                      ? "success"
                                      : "default"
                                  }
                                  startContent={
                                    selectedWinner === m.team1Id ? (
                                      <Icon
                                        icon="lucide:trophy"
                                        className="w-3.5 h-3.5"
                                      />
                                    ) : undefined
                                  }
                                  onPress={() =>
                                    setPendingWinners((prev) => ({
                                      ...prev,
                                      [m.id]: m.team1Id!,
                                    }))
                                  }
                                  className="flex-1 min-w-0"
                                >
                                  <span className="truncate">{team1.name}</span>
                                </Button>

                                <span className="text-xs text-default-400 shrink-0">
                                  vs
                                </span>

                                <Button
                                  size="sm"
                                  variant={
                                    selectedWinner === m.team2Id
                                      ? "primary"
                                      : "tertiary"
                                  }
                                  color={
                                    selectedWinner === m.team2Id
                                      ? "success"
                                      : "default"
                                  }
                                  startContent={
                                    selectedWinner === m.team2Id ? (
                                      <Icon
                                        icon="lucide:trophy"
                                        className="w-3.5 h-3.5"
                                      />
                                    ) : undefined
                                  }
                                  onPress={() =>
                                    setPendingWinners((prev) => ({
                                      ...prev,
                                      [m.id]: m.team2Id!,
                                    }))
                                  }
                                  className="flex-1 min-w-0"
                                >
                                  <span className="truncate">{team2.name}</span>
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
                    startContent={
                      t.seed === 1 ? (
                        <Icon icon="lucide:star" className="w-3 h-3 ml-1" />
                      ) : undefined
                    }
                  >
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
                  <div className="flex flex-col items-center gap-2 py-8 text-default-400">
                    <Icon icon="lucide:users" className="w-8 h-8 opacity-40" />
                    <p className="text-sm">
                      {registrations.length === 0
                        ? "No teams registered yet."
                        : "At least 2 registered teams are needed."}
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-default-500">
                      {registrations.length} team
                      {registrations.length !== 1 ? "s" : ""} registered. Drag
                      to reorder teams — the top position is seed #1 and
                      receives the first bye.
                    </p>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="tertiary"
                        startContent={
                          <Icon icon="lucide:shuffle" className="w-4 h-4" />
                        }
                        onPress={() =>
                          setSeedOrder((prev) =>
                            shuffleTeams(
                              prev.map((id) => ({ id }) as BracketTeam),
                            ).map((t) => t.id),
                          )
                        }
                      >
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
                      startContent={
                        <Icon icon="lucide:git-branch" className="w-4 h-4" />
                      }
                      onPress={handleGenerate}
                      isDisabled={registrations.length < 2}
                      className="mt-2"
                    >
                      Generate Bracket
                    </Button>
                  </>
                )}
              </Card.Content>
            </Card>
          </div>
        ))}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(false);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>Delete Bracket?</Modal.Header>
            <Modal.Body>
              <p className="text-sm text-default-600">
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
              <Button onPress={handleDelete}>Delete Bracket</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>

      {/* Regenerate confirmation modal */}
      <Modal
        isOpen={showRegenConfirm}
        onOpenChange={(open) => {
          if (!open) setShowRegenConfirm(false);
        }}
      >
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.Header>Regenerate Bracket?</Modal.Header>
            <Modal.Body>
              <p className="text-sm text-default-600">
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
              <Button onPress={handleDeleteAndRegen}>Regenerate</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal>
    </div>
  );
}
