import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getUserProfile, saveUserProfile } from "@/api/users";
import { uploadProfilePicture } from "@/api/storage";
import type { UserProfilePayload } from "@/api/users";
import { useAuth } from "@/providers/AuthProvider";

type SaveVars = { data: UserProfilePayload; file?: File | null };

export function useUserProfile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const uid = user?.uid;

  const query = useQuery<UserProfilePayload | null>({
    queryKey: ["userProfile", uid],
    queryFn: async () => {
      if (!uid) return null;
      return getUserProfile(uid);
    },
    enabled: !!uid,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const mutation = useMutation<
    UserProfilePayload | null,
    Error,
    SaveVars,
    { previous: UserProfilePayload | null }
  >({
    mutationFn: async (payload: SaveVars) => {
      if (!uid) throw new Error("Not authenticated");

      let photoURL = payload.data.photoURL || null;
      if (payload.file) {
        photoURL = await uploadProfilePicture(uid, payload.file);
      }

      // Derive displayName client-side as well for immediate optimistic consistency
      const first = (payload.data.firstName || "").trim();
      const last = (payload.data.lastName || "").trim();
      let displayName = payload.data.displayName?.trim();
      if (first || last)
        displayName = [first, last].filter(Boolean).join(" ").trim();
      const toSave = { ...payload.data, displayName, photoURL };
      await saveUserProfile(uid, toSave);
      return toSave as UserProfilePayload;
    },
    onMutate: async (vars: SaveVars) => {
      await qc.cancelQueries({ queryKey: ["userProfile", uid] });
      const previous =
        qc.getQueryData<UserProfilePayload | null>(["userProfile", uid]) ??
        null;
      qc.setQueryData<UserProfilePayload | null>(
        ["userProfile", uid],
        (old) =>
          ({
            ...(old || {}),
            ...(vars.data || {}),
            displayName:
              (vars.data.firstName || "").trim() ||
              (vars.data.lastName || "").trim()
                ? [
                    (vars.data.firstName || "").trim(),
                    (vars.data.lastName || "").trim(),
                  ]
                    .filter(Boolean)
                    .join(" ")
                    .trim()
                : vars.data.displayName,
            photoURL: vars.file ? "__pending_upload__" : vars.data.photoURL,
          }) as UserProfilePayload
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      qc.setQueryData(["userProfile", uid], context?.previous ?? null);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["userProfile", uid] });
      // Also invalidate any single-user queries that may be showing this profile
      if (uid) qc.invalidateQueries({ queryKey: ["user", uid] });
    },
  });

  return {
    userProfile: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    save: mutation.mutateAsync,
    isSaving: mutation.status === "pending",
    saveError: mutation.error ?? null,
  };
}
