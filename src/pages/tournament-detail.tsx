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
  Avatar,
  addToast,
  ScrollShadow,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { teeColorClasses } from "@/utils/teeStyles";
import { Winner } from "@/types/winner";
import { getUsers, User } from "@/api/users";
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
  const [users, setUsers] = React.useState<User[]>([]);

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

  React.useEffect(() => {
    const loadUsers = async () => {
      try {
        const list = await getUsers();
        setUsers(list);
      } catch (e) {
        console.error("Failed to load users", e);
      }
    };
    loadUsers();
  }, []);

  const firstPlaceWinners: Winner[] = React.useMemo(() => {
    if (!tournament?.winners) return [];
    return (tournament.winners || []).filter((w) => w.place === 1);
  }, [tournament]);

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
          <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div>
                <h1 className="text-3xl font-bold mb-2">{tournament.title}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-foreground-500">
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
                    Teams: {tournament.players}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md ${teeColorClasses(tournament.tee)}`}
                  >
                    <Icon
                      icon="lucide:flag"
                      className="w-3.5 h-3.5 opacity-70"
                    />
                    {tournament.tee || "Mixed"}
                  </span>
                  {tournament.registrationOpen && (
                    <Chip color="success" size="sm" variant="flat">
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
            </div>
            <div className="flex flex-wrap gap-2 justify-start md:justify-end">
              <Button
                variant="flat"
                onPress={shareLink}
                startContent={<Icon icon="lucide:share" />}
              >
                Share
              </Button>
              {isAdmin && (
                <Button
                  variant="flat"
                  onPress={exportRegistrations}
                  startContent={<Icon icon="lucide:download" />}
                >
                  Export
                </Button>
              )}
              <Button
                variant="light"
                onPress={() => navigate(-1)}
                startContent={<Icon icon="lucide:arrow-left" />}
              >
                Back
              </Button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="md:col-span-2" shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Overview</h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                <p className="leading-relaxed text-foreground-600 whitespace-pre-line">
                  {tournament.description}
                </p>
              </CardBody>
            </Card>

            <Card shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Key Facts</h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4 space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Icon icon="lucide:clock" className="w-4 h-4 mt-0.5" />
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
                    <p className="font-medium">Teams</p>
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
                  <Icon icon="lucide:check-circle" className="w-4 h-4 mt-0.5" />
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
              </CardBody>
            </Card>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="md:col-span-2" shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">
                  Past Winners (1st Place)
                </h2>
              </CardHeader>
              <Divider />
              <CardBody className="pt-4">
                {firstPlaceWinners.length === 0 ? (
                  <p className="text-sm text-foreground-500">
                    No first place winner data available.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {firstPlaceWinners.map((w, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-content2 rounded-md px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <Icon
                            icon="lucide:crown"
                            className="w-4 h-4 text-warning"
                          />
                          <span className="font-medium">
                            {w.displayNames.join(", ")}
                          </span>
                        </div>
                        <div className="text-xs text-foreground-500">
                          {w.score ? `Score: ${w.score}` : "Winner"}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <p className="text-sm text-foreground-600">
                      Ready to compete? Register your team now before spots fill
                      up.
                    </p>
                    <Button color="primary" fullWidth onPress={handleRegister}>
                      Register
                    </Button>
                    {!user && (
                      <p className="text-xs text-foreground-500">
                        Sign in required to register.
                      </p>
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

          <div className="mb-24 md:mb-16">
            <Card shadow="sm">
              <CardHeader className="pb-0">
                <h2 className="text-lg font-semibold">Registered Teams</h2>
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
                  <ScrollShadow className="max-h-80 pr-2">
                    <div className="space-y-3">
                      {registrations.map((reg) => {
                        const team = Array.isArray(reg.team) ? reg.team : [];
                        return (
                          <div
                            key={reg.id}
                            className="flex items-center justify-between bg-content2 rounded-md px-3 py-2"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                {team.map((m, i) => {
                                  const memberUser = users.find(
                                    (u) => u.id === (m as any).id
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
                                    <Avatar
                                      key={m.id || i}
                                      size="sm"
                                      src={src}
                                      name={label}
                                      className="border border-default-200"
                                    >
                                      {label
                                        .split(" ")
                                        .map((s: string) => s[0])
                                        .join("")}
                                    </Avatar>
                                  );
                                })}
                              </div>
                              <div className="text-sm font-medium">
                                {team
                                  .map((m) => m.displayName || m.id)
                                  .join(", ")}
                              </div>
                            </div>
                            <div className="text-xs text-foreground-500">
                              {reg.registeredAt?.toDate
                                ? new Date(
                                    reg.registeredAt.toDate()
                                  ).toLocaleDateString("en-US")
                                : ""}
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
    </div>
  );
};

export default TournamentDetailPage;
