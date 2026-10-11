# Copilot Instructions

All agent rules for this repository live in [`AGENTS.md`](../AGENTS.md) at the repo root. Read and follow it before making changes. Add new rules there, not here.

Key reminders, in case `AGENTS.md` isn't loaded:

- HeroUI v3 compound APIs (`Modal.Dialog`, `Dropdown.Item`); `onPress` on HeroUI components; `addToast` from `@/providers/toast`.
- Admin status comes only from the `admin/{uid}` doc via `useAdminFlag(user)`; auth only via `useAuth()`.
- Tournament dates are date-only, midnight UTC; always format with `timeZone: "UTC"`.
- No `as any`. Run `npm run build-full` after non-trivial changes.
