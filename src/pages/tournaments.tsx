import React from "react";
import { TournamentForm } from "@/components/tournament-form";
import { TournamentList } from "@/components/tournament-list";
import { Tournament } from "@/types/tournament";
import { TournamentItems as mockTournaments } from "@/data/test-tournaments";
import { addToast } from "@heroui/react";
import { Icon } from "@iconify/react";

interface TournamentsProps {
  // You can add props here if needed
}

const Tournaments: React.FC<TournamentsProps> = () => {
  const [tournaments, setTournaments] =
    React.useState<Tournament[]>(mockTournaments);
  const [editingTournament, setEditingTournament] =
    React.useState<Tournament | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // In a real app, you would fetch tournaments from Firestore on component mount
  React.useEffect(() => {
    // Uncomment this in a real implementation with Firebase
    /*
    const fetchTournaments = async () => {
      setIsLoading(true);
      try {
        const data = await firestoreService.getAllTournaments();
        setTournaments(data);
      } catch (error) {
        console.error("Error fetching tournaments:", error);
        addToast({
          title: "Error",
          description: "Failed to load tournaments",
          color: "danger"
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchTournaments();
    */
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
      // In a real app, save to Firestore
      // await firestoreService.saveTournament(tournament);

      if (editingTournament) {
        // Update existing tournament
        setTournaments(
          tournaments.map((t) => (t.id === tournament.id ? tournament : t))
        );
        addToast({
          title: "Tournament Updated",
          description: `${tournament.title} has been successfully updated.`,
          color: "success",
        });
      } else {
        // Create new tournament
        const newTournament = {
          ...tournament,
          id: Math.max(0, ...tournaments.map((t) => t.id)) + 1,
        };
        setTournaments([...tournaments, newTournament]);
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

  const handleDeleteTournament = async (id: number) => {
    setIsLoading(true);

    try {
      // In a real app, delete from Firestore
      // await firestoreService.deleteTournament(id);

      setTournaments(tournaments.filter((t) => t.id !== id));
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
