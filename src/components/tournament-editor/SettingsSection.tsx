import React from "react";
import {
  Card,
  Input,
  InputGroup,
  Select,
  ListBox,
  Checkbox,
  TextField,
  Label,
  FieldError,
  Button,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import {
  BracketRoundPayout,
  Tournament,
  TournamentStatus,
  TournamentWeather,
} from "@/types/tournament";
import type { DateValue } from "@internationalized/date";

export type TeeColor = "Blue" | "White" | "Gold" | "Red" | "Mixed";
export const TEE_COLORS: TeeColor[] = ["Blue", "White", "Gold", "Red", "Mixed"];
export function isTeeColor(value: unknown): value is TeeColor {
  return TEE_COLORS.includes(value as TeeColor);
}

interface SettingsSectionProps {
  players: number;
  setPlayers: (v: number) => void;
  maxTeams: number | undefined;
  setMaxTeams: (v: number | undefined) => void;
  prizePool: number;
  setPrizePool: (v: number) => void;
  bracketRoundPayouts: BracketRoundPayout[];
  setBracketRoundPayouts: (v: BracketRoundPayout[]) => void;
  tee: TeeColor;
  setTee: (v: TeeColor) => void;
  assignedTeeTimes: boolean;
  setAssignedTeeTimes: (v: boolean) => void;
  goldTeesEnabled: boolean;
  setGoldTeesEnabled: (v: boolean) => void;
  bracketNotificationsDisabled: boolean;
  setBracketNotificationsDisabled: (v: boolean) => void;
  previousTournamentId: string | undefined;
  setPreviousTournamentId: (v: string | undefined) => void;
  allTournaments: Tournament[];
  currentTournamentId: string | undefined;
  status: TournamentStatus;
  setStatus: (v: TournamentStatus) => void;
  setCompleted: (v: boolean) => void;
  weather: TournamentWeather | null;
  date: DateValue | null;
  fetchingWeather: boolean;
  onFetchWeather: () => void;
  onRecalculateBracketPayouts?: () => void;
  recalculatingBracketPayouts?: boolean;
  errors: Record<string, string>;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({
  players,
  setPlayers,
  maxTeams,
  setMaxTeams,
  prizePool,
  setPrizePool,
  bracketRoundPayouts,
  setBracketRoundPayouts,
  tee,
  setTee,
  assignedTeeTimes,
  setAssignedTeeTimes,
  goldTeesEnabled,
  setGoldTeesEnabled,
  bracketNotificationsDisabled,
  setBracketNotificationsDisabled,
  previousTournamentId,
  setPreviousTournamentId,
  allTournaments,
  currentTournamentId,
  status,
  setStatus,
  setCompleted,
  weather,
  date,
  fetchingWeather,
  onFetchWeather,
  onRecalculateBracketPayouts,
  recalculatingBracketPayouts = false,
  errors,
}) => {
  const setSequentialBracketRoundPayouts = (payouts: BracketRoundPayout[]) => {
    setBracketRoundPayouts(
      payouts.map((payout, index) => {
        const nextPayout: BracketRoundPayout = {
          ...payout,
          round: index + 1,
        };

        if (index !== payouts.length - 1) {
          delete nextPayout.runnerUpAmount;
        }

        return nextPayout;
      }),
    );
  };

  const updateBracketRoundPayoutAmount = (index: number, amount: number) => {
    setSequentialBracketRoundPayouts(
      bracketRoundPayouts.map((payout, payoutIndex) =>
        payoutIndex === index ? { ...payout, amount } : payout,
      ),
    );
  };

  const updateFinalRunnerUpAmount = (
    index: number,
    runnerUpAmount: number | undefined,
  ) => {
    setSequentialBracketRoundPayouts(
      bracketRoundPayouts.map((payout, payoutIndex) =>
        payoutIndex === index
          ? {
              ...payout,
              ...(runnerUpAmount !== undefined ? { runnerUpAmount } : {}),
            }
          : payout,
      ),
    );
  };

  const addBracketRoundPayout = () => {
    setSequentialBracketRoundPayouts([
      ...bracketRoundPayouts,
      { round: bracketRoundPayouts.length + 1, amount: 0 },
    ]);
  };

  const removeBracketRoundPayout = (index: number) => {
    setSequentialBracketRoundPayouts(
      bracketRoundPayouts.filter((_, payoutIndex) => payoutIndex !== index),
    );
  };

  return (
    <div className="space-y-6 min-w-0">
      <TextField
        isInvalid={!!errors.players}
        value={String(players)}
        onChange={(v) => setPlayers(parseInt(v, 10) || 1)}
      >
        <Label>Number of Players On A Team</Label>
        <Input
          type="number"
          placeholder="Enter number of players"
          min={1}
          max={100}
        />
        <FieldError>{errors.players}</FieldError>
      </TextField>
      <TextField
        isInvalid={!!errors.maxTeams}
        value={maxTeams !== undefined ? String(maxTeams) : ""}
        onChange={(v) => {
          const parsed = parseInt(v, 10);
          setMaxTeams(
            Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
          );
        }}
      >
        <Label>Max Registered Teams (Optional)</Label>
        <Input type="number" placeholder="Leave blank for unlimited" min={1} />
        <FieldError>{errors.maxTeams}</FieldError>
      </TextField>
      <div className="flex flex-col gap-1">
        <Label className="text-sm">Prize Pool ($)</Label>
        <InputGroup>
          <InputGroup.Prefix>
            <span className="text-muted text-sm px-1">$</span>
          </InputGroup.Prefix>
          <InputGroup.Input
            type="number"
            placeholder="Enter prize amount"
            value={String(prizePool)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPrizePool(parseFloat(e.target.value) || 0)
            }
            min={0}
            aria-invalid={!!errors.prizePool}
          />
        </InputGroup>
        {errors.prizePool && (
          <p className="text-xs text-danger">{errors.prizePool}</p>
        )}
      </div>
      <Card>
        <Card.Content className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">Bracket Round Payouts</h3>
              <p className="text-xs text-muted mt-1">
                Amounts are paid per competitor each time a team wins that round
                in the bracket.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {currentTournamentId && onRecalculateBracketPayouts && (
                <Button
                  size="sm"
                  variant="tertiary"
                  onPress={onRecalculateBracketPayouts}
                  isDisabled={recalculatingBracketPayouts}
                >
                  {!recalculatingBracketPayouts && (
                    <Icon icon="lucide:refresh-cw" className="w-4 h-4" />
                  )}
                  Recalculate Payouts
                </Button>
              )}
              <Button
                size="sm"
                variant="tertiary"
                onPress={addBracketRoundPayout}
              >
                <Icon icon="lucide:plus" className="w-4 h-4" />
                Add Round
              </Button>
            </div>
          </div>

          {bracketRoundPayouts.length === 0 ? (
            <p className="text-sm text-muted">
              No bracket payouts configured yet.
            </p>
          ) : (
            <div className="space-y-3">
              {bracketRoundPayouts.map((payout, index) => (
                <div
                  key={`${payout.round}-${index}`}
                  className="flex items-end gap-3"
                >
                  <TextField className="flex-1 min-w-0">
                    <Label className="text-sm">
                      Round {index + 1} Winner ($)
                    </Label>
                    <InputGroup>
                      <InputGroup.Prefix>
                        <span className="text-muted text-sm px-1">$</span>
                      </InputGroup.Prefix>
                      <InputGroup.Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={String(payout.amount)}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateBracketRoundPayoutAmount(
                            index,
                            Math.max(0, parseFloat(e.target.value) || 0),
                          )
                        }
                      />
                    </InputGroup>
                  </TextField>

                  {index === bracketRoundPayouts.length - 1 && (
                    <TextField className="w-56 shrink-0">
                      <Label className="text-sm">Final Runner-Up ($)</Label>
                      <InputGroup>
                        <InputGroup.Prefix>
                          <span className="text-muted text-sm px-1">$</span>
                        </InputGroup.Prefix>
                        <InputGroup.Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={payout.runnerUpAmount?.toString() ?? ""}
                          placeholder="Optional"
                          onChange={(
                            e: React.ChangeEvent<HTMLInputElement>,
                          ) => {
                            const rawValue = e.target.value.trim();
                            updateFinalRunnerUpAmount(
                              index,
                              rawValue === ""
                                ? undefined
                                : Math.max(0, parseFloat(rawValue) || 0),
                            );
                          }}
                        />
                      </InputGroup>
                    </TextField>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    isIconOnly
                    aria-label={`Remove payout for round ${payout.round}`}
                    onPress={() => removeBracketRoundPayout(index)}
                    className="shrink-0"
                  >
                    <Icon icon="lucide:trash-2" className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {errors.bracketRoundPayouts && (
            <p className="text-xs text-danger">{errors.bracketRoundPayouts}</p>
          )}
        </Card.Content>
      </Card>
      <Select
        value={tee}
        onChange={(val) => {
          if (val && isTeeColor(String(val))) setTee(String(val) as TeeColor);
        }}
      >
        <Label>Tee</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {TEE_COLORS.map((opt) => (
              <ListBox.Item key={opt} id={opt} textValue={opt}>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      opt === "Blue"
                        ? "w-3 h-3 rounded-full bg-blue-500 inline-block"
                        : opt === "White"
                          ? "w-3 h-3 rounded-full bg-default/60 inline-block border"
                          : opt === "Gold"
                            ? "w-3 h-3 rounded-full bg-yellow-500 inline-block"
                            : opt === "Red"
                              ? "w-3 h-3 rounded-full bg-red-500 inline-block"
                              : "w-3 h-3 rounded-full bg-teal-500 inline-block"
                    }
                  />
                  <span
                    className={
                      opt === "Blue"
                        ? "text-blue-600 dark:text-blue-300"
                        : opt === "White"
                          ? "text-foreground dark:text-muted"
                          : opt === "Gold"
                            ? "text-yellow-600 dark:text-yellow-400"
                            : opt === "Red"
                              ? "text-red-600 dark:text-red-400"
                              : "text-teal-600 dark:text-teal-400"
                    }
                  >
                    {opt}
                  </span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
      <Checkbox
        isSelected={assignedTeeTimes}
        onChange={setAssignedTeeTimes}
        id="assigned-tee-times"
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label htmlFor="assigned-tee-times" className="text-sm">
            Assigned tee times
          </Label>
        </Checkbox.Content>
      </Checkbox>
      <Checkbox
        isSelected={goldTeesEnabled}
        onChange={setGoldTeesEnabled}
        id="gold-tees-enabled"
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label htmlFor="gold-tees-enabled" className="text-sm">
            Allow gold tee selection during registration
          </Label>
        </Checkbox.Content>
      </Checkbox>
      <Checkbox
        isSelected={bracketNotificationsDisabled}
        onChange={setBracketNotificationsDisabled}
        id="bracket-notifications-disabled"
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label htmlFor="bracket-notifications-disabled" className="text-sm">
            Disable bracket matchup email notifications
          </Label>
        </Checkbox.Content>
      </Checkbox>
      <Select
        value={
          previousTournamentId &&
          allTournaments.some(
            (t) =>
              t.firestoreId === previousTournamentId &&
              t.firestoreId !== currentTournamentId,
          )
            ? previousTournamentId
            : null
        }
        onChange={(val) => {
          setPreviousTournamentId(val ? String(val) : undefined);
        }}
        placeholder="Link to previous tournament"
      >
        <Label>Previous Year's Tournament (Optional)</Label>
        <Select.Trigger>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {allTournaments
              .filter(
                (t) => t.firestoreId && t.firestoreId !== currentTournamentId,
              )
              .map((t) => {
                const year = t.date.getFullYear();
                const label = `${t.title} (${year})`;
                return (
                  <ListBox.Item
                    key={t.firestoreId!}
                    id={t.firestoreId!}
                    textValue={label}
                  >
                    <div className="flex flex-col">
                      <span>{t.title}</span>
                      <span className="text-xs text-muted">{year}</span>
                    </div>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                );
              })}
          </ListBox>
        </Select.Popover>
      </Select>

      {/* Weather Section */}
      <Card>
        <Card.Content className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tournament Weather</h3>
            <Button
              size="sm"
              variant="tertiary"
              onPress={onFetchWeather}
              isDisabled={!date || fetchingWeather}
            >
              {!fetchingWeather && (
                <Icon icon="lucide:cloud" className="w-4 h-4" />
              )}
              {weather ? "Refresh" : "Fetch"} Weather
            </Button>
          </div>
          {weather ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted text-xs">Condition</p>
                <p className="font-medium">{weather.condition}</p>
              </div>
              <div>
                <p className="text-muted text-xs">Temperature</p>
                <p className="font-medium">{weather.temperature}°F</p>
              </div>
              <div>
                <p className="text-muted text-xs">Wind Speed</p>
                <p className="font-medium">{weather.windSpeed} mph</p>
              </div>
              <div>
                <p className="text-muted text-xs">Precipitation</p>
                <p className="font-medium">{weather.precipitation}"</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">
              {date
                ? "Click 'Fetch Weather' to load historical weather data"
                : "Set a tournament date to fetch weather"}
            </p>
          )}
        </Card.Content>
      </Card>

      {/* Status */}
      <div className="flex flex-col gap-4 pt-2">
        <Select
          value={status}
          onChange={(val) => {
            const v = (val as TournamentStatus) ?? TournamentStatus.Upcoming;
            setStatus(v);
            setCompleted(
              v === TournamentStatus.Completed ||
                v === TournamentStatus.InProgress,
            );
          }}
        >
          <Label>Status</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={TournamentStatus.Upcoming} textValue="Upcoming">
                Upcoming (Registration Closed)
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item
                id={TournamentStatus.InProgress}
                textValue="In Progress"
              >
                In Progress
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item
                id={TournamentStatus.Completed}
                textValue="Completed"
              >
                Tournament Completed
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id={TournamentStatus.Canceled} textValue="Canceled">
                Tournament Canceled
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
    </div>
  );
};
