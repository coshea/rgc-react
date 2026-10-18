import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";

import { clearEmailIssue, getEmailIssues } from "@/api/emailIssues";
import { addToast } from "@/providers/toast";
import { extractFirebaseAuthError } from "@/utils/firebaseErrors";
import { type EmailIssue, emailIssueDocId } from "@@/types";

const EMAIL_ISSUES_KEY = ["emailIssues"] as const;

/** Admin-only: email delivery problems keyed by lowercased address. */
export function useEmailIssues(enabled: boolean) {
  return useQuery({
    queryKey: EMAIL_ISSUES_KEY,
    queryFn: getEmailIssues,
    enabled,
    staleTime: 60_000,
  });
}

export function useClearEmailIssue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => clearEmailIssue(email),
    onMutate: async (email) => {
      await queryClient.cancelQueries({ queryKey: EMAIL_ISSUES_KEY });
      const previous =
        queryClient.getQueryData<Map<string, EmailIssue>>(EMAIL_ISSUES_KEY);
      if (previous) {
        const next = new Map(previous);
        next.delete(emailIssueDocId(email));
        queryClient.setQueryData(EMAIL_ISSUES_KEY, next);
      }
      return { previous };
    },
    onError: (error, _email, context) => {
      if (context?.previous) {
        queryClient.setQueryData(EMAIL_ISSUES_KEY, context.previous);
      }
      Sentry.captureException(error);
      addToast(
        extractFirebaseAuthError(error)?.code === "permission-denied"
          ? {
              title: "Access Denied",
              description:
                "You do not have permission to perform this action.",
              color: "danger",
            }
          : {
              title: "Couldn't clear email issue",
              description: "Please try again.",
              color: "danger",
            },
      );
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: EMAIL_ISSUES_KEY }),
  });
}
