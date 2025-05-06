import {
  Card,
  CardBody,
  CardHeader,
  Image,
  Chip,
  Divider,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { TournamentItem } from "@/types/tournament";

interface TournamentCardProps {
  tournament: TournamentItem;
}

export const TournamentCard = ({ tournament }: TournamentCardProps) => {
  return (
    <Card
      className={`max-w-md ${tournament.completed ? "bg-content2" : "bg-content1"}`}
      shadow="md"
    >
      <CardHeader className="flex justify-between items-start gap-3">
        <div className="flex gap-3">
          <Image
            alt="Tournament logo"
            className="w-12 h-12 object-cover"
            src={
              tournament.icon ||
              "https://img.heroui.chat/image/sports?w=100&h=100&u=golf1"
            }
          />
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold">{tournament.title}</h3>
            <p className="text-small text-default-500 flex items-center gap-1">
              <Icon icon="lucide:calendar" className="w-4 h-4" />
              {tournament.date.toDateString()}
            </p>
          </div>
        </div>
        <Chip
          color={tournament.completed ? "default" : "primary"}
          variant={tournament.completed ? "flat" : "solid"}
          size="sm"
        >
          {tournament.completed ? "Completed" : "Upcoming"}
        </Chip>
      </CardHeader>
      <Divider />
      <CardBody>
        <p className="text-default-600">{tournament.description}</p>
        <div className="mt-4 flex items-center gap-2">
          <Icon icon="lucide:trophy" className="w-5 h-5 text-warning-500" />
          <span className="font-semibold text-lg">
            ${tournament.prizePool.toLocaleString()}
          </span>
        </div>
      </CardBody>
    </Card>
  );
};
