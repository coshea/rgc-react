/**
 * BracketEditor – self-contained bracket management panel.
 *
 * Accepts a tournamentId and the tournament's current registrations.
 * Handles its own Firestore subscription, seeding UI, generation,
 * match-result entry, and delete/regenerate actions.
 *
 * Designed to be embedded directly in TournamentEditor so that all
 * tournament actions are centralised in one place.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
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
  onBracket,
  saveBracket,
  saveMatchResults,
  deleteBracket,
} from "@/api/brackets";
import { generateBracket, shuffleTeams } from "@/utils/bracketGenerator";
import { addToast } from "@/providers/toast";
import type { TournamentBracket, BracketTeam } from "@/types/bracket";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegistrationDoc {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string }>;
}

interface BracketEditorProps {
  tournamentId: string;
  registrations: RegistrationDoc[];
  /** Optional user list for resolving profile pictures in the bracket view */
  allUsers?: Array<{
    id: string;
    photoURL?: string | null;
    profileURL?: string | null;
  }>;
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

// ── SortableTeamRow ───────────────────────────────────────────────────────────

interface SortableTeamRowProps {
  id: string;
  label: string;
  seed: number;
  excluded: boolean;
  onToggleExclude: (id: string) => void;
}

function SortableTeamRow({
  id,
  label,
  seed,
  excluded,
  onToggleExclude,
}: SortableTeamRowProps) {
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
      className={`flex items-center gap-3 rounded-lg px-3 py-2 border select-none transition-colors ${
        excluded
          ? "border-default-100 bg-default-50 dark:bg-default-900/30 opacity-50"
          : "border-default-200 bg-content1"
      }`}
    >
      {!excluded && (
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 shrink-0 p-0.5"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <Icon icon="lucide:grip-vertical" className="w-4 h-4" />
        </button>
      )}
      {excluded && <span className="shrink-0 w-5" aria-hidden="true" />}

      {!excluded && (
        <Chip
          size="sm"
          variant="flat"
          color={seed === 1 ? "warning" : "default"}
          className="shrink-0 min-w-10 justify-center"
        >
          #{seed}
        </Chip>
      )}
      {excluded && (
        <Chip
          size="sm"
          variant="flat"
          color="default"
          className="shrink-0 min-w-10 justify-center line-through"
        >
          —
        </Chip>
      )}

      <span
        className={`text-sm flex-1 min-w-0 truncate ${excluded ? "line-through text-default-400" : ""}`}
      >
        {label}
      </span>

      <button
        type="button"
        className="shrink-0 p-1 rounded text-default-400 hover:text-default-700 transition-colors"
        aria-label={
          excluded ? "Include team in bracket" : "Exclude team from bracket"
        }
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggleExclude(id)}
      >
        <Icon
          icon={excluded ? "lucide:plus-circle" : "lucide:x-circle"}
          className="w-4 h-4"
        />
      </button>
    </div>
  );
}

// ── BracketEditor ─────────────────────────────────────────────────────────────

export function BracketEditor({
  tournamentId,
  registrations,
  allUsers,
}: BracketEditorProps) {
  const [bracket, setBracket] = useState<TournamentBracket | null>(null);
  const [bracketLoading, setBracketLoading] = useState(true);

  // Seeding order (array of reg IDs; index 0 = seed #1)
  const [seedOrder, setSeedOrder] = useState<string[]>([]);
  // IDs excluded from bracket generation
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  // Action states
  const [generating, setGenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Pending match-winner selections (matchId → winnerId); not yet persisted
  const [pendingWinners, setPendingWinners] = useState<Record<string, string>>(
    {},
  );
  const [saving, setSaving] = useState(false);

  // Reset pending selections whenever the saved bracket changes
  useEffect(() => {
    setPendingWinners({});
  }, [bracket]);

  // Real-time bracket subscription
  useEffect(() => {
    setBracketLoading(true);
    const unsub = onBracket(
      tournamentId,
      (b) => {
        setBracket(b);
        setBracketLoading(false);
      },
      () => setBracketLoading(false),
    );
    return unsub;
  }, [tournamentId]);

  // Initialise seed order from registrations (only before a bracket exists)
  useEffect(() => {
    if (!bracket && registrations.length > 0) {
      setSeedOrder(
        shuffleTeams(registrations.map((r) => registrationToTeam(r))).map(
          (t) => t.id,
        ),
      );
      setExcludedIds(new Set());
    }
  }, [bracket, registrations]);

  // ── DnD sensors ──────────────────────────────────────────────────────────────

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

  const regLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const reg of registrations) {
      map.set(reg.id, registrationToTeam(reg).name);
    }
    return map;
  }, [registrations]);

  const userPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers ?? []) {
      const photo = u.profileURL || u.photoURL;
      if (u.id && photo) map.set(u.id, photo);
    }
    return map;
  }, [allUsers]);

  // ── Generate ──────────────────────────────────────────────────────────────────

  const toggleExclude = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (registrations.length < 2) return;
    setGenerating(true);
    try {
      const regMap = new Map(registrations.map((r) => [r.id, r]));
      const orderedTeams = seedOrder
        .filter((id) => !excludedIds.has(id))
        .map((id) => regMap.get(id))
        .filter((r): r is RegistrationDoc => r !== undefined)
        .map((r) => registrationToTeam(r));
      const newBracket = generateBracket(tournamentId, orderedTeams);
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
  }, [tournamentId, registrations, seedOrder, excludedIds]);

  // ── Save results ──────────────────────────────────────────────────────────────

  const handleSaveResults = useCallback(async () => {
    if (!bracket) return;
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
      await saveMatchResults(tournamentId, bracket, effectiveUpdates);
      addToast({ title: "Results saved!", color: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save results";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setSaving(false);
    }
  }, [tournamentId, bracket, pendingWinners]);

  // ── Delete / regenerate ───────────────────────────────────────────────────────

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteBracket(tournamentId);
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

  const handleDeleteAndRegen = async () => {
    setSeedOrder([]);
    await deleteBracket(tournamentId);
    await handleGenerate();
  };

  // ── Derived state ─────────────────────────────────────────────────────────────

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

  if (bracketLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Regenerate / Delete controls (only when bracket exists) */}
      {bracket && (
        <div className="flex gap-2 justify-end">
          <Button
            size="sm"
            variant="flat"
            color="warning"
            startContent={<Icon icon="lucide:refresh-cw" className="w-4 h-4" />}
            onPress={() => setShowRegenConfirm(true)}
          >
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="danger"
            startContent={<Icon icon="lucide:trash-2" className="w-4 h-4" />}
            onPress={() => setShowDeleteConfirm(true)}
          >
            Delete
          </Button>
        </div>
      )}

      {bracket ? (
        <div className="space-y-4">
          {/* Champion / runner-up banners */}
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

          {/* Bracket visualisation */}
          <Card shadow="sm">
            <CardHeader>
              <p className="font-semibold">Bracket</p>
              <p className="text-xs text-default-400 ml-2">
                {bracket.size} slots · {bracket.teams.length} teams
                {bracket.teams.length < bracket.size &&
                  ` · ${bracket.size - bracket.teams.length} bye${bracket.size - bracket.teams.length !== 1 ? "s" : ""}`}
              </p>
            </CardHeader>
            <CardBody>
              <BracketView bracket={bracket} userPhotoMap={userPhotoMap} />
            </CardBody>
          </Card>

          {/* Match results */}
          <Card shadow="sm">
            <CardHeader className="flex items-center justify-between">
              <p className="font-semibold text-sm">Match Results</p>
              <Button
                size="sm"
                color="primary"
                onPress={handleSaveResults}
                isLoading={saving}
                isDisabled={Object.keys(pendingWinners).length === 0}
                startContent={
                  !saving ? (
                    <Icon icon="lucide:save" className="w-4 h-4" />
                  ) : undefined
                }
              >
                Save Results
              </Button>
            </CardHeader>
            <CardBody className="space-y-5 pb-4">
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
                                      ? "solid"
                                      : "flat"
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
                                    variant="light"
                                    color="default"
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
                                    ? "solid"
                                    : "flat"
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
                                    ? "solid"
                                    : "flat"
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
                                  variant="light"
                                  color="default"
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
            </CardBody>
          </Card>
        </div>
      ) : (
        /* ── No bracket yet: show generator ── */
        <Card shadow="sm">
          <CardHeader>
            <p className="font-semibold">Generate Bracket</p>
          </CardHeader>
          <CardBody className="space-y-4">
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
                  {registrations.length !== 1 ? "s" : ""} registered. Drag to
                  reorder — the top position is seed #1 and receives the first
                  bye.
                </p>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="flat"
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
                      {seedOrder.map((id, index) => {
                        const isExcluded = excludedIds.has(id);
                        // Seed number counts only included teams
                        const includedSeed = seedOrder
                          .slice(0, index + 1)
                          .filter((sid) => !excludedIds.has(sid)).length;
                        return (
                          <SortableTeamRow
                            key={id}
                            id={id}
                            label={regLabelMap.get(id) ?? id}
                            seed={isExcluded ? 0 : includedSeed}
                            excluded={isExcluded}
                            onToggleExclude={toggleExclude}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>

                <Button
                  color="primary"
                  startContent={
                    <Icon icon="lucide:git-branch" className="w-4 h-4" />
                  }
                  onPress={handleGenerate}
                  isLoading={generating}
                  isDisabled={
                    seedOrder.filter((id) => !excludedIds.has(id)).length < 2
                  }
                  className="mt-2"
                >
                  Generate Bracket
                  {excludedIds.size > 0 && (
                    <span className="ml-1 text-xs opacity-70">
                      ({seedOrder.filter((id) => !excludedIds.has(id)).length}{" "}
                      teams)
                    </span>
                  )}
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      )}

      {/* Regenerate confirmation */}
      <Modal
        isOpen={showRegenConfirm}
        onClose={() => setShowRegenConfirm(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>Regenerate Bracket?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              This will replace the existing bracket with a freshly randomised
              draw. All current match results will be lost.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setShowRegenConfirm(false)}
              isDisabled={generating}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleDeleteAndRegen}
              isLoading={generating}
            >
              Regenerate
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        size="sm"
      >
        <ModalContent>
          <ModalHeader>Delete Bracket?</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              This will permanently delete the bracket and all match results.
              This action cannot be undone.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => setShowDeleteConfirm(false)}
              isDisabled={deleting}
            >
              Cancel
            </Button>
            <Button color="danger" onPress={handleDelete} isLoading={deleting}>
              Delete Bracket
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Divider to visually separate from the section below */}
      <Divider />
    </div>
  );
}
