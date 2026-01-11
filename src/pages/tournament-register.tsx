import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Divider,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
import { Tournament, TournamentStatus } from "@/types/tournament";
import { getStatus } from "@/utils/tournamentStatus";
// Firestore access now centralized in '@/api/tournaments'. We dynamically import for
// potential bundle splitting since registration flow is a narrower usage path.
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import RegistrationEditor from "@/components/registration-editor";
// Static import for registrations list to ensure test mocks attach
import { fetchAllRegistrations, upsertRegistration } from "@/api/tournaments";

const TournamentRegister: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { users } = useUsers();
  // Tournament registration is open to all authenticated users.
  // We still use the known users list to populate teammate selection.
  const selectableUsers = users;

  // registration-related state must be declared before effects that use them
  const [teammates, setTeammates] = React.useState<string[]>([""]);
  const [submitting, setSubmitting] = React.useState(false);
  const { user } = useAuth();
  const [registrationId, setRegistrationId] = React.useState<string | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  // Duplicate conflict confirmation modal state
  const [conflictModalOpen, setConflictModalOpen] = React.useState(false);
  const [conflicts, setConflicts] = React.useState<
    {
      playerId: string;
      playerName: string;
      teamRegistrationId: string;
      teamMembers: string[];
    }[]
  >([]);
  // Track if user has acknowledged conflicts to allow proceeding without re-check modal during this submission attempt
  const [conflictsAcknowledged, setConflictsAcknowledged] =
    React.useState(false);
  // Store prepared members for submission when conflicts need user confirmation
  const pendingMembersRef = React.useRef<{
    members: { id: string; displayName: string }[];
    ownerId: string;
  } | null>(null);

  const finalizeRegistration = React.useCallback(
    async (members: { id: string; displayName: string }[], ownerId: string) => {
      if (!tournament?.firestoreId) return;
      setSubmitting(true);
      try {
        await upsertRegistration(tournament.firestoreId, registrationId, {
          team: members,
          ownerId,
        });
        addToast({
          title: "Registered",
          description: "Your team has been registered.",
          color: "success",
        });
        pendingMembersRef.current = null;
        setConflictsAcknowledged(false);
        navigate(`/tournaments/${tournament.firestoreId}`, { replace: true });
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
    },
    [navigate, registrationId, tournament?.firestoreId]
  );
  // store registrations for conflict detection
  const [registrations, setRegistrations] = React.useState<any[]>([]);

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
        const api = await import("@/api/tournaments");
        const data = await api.fetchTournament(firestoreId);
        if (!data) {
          addToast({
            title: "Not found",
            description: "Tournament not found",
            color: "danger",
          });
          setLoading(false);
          return;
        }
        setTournament(data as Tournament);
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

  // Load all registrations for duplicate detection (static import so mocks work in tests)
  React.useEffect(() => {
    let cancelled = false;
    if (!firestoreId) return;
    (async () => {
      try {
        const all = await fetchAllRegistrations(firestoreId);
        if (!cancelled) setRegistrations(all);
      } catch (e) {
        console.warn("Failed to load registrations for conflict detection", e);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        const api = await import("@/api/tournaments");
        const existing = await api.fetchUserRegistration(firestoreId, user.uid);
        if (existing) {
          setRegistrationId(existing.id);
          const maybeTeam = (existing as Record<string, unknown>).team;
          if (Array.isArray(maybeTeam) && maybeTeam.length > 0) {
            const ids = maybeTeam.map((m) =>
              typeof m === "object" && m !== null
                ? (m as Record<string, unknown>).id
                : ""
            );
            const cleaned = ids
              .map((id) => (typeof id === "string" ? id : ""))
              .filter(Boolean);
            setTeammates(cleaned.length ? cleaned : [""]);
          }
        }
      } catch (err) {
        console.error("Failed to load existing registration", err);
      }
    };

    fetchExistingRegistration();
  }, [firestoreId, user]);

  const maxTeamSize = tournament?.players ?? 1;
  const minTeamSize = maxTeamSize <= 1 ? 1 : 2;

  // Ensure we render at least the minimum number of slots for this tournament.
  // This keeps the UI aligned with the min team size requirement (e.g., show 2 slots for team events).
  React.useEffect(() => {
    if (!tournament) return;
    setTeammates((prev) => {
      const next = Array.isArray(prev) ? [...prev] : [""];
      while (next.length < minTeamSize) next.push("");
      return next;
    });
    // We intentionally key this to tournament/minTeamSize changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.firestoreId, minTeamSize]);

  const selectedCount = teammates.filter(
    (t) => t && t.trim().length > 0
  ).length;
  const effectiveSelectedCount =
    selectedCount > 0
      ? selectedCount
      : user?.uid && users.some((m) => m.id === user.uid)
        ? 1
        : 0;
  const hasMinTeamSize = effectiveSelectedCount >= minTeamSize;

  // Sanitize teammate IDs if users list changes (remove ids not present anymore)
  React.useEffect(() => {
    if (!users || users.length === 0) return;
    const valid = new Set(selectableUsers.map((u) => u.id));
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

  // teammates state now stores user IDs directly; RegistrationEditor provides add/remove

  const handleSubmit = async (e: React.FormEvent | Event) => {
    e.preventDefault();

    if (!tournament || !tournament.firestoreId) {
      addToast({
        title: "Error",
        description: "Invalid tournament",
        color: "danger",
      });
      return;
    }

    if (getStatus(tournament) !== TournamentStatus.Open) {
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
    let selectedIds = teammates.filter((t) => t && t.trim().length > 0);
    // Fallback: if nothing selected yet but the current user is in our users list,
    // auto-include them as team leader to avoid a race with the auto-select effect.
    if (
      selectedIds.length === 0 &&
      user?.uid &&
      users.some((m) => m.id === user.uid)
    ) {
      selectedIds = [user.uid];
    }
    if (selectedIds.length < minTeamSize) {
      addToast({
        title: "Error",
        description:
          minTeamSize === 1
            ? "Please select at least one player."
            : "Teams must have at least 2 players for this tournament.",
        color: "danger",
      });
      return;
    }

    // map ids to display names (never surface raw id in UI; raw id only persisted behind the scenes)
    const members = selectedIds.map((id) => {
      const u = selectableUsers.find((x) => x.id === id);
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

    // Conflict detection: check if any selectedIds already appear in another team (exclude current registration if updating)
    const lowerSelected = new Set(selectedIds);
    const foundConflicts: {
      playerId: string;
      playerName: string;
      teamRegistrationId: string;
      teamMembers: string[];
    }[] = [];
    registrations.forEach((reg) => {
      if (registrationId && reg.id === registrationId) return; // ignore own existing reg while updating
      if (Array.isArray(reg.team)) {
        const regMemberIds = reg.team.map((m: any) => m.id);
        regMemberIds.forEach((pid: string) => {
          if (lowerSelected.has(pid)) {
            const pUser = selectableUsers.find((u) => u.id === pid);
            foundConflicts.push({
              playerId: pid,
              playerName: pUser?.displayName || pUser?.email || pid,
              teamRegistrationId: reg.id,
              teamMembers: regMemberIds,
            });
          }
        });
      }
    });

    if (foundConflicts.length > 0 && !conflictsAcknowledged) {
      pendingMembersRef.current = { members, ownerId: user.uid };
      setConflicts(foundConflicts);
      setConflictModalOpen(true);
      return; // wait for user confirmation
    }

    // Use stored members if we are completing after a conflict acknowledgement
    const finalMembers = pendingMembersRef.current?.members || members;
    const ownerId = pendingMembersRef.current?.ownerId || user.uid;

    await finalizeRegistration(finalMembers, ownerId);
  };

  const handleConfirmCancel = async () => {
    if (!registrationId || !tournament?.firestoreId) return;
    setDeleting(true);
    try {
      const api = await import("@/api/tournaments");
      await api.deleteRegistration(tournament.firestoreId, registrationId);
      addToast({
        title: "Cancelled",
        description: "Your registration has been removed.",
        color: "danger",
      });
      setRegistrationId(null);
      setTeammates([""]);
      setConfirmOpen(false);
      // Navigate back to the tournament details page after successful cancellation
      navigate(`/tournaments/${tournament.firestoreId}`, { replace: true });
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
                Maximum players: {maxTeamSize}
              </p>
              {minTeamSize > 1 ? (
                <p className="text-sm text-foreground-500">
                  Minimum players: {minTeamSize}
                </p>
              ) : null}
              {registrationId ? (
                <p className="text-sm text-foreground-500 mt-2">
                  You're already registered — update your team below.
                </p>
              ) : null}
            </div>
          </div>

          <Divider className="my-4" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <RegistrationEditor
              value={teammates}
              onChange={setTeammates}
              users={selectableUsers}
              maxSize={maxTeamSize}
              labels={{ leader: "Team Leader / You" }}
              disabled={!user?.uid}
            />

            {minTeamSize > 1 && !hasMinTeamSize ? (
              <div className="text-sm text-danger">
                Add at least one teammate to register.
              </div>
            ) : null}

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
                    isDisabled={submitting || !user?.uid}
                    aria-disabled={minTeamSize > 1 && !hasMinTeamSize}
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
            <Modal
              isOpen={confirmOpen}
              onOpenChange={(open) => setConfirmOpen(open)}
              size="md"
            >
              <ModalContent>
                {(onClose) => (
                  <>
                    <ModalHeader>Cancel registration</ModalHeader>
                    <ModalBody>
                      <p className="text-sm text-foreground-500">
                        Are you sure you want to cancel your registration? This
                        cannot be undone.
                      </p>
                    </ModalBody>
                    <ModalFooter>
                      <Button variant="light" color="default" onPress={onClose}>
                        Close
                      </Button>
                      <Button
                        color="danger"
                        onPress={handleConfirmCancel}
                        isDisabled={deleting}
                      >
                        {deleting ? "Cancelling..." : "Yes, cancel"}
                      </Button>
                    </ModalFooter>
                  </>
                )}
              </ModalContent>
            </Modal>
          </form>
          {/* Duplicate conflict confirmation modal */}
          <Modal
            isOpen={conflictModalOpen && conflicts.length > 0}
            onOpenChange={(open) => {
              setConflictModalOpen(open);
              if (!open) setConflicts([]);
            }}
            size="lg"
          >
            <ModalContent data-testid="conflict-modal">
              {(onClose) => (
                <>
                  <ModalHeader>Player Already Registered</ModalHeader>
                  <ModalBody>
                    <p className="text-sm text-foreground-500">
                      One or more selected teammates already appear on another
                      registered team.
                    </p>
                    <div className="space-y-4 max-h-72 overflow-auto pr-1">
                      {conflicts.map((c, idx) => {
                        const resolveName = (id: string) => {
                          const u = selectableUsers.find((fm) => fm.id === id);
                          return (
                            u?.displayName ||
                            u?.email ||
                            (id === c.playerId
                              ? c.playerName
                              : "Unknown Player")
                          );
                        };
                        const teamMemberIds = Array.from(
                          new Set(c.teamMembers)
                        );
                        const conflictPlayerResolved = resolveName(c.playerId);
                        return (
                          <Card
                            key={c.playerId + idx}
                            className="p-3 border border-warning-300/50 bg-warning-50 dark:bg-warning-100/10"
                            data-testid="conflict-team-card"
                          >
                            <CardBody className="p-0">
                              <div className="flex items-start gap-4">
                                <div className="flex -space-x-2">
                                  {teamMemberIds.map((mid) => {
                                    const memberUser = selectableUsers.find(
                                      (u) => u.id === mid
                                    );
                                    const label = resolveName(mid);
                                    return (
                                      <div
                                        key={mid}
                                        className="w-8 h-8 rounded-full border border-default-200 flex items-center justify-center bg-default-100 text-[10px] font-medium"
                                        aria-label={label}
                                      >
                                        {memberUser?.displayName
                                          ? memberUser.displayName
                                              .split(/\s+/)
                                              .map((p) => p[0])
                                              .join("")
                                              .slice(0, 2)
                                          : label
                                              .split(/\s+/)
                                              .map((p) => p[0])
                                              .join("")
                                              .slice(0, 2)}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <p className="text-sm">
                                    <span className="font-medium">
                                      {conflictPlayerResolved}
                                    </span>{" "}
                                    is already on this team:
                                  </p>
                                  <div
                                    className="text-xs text-foreground-600 space-y-0.5"
                                    data-testid="conflict-team-names"
                                  >
                                    {teamMemberIds.map((id) => (
                                      <div key={id}>{resolveName(id)}</div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardBody>
                          </Card>
                        );
                      })}
                    </div>
                    <p className="text-sm text-warning-600 dark:text-warning-500">
                      Continuing will register a team containing a player
                      already on another team.
                    </p>
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      variant="light"
                      color="default"
                      onPress={() => {
                        onClose();
                        setConflicts([]);
                      }}
                    >
                      Go Back
                    </Button>
                    <Button
                      color="primary"
                      onPress={() => {
                        onClose();
                        setConflicts([]);
                        setConflictsAcknowledged(true);
                        const pending = pendingMembersRef.current;
                        if (pending) {
                          queueMicrotask(() =>
                            finalizeRegistration(
                              pending.members,
                              pending.ownerId
                            )
                          );
                        }
                      }}
                    >
                      Continue Anyway
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalContent>
          </Modal>
        </CardBody>
      </Card>
    </div>
  );
};

export default TournamentRegister;
