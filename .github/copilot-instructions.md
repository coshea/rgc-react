# Project AI Instructions (rgc-react)

Concise, project-specific guidance for AI coding agents. Focus on THESE conventions and patterns only (not generic React advice).

## 1. Tech & Build Essentials

- Stack: React 18 + TypeScript, Vite, HeroUI, Tailwind v4, React Router v6, TanStack Query, Firebase (Auth/Firestore/Storage), Vitest + RTL.
- Key scripts: `npm run dev` (serve), `npm run build` (type-check + Vite), `npm test` (unit tests), `npm run firebase` (build + deploy). Always ensure a clean `build` after non-trivial edits.
- Path alias: `@` -> `src`. Vite + vitest configs mirror this.

## 2. App Composition & Data Flow

- Routing defined centrally in `src/App.tsx`; routes use `siteConfig.pages` for stable path references.
- Global providers: `src/provider.tsx` wraps `AuthProvider` then `HeroUIProvider` then Toasts; navigation is passed into HeroUI for component-level routing.
- Auth state lives in `AuthProvider` (`src/providers/AuthProvider.tsx`); subscribe via `useAuth()`. Never replicate auth listeners elsewhere.
- User profile fetch + optimistic mutation encapsulated in `useUserProfile()` hook using React Query. Reuse it instead of manual Firestore calls for the current user.

## 3. Firebase Interaction Patterns

- Central initialization in `src/config/firebase.ts`; import from there (do NOT re-init or inline config).
- Firestore writes: helper funcs in `src/api/users.ts`; preserve UID integrity checks (they deliberately throw clear errors). Reuse instead of duplicating logic.
- Avatar uploads: use `uploadProfilePicture()` (enforces uid matching) before saving profile.
- Real-time subscriptions (e.g. membership directory, registrations) are initiated ONLY after confirming authentication to avoid permission errors.

## 4. Auth & Admin Detection

- Admin = OR of: `users/{uid}.admin === true`, document `admin/{uid}.isAdmin === true`, or ID token claim `admin` (see logic in `membership-directory.tsx`). Maintain this tri-source pattern—don’t consolidate unless rules change.
- `RequireAdmin` component currently only checks `userProfile.admin`; if extending, mirror the full tri-source logic consistently.

## 5. Domain Models & State

- Tournament model: `src/types/tournament.ts` (includes `winners`, `tee`, `registrationOpen`, `detailsMarkdown`). Use these fields verbatim; don’t rename.
- Board roles: `ALLOWED_BOARD_ROLES` + `ROLE_PRIORITY` in `src/types/roles.ts`. Always validate with `isAllowedBoardRole()`; normalize via `normalizeRole()` when persisting or displaying.
- User profile payload shape in `api/users.ts`; form UIs should not expose admin flags unless explicitly building an admin management feature.

## 6. UI & UX Conventions

- Use HeroUI components with `onPress` (not `onClick`).
- Toasts: call `addToast({ title, description, color })` (provided globally) for user feedback; prefer success/error semantics already used in editors.
- Modals: existing pattern = lightweight fixed overlay divs (see membership directory & tournament editor). Follow that pattern or refactor to a reusable component—avoid `window.confirm`.
- Form validation: local state `errors` object + HeroUI `isInvalid`/`errorMessage` props (see `tournament-editor.tsx`). Extend this pattern if adding fields.
- Phone numbers: normalize to digits, format `(xxx) xxx-xxxx` when length 10 (helpers in directory page & CSV service). Reuse instead of re-implementing.

## 7. React Query Patterns

- Query keys: `['userProfile', uid]` convention—extend with similar tuple patterns (`['tournaments']`, `['tournament', id]`) for cache clarity.
- Optimistic updates: use `onMutate` + rollback pattern mirrored in `useUserProfile()`; maintain shape `previous` in mutation context.

## 8. Performance & Code Organization

- Prefer dynamic Firestore imports (`import('firebase/firestore')`) inside event handlers/effects for large, conditional code paths (see `tournament-editor.tsx`). Follow this for new admin-only heavy interactions.
- Keep components focused: large feature editors group concerns (validation, conditional sections, live lists) but still compartmentalize sub-features (e.g. `WinnerForm`, `RegistrationsList`). Add new subcomponents in `src/components/` not inline blobs.

## 9. Testing Practices

- Tests live in `src/__tests__/` and target role logic, profile hook, storage & tournament detail behaviors. When adding features, colocate new tests there; use Vitest + RTL with `jsdom` env (already configured). Reuse existing query patterns instead of mocking Firestore ad hoc where possible.

## 10. Safe Change Checklist (apply before large PRs)

- Uses existing API/service helper where one exists.
- Does not duplicate admin detection logic—imports or centralizes appropriately.
- New Firestore interactions guard for auth first; subscriptions cleaned up on unmount.
- No redefinition of model field names; types imported from `src/types/*`.
- Build (`npm run build`) passes without new TS errors; significant UI flow changes have at least one accompanying test.

## 11. When Unsure

Prefer: read existing analogous file → replicate pattern → minimal diff. If a new cross-cutting rule emerges, also update `docs/AGENTS.md` (metadata section) along with this file.

---

Last generated: 2025-09-17
