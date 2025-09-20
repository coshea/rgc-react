import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "@/config/firebase";
import {
  doc,
  onSnapshot,
  collection,
  query,
  orderBy,
} from "firebase/firestore";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Divider,
  addToast,
  ScrollShadow,
} from "@heroui/react";
import { UserAvatar } from "@/components/avatar";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { teeColorClasses } from "@/utils/teeStyles";
const TournamentEditor = React.lazy(() =>
  import("@/components/tournament-editor").then((m) => ({
    default: m.TournamentEditor,
  }))
);
import { Winner } from "@/types/winner";
// User types consumed indirectly; no direct import needed after hook migration
import { useUsersMap } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";

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
  const { userProfile } = useUserProfile();
  const isAdmin = !!(
    user &&
    userProfile &&
    (userProfile as any).admin === true
  );

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [regsLoading, setRegsLoading] = React.useState(true);
  const [registrations, setRegistrations] = React.useState<RegistrationDoc[]>(
    []
  );
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
        (Array.isArray(r.team) && r.team.some((m) => (m as any).id === userId))
    );
  }, [registrations, userId]);

  React.useEffect(() => {
    if (!firestoreId) return;
    setLoading(true);
    const ref = doc(db, "tournaments", firestoreId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          addToast({
            title: "Not found",
            description: "Tournament not found",
            color: "danger",
          });
          navigate("/tournaments");
          return;
        }
        const data: any = snap.data();
        const dateField =
          data.date && typeof data.date.toDate === "function"
            ? data.date.toDate()
            : data.date
              ? new Date(data.date)
              : new Date();
        setTournament({
          firestoreId: snap.id,
          title: data.title,
          date: dateField,
          description: data.description,
          detailsMarkdown: data.detailsMarkdown || data.details || "",
          players: data.players,
          completed: data.completed || false,
          canceled: data.canceled || false,
          registrationOpen: data.registrationOpen || false,
          icon: data.icon,
          href: data.href,
          prizePool: data.prizePool || 0,
          winners: data.winners || [],
          tee: data.tee || "Mixed",
        });
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
    const regCol = collection(db, "tournaments", firestoreId, "registrations");
    const qRegs = query(regCol, orderBy("registeredAt", "asc"));
    const unsub = onSnapshot(
      qRegs,
      (snap) => {
        const list: RegistrationDoc[] = snap.docs.map((d) => ({
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

  // Users are now loaded globally via React Query (useUsersMap)

  // All winners sorted by place ascending
  const allWinners: Winner[] = React.useMemo(() => {
    if (!tournament?.winners) return [];
    return [...(tournament.winners || [])].sort((a, b) => a.place - b.place);
  }, [tournament]);

  const ordinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"]; // basic ordinal suffixes
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

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
      const ref = doc(db, "tournaments", tournament.firestoreId);
      const { deleteDoc } = await import("firebase/firestore");
      await deleteDoc(ref);
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
    <div className="max-w-5xl mx-auto pt-4 pb-10 px-4">
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
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 text-sm text-foreground-500 hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-1 py-1 -ml-1"
              aria-label="Go back to tournaments list"
            >
              <Icon icon="lucide:arrow-left" className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="flat"
                onPress={shareLink}
                startContent={<Icon icon="lucide:share" />}
                aria-label="Share tournament"
              >
                <span className="hidden md:inline">Share</span>
              </Button>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={exportRegistrations}
                  startContent={<Icon icon="lucide:download" />}
                  aria-label="Export registrations"
                >
                  <span className="hidden md:inline">Export</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="flat"
                  onPress={() => setEditOpen(true)}
                  startContent={<Icon icon="lucide:edit" />}
                  aria-label="Edit tournament"
                >
                  <span className="hidden md:inline">Edit</span>
                </Button>
              )}
              {isAdmin && (
                <Button
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => setDeleteConfirm(true)}
                  startContent={<Icon icon="lucide:trash-2" />}
                  aria-label="Delete tournament"
                >
                  <span className="hidden md:inline">Delete</span>
                </Button>
              )}
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
              <span
                className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${teeColorClasses(tournament.tee)}`}
              >
                <Icon icon="lucide:flag" className="w-3.5 h-3.5 opacity-70" />
                {tournament.tee || "Mixed"}
              </span>
              {tournament.registrationOpen && (
                <Chip color="warning" size="sm" variant="flat">
                  Registration Open
                </Chip>
              )}
              {tournament.completed && !tournament.canceled && (
                <Chip color="default" size="sm" variant="flat">
                  Completed
                </Chip>
              )}
              {tournament.canceled && (
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
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md ${teeColorClasses(tournament.tee)}`}
                          >
                            <Icon
                              icon="lucide:flag"
                              className="w-3 h-3 opacity-70"
                            />
                            {tournament.tee || "Mixed"}
                          </span>
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
                          {tournament.canceled
                            ? "Canceled"
                            : tournament.completed
                              ? "Completed"
                              : tournament.registrationOpen
                                ? "Registration Open"
                                : "Scheduled"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm">
                <CardHeader className="pb-0">
                  <h2 className="text-lg font-semibold">Registration</h2>
                </CardHeader>
                <Divider />
                <CardBody className="pt-4 space-y-4">
                  {tournament.registrationOpen ? (
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
                          <Button
                            color="primary"
                            fullWidth
                            isDisabled
                            aria-label="Sign in required to register"
                          >
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

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Left Column: Winners / Placements */}
            <Card className="md:col-span-2" shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Tournament Winners</h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                {allWinners.length === 0 ? (
                  <p className="text-sm text-foreground-500">
                    No winner data available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allWinners.map((w, idx) => {
                      const isFirst = w.place === 1;
                      const icon = isFirst
                        ? "lucide:crown"
                        : w.place === 2
                          ? "lucide:medal"
                          : w.place === 3
                            ? "lucide:award"
                            : "lucide:dot";
                      const iconClass = isFirst
                        ? "text-warning"
                        : w.place === 2
                          ? "text-foreground-400"
                          : w.place === 3
                            ? "text-success"
                            : "text-foreground-400 opacity-70";
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-content2 rounded-md px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={icon}
                              className={`w-4 h-4 ${iconClass}`}
                            />
                            <span className="font-medium">
                              {ordinal(w.place)}: {w.displayNames.join(", ")}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-foreground-500">
                            {typeof w.prizeAmount === "number" &&
                              w.prizeAmount > 0 && (
                                <span>
                                  ${w.prizeAmount.toLocaleString()} each
                                </span>
                              )}
                            {w.score && <span>Score: {w.score}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardBody>
            </Card>
            {/* Right Column spacer (empty) */}
            <div />
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-24 md:mb-16">
            {/* Full Width: Registered Teams (Improved readability) */}
            <Card className="md:col-span-3" shadow="sm">
              <CardHeader className="pb-0 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  Registered Teams
                  {!regsLoading && registrations.length > 0 && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                      {registrations.length}
                    </span>
                  )}
                </h2>
                {!regsLoading && registrations.length > 0 && (
                  <p className="text-[11px] text-foreground-500">
                    Updated live
                  </p>
                )}
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
                  <ScrollShadow className="max-h-80 pr-1">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {registrations.map((reg, idx) => {
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
                        return (
                          <div
                            key={reg.id}
                            className="rounded-md border border-default-200 bg-content2/60 hover:bg-content2 transition-colors p-3 flex flex-col gap-2"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex -space-x-2">
                                {team.map((m, i) => {
                                  const memberUser = usersMap.get(
                                    (m as any).id
                                  );
                                  const src = memberUser
                                    ? (memberUser as any).profileURL ||
                                      (memberUser as any).photoURL
                                    : undefined;
                                  const label = (
                                    m.displayName ||
                                    m.id ||
                                    ""
                                  ).toString();
                                  return (
                                    <UserAvatar
                                      key={m.id || i}
                                      size="sm"
                                      src={src}
                                      name={label}
                                      className="border border-default-200"
                                      alt={label}
                                    />
                                  );
                                })}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] uppercase tracking-wide text-foreground-400 font-medium mb-1">
                                  Team {idx + 1}
                                </p>
                                <ul className="text-sm font-medium leading-snug space-y-0.5">
                                  {team.map((m, i) => (
                                    <li key={i} className="truncate">
                                      {m.displayName || m.id}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-foreground-500 pt-1 border-t border-default-100">
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
