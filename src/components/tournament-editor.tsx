import React from "react";
import { Card, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { addToast } from "@/providers/toast";
import {
  Tournament,
  TournamentStatus,
  TournamentWeather,
} from "@/types/tournament";
import type { WinnerGroup, WinnerPlace } from "@/types/winner";
import { getStatus, parseToDate } from "@/utils/tournamentStatus";
import { auth } from "@/config/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { useAdminFlag } from "@/components/membership/hooks";
import { User } from "@/api/users";
import { isActiveFullMember } from "@/utils/membership";
import type { Registration } from "@/components/registrations-list";
import {
  parseDate,
  parseDateTime,
  DateValue,
  CalendarDateTime,
} from "@internationalized/date";
import { computeTotalPayout } from "@/utils/winners";
import type { DocumentData } from "firebase/firestore";
import * as Sentry from "@sentry/react";

import { BasicInfoSection } from "@/components/tournament-editor/BasicInfoSection";
import { RegistrationWindowSection } from "@/components/tournament-editor/RegistrationWindowSection";
import {
  SettingsSection,
  TeeColor,
  isTeeColor,
} from "@/components/tournament-editor/SettingsSection";
import { WinnersSection } from "@/components/tournament-editor/WinnersSection";
import { RegistrationsSection } from "@/components/tournament-editor/RegistrationsSection";
import { BracketSection } from "@/components/tournament-editor/BracketSection";
import { DetailsPopoutModal } from "@/components/tournament-editor/DetailsPopoutModal";

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
  const [registrationOpeningNotificationEnabled, setRegistrationOpeningNotificationEnabled] =
    React.useState<boolean>(
      seed.registrationOpeningNotificationEnabled !== false,
    );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [registrations, setRegistrations] = React.useState<Registration[]>([]);
  const [regsLoading, setRegsLoading] = React.useState(false);
  const [editingRegId, setEditingRegId] = React.useState<string | null>(null);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const activeUsers = React.useMemo(
    () => allUsers.filter((u) => !u.isMigrated && isActiveFullMember(u)),
    [allUsers],
  );
  const [allTournaments, setAllTournaments] = React.useState<Tournament[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newMembers, setNewMembers] = React.useState<string[]>([""]); // start with one slot
  const [newOpenSpotsOptIn, setNewOpenSpotsOptIn] = React.useState(false);
  const [adding, setAdding] = React.useState(false);
  const [detailsPopoutOpen, setDetailsPopoutOpen] = React.useState(false);
  const [regsOpen, setRegsOpen] = React.useState(false);
  const [bracketOpen, setBracketOpen] = React.useState(false);
  const [publishingBracket, setPublishingBracket] = React.useState(false);
  const [weather, setWeather] = React.useState<TournamentWeather | null>(
    seed.weather || null,
  );
  const [fetchingWeather, setFetchingWeather] = React.useState(false);

  const { user } = useAuth();
  const { isAdmin } = useAdminFlag(user);
  const incomingPreviousTournamentId =
    tournament?.previousTournamentId ?? undefined;
  const tournamentId = tournament?.firestoreId ?? null;

  // Sync previousTournamentId state with tournament prop updates
  React.useEffect(() => {
    if (incomingPreviousTournamentId !== previousTournamentId) {
      setPreviousTournamentId(incomingPreviousTournamentId);
    }
  }, [incomingPreviousTournamentId, previousTournamentId]);

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
      Sentry.captureException(error);
      addToast({
        title: "Error",
        description: "Failed to fetch weather data",
        color: "danger",
      });
    } finally {
      setFetchingWeather(false);
    }
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
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

      tournamentData.registrationOpeningNotificationEnabled =
        registrationOpeningNotificationEnabled;

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
      let createdDocRef: { id?: string } | null = null;
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
        registrationOpeningNotificationEnabled,
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
      Sentry.captureException(error);
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
      if (!tournamentId) return;
      setRegsLoading(true);
      try {
        const { collection, onSnapshot, orderBy, query } =
          await import("firebase/firestore");
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
          tournamentId,
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
  }, [tournamentId]);

  // Load all tournaments for the previous tournament selector
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

  const startEdit = (reg: Registration) => setEditingRegId(reg.id);
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
      Sentry.captureException(err);
      addToast({
        title: "Error",
        description: "Failed to delete registration.",
        color: "danger",
      });
    }
  };

  const handleSaveEdit = async (
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
      Sentry.captureException(err);
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
      setNewMembers([""]); // reset
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

  return (
    <Card className="w-full flex flex-col">
      <Card.Content className="p-6 flex-1">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">
            {isEditing ? "Edit Tournament" : "Create New Tournament"}
          </h2>
          <Button
            variant="ghost"
            isIconOnly
            onPress={onCancel}
            aria-label="Cancel"
          >
            <Icon icon="lucide:x" className="text-lg" />
          </Button>
        </div>
        <form
          id="tournament-editor-form"
          onSubmit={handleSubmit}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-6 min-w-0">
              <BasicInfoSection
                title={title}
                setTitle={setTitle}
                description={description}
                setDescription={setDescription}
                detailsMarkdown={detailsMarkdown}
                setDetailsMarkdown={setDetailsMarkdown}
                date={date}
                setDate={setDate}
                errors={errors}
                onPopoutOpen={() => setDetailsPopoutOpen(true)}
              />
              <RegistrationWindowSection
                registrationStart={registrationStart}
                setRegistrationStart={setRegistrationStart}
                registrationEnd={registrationEnd}
                setRegistrationEnd={setRegistrationEnd}
                registrationOpeningNotificationEnabled={
                  registrationOpeningNotificationEnabled
                }
                setRegistrationOpeningNotificationEnabled={
                  setRegistrationOpeningNotificationEnabled
                }
                tournamentDate={date}
                errors={errors}
              />
            </div>
            <SettingsSection
              players={players}
              setPlayers={setPlayers}
              maxTeams={maxTeams}
              setMaxTeams={setMaxTeams}
              prizePool={prizePool}
              setPrizePool={setPrizePool}
              tee={tee}
              setTee={setTee}
              assignedTeeTimes={assignedTeeTimes}
              setAssignedTeeTimes={setAssignedTeeTimes}
              goldTeesEnabled={goldTeesEnabled}
              setGoldTeesEnabled={setGoldTeesEnabled}
              isAdmin={isAdmin}
              previousTournamentId={previousTournamentId}
              setPreviousTournamentId={setPreviousTournamentId}
              allTournaments={allTournaments}
              currentTournamentId={tournament?.firestoreId}
              status={status}
              setStatus={setStatus}
              setCompleted={setCompleted}
              weather={weather}
              date={date}
              fetchingWeather={fetchingWeather}
              onFetchWeather={handleFetchWeather}
              errors={errors}
            />
          </div>

          <WinnersSection
            isEditing={isEditing}
            status={status}
            winnerGroups={winnerGroups}
            setWinnerGroups={setWinnerGroups}
            players={players}
            prizePool={prizePool}
            completed={completed}
            registrations={registrations}
            errors={errors}
          />

          {isEditing && (
            <RegistrationsSection
              isAdmin={isAdmin}
              regsOpen={regsOpen}
              setRegsOpen={setRegsOpen}
              addOpen={addOpen}
              setAddOpen={setAddOpen}
              regsLoading={regsLoading}
              registrations={registrations}
              allUsers={allUsers}
              activeUsers={activeUsers}
              players={players}
              editingRegId={editingRegId}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onSaveEdit={handleSaveEdit}
              onDelete={deleteRegistration}
              newMembers={newMembers}
              setNewMembers={setNewMembers}
              newOpenSpotsOptIn={newOpenSpotsOptIn}
              setNewOpenSpotsOptIn={setNewOpenSpotsOptIn}
              adding={adding}
              onSubmitNewRegistration={submitNewRegistration}
            />
          )}

          {isEditing && tournament?.firestoreId && (
            <BracketSection
              bracketOpen={bracketOpen}
              setBracketOpen={setBracketOpen}
              publishingBracket={publishingBracket}
              setPublishingBracket={setPublishingBracket}
              tournament={tournament}
              registrations={registrations}
              allUsers={allUsers}
            />
          )}

          <div className="pt-4" />
        </form>
      </Card.Content>
      <Card.Footer className="flex justify-end gap-3 px-6 py-4 border-t border-divider bg-background shrink-0 sticky bottom-0 z-10">
        <Button variant="tertiary" onPress={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="tournament-editor-form"
          isDisabled={isSubmitting}
        >
          {!isSubmitting && <Icon icon="lucide:save" />}
          {isEditing ? "Update Tournament" : "Create Tournament"}
        </Button>
      </Card.Footer>

      <DetailsPopoutModal
        isOpen={detailsPopoutOpen}
        onClose={() => setDetailsPopoutOpen(false)}
        value={detailsMarkdown}
        onChange={setDetailsMarkdown}
      />
    </Card>
  );
};

export default TournamentEditor;
