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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Chip,
  Separator,
  Modal,
  Select,
  ListBox,
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
  updateFirstRoundMatchups,
  syncBracketTeams,
} from "@/api/brackets";
import {
  generateBracket,
  generateBracketFromSlots,
  shuffleTeams,
} from "@/utils/bracketGenerator";
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

// ── Types ─────────────────────────────────────────────────────────────────────

type BracketMode = "seeding" | "matchups";
interface MatchupSlot {
  team1Id: string | null;
  team2Id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nextPow2(n: number): number {
  if (n <= 1) return 1;
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

/** Sentinel prefix used to identify bye-slot entries in the seed order list */
const BYE_PREFIX = "__bye__:";
function isByeId(id: string): boolean {
  return id.startsWith(BYE_PREFIX);
}

/**
 * UI label for a registration: captain (first member) + remaining members sorted
 * alphabetically, joined with a middle dot. Falls back to team shortcode.
 */
function registrationDisplayLabel(reg: RegistrationDoc): string {
  const members = reg.team ?? [];
  if (members.length === 0) return `Team ${reg.id.slice(-4).toUpperCase()}`;
  const captain = members[0];
  const rest = members
    .slice(1)
    .filter((m) => m.displayName)
    .sort((a, b) => (a.displayName ?? "").localeCompare(b.displayName ?? ""));
  const captainName =
    captain.displayName ?? `Team ${reg.id.slice(-4).toUpperCase()}`;
  if (rest.length === 0) return captainName;
  return [captainName, ...rest.map((m) => m.displayName!)].join(" · ");
}

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
  isBye?: boolean;
  /** When true, hides the include/exclude toggle (used in seed-edit panel) */
  hideExclude?: boolean;
  onToggleExclude: (id: string) => void;
  onRemoveBye?: (id: string) => void;
}

function SortableTeamRow({
  id,
  label,
  seed,
  excluded,
  isBye,
  hideExclude,
  onToggleExclude,
  onRemoveBye,
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
        isBye
          ? "border-dashed border-accent bg-accent-soft dark:bg-accent-soft/20"
          : excluded
            ? "bg-default/60 dark:bg-default/60/30 opacity-50"
            : "bg-surface"
      }`}
    >
      {/* Drag handle – shown for non-excluded rows (including byes) */}
      {(!excluded || isBye) && (
        <button
          type="button"
          className="touch-none cursor-grab active:cursor-grabbing text-muted hover:text-foreground shrink-0 p-0.5"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <Icon icon="lucide:grip-vertical" className="w-4 h-4" />
        </button>
      )}
      {excluded && !isBye && (
        <span className="shrink-0 w-5" aria-hidden="true" />
      )}

      {/* Seed / BYE chip */}
      {isBye ? (
        <Chip
          size="sm"
          variant="tertiary"
          className="shrink-0 min-w-10 justify-center"
        >
          BYE
        </Chip>
      ) : !excluded ? (
        <Chip
          size="sm"
          variant="tertiary"
          color={seed === 1 ? "warning" : "default"}
          className="shrink-0 min-w-10 justify-center"
        >
          #{seed}
        </Chip>
      ) : (
        <Chip
          size="sm"
          variant="tertiary"
          className="shrink-0 min-w-10 justify-center line-through"
        >
          —
        </Chip>
      )}

      <span
        className={`text-sm flex-1 min-w-0 truncate ${
          isBye
            ? "text-accent dark:text-accent italic"
            : excluded
              ? "line-through text-muted"
              : ""
        }`}
      >
        {label}
      </span>

      {isBye ? (
        /* Bye rows: remove button */
        <button
          type="button"
          className="shrink-0 p-1 rounded text-danger-400 hover:text-danger-600 transition-colors"
          aria-label="Remove bye slot"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRemoveBye?.(id)}
        >
          <Icon icon="lucide:x-circle" className="w-4 h-4" />
        </button>
      ) : (
        /* Team rows: include/exclude toggle */
        !hideExclude && (
          <button
            type="button"
            className="shrink-0 p-1 rounded text-muted hover:text-foreground transition-colors"
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
        )
      )}
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

  // Whether the generator is in seed-reorder mode or manual matchup assignment
  const [bracketMode, setBracketMode] = useState<BracketMode>("seeding");

  // Seeding order (array of reg IDs or bye sentinels; index 0 = seed #1)
  const [seedOrder, setSeedOrder] = useState<string[]>([]);
  // IDs excluded from bracket generation
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  // Counter for generating unique bye-slot IDs (ref: doesn't affect render)
  const byeCounterRef = useRef(0);

  // Manual matchup slots (only used in "matchups" mode)
  const [matchupSlots, setMatchupSlots] = useState<MatchupSlot[]>([]);

  // Action states
  const [generating, setGenerating] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Whether the seed-reorder panel is shown on an already-generated bracket
  const [showSeedEdit, setShowSeedEdit] = useState(false);

  // Whether the direct matchup-edit panel is shown on an already-generated bracket
  const [showMatchupEdit, setShowMatchupEdit] = useState(false);
  const [editSlots, setEditSlots] = useState<
    Array<{ matchId: string; team1Id: string | null; team2Id: string | null }>
  >([]);
  const [savingMatchups, setSavingMatchups] = useState(false);
  const [syncingTeams, setSyncingTeams] = useState(false);

  // Track whether seedOrder has already been synchronised from the bracket
  // (so we don't overwrite manual edits on every bracket update)
  const hasSyncedFromBracketRef = useRef(false);

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

  // Initialise seed order:
  //  • When a bracket first loads (null → bracket): use bracket teams sorted by seed.
  //  • When bracket is absent and registrations load: use a shuffled list.
  //  • Subsequent bracket updates (match results) do NOT overwrite the seed order.
  useEffect(() => {
    if (bracket) {
      if (!hasSyncedFromBracketRef.current) {
        hasSyncedFromBracketRef.current = true;
        setSeedOrder(
          [...bracket.teams]
            .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
            .map((t) => t.id),
        );
        setExcludedIds(new Set());
      }
    } else if (registrations.length > 0) {
      hasSyncedFromBracketRef.current = false;
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
      map.set(reg.id, registrationDisplayLabel(reg));
    }
    return map;
  }, [registrations]);

  // Registrations sorted alphabetically by display label (used in dropdowns)
  const sortedRegistrations = useMemo(
    () =>
      [...registrations].sort((a, b) =>
        (regLabelMap.get(a.id) ?? "").localeCompare(
          regLabelMap.get(b.id) ?? "",
        ),
      ),
    [registrations, regLabelMap],
  );

  const userPhotoMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUsers ?? []) {
      const photo = u.profileURL || u.photoURL;
      if (u.id && photo) map.set(u.id, photo);
    }
    return map;
  }, [allUsers]);

  const seedData = useMemo(() => {
    let includedCount = 0;
    return seedOrder.map((id) => {
      const bye = isByeId(id);
      const isExcluded = !bye && excludedIds.has(id);
      if (!isExcluded && !bye) includedCount++;
      return {
        id,
        isExcluded,
        isBye: bye,
        seed: isExcluded || bye ? 0 : includedCount,
      };
    });
  }, [seedOrder, excludedIds]);

  // Computed before callbacks so handleGenerate can safely close over it
  const includedTeamCount = useMemo(
    () => seedOrder.filter((id) => !isByeId(id) && !excludedIds.has(id)).length,
    [seedOrder, excludedIds],
  );

  // In matchup mode: number of first-round slots (= bracket size / 2)
  const matchupSlotCount = useMemo(
    () => nextPow2(Math.max(registrations.length, 2)) / 2,
    [registrations.length],
  );

  // Teams already placed in matchup slots
  const assignedMatchupIds = useMemo(() => {
    const s = new Set<string>();
    for (const slot of matchupSlots) {
      if (slot.team1Id) s.add(slot.team1Id);
      if (slot.team2Id) s.add(slot.team2Id);
    }
    return s;
  }, [matchupSlots]);

  // Count of assigned non-bye teams in matchup mode
  const matchupTeamCount = useMemo(
    () =>
      matchupSlots.reduce(
        (acc, s) => acc + (s.team1Id ? 1 : 0) + (s.team2Id ? 1 : 0),
        0,
      ),
    [matchupSlots],
  );

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

  // Initialise matchup slots from the current seed order (pair consecutive seeds)
  const handleClearSeeding = useCallback(() => {
    // Remove all bye slots; re-include all excluded teams
    setSeedOrder((prev) => prev.filter((id) => !isByeId(id)));
    setExcludedIds(new Set());
  }, []);

  const handleClearMatchups = useCallback(() => {
    setMatchupSlots((prev) =>
      prev.map(() => ({ team1Id: null, team2Id: null })),
    );
  }, []);

  const initMatchupSlots = useCallback(() => {
    const activeIds = seedOrder.filter(
      (id) => !isByeId(id) && !excludedIds.has(id),
    );
    const slots: MatchupSlot[] = [];
    for (let i = 0; i < matchupSlotCount; i++) {
      slots.push({
        team1Id: activeIds[i * 2] ?? null,
        team2Id: activeIds[i * 2 + 1] ?? null,
      });
    }
    setMatchupSlots(slots);
  }, [seedOrder, excludedIds, matchupSlotCount]);

  const handleSetBracketMode = useCallback(
    (mode: BracketMode) => {
      setBracketMode(mode);
      if (mode === "matchups") initMatchupSlots();
    },
    [initMatchupSlots],
  );

  const updateMatchupSlot = useCallback(
    (index: number, field: "team1Id" | "team2Id", value: string | null) => {
      setMatchupSlots((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const handleAddBye = useCallback(() => {
    const next = ++byeCounterRef.current;
    setSeedOrder((prev) => [...prev, `${BYE_PREFIX}${next}`]);
  }, []);

  const handleRemoveBye = useCallback((id: string) => {
    setSeedOrder((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (bracketMode === "seeding" && includedTeamCount < 2) return;
    if (bracketMode === "matchups" && matchupTeamCount < 2) return;
    setGenerating(true);
    try {
      const regMap = new Map(registrations.map((r) => [r.id, r]));
      let newBracket;

      if (bracketMode === "matchups") {
        // Build ordered slot array from explicit matchup pairs
        const orderedSlots = matchupSlots.flatMap((s) => [
          s.team1Id
            ? registrationToTeam(regMap.get(s.team1Id) as RegistrationDoc)
            : null,
          s.team2Id
            ? registrationToTeam(regMap.get(s.team2Id) as RegistrationDoc)
            : null,
        ]);
        newBracket = generateBracketFromSlots(tournamentId, orderedSlots);
      } else {
        const activeSlots = seedOrder.filter(
          (id) => isByeId(id) || !excludedIds.has(id),
        );
        const hasByes = activeSlots.some(isByeId);
        if (hasByes) {
          // Manual byes: use sequential slot pairing so the admin's explicit
          // ordering (including bye positions) is respected directly.
          const orderedSlots = activeSlots.map((id) =>
            isByeId(id)
              ? null
              : registrationToTeam(regMap.get(id) as RegistrationDoc),
          );
          newBracket = generateBracketFromSlots(tournamentId, orderedSlots);
        } else {
          // No manual byes: use standard seeding (1v highest, 2v second-highest …)
          const orderedTeams = activeSlots
            .map((id) => regMap.get(id))
            .filter((r): r is RegistrationDoc => r !== undefined)
            .map((r) => registrationToTeam(r));
          newBracket = generateBracket(tournamentId, orderedTeams);
        }
      }

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
  }, [
    tournamentId,
    registrations,
    seedOrder,
    excludedIds,
    includedTeamCount,
    bracketMode,
    matchupSlots,
    matchupTeamCount,
  ]);

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
    setShowSeedEdit(false);
    setShowMatchupEdit(false);
    hasSyncedFromBracketRef.current = false;
    await deleteBracket(tournamentId);
    await handleGenerate();
  };

  const handleSaveMatchups = useCallback(async () => {
    if (!bracket) return;

    // Validate: no team assigned to more than one slot
    const seen = new Set<string>();
    for (const slot of editSlots) {
      for (const id of [slot.team1Id, slot.team2Id]) {
        if (!id) continue;
        if (seen.has(id)) {
          addToast({
            title: "Duplicate assignment",
            description: "Each team can only appear in one match.",
            color: "warning",
          });
          return;
        }
        seen.add(id);
      }
    }

    setSavingMatchups(true);
    try {
      await updateFirstRoundMatchups(tournamentId, bracket, editSlots);
      setShowMatchupEdit(false);
      addToast({ title: "Matchups updated!", color: "success" });
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to update matchups";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setSavingMatchups(false);
    }
  }, [bracket, editSlots, tournamentId]);

  const handleSyncTeams = useCallback(async () => {
    if (!bracket) return;
    setSyncingTeams(true);
    try {
      const updatedTeams = registrations.map((r) => registrationToTeam(r));
      const { added, updated } = await syncBracketTeams(
        tournamentId,
        bracket.teams,
        updatedTeams,
      );
      if (added === 0 && updated === 0) {
        addToast({
          title: "Already up to date",
          description: "No changes detected.",
          color: "default",
        });
      } else {
        const parts: string[] = [];
        if (added > 0)
          parts.push(`${added} team${added !== 1 ? "s" : ""} added`);
        if (updated > 0)
          parts.push(`${updated} team${updated !== 1 ? "s" : ""} updated`);
        addToast({
          title: "Teams synced",
          description: parts.join(", ") + ".",
          color: "success",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sync teams";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setSyncingTeams(false);
    }
  }, [bracket, registrations, tournamentId]);

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
        <div className="flex gap-2 justify-end flex-wrap">
          <Button
            size="sm"
            variant={showSeedEdit ? "primary" : "tertiary"}
            onPress={() => {
              setShowSeedEdit((v) => !v);
              setShowMatchupEdit(false);
            }}
          >
            <Icon icon="lucide:list-ordered" className="w-4 h-4" />
            Edit Seeds
          </Button>
          <Button
            size="sm"
            variant={showMatchupEdit ? "primary" : "tertiary"}
            onPress={() => {
              const opening = !showMatchupEdit;
              setShowMatchupEdit(opening);
              setShowSeedEdit(false);
              if (opening && bracket) {
                setEditSlots(
                  [...bracket.matches]
                    .filter((m) => m.round === 1)
                    .sort((a, b) => a.position - b.position)
                    .map((m) => ({
                      matchId: m.id,
                      team1Id: m.team1Id,
                      team2Id: m.team2Id,
                    })),
                );
              }
            }}
          >
            <Icon icon="lucide:pencil" className="w-4 h-4" />
            Edit Matchups
          </Button>
          <Button size="sm" variant="tertiary" onPress={handleSyncTeams}>
            {!syncingTeams && (
              <Icon icon="lucide:refresh-ccw" className="w-4 h-4" />
            )}
            Resync Teams
          </Button>
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

      {/* Seed-edit panel (shown when a bracket exists and admin toggled Edit Seeds) */}
      {bracket && showSeedEdit && (
        <Card>
          <Card.Header className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm">Edit Seedings</p>
            <p className="text-xs text-muted">
              Drag to reorder, then click Regenerate to apply.
            </p>
          </Card.Header>
          <Card.Content className="space-y-3 pb-4">
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
                  {seedOrder.map((id, idx) => (
                    <SortableTeamRow
                      key={id}
                      id={id}
                      label={
                        regLabelMap.get(id) ??
                        bracket.teams.find((t) => t.id === id)?.name ??
                        id
                      }
                      seed={idx + 1}
                      excluded={false}
                      hideExclude
                      onToggleExclude={() => undefined}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex gap-2 pt-1 flex-wrap justify-end">
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => {
                  setSeedOrder((prev) => {
                    const a = [...prev];
                    for (let i = a.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [a[i], a[j]] = [a[j], a[i]];
                    }
                    return a;
                  });
                }}
              >
                <Icon icon="lucide:shuffle" className="w-4 h-4" />
                Randomize
              </Button>
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => {
                  setSeedOrder(
                    [...bracket.teams]
                      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
                      .map((t) => t.id),
                  );
                }}
              >
                Reset to Current
              </Button>
              <Button size="sm" onPress={() => setShowRegenConfirm(true)}>
                <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
                Regenerate with New Seeds
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Edit Matchups panel — directly swap round-1 pairings without regenerating */}
      {bracket && showMatchupEdit && (
        <Card>
          <Card.Header className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold text-sm">Edit First Round Matchups</p>
            <p className="text-xs text-muted">
              Changing a match with an existing result will clear that result.
            </p>
          </Card.Header>
          <Card.Content className="space-y-2 pb-4">
            {editSlots.map((slot, idx) => (
              <div key={slot.matchId} className="flex items-center gap-2">
                <span className="text-xs text-muted w-14 shrink-0 text-right">
                  Match {idx + 1}
                </span>
                <Select
                  aria-label={`Match ${idx + 1} — team 1`}
                  value={slot.team1Id ?? "__none__"}
                  onChange={(val) => {
                    const v = val as string;
                    setEditSlots((prev) =>
                      prev.map((s, i) =>
                        i === idx
                          ? { ...s, team1Id: v === "__none__" ? null : v }
                          : s,
                      ),
                    );
                  }}
                  className="flex-1"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="__none__" textValue="— BYE —">
                        — BYE —<ListBox.ItemIndicator />
                      </ListBox.Item>
                      {bracket.teams
                        .slice()
                        .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
                        .map((t) => (
                          <ListBox.Item
                            key={t.id}
                            id={t.id}
                            textValue={regLabelMap.get(t.id) ?? t.name}
                          >
                            {regLabelMap.get(t.id) ?? t.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <span className="text-xs text-muted shrink-0">vs</span>
                <Select
                  aria-label={`Match ${idx + 1} — team 2`}
                  value={slot.team2Id ?? "__none__"}
                  onChange={(val) => {
                    const v = val as string;
                    setEditSlots((prev) =>
                      prev.map((s, i) =>
                        i === idx
                          ? { ...s, team2Id: v === "__none__" ? null : v }
                          : s,
                      ),
                    );
                  }}
                  className="flex-1"
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      <ListBox.Item id="__none__" textValue="— BYE —">
                        — BYE —<ListBox.ItemIndicator />
                      </ListBox.Item>
                      {bracket.teams
                        .slice()
                        .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999))
                        .map((t) => (
                          <ListBox.Item
                            key={t.id}
                            id={t.id}
                            textValue={regLabelMap.get(t.id) ?? t.name}
                          >
                            {regLabelMap.get(t.id) ?? t.name}
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            ))}

            <div className="flex gap-2 justify-end pt-2">
              <Button
                size="sm"
                variant="tertiary"
                onPress={() => {
                  setEditSlots(
                    [...bracket.matches]
                      .filter((m) => m.round === 1)
                      .sort((a, b) => a.position - b.position)
                      .map((m) => ({
                        matchId: m.id,
                        team1Id: m.team1Id,
                        team2Id: m.team2Id,
                      })),
                  );
                }}
              >
                Reset
              </Button>
              <Button size="sm" onPress={handleSaveMatchups}>
                {!savingMatchups && (
                  <Icon icon="lucide:save" className="w-4 h-4" />
                )}
                Save Changes
              </Button>
            </div>
          </Card.Content>
        </Card>
      )}

      {bracket ? (
        <div className="space-y-4">
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
            <Card.Header className="flex items-center justify-between">
              <p className="font-semibold text-sm">Match Results</p>
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
                                  color={
                                    selectedWinner === byeTeamId
                                      ? "success"
                                      : "default"
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
                                    {byeTeam?.name ?? "Unknown"}
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
                                color={
                                  selectedWinner === m.team1Id
                                    ? "success"
                                    : "default"
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
                                <span className="truncate">{team1.name}</span>
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
                                color={
                                  selectedWinner === m.team2Id
                                    ? "success"
                                    : "default"
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
        </div>
      ) : (
        /* ── No bracket yet: show generator ── */
        <Card>
          <Card.Header className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">Generate Bracket</p>
            {registrations.length >= 2 && (
              <div className="flex gap-1 rounded-lg border p-0.5">
                <Button
                  size="sm"
                  variant={bracketMode === "seeding" ? "primary" : "ghost"}
                  color={bracketMode === "seeding" ? "primary" : "default"}
                  onPress={() => handleSetBracketMode("seeding")}
                  className="h-7 text-xs"
                >
                  <Icon icon="lucide:list-ordered" className="w-3.5 h-3.5" />
                  By Seeding
                </Button>
                <Button
                  size="sm"
                  variant={bracketMode === "matchups" ? "primary" : "ghost"}
                  color={bracketMode === "matchups" ? "primary" : "default"}
                  onPress={() => handleSetBracketMode("matchups")}
                  className="h-7 text-xs"
                >
                  <Icon icon="lucide:swords" className="w-3.5 h-3.5" />
                  By Matchups
                </Button>
              </div>
            )}
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
            ) : bracketMode === "seeding" ? (
              <>
                <p className="text-sm text-muted">
                  {registrations.length} team
                  {registrations.length !== 1 ? "s" : ""} registered. Drag to
                  reorder — the top position is seed #1.{" "}
                  {seedOrder.some(isByeId)
                    ? "Drag BYE slots next to the teams that should advance automatically."
                    : "Use 'Add Bye' to manually control which team gets a bye, or byes will be assigned automatically to top seeds."}
                </p>

                <div className="flex justify-end gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={handleClearSeeding}
                    isDisabled={
                      excludedIds.size === 0 && !seedOrder.some(isByeId)
                    }
                  >
                    <Icon icon="lucide:eraser" className="w-4 h-4" />
                    Clear All
                  </Button>
                  <Button size="sm" variant="tertiary" onPress={handleAddBye}>
                    <Icon icon="lucide:plus" className="w-4 h-4" />
                    Add Bye
                  </Button>
                  <Button
                    size="sm"
                    variant="tertiary"
                    onPress={() => {
                      // Simple Fisher-Yates shuffle that works on all entry types
                      setSeedOrder((prev) => {
                        const a = [...prev];
                        for (let i = a.length - 1; i > 0; i--) {
                          const j = Math.floor(Math.random() * (i + 1));
                          [a[i], a[j]] = [a[j], a[i]];
                        }
                        return a;
                      });
                    }}
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
                      {seedData.map(({ id, isExcluded, isBye, seed }) => (
                        <SortableTeamRow
                          key={id}
                          id={id}
                          label={isBye ? "Bye" : (regLabelMap.get(id) ?? id)}
                          seed={seed}
                          excluded={isExcluded}
                          isBye={isBye}
                          onToggleExclude={toggleExclude}
                          onRemoveBye={handleRemoveBye}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <Button
                  onPress={handleGenerate}
                  isDisabled={includedTeamCount < 2}
                  className="mt-2"
                >
                  <Icon icon="lucide:git-branch" className="w-4 h-4" />
                  Generate Bracket
                  {(excludedIds.size > 0 || seedOrder.some(isByeId)) && (
                    <span className="ml-1 text-xs opacity-70">
                      ({includedTeamCount} teams)
                    </span>
                  )}
                </Button>
              </>
            ) : (
              /* ── Matchup assignment mode ── */
              <>
                <p className="text-sm text-muted">
                  Directly assign who plays who in the first round. Leave a slot
                  empty to give that team a bye. Teams not assigned to any match
                  will be excluded from the bracket.
                </p>

                <div className="space-y-2">
                  {matchupSlots.map((slot, i) => {
                    // Options available for team1: unassigned teams + current team1
                    const availForT1 = sortedRegistrations.filter(
                      (r) =>
                        !assignedMatchupIds.has(r.id) || r.id === slot.team1Id,
                    );
                    // Options available for team2: unassigned teams + current team2
                    const availForT2 = sortedRegistrations.filter(
                      (r) =>
                        !assignedMatchupIds.has(r.id) || r.id === slot.team2Id,
                    );

                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 flex-wrap rounded-lg border p-2"
                      >
                        <span className="text-xs font-semibold text-muted w-16 shrink-0">
                          Match {i + 1}
                        </span>
                        <Select
                          placeholder="— Bye —"
                          aria-label={`Match ${i + 1} team 1`}
                          value={slot.team1Id ?? undefined}
                          onChange={(val) => {
                            updateMatchupSlot(
                              i,
                              "team1Id",
                              (val as string) ?? null,
                            );
                          }}
                          className="flex-1 min-w-[140px]"
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {availForT1.map((r) => (
                                <ListBox.Item
                                  key={r.id}
                                  id={r.id}
                                  textValue={regLabelMap.get(r.id) ?? r.id}
                                >
                                  {regLabelMap.get(r.id) ?? r.id}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        <span className="text-xs text-muted shrink-0">
                          vs
                        </span>

                        <Select
                          placeholder="— Bye —"
                          aria-label={`Match ${i + 1} team 2`}
                          value={slot.team2Id ?? undefined}
                          onChange={(val) => {
                            updateMatchupSlot(
                              i,
                              "team2Id",
                              (val as string) ?? null,
                            );
                          }}
                          className="flex-1 min-w-[140px]"
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {availForT2.map((r) => (
                                <ListBox.Item
                                  key={r.id}
                                  id={r.id}
                                  textValue={regLabelMap.get(r.id) ?? r.id}
                                >
                                  {regLabelMap.get(r.id) ?? r.id}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>

                        {(slot.team1Id || slot.team2Id) && (
                          <button
                            type="button"
                            aria-label="Clear match"
                            className="shrink-0 p-1 rounded text-muted hover:text-danger transition-colors"
                            onClick={() => {
                              updateMatchupSlot(i, "team1Id", null);
                              updateMatchupSlot(i, "team2Id", null);
                            }}
                          >
                            <Icon icon="lucide:x" className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Unassigned teams */}
                {registrations.some((r) => !assignedMatchupIds.has(r.id)) && (
                  <div className="pt-1">
                    <p className="text-xs text-muted mb-1.5">
                      Not yet assigned (will be excluded):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {sortedRegistrations
                        .filter((r) => !assignedMatchupIds.has(r.id))
                        .map((r) => (
                          <Chip key={r.id} size="sm" variant="tertiary">
                            {regLabelMap.get(r.id) ?? r.id}
                          </Chip>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    variant="tertiary"
                    onPress={handleClearMatchups}
                    isDisabled={matchupTeamCount === 0}
                  >
                    <Icon icon="lucide:eraser" className="w-4 h-4" />
                    Clear All
                  </Button>
                  <Button
                    className="flex-1"
                    onPress={handleGenerate}
                    isDisabled={matchupTeamCount < 2}
                  >
                    <Icon icon="lucide:git-branch" className="w-4 h-4" />
                    Generate Bracket
                    {matchupTeamCount > 0 && (
                      <span className="ml-1 text-xs opacity-70">
                        ({matchupTeamCount} teams)
                      </span>
                    )}
                  </Button>
                </div>
              </>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Regenerate confirmation */}
      <Modal
        isOpen={showRegenConfirm}
        onOpenChange={(open) => {
          if (!open) setShowRegenConfirm(false);
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="sm">
            <Modal.Dialog>
              <Modal.Header>Regenerate Bracket?</Modal.Header>
              <Modal.Body>
                <p className="text-sm text-foreground">
                  This will replace the existing bracket with a new draw using the
                  current seed order. All current match results will be lost.
                </p>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="tertiary"
                  onPress={() => setShowRegenConfirm(false)}
                  isDisabled={generating}
                >
                  Cancel
                </Button>
                <Button onPress={handleDeleteAndRegen}>Regenerate</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        isOpen={showDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setShowDeleteConfirm(false);
        }}
      >
        <Modal.Backdrop>
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
              <Button onPress={handleDelete}>Delete Bracket</Button>
            </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* Divider to visually separate from the section below */}
      <Separator />
    </div>
  );
}
