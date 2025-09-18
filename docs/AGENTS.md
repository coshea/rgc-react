Assistant Rules for the rgc-react Repository

## Purpose

Single source of truth for explicit, enforceable repository rules (UI, data, safety). High‑level operational cheat sheet for AI lives in `/.github/copilot-instructions.md`; that file mirrors a concise subset of this one.

## How to Use

- Read before modifying auth, Firestore rules, or membership directory features.
- Update THIS file first when a rule changes; then sync the distilled summary in `/.github/copilot-instructions.md`.

## Current Tech Stack (Authoritative)

- React 18 + TypeScript, Vite
- HeroUI + Tailwind CSS v4 (no styled-components in use)
- Routing: React Router v6
- Data/Server: Firebase (Auth, Firestore, Storage)
- State/server caching: TanStack Query
- Testing: Vitest + React Testing Library (jsdom)
- Lint/Format: ESLint + Prettier

Removed (do NOT reference unless intentionally added later): Axios, Styled-components, ApexCharts.

## Do

- Use HeroUI primitives (`Button`, `Input`, `Avatar`, etc.) and Tailwind utilities.
- Keep components focused & small; extract sub-parts into `src/components/`.
- Use `onPress` instead of `onClick` for HeroUI components.
- Normalize & format phone numbers consistently (see membership directory + `parseUsersCsv`).
- Use dynamic imports for large Firestore interactions in admin/editor contexts (see `tournament-editor.tsx`).

## Don’t

- Add heavy dependencies without explicit approval.
- Re-implement auth listeners (centralized in `AuthProvider`).
- Duplicate admin detection logic—import or replicate the tri-source OR pattern exactly.
- Use `window.confirm` for destructive actions—use an in-app modal overlay.

## Safety & Permissions

Allowed automatically: read/list files, run single test, run eslint/prettier, type-check a single file.
Ask first: install packages, delete files, run full build/test suite, push commits, chmod changes.

## Architecture Snapshot

- Routing: `src/App.tsx`.
- Global providers: `src/provider.tsx` wraps `AuthProvider` → `HeroUIProvider` → `ToastProvider`.
- Auth: `src/providers/AuthProvider.tsx`; consumer hook: `useAuth()`.
- Current user profile & optimistic save: `src/hooks/useUserProfile.ts`.
- Domain models: `src/types/` (`tournament.ts`, `roles.ts`, `winner.ts`).
- Firestore helpers: `src/api/users.ts`, `src/api/storage.ts` (enforces UID checks).
- Membership directory: `src/pages/membership-directory.tsx` (authoritative admin detection implementation).

## Core Rules

1. Identity: When asked your name, answer exactly: `GitHub Copilot`.
2. UI: HeroUI + Tailwind only; use `onPress`; no raw `div` wrappers when a semantic/component alternative exists.
3. Modals: Use custom overlay pattern (see directory & tournament editor) for confirmations; never `window.confirm`.
4. Membership Directory: Show avatar, name, email, phone only (unless explicitly extending). Use `User` model; admin-only edits persist to `users` collection.
5. Admin Detection (must OR all): `users/{uid}.admin` OR `admin/{uid}.isAdmin` OR ID token claim `admin`.
6. Firestore Access: Subscribe only after confirming auth; keep `admin` collection at root; preserve UID validation logic in write helpers.
7. Roles: Validate with `isAllowedBoardRole`; reject legacy/unrecognized roles unless in migration path.
8. Phone Numbers: Normalize digits; display `(xxx) xxx-xxxx` when 10 digits; keep helper logic consistent across pages & CSV import.
9. Optimistic Updates: Follow `useUserProfile()` pattern (`onMutate` + rollback) for new cached mutations.
10. Validation & Feedback: Use local `errors` object and HeroUI `isInvalid` + `errorMessage`; surface results with `addToast`.
11. Accessibility: Provide `aria-label` for icon-only buttons; ensure modals trap focus if expanded beyond current simple overlays.
12. Build Gate: Non-trivial change sets must pass `npm run build` + relevant tests before concluding.

## Maintenance & Propagation

1. Update this file first when introducing/changing a rule.
2. Add a dated bullet under Metadata (what changed + why).
3. Reflect concise version in `/.github/copilot-instructions.md` (omit rationale, keep actionable steps).

## Metadata

Last updated: 2025-09-17 (pruned outdated libs, removed verbose examples, added architecture snapshot & cross-link)
