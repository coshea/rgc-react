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
      className={`w-full ${isClubChampion ? "border-2 border-primary" : ""}`}
      shadow={isClubChampion ? "lg" : "md"}
    >
      <CardHeader className="flex flex-col gap-2">
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

      <CardBody className="space-y-3">
        {/** Determine singular/plural labels based on counts */}
        {(() => {
          /* no-op IIFE to keep local consts scoped to body */
          return null;
        })()}
        {/* Winners */}
        <div className="space-y-2">
          {(() => {
            const winnersCount = championship.winnerNames?.length || 0;
            const winnersLabel = winnersCount === 1 ? "Champion" : "Champions";
            return (
              <h4 className="text-sm font-medium text-default-600">
                {winnersLabel}
              </h4>
            );
          })()}
          {championship.winnerNames && championship.winnerNames.length > 0 ? (
            championship.winnerNames.map((winnerName, index) => {
              const winnerId = championship.winnerIds?.[index];
              const winnerUser =
                winnerId && usersMap.size > 0
                  ? usersMap.get(winnerId)
                  : undefined;

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-medium bg-content1 shadow-small"
                >
                  <UserAvatar
                    user={winnerUser}
                    name={winnerName}
                    userId={winnerId}
                    className="w-12 h-12"
                    size="md"
                    alt={winnerName}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold">{winnerName}</span>
                  </div>
                  {winnerId && (
                    <div className="ml-auto">
                      <Button
                        as={Link}
                        to={`/profile/${winnerId}`}
                        size="sm"
                        variant="flat"
                        isIconOnly
                      >
                        <Icon icon="lucide:user" className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-medium bg-content1 shadow-small">
              <UserAvatar
                src={undefined}
                name="Unknown Champion"
                className="w-12 h-12"
                size="md"
                alt="Unknown Champion"
              />
              <div className="flex flex-col">
                <span className="font-semibold">Unknown Champion</span>
              </div>
            </div>
          )}
        </div>

        {/* Runners-up */}
        {championship.runnerUpNames &&
          championship.runnerUpNames.length > 0 && (
            <div className="space-y-2">
              {(() => {
                const runnerCount = championship.runnerUpNames?.length || 0;
                const runnerLabel =
                  runnerCount === 1 ? "Runner-up" : "Runners-up";
                return (
                  <h4 className="text-sm font-medium text-default-600">
                    {runnerLabel}
                  </h4>
                );
              })()}
              {championship.runnerUpNames.map((runnerUpName, index) => {
                const runnerUpId = championship.runnerUpIds?.[index];
                const runnerUpUser = runnerUpId
                  ? usersMap.get(runnerUpId)
                  : undefined;

                return (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-medium bg-content2"
                  >
                    <UserAvatar
                      user={runnerUpUser}
                      name={runnerUpName}
                      userId={runnerUpId}
                      className="w-12 h-12 opacity-80"
                      size="md"
                      alt={runnerUpName}
                    />
                    <div className="flex flex-col">
                      <span className="font-semibold text-default-600">
                        {runnerUpName}
                      </span>
                    </div>
                    {runnerUpId && (
                      <div className="ml-auto">
                        <Button
                          as={Link}
                          to={`/profile/${runnerUpId}`}
                          size="sm"
                          variant="flat"
                          isIconOnly
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
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Chip size="lg" variant="solid" color="primary" className="text-lg">
          {year}
        </Chip>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pb-4">
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
    <div className="max-w-7xl mx-auto space-y-12 px-4">
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
