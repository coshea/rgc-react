import React from "react";
import {
  useParams,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { Button, Card, Link, Skeleton, Tabs } from "@heroui/react";
import { Icon } from "@iconify/react";
import { siteConfig } from "@/config/site";
import BackButton from "@/components/back-button";
import { useAuth } from "@/providers/AuthProvider";
import { useUserById } from "@/hooks/useUserById";
import {
  useUserChampionships,
  useUserTournamentWins,
  useUserWinnings,
  useUserRegistrations,
} from "@/hooks/useUserTournaments";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useUsersMap } from "@/hooks/useUsers";
import { ProfileSummaryCard } from "@/components/profile/profile-summary-card";
import { ProfileStats } from "@/components/profile/profile-stats";
import { ProfileChampionships } from "@/components/profile/profile-championships";
import { RecentWins, WinsByYear } from "@/components/profile/profile-wins";
import { WinningsByYear } from "@/components/profile/profile-winnings-by-year";
import {
  NextRegistration,
  RegistrationList,
} from "@/components/profile/profile-registrations";

const PROFILE_TABS = {
  overview: "overview",
  wins: "wins",
  upcoming: "upcoming",
} as const;
type ProfileTab = (typeof PROFILE_TABS)[keyof typeof PROFILE_TABS];

function toProfileTab(value: string | null): ProfileTab {
  return value === PROFILE_TABS.wins || value === PROFILE_TABS.upcoming
    ? value
    : PROFILE_TABS.overview;
}

function SectionCard({
  title,
  icon,
  iconClass,
  action,
  children,
}: {
  title: string;
  icon?: string;
  iconClass?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-3 p-4 sm:p-5">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          {icon && (
            <Icon
              icon={icon}
              className={`h-4.5 w-4.5 ${iconClass ?? ""}`}
              aria-hidden="true"
            />
          )}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-4 sm:p-6">
      <Skeleton className="h-10 w-20 rounded-lg" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <Skeleton className="h-56 w-full rounded-2xl lg:w-80" />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = toProfileTab(searchParams.get("tab"));
  const { user: currentUser } = useAuth();
  const { user: profileUser, isLoading: userLoading } = useUserById(userId);

  const isOwnProfile = currentUser?.uid === userId;

  // Tournament data loads lazily after the basic profile renders.
  const { data: championships = [], isLoading: championshipsLoading } =
    useUserChampionships(userId);
  const { data: tournamentWins = [], isLoading: winsLoading } =
    useUserTournamentWins(userId);
  const { data: winnings, isLoading: winningsLoading } =
    useUserWinnings(userId);
  const {
    data: userRegistrations = [],
    isLoading: registrationsLoading,
    isError: registrationsError,
    refetch: refetchRegistrations,
  } = useUserRegistrations(userId);
  const { usersMap } = useUsersMap();

  usePageTracking(profileUser?.displayName || `User ${userId}`, userLoading);

  const setTab = React.useCallback(
    (key: string | number) => {
      setSearchParams({ tab: String(key) }, { replace: true });
    },
    [setSearchParams],
  );

  if (userLoading) return <ProfileSkeleton />;

  if (!userId) {
    return <Navigate to={siteConfig.pages.directory.link} replace />;
  }

  if (!profileUser) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Card className="py-12 text-center">
          <Card.Content>
            <Icon
              icon="lucide:user-x"
              className="mx-auto mb-4 h-16 w-16 text-muted"
            />
            <h2 className="mb-2 text-xl font-semibold">User Not Found</h2>
            <p className="mb-4 text-foreground">
              The user profile you're looking for doesn't exist.
            </p>
            <Link
              href={siteConfig.pages.directory.link}
              className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition-colors hover:bg-default/60"
            >
              Browse Member Directory
            </Link>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const currentYearWinnings =
    winnings?.yearly.find((w) => w.year === currentYear)?.amount ?? 0;
  const lastYearWinnings = winnings?.yearly.find(
    (w) => w.year === currentYear - 1,
  )?.amount;
  const currentYearWinCount = tournamentWins.filter(
    (w) => w.year === currentYear,
  ).length;
  const championCount = championships.filter(
    (c) => c.placement === "champion",
  ).length;
  const registrationsState = {
    registrations: userRegistrations,
    isLoading: registrationsLoading,
    isError: registrationsError,
    onRetry: () => void refetchRegistrations(),
  };

  const tabLabel = (label: string, count: number) =>
    count > 0 ? `${label} (${count})` : label;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <BackButton />
        {isOwnProfile && (
          <Button
            isIconOnly
            variant="ghost"
            aria-label="Notification settings"
            className="h-11 w-11 lg:hidden"
            onPress={() => navigate(siteConfig.pages.notificationSettings.link)}
          >
            <Icon icon="lucide:bell" className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <aside className="lg:w-80 lg:shrink-0">
          <ProfileSummaryCard user={profileUser} isOwnProfile={isOwnProfile} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <ProfileStats
            stats={[
              {
                label: "Lifetime winnings",
                value: winnings?.lifetime ?? 0,
                isCurrency: true,
                tone: "text-success",
                isLoading: winningsLoading,
              },
              {
                label: `${currentYear} winnings`,
                value: currentYearWinnings,
                isCurrency: true,
                isLoading: winningsLoading,
                trend:
                  lastYearWinnings !== undefined
                    ? {
                        delta: currentYearWinnings - lastYearWinnings,
                        label: `vs ${currentYear - 1}`,
                      }
                    : undefined,
              },
              {
                label: "Tournament wins",
                value: tournamentWins.length,
                isLoading: winsLoading,
              },
              {
                label: "Championships",
                value: championCount,
                tone: "text-warning",
                isLoading: championshipsLoading,
              },
            ]}
          />

          <Tabs selectedKey={activeTab} onSelectionChange={setTab}>
            <Tabs.ListContainer>
              <Tabs.List aria-label="Profile sections" className="w-full">
                <Tabs.Tab id={PROFILE_TABS.overview} className="h-11 flex-1">
                  Overview
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id={PROFILE_TABS.wins} className="h-11 flex-1">
                  {tabLabel("Wins", winsLoading ? 0 : tournamentWins.length)}
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id={PROFILE_TABS.upcoming} className="h-11 flex-1">
                  {tabLabel(
                    "Upcoming",
                    registrationsLoading ? 0 : userRegistrations.length,
                  )}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id={PROFILE_TABS.overview} className="pt-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="flex flex-col gap-4">
                  <SectionCard
                    title="Next up"
                    icon="lucide:calendar-check"
                    iconClass="text-accent"
                    action={
                      userRegistrations.length > 1 ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11"
                          onPress={() => setTab(PROFILE_TABS.upcoming)}
                        >
                          See all {userRegistrations.length}
                        </Button>
                      ) : undefined
                    }
                  >
                    <NextRegistration
                      profileId={profileUser.id}
                      {...registrationsState}
                    />
                  </SectionCard>
                  <SectionCard
                    title="Championships"
                    icon="lucide:crown"
                    iconClass="text-warning"
                  >
                    <ProfileChampionships
                      championships={championships}
                      isLoading={championshipsLoading}
                    />
                  </SectionCard>
                </div>
                <div className="flex flex-col gap-4">
                  <SectionCard
                    title="Recent wins"
                    icon="lucide:trophy"
                    iconClass="text-success"
                    action={
                      tournamentWins.length > currentYearWinCount ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-11"
                          onPress={() => setTab(PROFILE_TABS.wins)}
                        >
                          See all {tournamentWins.length}
                        </Button>
                      ) : undefined
                    }
                  >
                    <RecentWins
                      wins={tournamentWins}
                      isLoading={winsLoading}
                      year={currentYear}
                    />
                  </SectionCard>
                  <SectionCard title="Winnings by year">
                    <WinningsByYear
                      winnings={winnings}
                      isLoading={winningsLoading}
                    />
                  </SectionCard>
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel id={PROFILE_TABS.wins} className="pt-4">
              <Card className="p-4 sm:p-5">
                <WinsByYear wins={tournamentWins} isLoading={winsLoading} />
              </Card>
            </Tabs.Panel>

            <Tabs.Panel id={PROFILE_TABS.upcoming} className="pt-4">
              <RegistrationList {...registrationsState} usersMap={usersMap} />
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
