import React from "react";
import type { Key } from "react-aria-components";
import {
  Button,
  Card,
  Chip,
  Input,
  InputGroup,
  Select,
  Label,
  ListBox,
  TextField,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUsers } from "@/hooks/useUsers";
import type {
  WinnerGroup,
  WinnerPlace,
  Competitor,
  WinnerGroupType,
} from "@/types/winner";
import {
  computeTotalPayout,
  sortGroups,
  sortPlaces,
  computeDisplayPlaces,
} from "@/utils/winners";
import { UserSelect } from "@/components/UserSelect";

interface GroupedWinnersEditorProps {
  groups: WinnerGroup[];
  onChange: (groups: WinnerGroup[]) => void;
  teamSize: number;
  prizePool: number;
  isCompleted: boolean;
  /** Optional list of registrations to allow picking winners by team (default behavior when provided). */
  registrations?: Array<{
    id: string;
    team: Array<{ id: string; displayName: string }>;
    ownerId?: string;
  }>;
}

const GROUP_TYPE_OPTIONS: WinnerGroupType[] = [
  "overall",
  "day",
  "flight",
  "closestToPin",
  "custom",
];

const CLOSEST_TO_PIN_HOLES = [3, 5, 12, 17];

export const GroupedWinnersEditor: React.FC<GroupedWinnersEditorProps> = ({
  groups,
  onChange,
  teamSize,
  prizePool,
  isCompleted,
  registrations = [],
}) => {
  const { users, isLoading: usersLoading } = useUsers();

  // Winner source mode: "teams" when registrations are available, "users" otherwise.
  // Auto-switches to "teams" when registrations load asynchronously, unless the user
  // has already made a manual selection.
  type SourceMode = "teams" | "users";
  const [sourceMode, setSourceMode] = React.useState<SourceMode>(
    registrations.length > 0 ? "teams" : "users",
  );
  const userChoseModeRef = React.useRef(false);
  React.useEffect(() => {
    if (!userChoseModeRef.current && registrations.length > 0) {
      setSourceMode("teams");
    }
  }, [registrations.length]);

  // Effective team size for winner assignment. Defaults to the max competitor count
  // already saved in the data (so reloading persists grouped teams), falling back to
  // the tournament's teamSize. Can be overridden by the user in the UI.
  const derivedTeamSize = React.useMemo(() => {
    let max = teamSize;
    for (const g of groups) {
      for (const w of g.winners || []) {
        max = Math.max(max, (w.competitors || []).length);
      }
    }
    return max;
  }, [groups, teamSize]);

  const [effectiveTeamSize, setEffectiveTeamSize] = React.useState<number>(
    () => derivedTeamSize,
  );

  // Sync effectiveTeamSize when props arrive asynchronously (e.g. tournament data
  // loaded after mount). Only overwrites if the user has not manually changed it
  // from the last derived value — tracked via a ref.
  const lastDerivedTeamSize = React.useRef(derivedTeamSize);
  React.useEffect(() => {
    if (derivedTeamSize !== lastDerivedTeamSize.current) {
      setEffectiveTeamSize((prev) => {
        // If the user hasn't diverged from the previous derived value, follow the update.
        if (prev === lastDerivedTeamSize.current) {
          return derivedTeamSize;
        }
        return prev;
      });
      lastDerivedTeamSize.current = derivedTeamSize;
    }
  }, [derivedTeamSize]);

  // Normalize: ensure every WinnerPlace has a unique id to support ties (duplicate place numbers)
  React.useEffect(() => {
    if (!groups?.length) return;
    // Fast path: only perform deep normalization if we find at least one place missing an id.
    let anyMissing = false;
    for (const g of groups) {
      if (!g.winners) continue;
      for (const w of g.winners) {
        if (!w.id) {
          anyMissing = true;
          break;
        }
      }
      if (anyMissing) break;
    }
    if (!anyMissing) return;

    // Slow path: create normalized copy with generated ids for missing places.
    const normalized = groups.map((g) => {
      const winners = (g.winners || []).map((w) =>
        w.id ? w : { ...w, id: crypto.randomUUID() },
      );
      return winners !== g.winners ? { ...g, winners } : g;
    });
    onChange(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups]);

  // Ensure existing selections never exceed the effective team size when it changes
  React.useEffect(() => {
    if (!groups?.length) return;
    let changed = false;
    const next = groups.map((g) => {
      const winners = (g.winners || []).map((w) => {
        const comps = w.competitors || [];
        if (effectiveTeamSize > 0 && comps.length > effectiveTeamSize) {
          changed = true;
          return { ...w, competitors: comps.slice(0, effectiveTeamSize) };
        }
        return w;
      });
      return winners !== g.winners ? { ...g, winners } : g;
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTeamSize]);

  const addGroup = (type: WinnerGroupType = "overall") => {
    const id = crypto.randomUUID();
    const order = groups.length;
    let label = "";
    let winners: WinnerPlace[] = [];

    if (type === "overall") {
      label = "Overall";
    } else if (type === "day") {
      label = `Day ${order + 1}`;
    } else if (type === "closestToPin") {
      label = "Closest to Pin";
      // Pre-populate with entries for each hole (3, 5, 12, 17)
      winners = CLOSEST_TO_PIN_HOLES.map((hole, index) => ({
        id: crypto.randomUUID(),
        place: index + 1, // Sequential place for sorting/identification
        holeNumber: hole, // Actual hole number (semantically correct)
        competitors: [],
        prizeAmount: 0,
        score: undefined,
      }));
    } else {
      label = "New Group";
    }

    const newGroup: WinnerGroup = {
      id,
      label,
      type,
      order,
      winners,
    };
    onChange([...groups, newGroup]);
  };

  const removeGroup = (id: string) => {
    const next = groups
      .filter((g) => g.id !== id)
      .map((g, idx) => ({ ...g, order: idx }));
    onChange(next);
  };

  const updateGroup = (id: string, patch: Partial<WinnerGroup>) => {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  };

  // Utility function to compute the next place for a winner, tie-aware
  function computeNextPlace(winners: WinnerPlace[]): number {
    if (!winners || winners.length === 0) return 1;
    const sorted = sortPlaces(winners);
    const display = computeDisplayPlaces(sorted);
    const lastDisplay = display[display.length - 1]?.displayPlace || 0;
    return lastDisplay + 1;
  }

  const addPlace = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const nextPlace = computeNextPlace(g.winners);
    const newPlace: WinnerPlace = {
      id: crypto.randomUUID(),
      place: nextPlace,
      competitors: [],
      prizeAmount: 0,
    };
    updateGroup(groupId, { winners: [...g.winners, newPlace] });
  };

  const removePlace = (groupId: string, placeOrId: number | string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const filtered = g.winners.filter((w) =>
      typeof placeOrId === "string"
        ? w.id !== placeOrId
        : w.place !== placeOrId,
    );
    // Do not renumber automatically; keep explicit place values to preserve ties and gaps
    updateGroup(groupId, { winners: filtered });
  };

  const tiePlace = (groupId: string, placeOrId: number | string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const base = g.winners.find((w) =>
      typeof placeOrId === "string"
        ? w.id === placeOrId
        : w.place === placeOrId,
    );
    const place =
      base?.place ?? (typeof placeOrId === "number" ? placeOrId : 1);
    const newPlace: WinnerPlace = {
      id: crypto.randomUUID(),
      place,
      competitors: [],
      prizeAmount: base?.prizeAmount ?? 0,
      // Only include score if it's defined to avoid writing undefined to Firestore
      ...(base?.score !== undefined ? { score: base.score } : {}),
      // Preserve hole number for closest-to-pin entries
      ...(base?.holeNumber !== undefined
        ? { holeNumber: base.holeNumber }
        : {}),
    };
    updateGroup(groupId, { winners: [...g.winners, newPlace] });
  };

  const updatePlace = (
    groupId: string,
    placeOrId: string | number,
    patch: Partial<WinnerPlace>,
  ) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const winners = g.winners.map((w) => {
      const match =
        typeof placeOrId === "string"
          ? w.id === placeOrId
          : w.place === placeOrId;
      return match ? { ...w, ...patch } : w;
    });
    updateGroup(groupId, { winners });
  };

  const setPlaceCompetitors = (
    groupId: string,
    placeOrId: number | string,
    userIds: string[],
  ) => {
    const selected = users.filter((u) => userIds.includes(u.id));
    const competitors: Competitor[] = selected.map((u) => ({
      userId: u.id,
      displayName: u.displayName || u.email || u.id,
    }));
    updatePlace(groupId, placeOrId, { competitors });
  };

  if (!isCompleted) {
    return (
      <div className="bg-surface-secondary p-4 rounded-md text-center text-muted">
        <Icon
          icon="lucide:trophy"
          className="mx-auto text-2xl mb-2 text-muted"
        />
        <p>Winners can be added once the tournament is marked as completed</p>
      </div>
    );
  }

  const totalAllocated = computeTotalPayout(groups);
  const remaining = prizePool - totalAllocated;

  const sorted = sortGroups(groups);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-medium">Winners</h3>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Chip
            color={remaining < 0 ? "danger" : "success"}
            variant="tertiary"
            className="min-w-[100px] justify-center"
          >
            ${remaining.toLocaleString()}
          </Chip>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => addGroup("overall")}
          >
            Add Overall
          </Button>
          <Button size="sm" variant="tertiary" onPress={() => addGroup("day")}>
            Add Day
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => addGroup("closestToPin")}
          >
            Add Closest to Pin
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => addGroup("custom")}
          >
            Add Custom
          </Button>
        </div>
      </div>

      {/* Source mode selector */}
      <div className="flex items-start gap-3">
        <Select
          value={sourceMode}
          onChange={(val) => {
            const v = val as SourceMode;
            userChoseModeRef.current = true;
            setSourceMode(v || (registrations.length > 0 ? "teams" : "users"));
          }}
          className="w-[260px]"
        >
          <Label>Winner selection source</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item
                id="teams"
                textValue="Registered Teams"
                isDisabled={registrations.length === 0}
              >
                Registered Teams {registrations.length === 0 ? "(none)" : ""}
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="users" textValue="All Users">
                All Users
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <TextField
          value={String(effectiveTeamSize)}
          onChange={(v) =>
            setEffectiveTeamSize(Math.max(1, parseInt(v, 10) || 1))
          }
          className="w-[160px]"
        >
          <Label>Winners per place</Label>
          <Input type="number" min={1} max={20} />
          {teamSize !== effectiveTeamSize && (
            <p className="text-xs text-muted mt-1">
              Tournament default: {teamSize}
            </p>
          )}
        </TextField>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-surface-secondary p-4 rounded-md text-center text-muted">
          <p>No winner groups yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((g) => (
            <Card key={g.id} className="w-full">
              <Card.Content className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-wrap md:flex-nowrap w-full">
                    <TextField
                      value={g.label}
                      onChange={(v) => updateGroup(g.id, { label: v })}
                      className="w-full md:max-w-[240px] md:flex-[2] min-w-0"
                    >
                      <Label>Group Label</Label>
                      <Input />
                    </TextField>
                    <Select
                      value={g.type}
                      onChange={(val) => {
                        updateGroup(g.id, { type: val as WinnerGroupType });
                      }}
                      className="w-[160px] md:w-[180px]"
                    >
                      <Label>Type</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {GROUP_TYPE_OPTIONS.map((t) => (
                            <ListBox.Item key={t} id={t} textValue={t}>
                              {t}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    {g.type === "day" && (
                      <TextField
                        value={String(g.dayIndex || 1)}
                        onChange={(v) =>
                          updateGroup(g.id, { dayIndex: parseInt(v, 10) || 1 })
                        }
                        className="w-[120px]"
                      >
                        <Label>Day #</Label>
                        <Input type="number" min={1} />
                      </TextField>
                    )}
                    <TextField
                      value={String(g.order)}
                      onChange={(v) =>
                        updateGroup(g.id, {
                          order: Math.max(0, parseInt(v, 10) || 0),
                        })
                      }
                      className="w-[120px]"
                    >
                      <Label>Order</Label>
                      <Input type="number" min={0} />
                    </TextField>
                  </div>
                  <Button
                    size="sm"
                    isIconOnly
                    variant="ghost"
                    onPress={() => removeGroup(g.id)}
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                  <h4 className="font-medium">
                    {g.type === "closestToPin" ? "Holes" : "Places"}
                  </h4>
                  {g.type !== "closestToPin" && (
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={() => addPlace(g.id)}
                    >
                      Add Place
                    </Button>
                  )}
                </div>

                {g.winners.length === 0 ? (
                  <div className="bg-surface-secondary p-3 rounded text-sm text-muted">
                    No places yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(() => {
                      const sortedPlaces = sortPlaces(g.winners);
                      const display = computeDisplayPlaces(sortedPlaces);
                      const teamLabel = (r: {
                        team: Array<{ id: string; displayName: string }>;
                      }) => r.team.map((m) => m.displayName).join(", ");
                      return sortedPlaces.map((w, index) => (
                        <div
                          key={w.id || `${w.place}-${index}`}
                          className="rounded-md bg-surface-secondary p-3"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon
                                icon={
                                  g.type === "closestToPin"
                                    ? "lucide:target"
                                    : w.place === 1
                                      ? "lucide:trophy"
                                      : "lucide:medal"
                                }
                                className={`text-xl ${
                                  g.type === "closestToPin"
                                    ? "text-accent"
                                    : w.place === 1
                                      ? "text-warning"
                                      : "text-muted"
                                }`}
                              />
                              <span className="font-medium">
                                {g.type === "closestToPin"
                                  ? `Hole ${w.holeNumber || w.place}`
                                  : `Place ${display[index].displayPlace}`}
                              </span>
                            </div>
                            <div className="ml-auto flex items-center gap-2">
                              {g.type !== "closestToPin" && (
                                <Button
                                  size="sm"
                                  variant="tertiary"
                                  onPress={() =>
                                    tiePlace(g.id, w.id || w.place)
                                  }
                                >
                                  Tie
                                </Button>
                              )}
                              <Button
                                size="sm"
                                isIconOnly
                                variant="ghost"
                                aria-label="Delete place"
                                onPress={() =>
                                  removePlace(g.id, w.id || w.place)
                                }
                              >
                                <Icon icon="lucide:trash-2" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {sourceMode === "teams" ? (
                              <Select
                                value={registrations
                                  .filter((r) => {
                                    const competitorIds = new Set(
                                      (w.competitors || []).map(
                                        (c) => c.userId,
                                      ),
                                    );
                                    return (
                                      r.team.length > 0 &&
                                      r.team.every((m) =>
                                        competitorIds.has(m.id),
                                      )
                                    );
                                  })
                                  .map((r) => r.id as Key)}
                                onChange={(val) => {
                                  const selectedIds = Array.isArray(val)
                                    ? (val as string[])
                                    : val
                                      ? [val as string]
                                      : [];
                                  const competitors: Competitor[] =
                                    selectedIds.flatMap((key) => {
                                      const reg = registrations.find(
                                        (r) => r.id === key,
                                      );
                                      if (!reg) return [];
                                      const members = reg.team.map((m) => ({
                                        userId: m.id,
                                        displayName: m.displayName || m.id,
                                      }));
                                      return effectiveTeamSize > 0
                                        ? members.slice(0, effectiveTeamSize)
                                        : members;
                                    });
                                  updatePlace(g.id, w.id || w.place, {
                                    competitors,
                                  });
                                }}
                                selectionMode="multiple"
                                placeholder={
                                  registrations.length > 0
                                    ? "Choose registration(s)"
                                    : "No registrations"
                                }
                                className="w-full"
                                isDisabled={registrations.length === 0}
                                aria-label="Registered Team Selector"
                              >
                                <Label>
                                  {effectiveTeamSize > 1
                                    ? "Registered Teams"
                                    : "Registered Player"}
                                </Label>
                                <Select.Trigger>
                                  <Select.Value />
                                  <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                  <ListBox>
                                    {[...registrations]
                                      .sort((a, b) =>
                                        teamLabel(a).localeCompare(
                                          teamLabel(b),
                                        ),
                                      )
                                      .map((r) => (
                                        <ListBox.Item
                                          key={r.id}
                                          id={r.id}
                                          textValue={teamLabel(r)}
                                        >
                                          {teamLabel(r)}
                                          <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                      ))}
                                  </ListBox>
                                </Select.Popover>
                              </Select>
                            ) : (
                              <UserSelect
                                users={users}
                                label={
                                  effectiveTeamSize > 1
                                    ? "Team Members"
                                    : "Winner"
                                }
                                placeholder={
                                  effectiveTeamSize > 1
                                    ? "Select team members"
                                    : "Select winner"
                                }
                                multiple={effectiveTeamSize > 1}
                                maxSelected={
                                  effectiveTeamSize > 1
                                    ? effectiveTeamSize
                                    : undefined
                                }
                                value={
                                  effectiveTeamSize > 1
                                    ? (w.competitors || []).map((c) => c.userId)
                                    : (w.competitors &&
                                        w.competitors[0]?.userId) ||
                                      ""
                                }
                                onChange={(val) =>
                                  setPlaceCompetitors(
                                    g.id,
                                    w.id || w.place,
                                    (Array.isArray(val) ? val : [val]).filter(
                                      Boolean,
                                    ) as string[],
                                  )
                                }
                                disabled={usersLoading}
                                required
                                invalid={
                                  !w.competitors || w.competitors.length === 0
                                }
                                errorMessage={
                                  !w.competitors || w.competitors.length === 0
                                    ? "Winner is required"
                                    : ""
                                }
                              />
                            )}

                            <div className="flex flex-col gap-1">
                              <Label className="text-sm">
                                Prize Amount (per person)
                              </Label>
                              <InputGroup>
                                <InputGroup.Prefix>
                                  <div className="pointer-events-none flex items-center">
                                    <span className="text-muted text-sm">
                                      $
                                    </span>
                                  </div>
                                </InputGroup.Prefix>
                                <InputGroup.Input
                                  type="number"
                                  min={0}
                                  value={String(w.prizeAmount ?? "")}
                                  onChange={(
                                    e: React.ChangeEvent<HTMLInputElement>,
                                  ) =>
                                    updatePlace(g.id, w.id || w.place, {
                                      prizeAmount:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  onFocus={(e) => {
                                    if (e.target instanceof HTMLInputElement) {
                                      e.target.select();
                                    }
                                  }}
                                />
                              </InputGroup>
                            </div>
                          </div>

                          <div className="mt-2">
                            <TextField
                              value={w.score || ""}
                              onChange={(v) =>
                                updatePlace(g.id, w.id || w.place, { score: v })
                              }
                            >
                              <Label>Score</Label>
                              <Input />
                            </TextField>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </Card.Content>
            </Card>
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="flex flex-wrap justify-between items-center gap-2 pt-2 text-sm">
          <div>Total allocated: ${totalAllocated.toLocaleString()}</div>
          <div className={remaining < 0 ? "text-danger" : "text-success"}>
            Remaining: ${remaining.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupedWinnersEditor;
