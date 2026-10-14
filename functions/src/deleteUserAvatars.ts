import type { UserRecord } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { withSentry } from "./sentry";

import { logger } from "./logger";

// When an auth account is deleted, remove that user's avatar files only.
// The users/{uid} and admin/{uid} documents are intentionally kept for
// record keeping.
export const deleteUserAvatars = functions.auth.user().onDelete(
  withSentry("deleteUserAvatars", async (user: UserRecord) => {
    const prefix = `avatars/${user.uid}/`;
    try {
      await admin.storage().bucket().deleteFiles({ prefix });
      logger.info("deleteUserAvatars: removed avatar files", { uid: user.uid });
    } catch (error) {
      logger.error("deleteUserAvatars: failed to remove avatar files", {
        uid: user.uid,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
    return null;
  }),
);
