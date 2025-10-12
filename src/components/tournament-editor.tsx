import React from "react";
import {
  Card,
  CardBody,
  Input,
  Textarea,
  Button,
  DatePicker,
  RadioGroup,
  Radio,
  NumberInput,
  Divider,
  Select,
  SelectItem,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { Icon } from "@iconify/react";
import { Tournament, type TournamentStatus } from "@/types/tournament";
import { flagsToStatus, statusToFlags } from "@/utils/tournamentStatus";
import { auth } from "@/config/firebase";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
import RegistrationEditor from "@/components/registration-editor";
import { User } from "@/api/users";
import { parseDate, DateValue } from "@internationalized/date";
import GroupedWinnersEditor from "@/components/grouped-winners-editor";
import RegistrationsList from "@/components/registrations-list";
import { MarkdownEditor } from "@/components/markdown-editor";
import { PlusIcon } from "@heroicons/react/24/solid";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { computeTotalPayout } from "@/utils/winners";

interface TournamentEditorProps {
  tournament?: Tournament | null;
  // When creating, optional initial values to prepopulate the form
  initialValues?: Partial<Tournament>;
  onSave: (tournament: Tournament) => void;
  onCancel: () => void;
}

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
    seed.detailsMarkdown || ""
  );
  const [players, setPlayers] = React.useState(seed.players || 1);
  const [completed, setCompleted] = React.useState(!!seed.completed);
  // legacy booleans maintained through status; not read directly elsewhere
  const [, setCanceled] = React.useState(!!seed.canceled);
  const [prizePool, setPrizePool] = React.useState(seed.prizePool || 0);
  const [winnerGroups, setWinnerGroups] = React.useState<
    import("@/types/winner").WinnerGroup[]
  >(
    isEditing && (tournament as any)?.winnerGroups
      ? (tournament as any).winnerGroups
      : []
  );
  const [, setRegistrationOpen] = React.useState(!!seed.registrationOpen);
  const [status, setStatus] = React.useState<TournamentStatus>(
    (seed as any).status ||
      flagsToStatus({
        completed: !!seed.completed,
        canceled: !!seed.canceled,
        registrationOpen: !!seed.registrationOpen,
      })
  );
  type TeeColor = "Blue" | "White" | "Gold" | "Red" | "Mixed";
  const TEE_COLORS: TeeColor[] = ["Blue", "White", "Gold", "Red", "Mixed"];
  function isTeeColor(value: any): value is TeeColor {
    return TEE_COLORS.includes(value);
  }
  const [tee, setTee] = React.useState<TeeColor>(
    isTeeColor(seed.tee) ? seed.tee : "Mixed"
  );
  const [date, setDate] = React.useState<DateValue | null>(
    seed.date ? parseDate(seed.date.toISOString().split("T")[0]) : null
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
  const [detailsPopoutOpen, setDetailsPopoutOpen] = React.useState(false);

  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  // NOTE: Admin Add Registration workflow should not auto-select the current user.
  // Admins need the ability to add arbitrary registrations on behalf of others.

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = "Title is required";
    if (!description.trim()) newErrors.description = "Description is required";
    if (!date) newErrors.date = "Date is required";
    // markdown not required but if provided can be large; no validation now
    if (players < 1) newErrors.players = "Must have at least 1 player";
    if (prizePool < 0) newErrors.prizePool = "Prize pool cannot be negative";

    // Grouped winners validation replaces legacy winners
    if (completed && winnerGroups.length > 0) {
      const totalPrizeAmount = computeTotalPayout(winnerGroups);
      if (totalPrizeAmount > prizePool) {
        newErrors.winners = "Total prize amount exceeds prize pool";
      }
      const hasEmptyPlaces = winnerGroups.some((g) =>
        (g.winners || []).some(
          (w) => !w.competitors || w.competitors.length === 0
        )
      );
      if (hasEmptyPlaces) {
        newErrors.winners = "All winners must have competitors selected";
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
      const { collection, addDoc, updateDoc, doc } = await import(
        "firebase/firestore"
      );
      const computedFlags = statusToFlags(status);
      const tournamentData: Partial<Tournament> = {
        title,
        description,
        detailsMarkdown,
        players,
        status,
        completed: computedFlags.completed,
        canceled: computedFlags.canceled,
        prizePool,
        // winners removed (legacy); only persist grouped model going forward
        winnerGroups, // grouped model
        registrationOpen: computedFlags.registrationOpen,
        date: date ? new Date(date.toString()) : new Date(),
        tee,
      };
      const colRef = collection(db, "tournaments");
      let createdDocRef: any = null;
      if (tournament && tournament.firestoreId) {
        const docRef = doc(db, "tournaments", tournament.firestoreId);
        await updateDoc(docRef, tournamentData as any);
      } else {
        createdDocRef = await addDoc(colRef, tournamentData as any);
      }
      const savedTournament: Tournament = {
        title: tournamentData.title as string,
        description: tournamentData.description as string,
        detailsMarkdown: tournamentData.detailsMarkdown,
        players: tournamentData.players as number,
        status: tournamentData.status as TournamentStatus,
        completed: tournamentData.completed as boolean,
        canceled: tournamentData.canceled as boolean,
        prizePool: tournamentData.prizePool as number,
        winnerGroups: (tournamentData as any).winnerGroups || [],
        registrationOpen: tournamentData.registrationOpen as boolean,
        date: tournamentData.date as Date,
        tee: tournamentData.tee as any,
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
          const list: User[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as any),
          })) as User[];
          setAllUsers(list);
        });
        // Registrations real-time ordered by registeredAt
        const regsCol = collection(
          db,
          "tournaments",
          tournament.firestoreId,
          "registrations"
        );
        const qRegs = query(regsCol, orderBy("registeredAt", "asc"));
        unsubRegs = onSnapshot(
          qRegs,
          (snap) => {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...(d.data() as any),
            }));
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
          }
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
                  if (val) setTee(val as any);
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
              <div className="flex flex-col gap-4 pt-2">
                <RadioGroup
                  label="Status"
                  orientation="vertical"
                  value={status}
                  onValueChange={(val) => {
                    const v = (val as TournamentStatus) || "upcoming";
                    setStatus(v);
                    const flags = statusToFlags(v);
                    setCompleted(flags.completed);
                    setCanceled(flags.canceled);
                    setRegistrationOpen(flags.registrationOpen);
                  }}
                >
                  <Radio value="upcoming">Upcoming (Registration Closed)</Radio>
                  <Radio value="completed">Tournament Completed</Radio>
                  <Radio value="canceled" color="danger">
                    Tournament Canceled
                  </Radio>
                  <Radio value="open">Registration Open</Radio>
                </RadioGroup>
              </div>
            </div>
          </div>
          {(isEditing || completed) && (
            <div className="pt-4">
              <Divider className="my-4" />
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <h4 className="text-sm font-medium mb-2">Winners</h4>
                  <GroupedWinnersEditor
                    groups={winnerGroups}
                    onChange={setWinnerGroups}
                    teamSize={players}
                    prizePool={prizePool}
                    isCompleted={completed}
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
