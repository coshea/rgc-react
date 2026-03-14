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
  Tooltip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { UserAvatar } from "@/components/avatar";
import BackButton from "@/components/back-button";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import {
  getStatus,
  getRegistrationWindowInfo,
  RegistrationWindowInfo,
  RegistrationWindowState,
} from "@/utils/tournamentStatus";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { TeeBadge } from "@/components/tee-badge";
import { TeamRegistrationCard } from "@/components/team-registration-card";
const TournamentEditor = React.lazy(() =>
  import("@/components/tournament-editor").then((m) => ({
    default: m.TournamentEditor,
  })),
);
import GroupedWinners from "@/components/grouped-winners";
// User types consumed indirectly; no direct import needed after hook migration
import { useUsersMap } from "@/hooks/useUsers";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import { WinnerDisplay } from "@/components/winner-display";
import { getWeatherIcon } from "@/utils/weather";
import {
  getTournamentGoogleCalendarUrl,
  downloadTournamentIcsFile,
} from "@/utils/calendar";

const formatLocalDateTime = (date?: Date) => {
  if (!date) return undefined;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
};

const computeRegistrationWindowCopy = (windowInfo: RegistrationWindowInfo) => {
  switch (windowInfo.state) {
    case RegistrationWindowState.Upcoming:
      if (windowInfo.start) {
        return `Registration opens ${formatLocalDateTime(windowInfo.start)}.`;
      }
      return "Registration opens soon.";
    case RegistrationWindowState.Closed:
      if (windowInfo.end) {
        return `Registration closed ${formatLocalDateTime(windowInfo.end)}.`;
      }
      return "Registration is currently closed.";
    case RegistrationWindowState.Invalid:
      return "Registration window is misconfigured.";
    case RegistrationWindowState.Open:
      return undefined;
    case RegistrationWindowState.Unconfigured:
    default:
      return "Registration is currently closed.";
  }
};

interface RegistrationDoc {
  id: string;
  ownerId?: string;
  team?: Array<{ id: string; displayName?: string }>;
  registeredAt?: any;
  openSpotsOptIn?: boolean;
}

const TournamentDetailPage: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  usePageTracking(tournament?.title, !tournament);
  const [previousTournament, setPreviousTournament] =
    React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [regsLoading, setRegsLoading] = React.useState(true);
  const [registrations, setRegistrations] = React.useState<RegistrationDoc[]>(
    [],
  );
  const [showNeedingPlayers, setShowNeedingPlayers] = React.useState(false);
  const [openTeamModal, setOpenTeamModal] = React.useState(false);
  const [openTeamModalData, setOpenTeamModalData] = React.useState<{
    teamNumber: number;
    leaderId?: string;
    team: Array<{ id: string; displayName?: string }>;
    openSpots: number;
  } | null>(null);
  const { usersMap } = useUsersMap();
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const userId = user?.uid;
  const currentStatus = tournament
    ? getStatus(tournament)
    : TournamentStatus.Upcoming;
  const registrationWindowInfo = React.useMemo(() => {
    return getRegistrationWindowInfo(tournament ?? {});
  }, [tournament]);
  const registrationCopy = computeRegistrationWindowCopy(
    registrationWindowInfo,
  );
  const registrationOpen =
    registrationWindowInfo.state === RegistrationWindowState.Open;

  const isUserRegistered = React.useMemo(() => {
    if (!userId) return false;
    return registrations.some(
      (r) =>
        r.ownerId === userId ||
        (Array.isArray(r.team) && r.team.some((m) => m.id === userId)),
    );
  }, [registrations, userId]);

  const hasOpenTeamSlots = React.useMemo(() => {
    const maxPlayers = tournament?.players;
    if (!maxPlayers || !registrations.length) return false;
    return registrations.some((r) => {
      const team = Array.isArray(r.team) ? r.team : [];
      return r.openSpotsOptIn === true && team.length < maxPlayers;
    });
  }, [registrations, tournament?.players]);

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
        setTournament(mapTournamentDoc(snap));
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
      },
    );
    return () => unsub();
  }, [firestoreId, navigate]);

  React.useEffect(() => {
    if (!firestoreId) return;

    // Only subscribe once authenticated to avoid permission errors.
    if (!userId) {
      setRegistrations([]);
      setRegsLoading(false);
      return;
    }

    setRegsLoading(true);
    const unsub = onTournamentRegistrations(
      firestoreId,
      (snap: any) => {
        const list: RegistrationDoc[] = snap.docs.map((d: any) => {
          const data = d.data() as unknown as Omit<RegistrationDoc, "id">;
          return { id: d.id, ...data };
        });
        setRegistrations(list);
        setRegsLoading(false);
      },
      (err) => {
        console.error("Failed to load registrations", err);
        setRegsLoading(false);
      },
    );
    return () => unsub();
  }, [firestoreId, userId]);

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
      },
    );
    return () => unsub();
  }, [tournament?.previousTournamentId]);

  // Users are now loaded globally via React Query (useUsersMap)

  // Get defending champion(s) from previous tournament
  const defendingChampions = React.useMemo(() => {
    if (!previousTournament) return null;

    // Check for grouped winners
    const groups = previousTournament.winnerGroups;
    if (groups?.length) {
      const overallGroup = groups.find((g) => g.type === "overall");
      if (overallGroup?.winners?.length) {
        const firstPlace = overallGroup.winners.find((w) => w.place === 1);
        if (firstPlace?.competitors?.length) {
          return {
            competitors: firstPlace.competitors.map((c) => ({
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

  const handleCalendarAction = (key: React.Key) => {
    if (!tournament?.firestoreId) return;

    const detailUrl = `${window.location.origin}/tournaments/${tournament.firestoreId}`;

    if (key === "google") {
      const googleUrl = getTournamentGoogleCalendarUrl(tournament, detailUrl);
      window.open(googleUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (key === "ics") {
      downloadTournamentIcsFile(tournament, detailUrl);
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
      line.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","),
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
    <>
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
                  <BackButton />
                  <div className="flex items-center gap-2">
                    <Dropdown placement="bottom-end">
                      <DropdownTrigger>
                        <Button
                          size="sm"
                          variant="flat"
                          startContent={<Icon icon="lucide:calendar-plus" />}
                          aria-label="Add tournament to calendar"
                          title="Add tournament to your calendar"
                        >
                          Calendar
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        aria-label="Calendar options"
                        onAction={handleCalendarAction}
                      >
                        <DropdownItem
                          key="google"
                          startContent={<Icon icon="lucide:calendar" />}
                        >
                          Add to Google Calendar
                        </DropdownItem>
                        <DropdownItem
                          key="ics"
                          startContent={<Icon icon="lucide:download" />}
                        >
                          Download calendar file (.ics)
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
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
                </div>

                {/* Mobile Second row: Admin actions */}
                {isAdmin && (
                  <div className="flex items-center justify-end gap-2">
                    <Chip color="secondary" size="sm" variant="flat">
                      Admin only
                    </Chip>
                    <Tooltip content="Export registrations (Admin only)">
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={exportRegistrations}
                        startContent={<Icon icon="lucide:download" />}
                        aria-label="Export registrations (Admin only)"
                      >
                        Export
                      </Button>
                    </Tooltip>
                    <Tooltip content="Edit tournament (Admin only)">
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => setEditOpen(true)}
                        startContent={<Icon icon="lucide:edit" />}
                        aria-label="Edit tournament (Admin only)"
                      >
                        Edit
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete tournament (Admin only)">
                      <Button
                        size="sm"
                        variant="flat"
                        color="danger"
                        onPress={() => setDeleteConfirm(true)}
                        startContent={<Icon icon="lucide:trash-2" />}
                        aria-label="Delete tournament (Admin only)"
                      >
                        Delete
                      </Button>
                    </Tooltip>
                  </div>
                )}
              </div>

              {/* Desktop: Single row with all buttons */}
              <div className="hidden md:flex items-center justify-between">
                <BackButton />
                <div className="flex items-center gap-3">
                  <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                      <Button
                        size="sm"
                        variant="flat"
                        startContent={<Icon icon="lucide:calendar-plus" />}
                        aria-label="Add tournament to calendar"
                        title="Add tournament to your calendar"
                      >
                        Calendar
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      aria-label="Calendar options"
                      onAction={handleCalendarAction}
                    >
                      <DropdownItem
                        key="google"
                        startContent={<Icon icon="lucide:calendar" />}
                      >
                        Add to Google Calendar
                      </DropdownItem>
                      <DropdownItem
                        key="ics"
                        startContent={<Icon icon="lucide:download" />}
                      >
                        Download calendar file (.ics)
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
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
                      <Chip color="secondary" size="sm" variant="flat">
                        Admin only
                      </Chip>
                      <Tooltip content="Export registrations (Admin only)">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={exportRegistrations}
                          startContent={<Icon icon="lucide:download" />}
                          aria-label="Export registrations (Admin only)"
                        >
                          Export
                        </Button>
                      </Tooltip>
                      <Tooltip content="Edit tournament (Admin only)">
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => setEditOpen(true)}
                          startContent={<Icon icon="lucide:edit" />}
                          aria-label="Edit tournament (Admin only)"
                        >
                          Edit
                        </Button>
                      </Tooltip>
                      <Tooltip content="Delete tournament (Admin only)">
                        <Button
                          size="sm"
                          variant="flat"
                          color="danger"
                          onPress={() => setDeleteConfirm(true)}
                          startContent={<Icon icon="lucide:trash-2" />}
                          aria-label="Delete tournament (Admin only)"
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
                {registrationOpen && (
                  <Chip color="warning" size="sm" variant="flat">
                    Registration Open
                  </Chip>
                )}
                {currentStatus === TournamentStatus.Completed && (
                  <Chip color="default" size="sm" variant="flat">
                    Completed
                  </Chip>
                )}
                {currentStatus === TournamentStatus.InProgress && (
                  <Chip color="primary" size="sm" variant="flat">
                    In Progress
                  </Chip>
                )}
                {currentStatus === TournamentStatus.Canceled && (
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
                        <Icon
                          icon="lucide:calendar"
                          className="w-4 h-4 mt-0.5"
                        />
                        <div>
                          <p className="font-medium">Date</p>
                          <p>{formatDateLong(tournament.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Icon icon="lucide:users" className="w-4 h-4 mt-0.5" />
                        <div>
                          <p className="font-medium">Players On A Team</p>
                          <p>{tournament.players}</p>
                        </div>
                      </div>
                      {typeof tournament.maxTeams === "number" &&
                      Number.isFinite(tournament.maxTeams) &&
                      tournament.maxTeams > 0 ? (
                        <div className="flex items-start gap-2">
                          <Icon
                            icon="lucide:users"
                            className="w-4 h-4 mt-0.5"
                          />
                          <div>
                            <p className="font-medium">Field Size</p>
                            <p>{tournament.maxTeams} teams</p>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex items-start gap-2">
                        <Icon icon="lucide:clock" className="w-4 h-4 mt-0.5" />
                        <div>
                          <p className="font-medium">Tee Times</p>
                          <p>
                            {tournament.assignedTeeTimes
                              ? "Assigned"
                              : "Get your own"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Icon icon="lucide:flag" className="w-4 h-4 mt-0.5" />
                        <div>
                          <p className="font-medium">Tee</p>
                          <p>
                            <TeeBadge
                              tee={tournament.tee || "Mixed"}
                              size="xs"
                              ariaLabel={`Tournament tee: ${tournament.tee || "Mixed"}`}
                            />
                          </p>
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
                        <Icon
                          icon="lucide:check-circle"
                          className="w-4 h-4 mt-0.5"
                        />
                        <div>
                          <p className="font-medium">Status</p>
                          <p>
                            {(() => {
                              const s = currentStatus;
                              if (s === TournamentStatus.Canceled) {
                                return "Canceled";
                              }
                              if (s === TournamentStatus.Completed) {
                                return "Completed";
                              }
                              if (s === TournamentStatus.InProgress) {
                                return "In Progress";
                              }
                              if (registrationOpen) {
                                return "Registration Open";
                              }
                              if (
                                registrationWindowInfo.state ===
                                RegistrationWindowState.Upcoming
                              ) {
                                return "Registration Opens Soon";
                              }
                              if (
                                registrationWindowInfo.state ===
                                RegistrationWindowState.Closed
                              ) {
                                return "Registration Closed";
                              }
                              return "Scheduled";
                            })()}
                          </p>
                        </div>
                      </div>
                      {(tournament.registrationStart ||
                        tournament.registrationEnd) && (
                        <div className="flex items-start gap-2">
                          <Icon
                            icon="lucide:timer"
                            className="w-4 h-4 mt-0.5"
                          />
                          <div>
                            <p className="font-medium">Registration Window</p>
                            <p>
                              {tournament.registrationStart
                                ? `Opens ${formatLocalDateTime(
                                    tournament.registrationStart,
                                  )}`
                                : "Opens TBD"}
                              {tournament.registrationEnd
                                ? ` • Closes ${formatLocalDateTime(
                                    tournament.registrationEnd,
                                  )}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      )}
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
                    {registrationOpen ? (
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
                              variant="bordered"
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
                        {registrationCopy ||
                          "Registration is currently closed."}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </div>
            </div>

            {/* Defending Champions Section */}
            {(defendingChampions &&
              defendingChampions.competitors.length > 0) ||
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
                            }),
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
                  <GroupedWinners groups={tournament.winnerGroups || []} />
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
                        {typeof tournament.maxTeams === "number" &&
                        Number.isFinite(tournament.maxTeams) &&
                        tournament.maxTeams > 0
                          ? ` / ${tournament.maxTeams}`
                          : ""}
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
                        <Tooltip
                          content="Updates in real time as teams register."
                          placement="bottom"
                          closeDelay={0}
                          offset={6}
                        >
                          <Button
                            size="sm"
                            variant="light"
                            onPress={() => {}}
                            aria-label="Real-time updates info"
                            className="min-w-0 h-auto px-0 py-0 text-[11px] text-foreground-400 underline decoration-dotted underline-offset-2"
                          >
                            Live
                          </Button>
                        </Tooltip>
                      </span>
                    )}
                  </div>
                </CardHeader>
                <Divider />
                <CardBody className="pt-4">
                  {!userId ? (
                    <div className="text-sm text-foreground-500 flex items-start gap-2">
                      <Icon
                        icon="lucide:lock"
                        className="w-4 h-4 mt-0.5 text-foreground-400"
                        aria-hidden="true"
                      />
                      <p>You must be logged in to view registered teams.</p>
                    </div>
                  ) : regsLoading ? (
                    <p className="text-sm text-foreground-500">
                      Loading registrations...
                    </p>
                  ) : registrations.length === 0 ? (
                    <p className="text-sm text-foreground-500">
                      No teams registered yet.
                    </p>
                  ) : (
                    <>
                      {hasOpenTeamSlots && (
                        <div className="mb-3 text-xs text-foreground-500 flex items-start gap-2">
                          <Icon
                            icon="lucide:info"
                            className="w-4 h-4 mt-0.5 text-foreground-400"
                            aria-hidden="true"
                          />
                          <p>
                            Want to join a team with an open spot? Contact the
                            team members to be added.
                          </p>
                        </div>
                      )}
                      <div className="md:max-h-96 lg:max-h-128 px-1 pb-2 overflow-y-auto overflow-x-hidden">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {registrations
                            .filter((reg) => {
                              if (!showNeedingPlayers || !tournament)
                                return true;
                              const team = Array.isArray(reg.team)
                                ? reg.team
                                : [];
                              return (
                                reg.openSpotsOptIn === true &&
                                team.length <
                                  (tournament.players || team.length)
                              );
                            })
                            .map((reg) => {
                              const originalIdx = registrations.findIndex(
                                (r) => r.id === reg.id,
                              );
                              const maxTeams =
                                typeof tournament.maxTeams === "number" &&
                                Number.isFinite(tournament.maxTeams) &&
                                tournament.maxTeams > 0
                                  ? tournament.maxTeams
                                  : undefined;
                              const isWaitlisted =
                                maxTeams !== undefined &&
                                originalIdx >= maxTeams;
                              const team = Array.isArray(reg.team)
                                ? reg.team
                                : [];
                              const dateStr = reg.registeredAt?.toDate
                                ? new Date(
                                    reg.registeredAt.toDate(),
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "";
                              const maxPlayers =
                                tournament.players || team.length;
                              const leaderId = reg.ownerId || team[0]?.id;
                              const displayTeam =
                                leaderId && !team.some((m) => m.id === leaderId)
                                  ? [
                                      {
                                        id: leaderId,
                                        displayName:
                                          usersMap.get(leaderId)?.displayName ||
                                          usersMap.get(leaderId)?.email ||
                                          "Team Leader",
                                      },
                                      ...team,
                                    ]
                                  : team;
                              const openSpots = Math.max(
                                maxPlayers - displayTeam.length,
                                0,
                              );
                              const showOpenSpots =
                                reg.openSpotsOptIn === true && openSpots > 0;

                              const openTeamModalForTeam = () => {
                                setOpenTeamModalData({
                                  teamNumber: originalIdx + 1,
                                  leaderId,
                                  team: displayTeam,
                                  openSpots,
                                });
                                setOpenTeamModal(true);
                              };

                              return (
                                <TeamRegistrationCard
                                  key={reg.id}
                                  teamNumber={originalIdx + 1}
                                  displayTeam={displayTeam}
                                  leaderId={leaderId}
                                  isWaitlisted={isWaitlisted}
                                  openSpots={openSpots}
                                  showOpenSpots={showOpenSpots}
                                  dateStr={dateStr}
                                  maxPlayers={maxPlayers}
                                  usersMap={usersMap}
                                  onPress={openTeamModalForTeam}
                                />
                              );
                            })}
                        </div>
                      </div>
                    </>
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
              <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-xl md:shadow-lg md:border md:border-default-200 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
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

      <Modal
        isOpen={openTeamModal}
        onOpenChange={(open) => {
          setOpenTeamModal(open);
          if (!open) setOpenTeamModalData(null);
        }}
        size="md"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Open spot</ModalHeader>
              <ModalBody>
                {openTeamModalData ? (
                  <div className="space-y-3">
                    <div className="text-sm text-foreground-600">
                      <div className="font-medium">
                        Team {openTeamModalData.teamNumber}
                      </div>
                      <div className="text-foreground-500">
                        {openTeamModalData.openSpots === 1
                          ? "1 spot open"
                          : `${openTeamModalData.openSpots} spots open`}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {openTeamModalData.team.map((m) => {
                        const memberUser = usersMap.get(m.id);
                        const name =
                          (m.displayName || memberUser?.displayName || "")
                            .toString()
                            .trim() || m.id;
                        const isLeader =
                          !!openTeamModalData.leaderId &&
                          m.id === openTeamModalData.leaderId;
                        return (
                          <div
                            key={m.id}
                            className="flex items-center justify-between gap-3 rounded-md border border-default-200 bg-content2/60 p-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <UserAvatar
                                size="sm"
                                user={memberUser}
                                name={memberUser ? undefined : name}
                                alt={name}
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-sm font-medium truncate">
                                    {name}
                                  </span>
                                  {isLeader &&
                                  (tournament?.players ?? 1) > 1 ? (
                                    <Chip
                                      size="sm"
                                      variant="flat"
                                      color="primary"
                                      className="h-5 px-2 text-[10px]"
                                    >
                                      Leader
                                    </Chip>
                                  ) : null}
                                </div>
                                {memberUser?.email ? (
                                  <div className="text-[11px] text-foreground-500 truncate">
                                    {memberUser.email}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="flat"
                              onPress={() => {
                                onClose();
                                navigate(`/profile/${m.id}`);
                              }}
                              aria-label={`View profile for ${name}`}
                            >
                              View profile
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-xs text-foreground-500">
                      Tip: use "View profile" to contact a team member or the
                      leader.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-foreground-500">Loading...</p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" color="default" onPress={onClose}>
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default TournamentDetailPage;
