import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Chip,
  Button,
} from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { Icon } from "@iconify/react";
import { Link } from "react-router-dom";
import { useUsersMap } from "@/hooks/useUsers";
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
  const { usersMap } = useUsersMap();

  const championshipTitle =
    CHAMPIONSHIP_TYPES[
      championship.championshipType as keyof typeof CHAMPIONSHIP_TYPES
    ] || championship.championshipType;

  const isClubChampion = championship.championshipType === "club-champion";

  return (
    <Card
      className={`w-full transition-all duration-300 hover:scale-[1.02] hover:shadow-xl ${
        isClubChampion
          ? "border-2 border-primary bg-gradient-to-br from-primary/5 to-primary/10"
          : "bg-gradient-to-br from-content1 to-content2/50 hover:bg-gradient-to-br hover:from-content1 hover:to-content2"
      }`}
      shadow={isClubChampion ? "lg" : "md"}
    >
      <CardHeader className="flex flex-col gap-1 pb-2">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {isClubChampion && (
              <Icon icon="lucide:trophy" className="w-6 h-6 text-primary" />
            )}
            <h3
              className={`text-xl font-bold ${isClubChampion ? "text-primary" : ""}`}
            >
              {championshipTitle}
            </h3>
          </div>
          {showEditButton && onEdit && (
            <Button
              size="sm"
              variant="flat"
              onPress={() => onEdit(championship)}
              startContent={<Icon icon="lucide:edit" className="w-4 h-4" />}
            >
              Edit
            </Button>
          )}
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="space-y-4 p-4">
        {/* Winners */}
        <div className="space-y-2">
          {championship.winnerNames && championship.winnerNames.length > 0 ? (
            championship.winnerNames.map((winnerName, index) => {
              const winnerId = championship.winnerIds?.[index];
              const winnerUser =
                winnerId && usersMap.size > 0
                  ? usersMap.get(winnerId)
                  : undefined;
              const winnersCount = championship.winnerNames?.length || 0;
              const winnersLabel =
                winnersCount === 1 ? "Champion" : "Champions";

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 shadow-md hover:shadow-lg transition-all duration-200"
                >
                  <UserAvatar
                    user={winnerUser}
                    name={winnerName}
                    userId={winnerId}
                    className="w-12 h-12 ring-2 ring-amber-300 dark:ring-amber-600 shadow-lg"
                    size="md"
                    alt={winnerName}
                  />
                  <div className="flex flex-col flex-1">
                    <span className="font-bold text-amber-900 dark:text-amber-100">
                      {winnerName}
                    </span>
                    <span className="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                      <Icon icon="lucide:trophy" className="w-3 h-3" />
                      {winnersLabel}
                    </span>
                  </div>
                  {winnerId && (
                    <div className="ml-auto">
                      <Button
                        as={Link}
                        to={`/profile/${winnerId}`}
                        size="sm"
                        variant="flat"
                        color="warning"
                        isIconOnly
                        className="bg-amber-100 hover:bg-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800"
                      >
                        <Icon icon="lucide:user" className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800 shadow-md">
              <UserAvatar
                src={undefined}
                name="Unknown Champion"
                className="w-12 h-12 ring-2 ring-amber-300 dark:ring-amber-600 shadow-lg"
                size="md"
                alt="Unknown Champion"
              />
              <div className="flex flex-col flex-1">
                <span className="font-bold text-amber-900 dark:text-amber-100">
                  Unknown Champion
                </span>
                <span className="text-sm text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                  <Icon icon="lucide:trophy" className="w-3 h-3" />
                  Champion
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Runners-up */}
        {championship.runnerUpNames &&
          championship.runnerUpNames.length > 0 && (
            <div className="space-y-2">
              {championship.runnerUpNames.map((runnerUpName, index) => {
                const runnerUpId = championship.runnerUpIds?.[index];
                const runnerUpUser = runnerUpId
                  ? usersMap.get(runnerUpId)
                  : undefined;
                const runnerCount = championship.runnerUpNames?.length || 0;
                const runnerLabel =
                  runnerCount === 1 ? "Runner-up" : "Runners-up";

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-slate-50 to-stone-50 dark:from-slate-950/30 dark:to-stone-950/30 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-200"
                  >
                    <UserAvatar
                      user={runnerUpUser}
                      name={runnerUpName}
                      userId={runnerUpId}
                      className="w-11 h-11 ring-2 ring-slate-300 dark:ring-slate-600"
                      size="md"
                      alt={runnerUpName}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {runnerUpName}
                      </span>
                      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1">
                        <Icon icon="lucide:award" className="w-3 h-3" />
                        {runnerLabel}
                      </span>
                    </div>
                    {runnerUpId && (
                      <div className="ml-auto">
                        <Button
                          as={Link}
                          to={`/profile/${runnerUpId}`}
                          size="sm"
                          variant="flat"
                          color="default"
                          isIconOnly
                          className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                        >
                          <Icon icon="lucide:user" className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </CardBody>
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
    {} as Record<string, UnifiedChampionship[]>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
        <Chip
          size="lg"
          variant="solid"
          color="primary"
          className="text-lg font-bold px-6 py-2 bg-gradient-to-r from-primary to-primary/80"
        >
          {year}
        </Chip>
        <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent"></div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-6">
        {" "}
        {Object.entries(groupedByType).map(([, typeChampionships]) =>
          typeChampionships.map((championship) => (
            <ChampionshipCard
              key={championship.id}
              championship={championship}
              showEditButton={showEditButtons}
              onEdit={onEdit}
            />
          ))
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
    {} as Record<number, UnifiedChampionship[]>
  );

  // Sort years in descending order
  const years = Object.keys(championshipsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  if (years.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-default-100 to-default-200 flex items-center justify-center">
          <Icon icon="lucide:trophy" className="w-8 h-8 text-default-400" />
        </div>
        <h3 className="text-lg font-semibold text-default-600 mb-2">
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
