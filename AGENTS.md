# AGENTS.md

These are the rules for AI coding agents working in this repository. This file is the **single source of truth**. `CLAUDE.md` and `.github/copilot-instructions.md` only point here, so don't add rules to them.

The repo is the Ridgefield Golf Club website (https://ridgefieldgolfclub.org): a Vite + React 19 + TypeScript SPA on Firebase (Auth, Firestore, Storage, Cloud Functions, Hosting). It uses HeroUI v3 + Tailwind v4, TanStack Query, React Router 7 (`react-router-dom`) and Vitest + RTL. `package.json` is the source of truth for versions.

## Commands

```bash
npm run dev                  # Vite dev server
npm run build                # tsc type-check + vite build -> dist/
npm run build-full           # build + tests + lint (the gate for non-trivial changes)
npm test                     # all frontend tests (vitest run)
npx vitest run src/__tests__/roles.spec.ts   # single file
npx vitest run -t "name substring"           # single test by name
npm run lint                 # eslint --fix over src
npx tsc --noEmit             # type-check only

npm run build:functions      # Cloud Functions (separate package in functions/, Node 22, CommonJS)
cd functions && npm test     # functions tests (node env, functions/src/__tests__/*.spec.ts)
npm run emulators            # Firebase emulators: auth, firestore, functions (UI :4000)
```

- **When to run `npm run build-full`:** after changes to types, component interfaces, Firebase interactions, routing or providers. You can skip it for edits that only change JSX string literals or Tailwind classes.
- **Pre-commit hook:** Husky runs lint, `tsc --noEmit` and the full test suite.
- **Deploys happen in CI on merge to `main`.** Hosting goes out every time; functions go out when `functions/` changes. PRs get a preview channel.
- **Env vars:** copy `.env.example` to `.env.local`. `VITE_FIREBASE_FUNCTIONS_BASE_URL` is required, and `src/api/functionsBase.ts` throws without it.

**Run these without asking:** reading and searching files, tests, lint, type-check, build.
**Ask first:** installing packages or adding heavy dependencies, deleting files, pushing commits, deploying (`npm run firebase`, `functions`, `firestore`), changing permissions (chmod).

## Architecture

- **Aliases:** `@/*` maps to `src/*`. `@@/*` maps to `functions/src/*` and is used to share types and logic with Cloud Functions.
- **Bootstrap:** `src/main.tsx` imports `src/config/sentry.ts` first, then sets up `QueryClientProvider` and `BrowserRouter`. `src/provider.tsx` wraps `ConsentProvider` → `AuthProvider` → HeroUI `Toast.Provider`. There is no `HeroUIProvider`.
- **Routing:** routes are defined in `src/App.tsx`, lazy-loaded, and take their paths from `siteConfig.pages` (`src/config/site.ts`). Route guards are `RequireAuth`, `RequireAdmin` and `RequireAdminOrBoard` in `src/components/require-*.tsx`.
- **Data layer:**
  - `src/config/firebase.ts` initializes Firebase once.
  - `src/api/*.ts` has per-domain helpers for Firestore, Storage and Functions. They enforce UID/owner integrity and throw clear errors.
  - `src/hooks/*` wraps those helpers in React Query.
  - Domain types are in `src/types/*`, plus `User` in `src/api/users.ts`.
- **Cloud Functions (`functions/src/index.ts`):**
  - PayPal membership and donation verification, done server-side.
  - Firestore-triggered notifications, sent by email (Resend) and push (FCM).
  - Avatar resize with `sharp`.
  - Genkit blog writeups.
  - The functions codebase name is `rgc-react`.
- **Security:** `firestore.rules`, `storage.rules` and `firestore.indexes.json` are at the root. New queries may need a composite index.

## Auth, Admin & Firebase

- **Auth state:** there is a single listener in `src/providers/AuthProvider.tsx`; read it with `useAuth()` and never add another listener. Check `loading` before rendering auth-gated UI; render a HeroUI `Spinner` or `null` while it's unresolved.
- **Subscriptions:** start Firestore subscriptions only after auth is confirmed, and always return a cleanup from `useEffect`.
- **Admin status:** the UI treats the `admin/{uid}` doc, with truthy `isAdmin` (or legacy `admin`), as the **only** source of truth.
  - In components, use `useAdminFlag(user)`, which returns `{ isAdmin, loadingAdmin }`. It lives in `src/components/membership/hooks.tsx` and is re-exported from `@/utils/admin`.
  - For imperative checks, use `isAdminUser` / `requireAdmin`.
  - Never read `users/{uid}.admin` or the token claim in UI code. `firestore.rules` still accepts the claim for backward compatibility. Using the doc means deleting it revokes admin rights instantly.
- **Firebase imports:** import from `src/config/firebase.ts`; never re-initialize Firebase. Heavy admin/editor paths may dynamically import `firebase/firestore` helpers (see `tournament-editor.tsx`), but always import the config module statically.
- **Writes:** use the `src/api/*` helpers (e.g. `saveUserProfile`) and keep their UID checks.
- **Current user's profile:** use `useUserProfile()`. Avatar uploads go through it: it calls `uploadResizedProfilePicture()`, which stores files under `avatars/{uid}/…` and falls back to the original if the resize fails. Don't call storage directly.
- **Permission errors:** on `permission-denied`, call `Sentry.captureException(error)` and `addToast({ title: "Access Denied", description: "You do not have permission to perform this action.", color: "danger" })`. Never show the raw Firestore error.

## Domain Rules

- **Field names:** use model field names exactly as written in `src/types/*` (e.g. tournament `winners`, `tee`, `registrationOpen`, `detailsMarkdown`).
- **Board roles:** validate with `isAllowedBoardRole()` and normalize with `normalizeRole()` (`src/types/roles.ts`).
- **Tournament dates are date-only, stored as midnight UTC.** Always format them with `timeZone: "UTC"`, and never with a local timezone, which shows the previous day. Build them from a `"YYYY-MM-DD"` string, never from local `new Date()`. This applies to the frontend and functions.
- **Privacy:** `birthYear` and `tShirtSize` are for admin use only; never show them on the public profile. Profile forms don't expose admin flags unless you're building an admin feature.
- **Membership directory:** shows avatar, name, email and phone unless the feature explicitly extends it.
- **Phone numbers:** use `normalizePhone()` / `formatPhone()` from `src/utils/phone.ts`.
- **Constants over strings:** use the enums and constants that already exist instead of string literals (e.g. `RegistrationWindowState` in `src/utils/tournamentStatus.ts`). Define new ones once and reuse them.

## UI Conventions (HeroUI v3)

- **Compound APIs:** HeroUI v3 uses compound APIs, e.g. `<Dropdown><Button/><Dropdown.Popover><Dropdown.Menu><Dropdown.Item textValue="…"/></Dropdown.Menu></Dropdown.Popover></Dropdown>`. Never use v2 names (`DropdownTrigger`, `DropdownItem`, `ModalContent`, `HeroUIProvider`). To look up v3 docs, use the scripts in `.github/skills/heroui-react/`.
- **Events:** use `onPress` on HeroUI components and `onClick` only on native elements. Never put `onPress` on native DOM nodes; wrap them in a HeroUI `Button`/`Link` instead (this includes a clickable `UserAvatar`, which deliberately doesn't forward `onPress`). Filter out non-DOM props before spreading them onto native elements.
- **Prefer HeroUI controls** over raw `<button>`/`<input>`/`<select>`/`<img>` in new code and on lines you change. Don't proactively upgrade legacy controls elsewhere in a file you touch. If raw HTML is unavoidable, keep it accessible and say why in a comment.
- **Modals:**
  - New modals use the HeroUI `Modal`: `Modal.Backdrop isOpen/onOpenChange` → `Modal.Container` → `Modal.Dialog` → `Modal.Header`/`Body`/`Footer` (see `edit-profile-modal.tsx`).
  - Legacy fixed-overlay modals (`EditMemberModal`, `DeleteMemberModal`, `RegistrationsSection`) stay as they are unless their shell must change; then migrate them.
  - Keep a modal shell in its feature file until 3 or more places need it.
  - Never use `window.confirm`.
- **Forms:** keep a local `errors` object, put `isInvalid` on the field root and add a `<FieldError>` child (see `tournament-editor/BasicInfoSection.tsx`).
- **Toasts:** call `addToast({ title, description, color })` from `@/providers/toast`. Don't import `toast` from `@heroui/react` directly.
- **Accessibility:** every control without visible text needs `aria-label`/`aria-labelledby` on the compound **root** (e.g. `SearchField`, `Select`, `DatePicker`). Keep focus visible. Style with component props (`variant`/`size`/`isIconOnly`) and Tailwind, not inline styles.
- **Components:** write function components only. Keep them focused; extract non-modal subcomponents into `src/components/` rather than growing inline render blocks.

### `UserAvatar` (`src/components/avatar.tsx`)

- The image fallback order is: `src` → `user.profileURL` → `user.photoURL` → initials (from `name` / `displayName` / `email`).
- Pass `user` when you have it, and never hand-roll `profileURL || photoURL`.
- If you only have partial data (e.g. a CSV row), pass `name` and optionally `src`. Don't pass both `user` and `name` unless you're overriding the display text.
- Extend `UserAvatar` rather than forking it. `avatar-fallback.spec.tsx` enforces this contract.

## React Query

- **Query keys** are tuples: `['userProfile', uid]`, `['tournaments']`, `['tournament', id]`.
- **Server state:** for non-trivial server state, use `useQuery`/`useMutation` rather than ad-hoc fetching into local state.
- **Optimistic updates:** use `onMutate` to save `{ previous }`, `onError` to roll back, and `onSettled` to invalidate, as `useUserProfile()` does.

## TypeScript

- **No `as any` or `<any>`**; ESLint enforces this. If you touch existing ones, refactor them away.
- Instead, use real types, type guards, `unknown` + narrowing, `?.`/`??` with explicit fallbacks, and helpers like `toDate()` (`src/api/users.ts`) for Firestore timestamps.
- Use the `User` type for user fields. For membership checks, write small guards, e.g. `(u?: User): u is User => u?.membershipType === 'full'`.

## Observability (Sentry)

- **Setup:** Sentry is initialized only in `src/config/sentry.ts`. In app code, `import * as Sentry from "@sentry/react"` and `import { logger } from "@/config/sentry"`; use `logger.fmt` when you interpolate values.
- **Errors:** wrap Firebase, storage and network calls in `try`/`catch` with `Sentry.captureException`.
- **Spans:** use `Sentry.startSpan` for Firestore reads and writes, form submits and async work over 100ms, with ops like `db.query`, `db.write`, `ui.submit` and `http.client`. Don't instrument synchronous UI state.
- **Logging config:** if you change `consoleLoggingIntegration`, change `enableLogs` to match.

## Testing

- **Where tests live:** frontend tests are in `src/__tests__/*.spec.ts(x)` (jsdom); reuse `src/__tests__/helpers/` and `tournament-utils.ts` before writing new Firestore mocks. Functions tests are in `functions/src/__tests__/`.
- **Global mocks:** `src/test-setup.ts` already mocks framer-motion, `@iconify/react`, reCAPTCHA, `matchMedia`, `ResizeObserver` and Web Storage, so don't re-mock them. `@heroui-pro/react/stepper` is aliased to a stub, because HeroUI Pro needs a license token at install time.
- **Admin in tests:** to test admin UI, mock the hook: `vi.mock("@/components/membership/hooks", …)` returning `useAdminFlag: () => ({ isAdmin: true, loadingAdmin: false })` (see `payments-tab-reconcile.spec.tsx`).
- **Coverage:** significant UI flow changes need at least one test.

## Workflow

- **When unsure:** find an analogous file, copy its local pattern, and keep the diff minimal.
- **Before finishing:** check that you reused existing helpers, didn't duplicate admin or auth logic, guarded Firestore access by auth with cleanup, imported types from `src/types/*`, and that `npm run build-full` passes.
- **Commits:** use conventional commits (`feat`/`fix`/`refactor`/`chore`/`test`), with a subject of 72 characters or fewer and no trailing period.
- **Keeping this file current:** when a convention changes, update this file in the same PR. Keep the rules short, specific and checked against the code: name real files and functions, and delete rules that no longer match the codebase.
