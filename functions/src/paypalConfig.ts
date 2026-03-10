import { defineSecret, defineString } from "firebase-functions/params";

export const PAYPAL_CLIENT_ID_NAME = "PAYPAL_CLIENT_ID";
export const PAYPAL_CLIENT_SECRET_NAME = "PAYPAL_CLIENT_SECRET";
export const PAYPAL_ENVIRONMENT_NAME = "PAYPAL_ENVIRONMENT";

export const PAYPAL_CLIENT_ID = defineString(PAYPAL_CLIENT_ID_NAME);
export const PAYPAL_CLIENT_SECRET = defineSecret(PAYPAL_CLIENT_SECRET_NAME);
export const PAYPAL_ENVIRONMENT = defineString(PAYPAL_ENVIRONMENT_NAME);
