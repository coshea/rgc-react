Assistant rules for the rgc-react repository

## Purpose

This document records the rules and conventions the user has asked the assistant to follow while working in the rgc-react repository. It is written to be concise and actionable so other contributors or automated agents can reuse it.

## How to use

- Humans: read this file before editing UI or Firestore rules. It summarizes event naming, UI patterns, modal usage, and data model expectations.
- Bots/automation: the same rules can be turned into machine-readable JSON or integrated into project checks.

## Tech Stack

- **Frontend Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **UI Components**: HeroUI
- **Styling**: Tailwind 4 CSS / Styled-components
- **HTTP Client**: Axios
- **Testing Framework**: Vitest + React Testing Library
- **Code Quality**: ESLint + Prettier
- **Database**: Firebase Firestore

## Do

- use HeroUI. make sure your code is v3 compatible
- use apex charts for charts. do not supply custom html
- default to small components. prefer focused modules over god components
- default to small files and diffs. avoid repo wide rewrites unless asked
- always consider how the mobile view will look as well. Build to also have mobile optimized components and views

## Don't

- do not hard code colors
- do not use `div`s if we have a component already
- do not add new heavy dependencies without approval

## Safety and permissions

### Allowed without prompt:

- read files, list files
- tsc single file, prettier, eslint,
- vitest single test

### Ask first:

- package installs,
- git push
- deleting files, chmod
- running full build or end to end suites

## Development Guidelines

### Component Development Standards

1. **Function Components First**: Use function components and Hooks
2. **TypeScript Types**: Define interfaces for all props
3. **Component Naming**: Use PascalCase, file name matches component name
4. **Single Responsibility**: Each component handles only one functionality

## Project Structure

```
react-project/
├── src/
│   ├── assets/             # Static assets
│   ├── components/         # Reusable components
│   ├── components/         # Reusable components
│   ├── pages/             # Page components
│   ├── hooks/             # Custom Hooks
│   ├── store/             # State management
│   ├── services/          # API services
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── styles/            # Global styles
│   ├── config/         # Configs
│   ├── App.tsx
│   └── main.tsx
├── tests/                 # Test files
├── docs/                  # Project documentation
├── .env.example          # Environment variables example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

### Project structure

- see `App.tsx` for routes
- components live in `app/components`
- Tournaments get editted in the component `tournament-editor.tsx`
- Tournaments get viewed in the component `tournament-detail.tsx`
- The list of tournament are viewed in the component `tournament-list.tsx`

## Testing Strategy

### Unit Testing Example

## Performance Optimization

### Code Splitting

```tsx
import { lazy, Suspense } from "react";

const LazyComponent = lazy(() => import("./LazyComponent"));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LazyComponent />
    </Suspense>
  );
}
```

### Memory Optimization

```tsx
import { memo, useMemo, useCallback } from "react";

const ExpensiveComponent = memo(({ data, onUpdate }) => {
  const processedData = useMemo(() => {
    return data.map((item) => ({ ...item, processed: true }));
  }, [data]);

  const handleUpdate = useCallback(
    (id) => {
      onUpdate(id);
    },
    [onUpdate]
  );

  return (
    <div>
      {processedData.map((item) => (
        <div key={item.id} onClick={() => handleUpdate(item.id)}>
          {item.name}
        </div>
      ))}
    </div>
  );
});
```

## Deployment Configuration

### Build Production Version

```bash
npm run build
```

## Core rules (explicit user requests)

1. Identity

- When asked for the assistant's name, reply with exactly: "GitHub Copilot".

2. UI interaction patterns

- Use HeroUI components, https://www.heroui.com/docs/components, when possible
- Use Tailwind for all CSS
- Prefer in-app HeroUI modals for any destructive/confirmation flows. Avoid using window.confirm.
- Use `onPress` for button event handlers in JSX props (avoid `onClick`).
- Use the project's HeroUI components (Button, Input, Avatar, Card, Table, Modal-like overlays) and existing Tailwind utility classes.
- Display avatars next to user display names in lists and cards.

3. Membership directory

- Use the existing `User` model rather than creating a new `Member` type.
- The membership directory page is a protected route (only authenticated users can access).
- Fields to show: avatar, displayName, email (own column), phone (own column). Remove role/status/department from the UI unless specifically requested.
- Admins can add, edit, and delete users. All changes must be saved to Firestore in the `users` collection.
- Normalize phone values on save and format for display.

4. Admin detection

- Admin signal should be an OR of:
  - `users/{uid}.admin` boolean field
  - `admin/{uid}.isAdmin` document
  - Firebase ID token custom claim `admin` (verify via getIdTokenResult)

5. Firestore access patterns and rules

- Only subscribe to Firestore collections after confirming authentication to avoid permission-denied snapshot errors.
- Firestore rules should allow reads of `users` for authenticated users and allow create/update/delete only if request.auth.uid==userId or the requestor is an admin (per the admin signals).
- Keep `match /admin/{adminId}` at the top-level in `firestore.rules` (not nested under other collections).

6. Coding and repo patterns

- Prefer small, focused edits. Avoid reformatting unrelated code.
- When editing files, use the same indentation style and follow TypeScript types already present in the codebase.
- Add small, low-risk adjacent improvements when possible (tests, types, docs). If a follow-up is risky or large, list it as next steps instead.
- When replacing UI patterns, consider creating small reusable components (e.g., `ConfirmationModal`) to avoid duplication.

7. UX and formatting

- Clamp long descriptions when displayed in tables (use `line-clamp-2` to limit to two lines where appropriate).
- Format currency and dates consistently using Intl APIs configured for en-US and UTC where the codebase already uses that convention.

8. Build and validation

- After substantive changes, run build/tests/linter to ensure no TypeScript or compile errors. Fix issues if they arise (iterate up to three times)
- Prioritize a clean build before ending a change set. Report any non-fatal warnings (chunk-size, dynamic imports) but continue if builds pass.

9. Confirmation modifier

- Always use an in-app confirmation modal that shows contextual information about what will be deleted (owner, team members, tournament title/date) and includes Cancel and Confirm actions.

10. Accessibility and semantics

- Provide ARIA attributes and accessible labels for interactive controls (aria-label for icon-only buttons, role and aria-pressed for toggle elements).

11. Rule updates and maintenance

- Whenever the user adds a new rule (in conversation, PR, or issue), the assistant will immediately update this `docs/AGENTS.md` file to reflect the new rule. The update should:
  - Add the new rule text under the appropriate section (or create a new numbered section) and include a one-line rationale.
  - Update the "Last updated" metadata below with the date and brief note about what changed.
  - Prefer minimal, focused edits and do not reformat unrelated content.

Metadata

- Last updated: 2025-09-08 (assistant added maintenance rule)
  Assistant rules for the rgc-react repository
