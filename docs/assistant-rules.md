Assistant rules for the rgc-react repository

Purpose

This document records the rules and conventions the user has asked the assistant to follow while working in the rgc-react repository. It is written to be concise and actionable so other contributors or automated agents can reuse it.

How to use

- Humans: read this file before editing UI or Firestore rules. It summarizes event naming, UI patterns, modal usage, and data model expectations.
- Bots/automation: the same rules can be turned into machine-readable JSON or integrated into project checks.

Core rules (explicit user requests)

1. Identity

- When asked for the assistant's name, reply with exactly: "GitHub Copilot".

2. UI interaction patterns

- Use HeroUI components, https://www.heroui.com/docs/components, when possible
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

- Whenever the user adds a new rule (in conversation, PR, or issue), the assistant will immediately update this `docs/assistant-rules.md` file to reflect the new rule. The update should:
  - Add the new rule text under the appropriate section (or create a new numbered section) and include a one-line rationale.
  - Update the "Last updated" metadata below with the date and brief note about what changed.
  - Prefer minimal, focused edits and do not reformat unrelated content.

Metadata

- Last updated: 2025-09-08 (assistant added maintenance rule)
