import React from "react";
import {
  Card,
  CardBody,
  Input,
  Textarea,
  Button,
  DatePicker,
  Checkbox,
  NumberInput,
  Divider,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { auth } from "@/config/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import RegistrationEditor from "@/components/registration-editor";
import { getUsers, User } from "@/api/users";
import { Winner } from "@/types/winner";
import { parseDate, DateValue } from "@internationalized/date";
import { WinnerForm } from "@/components/winner-form";
import RegistrationsList from "@/components/registrations-list";

interface TournamentFormProps {
  tournament?: Tournament | null;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

export const TournamentForm: React.FC<TournamentFormProps> = ({
  tournament,
  onSave,
  onCancel,
}) => {
  const isEditing = !!tournament;

  const [title, setTitle] = React.useState(tournament?.title || "");
  const [description, setDescription] = React.useState(
    tournament?.description || ""
  );
  const [players, setPlayers] = React.useState(tournament?.players || 1);
  const [completed, setCompleted] = React.useState(
    tournament?.completed || false
  );
  const [canceled, setCanceled] = React.useState(tournament?.canceled || false);
  const [prizePool, setPrizePool] = React.useState(tournament?.prizePool || 0);
  const [winners, setWinners] = React.useState<Winner[]>(
    tournament?.winners || []
  );
  const [registrationOpen, setRegistrationOpen] = React.useState(
    tournament?.registrationOpen || false
  );
  const [date, setDate] = React.useState<DateValue | null>(
    tournament?.date
      ? parseDate(tournament.date.toISOString().split("T")[0])
      : null
  );

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [registrations, setRegistrations] = React.useState<any[]>([]);
  const [regsLoading, setRegsLoading] = React.useState(false);
  const [editingRegId, setEditingRegId] = React.useState<string | null>(null);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [addOpen, setAddOpen] = React.useState(false);
  const [newMembers, setNewMembers] = React.useState<string[]>([""]); // start with one slot
  const [adding, setAdding] = React.useState(false);

  const { user } = useAuth();
  const { userProfile } = useUserProfile();
  const isAdmin = !!(user && userProfile && (userProfile as any).admin === true);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    if (players < 1) newErrors.players = "Must have at least 1 player";
    if (prizePool < 0) newErrors.prizePool = "Prize pool cannot be negative";

    // Validate winners if tournament is completed
    if (completed && winners.length > 0) {
      const totalPrizeAmount = winners.reduce(
        (total, winner) => total + winner.prizeAmount * winner.userIds.length,
        0
      );

      if (totalPrizeAmount > prizePool) {
        newErrors.winners = "Total prize amount exceeds prize pool";
      }

      // Check if any winner has no users selected
      const hasEmptyWinners = winners.some(
        (winner) => winner.userIds.length === 0
      );
      if (hasEmptyWinners) {
        newErrors.winners = "All winners must have users selected";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Require authentication to write to Firestore according to security rules
      if (!auth || !auth.currentUser) {
        addToast({
          title: "Authentication required",
          description: "You must be signed in to save tournaments.",
          color: "danger",
        });
        setIsSubmitting(false);
        return;
      }
      // Persist to Firestore
      const { db } = await import("@/config/firebase");
      const { collection, addDoc, updateDoc, doc } = await import(
        "firebase/firestore"
      );

      const tournamentData: Partial<Tournament> = {
        title,
        description,
        players,
        completed,
        canceled,
        prizePool,
        winners,
        registrationOpen,
        date: date ? new Date(date.toString()) : new Date(),
      };

      const colRef = collection(db, "tournaments");

      let createdDocRef: any = null;

      if (tournament && tournament.firestoreId) {
        // Update using the Firestore document id when available
        const docRef = doc(db, "tournaments", tournament.firestoreId);
        await updateDoc(docRef, tournamentData as any);
      } else {
        // Create new tournament
        createdDocRef = await addDoc(colRef, tournamentData as any);
      }

      // Call onSave with a constructed Tournament object (date is Date)
      const savedTournament: Tournament = {
        title: tournamentData.title as string,
        description: tournamentData.description as string,
        players: tournamentData.players as number,
        completed: tournamentData.completed as boolean,
        canceled: tournamentData.canceled as boolean,
        prizePool: tournamentData.prizePool as number,
        winners: (tournamentData.winners as any) || [],
        registrationOpen: tournamentData.registrationOpen as boolean,
        date: tournamentData.date as Date,
      };

      // If we created a new Firestore doc, attach its id to the returned tournament
      if (createdDocRef && createdDocRef.id) {
        savedTournament.firestoreId = createdDocRef.id;
      } else if (tournament && tournament.firestoreId) {
        savedTournament.firestoreId = tournament.firestoreId;
      }

      onSave(savedTournament);

      // Show success toast
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

  // Fetch registrations for existing tournament (admin view)
  React.useEffect(() => {
    const load = async () => {
      if (!tournament || !tournament.firestoreId) return;
      setRegsLoading(true);
      try {
        const users = await getUsers();
        setAllUsers(users);
        const { collection, getDocs } = await import("firebase/firestore");
        const { db } = await import("@/config/firebase");
        const col = collection(
          db,
          "tournaments",
          tournament.firestoreId,
          "registrations"
        );
        const snaps = await getDocs(col);
        const list = snaps.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        }));
        setRegistrations(list);
      } catch (err) {
        console.error("Failed to load registrations", err);
        addToast({
          title: "Error",
          description: "Failed to load registrations",
          color: "danger",
        });
      } finally {
        setRegsLoading(false);
      }
    };

    load();
  }, [tournament?.firestoreId]);

  const startEdit = (reg: any) => {
    setEditingRegId(reg.id);
  };

  const cancelEdit = () => {
    setEditingRegId(null);
  };

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
        regId
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
        "registrations"
      );
      const docRef = await addDoc(colRef, {
        ownerId: "__admin__",
        team,
        registeredAt: serverTimestamp(),
      });
      setRegistrations((prev) => [...prev, { id: docRef.id, ownerId: "__admin__", team }]);
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

              <DatePicker
                label="Tournament Date"
                value={date}
                onChange={setDate}
                isRequired
                isInvalid={!!errors.date}
                errorMessage={errors.date}
              />

              {/* URL Path input removed */}
            </div>

            <div className="space-y-6">
              <NumberInput
                label="Number of Players"
                placeholder="Enter number of players"
                value={players}
                onValueChange={setPlayers}
                min={1}
                max={100}
                isInvalid={!!errors.players}
                errorMessage={errors.players}
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

              <div className="flex flex-col gap-4 pt-2">
                <Checkbox isSelected={completed} onValueChange={setCompleted}>
                  Tournament Completed
                </Checkbox>

                <Checkbox
                  isSelected={canceled}
                  onValueChange={setCanceled}
                  color="danger"
                >
                  Tournament Canceled
                </Checkbox>
                <Checkbox
                  isSelected={registrationOpen}
                  onValueChange={setRegistrationOpen}
                >
                  Registration Open
                </Checkbox>
              </div>

              {/* Tournament icon option removed; default icon used */}
            </div>
          </div>

          {/* Add Winners section */}
          {(isEditing || completed) && (
            <div className="pt-4">
              <Divider className="my-4" />
              <WinnerForm
                winners={winners}
                onWinnersChange={setWinners}
                teamSize={players}
                prizePool={prizePool}
                isCompleted={completed}
              />
              {errors.winners && (
                <p className="text-danger text-sm mt-2">{errors.winners}</p>
              )}
            </div>
          )}

          {isEditing && (
            <div className="pt-6">
              <Divider className="my-4" />
              <h3 className="text-lg font-medium mb-2">Registrations</h3>
              {isAdmin && (
                <div className="mb-4 flex items-center gap-3">
                  <Button size="sm" color="primary" onPress={() => setAddOpen(true)}>
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
                <div className="text-sm text-foreground-500">No registrations yet.</div>
              ) : (
                <RegistrationsList
                  registrations={registrations}
                  users={allUsers}
                  players={players}
                  editingId={editingRegId}
                  onStartEdit={(reg) => startEdit(reg)}
                  onCancelEdit={() => cancelEdit()}
                  onSave={async (regId, ids) => {
                    // convert ids to team objects and save via existing saveRegistration flow
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
                        regId
                      );
                      await updateDoc(regRef, { team });
                      setRegistrations((prev) =>
                        prev.map((r) => (r.id === regId ? { ...r, team } : r))
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
      </CardBody>
    </Card>
  );
};
