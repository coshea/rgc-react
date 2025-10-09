import React from "react";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Input,
  NumberInput,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { useUsers } from "@/hooks/useUsers";
import type {
  WinnerGroup,
  WinnerPlace,
  Competitor,
  WinnerGroupType,
} from "@/types/winner";
import { computeTotalPayout, sortGroups, sortPlaces } from "@/utils/winners";

interface GroupedWinnersEditorProps {
  groups: WinnerGroup[];
  onChange: (groups: WinnerGroup[]) => void;
  teamSize: number;
  prizePool: number;
  isCompleted: boolean;
}

const GROUP_TYPE_OPTIONS: WinnerGroupType[] = [
  "overall",
  "day",
  "flight",
  "custom",
];

export const GroupedWinnersEditor: React.FC<GroupedWinnersEditorProps> = ({
  groups,
  onChange,
  teamSize,
  prizePool,
  isCompleted,
}) => {
  const { users, isLoading: usersLoading } = useUsers();

  // Ensure existing selections never exceed the team size when it changes
  React.useEffect(() => {
    if (!groups?.length) return;
    let changed = false;
    const next = groups.map((g) => {
      const winners = (g.winners || []).map((w) => {
        const comps = w.competitors || [];
        if (teamSize > 0 && comps.length > teamSize) {
          changed = true;
          return { ...w, competitors: comps.slice(0, teamSize) };
        }
        return w;
      });
      return winners !== g.winners ? { ...g, winners } : g;
    });
    if (changed) onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSize]);

  const addGroup = (type: WinnerGroupType = "overall") => {
    const id = crypto.randomUUID();
    const order = groups.length;
    const label =
      type === "overall"
        ? "Overall"
        : type === "day"
          ? `Day ${order + 1}`
          : "New Group";
    const newGroup: WinnerGroup = {
      id,
      label,
      type,
      order,
      winners: [],
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

  const addPlace = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const nextPlace =
      g.winners.length > 0 ? Math.max(...g.winners.map((w) => w.place)) + 1 : 1;
    const newPlace: WinnerPlace = {
      place: nextPlace,
      competitors: [],
      prizeAmount: 0,
    };
    updateGroup(groupId, { winners: [...g.winners, newPlace] });
  };

  const removePlace = (groupId: string, place: number) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const filtered = g.winners.filter((w) => w.place !== place);
    const renumbered = filtered.map((w, i) => ({ ...w, place: i + 1 }));
    updateGroup(groupId, { winners: renumbered });
  };

  const updatePlace = (
    groupId: string,
    place: number,
    patch: Partial<WinnerPlace>
  ) => {
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const winners = g.winners.map((w) =>
      w.place === place ? { ...w, ...patch } : w
    );
    updateGroup(groupId, { winners });
  };

  const setPlaceCompetitors = (
    groupId: string,
    place: number,
    userIds: string[]
  ) => {
    const selected = users.filter((u) => userIds.includes(u.id));
    const competitors: Competitor[] = selected.map((u) => ({
      userId: u.id,
      displayName: u.displayName || u.email || u.id,
    }));
    updatePlace(groupId, place, { competitors });
  };

  if (!isCompleted) {
    return (
      <div className="bg-content2 p-4 rounded-md text-center text-foreground-500">
        <Icon
          icon="lucide:trophy"
          className="mx-auto text-2xl mb-2 text-default-400"
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
        <h3 className="text-lg font-medium">Winners (Grouped)</h3>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <Chip
            color={remaining < 0 ? "danger" : "success"}
            variant="flat"
            className="min-w-[100px] justify-center"
          >
            ${remaining.toLocaleString()}
          </Chip>
          <Button size="sm" variant="flat" onPress={() => addGroup("overall")}>
            Add Overall
          </Button>
          <Button size="sm" variant="flat" onPress={() => addGroup("day")}>
            Add Day
          </Button>
          <Button size="sm" variant="flat" onPress={() => addGroup("custom")}>
            Add Custom
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-content2 p-4 rounded-md text-center text-foreground-500">
          <p>No winner groups yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((g) => (
            <Card key={g.id} className="w-full">
              <CardBody className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-wrap md:flex-nowrap w-full">
                    <Input
                      size="sm"
                      label="Group Label"
                      value={g.label}
                      onChange={(e: any) =>
                        updateGroup(g.id, { label: e.target.value })
                      }
                      className="w-full md:max-w-[240px] md:flex-[2] min-w-0"
                    />
                    <Select
                      size="sm"
                      label="Type"
                      selectedKeys={new Set([g.type])}
                      onSelectionChange={(keys) => {
                        const v = Array.from(
                          keys as Set<string>
                        )[0] as WinnerGroupType;
                        updateGroup(g.id, { type: v });
                      }}
                      className="w-[160px] md:w-[180px]"
                    >
                      {GROUP_TYPE_OPTIONS.map((t) => (
                        <SelectItem key={t}>{t}</SelectItem>
                      ))}
                    </Select>
                    {g.type === "day" && (
                      <NumberInput
                        size="sm"
                        label="Day #"
                        min={1}
                        value={g.dayIndex || 1}
                        onValueChange={(v) =>
                          updateGroup(g.id, { dayIndex: v || 1 })
                        }
                        className="w-[120px]"
                      />
                    )}
                    <NumberInput
                      size="sm"
                      label="Order"
                      min={0}
                      value={g.order}
                      onValueChange={(v) =>
                        updateGroup(g.id, { order: Math.max(0, v || 0) })
                      }
                      className="w-[120px]"
                    />
                  </div>
                  <Button
                    size="sm"
                    isIconOnly
                    color="danger"
                    variant="light"
                    onPress={() => removeGroup(g.id)}
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-2 mb-2">
                  <h4 className="font-medium">Places</h4>
                  <Button
                    size="sm"
                    color="primary"
                    variant="flat"
                    onPress={() => addPlace(g.id)}
                  >
                    Add Place
                  </Button>
                </div>

                {g.winners.length === 0 ? (
                  <div className="bg-content2 p-3 rounded text-sm text-foreground-500">
                    No places yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sortPlaces(g.winners).map((w) => (
                      <div key={w.place} className="rounded-md bg-content2 p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={
                                w.place === 1 ? "lucide:trophy" : "lucide:medal"
                              }
                              className={`text-xl ${w.place === 1 ? "text-warning" : "text-default-400"}`}
                            />
                            <span className="font-medium">Place {w.place}</span>
                          </div>
                          <Button
                            size="sm"
                            isIconOnly
                            color="danger"
                            variant="light"
                            onPress={() => removePlace(g.id, w.place)}
                          >
                            <Icon icon="lucide:trash-2" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <Select
                            label={teamSize > 1 ? "Team Members" : "Winner"}
                            placeholder={
                              teamSize > 1
                                ? "Select team members"
                                : "Select winner"
                            }
                            selectionMode={teamSize > 1 ? "multiple" : "single"}
                            selectedKeys={
                              new Set(
                                (w.competitors || []).map((c) => c.userId)
                              )
                            }
                            onSelectionChange={(keys) =>
                              setPlaceCompetitors(
                                g.id,
                                w.place,
                                (() => {
                                  const all = Array.from(keys as Set<string>);
                                  // Clamp selection to teamSize (for multi-team events)
                                  if (teamSize > 1 && all.length > teamSize) {
                                    return all.slice(0, teamSize);
                                  }
                                  // Single winner mode implicitly limited by selectionMode="single"
                                  return all;
                                })()
                              )
                            }
                            isRequired
                            isDisabled={usersLoading}
                            isInvalid={
                              !w.competitors || w.competitors.length === 0
                            }
                            errorMessage={
                              !w.competitors || w.competitors.length === 0
                                ? "Winner is required"
                                : ""
                            }
                          >
                            {users.map((u) => (
                              <SelectItem key={u.id}>
                                {u.displayName || u.email || u.id}
                              </SelectItem>
                            ))}
                          </Select>

                          <NumberInput
                            label="Prize Amount (per person)"
                            min={0}
                            value={w.prizeAmount}
                            onValueChange={(v) =>
                              updatePlace(g.id, w.place, { prizeAmount: v })
                            }
                            startContent={
                              <div className="pointer-events-none flex items-center">
                                <span className="text-default-400 text-small">
                                  $
                                </span>
                              </div>
                            }
                          />
                        </div>

                        <div className="mt-2">
                          <Input
                            label="Score"
                            value={w.score || ""}
                            onChange={(e: any) =>
                              updatePlace(g.id, w.place, {
                                score: e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
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
