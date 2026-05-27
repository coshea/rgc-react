# Project AI Instructions (rgc-react)

Concise, project-specific guidance for AI coding agents. Focus on these conventions and patterns only; keep guidance terse and avoid generic React tutorials.

## 1. Tech & Build Essentials

- Stack: React 18 + TypeScript, Vite, HeroUI, Tailwind v4, React Router v6, TanStack Query, Firebase (Auth/Firestore/Storage), Vitest + RTL.
- Key scripts: `npm run dev` (serve), `npm run build` (type-check + Vite), `npm test` (unit tests), `npm run firebase` (build + deploy). Always run `npm run build-full` after edits that modify TypeScript types, component interfaces, Firebase interactions, routing, or provider configuration. Edits that only change string literals in JSX, with no prop changes, logic changes, or type-annotated variable changes, or that only add or remove Tailwind utility classes inside existing `className` strings do not require a build check.
- Path alias: `@` -> `src`. Vite + vitest configs mirror this.

## 2. App Composition & Data Flow

- Routing defined centrally in `src/App.tsx`; routes use `siteConfig.pages` for stable path references.
- Global providers: `src/provider.tsx` wraps `AuthProvider` then `HeroUIProvider` then Toasts; navigation is passed into HeroUI for component-level routing.
- Auth state lives in `AuthProvider` (`src/providers/AuthProvider.tsx`); subscribe via `useAuth()`. Never replicate auth listeners elsewhere.
- When a component depends on auth state, check `loading` from `useAuth()` before rendering auth-gated UI. Render a HeroUI `Spinner` or `null` while auth is unresolved.
- User profile fetch + optimistic mutation encapsulated in `useUserProfile()` hook using React Query. Reuse it instead of manual Firestore calls for the current user.

## 3. Firebase Interaction Patterns

- Central initialization in `src/config/firebase.ts`; import from there (do NOT re-init or inline config).
- Firestore writes: helper funcs in `src/api/users.ts`; preserve UID integrity checks (they deliberately throw clear errors). Reuse instead of duplicating logic.
- Avatar uploads: use `uploadProfilePicture()` (enforces uid matching) before saving profile.
- Real-time subscriptions (e.g. membership directory, registrations) are initiated ONLY after confirming authentication to avoid permission errors.
- When a Firestore operation fails with `permission-denied`, call `Sentry.captureException(error)` and show `addToast({ title: "Access Denied", description: "You do not have permission to perform this action.", color: "danger" })`. Do not expose raw Firestore error messages to the user.

## 4. Auth & Admin Detection

- UI logic now treats the Firestore doc `admin/{uid}` as the single source of truth for admin capabilities. A user is considered an admin client‑side when the admin doc exists with a truthy `isAdmin` (or legacy `admin`) field.
- Firestore security rules still accept either the custom claim OR the admin doc for backward compatibility, but **no new UI code should rely on the token claim**. This keeps admin revocation instantaneous (doc delete) without requiring token refresh.
- To check admin status in components:
  - Prefer the hook: `useAdminFlag(user)` (real‑time subscription, returns `{ isAdmin, loadingAdmin }`).
  - For one‑off / guard style checks, use utilities in `@/utils/admin` (`isAdminUser`, `requireAdmin`).
- `RequireAdmin` has been refactored to rely solely on the admin doc (no `userProfile.admin` fallback). It renders a transient "Checking access..." state while resolving, then redirects to `/` if not authorized.
- When writing tests that need admin privileges, emit a snapshot for the path `admin/<testUid>` with `{ isAdmin: true }` before asserting on admin‑only UI.

## 5. Domain Models & State

- Tournament model: `src/types/tournament.ts` (includes `winners`, `tee`, `registrationOpen`, `detailsMarkdown`). Use these fields verbatim; don’t rename.
- Board roles: `ALLOWED_BOARD_ROLES` + `ROLE_PRIORITY` in `src/types/roles.ts`. Always validate with `isAllowedBoardRole()`; normalize via `normalizeRole()` when persisting or displaying.
- User profile payload shape in `api/users.ts`; form UIs should not expose admin flags unless explicitly building an admin management feature.

## 6. UI & UX Conventions

- In new code, prefer HeroUI primitives and composition. Use `onPress` on HeroUI components, prefer HeroUI-specific props or compound APIs over direct React Aria primitives, and compose patterns such as `Dropdown` + `DropdownTrigger` + `Button` instead of ad-hoc `div` wrappers.
- If you need a pressable around a non-HeroUI element, or a clickable `UserAvatar`, wrap it in a HeroUI `Button` or `Link`. `UserAvatar` intentionally does NOT forward `onPress` to the DOM.
- Toasts: call `addToast({ title, description, color })` (provided globally) for user feedback; prefer success/error semantics already used in editors.
- Modals: use the existing lightweight fixed overlay div pattern (see membership directory & tournament editor). This modal-shell rule overrides the general subcomponent extraction rule in Section 8. Keep the modal shell in the feature file until the same shell structure is needed in 3 or more places; then extract the shared modal shell into `src/components/`. Small modal-specific child pieces are still fine when they keep a feature component readable. Never use `window.confirm`.
- Form validation: local state `errors` object + HeroUI `isInvalid`/`errorMessage` props (see `tournament-editor.tsx`). Extend this pattern if adding fields.
- Phone numbers: normalize to digits, format `(xxx) xxx-xxxx` when length 10 (helpers in directory page & CSV service). Reuse instead of re-implementing.
- Prefer HeroUI primitives (`Button`, `Input`, `Select`, `Textarea`, `Chip`, `Modal`, etc.) over raw HTML interactive elements in net-new code and on the specific lines changed to implement a request, unless no equivalent exists or the control is a specialized performance-critical primitive. Legacy preservation takes priority over this preference elsewhere in a touched file: preserve the local pattern unless the specific line being modified uses a raw HTML interactive element that must be changed to implement the requested feature. Do not proactively upgrade surrounding legacy controls. If raw HTML is necessary on a changed line, keep it accessible and document why.

- Keep icon-only controls labeled, keep focus visible, and prefer component props (variant/size/radius/isIconOnly) plus Tailwind utilities over bespoke inline styles.

### Avatar (UserAvatar) Fallback Contract

Use `UserAvatar` with: explicit `src` > `user.profileURL` > `user.photoURL` > initials (derived from name/displayName/email). Apply this decision order:

- If a full `User` object is available, pass it as `user` and do not manually repeat `(profileURL || photoURL)` chains.
- If only partial data is available, such as a CSV row, pass `name` with an explicit fallback string and optionally `src` if you have a standalone image URL.
- Never pass both `user` and `name` unless you are intentionally overriding the display text.
- Alt text auto-derives from the resolved name unless overridden.

## 7. React Query Patterns

- Query keys: `['userProfile', uid]` convention—extend with similar tuple patterns (`['tournaments']`, `['tournament', id]`) for cache clarity.
- Optimistic updates: use `onMutate` + rollback pattern mirrored in `useUserProfile()`; maintain shape `previous` in mutation context.

## 8. Performance & Code Organization

- Prefer dynamic imports of Firestore SDK helpers from `firebase/firestore` inside event handlers or effects for large, conditional code paths (see `tournament-editor.tsx`). Keep importing initialized app services from `src/config/firebase.ts`; do not dynamically import or recreate Firebase config.
- Keep components focused: large feature editors group concerns (validation, conditional sections, live lists) but still compartmentalize sub-features (e.g. `WinnerForm`, `RegistrationsList`). For non-modal UI, extract new subcomponents to `src/components/` instead of growing inline render blobs. For modal shells, follow the Section 6 modal rule.

## 9. Testing Practices

- Tests live in `src/__tests__/` and target role logic, profile hook, storage & tournament detail behaviors. When adding features, colocate new tests there; use Vitest + RTL with `jsdom` env (already configured). Mock Firestore only when no existing test helper or query pattern in `src/__tests__/` covers the collection being tested; otherwise import and reuse the existing setup.

## 10. Safe Change Checklist (apply before large PRs)

- Uses existing API/service helper where one exists.
- Does not duplicate admin detection logic—imports or centralizes appropriately.
- New Firestore interactions guard for auth first; subscriptions cleaned up on unmount.
- No redefinition of model field names; types imported from `src/types/*`.
- Build (`npm run build`) passes without new TS errors; significant UI flow changes have at least one accompanying test.

## 11. When Unsure

Prefer: read an existing analogous file → replicate the local pattern → keep the diff minimal, unless a more specific framework or safety rule above clearly applies. If a new cross-cutting rule emerges, also update `docs/AGENTS.md` (metadata section) along with this file.

---

Last generated: 2025-09-29

## 12. TypeScript Safety Policy

- **NEVER use `as any` type assertions**. If you encounter existing `as any` in a file you are editing, refactor it to the patterns below.
- **Proper type definitions**: When data comes from external sources (Firestore, APIs), create proper types and utility functions.
- **Type guards**: Use type guards and utility functions for safe narrowing (e.g., `toDate()` for Firestore timestamps).
- **Optional chaining**: Use `?.` and nullish coalescing `??` for safe property access.
- **Union types**: Use union types (`string | number`) instead of `any` when multiple types are possible.
- **Unknown over any**: If absolutely necessary, use `unknown` and narrow it with proper checks.
- **User fields**: Use the `User` type from `src/api/users.ts` for fields such as `displayName`, `name`, and `membershipType`, and prefer explicit fallbacks like `u?.displayName || fallbackFromRow`.
- **Avatar/name rendering**: Follow the `UserAvatar` contract; pass `user` when available and avoid repeating manual `(profileURL || photoURL)` chains.
- **Membership gating**: When you need conditional checks on user fields, write a small type guard, e.g. `function isFullMember(u: User | undefined): u is User { return !!u && u.membershipType === 'full'; }`.
- **Examples of proper patterns**:
  - ✅ `toDate(user.createdAt)?.getFullYear()`
  - ✅ `user.displayName ?? 'Unknown User'`
  - ✅ `function isValidUser(u: unknown): u is User { ... }`
  - ❌ `(user as any).createdAt.toDate()`
  - ❌ `data as any`

## 13. Tournament Date Convention: Date-Only, Always UTC

- `tournament.date` is a **date-only** value (no time component). It is stored in Firestore as a `Timestamp` at midnight UTC (e.g. `new Date("YYYY-MM-DD")` → midnight UTC).
- **NEVER localize tournament dates to a local timezone** (no `timeZone: "America/New_York"` or similar). Doing so converts midnight UTC to 8pm the previous day in EDT, displaying the wrong date.
- Always format tournament dates with `timeZone: "UTC"` to read the date exactly as stored:
  ```ts
  date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  ```
- When saving a tournament date from the editor, always derive it from a calendar-date string (`"YYYY-MM-DD"`) — `new Date(calendarDate.toString())` — which JavaScript parses as midnight UTC. Do NOT use `new Date()` (local midnight) or add time components.
- This applies to both the React frontend and Cloud Functions.

## 14. Avoid Magic Strings (Prefer Enums)

- Avoid hard-coded state strings (e.g. `"open"`, `"closed"`) when a typed enum/constant exists.
- Prefer exporting an enum from a single utility/module and reusing it across UI and logic.
- Example: registration window logic uses `RegistrationWindowState` from `src/utils/tournamentStatus.ts`.

## 15. Sentry Integration Guidelines

- Sentry is initialized in `src/config/sentry.ts`; do not re-initialize it elsewhere.
- Use `Sentry.captureException(error)` in `try`/`catch` blocks around Firebase, storage, and network operations.
- Create spans with `Sentry.startSpan` for Firebase reads and writes, form submissions, and async operations expected to take longer than 100ms, such as image uploads. Do not instrument simple synchronous UI state changes.
- Use clear span ops such as `db.query`, `db.write`, `ui.submit`, and `http.client`.
- Use the project logger from `src/config/sentry.ts` for structured logs, and use `logger.fmt` when interpolating variables.
- Keep logging config aligned with `src/config/sentry.ts`; if you change `consoleLoggingIntegration`, keep `enableLogs` aligned in the same `Sentry.init` config.

## Commit messages

Use conventional commits: feat/fix/refactor/chore/test. Keep subject ≤72 chars. No period at end.
