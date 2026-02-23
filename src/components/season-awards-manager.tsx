import React from "react";
import { Button, Divider, Input, Select, SelectItem } from "@heroui/react";
import { Icon } from "@iconify/react";
import { addToast } from "@/providers/toast";
import UserSelect from "@/components/UserSelect";
import { useUsersMap } from "@/hooks/useUsers";
import {
  deleteSeasonAward,
  onSeasonAwardsByYear,
  upsertSeasonAward,
} from "@/api/seasonAwards";
import {
  SeasonAward,
  SeasonAwardType,
  SEASON_AWARD_DEFAULT_AMOUNTS,
  SEASON_AWARD_LABELS,
} from "@/types/seasonAwards";

const MIN_AWARD_YEAR = 2000;
const MAX_AWARD_YEAR = 2100;

export function SeasonAwardsManager() {
  const awardTypes = React.useMemo(
    () => Object.values(SeasonAwardType) as SeasonAwardType[],
    [],
  );
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState<number>(currentYear);
  const [seasonAwards, setSeasonAwards] = React.useState<SeasonAward[]>([]);
  const [awardsLoading, setAwardsLoading] = React.useState(false);
  const [awardSaving, setAwardSaving] = React.useState(false);
  const [awardDeletingId, setAwardDeletingId] = React.useState<string | null>(
    null,
  );
  const [editingAwardId, setEditingAwardId] = React.useState<string | null>(
    null,
  );
  const [awardType, setAwardType] = React.useState<SeasonAwardType>(
    SeasonAwardType.HoleInOne,
  );
  const [awardAmountOverride, setAwardAmountOverride] = React.useState("");
  const [awardUserId, setAwardUserId] = React.useState("");
  const [awardDate, setAwardDate] = React.useState(`${currentYear}-01-01`);
  const [awardError, setAwardError] = React.useState<string | null>(null);

  const { usersMap } = useUsersMap();
  const users = React.useMemo(() => Array.from(usersMap.values()), [usersMap]);

  const resetAwardForm = React.useCallback(
    (seedDate?: Date, seasonYear?: number) => {
      setEditingAwardId(null);
      setAwardType(SeasonAwardType.HoleInOne);
      setAwardAmountOverride("");
      setAwardUserId("");
      setAwardError(null);

      const targetYear = seasonYear ?? selectedYear;
      const sourceDate = seedDate ?? new Date(targetYear, 0, 1);
      const nextDate = new Date(sourceDate);
      nextDate.setFullYear(targetYear);
      setAwardDate(nextDate.toISOString().slice(0, 10));
    },
    [selectedYear],
  );

  React.useEffect(() => {
    if (
      !Number.isInteger(selectedYear) ||
      selectedYear < MIN_AWARD_YEAR ||
      selectedYear > MAX_AWARD_YEAR
    ) {
      setSeasonAwards([]);
      return;
    }

    setAwardsLoading(true);
    const unsub = onSeasonAwardsByYear(
      selectedYear,
      (items) => {
        setSeasonAwards(items);
        setAwardsLoading(false);
      },
      (error) => {
        console.error("Failed to load season awards", error);
        setAwardsLoading(false);
        addToast({
          title: "Error",
          description: "Failed to load season awards.",
          color: "danger",
        });
      },
    );

    return () => unsub();
  }, [selectedYear]);

  const saveAward = async () => {
    if (!Number.isInteger(selectedYear)) {
      setAwardError("Please enter a valid year.");
      return;
    }

    if (!awardUserId) {
      setAwardError("Please select a member.");
      return;
    }

    if (!awardType) {
      setAwardError("Please select an award type.");
      return;
    }

    if (!awardDate) {
      setAwardError("Please choose an award date.");
      return;
    }

    if (
      awardAmountOverride.trim() &&
      (!Number.isFinite(Number(awardAmountOverride)) ||
        Number(awardAmountOverride) <= 0)
    ) {
      setAwardError("Amount override must be a number greater than 0.");
      return;
    }

    const parsedDate = new Date(`${awardDate}T12:00:00`);
    if (Number.isNaN(parsedDate.getTime())) {
      setAwardError("Please enter a valid date.");
      return;
    }

    if (parsedDate.getFullYear() !== selectedYear) {
      setAwardError("Award date year must match the selected season year.");
      return;
    }

    const userRecord = usersMap.get(awardUserId);
    const userDisplayName =
      userRecord?.displayName || userRecord?.email || awardUserId;
    const defaultAmount = SEASON_AWARD_DEFAULT_AMOUNTS[awardType];
    const amount = awardAmountOverride.trim()
      ? Number(awardAmountOverride)
      : defaultAmount;

    setAwardSaving(true);
    try {
      await upsertSeasonAward({
        id: editingAwardId || undefined,
        userId: awardUserId,
        userDisplayName,
        awardType,
        amount,
        date: parsedDate,
        seasonYear: selectedYear,
      });

      addToast({
        title: editingAwardId ? "Award updated" : "Award added",
        description: "Season award saved successfully.",
        color: "success",
      });
      resetAwardForm(parsedDate, selectedYear);
    } catch (error) {
      console.error("Failed to save season award", error);
      addToast({
        title: "Error",
        description: "Failed to save season award.",
        color: "danger",
      });
    } finally {
      setAwardSaving(false);
    }
  };

  const beginEditAward = (award: SeasonAward) => {
    const defaultAmount = SEASON_AWARD_DEFAULT_AMOUNTS[award.awardType];
    setSelectedYear(award.seasonYear);
    setEditingAwardId(award.id);
    setAwardType(award.awardType);
    setAwardAmountOverride(
      award.amount !== defaultAmount ? String(award.amount) : "",
    );
    setAwardUserId(award.userId);
    setAwardDate(award.date.toISOString().slice(0, 10));
    setAwardError(null);
  };

  const removeAward = async (awardId: string) => {
    setAwardDeletingId(awardId);
    try {
      await deleteSeasonAward(awardId);
      addToast({
        title: "Award removed",
        description: "Season award deleted.",
        color: "success",
      });
      if (editingAwardId === awardId) {
        resetAwardForm(undefined, selectedYear);
      }
    } catch (error) {
      console.error("Failed to delete season award", error);
      addToast({
        title: "Error",
        description: "Failed to delete season award.",
        color: "danger",
      });
    } finally {
      setAwardDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <Input
        type="number"
        min={MIN_AWARD_YEAR}
        max={MAX_AWARD_YEAR}
        label="Season year"
        value={String(selectedYear)}
        onValueChange={(value) => {
          const next = Number(value);
          if (!Number.isFinite(next)) {
            return;
          }
          setSelectedYear(next);
          setAwardError(null);
          resetAwardForm(undefined, next);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Select
          label="Award type"
          selectedKeys={[awardType]}
          onSelectionChange={(keys) => {
            const next = Array.from(keys)[0] as SeasonAwardType | undefined;
            if (!next) return;
            setAwardError(null);
            setAwardType(next);
            setAwardAmountOverride("");
          }}
        >
          {awardTypes.map((type) => (
            <SelectItem key={type} textValue={SEASON_AWARD_LABELS[type]}>
              {SEASON_AWARD_LABELS[type]}
            </SelectItem>
          ))}
        </Select>
        <UserSelect
          users={users}
          label="Member"
          placeholder="Select member"
          value={awardUserId}
          onChange={(value) => {
            setAwardError(null);
            setAwardUserId(Array.isArray(value) ? "" : value);
          }}
          required
          invalid={Boolean(awardError && !awardUserId)}
          errorMessage={awardError && !awardUserId ? awardError : undefined}
        />
        <Input
          type="number"
          min={0}
          step="0.01"
          label="Amount override (optional)"
          placeholder={`Default: $${SEASON_AWARD_DEFAULT_AMOUNTS[awardType]}`}
          value={awardAmountOverride}
          onValueChange={(value) => {
            setAwardError(null);
            setAwardAmountOverride(value);
          }}
          isInvalid={
            Boolean(awardError) &&
            awardAmountOverride.trim().length > 0 &&
            (!Number.isFinite(Number(awardAmountOverride)) ||
              Number(awardAmountOverride) <= 0)
          }
          errorMessage={
            awardError &&
            awardAmountOverride.trim().length > 0 &&
            (!Number.isFinite(Number(awardAmountOverride)) ||
              Number(awardAmountOverride) <= 0)
              ? awardError
              : undefined
          }
        />
        <Input
          type="date"
          label="Award date"
          value={awardDate}
          onValueChange={(value) => {
            setAwardError(null);
            setAwardDate(value);
          }}
          isInvalid={Boolean(awardError && !awardDate)}
          errorMessage={awardError && !awardDate ? awardError : undefined}
        />
      </div>

      {awardError && awardUserId && awardDate ? (
        <p className="text-sm text-danger">{awardError}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button color="primary" onPress={saveAward} isLoading={awardSaving}>
          {editingAwardId ? "Update award" : "Add award"}
        </Button>
        {editingAwardId && (
          <Button
            variant="flat"
            onPress={() => resetAwardForm(undefined, selectedYear)}
          >
            Cancel edit
          </Button>
        )}
      </div>

      <Divider />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Awards for {selectedYear}</h3>
        {awardsLoading ? (
          <p className="text-sm text-foreground-500">Loading awards...</p>
        ) : seasonAwards.length === 0 ? (
          <p className="text-sm text-foreground-500">
            No season awards recorded yet.
          </p>
        ) : (
          <div className="space-y-2">
            {seasonAwards.map((award) => (
              <div
                key={award.id}
                className="rounded-md border border-default-200 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {award.userDisplayName}
                  </p>
                  <p className="text-xs text-foreground-500">
                    {SEASON_AWARD_LABELS[award.awardType]} • ${award.amount} •{" "}
                    {award.date.toLocaleDateString("en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => beginEditAward(award)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="flat"
                    color="danger"
                    isLoading={awardDeletingId === award.id}
                    onPress={() => removeAward(award.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center text-xs text-foreground-500 gap-2">
        <Icon icon="lucide:info" className="w-4 h-4" />
        Awards are standalone season entries and are not tied to a tournament.
      </div>
    </div>
  );
}
