import React from "react";
import {
  Input,
  InputGroup,
  Select,
  ListBox,
  Checkbox,
  TextField,
  FieldError,
} from "@heroui/react";
import { Label } from "react-aria-components";
import { TournamentStatus } from "@/types/tournament";
import type { Tournament } from "@/types/tournament";
import type { TeeColor } from "./types";
import { isTeeColor, TEE_COLORS } from "./types";
import { WeatherSection } from "./WeatherSection";
import type { Weather } from "./WeatherSection";

interface TournamentSettingsSectionProps {
  players: number;
  onPlayersChange: (v: number) => void;
  maxTeams: number | undefined;
  onMaxTeamsChange: (v: number | undefined) => void;
  prizePool: number;
  onPrizePoolChange: (v: number) => void;
  tee: TeeColor;
  onTeeChange: (v: TeeColor) => void;
  assignedTeeTimes: boolean;
  onAssignedTeeTimesChange: (v: boolean) => void;
  goldTeesEnabled: boolean;
  onGoldTeesEnabledChange: (v: boolean) => void;
  previousTournamentId: string | undefined;
  onPreviousTournamentIdChange: (v: string | undefined) => void;
  allTournaments: Tournament[];
  currentTournamentFirestoreId?: string;
  isAdmin: boolean;
  status: TournamentStatus;
  onStatusChange: (v: TournamentStatus) => void;
  weather: Weather | null;
  date: unknown;
  fetchingWeather: boolean;
  onFetchWeather: () => void;
  errors: {
    players?: string;
    maxTeams?: string;
    prizePool?: string;
  };
}

const TEE_DOT_CLASS: Record<TeeColor, string> = {
  Blue: "w-3 h-3 rounded-full bg-blue-500 inline-block",
  White: "w-3 h-3 rounded-full bg-default/60 inline-block border",
  Gold: "w-3 h-3 rounded-full bg-yellow-500 inline-block",
  Red: "w-3 h-3 rounded-full bg-red-500 inline-block",
  Mixed: "w-3 h-3 rounded-full bg-teal-500 inline-block",
};

const TEE_LABEL_CLASS: Record<TeeColor, string> = {
  Blue: "text-blue-600 dark:text-blue-300",
  White: "text-foreground dark:text-muted",
  Gold: "text-yellow-600 dark:text-yellow-400",
  Red: "text-red-600 dark:text-red-400",
  Mixed: "text-teal-600 dark:text-teal-400",
};

export const TournamentSettingsSection: React.FC<
  TournamentSettingsSectionProps
> = ({
  players,
  onPlayersChange,
  maxTeams,
  onMaxTeamsChange,
  prizePool,
  onPrizePoolChange,
  tee,
  onTeeChange,
  assignedTeeTimes,
  onAssignedTeeTimesChange,
  goldTeesEnabled,
  onGoldTeesEnabledChange,
  previousTournamentId,
  onPreviousTournamentIdChange,
  allTournaments,
  currentTournamentFirestoreId,
  isAdmin,
  status,
  onStatusChange,
  weather,
  date,
  fetchingWeather,
  onFetchWeather,
  errors,
}) => {
  return (
    <div className="space-y-6 min-w-0">
      <TextField
        isInvalid={!!errors.players}
        value={String(players)}
        onChange={(v) => onPlayersChange(parseInt(v, 10) || 1)}
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
          onMaxTeamsChange(
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
              onPrizePoolChange(parseFloat(e.target.value) || 0)
            }
            min={0}
            aria-invalid={!!errors.prizePool}
          />
        </InputGroup>
        {errors.prizePool && (
          <p className="text-xs text-danger">{errors.prizePool}</p>
        )}
      </div>

      <Select
        value={tee}
        onChange={(val) => {
          const s = String(val);
          if (val && isTeeColor(s)) onTeeChange(s);
        }}
        disallowEmptySelection
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
                  <span className={TEE_DOT_CLASS[opt]} />
                  <span className={TEE_LABEL_CLASS[opt]}>{opt}</span>
                </div>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>

      <Checkbox
        isSelected={assignedTeeTimes}
        onChange={onAssignedTeeTimesChange}
        id="assigned-tee-times"
      >
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Content>
          <Label htmlFor="assigned-tee-times">Assigned tee times</Label>
        </Checkbox.Content>
      </Checkbox>

      {isAdmin && (
        <Checkbox
          isSelected={goldTeesEnabled}
          onChange={onGoldTeesEnabledChange}
          id="gold-tees-enabled"
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>
            <Label htmlFor="gold-tees-enabled">
              Allow gold tee selection during registration
            </Label>
          </Checkbox.Content>
        </Checkbox>
      )}

      <Select
        value={
          previousTournamentId &&
          allTournaments.some(
            (t) =>
              t.firestoreId === previousTournamentId &&
              t.firestoreId !== currentTournamentFirestoreId,
          )
            ? previousTournamentId
            : null
        }
        onChange={(val) =>
          onPreviousTournamentIdChange(val ? String(val) : undefined)
        }
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
                (t) =>
                  t.firestoreId &&
                  t.firestoreId !== currentTournamentFirestoreId,
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

      <WeatherSection
        weather={weather}
        date={date}
        fetchingWeather={fetchingWeather}
        onFetchWeather={onFetchWeather}
      />

      <div className="flex flex-col gap-4 pt-2">
        <Select
          value={status}
          onChange={(val) => {
            const v = (val as TournamentStatus) ?? TournamentStatus.Upcoming;
            onStatusChange(v);
          }}
          disallowEmptySelection
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
