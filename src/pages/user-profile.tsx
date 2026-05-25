import React from "react";
import {
  useParams,
  Navigate,
  useNavigate,
  Link as RouterLink,
} from "react-router-dom";
import {
  Card,
  Chip,
  Button,
  Separator,
  Modal,
  Skeleton,
  Link,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import { UserAvatar } from "@/components/avatar";
import BackButton from "@/components/back-button";
import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/providers/AuthProvider";
import { useUserById } from "@/hooks/useUserById";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  useUserChampionships,
  useUserTournamentWins,
  useUserWinnings,
  useUserRegistrations,
} from "@/hooks/useUserTournaments";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useUsersMap } from "@/hooks/useUsers";
import { TeamRegistrationCard } from "@/components/team-registration-card";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import { BOARD_ROLE_META, formatBoardRoleLabel } from "@/types/roles";
import { toDate } from "@/api/users";
import { formatPhone } from "@/utils/phone";

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { user: profileUser, isLoading: userLoading } = useUserById(userId);
  const [isOpen, setIsOpen] = React.useState(false);
  const onOpen = () => setIsOpen(true);
  const onOpenChange = (v: boolean) => setIsOpen(v);
  const isMobile = useMediaQuery("(max-width: 640px)");

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser?.uid === userId;

  // Fetch championships and tournament wins separately (lazy loaded)
  const { data: championships = [], isLoading: championshipsLoading } =
    useUserChampionships(userId);
  const { data: tournamentWins = [], isLoading: winsLoading } =
    useUserTournamentWins(userId);
  const { data: winnings, isLoading: winningsLoading } =
    useUserWinnings(userId);
  const { data: userRegistrations = [], isLoading: registrationsLoading } =
    useUserRegistrations(userId);
  const { usersMap } = useUsersMap();

  usePageTracking(profileUser?.displayName || `User ${userId}`, userLoading);

  // Only wait for basic user profile data, let tournament data load lazily
  if (userLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-4">
        {/* Back Button Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>

        {/* Profile Header Skeleton */}
        <Card className="bg-linear-to-r from-primary/10 to-secondary/10">
          <Card.Content className="p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Skeleton className="w-32 h-32 rounded-full" />
              <div className="flex-1 text-center md:text-left space-y-3 w-full">
                <div>
                  <Skeleton className="h-8 w-64 mx-auto md:mx-0 mb-2 rounded-lg" />
                  <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                  </div>
                </div>

                {/* Member since skeleton */}
                <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-4 w-24 rounded" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="w-4 h-4 rounded" />
                    <Skeleton className="h-4 w-28 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </Card.Content>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament Winnings Skeleton */}
          <Card className="lg:col-span-1">
            <Card.Header className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </Card.Header>
            <Card.Content className="space-y-4">
              <div className="text-center space-y-2">
                <Skeleton className="h-8 w-24 mx-auto rounded" />
                <Skeleton className="h-4 w-20 mx-auto rounded" />
              </div>

              <Separator />

              <div className="text-center space-y-2">
                <Skeleton className="h-6 w-20 mx-auto rounded" />
                <Skeleton className="h-4 w-16 mx-auto rounded" />
              </div>

              <div className="space-y-3">
                <Skeleton className="h-4 w-20 rounded" />
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-4 w-12 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>

          {/* Championships Skeleton */}
          <Card className="lg:col-span-2">
            <Card.Header className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-24 rounded" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </Card.Header>
            <Card.Content>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center p-3 rounded-lg bg-linear-to-r from-warning/10 to-warning/5 border border-warning/20 text-center"
                  >
                    <Skeleton className="w-8 h-8 rounded mb-2" />
                    <Skeleton className="h-4 w-20 mb-1 rounded" />
                    <Skeleton className="h-6 w-12 mb-1 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </Card.Content>
          </Card>
        </div>

        {/* Tournament Wins Skeleton */}
        <Card>
          <Card.Header className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-28 rounded" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="space-y-6">
              {[2024, 2023].map((year) => (
                <div key={year} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-12 rounded" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border bg-surface"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 flex-1 rounded" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Skeleton className="h-5 w-8 rounded-full" />
                          <Skeleton className="h-4 w-12 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      </div>
    );
  }

  if (!userId) {
    return <Navigate to={siteConfig.pages.directory.link} replace />;
  }

  if (!profileUser) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="text-center py-12">
          <Card.Content>
            <Icon
              icon="lucide:user-x"
              className="w-16 h-16 mx-auto mb-4 text-muted"
            />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-foreground mb-4">
              The user profile you're looking for doesn't exist.
            </p>
            <Link
              href={siteConfig.pages.directory.link}
              className="inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium border hover:bg-default/60 transition-colors"
            >
              Browse Member Directory
            </Link>
          </Card.Content>
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
      {/* Back Button and Edit Profile */}
      <div className="flex items-center justify-between">
        <BackButton />

        {isOwnProfile && (
          <div className="flex items-center gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onPress={() =>
                navigate(siteConfig.pages.notificationSettings.link)
              }
            >
              <Icon icon="lucide:bell" className="w-4 h-4" />
              Notifications
            </Button>
            <Button
              variant="tertiary"
              size="sm"
              onPress={() => {
                if (isMobile) {
                  navigate("/profile/edit");
                  return;
                }
                onOpen();
              }}
            >
              <Icon icon="lucide:edit" className="w-4 h-4" />
              Edit Profile
            </Button>
          </div>
        )}
      </div>

      {/* Profile Header */}
      <Card className="bg-linear-to-r from-primary/10 to-secondary/10">
        <Card.Content className="p-8">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <UserAvatar
              user={profileUser}
              className="w-32 h-32 ring-4 ring-primary/20 shadow-xl"
              size="lg"
            />
            <div className="flex-1 text-center md:text-left space-y-3">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">
                  {profileUser.displayName ||
                    `${profileUser.firstName || ""} ${profileUser.lastName || ""}`.trim() ||
                    "Unknown Member"}
                </h1>
                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                  {profileUser.boardMember && (
                    <Chip
                      color={
                        profileUser.role &&
                        BOARD_ROLE_META[
                          profileUser.role as keyof typeof BOARD_ROLE_META
                        ]
                          ? BOARD_ROLE_META[
                              profileUser.role as keyof typeof BOARD_ROLE_META
                            ].color
                          : "secondary"
                      }
                      variant="tertiary"
                      size="sm"
                    >
                      <Icon
                        icon={
                          profileUser.role &&
                          BOARD_ROLE_META[
                            profileUser.role as keyof typeof BOARD_ROLE_META
                          ]
                            ? BOARD_ROLE_META[
                                profileUser.role as keyof typeof BOARD_ROLE_META
                              ].icon
                            : "lucide:shield"
                        }
                        className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                      />
                      {formatBoardRoleLabel(profileUser.role)}
                    </Chip>
                  )}

                  {profileUser.membershipType === "full" && (
                    <Chip variant="tertiary" size="sm">
                      <Icon
                        icon="lucide:badge-check"
                        className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                      />
                      Full Member
                    </Chip>
                  )}

                  {profileUser.membershipType === "handicap" && (
                    <Chip variant="tertiary" size="sm">
                      <Icon
                        icon="lucide:golf"
                        className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                      />
                      Handicap Only
                    </Chip>
                  )}

                  {!championshipsLoading && majorChampionships.length > 0 && (
                    <Chip variant="tertiary" size="sm">
                      <Icon
                        icon="lucide:crown"
                        className="inline-block w-3 h-3 mr-0.5 align-[-1px]"
                      />
                      {majorChampionships.length} Major
                      {majorChampionships.length !== 1 ? "s" : ""}
                    </Chip>
                  )}
                </div>

                {/* Member since display */}
                {profileUser.createdAt && (
                  <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-foreground">
                    <Icon icon="lucide:calendar" className="w-4 h-4" />
                    <span>
                      Member since{" "}
                      {toDate(profileUser.createdAt)?.toLocaleDateString(
                        "en-US",
                        { month: "long", year: "numeric", timeZone: "UTC" },
                      ) ?? "Unknown"}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {profileUser.email && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:mail" className="w-4 h-4 text-accent" />
                    <Link
                      href={`mailto:${profileUser.email}`}
                      className="text-foreground underline decoration-dotted underline-offset-2"
                    >
                      {profileUser.email}
                    </Link>
                  </div>
                )}
                {profileUser.phone && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:phone" className="w-4 h-4 text-accent" />
                    <span className="text-foreground">
                      {formatPhone(profileUser.phone)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card.Content>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tournament Winnings Summary */}
        <Card className="lg:col-span-1">
          <Card.Header className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:trophy" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Tournament Winnings</h3>
            </div>
          </Card.Header>
          <Card.Content className="space-y-4">
            {winningsLoading ? (
              <>
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-24 mx-auto rounded" />
                  <Skeleton className="h-4 w-20 mx-auto rounded" />
                </div>
                <Separator />
                <div className="text-center space-y-2">
                  <Skeleton className="h-6 w-20 mx-auto rounded" />
                  <Skeleton className="h-4 w-16 mx-auto rounded" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-20 rounded" />
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <Skeleton className="h-4 w-12 rounded" />
                      <Skeleton className="h-4 w-16 rounded" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-center space-y-2">
                  <div className="text-2xl font-bold text-success">
                    ${winnings?.lifetime.toLocaleString() || 0}
                  </div>
                  <p className="text-sm text-foreground">Lifetime Winnings</p>
                </div>

                <Separator />

                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-accent">
                    ${currentYearWinnings.toLocaleString()}
                  </div>
                  <p className="text-sm text-foreground">
                    {currentYear} Winnings
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">
                    Recent Years
                  </h4>
                  {winnings?.yearly.slice(0, 4).map((yearData) => (
                    <div
                      key={yearData.year}
                      className="flex justify-between items-center"
                    >
                      <span className="text-sm text-foreground">
                        {yearData.year}
                      </span>
                      <span className="text-sm font-medium">
                        ${yearData.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card.Content>
        </Card>

        {/* Championships */}
        <Card className="lg:col-span-2">
          <Card.Header className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:crown" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Championships</h3>
              {!championshipsLoading && (
                <Chip size="sm" variant="tertiary">
                  {majorChampionships.length}
                </Chip>
              )}
            </div>
          </Card.Header>
          <Card.Content>
            {championshipsLoading ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center p-3 rounded-lg bg-linear-to-r from-default/10 to-default/5 border border-default/20 text-center"
                  >
                    <Skeleton className="w-8 h-8 rounded mb-2" />
                    <Skeleton className="h-4 w-20 mb-1 rounded" />
                    <Skeleton className="h-6 w-12 mb-1 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            ) : majorChampionships.length > 0 ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {majorChampionships.map((championship) => (
                  <div
                    key={championship.id}
                    className={`flex flex-col items-center p-3 rounded-lg text-center ${
                      championship.placement === "champion"
                        ? "bg-linear-to-r from-warning/10 to-warning/5 border border-warning/20"
                        : "bg-linear-to-r from-default/10 to-default/5 border border-default/20"
                    }`}
                  >
                    <Icon
                      icon={
                        championship.placement === "champion"
                          ? "lucide:crown"
                          : "lucide:medal"
                      }
                      className={`w-8 h-8 mb-2 ${
                        championship.placement === "champion"
                          ? "text-warning"
                          : "text-muted"
                      }`}
                    />
                    <h4 className="font-semibold text-foreground text-sm mb-1">
                      {CHAMPIONSHIP_TYPES[
                        championship.championshipType as keyof typeof CHAMPIONSHIP_TYPES
                      ] || championship.tournamentName}
                    </h4>
                    <div
                      className={`text-lg font-bold mb-1 ${
                        championship.placement === "champion"
                          ? "text-warning"
                          : "text-foreground"
                      }`}
                    >
                      {championship.year}
                    </div>
                    <Chip
                      size="sm"
                      color={
                        championship.placement === "champion"
                          ? "success"
                          : "default"
                      }
                      variant="tertiary"
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
                  className="w-12 h-12 mx-auto mb-3 text-muted"
                />
                <p className="text-muted">No championships yet</p>
              </div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Tournament Wins (Regular Tournaments) */}
      <Card>
        <Card.Header className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:award" className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-semibold">Tournament Wins</h3>
              {!winsLoading && (
                <Chip size="sm" variant="tertiary">
                  {tournamentWins.length}
                </Chip>
              )}
            </div>
          </div>
        </Card.Header>
        <Card.Content>
          {winsLoading ? (
            <div className="space-y-6">
              {[2024, 2023].map((year) => (
                <div key={year} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-6 w-12 rounded" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-3 rounded-lg border bg-surface"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 flex-1 rounded" />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Skeleton className="h-5 w-8 rounded-full" />
                          <Skeleton className="h-4 w-12 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : tournamentWins.length > 0 ? (
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
                  {} as Record<number, typeof tournamentWins>,
                ),
              )
                .sort(([a], [b]) => Number(b) - Number(a)) // Sort years descending
                .map(([year, tournaments]) => (
                  <div key={year} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-lg font-semibold text-accent">
                        {year}
                      </h4>
                      <Chip size="sm" variant="tertiary">
                        {tournaments.length} tournament
                        {tournaments.length !== 1 ? "s" : ""}
                      </Chip>
                    </div>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {tournaments.map((tournament) => (
                        <div
                          key={tournament.id}
                          className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-surface-secondary/50 bg-surface"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Icon
                              icon="lucide:trophy"
                              className="w-4 h-4 text-accent shrink-0"
                            />
                            <h5 className="font-semibold text-foreground text-sm truncate">
                              {tournament.tournamentName}
                            </h5>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {tournament.position && (
                              <Chip size="sm" variant="tertiary">
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
                className="w-16 h-16 mx-auto mb-4 text-muted"
              />
              <h4 className="text-lg font-medium text-foreground mb-2">
                No tournament wins yet
              </h4>
              <p className="text-muted">
                Check back later for tournament victories!
              </p>
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Current Registration Status */}
      <Card>
        <Card.Header className="pb-2">
          <div className="flex items-center gap-2">
            <Icon
              icon="lucide:calendar-check"
              className="w-5 h-5 text-accent"
            />
            <h3 className="text-lg font-semibold">
              Current Registration Status
            </h3>
            {!registrationsLoading && userRegistrations.length > 0 && (
              <Chip size="sm" variant="tertiary">
                {userRegistrations.length}
              </Chip>
            )}
          </div>
        </Card.Header>
        <Card.Content>
          {registrationsLoading ? (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-4 w-28 rounded" />
                  <div className="space-y-1.5 pt-1">
                    <Skeleton className="h-7 w-full rounded" />
                    <Skeleton className="h-7 w-full rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : userRegistrations.length === 0 ? (
            <div className="text-center py-8">
              <Icon
                icon="lucide:calendar-x"
                className="w-12 h-12 mx-auto mb-3 text-muted"
              />
              <p className="text-muted">
                Not registered for any upcoming tournaments
              </p>
            </div>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {userRegistrations.map((r) => {
                const { registration, tournament } = r;
                const maxPlayers = tournament.players ?? 1;
                const openSpots = Math.max(
                  0,
                  maxPlayers - registration.team.length,
                );
                const showOpenSpots =
                  registration.openSpotsOptIn === true && openSpots > 0;
                const regDate = registration.registeredAt;
                const dateStr = regDate
                  ? `Registered ${regDate.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`
                  : "";
                const tournamentDateStr = tournament.date.toLocaleDateString(
                  "en-US",
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  },
                );

                return (
                  <RouterLink
                    key={tournament.firestoreId}
                    to={`/tournaments/${tournament.firestoreId}`}
                    className="block"
                    aria-label={`View details for ${tournament.title}`}
                  >
                    <Card className="border hover:border-accent/40 transition-colors">
                      <Card.Header className="pb-1">
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">
                            {tournament.title}
                          </p>
                          <Icon
                            icon="lucide:chevron-right"
                            className="w-4 h-4 text-muted shrink-0"
                            aria-hidden="true"
                          />
                        </div>
                        <p className="text-xs text-muted">
                          {tournamentDateStr}
                        </p>
                      </Card.Header>
                      <Card.Content className="pt-0 pb-2 px-2">
                        <TeamRegistrationCard
                          teamNumber={1}
                          displayTeam={registration.team}
                          leaderId={registration.ownerId}
                          isWaitlisted={false}
                          openSpots={openSpots}
                          showOpenSpots={showOpenSpots}
                          dateStr={dateStr}
                          maxPlayers={maxPlayers}
                          usersMap={usersMap}
                        />
                      </Card.Content>
                    </Card>
                  </RouterLink>
                );
              })}
            </div>
          )}
        </Card.Content>
      </Card>

      {/* Edit Profile Modal */}
      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
        <Modal.Container size="lg" placement="top">
          <Modal.Dialog>
            <>
              <Modal.Header className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">Edit Profile</h2>
                <p className="text-sm text-muted">
                  Update your profile information and settings
                </p>
              </Modal.Header>
              <Modal.Body>
                <div className="h-full overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <ProfileForm
                    hideActions
                    formId="profile-edit-form"
                    onSaved={() => onOpenChange(false)}
                  />
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="tertiary" onPress={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" form="profile-edit-form">
                  Save
                </Button>
              </Modal.Footer>
            </>
          </Modal.Dialog>
        </Modal.Container>{" "}
      </Modal.Backdrop>
    </div>
  );
};

export default UserProfilePage;
