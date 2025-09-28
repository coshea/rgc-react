# Gemini Coding Rules for rgc-react

This document provides a set of coding rules and guidelines for AI agents working on the `rgc-react` repository. Adhering to these rules ensures consistency, quality, and maintainability of the codebase.

## 1. Project Overview

This is the **Ridgefield Golf Club** website - a React application for managing golf club tournaments, member authentication, and displaying past champions.

## 2. Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: HeroUI v2
- **Styling**: Tailwind CSS v4
- **Routing**: React Router v6
- **State Management & Caching**: TanStack Query
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **Testing**: Vitest with React Testing Library (RTL)
- **Linting/Formatting**: ESLint and Prettier

## 3. Development Commands

- `npm run dev`: Starts the development server.
- `npm run build`: Type-checks and builds the application for production.
- `npm run test`: Runs the unit tests.
- `npm run lint`: Lints and formats the code.
- `npm run firebase`: Builds and deploys the project to Firebase Hosting.

## 4. Architecture

- **Entry Point**: `src/main.tsx`
- **Routing**: Defined in `src/App.tsx`. Use `siteConfig.pages` for stable path references.
- **Global Providers**: Located in `src/provider.tsx`, wrapping `AuthProvider`, `HeroUIProvider`, and Toasts.
- **Path Alias**: `@` is an alias for the `src` directory. Use it for all imports from `src`.
- **Component Structure**:
    - **Pages**: Route components are in `src/pages/`.
    - **Reusable Components**: Located in `src/components/`.
    - **Layouts**: In `src/layouts/`.
- **Firebase**: Initialized in `src/config/firebase.ts`. Always import from here.

## 5. Coding Style & Conventions

- **Imports**: Use the `@/` path alias for imports from the `src` directory.
- **Type Safety**:
    - `strict` mode is enabled.
    - Avoid using `any`. Do not use `(x as any)`.
    - Use optional chaining (`?.`) and provide fallbacks.
    - Use type guards for conditional checks.
- **Variables**: Use `const` by default, `let` only when reassignment is necessary.
- **Components**: Keep components small and focused. Extract sub-components into `src/components/`.

## 6. UI & UX (HeroUI)

- **Component Usage**:
    - Always prefer HeroUI primitives (`Button`, `Input`, `Select`, etc.) over raw HTML elements.
    - Use `onPress` instead of `onClick` for all interactive HeroUI components.
- **Modals**: Use the existing lightweight fixed overlay div pattern (see membership directory & tournament editor). Do not use `window.confirm`.
- **Toasts**: Use the global `addToast({ title, description, color })` for user feedback.
- **Avatars**: Use the `UserAvatar` component. Pass the full `user` object when available. Do not re-implement the fallback logic.
- **Phone Numbers**: Normalize to digits and format as `(xxx) xxx-xxxx` for 10-digit numbers. Use helpers from the directory page or CSV service.

## 7. State Management (React Query)

- **Query Keys**: Use tuple patterns for query keys (e.g., `['userProfile', uid]`, `['tournaments']`).
- **Optimistic Updates**: Follow the pattern in `useUserProfile` using `onMutate` and a rollback mechanism for optimistic updates.
- **User Profile**: Use the `useUserProfile()` hook for fetching and performing optimistic mutations on the current user's profile.

## 8. API Interaction (Firebase)

- **Firestore Writes**: Use helper functions from `src/api/users.ts`.
- **Avatar Uploads**: Use `uploadProfilePicture()` from `src/api/storage.ts`.
- **Real-time Subscriptions**: Initiate subscriptions only after confirming authentication to prevent permission errors.
- **Dynamic Imports**: Prefer dynamic imports for large, conditional Firestore interactions (e.g., in admin-only sections).

## 9. Authentication & Authorization

- **Auth State**: Access auth state via the `useAuth()` hook from `AuthProvider`. Do not create new auth listeners.
- **Admin Detection**: The Firestore document `admin/{uid}` is the single source of truth for admin status.
    - Use the `useDocAdminFlag(user)` hook for real-time admin status checks in components.
    - Use utility functions from `@/utils/admin` for one-off checks.
- **Protected Routes**: Use the `RequireAdmin` component to protect admin-only routes.

## 10. Testing

- **Location**: Tests are located in `src/__tests__/`.
- **Frameworks**: Use Vitest and React Testing Library (RTL).
- **Environment**: `jsdom` is the test environment.
- **New Features**: When adding new features, add corresponding tests.

## 11. Before Submitting Changes

- Ensure existing API/service helpers are used where applicable.
- Verify that no new admin detection logic is duplicated.
- Confirm that new Firestore interactions are guarded by authentication checks.
- Make sure the build passes (`npm run build`) without any new TypeScript errors.
- Run relevant tests to ensure no regressions were introduced.
