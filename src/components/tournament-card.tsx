import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  CardFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus, statusText } from "@/utils/tournamentStatus";
import { useNavigate, Link } from "react-router-dom";

interface TournamentCardProps {
  tournament: Tournament;
}

export const TournamentCard = ({ tournament }: TournamentCardProps) => {
  const navigate = useNavigate();
  const detailHref = tournament.firestoreId
    ? `/tournaments/${tournament.firestoreId}`
    : undefined;
  return (
    <>
      <Card
        as={detailHref ? Link : undefined}
        to={detailHref || "#"}
        className={`max-w-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${getStatus(tournament) === TournamentStatus.Completed ? "bg-content2" : "bg-content1"}`}
        shadow="md"
        isHoverable
        onPress={() => {
          if (detailHref) navigate(detailHref);
        }}
        role="link"
        aria-label={`View details for ${tournament.title}`}
      >
        <CardHeader className="flex flex-col items-start gap-2 pb-2 pt-3">
          {/* Top: Title */}
          <h3 className="text-xl font-semibold">{tournament.title}</h3>

          {/* Bottom row: Date and Status Chip */}
          <div className="w-full flex justify-between items-center">
            {/* Left: Date */}
            <div className="text-small text-default-500 flex items-center gap-1">
              <Icon icon="lucide:calendar" className="w-4 h-4" />
              {tournament.date.toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
                timeZone: "UTC", // Add this line
              })}
            </div>
            {/* Right: Status Chip */}
            {(() => {
              const s = getStatus(tournament);
              const label = statusText(s);
              if (s === TournamentStatus.Canceled) {
                return (
                  <Chip color="danger" variant="solid" size="sm">
                    {label}
                  </Chip>
                );
              }
              if (s === TournamentStatus.Completed) {
                return (
                  <Chip color="default" variant="flat" size="sm">
                    {label}
                  </Chip>
                );
              }
              if (s === TournamentStatus.Open) {
                return (
                  <Chip color="warning" variant="flat" size="sm">
                    {label}
                  </Chip>
                );
              }
              if (s === TournamentStatus.InProgress) {
                return (
                  <Chip color="primary" variant="flat" size="sm">
                    {label}
                  </Chip>
                );
              }
              return (
                <Chip color="primary" variant="solid" size="sm">
                  {label}
                </Chip>
              );
            })()}
          </div>
        </CardHeader>
        <Divider />
        <CardBody>
          <p className="text-default-600">{tournament.description}</p>
          {/* <div className="mt-4 flex items-center gap-2">
            <Icon icon="lucide:trophy" className="w-5 h-5 text-warning-500" />
            <span className="font-semibold text-lg">
              ${tournament.prizePool.toLocaleString()}
            </span>
          </div> */}
        </CardBody>
        <CardFooter className="flex justify-between items-center gap-3">
          <div className="flex items-center gap-2">
            <Icon icon="lucide:trophy" className="w-5 h-5 text-warning-500" />
            <span className="font-semibold text-lg">
              ${tournament.prizePool.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-1">
            <p className="font-semibold text-default-400 text-small">
              {tournament.players}
            </p>
            <p className="text-default-400 text-small">Player Teams</p>
          </div>
        </CardFooter>
      </Card>
    </>
  );
};
