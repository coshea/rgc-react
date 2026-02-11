# Cloud Functions

This directory contains Firebase Cloud Functions for RGC React.

## Overview

- Entry point: src/index.ts
- Runtime: Firebase Functions v2 (HTTP)
- Secrets/params:
  - PAYPAL_CLIENT_ID (string param)
  - PAYPAL_CLIENT_SECRET (secret)
  - PAYPAL_ENVIRONMENT (string param; PRODUCTION or SANDBOX)

## HTTP Functions

- verify_and_record_membership_payment
  - Verifies a PayPal order for membership dues and records it in Firestore.
- request_check_membership_payment
  - Records a pending check-based membership payment request.
- verify_and_record_donation_payment
  - Verifies a PayPal order for donations and records it in Firestore.
- reconcile_paypal_membership_orders
  - Admin-only reconciliation for PayPal transactions from the last 14 days.
  - Uses PayPal transaction reporting, then replays missing orders via the
    membership verification flow.

## Key Implementation Files

- src/index.ts
  - Main exports for HTTP functions and shared PayPal verification flow.
- src/reconcilePayPalMembershipOrders.ts
  - Reconciliation handler implementation.
- src/httpUtils.ts
  - Shared helpers for CORS, auth, and safe PayPal mock support.
- src/verifyAndRecordMembershipPayment.ts
  - Server-side PayPal verification and Firestore recording.
- src/firestoreMembership.ts
  - Firestore write helpers for membership and donation records.

## Local Development

- Use emulator env variables for PayPal mocking if needed:
  - FUNCTIONS_EMULATOR=true
  - PAYPAL_MOCK_STATUS=COMPLETED
  - PAYPAL_MOCK_AMOUNT=100
  - PAYPAL_MOCK_CURRENCY=USD

## Keeping This Updated

If you add, remove, or change a Cloud Function or its behavior, update this
README so it reflects the current set of functions and their purpose.
