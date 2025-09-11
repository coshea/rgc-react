import React from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useUserProfile } from "@/hooks/useUserProfile";
import TournamentEditor from "@/components/tournament-editor";
import { TournamentList } from "@/components/tournament-list";
import { Tournament } from "@/types/tournament";
import { addToast } from "@heroui/react";
import { db } from "@/config/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  deleteDoc,
  onSnapshot,
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
  const { user } = useAuth();
  const { userProfile } = useUserProfile();

  const isAdmin = !!(user && userProfile && userProfile.admin === true);

  React.useEffect(() => {
    // Fetch tournaments from Firestore and map to local Tournament objects
    setIsLoading(true);
    const colRef = collection(db, "tournaments");
    const qCol = query(colRef, orderBy("date", "asc"));
    const unsub = onSnapshot(
      qCol,
      (snap) => {
        const items: Tournament[] = snap.docs.map((d) => {
          const data: any = d.data();
          const dateField =
            data.date && typeof data.date.toDate === "function"
              ? data.date.toDate()
              : data.date
                ? new Date(data.date)
                : new Date();
          return {
            firestoreId: d.id,
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
        setIsLoading(false);
      },
      (error) => {
        console.error("Error listening to tournaments:", error);
        addToast({
          title: "Error",
          description: "Failed to load tournaments",
          color: "danger",
        });
        setIsLoading(false);
      }
    );
    return () => unsub();
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
      // In a real app, save to Firestore (handled in TournamentEditor)
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
        // Append newly created tournament (TournamentEditor includes firestoreId when created)
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
        // Only allow creating/editing if user is admin
        isAdmin ? (
          <TournamentEditor
            tournament={editingTournament}
            onSave={handleSaveTournament}
            onCancel={handleCancelEdit}
          />
        ) : (
          <div className="p-6 bg-content1 rounded-lg border border-default-200">
            <p className="text-foreground-500">
              You do not have permission to create or edit tournaments.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-medium text-foreground">
              Scheduled Tournaments
            </h2>
            {isAdmin && (
              <button
                onClick={handleCreateTournament}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-600 transition-colors"
                disabled={isLoading}
              >
                <Icon icon="lucide:plus" />
                <span>New Tournament</span>
              </button>
            )}
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
              isAdmin={isAdmin}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Tournaments;
