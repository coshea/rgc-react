import React from "react";
import { useNavigate } from "react-router-dom";
import { usePageTracking } from "@/hooks/usePageTracking";
import { useAuth } from "@/providers/AuthProvider";
import { useDocAdminFlag } from "@/components/membership/hooks";
const TournamentEditor = React.lazy(() =>
  import("@/components/tournament-editor").then((m) => ({
    default: m.TournamentEditor,
  })),
);
import { TournamentList } from "@/components/tournament-list";
import { Tournament } from "@/types/tournament";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  SelectItem,
  RadioGroup,
  Radio,
} from "@heroui/react";
import { addToast } from "@/providers/toast";
// tournaments API is imported dynamically where used
import { Icon } from "@iconify/react";

type TournamentsProps = Record<string, never>;

const Tournaments: React.FC<TournamentsProps> = () => {
  usePageTracking("Tournaments");
  const navigate = useNavigate();
  const googleCalendarSubscribeUrl =
    "https://calendar.google.com/calendar/u/0?cid=ZTdpOG43OGdrdWRqMzU3YjlmNnJoaWJwcTRAZ3JvdXAuY2FsZW5kYXIuZ29vZ2xlLmNvbQ";
  const [tournaments, setTournaments] = React.useState<Tournament[]>([]);
  const [editingTournament, setEditingTournament] =
    React.useState<Tournament | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Create flow state
  const [createModeOpen, setCreateModeOpen] = React.useState(false);
  const [createMethod, setCreateMethod] = React.useState<"scratch" | "copy">(
    "scratch",
  );
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [initialValues, setInitialValues] = React.useState<
    Partial<Tournament> | undefined
  >(undefined);

  const { user } = useAuth();
  const { isAdmin } = useDocAdminFlag(user);

  React.useEffect(() => {
    setIsLoading(true);
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const api = await import("@/api/tournaments");
        unsub = api.onAllTournaments(
          (snap: any) => {
            try {
              const items: Tournament[] = snap.docs.map(
                (d: any) => api.mapTournamentDoc(d) as Tournament,
              );
              setTournaments(items);
            } catch (err) {
              console.error("Map tournaments failed", err);
            } finally {
              setIsLoading(false);
            }
          },
          (error: any) => {
            console.error("Error listening to tournaments:", error);
            addToast({
              title: "Error",
              description: "Failed to load tournaments",
              color: "danger",
            });
            setIsLoading(false);
          },
        );
      } catch (e) {
        console.error("Failed to init tournaments listener", e);
        setIsLoading(false);
      }
    })();
    return () => {
      if (typeof unsub === "function") {
        unsub();
      }
    };
  }, []);

  const handleCreateTournament = () => {
    setEditingTournament(null);
    setCreateMethod("scratch");
    setTemplateId(null);
    setInitialValues(undefined);
    setCreateModeOpen(true);
  };

  const handleEditTournament = (tournament: Tournament) => {
    setEditingTournament(tournament);
    setIsCreating(false);
  };

  const handleSaveTournament = async (tournament: Tournament) => {
    setIsLoading(true);
    try {
      // Don't manually update state - let the real-time listener handle it
      // This prevents duplicates when creating or updating tournaments
      if (editingTournament) {
        addToast({
          title: "Tournament Updated",
          description: `${tournament.title} has been successfully updated.`,
          color: "success",
        });
      } else {
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
      setInitialValues(undefined);
    }
  };

  const handleCancelEdit = () => {
    setEditingTournament(null);
    setIsCreating(false);
    setInitialValues(undefined);
  };

  const handleDeleteTournament = async (id?: string | number) => {
    setIsLoading(true);
    try {
      if (typeof id === "string") {
        const { deleteTournament } = await import("@/api/tournaments");
        await deleteTournament(id);
        // Don't manually update state - let the real-time listener handle it
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

  const onContinueCreate = () => {
    let init: Partial<Tournament> | undefined = undefined;
    if (createMethod === "copy" && templateId) {
      const tpl = tournaments.find((t) => t.firestoreId === templateId);
      if (tpl) {
        init = {
          title: tpl.title,
          description: tpl.description,
          detailsMarkdown: tpl.detailsMarkdown,
          players: tpl.players,
          prizePool: tpl.prizePool,
          tee: tpl.tee,
          assignedTeeTimes: tpl.assignedTeeTimes,
        };
      }
    }
    setInitialValues(init);
    setCreateModeOpen(false);
    setEditingTournament(null);
    setIsCreating(true);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24 space-y-6">
      <Modal isOpen={createModeOpen} onClose={() => setCreateModeOpen(false)}>
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            New Tournament
          </ModalHeader>
          <ModalBody>
            <RadioGroup
              label="How would you like to start?"
              value={createMethod}
              onValueChange={(v) => setCreateMethod(v as "scratch" | "copy")}
            >
              <Radio value="scratch">Create from scratch</Radio>
              <Radio value="copy">Copy from previous</Radio>
            </RadioGroup>
            {createMethod === "copy" && (
              <Select
                label="Choose a previous tournament"
                selectedKeys={templateId ? [templateId] : []}
                onSelectionChange={(keys) => {
                  const id = Array.from(keys)[0] as string | undefined;
                  setTemplateId(id || null);
                }}
              >
                {tournaments
                  .filter((t) => !!t.firestoreId)
                  .map((t) => {
                    const year = t.date
                      ? new Date(t.date).getFullYear()
                      : undefined;
                    const label = year ? `${t.title} (${year})` : t.title;
                    return (
                      <SelectItem key={t.firestoreId!} textValue={label}>
                        {label}
                      </SelectItem>
                    );
                  })}
              </Select>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCreateModeOpen(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isDisabled={createMethod === "copy" && !templateId}
              onPress={onContinueCreate}
            >
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {isCreating || editingTournament ? (
        isAdmin ? (
          <React.Suspense
            fallback={
              <div className="p-8 flex flex-col items-center gap-3">
                <Icon
                  icon="lucide:loader"
                  className="animate-spin text-2xl text-primary"
                />
                <p className="text-sm text-foreground-500">Loading editor...</p>
              </div>
            }
          >
            <TournamentEditor
              tournament={editingTournament}
              initialValues={initialValues}
              onSave={handleSaveTournament}
              onCancel={handleCancelEdit}
            />
          </React.Suspense>
        ) : (
          <div className="p-6 bg-content1 rounded-lg border border-default-200">
            <p className="text-foreground-500">
              You do not have permission to create or edit tournaments.
            </p>
          </div>
        )
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <h2 className="text-xl font-medium text-foreground">
              Scheduled Tournaments
            </h2>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <Button
                as="a"
                href={googleCalendarSubscribeUrl}
                target="_blank"
                rel="noreferrer"
                size="sm"
                variant="flat"
                startContent={
                  <Icon icon="lucide:calendar" className="w-4 h-4" />
                }
                aria-label="Subscribe to Google Calendar"
                title="Subscribe to the club Google Calendar"
              >
                Subscribe
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="flat"
                    size="sm"
                    onPress={() => navigate("/season-awards")}
                    startContent={
                      <Icon icon="lucide:medal" className="w-4 h-4" />
                    }
                    aria-label="Go to season awards"
                  >
                    Awards
                  </Button>
                  <Button
                    color="primary"
                    size="sm"
                    startContent={
                      <Icon
                        icon="lucide:plus"
                        className="w-4 h-4 sm:w-5 sm:h-5"
                      />
                    }
                    className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base font-medium gap-1 sm:gap-2 shadow-sm active:scale-[0.98]"
                    onPress={handleCreateTournament}
                    isDisabled={isLoading}
                    aria-label="Create new tournament"
                  >
                    <span className="hidden xs:inline sm:inline">
                      New Tournament
                    </span>
                    <span className="sm:hidden sr-only">New Tournament</span>
                  </Button>
                </>
              )}
            </div>
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
