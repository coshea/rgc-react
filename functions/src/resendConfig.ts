import { defineSecret } from "firebase-functions/params";

export const RESEND_API_KEY_NAME = "RESEND_API_KEY";
export const RESEND_API_KEY = defineSecret(RESEND_API_KEY_NAME);
