import { Card, Separator, Chip, Button } from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import type { UnifiedChampionship } from "@/types/championship";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";

interface ChampionshipCardProps {
  championship: UnifiedChampionship;
  showEditButton?: boolean;
  onEdit?: (championship: UnifiedChampionship) => void;
}

export function ChampionshipCard({
  championship,
  showEditButton = false,
  onEdit,
}: ChampionshipCardProps) {
  const { user, userLoggedIn } = useAuth();
  const { usersMap } = useUsersMap({ publicNamesOnly: true }); // Always fetch for public names

  // Only allow profile viewing for authenticated and verified users
  const canViewProfiles = userLoggedIn && user?.emailVerified;

  const championshipTitle =
    CHAMPIONSHIP_TYPES[
      championship.championshipType as keyof typeof CHAMPIONSHIP_TYPES
    ] || championship.championshipType;

  const isClubChampion = championship.championshipType === "club-champion";
  const winnersLabel =
    (championship.winnerNames?.length ?? 0) === 1 ? "Champion" : "Champions";
  const runnerLabel =
    (championship.runnerUpNames?.length ?? 0) === 1
      ? "Runner-up"
      : "Runners-up";

  return (
    <Card
      className={`w-full shadow-sm ${isClubChampion ? "border-2 border-accent" : ""}`}
    >
      <Card.Header className="flex items-center justify-between py-2.5 px-3">
        <div className="flex items-center gap-1.5 min-w-0">
          {isClubChampion && (
            <Icon
              icon="lucide:trophy"
              className="w-4 h-4 text-accent shrink-0"
            />
          )}
          <h3
            className={`text-sm font-bold truncate ${isClubChampion ? "text-accent" : ""}`}
          >
            {championshipTitle}
          </h3>
        </div>
        {showEditButton && onEdit && (
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="Edit championship"
            onPress={() => onEdit(championship)}
            className="shrink-0 ml-1.5"
          >
            <Icon icon="lucide:edit" className="w-3.5 h-3.5" />
          </Button>
        )}
      </Card.Header>

      <Separator />

      <Card.Content className="px-3 py-2.5 space-y-1.5">
        {/* Winners */}
        {championship.winnerNames && championship.winnerNames.length > 0 ? (
          championship.winnerNames.map((winnerName, index) => {
            const winnerId = championship.winnerIds?.[index];
            const winnerUser = winnerId ? usersMap.get(winnerId) : undefined;
            const isClickable = !!winnerId && canViewProfiles;

            const row = (
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 transition-colors hover:bg-amber-100 dark:hover:bg-amber-950/50">
                <UserAvatar
                  user={winnerUser}
                  name={winnerName}
                  userId={winnerId}
                  size="sm"
                  alt={winnerName}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-amber-900 dark:text-amber-100 truncate">
                    {winnerName}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                    <Icon
                      icon="lucide:trophy"
                      className="w-2.5 h-2.5 shrink-0"
                    />
                    {winnersLabel}
                  </p>
                </div>
                {isClickable && (
                  <Icon
                    icon="lucide:chevron-right"
                    className="w-3.5 h-3.5 text-amber-500 shrink-0"
                  />
                )}
              </div>
            );

            return isClickable ? (
              <Link
                key={index}
                to={`/profile/${winnerId}`}
                aria-label={`View ${winnerName}'s profile`}
                className="block"
              >
                {row}
              </Link>
            ) : (
              <div key={index}>{row}</div>
            );
          })
        ) : (
          <div className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <UserAvatar
              src={undefined}
              name="Unknown Champion"
              size="sm"
              alt="Unknown Champion"
              className="shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-semibold text-amber-900 dark:text-amber-100">
                Unknown Champion
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                <Icon icon="lucide:trophy" className="w-2.5 h-2.5 shrink-0" />
                Champion
              </p>
            </div>
          </div>
        )}

        {/* Runners-up */}
        {championship.runnerUpNames &&
          championship.runnerUpNames.length > 0 &&
          championship.runnerUpNames.map((runnerUpName, index) => {
            const runnerUpId = championship.runnerUpIds?.[index];
            const runnerUpUser = runnerUpId
              ? usersMap.get(runnerUpId)
              : undefined;
            const isClickable = !!runnerUpId && canViewProfiles;

            const row = (
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-100 dark:hover:bg-slate-950/50">
                <UserAvatar
                  user={runnerUpUser}
                  name={runnerUpName}
                  userId={runnerUpId}
                  size="sm"
                  alt={runnerUpName}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-slate-700 dark:text-slate-200 truncate">
                    {runnerUpName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                    <Icon
                      icon="lucide:award"
                      className="w-2.5 h-2.5 shrink-0"
                    />
                    {runnerLabel}
                  </p>
                </div>
                {isClickable && (
                  <Icon
                    icon="lucide:chevron-right"
                    className="w-3.5 h-3.5 text-slate-400 shrink-0"
                  />
                )}
              </div>
            );

            return isClickable ? (
              <Link
                key={index}
                to={`/profile/${runnerUpId}`}
                aria-label={`View ${runnerUpName}'s profile`}
                className="block"
              >
                {row}
              </Link>
            ) : (
              <div key={index}>{row}</div>
            );
          })}
      </Card.Content>
    </Card>
  );
}

interface YearGroupProps {
  year: number;
  championships: UnifiedChampionship[];
  showEditButtons?: boolean;
  onEdit?: (championship: UnifiedChampionship) => void;
}

export function ChampionshipYearGroup({
  year,
  championships,
  showEditButtons = false,
  onEdit,
}: YearGroupProps) {
  // Group championships by type for this year
  const groupedByType = championships.reduce(
    (acc, championship) => {
      const key = championship.championshipType;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(championship);
      return acc;
    },
    {} as Record<string, UnifiedChampionship[]>,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-linear-to-b from-primary to-primary/50 rounded-full"></div>
        <Chip
          size="lg"
          variant="primary"
          className="text-lg font-bold px-6 py-2 bg-linear-to-r from-primary to-primary/80"
        >
          {year}
        </Chip>
        <div className="flex-1 h-px bg-linear-to-r from-primary/20 to-transparent"></div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 pb-6">
        {Object.entries(groupedByType)
          .sort(([typeA], [typeB]) => typeA.localeCompare(typeB))
          .map(([, typeChampionships]) =>
            typeChampionships.map((championship) => (
              <ChampionshipCard
                key={championship.id}
                championship={championship}
                showEditButton={showEditButtons}
                onEdit={onEdit}
              />
            )),
          )}
      </div>
    </div>
  );
}

interface ChampionshipsListProps {
  championships: UnifiedChampionship[];
  showEditButtons?: boolean;
  onEdit?: (championship: UnifiedChampionship) => void;
  emptyMessage?: string;
}

export function ChampionshipsList({
  championships,
  showEditButtons = false,
  onEdit,
  emptyMessage = "No championships found",
}: ChampionshipsListProps) {
  // Group championships by year
  const championshipsByYear = championships.reduce(
    (acc, championship) => {
      if (!acc[championship.year]) {
        acc[championship.year] = [];
      }
      acc[championship.year].push(championship);
      return acc;
    },
    {} as Record<number, UnifiedChampionship[]>,
  );

  // Sort years in descending order
  const years = Object.keys(championshipsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-default/20 flex items-center justify-center">
          <Icon icon="lucide:trophy" className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {emptyMessage}
        </h3>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-16 px-4 py-8">
      {years.map((year) => (
        <ChampionshipYearGroup
          key={year}
          year={year}
          championships={championshipsByYear[year]}
          showEditButtons={showEditButtons}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
