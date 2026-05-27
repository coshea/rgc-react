import React from "react";
import { addToast } from "@/providers/toast";
import { Tournament, TournamentStatus } from "@/types/tournament";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { getStatus, parseToDate } from "@/utils/tournamentStatus";
import { auth } from "@/config/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/components/membership/hooks";
import type { User } from "@/api/users";
import { isActiveFullMember } from "@/utils/membership";
import {
  parseDate,
  parseDateTime,
  DateValue,
  CalendarDateTime,
} from "@internationalized/date";
import { computeTotalPayout } from "@/utils/winners";
import type { DocumentData } from "firebase/firestore";
import { setBracketPublished } from "@/api/tournaments";
import type {
  TeeColor,
  TournamentRegistration,
  TournamentEditorFormState,
} from "./types";
import { isTeeColor } from "./types";
import { BasicInfoSection } from "./BasicInfoSection";
import { TournamentSettingsSection } from "./TournamentSettingsSection";
import { WinnersSection } from "./WinnersSection";
import { RegistrationsSection } from "./RegistrationsSection";
import { BracketSection } from "./BracketSection";
import { DetailsPopout } from "./DetailsPopout";

export interface TournamentEditorFormProps {
  tournament?: Tournament | null;
  initialValues?: Partial<Tournament>;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
  onFormStateChange?: (state: TournamentEditorFormState) => void;
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

export const TournamentEditorForm: React.FC<TournamentEditorFormProps> = ({
  tournament,
  initialValues,
  onSave,
  onFormStateChange,
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
  const [winnerGroups, setWinnerGroups] = React.useState<WinnerGroup[]>(
    tournament?.winnerGroups ?? [],
  );
  const [status, setStatus] = React.useState<TournamentStatus>(getStatus(seed));
  const [tee, setTee] = React.useState<TeeColor>(
    isTeeColor(seed.tee) ? (seed.tee as TeeColor) : "Mixed",
  );
  const [assignedTeeTimes, setAssignedTeeTimes] = React.useState<boolean>(
    Boolean(seed.assignedTeeTimes),
  );
  const [goldTeesEnabled, setGoldTeesEnabled] = React.useState<boolean>(
    Boolean(seed.goldTeesEnabled),
  );
  const [date, setDate] = React.useState<DateValue | null>(
    seed.date ? parseDate(seed.date.toISOString().split("T")[0]) : null,
  );
  const [previousTournamentId, setPreviousTournamentId] = React.useState<
    string | undefined
  >(seed.previousTournamentId);
  const [registrationStart, setRegistrationStart] =
    React.useState<CalendarDateTime | null>(
      seed.registrationStart
        ? parseDateTime(formatForDateTimeInput(seed.registrationStart))
        : null,
    );
  const [registrationEnd, setRegistrationEnd] =
    React.useState<CalendarDateTime | null>(
      seed.registrationEnd
        ? parseDateTime(formatForDateTimeInput(seed.registrationEnd))
        : null,
    );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [registrations, setRegistrations] = React.useState<
    TournamentRegistration[]
  >([]);
  const [regsLoading, setRegsLoading] = React.useState(false);
  const [editingRegId, setEditingRegId] = React.useState<string | null>(null);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const activeUsers = React.useMemo(
    () => allUsers.filter((u) => !u.isMigrated && isActiveFullMember(u)),
    [allUsers],
  );
  const [allTournaments, setAllTournaments] = React.useState<Tournament[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newMembers, setNewMembers] = React.useState<string[]>([""]);
  const [newOpenSpotsOptIn, setNewOpenSpotsOptIn] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [detailsPopoutOpen, setDetailsPopoutOpen] = React.useState(false);
  const [regsOpen, setRegsOpen] = React.useState(false);
  const [bracketOpen, setBracketOpen] = React.useState(false);
  const [publishingBracket, setPublishingBracket] = React.useState(false);
  const [weather, setWeather] = React.useState<
    import("@/types/tournament").TournamentWeather | null
  >(seed.weather || null);
  const [fetchingWeather, setFetchingWeather] = React.useState(false);

  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);

  // Notify parent when isSubmitting changes
  React.useEffect(() => {
    onFormStateChange?.({ isSubmitting });
  }, [isSubmitting, onFormStateChange]);

  React.useEffect(() => {
    if (tournament?.previousTournamentId !== previousTournamentId) {
      setPreviousTournamentId(tournament?.previousTournamentId);
    }
  }, [tournament?.previousTournamentId]);

  // Real-time registrations + users subscription
  React.useEffect(() => {
    let unsubRegs: (() => void) | null = null;
    let unsubUsers: (() => void) | null = null;
    const init = async () => {
      if (!tournament || !tournament.firestoreId) return;
      setRegsLoading(true);
      try {
        const { collection, onSnapshot, orderBy, query } =
          await import("firebase/firestore");
        const { db } = await import("@/config/firebase");
        const usersCol = collection(db, "users");
        unsubUsers = onSnapshot(usersCol, (snap) => {
          const list: User[] = snap.docs.map((d) => {
            const data = d.data() as unknown as Omit<User, "id">;
            return { id: d.id, ...data };
          });
          setAllUsers(list);
        });
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
              return { id: d.id, ...data } as TournamentRegistration;
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

  // Load all tournaments for previous tournament selector
  React.useEffect(() => {
    let unsubTournaments: (() => void) | null = null;
    const loadTournaments = async () => {
      try {
        const { collection, onSnapshot, orderBy, query } =
          await import("firebase/firestore");
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

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    if (players < 1) newErrors.players = "Must have at least 1 player";
    if (maxTeams !== undefined && maxTeams < 1)
      newErrors.maxTeams = "Must be at least 1 team";
    if (prizePool < 0) newErrors.prizePool = "Prize pool cannot be negative";
    const parsedStart = registrationStart
      ? new Date(registrationStart.toString())
      : undefined;
    const parsedEnd = registrationEnd
      ? new Date(registrationEnd.toString())
      : undefined;
    if (
      parsedStart &&
      parsedEnd &&
      parsedStart.getTime() > parsedEnd.getTime()
    ) {
      newErrors.registrationWindow =
        "Registration closing time must be after the opening time";
    }
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
      const { collection, addDoc, updateDoc, doc, deleteField } =
        await import("firebase/firestore");
      const sanitizedGroups: WinnerGroup[] = (winnerGroups || []).map((g) => ({
        ...g,
        winners: (g.winners || []).map((w): WinnerPlace => {
          const out: WinnerPlace = {
            id: w.id,
            place: w.place,
            competitors: w.competitors || [],
          };
          if (w.prizeAmount !== undefined && w.prizeAmount !== null)
            out.prizeAmount = w.prizeAmount;
          if (w.score !== undefined && w.score !== null) out.score = w.score;
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
        winnerGroups: sanitizedGroups,
        date: date ? new Date(date.toString()) : new Date(),
        tee,
        assignedTeeTimes,
        goldTeesEnabled,
      };

      const parsedStart = registrationStart
        ? new Date(registrationStart.toString())
        : undefined;
      const parsedEnd = registrationEnd
        ? new Date(registrationEnd.toString())
        : undefined;

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

      if (weather) {
        tournamentData.weather = weather;
      } else if (tournament && tournament.firestoreId) {
        tournamentData.weather = deleteField();
      }

      if (previousTournamentId) {
        tournamentData.previousTournamentId = previousTournamentId;
      } else if (tournament && tournament.firestoreId) {
        tournamentData.previousTournamentId = deleteField();
      }

      const colRef = collection(db, "tournaments");
      let createdDocRef: { id: string } | null = null;
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
        goldTeesEnabled,
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

  const startEdit = (reg: TournamentRegistration) => setEditingRegId(reg.id);
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

  const saveRegistration = async (
    regId: string,
    ids: string[],
    openSpotsOptIn: boolean,
    goldTees: string[],
  ) => {
    const team = ids.map((id) => {
      const u = allUsers.find((x) => x.id === id);
      return {
        id,
        displayName: u?.displayName || u?.email || id,
        ...(goldTees.includes(id) ? { goldTee: true } : {}),
      };
    });
    try {
      const { doc, updateDoc } = await import("firebase/firestore");
      const { db } = await import("@/config/firebase");
      const regRef = doc(
        db,
        "tournaments",
        tournament!.firestoreId!,
        "registrations",
        regId,
      );
      await updateDoc(regRef, { team, openSpotsOptIn });
      setRegistrations((prev) =>
        prev.map((r) => (r.id === regId ? { ...r, team, openSpotsOptIn } : r)),
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
      const minTeamSize = players > 1 ? 2 : 1;
      if (cleaned.length < minTeamSize) {
        addToast({
          title: "Team too small",
          description:
            minTeamSize === 1
              ? "Please add at least one player."
              : "Teams must have at least 2 players for this tournament.",
          color: "danger",
        });
        return;
      }
      const { db } = await import("@/config/firebase");
      const { collection, addDoc, serverTimestamp } =
        await import("firebase/firestore");
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
      const ownerId = cleaned[0] || "__admin__";
      const docRef = await addDoc(colRef, {
        ownerId,
        team,
        openSpotsOptIn: newOpenSpotsOptIn,
        registeredAt: serverTimestamp(),
      });
      setRegistrations((prev) => [
        ...prev,
        { id: docRef.id, ownerId, team, openSpotsOptIn: newOpenSpotsOptIn },
      ]);
      addToast({
        title: "Added",
        description: "Registration created.",
        color: "success",
      });
      setAddOpen(false);
      setNewMembers([""]);
      setNewOpenSpotsOptIn(false);
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

  const handlePublishBracket = async () => {
    if (!tournament?.firestoreId) return;
    setPublishingBracket(true);
    try {
      const next = !tournament.bracketPublished;
      await setBracketPublished(tournament.firestoreId, next);
      addToast({
        title: next ? "Bracket published" : "Bracket unpublished",
        description: next
          ? "The bracket is now visible to all members."
          : "The bracket is now hidden from members.",
        color: next ? "success" : "default",
      });
    } catch {
      addToast({
        title: "Update failed",
        description: "Could not update bracket visibility.",
        color: "danger",
      });
    } finally {
      setPublishingBracket(false);
    }
  };

  const showWinners =
    isEditing ||
    status === TournamentStatus.Completed ||
    status === TournamentStatus.InProgress;

  return (
    <>
      <form
        id="tournament-editor-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <BasicInfoSection
            title={title}
            onTitleChange={setTitle}
            description={description}
            onDescriptionChange={setDescription}
            detailsMarkdown={detailsMarkdown}
            onDetailsMarkdownChange={setDetailsMarkdown}
            date={date}
            onDateChange={setDate}
            registrationStart={registrationStart}
            onRegistrationStartChange={setRegistrationStart}
            registrationEnd={registrationEnd}
            onRegistrationEndChange={setRegistrationEnd}
            errors={errors}
            onOpenDetailsPopout={() => setDetailsPopoutOpen(true)}
          />
          <TournamentSettingsSection
            players={players}
            onPlayersChange={setPlayers}
            maxTeams={maxTeams}
            onMaxTeamsChange={setMaxTeams}
            prizePool={prizePool}
            onPrizePoolChange={setPrizePool}
            tee={tee}
            onTeeChange={setTee}
            assignedTeeTimes={assignedTeeTimes}
            onAssignedTeeTimesChange={setAssignedTeeTimes}
            goldTeesEnabled={goldTeesEnabled}
            onGoldTeesEnabledChange={setGoldTeesEnabled}
            previousTournamentId={previousTournamentId}
            onPreviousTournamentIdChange={setPreviousTournamentId}
            allTournaments={allTournaments}
            currentTournamentFirestoreId={tournament?.firestoreId}
            isAdmin={isAdmin}
            status={status}
            onStatusChange={(v) => {
              setStatus(v);
              setCompleted(
                v === TournamentStatus.Completed ||
                  v === TournamentStatus.InProgress,
              );
            }}
            weather={weather}
            date={date}
            fetchingWeather={fetchingWeather}
            onFetchWeather={handleFetchWeather}
            errors={errors}
          />
        </div>

        {showWinners && (
          <WinnersSection
            winnerGroups={winnerGroups}
            onWinnerGroupsChange={setWinnerGroups}
            players={players}
            prizePool={prizePool}
            isCompleted={completed}
            registrations={registrations}
            error={errors.winners}
          />
        )}

        {isEditing && (
          <RegistrationsSection
            isOpen={regsOpen}
            onToggle={() => setRegsOpen((o) => !o)}
            registrations={registrations}
            regsLoading={regsLoading}
            allUsers={allUsers}
            activeUsers={activeUsers}
            players={players}
            isAdmin={isAdmin}
            editingRegId={editingRegId}
            onStartEdit={startEdit}
            onCancelEdit={cancelEdit}
            onSaveRegistration={saveRegistration}
            onDeleteRegistration={deleteRegistration}
            addOpen={addOpen}
            onOpenAdd={() => setAddOpen(true)}
            onCloseAdd={() => setAddOpen(false)}
            newMembers={newMembers}
            onNewMembersChange={setNewMembers}
            newOpenSpotsOptIn={newOpenSpotsOptIn}
            onNewOpenSpotsOptInChange={setNewOpenSpotsOptIn}
            adding={adding}
            onSubmitNewRegistration={submitNewRegistration}
          />
        )}

        {isEditing && tournament?.firestoreId && (
          <BracketSection
            isOpen={bracketOpen}
            onToggle={() => setBracketOpen((o) => !o)}
            tournamentId={tournament.firestoreId}
            bracketPublished={tournament.bracketPublished ?? false}
            registrations={registrations}
            allUsers={allUsers}
            publishingBracket={publishingBracket}
            onPublishBracket={handlePublishBracket}
          />
        )}

        <div className="pt-4" />
      </form>

      <DetailsPopout
        isOpen={detailsPopoutOpen}
        onClose={() => setDetailsPopoutOpen(false)}
        value={detailsMarkdown}
        onChange={setDetailsMarkdown}
      />
    </>
  );
};
