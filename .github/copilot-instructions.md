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

- UI logic now treats the Firestore doc `admin/{uid}` as the single source of truth for admin capabilities. A user is considered an admin client‑side when the admin doc exists with a truthy `isAdmin` (or legacy `admin`) field.
- Firestore security rules still accept either the custom claim OR the admin doc for backward compatibility, but **no new UI code should rely on the token claim**. This keeps admin revocation instantaneous (doc delete) without requiring token refresh.
- To check admin status in components:
  - Prefer the hook: `useDocAdminFlag(user)` (real‑time subscription, returns `{ isAdmin, loadingAdmin }`).
  - For one‑off / guard style checks, use utilities in `@/utils/admin` (`isAdminUser`, `requireAdmin`).
- `RequireAdmin` has been refactored to rely solely on the admin doc (no `userProfile.admin` fallback). It renders a transient "Checking access..." state while resolving, then redirects to `/` if not authorized.
- When writing tests that need admin privileges, emit a snapshot for the path `admin/<testUid>` with `{ isAdmin: true }` before asserting on admin‑only UI.

## 5. Domain Models & State

- Tournament model: `src/types/tournament.ts` (includes `winners`, `tee`, `registrationOpen`, `detailsMarkdown`). Use these fields verbatim; don’t rename.
- Board roles: `ALLOWED_BOARD_ROLES` + `ROLE_PRIORITY` in `src/types/roles.ts`. Always validate with `isAllowedBoardRole()`; normalize via `normalizeRole()` when persisting or displaying.
- User profile payload shape in `api/users.ts`; form UIs should not expose admin flags unless explicitly building an admin management feature.

## 6. UI & UX Conventions

- HeroUI v3 usage: Prefer HeroUI primitives and composition; use `onPress` on HeroUI components, not on native DOM elements.
- If you need a pressable around a non-HeroUI element, wrap it in a HeroUI `Button` (or `Link`) rather than attaching `onPress` to a `div`/`span`.
- Specific exception: `UserAvatar` intentionally does NOT forward `onPress` to the DOM to avoid React warnings. If you need a clickable avatar (e.g., dropdown trigger), wrap `UserAvatar` in a HeroUI `Button` and put `onPress` on the button.
- Toasts: call `addToast({ title, description, color })` (provided globally) for user feedback; prefer success/error semantics already used in editors.
- Modals: existing pattern = lightweight fixed overlay divs (see membership directory & tournament editor). Follow that pattern or refactor to a reusable component—avoid `window.confirm`.
- Form validation: local state `errors` object + HeroUI `isInvalid`/`errorMessage` props (see `tournament-editor.tsx`). Extend this pattern if adding fields.
- Phone numbers: normalize to digits, format `(xxx) xxx-xxxx` when length 10 (helpers in directory page & CSV service). Reuse instead of re-implementing.
- Always prefer HeroUI primitives (`Button`, `Input`, `Select`, `Textarea`, `Chip`, `Modal`, etc.) over raw HTML elements (`button`, `input`, `select`, `textarea`, ad‑hoc div role="button") unless: (a) no equivalent exists, or (b) you are building a highly specialized, performance‑critical primitive. If you must use raw elements, wrap them in an accessible component and document why. Migrate legacy raw interactive elements to HeroUI during nearby edits (do not open a dedicated refactor PR solely for this unless broad changes are required).

### HeroUI v3 Alignment (from llms.txt)

- Composition first: build with `Dropdown` + `DropdownTrigger` + `Button`, `Tooltip` + `Button`, etc., not ad‑hoc `div` wrappers.
- Accessibility: ensure icon-only controls have `aria-label`; keep keyboard focus visible; prefer `onPress` on HeroUI components for unified keyboard/mouse/AT activation.
- Styling: prefer component props (variant/size/radius/isIconOnly) plus Tailwind utilities; avoid bespoke inline styles unless necessary.

### Avatar (UserAvatar) Fallback Contract

Use `UserAvatar` with: explicit `src` > `user.profileURL` > `user.photoURL` > initials (derived from name/displayName/email). Pass the full `user` object when available; do NOT manually repeat `(profileURL || photoURL)` chains in components. Only provide `name` if no `user` is passed or you need to override display text. Alt text auto-derives from resolved name unless overridden.

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

Last generated: 2025-09-29

## 12. Type-safety guardrail: user fields (no any-casts)

- Do NOT use `(x as any)` to access user fields such as `displayName`, `name`, or `membershipType`.
- Always use the `User` type from `src/api/users.ts` and prefer optional chaining with explicit fallbacks, e.g. `u?.displayName || fallbackFromRow`.
- For avatars/names in UI, rely on the `UserAvatar` contract: pass `user` when available; only pass `name` when `user` is not provided or you need to override display text. Avoid repeating manual `(profileURL || photoURL)` chains.
- If a conditional check is required (e.g., membership gating), write a small type guard (e.g., `function isFullMember(u: User | undefined): u is User { return !!u && u.membershipType === 'full'; }`).
- When adding new code, reject PRs that include `(u as any)` patterns for user data access; refactor to the above approach instead.
