import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  onTournament,
  onTournamentRegistrations,
  mapTournamentDoc,
  deleteTournament as apiDeleteTournament,
} from "@/api/tournaments";
import { LookingForTeamSection } from "@/components/looking-for-team-section";
import { onBracket } from "@/api/brackets";
import {
  BracketView,
  calcBracketDimensions,
} from "@/components/bracket/BracketView";
import type { TournamentBracket, BracketTeam } from "@/types/bracket";
import {
  Card,
  Chip,
  Button,
  Separator,
  SearchField,
  Tooltip,
  Dropdown,
  Modal,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { UserAvatar } from "@/components/avatar";
import BackButton from "@/components/back-button";
import { TournamentStatusChip } from "@/components/tournament-status-chip";
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
import { getUsersByIds } from "@/api/users";
import type { User } from "@/api/users";
import { useUsersMap } from "@/hooks/useUsers";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/components/membership/hooks";
import { WinnerDisplay } from "@/components/winner-display";
import { getWeatherIcon } from "@/utils/weather";
import {
  getTournamentGoogleCalendarUrl,
  downloadTournamentIcsFile,
} from "@/utils/calendar";
import { copyOrMailtoEmails } from "@/utils/email";
import { EmailRegistrantsButton } from "@/components/email-registrants-button";

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
  team?: Array<{ id: string; displayName?: string; goldTee?: boolean }>;
  registeredAt?: any;
  openSpotsOptIn?: boolean;
}

const TournamentDetailPage: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

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
  const [showPartnerTeams, setShowPartnerTeams] = React.useState(false);
  const [teamSearch, setTeamSearch] = React.useState("");
  const normalizedSearchTerm = teamSearch.trim().toLowerCase();
  const [openTeamModal, setOpenTeamModal] = React.useState(false);
  const [openTeamModalData, setOpenTeamModalData] = React.useState<{
    teamNumber: number;
    leaderId?: string;
    team: Array<{ id: string; displayName?: string }>;
    openSpots: number;
    lookingForPartnerTeam?: boolean;
  } | null>(null);
  const [bracketTeamModal, setBracketTeamModal] =
    React.useState<BracketTeam | null>(null);
  const [bracketExpanded, setBracketExpanded] = React.useState(false);
  const [bracketMemberUsers, setBracketMemberUsers] = React.useState<
    Map<string, User>
  >(new Map());
  const { usersMap } = useUsersMap();

  const bracketUserPhotoMap = React.useMemo(() => {
    const m = new Map<string, string>();
    usersMap.forEach((u, id) => {
      const photo = u.profileURL || u.photoURL;
      if (photo) m.set(id, photo);
    });
    return m;
  }, [usersMap]);

  // When the bracket team modal opens, fetch team members directly by UID
  // so we get full profile data even for users excluded from the bulk
  // getUsers() query (which omits docs without a displayName field).
  React.useEffect(() => {
    if (!bracketTeamModal) return;
    let cancelled = false;
    getUsersByIds(bracketTeamModal.memberIds).then((users) => {
      if (cancelled) return;
      const m = new Map<string, User>();
      for (const u of users) m.set(u.id, u);
      setBracketMemberUsers(m);
    });
    return () => {
      cancelled = true;
    };
  }, [bracketTeamModal]);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteConfirm, setDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [bracket, setBracket] = React.useState<TournamentBracket | null>(null);
  const [downloadingPng, setDownloadingPng] = React.useState(false);
  const [printingBracket, setPrintingBracket] = React.useState(false);

  const handlePrintBracket = React.useCallback(
    async (el: HTMLDivElement | null) => {
      if (!bracket || !el) return;

      setPrintingBracket(true);
      try {
        // Render the bracket as a compressed JPEG instead of copying all app
        // stylesheets into the print window. This keeps the PDF small because
        // the browser only needs to embed one image, not the entire CSS bundle
        // plus font files.
        const { toJpeg } = await import("html-to-image");

        const { width: bracketW, height: bracketH } =
          calcBracketDimensions(bracket);
        const captureH = bracketH + 16;

        // Always export in light mode — strip the dark class so dark-mode
        // Tailwind utilities don't apply.
        const htmlEl = document.documentElement;
        const hadDark = htmlEl.classList.contains("dark");
        if (hadDark) htmlEl.classList.remove("dark");

        // Expand the BracketView scroll container so the full bracket is captured.
        const scrollContainer = el.firstElementChild as HTMLElement | null;
        const savedOverflow = scrollContainer?.style.overflow ?? "";
        const savedWidth = scrollContainer?.style.width ?? "";
        const savedHeight = scrollContainer?.style.height ?? "";
        if (scrollContainer) {
          scrollContainer.style.overflow = "visible";
          scrollContainer.style.width = bracketW + "px";
          scrollContainer.style.height = captureH + "px";
        }

        // Skip external images (Firebase Storage avatars) to avoid CORS errors.
        const skipExternalImages = (node: Node) => {
          if (
            node instanceof HTMLImageElement &&
            node.src &&
            !node.src.startsWith(window.location.origin) &&
            !node.src.startsWith("data:")
          ) {
            return false;
          }
          return true;
        };

        let dataUrl: string;
        try {
          dataUrl = await toJpeg(el, {
            quality: 0.7,
            width: bracketW,
            height: captureH,
            backgroundColor: "#ffffff",
            filter: skipExternalImages,
          });
        } finally {
          if (scrollContainer) {
            scrollContainer.style.overflow = savedOverflow;
            scrollContainer.style.width = savedWidth;
            scrollContainer.style.height = savedHeight;
          }
          if (hadDark) htmlEl.classList.add("dark");
        }

        const pxToMm = (px: number) => (px * 25.4) / 96;
        const pageWmm = (pxToMm(bracketW) + 20).toFixed(1);
        const pageHmm = (pxToMm(captureH) + 20).toFixed(1);

        const tournamentTitle = tournament?.title ?? "Tournament Bracket";
        const escapeHtml = (s: string) =>
          s
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
        const safeTitle = escapeHtml(tournamentTitle);

        // Minimal print window — no app CSS needed, just the JPEG image.
        const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${safeTitle} — Bracket</title>
<style>
@page { size: ${pageWmm}mm ${pageHmm}mm; margin: 10mm; }
html, body { margin: 0; padding: 0; background: white; }
img { display: block; max-width: 100%; }
</style>
</head>
<body>
<img src="${dataUrl}" width="${bracketW}" />
<script>window.onload = function () { window.print(); };</script>
</body>
</html>`;

        const printWindow = window.open("", "_blank", "width=900,height=600");
        if (!printWindow) {
          addToast({
            title: "Pop-up blocked",
            description:
              "Allow pop-ups for this site then try again to print the bracket.",
            color: "warning",
          });
          return;
        }
        printWindow.document.write(html);
        printWindow.document.close();
      } catch (err) {
        console.error("Failed to generate bracket for PDF:", err);
        addToast({
          title: "Export failed",
          description:
            "Could not generate the bracket for printing. Try again.",
          color: "danger",
        });
      } finally {
        setPrintingBracket(false);
      }
    },
    [bracket, tournament],
  );

  const handleDownloadBracketPng = React.useCallback(
    async (el: HTMLDivElement | null) => {
      if (!bracket || !el) return;

      setDownloadingPng(true);
      try {
        const { toPng } = await import("html-to-image");

        // calcBracketDimensions gives us the exact pixel size of the rendered
        // bracket tree, regardless of the viewport width.
        const { width: bracketW, height: bracketH } =
          calcBracketDimensions(bracket);
        // BracketView adds 16px to height on its scroll-container
        const captureH = bracketH + 16;

        // Always export in light mode — strip the dark class so dark-mode
        // Tailwind utilities don't apply, regardless of user preference.
        const htmlEl = document.documentElement;
        const hadDark = htmlEl.classList.contains("dark");
        if (hadDark) htmlEl.classList.remove("dark");

        // BracketView's outermost div has overflow-x:auto which clips the bracket
        // when the container is narrower than totalWidth. Temporarily expand it so
        // html-to-image captures the full horizontal extent, then restore.
        const scrollContainer = el.firstElementChild as HTMLElement | null;
        const savedOverflow = scrollContainer?.style.overflow ?? "";
        const savedWidth = scrollContainer?.style.width ?? "";
        const savedHeight = scrollContainer?.style.height ?? "";
        if (scrollContainer) {
          scrollContainer.style.overflow = "visible";
          scrollContainer.style.width = bracketW + "px";
          scrollContainer.style.height = captureH + "px";
        }

        // Skip external <img> nodes (Firebase Storage avatars) — they fail CORS
        // when html-to-image tries to fetch and embed them.
        const skipExternalImages = (node: Node) => {
          if (
            node instanceof HTMLImageElement &&
            node.src &&
            !node.src.startsWith(window.location.origin) &&
            !node.src.startsWith("data:")
          ) {
            return false;
          }
          return true;
        };

        let dataUrl: string;
        try {
          dataUrl = await toPng(el, {
            pixelRatio: 2,
            width: bracketW,
            height: captureH,
            backgroundColor: "#ffffff",
            filter: skipExternalImages,
          });
        } finally {
          // Always restore the scroll container styles and dark class
          if (scrollContainer) {
            scrollContainer.style.overflow = savedOverflow;
            scrollContainer.style.width = savedWidth;
            scrollContainer.style.height = savedHeight;
          }
          if (hadDark) htmlEl.classList.add("dark");
        }

        const tournamentTitle = tournament?.title ?? "Tournament Bracket";
        const safeTournamentTitle = tournamentTitle
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9_-]/g, "")
          .replace(/^-+|-+$/g, "");
        const filename = safeTournamentTitle
          ? `bracket-${safeTournamentTitle}.png`
          : `bracket-${bracket.tournamentId}.png`;

        const link = document.createElement("a");
        link.download = filename;
        link.href = dataUrl;
        link.click();
      } catch (err) {
        console.error("Failed to export bracket PNG:", err);
        addToast({
          title: "Export failed",
          description: "Could not generate the bracket image. Try again.",
          color: "danger",
        });
      } finally {
        setDownloadingPng(false);
      }
    },
    [bracket, tournament],
  );

  const [adminOpen, setAdminOpen] = React.useState(false);
  const desktopAdminButtonsRef = React.useRef<HTMLDivElement>(null);
  const cardBracketRef = React.useRef<HTMLDivElement>(null);
  const fullscreenBracketRef = React.useRef<HTMLDivElement>(null);
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
      const leaderId = r.ownerId || team[0]?.id;
      const normalizedSize =
        leaderId && !team.some((m) => m.id === leaderId)
          ? team.length + 1
          : team.length;
      return r.openSpotsOptIn === true && normalizedSize < maxPlayers;
    });
  }, [registrations, tournament?.players]);

  const hasPartnerTeamSlots = React.useMemo(() => {
    const maxPlayers = tournament?.players;
    if (maxPlayers !== 2 || !registrations.length) return false;
    return registrations.some((r) => {
      const team = Array.isArray(r.team) ? r.team : [];
      const leaderId = r.ownerId || team[0]?.id;
      const normalizedSize =
        leaderId && !team.some((m) => m.id === leaderId)
          ? team.length + 1
          : team.length;
      return r.openSpotsOptIn === true && normalizedSize >= 2;
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

  // Load bracket (real-time) when the tournament ID is available
  React.useEffect(() => {
    if (!firestoreId) {
      setBracket(null);
      return;
    }
    const unsub = onBracket(
      firestoreId,
      (b) => setBracket(b),
      (err) => console.error("Failed to load bracket", err),
    );
    return unsub;
  }, [firestoreId]);

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
  const toggleShowPartnerTeams = () => setShowPartnerTeams((prev) => !prev);

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
      ...Array.from({ length: maxTeam }, (_, i) => [
        `member${i + 1}`,
        `member${i + 1}_ghin`,
        `member${i + 1}_goldTee`,
      ]).flat(),
    ];
    const rows = registrations.map((r) => {
      const team = Array.isArray(r.team) ? r.team : [];
      const date = r.registeredAt?.toDate
        ? new Date(r.registeredAt.toDate()).toISOString()
        : "";
      const memberCols: string[] = [];
      for (let i = 0; i < maxTeam; i++) {
        const m = team[i];
        const userProfile = m?.id ? usersMap.get(m.id) : undefined;
        memberCols.push(m?.displayName || m?.id || "");
        memberCols.push(userProfile?.ghinNumber || "");
        memberCols.push(m?.goldTee ? "Gold" : "");
      }
      return [date, ...memberCols];
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
              className="animate-spin text-4xl text-accent"
            />
            <p className="text-muted">Loading tournament...</p>
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
                      <Button
                        size="sm"
                        variant="tertiary"
                        aria-label="Add tournament to calendar"
                      >
                        <Icon icon="lucide:calendar-plus" />
                        Calendar
                      </Button>
                      <Dropdown.Popover>
                        <Dropdown.Menu aria-label="Calendar options">
                          <Dropdown.Item
                            id="google"
                            startContent={<Icon icon="lucide:calendar" />}
                            onPress={() => handleCalendarAction("google")}
                          >
                            Add to Google Calendar
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="ics"
                            startContent={<Icon icon="lucide:download" />}
                            onPress={() => handleCalendarAction("ics")}
                          >
                            Download calendar file (.ics)
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                    <Tooltip>
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={shareLink}
                        aria-label="Share tournament"
                      >
                        <Icon icon="lucide:share" />
                        Share
                      </Button>
                      <Tooltip.Content>Share tournament</Tooltip.Content>
                    </Tooltip>
                  </div>
                </div>

                {/* Mobile Second row: Admin actions */}
                {isAdmin && (
                  <div className="flex flex-col gap-2">
                    {/* Toggle row — full-width accordion header */}
                    <button
                      onClick={() => setAdminOpen((o) => !o)}
                      aria-expanded={adminOpen}
                      aria-label="Toggle admin actions"
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-secondary/10 text-secondary text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      <span>Admin only</span>
                      <Icon
                        icon="lucide:chevron-down"
                        className={`w-4 h-4 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {/* Expanded: 2×2 button grid */}
                    {adminOpen && (
                      <div className="grid grid-cols-2 gap-2">
                        <EmailRegistrantsButton
                          registrations={registrations}
                          usersMap={usersMap}
                          maxTeams={
                            typeof tournament?.maxTeams === "number" &&
                            Number.isFinite(tournament.maxTeams) &&
                            tournament.maxTeams > 0
                              ? tournament.maxTeams
                              : undefined
                          }
                          size="sm"
                          className="w-full"
                        />
                        <Button
                          size="sm"
                          variant="tertiary"
                          onPress={exportRegistrations}
                          aria-label="Export registrations (Admin only)"
                          className="w-full"
                        >
                          <Icon icon="lucide:download" />
                          Export
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => setEditOpen(true)}
                          aria-label="Edit tournament (Admin only)"
                          className="w-full"
                        >
                          <Icon icon="lucide:edit" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onPress={() => setDeleteConfirm(true)}
                          aria-label="Delete tournament (Admin only)"
                          className="w-full"
                        >
                          <Icon icon="lucide:trash-2" />
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop: Single row with all buttons */}
              <div className="hidden md:flex items-center justify-between">
                <BackButton />
                <div className="flex items-center gap-3">
                  <Dropdown placement="bottom-end">
                    <Button
                      size="sm"
                      variant="tertiary"
                      aria-label="Add tournament to calendar"
                    >
                      <Icon icon="lucide:calendar-plus" />
                      Calendar
                    </Button>
                    <Dropdown.Popover>
                      <Dropdown.Menu aria-label="Calendar options">
                        <Dropdown.Item
                          id="google"
                          startContent={<Icon icon="lucide:calendar" />}
                          onPress={() => handleCalendarAction("google")}
                        >
                          Add to Google Calendar
                        </Dropdown.Item>
                        <Dropdown.Item
                          id="ics"
                          startContent={<Icon icon="lucide:download" />}
                          onPress={() => handleCalendarAction("ics")}
                        >
                          Download calendar file (.ics)
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                  <Tooltip>
                    <Button
                      size="sm"
                      variant="tertiary"
                      onPress={shareLink}
                      aria-label="Share tournament"
                    >
                      <Icon icon="lucide:share" />
                      Share
                    </Button>
                    <Tooltip.Content>Share tournament</Tooltip.Content>
                  </Tooltip>

                  {isAdmin && (
                    <div className="flex items-center gap-2 pl-2 border-l border-divider">
                      <button
                        onClick={() => setAdminOpen((o) => !o)}
                        aria-expanded={adminOpen}
                        aria-label="Toggle admin actions"
                        className="rounded-full focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <Chip
                          size="sm"
                          variant="tertiary"
                          className="cursor-pointer select-none"
                        >
                          <Icon
                            icon="lucide:chevron-right"
                            className={`w-3 h-3 transition-transform duration-200 ${adminOpen ? "rotate-180" : ""}`}
                          />
                          Admin only
                        </Chip>
                      </button>
                      <div
                        className="flex items-center gap-2 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out"
                        style={{
                          maxWidth: adminOpen
                            ? `${desktopAdminButtonsRef.current?.scrollWidth ?? 400}px`
                            : "0px",
                          opacity: adminOpen ? 1 : 0,
                        }}
                      >
                        <div
                          ref={desktopAdminButtonsRef}
                          className="flex items-center gap-2"
                        >
                          <EmailRegistrantsButton
                            registrations={registrations}
                            usersMap={usersMap}
                            maxTeams={
                              typeof tournament?.maxTeams === "number" &&
                              Number.isFinite(tournament.maxTeams) &&
                              tournament.maxTeams > 0
                                ? tournament.maxTeams
                                : undefined
                            }
                            size="sm"
                          />
                          <Tooltip>
                            <Button
                              size="sm"
                              variant="tertiary"
                              onPress={exportRegistrations}
                              aria-label="Export registrations (Admin only)"
                              className="whitespace-nowrap"
                            >
                              <Icon icon="lucide:download" />
                              Export
                            </Button>
                            <Tooltip.Content>
                              Export registrations (Admin only)
                            </Tooltip.Content>
                          </Tooltip>
                          <Tooltip>
                            <Button
                              size="sm"
                              variant="secondary"
                              onPress={() => setEditOpen(true)}
                              aria-label="Edit tournament (Admin only)"
                              className="whitespace-nowrap"
                            >
                              <Icon icon="lucide:edit" />
                              Edit
                            </Button>
                            <Tooltip.Content>
                              Edit tournament (Admin only)
                            </Tooltip.Content>
                          </Tooltip>
                          <Tooltip>
                            <Button
                              size="sm"
                              variant="danger"
                              onPress={() => setDeleteConfirm(true)}
                              aria-label="Delete tournament (Admin only)"
                              className="whitespace-nowrap"
                            >
                              <Icon icon="lucide:trash-2" />
                              Delete
                            </Button>
                            <Tooltip.Content>
                              Delete tournament (Admin only)
                            </Tooltip.Content>
                          </Tooltip>
                        </div>
                      </div>
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
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
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
                <TournamentStatusChip tournament={tournament} />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {/* Left Column: Overview */}
              <Card className="md:col-span-2">
                <Card.Header className="pb-0">
                  <h2 className="text-lg font-semibold">Overview</h2>
                </Card.Header>
                <Separator />
                <Card.Content className="pt-4">
                  {tournament.detailsMarkdown ? (
                    <div className="prose dark:prose-invert max-w-none text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {tournament.detailsMarkdown}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="leading-relaxed text-muted whitespace-pre-line">
                      {tournament.description}
                    </p>
                  )}
                </Card.Content>
              </Card>

              {/* Right Column: Key Facts */}
              <div className="space-y-6">
                <Card>
                  <Card.Header className="pb-0">
                    <h2 className="text-lg font-semibold">Key Facts</h2>
                  </Card.Header>
                  <Separator />
                  <Card.Content className="pt-4 space-y-5 text-sm">
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
                                return "Opens Soon";
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
                            </p>
                            <p>
                              {tournament.registrationEnd
                                ? `Closes ${formatLocalDateTime(
                                    tournament.registrationEnd,
                                  )}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card.Content>
                </Card>

                {/* Weather Card - Only show if weather data exists */}
                {tournament.weather && (
                  <Card>
                    <Card.Header className="pb-0">
                      <div className="flex items-center gap-2">
                        <Icon
                          icon={getWeatherIcon(tournament.weather.condition)}
                          className="w-5 h-5"
                        />
                        <h2 className="text-lg font-semibold">
                          Tournament Day Weather
                        </h2>
                      </div>
                    </Card.Header>
                    <Separator />
                    <Card.Content className="pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted text-xs uppercase tracking-wide">
                            Condition
                          </p>
                          <p className="font-semibold text-base">
                            {tournament.weather.condition}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted text-xs uppercase tracking-wide">
                            Temperature
                          </p>
                          <p className="font-semibold text-base">
                            {tournament.weather.temperature}°F
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted text-xs uppercase tracking-wide">
                            Wind Speed
                          </p>
                          <p className="font-semibold text-base">
                            {tournament.weather.windSpeed} mph
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted text-xs uppercase tracking-wide">
                            Precipitation
                          </p>
                          <p className="font-semibold text-base">
                            {tournament.weather.precipitation}"
                          </p>
                        </div>
                      </div>
                    </Card.Content>
                  </Card>
                )}

                <Card>
                  <Card.Header className="pb-0">
                    <h2 className="text-lg font-semibold">Registration</h2>
                  </Card.Header>
                  <Separator />
                  <Card.Content className="pt-4 space-y-4">
                    {registrationOpen ? (
                      <>
                        {isUserRegistered ? (
                          <>
                            <p className="text-sm text-muted flex items-center gap-1">
                              <Icon
                                icon="lucide:check-circle"
                                className="w-4 h-4 text-success"
                              />
                              You're registered for this tournament.
                            </p>
                            <Button
                              variant="tertiary"
                              fullWidth
                              isDisabled
                              aria-label="Already registered"
                            >
                              <Icon icon="lucide:check" className="w-4 h-4" />
                              Registered
                            </Button>
                            <Button
                              fullWidth
                              size="sm"
                              variant="outline"
                              onPress={handleRegister}
                              aria-label="View or edit your registration"
                            >
                              View / Edit Registration
                            </Button>
                          </>
                        ) : user ? (
                          <>
                            <p className="text-sm text-muted">
                              Ready to compete? Register your team now before
                              spots fill up.
                            </p>
                            <Button fullWidth onPress={handleRegister}>
                              Register
                            </Button>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted">
                              Sign in to register your team.
                            </p>
                            <Button fullWidth isDisabled>
                              Register
                            </Button>
                            <p className="text-xs text-muted">
                              Sign in required to register.
                            </p>
                          </>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted">
                        {registrationCopy ||
                          "Registration is currently closed."}
                      </p>
                    )}
                  </Card.Content>
                </Card>
              </div>
            </div>

            {/* Defending Champions Section */}
            {(defendingChampions &&
              defendingChampions.competitors.length > 0) ||
            (isAdmin && tournament.previousTournamentId) ? (
              <div className="mb-12">
                <Card className="md:col-span-2">
                  <Card.Header className="pb-0">
                    <div className="flex items-center gap-2">
                      <Icon
                        icon="lucide:trophy"
                        className="w-5 h-5 text-warning"
                      />
                      <h2 className="text-lg font-semibold">
                        Defending Champion
                      </h2>
                    </div>
                  </Card.Header>
                  <Separator />
                  <Card.Content className="pt-4">
                    {defendingChampions &&
                    defendingChampions.competitors.length > 0 ? (
                      <>
                        <p className="text-sm text-muted mb-3">
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
                      <p className="text-sm text-muted italic">
                        Previous tournament linked but no winners recorded yet.
                      </p>
                    )}
                  </Card.Content>
                </Card>
              </div>
            ) : null}

            {currentStatus === TournamentStatus.Completed &&
              (tournament.winnerGroups ?? []).some(
                (g) => (g.winners ?? []).length > 0,
              ) && (
                <div className="mb-12">
                  <Card>
                    <Card.Header className="pb-0">
                      <h2 className="text-lg font-semibold">
                        Tournament Winners
                      </h2>
                    </Card.Header>
                    <Separator />
                    <Card.Content className="pt-4">
                      <GroupedWinners groups={tournament.winnerGroups || []} />
                    </Card.Content>
                  </Card>
                </div>
              )}

            {/* Tournament Bracket — visible to admins always; to members only when published */}
            {bracket && (isAdmin || tournament.bracketPublished) && (
              <div className="mb-12">
                <Card>
                  <Card.Header className="pb-0 flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">
                          Tournament Bracket
                        </h2>
                        {isAdmin && !tournament.bracketPublished && (
                          <Chip size="sm" variant="tertiary">
                            Unpublished
                          </Chip>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {isAdmin && (
                          <>
                            <Tooltip>
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                aria-label="Print bracket"
                                onPress={() =>
                                  handlePrintBracket(cardBracketRef.current)
                                }
                              >
                                {!printingBracket && (
                                  <Icon
                                    icon="lucide:printer"
                                    className="w-4 h-4"
                                  />
                                )}
                              </Button>
                              <Tooltip.Content>
                                Print / Save as PDF
                              </Tooltip.Content>
                            </Tooltip>

                            <Tooltip>
                              <Button
                                isIconOnly
                                variant="ghost"
                                size="sm"
                                aria-label="Download bracket as PNG"
                                onPress={() =>
                                  handleDownloadBracketPng(
                                    cardBracketRef.current,
                                  )
                                }
                              >
                                {!downloadingPng && (
                                  <Icon
                                    icon="lucide:image-down"
                                    className="w-4 h-4"
                                  />
                                )}
                              </Button>
                              <Tooltip.Content>
                                Download bracket as PNG
                              </Tooltip.Content>
                            </Tooltip>
                          </>
                        )}

                        <Tooltip>
                          <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label="Expand bracket"
                            onPress={() => setBracketExpanded(true)}
                          >
                            <Icon icon="lucide:expand" className="w-4 h-4" />
                          </Button>
                          <Tooltip.Content>Expand bracket</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  </Card.Header>
                  <Separator />
                  <Card.Content className="pt-4">
                    <div ref={cardBracketRef}>
                      <BracketView
                        bracket={bracket}
                        onTeamPress={(team) => setBracketTeamModal(team)}
                        userPhotoMap={bracketUserPhotoMap}
                      />
                    </div>
                  </Card.Content>
                </Card>
              </div>
            )}

            <LookingForTeamSection
              tournamentId={tournament.firestoreId!}
              currentUserId={userId ?? null}
              registrationOpen={registrationOpen}
              isUserRegistered={isUserRegistered}
              maxTeamSize={tournament.players ?? 1}
              isAdmin={isAdmin}
            />

            <div className="grid md:grid-cols-3 gap-6 mb-24 md:mb-16">
              {/* Full Width: Registered Teams (Improved readability) */}
              <Card className="md:col-span-3">
                <Card.Header className="pb-0 overflow-visible relative">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Icon
                          icon="lucide:users"
                          className="w-5 h-5 text-accent"
                          aria-hidden="true"
                        />
                        Registered Teams
                        {!regsLoading && registrations.length > 0 && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            {registrations.length}
                            {typeof tournament.maxTeams === "number" &&
                            Number.isFinite(tournament.maxTeams) &&
                            tournament.maxTeams > 0
                              ? ` / ${tournament.maxTeams}`
                              : ""}
                          </span>
                        )}
                      </h2>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-end pb-1">
                      {!regsLoading && registrations.length > 0 && (
                        <SearchField name="search">
                          <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input
                              className="w-44"
                              placeholder="Search players..."
                              value={teamSearch}
                              onChange={(
                                e: React.ChangeEvent<HTMLInputElement>,
                              ) => setTeamSearch(e.target.value)}
                              aria-label="Search registered teams by player name"
                            />
                            <SearchField.ClearButton />
                          </SearchField.Group>
                        </SearchField>
                      )}
                      {!regsLoading && registrations.length > 0 && (
                        <Button
                          size="sm"
                          variant={showNeedingPlayers ? "primary" : "tertiary"}
                          onPress={toggleShowNeedingPlayers}
                          aria-pressed={showNeedingPlayers}
                          aria-label="Toggle show teams needing players"
                          className="px-2 h-7 text-xs sm:text-xs"
                        >
                          {showNeedingPlayers
                            ? "Showing Open Teams"
                            : "Show Open Teams"}
                        </Button>
                      )}
                      {!regsLoading && hasPartnerTeamSlots && (
                        <Button
                          size="sm"
                          variant={showPartnerTeams ? "primary" : "tertiary"}
                          onPress={toggleShowPartnerTeams}
                          aria-pressed={showPartnerTeams}
                          aria-label="Toggle show teams seeking a partner team"
                          className="px-2 h-7 text-xs sm:text-xs"
                        >
                          {showPartnerTeams
                            ? "Showing Partner Teams"
                            : "Show Partner Teams"}
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
                          <Tooltip closeDelay={0}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onPress={() => {}}
                              aria-label="Real-time updates info"
                              className="min-w-0 h-auto px-0 py-0 text-[11px] text-muted underline decoration-dotted underline-offset-2"
                            >
                              Live
                            </Button>
                            <Tooltip.Content placement="bottom" offset={6}>
                              Updates in real time as teams register.
                            </Tooltip.Content>
                          </Tooltip>
                        </span>
                      )}
                    </div>
                  </div>
                </Card.Header>
                <Separator />
                <Card.Content className="pt-4">
                  {!userId ? (
                    <div className="text-sm text-muted flex items-start gap-2">
                      <Icon
                        icon="lucide:lock"
                        className="w-4 h-4 mt-0.5 text-muted"
                        aria-hidden="true"
                      />
                      <p>You must be logged in to view registered teams.</p>
                    </div>
                  ) : regsLoading ? (
                    <p className="text-sm text-muted">
                      Loading registrations...
                    </p>
                  ) : registrations.length === 0 ? (
                    <p className="text-sm text-muted">
                      No teams registered yet.
                    </p>
                  ) : (
                    <>
                      {(hasOpenTeamSlots || hasPartnerTeamSlots) && (
                        <div className="mb-3 text-xs text-muted flex items-start gap-2">
                          <Icon
                            icon="lucide:info"
                            className="w-4 h-4 mt-0.5 text-muted"
                            aria-hidden="true"
                          />
                          <p>
                            Some teams are open to new players or looking for a
                            partner team. Click a highlighted team to see who to
                            contact.
                          </p>
                        </div>
                      )}
                      <div className="px-1 pb-2">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 ">
                          {registrations
                            .filter((reg) => {
                              if (normalizedSearchTerm) {
                                const members = Array.isArray(reg.team)
                                  ? reg.team
                                  : [];
                                const leaderProfile = reg.ownerId
                                  ? usersMap.get(reg.ownerId)
                                  : undefined;
                                const leaderName = (
                                  leaderProfile?.displayName ??
                                  leaderProfile?.email ??
                                  ""
                                ).toLowerCase();
                                const matchesSearch =
                                  members.some((m) =>
                                    m.displayName
                                      ?.toLowerCase()
                                      .includes(normalizedSearchTerm),
                                  ) ||
                                  leaderName.includes(normalizedSearchTerm);
                                if (!matchesSearch) return false;
                              }
                              if (
                                (!showNeedingPlayers && !showPartnerTeams) ||
                                !tournament
                              )
                                return true;
                              const team = Array.isArray(reg.team)
                                ? reg.team
                                : [];
                              const maxPlayers =
                                tournament.players || team.length;
                              const filterLeaderId = reg.ownerId || team[0]?.id;
                              const normalizedSize =
                                filterLeaderId &&
                                !team.some((m) => m.id === filterLeaderId)
                                  ? team.length + 1
                                  : team.length;
                              const matchesOpen =
                                showNeedingPlayers &&
                                reg.openSpotsOptIn === true &&
                                normalizedSize < maxPlayers;
                              const matchesPartner =
                                showPartnerTeams &&
                                maxPlayers === 2 &&
                                reg.openSpotsOptIn === true &&
                                normalizedSize >= 2;
                              return matchesOpen || matchesPartner;
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
                              const lookingForPartnerTeam =
                                maxPlayers === 2 &&
                                reg.openSpotsOptIn === true &&
                                openSpots === 0 &&
                                displayTeam.length >= 2;

                              const openTeamModalForTeam = () => {
                                setOpenTeamModalData({
                                  teamNumber: originalIdx + 1,
                                  leaderId,
                                  team: displayTeam,
                                  openSpots,
                                  lookingForPartnerTeam,
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
                                  lookingForPartnerTeam={lookingForPartnerTeam}
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
                </Card.Content>
              </Card>
            </div>
          </>
        )}
        {/* Bracket fullscreen overlay */}
        {bracket && bracketExpanded && (
          <div
            className="fixed inset-0 z-50 bg-background flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Bracket fullscreen"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
              <h2 className="text-lg font-semibold">Tournament Bracket</h2>
              <div className="flex items-center gap-1">
                {isAdmin && (
                  <>
                    <Tooltip>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Print bracket"
                        onPress={() =>
                          handlePrintBracket(fullscreenBracketRef.current)
                        }
                      >
                        {!printingBracket && (
                          <Icon icon="lucide:printer" className="w-4 h-4" />
                        )}
                      </Button>
                      <Tooltip.Content>Print / Save as PDF</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                      <Button
                        isIconOnly
                        variant="ghost"
                        size="sm"
                        aria-label="Download bracket as PNG"
                        onPress={() =>
                          handleDownloadBracketPng(fullscreenBracketRef.current)
                        }
                      >
                        {!downloadingPng && (
                          <Icon icon="lucide:image-down" className="w-4 h-4" />
                        )}
                      </Button>
                      <Tooltip.Content>Download bracket as PNG</Tooltip.Content>
                    </Tooltip>
                  </>
                )}
                <Tooltip>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    aria-label="Close fullscreen bracket"
                    onPress={() => setBracketExpanded(false)}
                  >
                    <Icon icon="lucide:shrink" className="w-4 h-4" />
                  </Button>
                  <Tooltip.Content>Close fullscreen</Tooltip.Content>
                </Tooltip>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
              <div ref={fullscreenBracketRef}>
                <BracketView
                  bracket={bracket}
                  onTeamPress={(team) => {
                    setBracketTeamModal(team);
                    setBracketExpanded(false);
                  }}
                  userPhotoMap={bracketUserPhotoMap}
                />
              </div>
            </div>
          </div>
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
              <div className="flex flex-col w-full h-full md:h-auto md:max-h-[90vh] md:max-w-5xl md:rounded-xl md:shadow-lg md:border md:bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                <div className="flex-1 flex flex-col min-h-0 md:rounded-b-xl overflow-hidden">
                  <React.Suspense
                    fallback={
                      <div className="p-8 flex flex-col items-center gap-3">
                        <Icon
                          icon="lucide:loader"
                          className="animate-spin text-2xl text-accent"
                        />
                        <p className="text-sm text-muted">Loading editor...</p>
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
            <div className="relative z-10 bg-background dark:bg-default/60 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-medium mb-2">Delete Tournament</h3>
              <p className="text-sm text-muted mb-4">
                Are you sure you want to delete this tournament? This cannot be
                undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="tertiary"
                  onPress={() => !deleting && setDeleteConfirm(false)}
                  isDisabled={deleting}
                >
                  Cancel
                </Button>
                <Button variant="danger" onPress={handleDelete}>
                  Delete
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal.Backdrop
        isOpen={openTeamModal}
        onOpenChange={(open) => {
          setOpenTeamModal(open);
          if (!open) setOpenTeamModalData(null);
        }}
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            <>
              <Modal.Header>
                {openTeamModalData?.lookingForPartnerTeam
                  ? "Seeking a partner team"
                  : "Open spot"}
              </Modal.Header>
              <Modal.Body>
                {openTeamModalData ? (
                  <div className="space-y-3">
                    <div className="text-sm text-muted">
                      <div className="font-medium">
                        Team {openTeamModalData.teamNumber}
                      </div>
                      <div className="text-muted">
                        {openTeamModalData.lookingForPartnerTeam
                          ? "Looking for a partner team to complete a foursome"
                          : openTeamModalData.openSpots === 1
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
                            className="flex items-center justify-between gap-3 rounded-md border bg-surface-secondary/60 p-2"
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
                                      variant="tertiary"
                                      className="h-5 px-2 text-[10px]"
                                    >
                                      Leader
                                    </Chip>
                                  ) : null}
                                </div>
                                {memberUser?.email ? (
                                  <div className="text-[11px] text-muted truncate">
                                    {memberUser.email}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="tertiary"
                              onPress={() => {
                                setOpenTeamModal(false);
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

                    <p className="text-xs text-muted">
                      Tip: use "View profile" to contact a team member or the
                      leader.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">Loading...</p>
                )}
              </Modal.Body>
              <Modal.Footer>
                {openTeamModalData &&
                  (() => {
                    const emails = openTeamModalData.team
                      .map((m) => usersMap.get(m.id)?.email)
                      .filter((e): e is string => !!e);
                    return emails.length > 0 ? (
                      <Button
                        variant="tertiary"
                        onPress={() => {
                          window.location.href = `mailto:${emails.join(",")}`;
                        }}
                      >
                        <Icon icon="lucide:mail" className="w-4 h-4" />
                        Email team
                      </Button>
                    ) : null;
                  })()}
                <Button variant="ghost" onPress={() => setOpenTeamModal(false)}>
                  Close
                </Button>
              </Modal.Footer>
            </>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Bracket team info modal */}
      <Modal.Backdrop
        isOpen={!!bracketTeamModal}
        onOpenChange={(open) => {
          if (!open) {
            setBracketTeamModal(null);
            setBracketMemberUsers(new Map());
          }
        }}
      >
        <Modal.Container size="md">
          <Modal.Dialog>
            {(() => {
              const team = bracketTeamModal;
              if (!team) return null;

              const memberRows = team.memberIds.map((uid, i) => {
                // Prefer the directly-fetched user (not subject to orderBy exclusion)
                const memberUser =
                  bracketMemberUsers.get(uid) ?? usersMap.get(uid);
                const name = (
                  team.memberNames?.[i] ||
                  memberUser?.displayName ||
                  memberUser?.email ||
                  uid
                )
                  .toString()
                  .trim();
                return { uid, memberUser, name };
              });

              const emails = memberRows
                .map((r) => r.memberUser?.email)
                .filter((e): e is string => !!e);

              return (
                <>
                  <Modal.Header className="flex flex-col gap-0.5">
                    <span>{team.name}</span>
                    <span className="text-sm font-normal text-muted">
                      Team contact info
                    </span>
                  </Modal.Header>
                  <Modal.Body>
                    <div className="space-y-2">
                      {memberRows.map(({ uid, memberUser, name }) => (
                        <div
                          key={uid}
                          className="flex items-center justify-between gap-3 rounded-md border bg-surface-secondary/60 p-2"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <UserAvatar
                              size="sm"
                              user={memberUser}
                              name={memberUser ? undefined : name}
                              alt={name}
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium truncate">
                                {name}
                              </div>
                              {memberUser?.email ? (
                                <div className="text-[11px] text-muted truncate">
                                  {memberUser.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => {
                              setBracketTeamModal(null);
                              navigate(`/profile/${uid}`);
                            }}
                            aria-label={`View profile for ${name}`}
                          >
                            View profile
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Modal.Body>
                  <Modal.Footer>
                    {emails.length > 0 && (
                      <Button
                        variant="tertiary"
                        onPress={() => copyOrMailtoEmails(emails)}
                      >
                        <Icon icon="lucide:copy" className="w-4 h-4" />
                        Copy emails
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      onPress={() => setBracketTeamModal(null)}
                    >
                      Close
                    </Button>
                  </Modal.Footer>
                </>
              );
            })()}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
};

export default TournamentDetailPage;
