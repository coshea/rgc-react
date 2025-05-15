import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Avatar,
  Chip,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { ChampionItem } from "../types/ChampionItem";

interface YearGroupProps {
  year: number;
  tournaments: Record<string, ChampionItem[]>;
}

const YearGroup = ({ year, tournaments }: YearGroupProps) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Chip size="lg" variant="solid" color="primary" className="text-lg">
          {year}
        </Chip>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {Object.entries(tournaments).map(([title, champions]) => (
          <Card
            key={`${year}-${title}`}
            className={`w-full ${title === "Club Champions" ? "border-2 border-primary" : ""}`}
            shadow={title === "Club Champions" ? "lg" : "md"}
          >
            <CardHeader className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {title === "Club Champions" && (
                  <Icon icon="lucide:trophy" className="w-6 h-6 text-primary" />
                )}
                <h2
                  className={`text-xl font-bold ${title === "Club Champions" ? "text-primary" : ""}`}
                >
                  {title}
                </h2>
              </div>
            </CardHeader>
            <Divider />
            <CardBody className="space-y-3">
              {champions.map((champion) => (
                <div
                  key={champion.id}
                  className={`flex items-center gap-3 p-3 rounded-medium
                    ${champion.runnerUp ? "bg-content2" : "bg-content1 shadow-small"}`}
                >
                  <Avatar
                    src={`https://img.heroui.chat/image/avatar?w=64&h=64&u=${champion.playerId}`}
                    className={champion.runnerUp ? "opacity-80" : ""}
                    size="md"
                  />
                  <div className="flex flex-col">
                    <span
                      className={`font-semibold ${champion.runnerUp ? "text-default-600" : ""}`}
                    >
                      {champion.playerName}
                    </span>
                    <span className="text-small text-default-500">
                      {champion.runnerUp ? "Runner-up" : "Champion"}
                    </span>
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
};

export const ChampionsList = ({ champions }: { champions: ChampionItem[] }) => {
  // First group by year, then by tournament
  const championsByYear = champions.reduce(
    (acc, champion) => {
      if (!acc[champion.year]) {
        acc[champion.year] = {};
      }
      if (!acc[champion.year][champion.tournamentTitle]) {
        acc[champion.year][champion.tournamentTitle] = [];
      }
      acc[champion.year][champion.tournamentTitle].push(champion);
      return acc;
    },
    {} as Record<number, Record<string, ChampionItem[]>>
  );

  // Sort years in descending order
  const years = Object.keys(championsByYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-12">
      {years.map((year) => (
        <YearGroup key={year} year={year} tournaments={championsByYear[year]} />
      ))}
    </div>
  );
};
