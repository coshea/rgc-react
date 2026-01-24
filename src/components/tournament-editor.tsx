import React from "react";
import {
  Card,
  CardBody,
  Input,
  Textarea,
  Button,
  DatePicker,
  NumberInput,
  Divider,
  Select,
  SelectItem,
  Checkbox,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { Icon } from "@iconify/react";
import { Tournament, TournamentStatus } from "@/types/tournament";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { getStatus, parseToDate } from "@/utils/tournamentStatus";
import { auth } from "@/config/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import RegistrationEditor from "@/components/registration-editor";
import { User } from "@/api/users";
import { parseDate, parseDateTime, DateValue } from "@internationalized/date";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import RegistrationsList from "@/components/registrations-list";
import { MarkdownEditor } from "@/components/markdown-editor";
import { PlusIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { computeTotalPayout } from "@/utils/winners";
import type { DocumentData } from "firebase/firestore";

interface TournamentEditorProps {
  tournament?: Tournament | null;
  // When creating, optional initial values to prepopulate the form
  initialValues?: Partial<Tournament>;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

const formatForDateTimeInput = (value: unknown) => {
  const date = parseToDate(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const parseDateTimeInputValue = (value: string) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
};

export const TournamentEditor: React.FC<TournamentEditorProps> = ({
  tournament,
  initialValues,
  onSave,
  onCancel,
}) => {
  const isEditing = !!tournament;

  const seed = isEditing
    ? (tournament as Partial<Tournament>)
    : initialValues || {};

  const [title, setTitle] = React.useState(seed.title || "");
  const [description, setDescription] = React.useState(seed.description || "");
  const [detailsMarkdown, setDetailsMarkdown] = React.useState(
    seed.detailsMarkdown || "",
  );
  const [players, setPlayers] = React.useState(seed.players || 1);
  const [maxTeams, setMaxTeams] = React.useState<number | undefined>(
    typeof seed.maxTeams === "number" ? seed.maxTeams : undefined,
  );
  const [completed, setCompleted] = React.useState(
    getStatus(seed) === TournamentStatus.Completed ||
      getStatus(seed) === TournamentStatus.InProgress,
  );
  const [prizePool, setPrizePool] = React.useState(seed.prizePool || 0);
  const [winnerGroups, setWinnerGroups] = React.useState<
    import("@/types/winner").WinnerGroup[]
  >(tournament?.winnerGroups ?? []);
  const [status, setStatus] = React.useState<TournamentStatus>(getStatus(seed));
  type TeeColor = "Blue" | "White" | "Gold" | "Red" | "Mixed";
  const TEE_COLORS: TeeColor[] = ["Blue", "White", "Gold", "Red", "Mixed"];
  function isTeeColor(value: any): value is TeeColor {
    return TEE_COLORS.includes(value);
  }
  const [tee, setTee] = React.useState<TeeColor>(
    isTeeColor(seed.tee) ? seed.tee : "Mixed",
  );
  const [assignedTeeTimes, setAssignedTeeTimes] = React.useState<boolean>(
    Boolean(seed.assignedTeeTimes),
  );
  const [date, setDate] = React.useState<DateValue | null>(
    seed.date ? parseDate(seed.date.toISOString().split("T")[0]) : null,
  );
  const [previousTournamentId, setPreviousTournamentId] = React.useState<
    string | undefined
  >(seed.previousTournamentId);
  const [registrationStartInput, setRegistrationStartInput] = React.useState(
    formatForDateTimeInput(seed.registrationStart),
  );
  const [registrationEndInput, setRegistrationEndInput] = React.useState(
    formatForDateTimeInput(seed.registrationEnd),
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [registrations, setRegistrations] = React.useState<any[]>([]);
  const [regsLoading, setRegsLoading] = React.useState(false);
  const [editingRegId, setEditingRegId] = React.useState<string | null>(null);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [allTournaments, setAllTournaments] = React.useState<Tournament[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newMembers, setNewMembers] = React.useState<string[]>([""]); // start with one slot
  const [adding, setAdding] = React.useState(false);
  const [detailsPopoutOpen, setDetailsPopoutOpen] = React.useState(false);
  const [weather, setWeather] = React.useState<
    import("@/types/tournament").TournamentWeather | null
  >(seed.weather || null);
  const [fetchingWeather, setFetchingWeather] = React.useState(false);

  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  // Sync previousTournamentId state with tournament prop updates
  React.useEffect(() => {
    if (tournament?.previousTournamentId !== previousTournamentId) {
      setPreviousTournamentId(tournament?.previousTournamentId);
    }
  }, [tournament?.previousTournamentId]);

  // NOTE: Admin Add Registration workflow should not auto-select the current user.
  // Admins need the ability to add arbitrary registrations on behalf of others.

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    // markdown not required but if provided can be large; no validation now
    if (players < 1) newErrors.players = "Must have at least 1 player";
    if (maxTeams !== undefined && maxTeams < 1) {
      newErrors.maxTeams = "Must be at least 1 team";
    }
    if (prizePool < 0) newErrors.prizePool = "Prize pool cannot be negative";
    const parsedStart = parseDateTimeInputValue(registrationStartInput);
    const parsedEnd = parseDateTimeInputValue(registrationEndInput);
    if (
      parsedStart &&
      parsedEnd &&
      parsedStart.getTime() > parsedEnd.getTime()
    ) {
      newErrors.registrationWindow =
        "Registration closing time must be after the opening time";
    }

    // Grouped winners validation replaces legacy winners
    if (completed && winnerGroups.length > 0) {
      const totalPrizeAmount = computeTotalPayout(winnerGroups);
      if (totalPrizeAmount > prizePool) {
        newErrors.winners = "Total prize amount exceeds prize pool";
      }
      const hasEmptyPlaces = winnerGroups.some((g) =>
        (g.winners || []).some(
          (w) => !w.competitors || w.competitors.length === 0,
        ),
      );
      if (hasEmptyPlaces) {
        newErrors.winners = "All winners must have competitors selected";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFetchWeather = async () => {
    if (!date) {
      addToast({
        title: "Date Required",
        description: "Please set a tournament date before fetching weather",
        color: "warning",
      });
      return;
    }

    setFetchingWeather(true);
    try {
      const { fetchHistoricalWeather } = await import("@/utils/weather");
      const tournamentDate = new Date(date.toString());
      const weatherData = await fetchHistoricalWeather(tournamentDate);

      if (weatherData) {
        setWeather(weatherData);
        addToast({
          title: "Weather Fetched",
          description: `${weatherData.condition}, ${weatherData.temperature}°F`,
          color: "success",
        });
      } else {
        addToast({
          title: "No Weather Data",
          description: "Could not fetch weather for this date",
          color: "warning",
        });
      }
    } catch (error) {
      console.error("Error fetching weather:", error);
      addToast({
        title: "Error",
        description: "Failed to fetch weather data",
        color: "danger",
      });
    } finally {
      setFetchingWeather(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    try {
      if (!auth || !auth.currentUser) {
        addToast({
          title: "Authentication required",
          description: "You must be signed in to save tournaments.",
          color: "danger",
        });
        setIsSubmitting(false);
        return;
      }
      const { db } = await import("@/config/firebase");
      const { collection, addDoc, updateDoc, doc, deleteField } = await import(
        "firebase/firestore"
      );
      // Sanitize winnerGroups to avoid writing `undefined` fields to Firestore
      const sanitizedGroups: WinnerGroup[] = (winnerGroups || []).map((g) => ({
        ...g,
        winners: (g.winners || []).map((w): WinnerPlace => {
          const out: WinnerPlace = {
            id: w.id,
            place: w.place,
            competitors: w.competitors || [],
          };
          if (w.prizeAmount !== undefined && w.prizeAmount !== null) {
            out.prizeAmount = w.prizeAmount;
          }
          if (w.score !== undefined && w.score !== null) {
            out.score = w.score;
          }
          return out;
        }),
      }));

      const tournamentData: DocumentData = {
        title,
        description,
        detailsMarkdown,
        players,
        status,
        prizePool,
        winnerGroups: sanitizedGroups, // grouped model
        date: date ? new Date(date.toString()) : new Date(),
        tee,
        assignedTeeTimes,
      };

      const parsedStart = parseDateTimeInputValue(registrationStartInput);
      const parsedEnd = parseDateTimeInputValue(registrationEndInput);

      if (parsedStart) {
        tournamentData.registrationStart = parsedStart;
      } else if (tournament && tournament.firestoreId) {
        tournamentData.registrationStart = deleteField();
      }

      if (parsedEnd) {
        tournamentData.registrationEnd = parsedEnd;
      } else if (tournament && tournament.firestoreId) {
        tournamentData.registrationEnd = deleteField();
      }

      if (
        typeof maxTeams === "number" &&
        Number.isFinite(maxTeams) &&
        maxTeams > 0
      ) {
        tournamentData.maxTeams = maxTeams;
      } else if (tournament && tournament.firestoreId) {
        tournamentData.maxTeams = deleteField();
      }

      // Add weather if it has a value, or use deleteField() to clear it on updates
      if (weather) {
        tournamentData.weather = weather;
      } else if (tournament && tournament.firestoreId) {
        // For updates: explicitly delete the field if it was cleared
        tournamentData.weather = deleteField();
      }

      // Add previousTournamentId if it has a value, or use deleteField() to clear it on updates
      if (previousTournamentId) {
        tournamentData.previousTournamentId = previousTournamentId;
      } else if (tournament && tournament.firestoreId) {
        // For updates: explicitly delete the field if it was cleared
        tournamentData.previousTournamentId = deleteField();
      }

      const colRef = collection(db, "tournaments");
      let createdDocRef: any = null;
      if (tournament && tournament.firestoreId) {
        const docRef = doc(db, "tournaments", tournament.firestoreId);
        await updateDoc(docRef, tournamentData);
      } else {
        createdDocRef = await addDoc(colRef, tournamentData);
      }
      const savedTournament: Tournament = {
        title,
        description,
        detailsMarkdown,
        players,
        status,
        prizePool,
        winnerGroups: sanitizedGroups,
        date: date ? new Date(date.toString()) : new Date(),
        tee,
        assignedTeeTimes,
        maxTeams:
          typeof maxTeams === "number" &&
          Number.isFinite(maxTeams) &&
          maxTeams > 0
            ? maxTeams
            : undefined,
        previousTournamentId: previousTournamentId || undefined,
        weather: weather || undefined,
        registrationStart: parsedStart || undefined,
        registrationEnd: parsedEnd || undefined,
      };
      if (createdDocRef && createdDocRef.id) {
        savedTournament.firestoreId = createdDocRef.id;
      } else if (tournament && tournament.firestoreId) {
        savedTournament.firestoreId = tournament.firestoreId;
      }
      onSave(savedTournament);
      addToast({
        title: isEditing ? "Tournament Updated" : "Tournament Created",
        description: `${savedTournament.title} has been successfully ${isEditing ? "updated" : "created"}.`,
        color: "success",
      });
    } catch (error) {
      console.error("Error saving tournament:", error);
      addToast({
        title: "Error",
        description: "Failed to save tournament. Please try again.",
        color: "danger",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  React.useEffect(() => {
    let unsubRegs: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    const init = async () => {
      if (!tournament || !tournament.firestoreId) return;
      setRegsLoading(true);
      try {
        const { collection, onSnapshot, orderBy, query } = await import(
          "firebase/firestore"
        );
        const { db } = await import("@/config/firebase");
        // Users real-time
        const usersCol = collection(db, "users");
        unsubUsers = onSnapshot(usersCol, (snap) => {
          const list: User[] = snap.docs.map((d) => {
            const data = d.data() as unknown as Omit<User, "id">;
            return { id: d.id, ...data };
          });
          setAllUsers(list);
        });
        // Registrations real-time ordered by registeredAt
        const regsCol = collection(
          db,
          "tournaments",
          tournament.firestoreId,
          "registrations",
        );
        const qRegs = query(regsCol, orderBy("registeredAt", "asc"));
        unsubRegs = onSnapshot(
          qRegs,
          (snap) => {
            const list = snap.docs.map((d) => {
              const data = d.data() as Record<string, unknown>;
              return { id: d.id, ...data };
            });
            setRegistrations(list);
            setRegsLoading(false);
          },
          (err) => {
            console.error("Failed to load registrations", err);
            addToast({
              title: "Error",
              description: "Failed to load registrations",
              color: "danger",
            });
            setRegsLoading(false);
          },
        );
      } catch (e) {
        console.error("Realtime init failed", e);
        setRegsLoading(false);
      }
    };
    init();
    return () => {
      if (unsubRegs) unsubRegs();
      if (unsubUsers) unsubUsers();
    };
  }, [tournament?.firestoreId]);

  // Load all tournaments for the previous tournament selector
  React.useEffect(() => {
    let unsubTournaments: (() => void) | null = null;
    const loadTournaments = async () => {
      try {
        const { collection, onSnapshot, orderBy, query } = await import(
          "firebase/firestore"
        );
        const { db } = await import("@/config/firebase");
        const tournamentsCol = collection(db, "tournaments");
        const q = query(tournamentsCol, orderBy("date", "desc"));
        unsubTournaments = onSnapshot(q, (snap) => {
          const list: Tournament[] = snap.docs.map((d) => {
            const data = d.data();
            return {
              firestoreId: d.id,
              title: data.title || "",
              date:
                data.date && typeof data.date.toDate === "function"
                  ? data.date.toDate()
                  : new Date(data.date || Date.now()),
              description: data.description || "",
              detailsMarkdown: data.detailsMarkdown,
              players: data.players || 0,
              status: data.status,
              prizePool: data.prizePool || 0,
              winnerGroups: data.winnerGroups || [],
              tee: data.tee,
              previousTournamentId: data.previousTournamentId,
            } as Tournament;
          });
          setAllTournaments(list);
        });
      } catch (e) {
        console.error("Failed to load tournaments", e);
      }
    };
    loadTournaments();
    return () => {
      if (unsubTournaments) unsubTournaments();
    };
  }, []);

  const startEdit = (reg: any) => setEditingRegId(reg.id);
  const cancelEdit = () => setEditingRegId(null);
  const deleteRegistration = async (regId: string) => {
    if (!tournament || !tournament.firestoreId) return;
    try {
      const { doc, deleteDoc } = await import("firebase/firestore");
      const { db } = await import("@/config/firebase");
      const regRef = doc(
        db,
        "tournaments",
        tournament.firestoreId,
        "registrations",
        regId,
      );
      await deleteDoc(regRef);
      setRegistrations((prev) => prev.filter((r) => r.id !== regId));
      addToast({
        title: "Deleted",
        description: "Registration removed.",
        color: "danger",
      });
    } catch (err) {
      console.error("Failed to delete registration", err);
      addToast({
        title: "Error",
        description: "Failed to delete registration.",
        color: "danger",
      });
    }
  };

  const submitNewRegistration = async () => {
    if (!tournament?.firestoreId) return;
    const cleaned = newMembers.filter(Boolean);
    if (!cleaned.length) {
      addToast({
        title: "Select members",
        description: "Choose at least one member.",
        color: "warning",
      });
      return;
    }
    setAdding(true);
    try {
      const { db } = await import("@/config/firebase");
      const { collection, addDoc, serverTimestamp } = await import(
        "firebase/firestore"
      );
      const team = cleaned.map((id) => {
        const u = allUsers.find((x) => x.id === id);
        return { id, displayName: u?.displayName || u?.email || id };
      });
      const colRef = collection(
        db,
        "tournaments",
        tournament.firestoreId,
        "registrations",
      );
      const docRef = await addDoc(colRef, {
        ownerId: "__admin__",
        team,
        registeredAt: serverTimestamp(),
      });
      setRegistrations((prev) => [
        ...prev,
        { id: docRef.id, ownerId: "__admin__", team },
      ]);
      addToast({
        title: "Added",
        description: "Registration created.",
        color: "success",
      });
      setAddOpen(false);
      setNewMembers([""]); // reset
    } catch (err) {
      console.error("Failed to add registration", err);
      addToast({
        title: "Error",
        description: "Failed to add registration.",
        color: "danger",
      });
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card className="w-full">
      <CardBody className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">
            {isEditing ? "Edit Tournament" : "Create New Tournament"}
          </h2>
          <Button
            color="default"
            variant="light"
            isIconOnly
            onPress={onCancel}
            aria-label="Cancel"
          >
            <Icon icon="lucide:x" className="text-lg" />
          </Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Input
                label="Tournament Title"
                placeholder="Enter tournament title"
                value={title}
                onValueChange={setTitle}
                isRequired
                isInvalid={!!errors.title}
                errorMessage={errors.title}
              />
              <Textarea
                label="Description"
                placeholder="Enter tournament description"
                value={description}
                onValueChange={setDescription}
                isRequired
                isInvalid={!!errors.description}
                errorMessage={errors.description}
              />
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <MarkdownEditor
                    value={detailsMarkdown}
                    onChange={setDetailsMarkdown}
                    placeholder="Use markdown for rich tournament details (e.g. rules, schedule, notes)"
                    minRows={10}
                    onPopout={() => setDetailsPopoutOpen(true)}
                  />
                </div>
              </div>
              <DatePicker
                label="Tournament Date"
                value={date}
                onChange={setDate}
                isRequired
                isInvalid={!!errors.date}
                errorMessage={errors.date}
              />
              <Card>
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Registration Window
                    </h3>
                    <span className="text-xs text-foreground-500">
                      Stored in UTC
                    </span>
                  </div>
                  <div className="space-y-3">
                    <DatePicker
                      label="Opens"
                      value={
                        registrationStartInput
                          ? parseDateTime(registrationStartInput)
                          : null
                      }
                      onChange={(v: DateValue | null) =>
                        setRegistrationStartInput(v ? v.toString() : "")
                      }
                      granularity="minute"
                      isInvalid={!!errors.registrationWindow}
                      errorMessage={errors.registrationWindow}
                    />
                    <DatePicker
                      label="Closes"
                      value={
                        registrationEndInput
                          ? parseDateTime(registrationEndInput)
                          : null
                      }
                      onChange={(v: DateValue | null) =>
                        setRegistrationEndInput(v ? v.toString() : "")
                      }
                      granularity="minute"
                      isInvalid={!!errors.registrationWindow}
                      errorMessage={errors.registrationWindow}
                    />
                    <p className="text-xs text-foreground-500">
                      Times are displayed in your local timezone and saved in
                      UTC.
                    </p>
                  </div>
                </CardBody>
              </Card>
            </div>
            <div className="space-y-6">
              <NumberInput
                label="Number of Players On A Team"
                placeholder="Enter number of players"
                value={players}
                onValueChange={setPlayers}
                min={1}
                max={100}
                isInvalid={!!errors.players}
                errorMessage={errors.players}
              />
              <NumberInput
                label="Max Registered Teams (Optional)"
                placeholder="Leave blank for unlimited"
                value={maxTeams}
                onValueChange={(value) => {
                  setMaxTeams(
                    typeof value === "number" &&
                      Number.isFinite(value) &&
                      value > 0
                      ? value
                      : undefined,
                  );
                }}
                min={1}
                isInvalid={!!errors.maxTeams}
                errorMessage={errors.maxTeams}
              />
              <NumberInput
                label="Prize Pool ($)"
                placeholder="Enter prize amount"
                value={prizePool}
                onValueChange={setPrizePool}
                min={0}
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">$</span>
                  </div>
                }
                isInvalid={!!errors.prizePool}
                errorMessage={errors.prizePool}
              />
              <Select
                label="Tee"
                selectedKeys={[tee]}
                disallowEmptySelection
                classNames={{
                  trigger: "bg-content2",
                  popoverContent: "min-w-[160px]",
                }}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  if (val && isTeeColor(val)) setTee(val);
                }}
                renderValue={(items) => {
                  const val = items[0]?.key as string | undefined;
                  const cls = (v: string | undefined) =>
                    v === "Blue"
                      ? "text-blue-600 dark:text-blue-300"
                      : v === "White"
                        ? "text-default-700 dark:text-default-300"
                        : v === "Gold"
                          ? "text-yellow-600 dark:text-yellow-400"
                          : v === "Red"
                            ? "text-red-600 dark:text-red-400"
                            : "text-teal-600 dark:text-teal-400";
                  return (
                    <div className={`flex items-center gap-2 ${cls(val)}`}>
                      <Icon icon="lucide:flag" className="w-4 h-4 opacity-70" />
                      <span>{val}</span>
                    </div>
                  );
                }}
              >
                {["Blue", "White", "Gold", "Red", "Mixed"].map((opt) => (
                  <SelectItem
                    key={opt}
                    textValue={opt}
                    className="flex items-center"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          opt === "Blue"
                            ? "w-3 h-3 rounded-full bg-blue-500 inline-block"
                            : opt === "White"
                              ? "w-3 h-3 rounded-full bg-default-300 inline-block border border-default-400"
                              : opt === "Gold"
                                ? "w-3 h-3 rounded-full bg-yellow-500 inline-block"
                                : opt === "Red"
                                  ? "w-3 h-3 rounded-full bg-red-500 inline-block"
                                  : "w-3 h-3 rounded-full bg-teal-500 inline-block"
                        }
                      />
                      <span
                        className={
                          opt === "Blue"
                            ? "text-blue-600 dark:text-blue-300"
                            : opt === "White"
                              ? "text-default-700 dark:text-default-300"
                              : opt === "Gold"
                                ? "text-yellow-600 dark:text-yellow-400"
                                : opt === "Red"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-teal-600 dark:text-teal-400"
                        }
                      >
                        {opt}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </Select>

              <Checkbox
                isSelected={assignedTeeTimes}
                onValueChange={setAssignedTeeTimes}
              >
                Assigned tee times
              </Checkbox>
              <Select
                label="Previous Year's Tournament (Optional)"
                placeholder="Link to previous tournament"
                description="Show the defending champion from last year"
                selectedKeys={
                  previousTournamentId ? [previousTournamentId] : []
                }
                classNames={{
                  trigger: "bg-content2",
                }}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string | undefined;
                  setPreviousTournamentId(val || undefined);
                }}
              >
                {allTournaments
                  .filter(
                    (t) =>
                      t.firestoreId &&
                      t.firestoreId !== tournament?.firestoreId,
                  )
                  .map((t) => {
                    const year = t.date.getFullYear();
                    const label = `${t.title} (${year})`;
                    return (
                      <SelectItem key={t.firestoreId!} textValue={label}>
                        <div className="flex flex-col">
                          <span>{t.title}</span>
                          <span className="text-xs text-default-400">
                            {year}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
              </Select>

              {/* Weather Section */}
              <Card>
                <CardBody className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      Tournament Weather
                    </h3>
                    <Button
                      size="sm"
                      variant="flat"
                      onPress={handleFetchWeather}
                      isLoading={fetchingWeather}
                      isDisabled={!date}
                      startContent={
                        !fetchingWeather && (
                          <Icon icon="lucide:cloud" className="w-4 h-4" />
                        )
                      }
                    >
                      {weather ? "Refresh" : "Fetch"} Weather
                    </Button>
                  </div>
                  {weather ? (
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-foreground-500 text-xs">Condition</p>
                        <p className="font-medium">{weather.condition}</p>
                      </div>
                      <div>
                        <p className="text-foreground-500 text-xs">
                          Temperature
                        </p>
                        <p className="font-medium">{weather.temperature}°F</p>
                      </div>
                      <div>
                        <p className="text-foreground-500 text-xs">
                          Wind Speed
                        </p>
                        <p className="font-medium">{weather.windSpeed} mph</p>
                      </div>
                      <div>
                        <p className="text-foreground-500 text-xs">
                          Precipitation
                        </p>
                        <p className="font-medium">{weather.precipitation}"</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-500">
                      {date
                        ? "Click 'Fetch Weather' to load historical weather data"
                        : "Set a tournament date to fetch weather"}
                    </p>
                  )}
                </CardBody>
              </Card>

              <div className="flex flex-col gap-4 pt-2">
                <Select
                  label="Status"
                  selectedKeys={[status]}
                  disallowEmptySelection
                  onSelectionChange={(keys) => {
                    const key = Array.from(keys)[0] as
                      | TournamentStatus
                      | undefined;
                    const v = key ?? TournamentStatus.Upcoming;
                    setStatus(v);
                    // Allow winners to be managed when a tournament is In Progress
                    // or Completed so editors can add results while the event is running.
                    setCompleted(
                      v === TournamentStatus.Completed ||
                        v === TournamentStatus.InProgress,
                    );
                  }}
                >
                  <SelectItem
                    key={TournamentStatus.Upcoming}
                    textValue="Upcoming"
                  >
                    Upcoming (Registration Closed)
                  </SelectItem>
                  <SelectItem
                    key={TournamentStatus.InProgress}
                    textValue="In Progress"
                  >
                    In Progress
                  </SelectItem>
                  <SelectItem
                    key={TournamentStatus.Completed}
                    textValue="Completed"
                  >
                    Tournament Completed
                  </SelectItem>
                  <SelectItem
                    key={TournamentStatus.Canceled}
                    textValue="Canceled"
                  >
                    Tournament Canceled
                  </SelectItem>
                </Select>
              </div>
            </div>
          </div>
          {(isEditing ||
            status === TournamentStatus.Completed ||
            status === TournamentStatus.InProgress) && (
            <div className="pt-4">
              <Divider className="my-4" />
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <GroupedWinnersEditor
                    groups={winnerGroups}
                    onChange={setWinnerGroups}
                    teamSize={players}
                    prizePool={prizePool}
                    isCompleted={completed}
                    registrations={registrations}
                  />
                  {errors.winners && (
                    <p className="text-danger text-sm mt-2">{errors.winners}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {isEditing && (
            <div className="pt-6">
              <Divider className="my-4" />
              <h3 className="text-lg font-medium mb-2">Registrations</h3>
              {isAdmin && (
                <div className="mb-4 flex items-center gap-3">
                  <Button
                    size="sm"
                    color="primary"
                    startContent={<PlusIcon className="w-4 h-4" />}
                    onPress={() => setAddOpen(true)}
                  >
                    Add Registration
                  </Button>
                  <div className="text-xs text-foreground-500">
                    Team size: {players}
                  </div>
                </div>
              )}
              {regsLoading ? (
                <div>Loading registrations...</div>
              ) : registrations.length === 0 ? (
                <div className="text-sm text-foreground-500">
                  No registrations yet.
                </div>
              ) : (
                <RegistrationsList
                  registrations={registrations}
                  users={allUsers}
                  players={players}
                  editingId={editingRegId}
                  onStartEdit={(reg) => startEdit(reg)}
                  onCancelEdit={() => cancelEdit()}
                  onSave={async (regId, ids) => {
                    const team = ids.map((id) => {
                      const u = allUsers.find((x) => x.id === id);
                      return {
                        id,
                        displayName: u?.displayName || u?.email || id,
                      };
                    });
                    try {
                      const { doc, updateDoc } = await import(
                        "firebase/firestore"
                      );
                      const { db } = await import("@/config/firebase");
                      const regRef = doc(
                        db,
                        "tournaments",
                        tournament!.firestoreId!,
                        "registrations",
                        regId,
                      );
                      await updateDoc(regRef, { team });
                      setRegistrations((prev) =>
                        prev.map((r) => (r.id === regId ? { ...r, team } : r)),
                      );
                      addToast({
                        title: "Saved",
                        description: "Registration updated.",
                        color: "success",
                      });
                      cancelEdit();
                    } catch (err) {
                      console.error("Failed to save registration", err);
                      addToast({
                        title: "Error",
                        description: "Failed to save registration.",
                        color: "danger",
                      });
                    }
                  }}
                  onDelete={async (regId) => {
                    await deleteRegistration(regId);
                  }}
                />
              )}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <Button color="default" variant="flat" onPress={onCancel}>
              Cancel
            </Button>
            <Button
              color="primary"
              type="submit"
              isLoading={isSubmitting}
              startContent={!isSubmitting && <Icon icon="lucide:save" />}
            >
              {isEditing ? "Update Tournament" : "Create Tournament"}
            </Button>
          </div>
        </form>
        {addOpen && isAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => {
                if (!adding) {
                  setAddOpen(false);
                  setNewMembers([""]);
                }
              }}
            />
            <div className="bg-background dark:bg-default-100 rounded-lg p-6 w-full max-w-lg z-10">
              <h3 className="text-lg font-medium mb-2">Add Registration</h3>
              <RegistrationEditor
                value={newMembers}
                onChange={setNewMembers}
                users={allUsers}
                maxSize={players}
                disableAutoSelect={true}
              />
              <div className="h-4" />
              <div className="flex justify-end gap-2">
                <Button
                  variant="flat"
                  onPress={() => {
                    if (!adding) {
                      setAddOpen(false);
                      setNewMembers([""]);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  isLoading={adding}
                  onPress={submitNewRegistration}
                  isDisabled={newMembers.filter(Boolean).length === 0}
                >
                  Add
                </Button>
              </div>
            </div>
          </div>
        )}
        {detailsPopoutOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setDetailsPopoutOpen(false)}
            />
            <div className="bg-background dark:bg-default-100 rounded-lg p-4 w-full max-w-5xl z-10 max-h-[80vh]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-medium">Details (Popout Editor)</h3>
                <Button
                  variant="flat"
                  onPress={() => setDetailsPopoutOpen(false)}
                >
                  Close
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[70vh]">
                <div className="col-span-1 h-full">
                  <div className="h-full">
                    <MarkdownEditor
                      value={detailsMarkdown}
                      onChange={setDetailsMarkdown}
                      minRows={20}
                      forceEdit
                      hidePreviewToggle
                      fillHeight
                      label="Editor"
                      placeholder="Edit tournament details (markdown)"
                    />
                  </div>
                </div>
                <div className="col-span-1 border rounded-md p-3 bg-content2 h-full overflow-auto prose dark:prose-invert">
                  {detailsMarkdown.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {detailsMarkdown}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-foreground-500 italic">No content</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
};

export default TournamentEditor;
