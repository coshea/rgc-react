import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Input,
  Button,
  Divider,
  Avatar,
  addToast,
} from "@heroui/react";
import { Icon } from "@iconify/react";
import { Tournament } from "@/types/tournament";
import { db } from "@/config/firebase";
import { doc, getDoc } from "firebase/firestore";

const TournamentRegister: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const navigate = useNavigate();

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [loading, setLoading] = React.useState(true);

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
          id: typeof data.id === "number" ? data.id : 0,
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

  const maxTeamSize = tournament?.players ?? 1;

  const [teammates, setTeammates] = React.useState<string[]>([""]);

  if (loading) return <div>Loading...</div>;

  if (!tournament) {
    return <div>Unable to find tournament.</div>;
  }

  const addTeammate = () => {
    if (teammates.length < maxTeamSize) setTeammates([...teammates, ""]);
  };

  const updateTeammate = (index: number, value: string) => {
    const copy = [...teammates];
    copy[index] = value;
    setTeammates(copy);
  };

  const removeTeammate = (index: number) => {
    const copy = teammates.filter((_, i) => i !== index);
    setTeammates(copy);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Wire up registration to Firestore (create a registration doc under tournaments/{id}/registrations)
    console.log("Registering team:", teammates);
    navigate("/tournaments");
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
            {teammates.map((name, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  label={i === 0 ? "Team Leader / You" : `Teammate ${i + 1}`}
                  placeholder="Full name or display name"
                  value={name}
                  onValueChange={(v) => updateTeammate(i, v)}
                  className="flex-1"
                />
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

            <div className="flex justify-end gap-2 pt-2">
              <Button
                color="default"
                variant="flat"
                onPress={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button color="primary" type="submit">
                Register Team
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
};

export default TournamentRegister;
