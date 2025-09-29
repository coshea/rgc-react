# Ridgefield Golf Club — React App

Modern React + Firebase app for Ridgefield Golf Club. It powers public pages (home, news, past champions) and member features like tournaments, registrations, membership directory, and Find a Game.

## Tech Stack

- React 18 + TypeScript
- Vite + Vitest + React Testing Library
- HeroUI (component library) + Tailwind CSS v4
- React Router v6
- TanStack Query (React Query)
- Firebase: Auth, Firestore, Storage

Path alias: `@` resolves to `src/` in Vite and Vitest configs.

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Development server

```bash
npm run dev
```

3. Type check + production build

```bash
npm run build
```

4. Run tests

```bash
npm test
```

## Firebase Setup

All Firebase initialization is centralized in `src/config/firebase.ts`.

- Auth state is provided by `AuthProvider` (`src/providers/AuthProvider.tsx`). Use `useAuth()` to access `user`, `userLoggedIn`, and auth actions. Do not create new auth listeners elsewhere.
- Firestore/Storage imports should come from `src/config/firebase.ts` (no re-init).
- Hosting and rules are configured by `firebase.json`, `firestore.rules`, and `storage.rules`.

### Deploys

- Local build + deploy via Firebase CLI is supported. GitHub Actions CI requires a `firebaseServiceAccount` secret (JSON service account) for deploys.
- App Hosting config lives in `apphosting.yaml`.

## Routing & Providers

- App routes are defined in `src/App.tsx` and use `siteConfig.pages` for stable paths.
- Global providers in `src/provider.tsx`: `AuthProvider` → `HeroUIProvider` → Toasts. Navigation is passed into HeroUI.
- Protected routes: use `RequireAuth` (`src/components/require-auth.tsx`). Example usage in App routes wraps Find a Game so only signed-in members can access it.
- Admin gating: use `RequireAdmin` (`src/components/require-admin.tsx`). Admin capability is determined client-side by the existence of a Firestore doc at `admin/{uid}` with truthy `isAdmin`.

## Data & Domain Models

- Tournament model in `src/types/tournament.ts` (fields include `winners`, `tee`, `registrationOpen`, `detailsMarkdown`).
- Board roles in `src/types/roles.ts` with helpers to validate and normalize roles.
- Current user profile logic is encapsulated by `useUserProfile()` and user helpers in `src/api/users.ts`.

## Find a Game

Feature for members to post they need players or need a group for a given date.

- API: `src/api/find-a-game.ts`

  - Collection name: `findAGame`
  - Fields: `type` ("needPlayers" | "needGroup"), `date` (Y-M-D), optional `time` (HH:mm), optional `openSpots` (1–3), `ownerId`, `createdAt`.
  - Streams: `onFuturePosts()` returns future-dated posts sorted by date asc, createdAt desc.
  - Create/Update enforce UID integrity and validation (open spots range). Time is optional.

- UI: `src/pages/find-a-game.tsx`

  - Route is protected with `RequireAuth`.
  - Create and Edit use a single modal (`FindAGamePostModal`) with HeroUI Form, DatePicker, TimeInput.
  - Posts are grouped by type and rendered in a compact two-column layout via `PostsList`.
  - Owner identity shows avatar and quick actions to email/phone when available.

- Firestore rules: owner or admin can update/delete; reading is public or member-gated depending on your rules. A composite index is required for the future-posts query (date asc, createdAt desc). The Firebase console will provide the exact index link if missing.

## Admin Detection

- UI considers users as admin when a Firestore doc exists at `admin/{uid}` with `isAdmin: true` (or legacy `admin`).
- For a one-off check, use utilities in `src/utils/admin.ts` (e.g., `isAdminUser`, `requireAdmin`). For real-time checks in components, use `useDocAdminFlag(user)`.

## UI Conventions

- Use HeroUI components with `onPress` (not `onClick`).
- `UserAvatar` fallback chain: explicit `src` > `user.profileURL` > `user.photoURL` > initials. Pass the full `user` when possible.
- Use toast helper `addToast({ title, description, color })` for feedback.
- Tailwind v4 classes are used across the codebase.

## Tests

- Tests live in `src/__tests__/` and use Vitest + RTL (`jsdom`).
- Common patterns: React Query query keys, admin gating, storage behaviors, and tournament detail logic.

## Contributing & Local Notes

- Keep types strict—avoid `(x as any)` on user fields. Prefer the `User` type from `src/api/users.ts` and optional chaining.
- Do not duplicate Firebase init; import from `src/config/firebase.ts`.
- For new Firestore interactions, guard for auth and clean up subscriptions on unmount.
- Prefer dynamic Firestore imports in heavy admin-only features for performance.

## License

MIT
