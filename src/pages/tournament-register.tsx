import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Button,
  Divider,
  Avatar,
  addToast,
  Select,
  SelectItem,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { db } from "@/config/firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { getUsers, User } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";

const TournamentRegister: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [users, setUsers] = React.useState<User[]>([]);
  const [, setUsersLoading] = React.useState(false);

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
    // Fetch users separately
    const fetchUsers = async () => {
      setUsersLoading(true);
      try {
        const list = await getUsers();
        setUsers(list);
        console.debug("Loaded users:", list.length);
      } catch (err) {
        console.error("Failed to load users", err);
        addToast({
          title: "Error",
          description: "Failed to load users",
          color: "danger",
        });
      } finally {
        setUsersLoading(false);
      }
    };

    fetchUsers();
  }, [firestoreId]);

  const maxTeamSize = tournament?.players ?? 1;

  // store teammate user IDs (empty string means unselected)
  const [teammates, setTeammates] = React.useState<string[]>([""]);
  const [submitting, setSubmitting] = React.useState(false);
  const { user } = useAuth();

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
      const ref = doc(db, "tournaments", tournament.firestoreId);

      const registration = {
        team: members,
        ownerId: user.uid,
        // Use client timestamp to avoid arrayUnion/serverTimestamp issues
        registeredAt: new Date(),
      } as any;

      await updateDoc(ref, { registrations: arrayUnion(registration) });

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
            </div>
            <Avatar size="lg" src={tournament.icon} />
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                color="default"
                variant="flat"
                onPress={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button color="primary" type="submit" isDisabled={submitting}>
                {submitting ? "Registering..." : "Register Team"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default TournamentRegister;
