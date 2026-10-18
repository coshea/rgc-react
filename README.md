# Ridgefield Golf Club — React App

**Production:** [https://ridgefieldgolfclub.org/](https://ridgefieldgolfclub.org/?utm_source=github&utm_medium=readme&utm_campaign=repo_link)

A comprehensive, production-grade web application serving the Ridgefield Golf Club community. Built with modern React architecture and Firebase backend, this platform handles everything from public content delivery to secure member-only features including tournament management, real-time registrations, payment processing, and social coordination.

## Overview

This is a full-featured club management system that serves both public visitors and authenticated members. The application demonstrates enterprise-level patterns including:

- **Authentication & Authorization**: Firebase Auth with granular role-based access control (admin/member tiers)
- **Payment Processing**: Integrated PayPal payment flows for memberships and donations
- **Real-time Data**: Firestore subscriptions for live tournament registrations and member updates
- **Content Management**: Admin panels for tournaments, blog posts, championships, and policy documents
- **Social Features**: Member directory, Find a Game coordination system
- **Type Safety**: Strict TypeScript throughout with comprehensive domain models
- **Testing**: Unit and integration tests using Vitest and React Testing Library

## Key Features

### Public Features

- Responsive marketing pages with modern UI/UX
- Blog and news system with markdown support
- Historical championship records and money list
- Tournament schedule with weather integration
- Contact forms with EmailJS integration

### Member Features

- **Tournament System**: Browse upcoming events, view real-time registration status, register teams (with validation for team size, duplicate prevention, and registration windows)
- **Find a Game**: Post availability to coordinate golf rounds with other members
- **Membership Directory**: Searchable directory with role filtering and active member status
- **Profile Management**: Edit profile, upload avatar to Firebase Storage, manage GHIN handicap info
- **Payment Portal**: Self-service membership renewal and donation flows with PayPal integration

### Admin Features

- **Tournament Editor**: Create/edit tournaments with markdown details, registration windows, prize pools, tee selection
- **Winner Management**: Record winners with grouping support (gross/net, flights)
- **Registration Management**: View, edit, delete team registrations with owner integrity checks
- **Blog Editor**: Rich markdown editor with preview and SEO metadata
- **Championship Manager**: Maintain historical and modern championship records
- **Member Admin**: Manage member payments, board roles, and active status
- **Policy Editor**: Edit legal documents and club policies in markdown format

## Tech Stack

### Frontend

- **React 19** with TypeScript for type-safe component development
- **Vite** for fast builds and HMR in development
- **HeroUI v3** (modern React component library) + **Tailwind CSS v4** for styling
- **React Router v7** for client-side routing with protected routes
- **TanStack Query** (React Query) for server state management, caching, and optimistic updates
- **PayPal SDK** for payment processing
- **EmailJS** for contact form submissions

### Backend & Infrastructure

- **Firebase Authentication** for secure user management
- **Cloud Firestore** for real-time NoSQL database with security rules
- **Firebase Storage** for avatar and asset uploads
- **Firebase Cloud Functions** (Node.js) for payment verification and webhook handling
- **Firebase Hosting** for CDN-backed static site delivery
- **Sentry** for error tracking and performance monitoring

### Testing & Quality

- **Vitest** for fast unit testing
- **React Testing Library** for component testing
- **TypeScript strict mode** for compile-time safety

Path alias: `@` resolves to `src/` in Vite and Vitest configs.

## Architecture Highlights

### Security

- **Firestore Security Rules**: Comprehensive rules enforce data access patterns, preventing unauthorized reads/writes
- **Admin Detection**: Real-time admin status via dedicated Firestore collection (`admin/{uid}`) for instant permission revocation
- **Payment Verification**: Server-side PayPal order verification in Cloud Functions prevents client-side tampering
- **UID Integrity**: All writes enforce that `ownerId` matches authenticated user (except admin overrides)

### Performance

- **Code Splitting**: Dynamic imports for admin-heavy features to reduce initial bundle size
- **Optimistic Updates**: React Query mutations with rollback for snappy UI
- **Firebase SDK Tree-shaking**: Modular imports keep bundle lean
- **Image Optimization**: Lazy loading and responsive images throughout

### State Management

- **Auth State**: Centralized in `AuthProvider` with single Firebase listener (no duplicate subscriptions)
- **Server State**: TanStack Query handles all Firestore data with intelligent caching
- **Local State**: React hooks for component-specific UI state

### Code Quality

- **No `any` Types**: Strict policy against type assertions; proper type guards and utility functions instead
- **Domain Models**: Strongly-typed interfaces for all Firebase documents
- **Shared Components**: Reusable components like `DonationAmountInput` for consistency
- **Error Boundaries**: Graceful error handling throughout

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

- Local build + deploy via Firebase CLI is supported. GitHub Actions CI uses the `FIREBASE_SERVICE_ACCOUNT_RIDGEFIELD_GOLF_CLUB` secret (JSON service account) for deploys.
- Scheduled Cloud Functions are deployed from the functions workflow at [.github/workflows/firebase-deploy-functions.yml](.github/workflows/firebase-deploy-functions.yml); redeploy that workflow after changing any `onSchedule()` function so Firebase provisions the scheduler job.
- App Hosting config lives in `apphosting.yaml`.

#### Firebase Functions parameters and secrets

The Cloud Functions code separates runtime config into two kinds of parameters:

- `defineSecret()` values, such as `PAYPAL_CLIENT_SECRET`, are stored in Google Cloud Secret Manager / Firebase Functions secrets.
- `defineString()` values, such as `PAYPAL_CLIENT_ID` and `PAYPAL_ENVIRONMENT`, are stored as Firebase Functions params.

This means the GitHub workflow does not need to pass these values as `env:` vars during `firebase deploy`.

Set them before deploy using the Firebase CLI:

```bash
firebase functions:params:set PAYPAL_CLIENT_ID="your-paypal-client-id"
firebase functions:params:set PAYPAL_ENVIRONMENT="SANDBOX"
firebase functions:secrets:set PAYPAL_CLIENT_SECRET "your-paypal-client-secret"
```

Then deploy with:

```bash
firebase deploy --only functions:rgc-react --project ridgefield-golf-club
```

If `PAYPAL_CLIENT_ID` should be treated as sensitive, you can also migrate it to `defineSecret()` in `functions/src/paypalConfig.ts` and manage it through Secret Manager.

#### Cloud Functions monitoring (Sentry)

Cloud Functions report to the `rgc-functions` Sentry project, separate from the site's `rgc-react` project. The functions deploy workflow writes these to `functions/.env`:

- `SENTRY_DSN`: the `rgc-functions` DSN. It isn't a secret, so it lives in the workflow. Leave it empty for local deploys to keep Sentry off. Sentry never runs in the emulator or in tests.
- `SENTRY_RELEASE`: `rgc-functions@<version>+<sha>`. After deploying, the workflow creates this release, links its commits and marks it deployed to `production`.
- `SENTRY_ENABLE_LOGS` (optional): set to `false` to stop sending `logger` output to Sentry Logs. Errors are still reported.

Thrown errors and `logger.error` calls become Sentry issues. `logger.info`, `warn` and `error` also go to Sentry Logs.

#### Build-Time Environment Variables (Vite)

The client bundle is built with Vite; only variables prefixed with `VITE_` are embedded into the production build. If a variable like `VITE_PAYPAL_CLIENT_ID` is missing at build time, PayPal will be disabled in production.

For GitHub Actions deployments to Firebase Hosting, configure these repository secrets and ensure they are passed to the `npm run build` step:

- `VITE_PAYPAL_CLIENT_ID` (required for PayPal buttons)
- `VITE_PAYPAL_ENVIRONMENT` (optional; defaults to `SANDBOX` if unset)
- `VITE_FIREBASE_FUNCTIONS_BASE_URL` (if your deployment uses a non-default functions base URL)
- `SENTRY_AUTH_TOKEN` (optional; enables sourcemap upload and release tracking). The functions workflow uses the same secret for `rgc-functions` releases, so it must be an organization token, or a user token with access to both projects.

## Architecture & Coding Conventions

See [`AGENTS.md`](AGENTS.md). It is the single source of truth for architecture, conventions, and rules, for both people and AI agents (Claude Code, Copilot, Codex, Cursor, Gemini).

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

## Production Deployment

The application is deployed to Firebase Hosting with CI/CD automation:

- **URL**: [https://ridgefieldgolfclub.org/](https://ridgefieldgolfclub.org/)
- **Deployment**: GitHub Actions workflow builds and deploys on merge to main
- **Environment**: Production Firebase project with live PayPal integration
- **Monitoring**: Sentry integration for real-time error tracking

## Project Structure

```
src/
├── api/              # Firebase service wrappers (tournaments, users, payments)
├── components/       # Reusable React components
├── config/           # Firebase init, site config, pricing
├── hooks/            # Custom React hooks (useUserProfile, useAuth)
├── pages/            # Route components
├── providers/        # Context providers (Auth, HeroUI)
├── types/            # TypeScript type definitions
├── utils/            # Helper functions (admin checks, currency, roles)
└── __tests__/        # Vitest test suites

functions/            # Firebase Cloud Functions (Node.js + TypeScript)
```

## Development Practices

- **Git Workflow**: Feature branches with PR reviews before merging to main
- **Type Safety**: No type assertions (`as any`); proper type guards and narrowing
- **Testing**: Unit tests for critical logic (admin checks, registration validation, payment flows)
- **Documentation**: Inline JSDoc comments for complex functions; comprehensive README
- **Code Formatting**: Consistent style enforced by formatter

## License

MIT
