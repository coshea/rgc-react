# Membership Directory Refactor Plan

## Goals
- Decompose monolithic `membership-directory.tsx` for readability, testability, and reuse.
- Isolate Firestore subscription & admin detection logic into dedicated hooks.
- Keep existing UI/UX and behavior identical (no functional regression).
- Provide granular unit test targets (CSV preflight, role validation, per-row rendering).

## New Hooks
### `useAdminFlag(user: FirebaseUser | null)`
Responsibilities:
- Subscribe to `admin/{uid}` doc.
- Fetch ID token claims for `admin` flag.
- Return `{ isAdmin, loadingAdmin }`.
- Internal state merges doc + token (OR logic).

### `useMembersSubscription(enabled: boolean)`
Responsibilities:
- Subscribe to `users` collection when `enabled` true.
- Return `{ members, loadingMembers, error }`.
- Alphabetical sort by displayName/email.

## Component Tree
```
MembershipDirectoryPage
  ├─ DirectoryHeader (title + action buttons + hidden file input)
  ├─ DirectorySearchBar (search input + summary text)
  ├─ MembersTable (desktop) | MemberCards (mobile)
  │    ├─ MemberRow (desktop row)
  │    └─ MemberCardMobile (card)
  ├─ EditMemberModal
  ├─ DeleteMemberModal
  └─ CsvPreviewModal
```

## Component Contracts
### `DirectoryHeader`
Props: `{ isAdmin: boolean; onAdd: () => void; onBulk: () => void; fileInputRef: Ref<HTMLInputElement>; onFileChange: (e) => void; }`

### `DirectorySearchBar`
Props: `{ filter: string; onFilterChange: (v: string) => void; total: number; isFiltered: boolean; }`

### `MembersTable`
Props: `{ members: User[]; filter: string; isAdmin: boolean; onEdit: (u: User) => void; onDelete: (u: User) => void; }`
Internals filter; renders `MemberRow` children.

### `MemberRow`
Props: `{ user: User; isAdmin: boolean; onEdit: (u: User) => void; onDelete: (u: User) => void; }`

### `MemberCardMobile`
Props: same as `MemberRow`.

### `EditMemberModal`
Props: `{ open: boolean; editing: User | null; form: FormState; onChange: (next) => void; onClose: () => void; onSave: () => void; }`

### `DeleteMemberModal`
Props: `{ user: User | null; onCancel: () => void; onConfirm: () => void; selfId?: string; }` (selfId to block self-delete messaging)

### `CsvPreviewModal`
Props: `{ open: boolean; rows: UserProfilePayload[]; onClose: () => void; onUpload: () => void; uploading: boolean; }`

## Data Flow
- Page holds state: `filter`, modal toggles, form state, csvRows, uploading, editing, confirmDelete.
- Hooks supply `isAdmin`, `members`.
- Child components are pure stateless UI wrappers triggering callbacks.

## Testing Strategy
- Hook tests: mock Firestore (or stub) verifying admin OR logic & member sorting.
- CSV preflight: unit test for disallowing board roles + missing email detection (simulate `uploadCsv` logic extracted into helper `preflightCsv(rows)` returning `{ ok, error }`).
- Snapshot/render tests for `MemberRow` with admin vs non-admin.

## Incremental Extraction Steps
1. Create hooks + pure presentational components side-by-side with existing page (unreferenced). Export them.
2. Add tests for `preflightCsv` logic (new util) before wiring.
3. Replace inline sections in page with new components sequentially (header/search/members/modals).
4. Remove now-unused helper functions from page (except those moved to utilities).
5. Run build & tests; ensure no diff in emitted UI (manual smoke).

## Non-Goals (Defer)
- Virtualized list (member count small).
- Role management UI redesign.
- Converting modals to portal/focus trap (future accessibility enhancement).

## Acceptance Criteria
- All previous behaviors (add/edit/delete/upload, filtering, phone formatting, board role validation) remain intact.
- New tests pass & coverage includes CSV preflight and role validation.
- Page size (bundle) does not meaningfully increase; shared code reused.
