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
- **Deploys happen in CI on merge to `main`.** Hosting goes out every time; functions go out when `functions/` changes. Firestore/Storage rules and indexes go out when `firestore.rules`, `firestore.indexes.json` or `storage.rules` change (`firebase-deploy-rules.yml`). Each deploy workflow has a `concurrency` group, so production deploys run one at a time in merge order; keep it when you add or edit one. PRs get a preview channel.
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
  - Firestore-triggered notifications, sent by email (Resend) and push. Push goes out as Declarative Web Push via `web-push` to `users/{uid}/pushSubscriptions` (VAPID secrets `WEB_PUSH_VAPID_PUBLIC_KEY`/`WEB_PUSH_VAPID_PRIVATE_KEY`), plus legacy FCM to `fcmTokens` until devices migrate.
  - Member emails go through the Resend batch API (`functions/src/resendBatch.ts`: 100 per call, a content-hash `Idempotency-Key` per chunk, 429/5xx retries). `notify_registration_opening` emails current paid full members (`membershipType === "full"`, `lastPaidYear` ≥ the tournament's year) unless `emailTournamentUpdates` is `false`, and only while `config/membershipSettings.automatedMemberEmailsEnabled` is `true` (the toggle in Membership settings), and skips addresses in `emailIssues`. It sets `registrationOpeningNotificationSentAt` before sending anything, so a failed run never re-emails everyone; recipients whose chunks failed go to `registrationOpeningEmailRetries/{tournamentId}` and are retried on later runs (3 attempts at most, and only while registration is open). Links carry UTM tags (`utm_source=resend`) so GA4 credits registrations to the email.
  - Bulk member emails (registration opening, Season Wrapped) carry a per-member signed one-click unsubscribe link (RFC 8058 `List-Unsubscribe` + `List-Unsubscribe-Post`, plus a footer link) built by `buildUnsubscribeUrl()` in `functions/src/emailUnsubscribe.ts`. `email_unsubscribe` verifies the HMAC (secret `EMAIL_UNSUBSCRIBE_SECRET`, which every sending function must list in `secrets`) and sets that topic's email preference to `false`; a GET only shows a confirm button, so link scanners can't unsubscribe anyone. Without the secret, emails fall back to the settings-page/mailto header. Admins can also change a member's preferences in the Edit Member modal.
  - `resend_webhook` (`functions/src/resendWebhook.ts`) verifies Resend's Svix signature (secret `RESEND_WEBHOOK_SECRET`) and records permanent bounces, spam complaints and suppressions in the admin-only `emailIssues/{lowercased email}` collection (types in `functions/src/types.ts`). The Members tab shows them and admins can clear them.
  - Season Wrapped (`functions/src/seasonWrapped/`, page `/wrapped/:year`, admin "Season Wrapped" section): admin callables generate each member's year-end story into `seasonWrapped/{year}/members/{uid}` (overwritten in place, so sent links always show the latest), publish it, and send announcements by email and app notification (push rides on the in-app doc). Sends are recorded per member in `seasonWrapped/{year}/delivery/{uid}` and never repeat a channel; generating never sends. Members' own browsers write open tracking to `seasonWrapped/{year}/views/{uid}`; admin previews (`?member=`, drafts) are not counted. Stats math lives in `seasonWrapped/stats.ts`; its money list must stay in step with `aggregateWinnings`/`rankStandings` (`season-wrapped-utils.spec.ts` checks this). Share images are rendered with Satori + resvg from the TTFs in `functions/assets/fonts`.
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
- **Offline:** Firestore uses a persistent IndexedDB cache (`persistentLocalCache`, memory in tests), and the `QueryClient` in `src/main.tsx` uses `networkMode: "offlineFirst"`, so queries answer from that cache with no reception. `logout()` clears the cache with `clearOfflineData()` and reloads to home. `OfflineWarmup` (in `DefaultLayout`) pre-reads this year's tournaments and the member's registrations; `public/firebase-messaging-sw.js` caches `/assets/**` and serves the cached shell after a 4s navigation timeout. Writes that must reach the server (e.g. registering) check `useOnlineStatus()` and are disabled offline. Test mocks of `firebase/firestore` that load the real config need `initializeFirestore` and `memoryLocalCache`.
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

- **Mobile first:** most members use the site on their phones, so every new page, component, redesign and mockup must work at 375px wide before it is considered done.
  - Write Tailwind mobile-first: base classes are the phone layout, and `sm:`/`md:`/`lg:` add the larger layouts.
  - The page body must never scroll sideways. Wide tables either scroll inside their own `overflow-x-auto` container or turn into a card list on phones.
  - Tap targets are at least 44px tall. Primary actions on long forms go in a sticky bottom bar that respects `env(safe-area-inset-bottom)`.
  - Desktop sidebars and multi-column layouts collapse to a single column on phones, with a sticky, horizontally scrolling chip bar or a dropdown for navigation.
  - Don't override the 16px input font size in `src/styles/globals.css`; it stops iOS Safari from zooming in when a field gets focus.
  - When proposing a design, show the phone layout alongside the desktop one.
- **Compound APIs:** HeroUI v3 uses compound APIs, e.g. `<Dropdown><Button/><Dropdown.Popover><Dropdown.Menu><Dropdown.Item textValue="…"/></Dropdown.Menu></Dropdown.Popover></Dropdown>`. Never use v2 names (`DropdownTrigger`, `DropdownItem`, `ModalContent`, `HeroUIProvider`). To look up v3 docs, use the scripts in `.github/skills/heroui-react/`.
- **Switch:** put `Switch.Control` (and any visible label) inside `Switch.Content`. `Switch.Content` renders the real `<input>`, so a control outside it can't be toggled (see `profile/gold-tee-switch.tsx`).
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
- **Logger levels (site):** `logger.info`/`warn` go to Sentry Logs only; `logger.error`/`fatal` also create an issue. Don't use `logger.info` for something you want to be alerted on.
- **Listener errors:** pass Firestore listener error callbacks to `reportListenerError("<name>", err)` (`src/utils/firebaseErrors.ts`). It reports `permission-denied` to Sentry, which usually means a subscription started before auth.
- **User context:** `AuthProvider` sets `Sentry.setUser({ id: uid })`. Never add email or name to it.
- **Releases:** CI names releases `rgc-react@<version>+<sha>` (`SENTRY_RELEASE`) and marks the production deploy after Firebase Hosting finishes. PR previews report as environment `preview` and don't claim commits. Source maps are uploaded to Sentry and deleted from `dist/`, so they are never public.
- **Cloud Functions:** wrap every exported trigger handler in `withSentry("<export name>", handler)` from `functions/src/sentry.ts`, so thrown errors are captured and events are flushed before the invocation ends. In `onRequest` handlers, `await runWithCors(req, res, …)` (`functions/src/httpUtils.ts`) instead of calling `corsMiddleware` directly, or the flush runs before the handler body. Expected `HttpsError`s (`unauthenticated`, `invalid-argument`, etc.) are rethrown but not reported. In functions, use `logger` from `functions/src/logger.ts`: `info`/`warn`/`error` also go to Sentry Logs (a plain-object argument becomes searchable attributes, so pass IDs there and mask emails with `maskEmail`), `error` also creates an issue, and `debug` stays in Cloud Logging. Functions report to the separate `rgc-functions` Sentry project. The functions deploy workflow writes `SENTRY_DSN` and `SENTRY_RELEASE` (`rgc-functions@<version>+<sha>`) to `functions/.env`, then creates the release and marks it deployed. Sentry is off unless `SENTRY_DSN` is set; `SENTRY_ENABLE_LOGS=false` turns off Logs only.

## Testing

- **Where tests live:** frontend tests are in `src/__tests__/*.spec.ts(x)` (jsdom); reuse `src/__tests__/helpers/` and `tournament-utils.ts` before writing new Firestore mocks. Functions tests are in `functions/src/__tests__/`.
- **Global mocks:** `src/test-setup.ts` already mocks framer-motion, `@iconify/react`, reCAPTCHA, `matchMedia`, `ResizeObserver` and Web Storage, so don't re-mock them. `@heroui-pro/react/stepper` is aliased to a stub, because HeroUI Pro needs a license token at install time.
- **Admin in tests:** to test admin UI, mock the hook: `vi.mock("@/components/membership/hooks", …)` returning `useAdminFlag: () => ({ isAdmin: true, loadingAdmin: false })` (see `payments-tab-reconcile.spec.tsx`).
- **Coverage:** significant UI flow changes need at least one test.

## Workflow

- **When unsure:** find an analogous file, copy its local pattern, and keep the diff minimal.
- **Before finishing:** check that you reused existing helpers, didn't duplicate admin or auth logic, guarded Firestore access by auth with cleanup, imported types from `src/types/*`, and that `npm run build-full` passes.
- **Commits:** use conventional commits (`feat`/`fix`/`refactor`/`chore`/`test`), with a subject of 72 characters or fewer and no trailing period.
- **Releases:** to cut a release, bump `version` in `package.json` in the release PR (semver). `.github/workflows/release.yml` tags the merge commit on `main` as `v<version>` and publishes a release with generated notes. Never create release tags by hand or move a tag after it's published.
- **Keeping this file current:** when a convention changes, update this file in the same PR. Keep the rules short, specific and checked against the code: name real files and functions, and delete rules that no longer match the codebase.
