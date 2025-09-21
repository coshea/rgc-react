import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Divider,
  addToast,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { db } from "@/config/firebase";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";

const TournamentRegister: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { users } = useUsers();

  // registration-related state must be declared before effects that use them
  const [teammates, setTeammates] = React.useState<string[]>([""]);
  const [submitting, setSubmitting] = React.useState(false);
  const { user } = useAuth();
  const [registrationId, setRegistrationId] = React.useState<string | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchTournament = async () => {
      if (!firestoreId) {
        addToast({
          title: "Error",
          description: "Missing tournament id",
          color: "danger",
        });
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, "tournaments", firestoreId);
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          addToast({
            title: "Not found",
            description: "Tournament not found",
            color: "danger",
          });
          setLoading(false);
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
        } as Tournament);
      } catch (error) {
        console.error("Error loading tournament:", error);
        addToast({
          title: "Error",
          description: "Failed to load tournament",
          color: "danger",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTournament();
  }, [firestoreId]);

  // Redirect unauthenticated users to login when they land on the register page
  React.useEffect(() => {
    // If we've loaded the tournament and the auth state is known and there is no user, redirect
    // We only redirect when loading is finished to avoid flicker.
    if (!loading && !user) {
      const fromPath = firestoreId
        ? `/tournaments/${firestoreId}/register`
        : "/tournaments";
      navigate("/login", {
        state: {
          from: fromPath,
          message: "You must be logged in to register for a tournament",
        },
        replace: true,
      });
    }
  }, [loading, user, navigate, firestoreId]);

  // load existing registration for current user
  React.useEffect(() => {
    const fetchExistingRegistration = async () => {
      if (!firestoreId || !user || !user.uid) return;
      try {
        const regCol = collection(
          db,
          "tournaments",
          firestoreId,
          "registrations"
        );
        const q = query(regCol, where("ownerId", "==", user.uid));
        const snaps = await getDocs(q);
        if (!snaps.empty) {
          const regDoc = snaps.docs[0];
          const regData: any = regDoc.data();
          setRegistrationId(regDoc.id);
          if (Array.isArray(regData.team) && regData.team.length > 0) {
            const ids = regData.team.map((m: any) => m.id || "");
            setTeammates(ids.length ? ids : [""]);
          }
        }
      } catch (err) {
        console.error("Failed to load existing registration", err);
      }
    };

    fetchExistingRegistration();
  }, [firestoreId, user]);

  const maxTeamSize = tournament?.players ?? 1;

  // Sanitize teammate IDs if users list changes (remove ids not present anymore)
  React.useEffect(() => {
    if (!users || users.length === 0) return;
    const valid = new Set(users.map((u) => u.id));
    let changed = false;
    const cleaned = teammates.map((id) =>
      id && valid.has(id) ? id : id === "" ? "" : ""
    );
    // If a non-empty id was removed due to being invalid, mark changed
    if (cleaned.some((id, i) => id !== teammates[i])) changed = true;
    // Ensure at least one slot
    if (cleaned.length === 0) cleaned.push("");
    if (changed) setTeammates(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  if (loading) return <div>Loading...</div>;

  if (!tournament) {
    return <div>Unable to find tournament.</div>;
  }

  const addTeammate = () => {
    if (teammates.length < maxTeamSize) setTeammates([...teammates, ""]);
  };

  // teammates state now stores user IDs directly; updateTeammate is not used

  const removeTeammate = (index: number) => {
    const copy = teammates.filter((_, i) => i !== index);
    setTeammates(copy);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tournament || !tournament.firestoreId) {
      addToast({
        title: "Error",
        description: "Invalid tournament",
        color: "danger",
      });
      return;
    }

    if (!tournament.registrationOpen) {
      addToast({
        title: "Closed",
        description: "Registration for this tournament is closed.",
        color: "danger",
      });
      return;
    }

    if (!user || !user.uid) {
      addToast({
        title: "Sign in",
        description: "You must be signed in to register.",
        color: "danger",
      });
      return;
    }

    // validate teammates - ensure no empty selections
    const selectedIds = teammates.filter((t) => t && t.trim().length > 0);
    if (selectedIds.length === 0) {
      addToast({
        title: "Error",
        description: "Please select at least one teammate.",
        color: "danger",
      });
      return;
    }

    // map ids to display names
    const members = selectedIds.map((id) => {
      const u = users.find((x) => x.id === id);
      return {
        id,
        displayName: u?.displayName || u?.email || id,
      };
    });

    // avoid duplicates
    const idsSet = new Set(members.map((m) => m.id));
    if (idsSet.size !== members.length) {
      addToast({
        title: "Error",
        description: "Duplicate users in team. Please select unique teammates.",
        color: "danger",
      });
      return;
    }

    setSubmitting(true);
    try {
      // write to subcollection tournaments/{id}/registrations
      const regCol = collection(
        db,
        "tournaments",
        tournament.firestoreId,
        "registrations"
      );

      const registration = {
        team: members,
        ownerId: user.uid,
        registeredAt: serverTimestamp(),
      } as any;

      if (registrationId) {
        // update existing registration
        const regRef = doc(
          db,
          "tournaments",
          tournament.firestoreId,
          "registrations",
          registrationId
        );
        await setDoc(regRef, registration, { merge: true });
      } else {
        await addDoc(regCol, registration);
      }

      addToast({
        title: "Registered",
        description: "Your team has been registered.",
        color: "success",
      });
      navigate("/tournaments");
    } catch (err) {
      console.error("Failed to register:", err);
      addToast({
        title: "Error",
        description: "Failed to register team.",
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!registrationId || !tournament?.firestoreId) return;
    setDeleting(true);
    try {
      const regRef = doc(
        db,
        "tournaments",
        tournament.firestoreId,
        "registrations",
        registrationId
      );
      await deleteDoc(regRef);
      addToast({
        title: "Cancelled",
        description: "Your registration has been removed.",
        color: "danger",
      });
      setRegistrationId(null);
      setTeammates([""]);
      setConfirmOpen(false);
    } catch (err) {
      console.error("Failed to delete registration", err);
      addToast({
        title: "Error",
        description: "Failed to cancel registration.",
        color: "danger",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardBody className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-medium">
                Register for {tournament.title}
              </h2>
              <p className="text-sm text-foreground-500">
                Maximum teammates: {maxTeamSize}
              </p>
              {registrationId ? (
                <p className="text-sm text-foreground-500 mt-2">
                  You're already registered — update your team below.
                </p>
              ) : null}
            </div>
            {tournament.icon ? (
              <img
                src={tournament.icon}
                alt={tournament.title}
                className="w-16 h-16 rounded-md object-cover border border-default-200"
              />
            ) : null}
          </div>

          <Divider className="my-4" />

          <form onSubmit={handleSubmit} className="space-y-4">
            {teammates.map((userId, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Select
                    label={i === 0 ? "Team Leader / You" : `Teammate ${i + 1}`}
                    placeholder="Select user"
                    selectionMode="single"
                    selectedKeys={userId ? new Set([userId]) : new Set()}
                    onSelectionChange={(keys) => {
                      const selected = Array.from(keys as Set<string>)[0] as
                        | string
                        | undefined;
                      const copy = [...teammates];
                      copy[i] = selected || "";
                      setTeammates(copy);
                    }}
                    className="w-full"
                  >
                    {users.map((u) => (
                      <SelectItem key={u.id}>
                        {u.displayName || u.email || u.id}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                {i > 0 && (
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    onPress={() => removeTeammate(i)}
                  >
                    <Icon icon="lucide:trash-2" />
                  </Button>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                color="primary"
                variant="flat"
                onPress={addTeammate}
                isDisabled={teammates.length >= maxTeamSize}
              >
                Add Teammate
              </Button>
              <div className="text-sm text-foreground-500">
                {teammates.length}/{maxTeamSize}
              </div>
            </div>

            {/* no free-text inputs: teammates are selected by user id via Select */}

            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2">
              {/* Left: cancel registration (owner only). Full width on mobile */}
              <div className="w-full sm:w-auto">
                {registrationId ? (
                  <div className="w-full sm:w-auto">
                    <Button
                      className="w-full sm:w-auto"
                      color="danger"
                      variant="flat"
                      onPress={() => setConfirmOpen(true)}
                      isDisabled={deleting}
                    >
                      {deleting ? "Cancelling..." : "Cancel registration"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {/* Right: navigation and submit. Stack on mobile, row on sm+ */}
              <div className="flex w-full sm:w-auto flex-col sm:flex-row items-center gap-2">
                <div className="w-full sm:w-auto">
                  <Button
                    className="w-full"
                    color="default"
                    variant="flat"
                    onPress={() => navigate(-1)}
                  >
                    Cancel
                  </Button>
                </div>

                <div className="w-full sm:w-auto">
                  <Button
                    className="w-full"
                    type="submit"
                    color="primary"
                    isDisabled={submitting}
                  >
                    {submitting
                      ? registrationId
                        ? "Updating..."
                        : "Registering..."
                      : registrationId
                        ? "Update registration"
                        : "Register"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Confirmation modal for cancelling registration */}
            {confirmOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div
                  className="absolute inset-0 bg-black opacity-40"
                  onClick={() => setConfirmOpen(false)}
                />
                <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 z-10 w-full max-w-md">
                  <h3 className="text-lg font-medium mb-2">
                    Cancel registration
                  </h3>
                  <p className="text-sm text-foreground-500 mb-4">
                    Are you sure you want to cancel your registration? This
                    cannot be undone.
                  </p>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="light"
                      color="default"
                      onPress={() => setConfirmOpen(false)}
                    >
                      Close
                    </Button>
                    <Button
                      color="danger"
                      onPress={handleConfirmCancel}
                      isDisabled={deleting}
                    >
                      {deleting ? "Cancelling..." : "Yes, cancel"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default TournamentRegister;
