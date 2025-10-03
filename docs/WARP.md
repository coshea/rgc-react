# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is the **Ridgefield Golf Club** website - a React application for managing golf club tournaments, member authentication, and displaying past champions. The application is built with Vite, React, TypeScript, HeroUI components, and Firebase for authentication and hosting.

## Common Development Commands

### Development Server
```bash
npm run dev
```
Starts the Vite development server on http://localhost:5173

### Building
```bash
npm run build
```
Compiles TypeScript and builds the production bundle to `dist/` directory

### Linting
```bash
npm run lint
```
Runs ESLint on all TypeScript/TSX files in `src/` with auto-fix enabled

### Preview Production Build
```bash
npm run preview
```
Serves the production build locally for testing

### Firebase Deployment
```bash
npm run firebase
```
Builds the project and deploys to Firebase Hosting

## Architecture Overview

### Technology Stack
- **Frontend Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 6.x with hot module replacement
- **UI Library**: HeroUI (v2) - React component library built on top of React Aria
- **Styling**: Tailwind CSS with HeroUI theme integration
- **Authentication**: Firebase Auth (email/password + Google OAuth)
- **Database**: Firebase Firestore (configured but usage varies)
- **Hosting**: Firebase Hosting
- **Routing**: React Router DOM

### Project Structure

**Core Application Files:**
- `src/main.tsx` - Application entry point, sets up React root with providers
- `src/App.tsx` - Main app component with React Router routes
- `src/provider.tsx` - Combines AuthProvider and HeroUIProvider

**Key Directories:**
- `src/components/` - Reusable UI components (navbar, avatars, tournament displays)
- `src/pages/` - Route components (home, about, login, signup, contact, etc.)
- `src/providers/` - React context providers, primarily `AuthProvider.tsx`
- `src/config/` - Configuration files (`firebase.ts`, `site.ts`)
- `src/types/` - TypeScript type definitions (`tournament.ts`, etc.)
- `src/layouts/` - Layout components (`default.tsx` with navbar and main content structure)
- `src/data/` - Static data files (test tournaments and champions data)
- `src/styles/` - Global CSS styles

### Authentication Architecture

The app uses a centralized authentication system:

1. **AuthProvider** (`src/providers/AuthProvider.tsx`) provides authentication context
2. Supports email/password and Google OAuth sign-in
3. Firebase Auth handles user management
4. AuthProvider exports `useAuth()` hook for components to access user state

### Component Architecture

- **Layout System**: Uses `DefaultLayout` wrapper with navigation and main content areas
- **HeroUI Integration**: Components use HeroUI's design system for consistent styling
- **Provider Pattern**: Uses React Context for global state (auth, theme)
- **Route-based Pages**: Each page is a separate component in `src/pages/`

### Configuration

- **TypeScript**: Path mapping configured (`@/*` maps to `./src/*`)
- **Vite**: Configured with React plugin and TypeScript path resolution
- **Tailwind**: Integrated with HeroUI theme, supports dark mode
- **Firebase**: Configuration in `src/config/firebase.ts` (includes Firestore, Auth, Analytics)

### Development Patterns

- **Import Aliases**: Use `@/` prefix for all src imports (e.g., `@/components/navbar`)
- **TypeScript**: Strict mode enabled with comprehensive linting rules
- **Component Structure**: Functional components with hooks, proper TypeScript interfaces
- **Firebase Integration**: Centralized in config, accessed through context providers

### Build and Deployment

- **Development**: Vite dev server with HMR
- **Production Build**: TypeScript compilation + Vite bundling to `dist/`
- **Deployment**: Automated via `npm run firebase` to Firebase Hosting
- **SPA Configuration**: Firebase hosting configured for single-page application routing

### Testing and Quality

- **Linting**: ESLint with TypeScript support and various plugins (prettier, react-hooks, unused-imports)
- **Type Checking**: Comprehensive TypeScript configuration with strict mode
- **No Testing Framework**: Currently no test setup in place
