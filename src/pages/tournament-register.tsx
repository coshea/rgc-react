import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardBody, Button, Divider } from "@heroui/react";
import { addToast } from "@/providers/toast";
import { Tournament } from "@/types/tournament";
// Firestore access now centralized in '@/api/tournaments'. We dynamically import for
// potential bundle splitting since registration flow is a narrower usage path.
import { useUsers } from "@/hooks/useUsers";
import { useAuth } from "@/providers/AuthProvider";
import type { User } from "@/api/users";
import RegistrationEditor from "@/components/registration-editor";

const TournamentRegister: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { users } = useUsers();
  // Refine types and avoid any-casts with a small type guard
  const isFullMember = React.useCallback(
    (u: User): u is User & { membershipType: "full" } =>
      u.membershipType === "full",
    []
  );
  // Filter to full members only for selection (business rule: only full members can register / be teammates)
  const fullMembers = React.useMemo(
    () => users.filter(isFullMember),
    [users, isFullMember]
  );

  // registration-related state must be declared before effects that use them
  const [teammates, setTeammates] = React.useState<string[]>([""]);
  const [submitting, setSubmitting] = React.useState(false);
  const { user } = useAuth();
  const [registrationId, setRegistrationId] = React.useState<string | null>(
    null
  );
  const [deleting, setDeleting] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const currentUserIsFull = React.useMemo(
    () =>
      users.some(
        (u: User) => u.id === user?.uid && u.membershipType === "full"
      ),
    [users, user?.uid]
  );

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
          if (Array.isArray(existing.team) && existing.team.length > 0) {
            const ids = existing.team.map((m: any) => m.id || "");
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
    const valid = new Set(fullMembers.map((u) => u.id));
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

  if (tournament && !currentUserIsFull) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-4">
        <h2 className="text-xl font-semibold">Registration Restricted</h2>
        <p className="text-sm text-foreground-600">
          Only full members are eligible to register for tournaments. Your
          account isn't marked as a full member. If you believe this is an
          error, please contact an administrator.
        </p>
      </div>
    );
  }

  // teammates state now stores user IDs directly; RegistrationEditor provides add/remove

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
    // Ensure all selected teammates are full members
    const allFull = selectedIds.every((id) =>
      fullMembers.some((m) => m.id === id)
    );
    if (!allFull) {
      addToast({
        title: "Invalid Team",
        description: "All teammates must be full members.",
        color: "danger",
      });
      return;
    }
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
      const u = fullMembers.find((x) => x.id === id);
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
      const api = await import("@/api/tournaments");
      await api.upsertRegistration(tournament.firestoreId, registrationId, {
        team: members,
        ownerId: user.uid,
      });

      addToast({
        title: "Registered",
        description: "Your team has been registered.",
        color: "success",
      });
      // After successful registration or update, return user to the tournament detail page
      if (tournament.firestoreId) {
        navigate(`/tournaments/${tournament.firestoreId}`, { replace: true });
      } else {
        navigate("/tournaments", { replace: true });
      }
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
          </div>

          <Divider className="my-4" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <RegistrationEditor
              value={teammates}
              onChange={setTeammates}
              users={fullMembers}
              maxSize={maxTeamSize}
              labels={{ leader: "Team Leader / You" }}
            />

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
