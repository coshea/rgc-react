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
- Use `onPress` instead of `onClick` for HeroUI components. Do NOT attach `onPress` to native elements; if you need a pressable wrapper, use HeroUI `Button`/`Link` and place `onPress` there.
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
2. UI: HeroUI + Tailwind only; use `onPress` on HeroUI components; avoid raw `div` wrappers—prefer composition (`Dropdown` + `DropdownTrigger` + `Button`, `Tooltip` + `Button`).
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

### UserAvatar Fallback Contract

Centralized avatar behavior lives in `src/components/avatar.tsx` (`UserAvatar`). Do NOT re‑implement fallback logic in consuming components.

Resolution precedence (highest → lowest):

1. Explicit `src` prop passed to `UserAvatar`.
2. `user.profileURL` (preferred custom uploaded profile picture).
3. `user.photoURL` (Firebase auth provider photo or legacy field).
4. Generated initials from `name` prop OR `user.displayName` OR `user.name` OR `user.email`.

Usage Guidelines:

- Pass the full `user` object as `user={user}` whenever you have it; avoid manually computing `profileURL || photoURL`.
- Only supply `name` when you do NOT pass a `user` object or you need to override display text.
- Avoid sprinkling custom fallback chains (`u.profileURL || u.photoURL`)—this leads to inconsistency and was intentionally removed.
- Provide `alt` only to override the default (which uses the resolved display name); omit otherwise for automatic accessibility labeling.
- Sizes: use HeroUI sizing semantics via the `size` prop (`sm`, `md`, `lg`). Custom width/height Tailwind classes are acceptable for special layouts but keep `size` aligned to semantic intent.
- Do not forward internal identifiers (e.g., `userId`) to DOM; `UserAvatar` already strips non‑DOM props.
- For grouped/team displays, pass the user object; if data is still loading you may pass just a `name` to show stable initials.

Testing:

- Contract is enforced by `src/__tests__/avatar-fallback.spec.tsx`. Update that test if the precedence changes.
- When adding new avatar‑related features (status rings, presence indicators, etc.), extend `UserAvatar`; do not fork it.

Rationale:
Consolidation eliminates subtle mismatches (e.g., stale `photoURL`, inconsistent initials) and reduces duplication across leaderboards, registrations, and board roster components.

### Event Handling: `onPress` vs `onClick`

HeroUI components (Button, Input variants, Menu items, etc.) expose a unified `onPress` abstraction that normalizes pointer, keyboard, and assistive tech activation. Previous anti-patterns fixed in the codebase included:

- Passing `onClick` to HeroUI primitives (keyboard activation inconsistencies, double-firing in some browsers).
- Forwarding arbitrary DOM props (e.g., `userId`) onto native elements causing React console warnings.
- Mixing `onClick` and `onPress` in the same component tree leading to uneven focus/pressed states.

Current standard:

1. Use `onPress` for all interactive HeroUI components (Buttons, Tabs, Dropdown items, etc.).
2. For native elements, use `onClick` only. If you need unified press behavior, wrap content in a HeroUI `Button` and attach `onPress` to it.
3. Filter non-DOM props before spreading to native elements to avoid React unknown prop warnings (pattern implemented in `avatar.tsx`).
4. Do not pass `onPress` down to native DOM nodes. For `UserAvatar`, wrap in a HeroUI `Button` for clickability (e.g., dropdown trigger).
5. Tests asserting interaction should use RTL `userEvent.click` or `fireEvent.click`; HeroUI will translate to `onPress` as needed.

Rationale: Ensures consistent accessibility behavior (Enter/Space support), prevents duplicate event semantics, and removes noisy React warnings that obscure real issues.

## Maintenance & Propagation

1. Update this file first when introducing/changing a rule.
2. Add a dated bullet under Metadata (what changed + why).
3. Reflect concise version in `/.github/copilot-instructions.md` (omit rationale, keep actionable steps).

## Metadata

Last updated: 2025-09-29 (aligned HeroUI v3 guidance: composition-first, onPress usage rules, UserAvatar wrapping guidance)
