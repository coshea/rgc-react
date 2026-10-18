import { defineSecret } from "firebase-functions/params";

export const RESEND_API_KEY_NAME = "RESEND_API_KEY";
export const RESEND_API_KEY = defineSecret(RESEND_API_KEY_NAME);

/** Signing secret (`whsec_…`) of the Resend webhook endpoint. */
export const RESEND_WEBHOOK_SECRET_NAME = "RESEND_WEBHOOK_SECRET";
export const RESEND_WEBHOOK_SECRET = defineSecret(RESEND_WEBHOOK_SECRET_NAME);
