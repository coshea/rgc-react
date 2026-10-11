import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Spinner } from "@heroui/react";
import * as Sentry from "@sentry/react";
import { usePageTracking } from "@/hooks/usePageTracking";
import { addToast } from "@/providers/toast";
import type { Tournament } from "@/types/tournament";
import type { DocumentSnapshot, FirestoreError } from "firebase/firestore";
import { buildTournamentTemplate } from "@/utils/tournamentTemplate";

const TournamentEditor = React.lazy(() =>
  import("@/components/tournament-editor").then((m) => ({
    default: m.TournamentEditor,
  })),
);

const LoadingEditor: React.FC = () => (
  <div className="flex flex-col items-center gap-3 py-16">
    <Spinner />
    <p className="text-sm text-muted">Loading editor...</p>
  </div>
);

const isPermissionDenied = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error as { code?: unknown }).code === "permission-denied";

/**
 * Full-page tournament editor.
 * - /tournaments/new              create from scratch
 * - /tournaments/new?from=<id>    create, prefilled from a previous tournament
 * - /tournaments/:firestoreId/edit
 */
const TournamentEditPage: React.FC = () => {
  const { firestoreId } = useParams<{ firestoreId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !firestoreId;
  const templateId = isNew ? searchParams.get("from") : null;

  usePageTracking(isNew ? "New Tournament" : "Edit Tournament");

  const [tournament, setTournament] = React.useState<Tournament | null>(null);
  const [initialValues, setInitialValues] = React.useState<
    Partial<Tournament> | undefined
  >(undefined);
  const [loading, setLoading] = React.useState<boolean>(
    !isNew || !!templateId,
  );

  // Edit: keep the tournament live so bracket publish state and similar
  // server-side changes show up without a reload.
  React.useEffect(() => {
    if (!firestoreId) return;
    let cancelled = false;
    let unsub: (() => void) | undefined;
    setLoading(true);
    (async () => {
      const api = await import("@/api/tournaments");
      if (cancelled) return;
      unsub = api.onTournament(
        firestoreId,
        (snap: DocumentSnapshot) => {
          if (!snap.exists()) {
            addToast({
              title: "Not found",
              description: "That tournament doesn't exist.",
              color: "danger",
            });
            navigate("/tournaments", { replace: true });
            return;
          }
          setTournament(api.mapTournamentDoc(snap) as Tournament);
          setLoading(false);
        },
        (error: FirestoreError) => {
          Sentry.captureException(error);
          addToast(
            isPermissionDenied(error)
              ? {
                  title: "Access Denied",
                  description:
                    "You do not have permission to perform this action.",
                  color: "danger",
                }
              : {
                  title: "Error",
                  description: "Failed to load tournament.",
                  color: "danger",
                },
          );
          // Without a tournament the editor can't render; don't spin forever.
          navigate("/tournaments", { replace: true });
        },
      );
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [firestoreId, navigate]);

  // Create from a previous tournament: load it once and copy its settings.
  React.useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      try {
        const source = await Sentry.startSpan(
          { op: "db.query", name: "Load tournament template" },
          async () => {
            const api = await import("@/api/tournaments");
            return api.fetchTournament(templateId);
          },
        );
        if (cancelled) return;
        if (source) {
          setInitialValues(buildTournamentTemplate(source as Tournament));
        } else {
          addToast({
            title: "Template not found",
            description: "Starting from a blank tournament instead.",
            color: "warning",
          });
        }
      } catch (error) {
        Sentry.captureException(error);
        if (!cancelled) {
          addToast({
            title: "Error",
            description:
              "Couldn't copy that tournament. Starting from a blank one instead.",
            color: "danger",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const handleSave = (saved: Tournament) => {
    // After creating, continue on the edit page so entries and the bracket
    // are available. When editing, stay put; the live listener refreshes.
    if (isNew && saved.firestoreId) {
      navigate(`/tournaments/${saved.firestoreId}/edit`, { replace: true });
    }
  };

  const handleCancel = () => {
    navigate(isNew ? "/tournaments" : `/tournaments/${firestoreId}`);
  };

  if (loading || (!isNew && !tournament)) return <LoadingEditor />;

  return (
    <React.Suspense fallback={<LoadingEditor />}>
      <TournamentEditor
        // Remount when switching tournaments so form state reseeds.
        key={firestoreId ?? `new-${templateId ?? ""}`}
        tournament={tournament}
        initialValues={initialValues}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </React.Suspense>
  );
};

export default TournamentEditPage;
