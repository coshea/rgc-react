import { useParams, Navigate, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Skeleton,
  Link,
} from "@heroui/react";
import { button as buttonStyles } from "@heroui/theme";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import { UserAvatar } from "@/components/avatar";
import BackButton from "@/components/back-button";
import { ProfileForm } from "@/components/profile-form";
import { useAuth } from "@/providers/AuthProvider";
import { useUserById } from "@/hooks/useUserById";
import {
  useUserChampionships,
  useUserTournamentWins,
  useUserWinnings,
} from "@/hooks/useUserTournaments";
import { CHAMPIONSHIP_TYPES } from "@/types/championship";
import { BOARD_ROLE_META, formatBoardRoleLabel } from "@/types/roles";
import { toDate } from "@/api/users";

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { user: profileUser, isLoading: userLoading } = useUserById(userId);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  // Check if the current user is viewing their own profile
  const isOwnProfile = currentUser?.uid === userId;

  // Fetch championships and tournament wins separately (lazy loaded)
  const { data: championships = [], isLoading: championshipsLoading } =
    useUserChampionships(userId);
  const { data: tournamentWins = [], isLoading: winsLoading } =
    useUserTournamentWins(userId);
  const { data: winnings, isLoading: winningsLoading } =
    useUserWinnings(userId);

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
        <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
          <CardBody className="p-8">
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
          </CardBody>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tournament Winnings Skeleton */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-32 rounded" />
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-center space-y-2">
                <Skeleton className="h-8 w-24 mx-auto rounded" />
                <Skeleton className="h-4 w-20 mx-auto rounded" />
              </div>

              <Divider />

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
            </CardBody>
          </Card>

          {/* Championships Skeleton */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-24 rounded" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center p-3 rounded-lg bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20 text-center"
                  >
                    <Skeleton className="w-8 h-8 rounded mb-2" />
                    <Skeleton className="h-4 w-20 mb-1 rounded" />
                    <Skeleton className="h-6 w-12 mb-1 rounded" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Tournament Wins Skeleton */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="w-5 h-5 rounded" />
                <Skeleton className="h-6 w-28 rounded" />
                <Skeleton className="h-5 w-8 rounded-full" />
              </div>
            </div>
          </CardHeader>
          <CardBody>
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
                        className="flex items-center justify-between p-3 rounded-lg border bg-content1 border-default-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 flex-1 rounded" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Skeleton className="h-5 w-8 rounded-full" />
                          <Skeleton className="h-4 w-12 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
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
          <CardBody>
            <Icon
              icon="lucide:user-x"
              className="w-16 h-16 mx-auto mb-4 text-default-400"
            />
            <h2 className="text-xl font-semibold mb-2">User Not Found</h2>
            <p className="text-default-600 mb-4">
              The user profile you're looking for doesn't exist.
            </p>
            <Link
              href={siteConfig.pages.directory.link}
              className={buttonStyles({ color: "primary", variant: "flat" })}
            >
              Browse Member Directory
            </Link>
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
      {/* Back Button and Edit Profile */}
      <div className="flex items-center justify-between">
        <BackButton />

        {isOwnProfile && (
          <Button
            color="primary"
            variant="flat"
            size="sm"
            startContent={<Icon icon="lucide:edit" className="w-4 h-4" />}
            onPress={() => {
              if (window.matchMedia("(max-width: 640px)").matches) {
                navigate("/profile/edit");
                return;
              }
              onOpen();
            }}
          >
            Edit Profile
          </Button>
        )}
      </div>

      {/* Profile Header */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
        <CardBody className="p-8">
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
                      variant="flat"
                      size="sm"
                      startContent={
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
                          className="w-3 h-3"
                        />
                      }
                    >
                      {formatBoardRoleLabel(profileUser.role)}
                    </Chip>
                  )}
                  {!championshipsLoading && majorChampionships.length > 0 && (
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

                {/* Member since display */}
                {profileUser.createdAt && (
                  <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-default-600">
                    <Icon icon="lucide:calendar" className="w-4 h-4" />
                    <span>
                      Member since{" "}
                      {toDate(profileUser.createdAt)?.getFullYear() ||
                        "Unknown"}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                {profileUser.email && (
                  <div className="flex items-center gap-2">
                    <Icon icon="lucide:mail" className="w-4 h-4 text-primary" />
                    <span className="text-default-700">
                      {profileUser.email}
                    </span>
                  </div>
                )}
                {profileUser.phone && (
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="lucide:phone"
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-default-700">
                      {profileUser.phone}
                    </span>
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
            {winningsLoading ? (
              <>
                <div className="text-center space-y-2">
                  <Skeleton className="h-8 w-24 mx-auto rounded" />
                  <Skeleton className="h-4 w-20 mx-auto rounded" />
                </div>
                <Divider />
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
                  <p className="text-sm text-default-600">Lifetime Winnings</p>
                </div>

                <Divider />

                <div className="text-center space-y-2">
                  <div className="text-xl font-semibold text-primary">
                    ${currentYearWinnings.toLocaleString()}
                  </div>
                  <p className="text-sm text-default-600">
                    {currentYear} Winnings
                  </p>
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
              </>
            )}
          </CardBody>
        </Card>

        {/* Championships */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:crown" className="w-5 h-5 text-warning" />
              <h3 className="text-lg font-semibold">Championships</h3>
              {!championshipsLoading && (
                <Chip size="sm" color="warning" variant="flat">
                  {majorChampionships.length}
                </Chip>
              )}
            </div>
          </CardHeader>
          <CardBody>
            {championshipsLoading ? (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center p-3 rounded-lg bg-gradient-to-r from-default/10 to-default/5 border border-default/20 text-center"
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
                        ? "bg-gradient-to-r from-warning/10 to-warning/5 border border-warning/20"
                        : "bg-gradient-to-r from-default/10 to-default/5 border border-default/20"
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
                          : "text-default-500"
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
                          : "text-default-700"
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
              {!winsLoading && (
                <Chip size="sm" color="primary" variant="flat">
                  {tournamentWins.length}
                </Chip>
              )}
            </div>
          </div>
        </CardHeader>
        <CardBody>
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
                        className="flex items-center justify-between p-3 rounded-lg border bg-content1 border-default-200"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Skeleton className="w-4 h-4 rounded" />
                          <Skeleton className="h-4 flex-1 rounded" />
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="2xl"
        shouldBlockScroll={false}
        placement="top-center"
        classNames={{
          // Mobile: cap height so the body can scroll (keyboard-safe in practice).
          // Desktop: keep a centered dialog feel.
          wrapper: "items-start pt-6 sm:items-center sm:pt-0",
          base: "mx-3 my-3 w-[calc(100%-1.5rem)] max-h-[85vh] max-h-[85svh] max-h-[85dvh] sm:max-h-[90vh] sm:max-w-2xl flex flex-col overflow-hidden",
          header: "shrink-0",
          body: "flex-1 min-h-0 overflow-hidden p-0",
          footer: "shrink-0 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
        }}
      >
        <ModalContent>
          {() => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold">Edit Profile</h2>
                <p className="text-sm text-default-500">
                  Update your profile information and settings
                </p>
              </ModalHeader>
              <ModalBody>
                <div className="h-full overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <ProfileForm
                    hideActions
                    formId="profile-edit-form"
                    onSaved={() => onOpenChange()}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={() => onOpenChange()}>
                  Cancel
                </Button>
                <Button color="primary" type="submit" form="profile-edit-form">
                  Save
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default UserProfilePage;
