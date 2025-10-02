import { useParams, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Divider,
  Spinner,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { UserAvatar } from "@/components/avatar";
import { useUsersMap } from "@/hooks/useUsers";
import {
  useUserChampionships,
  useUserTournamentWins,
  useUserWinnings,
} from "@/hooks/useUserTournaments";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import type { User } from "@/api/users";

interface UserProfilePageProps {}

const UserProfilePage: React.FC<UserProfilePageProps> = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { usersMap, isLoading: usersLoading } = useUsersMap();
  const [user, setUser] = useState<User | null>(null);

  // Fetch championships and tournament wins separately
  const { data: championships = [], isLoading: championshipsLoading } =
    useUserChampionships(userId);
  const { data: tournamentWins = [], isLoading: winsLoading } =
    useUserTournamentWins(userId);
  const { data: winnings, isLoading: winningsLoading } =
    useUserWinnings(userId);

  useEffect(() => {
    if (!usersLoading && userId && usersMap.size > 0) {
      const foundUser = usersMap.get(userId);
      setUser(foundUser || null);
    }
  }, [userId, usersMap, usersLoading]);

  if (usersLoading || championshipsLoading || winsLoading || winningsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!userId) {
    return <Navigate to="/membership/member-directory" replace />;
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="text-center py-12">
          <CardBody>
            <Icon
              icon="lucide:user-x"
              className="w-16 h-16 mx-auto mb-4 text-default-400"
            />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-default-600 mb-4">
              The user profile you're looking for doesn't exist.
            </p>
            <Button
              as="a"
              href="/membership/member-directory"
              color="primary"
              variant="flat"
            >
              Browse Member Directory
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  const majorChampionships = championships; // All championships are shown in major section
  const currentYear = new Date().getFullYear();
  const currentYearWinnings =
    winnings?.yearly.find((w) => w.year === currentYear)?.amount || 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Back Button */}
      <div className="flex items-center gap-4">
        <Button
          variant="flat"
          size="sm"
          startContent={<Icon icon="lucide:arrow-left" className="w-4 h-4" />}
          onPress={() => navigate(-1)}
        >
          Back
        </Button>
      </div>

      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardBody className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <UserAvatar
              user={user}
              className="w-32 h-32 ring-4 ring-primary/20 shadow-xl"
              size="lg"
            />
            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {user.displayName ||
                    `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
                    "Unknown Member"}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                  {user.membershipType && (
                    <Chip color="primary" variant="flat" size="sm">
                      {user.membershipType} Member
                    </Chip>
                  )}
                  {majorChampionships.length > 0 && (
                    <Chip
                      color="warning"
                      variant="flat"
                      size="sm"
                      startContent={
                        <Icon icon="lucide:crown" className="w-3 h-3" />
                      }
                    >
                      {majorChampionships.length} Major
                      {majorChampionships.length !== 1 ? "s" : ""}
                    </Chip>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {user.email && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:mail" className="w-4 h-4 text-primary" />
                    <span className="text-default-700">{user.email}</span>
                  </div>
                )}
                {user.phone && (
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="lucide:phone"
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-default-700">{user.phone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tournament Winnings Summary */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:trophy" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Tournament Winnings</h3>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="text-center space-y-2">
              <div className="text-2xl font-bold text-success">
                ${winnings?.lifetime.toLocaleString() || 0}
              </div>
              <p className="text-sm text-default-600">Lifetime Winnings</p>
            </div>

            <Divider />

            <div className="text-center space-y-2">
              <div className="text-xl font-semibold text-primary">
                ${currentYearWinnings.toLocaleString()}
              </div>
              <p className="text-sm text-default-600">{currentYear} Winnings</p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-default-700">
                Recent Years
              </h4>
              {winnings?.yearly.slice(0, 4).map((yearData) => (
                <div
                  key={yearData.year}
                  className="flex justify-between items-center"
                >
                  <span className="text-sm text-default-600">
                    {yearData.year}
                  </span>
                  <span className="text-sm font-medium">
                    ${yearData.amount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Championships */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:crown" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Championships</h3>
              <Chip size="sm" color="warning" variant="flat">
                {majorChampionships.length}
              </Chip>
            </div>
          </CardHeader>
          <CardBody>
            {majorChampionships.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {majorChampionships.map((championship) => (
                  <div
                    key={championship.id}
                    className="flex flex-col items-center p-3 rounded-lg bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20 text-center"
                  >
                    <Icon
                      icon={
                        championship.placement === "champion"
                          ? "lucide:crown"
                          : "lucide:medal"
                      }
                      className="w-8 h-8 text-warning mb-2"
                    />
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      {CHAMPIONSHIP_TYPES[
                        championship.championshipType as keyof typeof CHAMPIONSHIP_TYPES
                      ] || championship.tournamentName}
                    </h4>
                    <div className="text-lg font-bold text-warning mb-1">
                      {championship.year}
                    </div>
                    <Chip
                      size="sm"
                      color={
                        championship.placement === "champion"
                          ? "success"
                          : "default"
                      }
                      variant="flat"
                    >
                      {championship.placement === "champion"
                        ? "Champion"
                        : "Runner-up"}
                    </Chip>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Icon
                  icon="lucide:trophy"
                  className="w-12 h-12 mx-auto mb-3 text-default-300"
                />
                <p className="text-default-500">No championships yet</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Tournament Wins (Regular Tournaments) */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:award" className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">Tournament Wins</h3>
              <Chip size="sm" color="primary" variant="flat">
                {tournamentWins.length}
              </Chip>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {tournamentWins.length > 0 ? (
            <div className="space-y-6">
              {Object.entries(
                tournamentWins.reduce(
                  (groups, tournament) => {
                    const year = tournament.year;
                    if (!groups[year]) {
                      groups[year] = [];
                    }
                    groups[year].push(tournament);
                    return groups;
                  },
                  {} as Record<number, typeof tournamentWins>
                )
              )
                .sort(([a], [b]) => Number(b) - Number(a)) // Sort years descending
                .map(([year, tournaments]) => (
                  <div key={year} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-primary">
                        {year}
                      </h4>
                      <Chip size="sm" variant="flat" color="primary">
                        {tournaments.length} tournament
                        {tournaments.length !== 1 ? "s" : ""}
                      </Chip>
                    </div>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {tournaments.map((tournament) => (
                        <div
                          key={tournament.id}
                          className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-content2/50 bg-content1 border-default-200"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon
                              icon="lucide:trophy"
                              className="w-4 h-4 text-primary flex-shrink-0"
                            />
                            <h5 className="font-semibold text-foreground text-sm truncate">
                              {tournament.tournamentName}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {tournament.position && (
                              <Chip size="sm" color="primary" variant="flat">
                                {tournament.position === 1
                                  ? "1st"
                                  : tournament.position === 2
                                    ? "2nd"
                                    : tournament.position === 3
                                      ? "3rd"
                                      : `${tournament.position}th`}
                              </Chip>
                            )}
                            <div className="font-bold text-success text-sm">
                              ${tournament.prize || 0}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Icon
                icon="lucide:trophy"
                className="w-16 h-16 mx-auto mb-4 text-default-300"
              />
              <h4 className="text-lg font-medium text-default-600 mb-2">
                No tournament wins yet
              </h4>
              <p className="text-default-500">
                Check back later for tournament victories!
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default UserProfilePage;
