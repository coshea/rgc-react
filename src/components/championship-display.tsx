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

        {championship.isHistorical && (
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat" color="secondary">
              Historical Record
            </Chip>
          </div>
        )}
      </CardHeader>

      <Divider />

      <CardBody className="space-y-3">
        {/* Winners */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-default-600">Champions</h4>
          {championship.winnerNames?.map((winnerName, index) => (
            <div
              key={index}
              className="flex items-center gap-3 p-3 rounded-medium bg-content1 shadow-small"
            >
              <UserAvatar
                src={undefined}
                name={winnerName}
                userId={championship.winnerIds?.[index]}
                className="w-12 h-12"
                size="md"
                alt={winnerName}
              />
              <div className="flex flex-col">
                <span className="font-semibold">{winnerName}</span>
                <span className="text-small text-default-500">Champion</span>
              </div>
              {championship.winnerIds?.[index] && (
                <div className="ml-auto">
                  <Button
                    as={Link}
                    to={`/profile/${championship.winnerIds[index]}`}
                    size="sm"
                    variant="flat"
                    isIconOnly
                  >
                    <Icon icon="lucide:user" className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )) || (
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
                <span className="text-small text-default-500">Champion</span>
              </div>
            </div>
          )}
        </div>

        {/* Runners-up */}
        {championship.runnerUpNames &&
          championship.runnerUpNames.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-default-600">
                Runners-up
              </h4>
              {championship.runnerUpNames.map((runnerUpName, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-medium bg-content2"
                >
                  <UserAvatar
                    src={undefined}
                    name={runnerUpName}
                    userId={championship.runnerUpIds?.[index]}
                    className="w-12 h-12 opacity-80"
                    size="md"
                    alt={runnerUpName}
                  />
                  <div className="flex flex-col">
                    <span className="font-semibold text-default-600">
                      {runnerUpName}
                    </span>
                    <span className="text-small text-default-500">
                      Runner-up
                    </span>
                  </div>
                  {championship.runnerUpIds?.[index] && (
                    <div className="ml-auto">
                      <Button
                        as={Link}
                        to={`/profile/${championship.runnerUpIds[index]}`}
                        size="sm"
                        variant="flat"
                        isIconOnly
                      >
                        <Icon icon="lucide:user" className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
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

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
    <div className="max-w-7xl mx-auto space-y-12 overflow-x-hidden">
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
