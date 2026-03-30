import {
  Card,
  CardBody,
  CardHeader,
  Tooltip,
  Divider,
  CardFooter,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus, isRegistrationOpen } from "@/utils/tournamentStatus";
import { useNavigate, Link } from "react-router-dom";
import { TournamentStatusChip } from "@/components/tournament-status-chip";

interface TournamentCardProps {
  tournament: Tournament;
}

export const TournamentCard = ({ tournament }: TournamentCardProps) => {
  const navigate = useNavigate();
  const detailHref = tournament.firestoreId
    ? `/tournaments/${tournament.firestoreId}`
    : undefined;

  const status = getStatus(tournament);
  const registrationOpen = isRegistrationOpen(tournament);

  // Define styling based on tournament status
  const getCardStyles = () => {
    if (registrationOpen) {
      return {
        card: "border-2 border-warning-500 bg-warning-50/30 dark:bg-warning-950/20",
        glow: "shadow-lg shadow-warning-500/20",
      };
    }
    switch (status) {
      case TournamentStatus.InProgress:
        return {
          card: "border-2 border-primary-500 bg-primary-50/30 dark:bg-primary-950/20",
          glow: "shadow-lg shadow-primary-500/20",
        };
      case TournamentStatus.Completed:
        return {
          card: "border border-default-200 bg-content2 opacity-90",
          glow: "",
        };
      case TournamentStatus.Canceled:
        return {
          card: "border-2 border-danger-300 bg-danger-50/20 dark:bg-danger-950/10 opacity-80",
          glow: "",
        };
      default: // Upcoming
        return {
          card: "border border-success-200 bg-content1",
          glow: "",
        };
    }
  };

  const styles = getCardStyles();

  return (
    <>
      <Card
        as={detailHref ? Link : undefined}
        to={detailHref || "#"}
        className={`max-w-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-all duration-200 ${styles.card} ${styles.glow}`}
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
              {tournament.assignedTeeTimes ? (
                <Tooltip content="Assigned tee times">
                  <span className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-300">
                    <Icon icon="lucide:clock" className="w-4 h-4" />
                    <span className="sr-only">Assigned tee times</span>
                  </span>
                </Tooltip>
              ) : null}
            </div>
            {/* Right: Status Chip */}
            <TournamentStatusChip tournament={tournament} />
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
