import React from "react";
import { TournamentForm } from "@/components/tournament-form";
import { TournamentList } from "@/components/tournament-list";
import { Tournament } from "@/types/tournament";
import { addToast } from "@heroui/react";
import { db } from "@/config/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
} from "firebase/firestore";
import { Icon } from "@iconify/react";

interface TournamentsProps {
  // You can add props here if needed
}

const Tournaments: React.FC<TournamentsProps> = () => {
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [editingTournament, setEditingTournament] =
    React.useState<Tournament | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    // Fetch tournaments from Firestore and map to local Tournament objects
    const fetchTournaments = async () => {
      setIsLoading(true);
      try {
        const colRef = collection(db, "tournaments");
        const q = query(colRef, orderBy("date", "asc"));
        const snap = await getDocs(q);
        const items: Tournament[] = snap.docs.map((doc) => {
          const data: any = doc.data();
          // Convert Firestore Timestamp to JS Date if necessary
          const dateField =
            data.date && typeof data.date.toDate === "function"
              ? data.date.toDate()
              : data.date
                ? new Date(data.date)
                : new Date();

          return {
            firestoreId: doc.id,
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
          } as Tournament;
        });

        setTournaments(items);
      } catch (error) {
        console.error("Error fetching tournaments:", error);
        addToast({
          title: "Error",
          description: "Failed to load tournaments",
          color: "danger",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTournaments();
  }, []);

  const handleCreateTournament = () => {
    setEditingTournament(null);
    setIsCreating(true);
  };

  const handleEditTournament = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setIsCreating(false);
  };

  const handleSaveTournament = async (tournament: Tournament) => {
    setIsLoading(true);

    try {
      // In a real app, save to Firestore (done in TournamentForm)
      if (editingTournament) {
        // Update existing tournament in local state (match by firestoreId)
        setTournaments((prev) =>
          prev.map((t) =>
            t.firestoreId &&
            tournament.firestoreId &&
            t.firestoreId === tournament.firestoreId
              ? tournament
              : t
          )
        );
        addToast({
          title: "Tournament Updated",
          description: `${tournament.title} has been successfully updated.`,
          color: "success",
        });
      } else {
        // Append newly created tournament (TournamentForm will include firestoreId when created)
        setTournaments((prev) => [...prev, tournament]);
        addToast({
          title: "Tournament Created",
          description: `${tournament.title} has been successfully created.`,
          color: "success",
        });
      }
    } catch (error) {
      console.error("Error saving tournament:", error);
      addToast({
        title: "Error",
        description: "Failed to save tournament",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
      setEditingTournament(null);
      setIsCreating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingTournament(null);
    setIsCreating(false);
  };

  const handleDeleteTournament = async (id?: string | number) => {
    setIsLoading(true);

    try {
      // If id is a Firestore document id (string), delete the doc
      if (typeof id === "string") {
        try {
          await deleteDoc(doc(db, "tournaments", id));
        } catch (err) {
          console.warn(
            "Failed to delete Firestore document, continuing to remove locally",
            err
          );
        }
        setTournaments((prev) => prev.filter((t) => t.firestoreId !== id));
      }
      addToast({
        title: "Tournament Deleted",
        description: "The tournament has been successfully deleted.",
        color: "danger",
      });
    } catch (error) {
      console.error("Error deleting tournament:", error);
      addToast({
        title: "Error",
        description: "Failed to delete tournament",
        color: "danger",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {isCreating || editingTournament ? (
        <TournamentForm
          tournament={editingTournament}
          onSave={handleSaveTournament}
          onCancel={handleCancelEdit}
        />
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-medium text-foreground">
              Scheduled Tournaments
            </h2>
            <button
              onClick={handleCreateTournament}
              className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors"
              disabled={isLoading}
            >
              <Icon icon="lucide:plus" />
              <span>New Tournament</span>
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Icon
                  icon="lucide:loader"
                  className="text-3xl text-primary animate-spin"
                />
                <p className="text-foreground-500">Loading tournaments...</p>
              </div>
            </div>
          ) : (
            <TournamentList
              tournaments={tournaments}
              onEdit={handleEditTournament}
              onDelete={handleDeleteTournament}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Tournaments;
