import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  onTournament,
  onTournamentRegistrations,
  mapTournamentDoc,
  deleteTournament as apiDeleteTournament,
} from "@/api/tournaments";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Divider,
  ScrollShadow,
  Tooltip,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { UserAvatar } from "@/components/avatar";
import BackButton from "@/components/back-button";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus } from "@/utils/tournamentStatus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TeeBadge } from "@/components/tee-badge";
const TournamentEditor = React.lazy(() =>
  import("@/components/tournament-editor").then((m) => ({
    default: m.TournamentEditor,
  }))
);
import GroupedWinners from "@/components/grouped-winners";
// User types consumed indirectly; no direct import needed after hook migration
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import { WinnerDisplay } from "@/components/winner-display";
import { getWeatherIcon } from "@/utils/weather";

interface RegistrationDoc {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string }>;
  registeredAt?: any;
}

const TournamentDetailPage: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [previousTournament, setPreviousTournament] =
    React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [regsLoading, setRegsLoading] = React.useState(true);
  const [registrations, setRegistrations] = React.useState<RegistrationDoc[]>(
    []
  );
  const [showNeedingPlayers, setShowNeedingPlayers] = React.useState(false);
  const { usersMap } = useUsersMap();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const userId = user?.uid;

  const isUserRegistered = React.useMemo(() => {
    if (!userId) return false;
    return registrations.some(
      (r) =>
        r.ownerId === userId ||
        (Array.isArray(r.team) && r.team.some((m) => m.id === userId))
    );
  }, [registrations, userId]);

  // Load tournament document (real-time)
  React.useEffect(() => {
    if (!firestoreId) return;
    setLoading(true);
    const unsub = onTournament(
      firestoreId,
      (snap: any) => {
        if (!snap.exists?.()) {
          addToast({
            title: "Not found",
            description: "Tournament not found",
            color: "danger",
          });
          navigate("/tournaments");
          return;
        }
        setTournament(mapTournamentDoc(snap) as any);
        setLoading(false);
      },
      (err) => {
        console.error(err);
        addToast({
          title: "Error",
          description: "Failed to load tournament",
          color: "danger",
        });
        setLoading(false);
      }
    );
    return () => unsub();
  }, [firestoreId, navigate]);

  React.useEffect(() => {
    if (!firestoreId) return;
    setRegsLoading(true);
    const unsub = onTournamentRegistrations(
      firestoreId,
      (snap: any) => {
        const list: RegistrationDoc[] = snap.docs.map((d: any) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRegistrations(list);
        setRegsLoading(false);
      },
      (err) => {
        console.error("Failed to load registrations", err);
        setRegsLoading(false);
      }
    );
    return () => unsub();
  }, [firestoreId]);

  // Load previous tournament if previousTournamentId is set
  React.useEffect(() => {
    if (!tournament?.previousTournamentId) {
      setPreviousTournament(null);
      return;
    }
    const unsub = onTournament(
      tournament.previousTournamentId,
      (snap: any) => {
        if (!snap.exists()) {
          setPreviousTournament(null);
          return;
        }
        try {
          const prevTournament = mapTournamentDoc(snap);
          setPreviousTournament(prevTournament);
        } catch (err) {
          console.error(err);
          setPreviousTournament(null);
        }
      },
      (err: any) => {
        console.error("Failed to load previous tournament", err);
        setPreviousTournament(null);
      }
    );
    return () => unsub();
  }, [tournament?.previousTournamentId]);

  // Users are now loaded globally via React Query (useUsersMap)

  // Get defending champion(s) from previous tournament
  const defendingChampions = React.useMemo(() => {
    if (!previousTournament) return null;

    // Check for grouped winners
    if ((previousTournament as any)?.winnerGroups?.length) {
      const overallGroup = (previousTournament as any).winnerGroups.find(
        (g: any) => g.type === "overall"
      );
      if (overallGroup?.winners?.length) {
        const firstPlace = overallGroup.winners.find((w: any) => w.place === 1);
        if (firstPlace?.competitors?.length) {
          return {
            competitors: firstPlace.competitors.map((c: any) => ({
              id: c.userId,
              name: c.displayName || "Unknown",
            })),
            score: firstPlace.score,
          };
        }
      }
    }

    return null;
  }, [previousTournament]);

  const formatDateLong = (date: Date) =>
    new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);

  const handleRegister = () => {
    if (!tournament?.firestoreId) return;
    navigate(`/tournaments/${tournament.firestoreId}/register`);
  };

  const toggleShowNeedingPlayers = () => setShowNeedingPlayers((prev) => !prev);

  // Share current tournament link
  const shareLink = async () => {
    if (!tournament?.firestoreId) return;
    const url = `${window.location.origin}/tournaments/${tournament.firestoreId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: tournament.title,
          text: `Check out the ${tournament.title} tournament`,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        addToast({
          title: "Link copied",
          description: "Tournament URL copied to clipboard",
          color: "success",
        });
      }
    } catch (e) {
      console.error("Share failed", e);
      addToast({
        title: "Share failed",
        description: "Could not share link",
        color: "danger",
      });
    }
  };

  // Export registrations as CSV
  const exportRegistrations = () => {
    if (!isAdmin) return;
    if (!registrations.length) {
      addToast({
        title: "No data",
        description: "No registrations to export",
        color: "warning",
      });
      return;
    }
    let maxTeam = 0;
    registrations.forEach((r) => {
      const team = Array.isArray(r.team) ? r.team : [];
      if (team.length > maxTeam) maxTeam = team.length;
    });
    const headers = [
      "registeredDate",
      ...Array.from({ length: maxTeam }, (_, i) => `member${i + 1}`),
    ];
    const rows = registrations.map((r) => {
      const team = Array.isArray(r.team) ? r.team : [];
      const date = r.registeredAt?.toDate
        ? new Date(r.registeredAt.toDate()).toISOString()
        : "";
      const memberNames = team.map((m) => m.displayName || m.id || "");
      while (memberNames.length < maxTeam) memberNames.push("");
      return [date, ...memberNames];
    });
    const csvLines = [headers, ...rows].map((line) =>
      line.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(",")
    );
    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tournament?.title || "tournament"}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditSave = (_updated: Tournament) => {
    // We rely on Firestore listener to update UI. Just close modal.
    setEditOpen(false);
  };

  const handleDelete = async () => {
    if (!isAdmin || !tournament?.firestoreId) return;
    setDeleting(true);
    try {
      await apiDeleteTournament(tournament.firestoreId);
      addToast({
        title: "Deleted",
        description: "Tournament removed.",
        color: "danger",
      });
      navigate("/tournaments");
    } catch (e) {
      console.error("Delete failed", e);
      addToast({
        title: "Error",
        description: "Failed to delete tournament.",
        color: "danger",
      });
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto pt-4 pb-10 px-4 overflow-x-hidden">
      {loading || !tournament ? (
        <div className="flex flex-col items-center py-24 gap-4">
          <Icon
            icon="lucide:loader"
            className="animate-spin text-4xl text-primary"
          />
          <p className="text-foreground-500">Loading tournament...</p>
        </div>
      ) : (
        <>
          {/* Top navigation row: Back link on the far left */}
          <div className="mb-3">
            {/* Mobile: Two rows, Desktop: Single row */}
            <div className="md:hidden space-y-2">
              {/* Mobile First row: Back button and Share button */}
              <div className="flex items-center justify-between">
                <BackButton
                  onPress={() => navigate("/tournaments", { replace: false })}
                />
                <Tooltip content="Share tournament">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={shareLink}
                    startContent={<Icon icon="lucide:share" />}
                    aria-label="Share tournament"
                  >
                    Share
                  </Button>
                </Tooltip>
              </div>

              {/* Mobile Second row: Admin actions */}
              {isAdmin && (
                <div className="flex items-center justify-end gap-2">
                  <Tooltip content="Export registrations">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={exportRegistrations}
                      startContent={<Icon icon="lucide:download" />}
                      aria-label="Export registrations"
                    >
                      Export
                    </Button>
                  </Tooltip>
                  <Tooltip content="Edit tournament">
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={() => setEditOpen(true)}
                      startContent={<Icon icon="lucide:edit" />}
                      aria-label="Edit tournament"
                    >
                      Edit
                    </Button>
                  </Tooltip>
                  <Tooltip content="Delete tournament">
                    <Button
                      size="sm"
                      variant="flat"
                      color="danger"
                      onPress={() => setDeleteConfirm(true)}
                      startContent={<Icon icon="lucide:trash-2" />}
                      aria-label="Delete tournament"
                    >
                      Delete
                    </Button>
                  </Tooltip>
                </div>
              )}
            </div>

            {/* Desktop: Single row with all buttons */}
            <div className="hidden md:flex items-center justify-between">
              <BackButton
                onPress={() => navigate("/tournaments", { replace: false })}
              />
              <div className="flex items-center gap-3">
                <Tooltip content="Share tournament">
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={shareLink}
                    startContent={<Icon icon="lucide:share" />}
                    aria-label="Share tournament"
                  >
                    Share
                  </Button>
                </Tooltip>

                {isAdmin && (
                  <div className="flex items-center gap-2 pl-2 border-l border-divider">
                    <Tooltip content="Export registrations">
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={exportRegistrations}
                        startContent={<Icon icon="lucide:download" />}
                        aria-label="Export registrations"
                      >
                        Export
                      </Button>
                    </Tooltip>
                    <Tooltip content="Edit tournament">
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => setEditOpen(true)}
                        startContent={<Icon icon="lucide:edit" />}
                        aria-label="Edit tournament"
                      >
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete tournament">
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => setDeleteConfirm(true)}
                        startContent={<Icon icon="lucide:trash-2" />}
                        aria-label="Delete tournament"
                      >
                        Delete
                      </Button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Title & meta section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-3 leading-tight">
              {tournament.title}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-foreground-500">
              <span className="flex items-center gap-1">
                <Icon icon="lucide:calendar" className="w-4 h-4" />
                {formatDateLong(tournament.date)}
              </span>
              <span className="flex items-center gap-1">
                <Icon icon="lucide:trophy" className="w-4 h-4" />
                Prize Pool: ${tournament.prizePool.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Icon icon="lucide:users" className="w-4 h-4" />
                Players: {tournament.players}
              </span>
              <TeeBadge
                tee={tournament.tee}
                size="xs"
                ariaLabel={`${tournament.tee || "Mixed"} tee designation`}
              />
              {getStatus(tournament) === TournamentStatus.Open && (
                <Chip color="warning" size="sm" variant="flat">
                  Registration Open
                </Chip>
              )}
              {getStatus(tournament) === TournamentStatus.Completed && (
                <Chip color="default" size="sm" variant="flat">
                  Completed
                </Chip>
              )}
              {getStatus(tournament) === TournamentStatus.InProgress && (
                <Chip color="primary" size="sm" variant="flat">
                  In Progress
                </Chip>
              )}
              {getStatus(tournament) === TournamentStatus.Canceled && (
                <Chip color="danger" size="sm" variant="flat">
                  Canceled
                </Chip>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Left Column: Overview */}
            <Card className="md:col-span-2" shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Overview</h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                {tournament.detailsMarkdown ? (
                  <div className="prose dark:prose-invert max-w-none text-sm">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {tournament.detailsMarkdown}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <p className="leading-relaxed text-foreground-600 whitespace-pre-line">
                    {tournament.description}
                  </p>
                )}
              </CardBody>
            </Card>

            {/* Right Column: Key Facts */}
            <div className="space-y-6">
              <Card shadow="sm">
                <CardHeader className="pb-0">
                  <h2 className="text-lg font-semibold">Key Facts</h2>
                </CardHeader>
                <Divider />
                <CardBody className="pt-4 space-y-5 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <Icon icon="lucide:calendar" className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-medium">Date</p>
                        <p>{formatDateLong(tournament.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon icon="lucide:trophy" className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-medium">Prize Pool</p>
                        <p>${tournament.prizePool.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon icon="lucide:users" className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-medium">Players On A Team</p>
                        <p>{tournament.players}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon icon="lucide:flag" className="w-4 h-4 mt-0.5" />
                      <div>
                        <p className="font-medium">Tee</p>
                        <p>
                          <TeeBadge
                            tee={tournament.tee as any}
                            size="xs"
                            ariaLabel={`Tournament tee: ${tournament.tee || "Mixed"}`}
                          />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Icon
                        icon="lucide:check-circle"
                        className="w-4 h-4 mt-0.5"
                      />
                      <div>
                        <p className="font-medium">Status</p>
                        <p>
                          {(() => {
                            const s = getStatus(tournament);
                            return s === TournamentStatus.Canceled
                              ? "Canceled"
                              : s === TournamentStatus.Completed
                                ? "Completed"
                                : s === TournamentStatus.InProgress
                                  ? "In Progress"
                                  : s === TournamentStatus.Open
                                    ? "Registration Open"
                                    : "Scheduled";
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Weather Card - Only show if weather data exists */}
              {tournament.weather && (
                <Card shadow="sm">
                  <CardHeader className="pb-0">
                    <div className="flex items-center gap-2">
                      <Icon
                        icon={getWeatherIcon(tournament.weather.condition)}
                        className="w-5 h-5"
                      />
                      <h2 className="text-lg font-semibold">
                        Tournament Day Weather
                      </h2>
                    </div>
                  </CardHeader>
                  <Divider />
                  <CardBody className="pt-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-1">
                        <p className="text-foreground-500 text-xs uppercase tracking-wide">
                          Condition
                        </p>
                        <p className="font-semibold text-base">
                          {tournament.weather.condition}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-foreground-500 text-xs uppercase tracking-wide">
                          Temperature
                        </p>
                        <p className="font-semibold text-base">
                          {tournament.weather.temperature}°F
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-foreground-500 text-xs uppercase tracking-wide">
                          Wind Speed
                        </p>
                        <p className="font-semibold text-base">
                          {tournament.weather.windSpeed} mph
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-foreground-500 text-xs uppercase tracking-wide">
                          Precipitation
                        </p>
                        <p className="font-semibold text-base">
                          {tournament.weather.precipitation}"
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              )}

              <Card shadow="sm">
                <CardHeader className="pb-0">
                  <h2 className="text-lg font-semibold">Registration</h2>
                </CardHeader>
                <Divider />
                <CardBody className="pt-4 space-y-4">
                  {getStatus(tournament) === TournamentStatus.Open ? (
                    <>
                      {isUserRegistered ? (
                        <>
                          <p className="text-sm text-foreground-600 flex items-center gap-1">
                            <Icon
                              icon="lucide:check-circle"
                              className="w-4 h-4 text-success"
                            />
                            You're registered for this tournament.
                          </p>
                          <Button
                            color="success"
                            variant="flat"
                            fullWidth
                            isDisabled
                            startContent={
                              <Icon icon="lucide:check" className="w-4 h-4" />
                            }
                            aria-label="Already registered"
                          >
                            Registered
                          </Button>
                          <Button
                            fullWidth
                            size="sm"
                            variant="ghost"
                            onPress={handleRegister}
                            aria-label="View or edit your registration"
                          >
                            View / Edit Registration
                          </Button>
                        </>
                      ) : user ? (
                        <>
                          <p className="text-sm text-foreground-600">
                            Ready to compete? Register your team now before
                            spots fill up.
                          </p>
                          <Button
                            color="primary"
                            fullWidth
                            onPress={handleRegister}
                          >
                            Register
                          </Button>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground-600">
                            Sign in to register your team.
                          </p>
                          <Button color="primary" fullWidth isDisabled>
                            Register
                          </Button>
                          <p className="text-xs text-foreground-500">
                            Sign in required to register.
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-foreground-500">
                      Registration is currently closed.
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Defending Champions Section */}
          {(defendingChampions && defendingChampions.competitors.length > 0) ||
          (isAdmin && tournament.previousTournamentId) ? (
            <div className="mb-12">
              <Card className="md:col-span-2" shadow="sm">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <Icon
                      icon="lucide:trophy"
                      className="w-5 h-5 text-warning-500"
                    />
                    <h2 className="text-lg font-semibold">
                      Defending Champion
                    </h2>
                  </div>
                </CardHeader>
                <Divider />
                <CardBody className="pt-4">
                  {defendingChampions &&
                  defendingChampions.competitors.length > 0 ? (
                    <>
                      <p className="text-sm text-foreground-600 mb-3">
                        {previousTournament?.date.getFullYear()} Winner
                        {defendingChampions.competitors.length > 1 ? "s" : ""}
                      </p>
                      <WinnerDisplay
                        place={1}
                        competitors={defendingChampions.competitors.map(
                          (c: { id: string; name: string }) => ({
                            userId: c.id,
                            displayName: c.name,
                          })
                        )}
                        score={defendingChampions.score}
                        isChampion={true}
                      />
                    </>
                  ) : (
                    <p className="text-sm text-foreground-500 italic">
                      Previous tournament linked but no winners recorded yet.
                    </p>
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}

          <div className="mb-12">
            <Card shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Tournament Winners</h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                <GroupedWinners
                  groups={(tournament as any).winnerGroups || []}
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-24 md:mb-16">
            {/* Full Width: Registered Teams (Improved readability) */}
            <Card className="md:col-span-3" shadow="sm">
              <CardHeader className="pb-0 flex flex-wrap items-center justify-between gap-2 overflow-visible relative">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Registered Teams
                  {!regsLoading && registrations.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {registrations.length}
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-3 flex-wrap pb-1">
                  {!regsLoading && registrations.length > 0 && (
                    <Button
                      size="sm"
                      variant={showNeedingPlayers ? "solid" : "flat"}
                      color={showNeedingPlayers ? "warning" : "default"}
                      onPress={toggleShowNeedingPlayers}
                      aria-pressed={showNeedingPlayers}
                      aria-label="Toggle show teams needing players"
                      className="px-2 h-7 text-xs sm:text-tiny"
                    >
                      {showNeedingPlayers
                        ? "Showing Open Teams"
                        : "Show Open Teams"}
                    </Button>
                  )}
                  {!regsLoading && registrations.length > 0 && (
                    <span
                      className="inline-flex items-center group relative"
                      aria-label="Registrations update in real time"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-success animate-pulse mr-2"
                        aria-hidden="true"
                      />
                      <button
                        type="button"
                        className="text-[11px] text-foreground-400 underline decoration-dotted underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary/60 rounded-sm"
                        aria-label="Real-time updates info"
                        onFocus={(e) =>
                          e.currentTarget.setAttribute("data-focus", "true")
                        }
                        onBlur={(e) =>
                          e.currentTarget.removeAttribute("data-focus")
                        }
                      >
                        Live
                      </button>
                      <span
                        role="tooltip"
                        className="pointer-events-none opacity-0 group-hover:opacity-100 group-[&_:focus[data-focus]]:opacity-100 transition-opacity absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50 bg-content2 text-foreground text-[10px] px-2 py-1 rounded-md shadow-sm border border-default-200 whitespace-nowrap drop-shadow-lg"
                      >
                        Updates in real time as teams register.
                      </span>
                    </span>
                  )}
                </div>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                {regsLoading ? (
                  <p className="text-sm text-foreground-500">
                    Loading registrations...
                  </p>
                ) : registrations.length === 0 ? (
                  <p className="text-sm text-foreground-500">
                    No teams registered yet.
                  </p>
                ) : (
                  <ScrollShadow className="md:max-h-80 pr-1">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {registrations
                        .filter((reg) => {
                          if (!showNeedingPlayers || !tournament) return true;
                          const team = Array.isArray(reg.team) ? reg.team : [];
                          return (
                            team.length < (tournament.players || team.length)
                          );
                        })
                        .map((reg) => {
                          const originalIdx = registrations.findIndex(
                            (r) => r.id === reg.id
                          );
                          const team = Array.isArray(reg.team) ? reg.team : [];
                          const dateStr = reg.registeredAt?.toDate
                            ? new Date(
                                reg.registeredAt.toDate()
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "";
                          const maxPlayers = tournament.players || team.length;
                          const openSpots = Math.max(
                            maxPlayers - team.length,
                            0
                          );
                          return (
                            <div
                              key={reg.id}
                              className={`rounded-md border transition-colors p-3 flex flex-col h-full gap-2 relative group ${
                                openSpots > 0
                                  ? "border-warning/60 bg-warning/5 hover:bg-warning/10"
                                  : "border-default-200 bg-content2/60 hover:bg-content2"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex -space-x-2">
                                  {team.map((m, i) => {
                                    const memberUser = usersMap.get(m.id);
                                    const label = (
                                      m.displayName ||
                                      m.id ||
                                      ""
                                    ).toString();
                                    return (
                                      <UserAvatar
                                        key={m.id || i}
                                        size="sm"
                                        user={memberUser}
                                        name={memberUser ? undefined : label}
                                        className="border border-default-200"
                                        alt={label}
                                      />
                                    );
                                  })}
                                  {openSpots > 0 && (
                                    <div
                                      className="w-7 h-7 rounded-full border border-dashed border-warning/60 flex items-center justify-center text-[10px] font-medium text-warning bg-warning/10"
                                      aria-label={`${openSpots} open team spot${openSpots === 1 ? "" : "s"}`}
                                      title={`${openSpots} open spot${openSpots === 1 ? "" : "s"}`}
                                    >
                                      +{openSpots}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] uppercase tracking-wide text-foreground-400 font-medium mb-1">
                                    Team {originalIdx + 1}
                                  </p>
                                  <ul className="text-sm font-medium leading-snug space-y-0.5">
                                    {team.map((m, i) => (
                                      <li key={i} className="truncate">
                                        {m.displayName || m.id}
                                      </li>
                                    ))}
                                  </ul>
                                  {openSpots > 0 && (
                                    <p className="mt-1 text-[11px] font-medium text-warning flex items-center gap-1">
                                      <Icon
                                        icon="lucide:alert-circle"
                                        className="w-3.5 h-3.5"
                                        aria-hidden="true"
                                      />
                                      {openSpots === 1
                                        ? "1 Spot Open"
                                        : `${openSpots} Spots Open`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="mt-auto flex items-center justify-between text-[11px] text-foreground-500 pt-1 border-t border-default-100">
                                <span className="flex items-center gap-1">
                                  <Icon
                                    icon="lucide:calendar-clock"
                                    className="w-3.5 h-3.5"
                                  />
                                  {dateStr}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Icon
                                    icon="lucide:users"
                                    className="w-3.5 h-3.5"
                                  />
                                  {team.length}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </ScrollShadow>
                )}
              </CardBody>
            </Card>
          </div>
        </>
      )}
      {isAdmin && editOpen && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Edit tournament"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setEditOpen(false)}
          />
          {/* Wrapper: mobile fullscreen; desktop centered with max height */}
          <div className="relative z-10 flex h-full w-full md:items-center md:justify-center">
            <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-xl md:shadow-lg md:border md:border-default-200 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
              <div className="flex-1 overflow-y-auto md:rounded-b-xl">
                <React.Suspense
                  fallback={
                    <div className="p-8 flex flex-col items-center gap-3">
                      <Icon
                        icon="lucide:loader"
                        className="animate-spin text-2xl text-primary"
                      />
                      <p className="text-sm text-foreground-500">
                        Loading editor...
                      </p>
                    </div>
                  }
                >
                  <TournamentEditor
                    tournament={tournament}
                    onSave={handleEditSave}
                    onCancel={() => setEditOpen(false)}
                  />
                </React.Suspense>
              </div>
            </div>
          </div>
        </div>
      )}
      {isAdmin && deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => !deleting && setDeleteConfirm(false)}
          />
          <div className="relative z-10 bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-2">Delete Tournament</h3>
            <p className="text-sm text-foreground-500 mb-4">
              Are you sure you want to delete this tournament? This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="flat"
                onPress={() => !deleting && setDeleteConfirm(false)}
                isDisabled={deleting}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                onPress={handleDelete}
                isLoading={deleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentDetailPage;
