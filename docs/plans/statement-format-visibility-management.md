# Statement Format Visibility Management UI Plan

**Status:** Complete
**Scope:** `budget-analyzer-web`
**Source plan:** `/workspace/transaction-service/docs/plans/user-scoped-statement-format-wizard.md`, Phase 5 steps 8 and 9

## Goal

Add a user-facing statement-format management UI where users can hide and
unhide statement formats, then cover the behavior with focused UI tests.

The import dropdown must continue to use the default
`GET /v1/statement-formats` list. Hidden formats should disappear from normal
import selection because the API omits them by default, not because the
frontend carries its own hidden-format filtering rule.

## Backend Contract Now Available

Use the updated OpenAPI contract in `docs/api/budget-analyzer-api.yaml`:

- `GET /v1/statement-formats`
  - Optional query parameter: `includeHidden=true`
  - Default behavior: hidden formats are excluded.
  - Management behavior: `includeHidden=true` returns visible and hidden
    formats for the current user.
- `StatementFormatResponse.hidden`
  - Boolean flag indicating whether the current user has hidden this format.
  - Present when hidden state is relevant; frontend type should tolerate
    missing values as `false`.
- `POST /v1/statement-formats/{id}/hide`
  - Idempotently hides a format from the current user's normal import
    selection lists.
  - Returns `204`.
- `POST /v1/statement-formats/{id}/unhide`
  - Idempotently restores a hidden format to normal import selection lists.
  - Returns `204`.

Permissions:

- Route/list access: `statementformats:read`
- Hide/unhide actions: `statementformats:write`

## Prerequisite Check

The referenced transaction-service plan marks Phase 5 backend steps 1-7 as
implemented, and the local OpenAPI file includes the list, hide, and unhide
contract. No frontend-blocking prerequisite remains for Phase 5 steps 8 and 9.

Do not implement a client-only hidden-format preference fallback. If the API
contract is unavailable in an environment, surface the API error instead of
storing visibility state locally.

## Product Decisions

1. Add a normal user route for statement-format visibility management.
   - Proposed path: `/statement-formats`
   - Guard with `<PermissionGuard permission="statementformats:read">`.
   - This should not live only under `/admin/statement-formats`; regular users
     cannot access the admin layout because `AdminRoute` gates it by role.

2. Keep the existing admin statement-format catalog page focused on admin
   catalog editing for now.
   - It can be refactored later to share table primitives, but Phase 5 is about
     the current user's visibility preferences.
   - If hide/unhide is also added to the admin list, make the copy explicit
     that the action affects the current admin user's import dropdown only.

3. Provide discoverability from user chrome.
   - Add a `Statement formats` entry in `UserProfileDropdown`.
   - Optionally add a compact `Manage formats` link beside the transaction
     import controls for users with `statementformats:read`.

4. Treat hidden and disabled as distinct states.
   - Hidden: current-user preference; reversible from the management screen.
   - Disabled: global/catalog operational state; not solved in Phase 5.
   - The management table may display disabled status if returned, but should
     not add enable/disable controls.

## Implementation Steps

### 1. Update Types And API Client

Files:

- `src/types/statementFormat.ts`
- `src/api/statementFormatApi.ts`

Changes:

- Add `hidden?: boolean` to `StatementFormat`.
- Change `listFormats` to accept an options object:

  ```ts
  listFormats: async (options?: { includeHidden?: boolean }): Promise<StatementFormat[]>
  ```

- Send `includeHidden` as a query parameter only when true.
- Add:

  ```ts
  hideFormat: async (id: number): Promise<void>
  unhideFormat: async (id: number): Promise<void>
  ```

- Keep the default call path identical for import dropdowns:

  ```ts
  statementFormatApi.listFormats()
  ```

Acceptance:

- Existing default list callers still omit hidden formats via API default.
- Management callers can request hidden formats with
  `statementFormatApi.listFormats({ includeHidden: true })`.

### 2. Split Statement Format Query Keys By List Variant

File:

- `src/hooks/useStatementFormats.ts`

Changes:

- Replace the single list key with parameter-aware keys, for example:

  ```ts
  statementFormatsKeys = {
    all: ['statement-formats'] as const,
    list: (options?: { includeHidden?: boolean }) =>
      [...statementFormatsKeys.all, 'list', { includeHidden: Boolean(options?.includeHidden) }] as const,
    detail: (id: number) => [...statementFormatsKeys.all, 'detail', id] as const,
  }
  ```

- Change `useStatementFormats` to accept `{ includeHidden?: boolean }`.
- Add `useHideStatementFormat` and `useUnhideStatementFormat` mutations.
- On hide/unhide success, invalidate `statementFormatsKeys.all` so both the
  import dropdown list and the management list refresh.

Notes:

- Do not perform optimistic updates initially. The operations are idempotent and
  low frequency; invalidating keeps behavior simple and avoids split-brain list
  state between hidden and visible queries.
- Keep `staleTime` aligned with the existing 5-minute statement format cache.

Acceptance:

- `useStatementFormats()` fetches the normal visible list.
- `useStatementFormats({ includeHidden: true })` fetches the management list.
- Hide/unhide refreshes all statement-format consumers.

### 3. Add A User Management Page

New files:

- `src/features/statement-formats/pages/StatementFormatManagementPage.tsx`
- `src/features/statement-formats/components/StatementFormatVisibilityTable.tsx`

Route changes:

- In `src/App.tsx`, add under the standard `Layout` route:

  ```tsx
  <Route
    path="statement-formats"
    element={
      <PermissionGuard permission="statementformats:read">
        <LazyRoute>
          <StatementFormatManagementPage />
        </LazyRoute>
      </PermissionGuard>
    }
  />
  ```

Page behavior:

- Query `useStatementFormats({ includeHidden: true })`.
- Render loading skeletons consistent with existing list pages.
- Render API errors with `ErrorBanner` or the local error banner pattern.
- Sort rows predictably:
  - visible before hidden
  - enabled before disabled
  - `displayName`, then `bankName`
- Display columns:
  - display name
  - bank name
  - type
  - currency
  - source (`Custom` for `scope === 'USER'`, `System` for `scope === 'SYSTEM'`)
  - status badges (`Hidden` / `Visible`, plus `Disabled` when `enabled === false`)
  - action
- For users with `statementformats:write`:
  - visible row action: `Hide from import`
  - hidden row action: `Restore to import`
- For users without `statementformats:write`:
  - omit hide/unhide actions and show read-only visibility state.

Interaction behavior:

- Hide and unhide should call mutation hooks with callbacks:
  - on success: show a custom toast or inline `MessageBanner`
  - on error: show API error feedback
- Disable only the clicked row's action while its mutation is pending.
- Keep copy precise:
  - Hide copy: `Hide from import`
  - Unhide copy: `Restore to import`
  - Success copy: `<name> is hidden from import lists.`
  - Restore success copy: `<name> is available for imports again.`

CSP/UI constraints:

- Use Tailwind classes only; no `style={...}`.
- Do not add tooltips.
- Use existing UI primitives and icons from `lucide-react`.
- Use the existing custom toast system if using transient feedback.

Acceptance:

- A user with read permission can load the page and see visible and hidden
  formats.
- A user with write permission can hide and restore formats.
- Hidden rows remain on the management page after mutation refresh because it
  uses `includeHidden=true`.
- Hidden rows do not appear in the import dropdown because the dropdown uses
  the default list.

### 4. Add Navigation To The Management Page

Files:

- `src/features/auth/components/UserProfileDropdown.tsx`
- Optional: `src/features/transactions/components/ImportButton.tsx`

Changes:

- Add a `Statement formats` menu item linking to `/statement-formats`.
- Gate the menu item with `usePermission('statementformats:read')`.
- If adding the optional import-adjacent link, use `usePermission` at the top of
  `ImportButton` and render a normal `Link` or button-style link to
  `/statement-formats`.

Hook rule:

- Do not call `usePermission` inside array filters or callbacks. Read the
  boolean at the top of the component and conditionally render.

Acceptance:

- Regular users can discover the management page without admin access.
- Users without `statementformats:read` do not see the link.

### 5. Keep Import Dropdown Semantics API-Driven

File:

- `src/features/transactions/components/ImportButton.tsx`

Expected behavior:

- The import dropdown should continue calling `useStatementFormats()` without
  `includeHidden`.
- Do not add `.filter((format) => !format.hidden)` to the dropdown.
- Existing filters for `enabled` and available currency can remain because they
  represent current frontend selection requirements, not hidden preferences.

Edge cases:

- If a format is hidden in the management page while the import form is open,
  query invalidation should refresh the dropdown data.
- If the currently selected format disappears after a refresh, add a small
  follow-up guard only if tests expose a broken state. A conservative guard is
  to clear `selectedStatementFormatId` when no enabled dropdown option matches
  it, but avoid introducing `useEffect` unless needed to synchronize with an
  external query state change.

Acceptance:

- Hidden formats disappear from normal import selection after the list query
  refreshes.
- No parser revision IDs or hidden implementation details appear in the import
  dropdown.

### 6. Test API Client And Hooks

Files:

- `src/api/__tests__/statementFormatApi.test.ts`
- `src/hooks/__tests__/useStatementFormats.test.tsx`

API client tests:

- `listFormats()` calls `/v1/statement-formats` without `includeHidden`.
- `listFormats({ includeHidden: true })` calls
  `/v1/statement-formats?includeHidden=true`.
- `hideFormat(id)` posts to `/v1/statement-formats/{id}/hide`.
- `unhideFormat(id)` posts to `/v1/statement-formats/{id}/unhide`.

Hook tests:

- Normal and management list variants use distinct query keys.
- Hide/unhide invalidates statement-format queries on success.
- Mutation errors surface as `ApiError` without swallowing messages.

### 7. Add Management Page UI Tests

New file:

- `src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx`

Cover Phase 5 step 9:

- Hiding a global/system format:
  - Seed MSW with a system format.
  - Render the page with read/write permissions.
  - Click `Hide from import`.
  - Assert the hide endpoint receives the system format ID.
  - Assert the row remains visible with `Hidden` state after refetch.

- Hiding a custom format:
  - Seed MSW with `scope: 'USER'`.
  - Click `Hide from import`.
  - Assert the row changes to `Hidden`.

- Restoring a hidden format:
  - Seed MSW with `hidden: true`.
  - Click `Restore to import`.
  - Assert the unhide endpoint receives the ID.
  - Assert the row changes to `Visible`.

- Hidden formats disappear from the import dropdown but remain recoverable:
  - Use MSW state for `/api/v1/statement-formats`.
  - Default list returns only `hidden !== true`.
  - `includeHidden=true` returns both visible and hidden rows.
  - Render `ImportButton`; assert the hidden format is absent.
  - Render the management page; assert the hidden format is present with a
    restore action.

Additional useful tests:

- Read-only users see visibility states but no hide/unhide buttons.
- API errors show user-facing feedback and do not remove the row locally.
- The profile menu link appears only with `statementformats:read`.

Testing rules:

- Prefer MSW for API-facing behavior.
- Use `@testing-library/user-event` for user workflows.
- Do not test native browser or Radix behavior directly.

### 8. Update Documentation

Files:

- `docs/api-integration.md`
- Possibly `docs/authentication.md`

Updates:

- Document that `GET /v1/statement-formats` excludes hidden formats by
  default.
- Document that management screens use
  `GET /v1/statement-formats?includeHidden=true`.
- Add hide/unhide endpoints and the distinction between hidden and disabled.
- Update the action-level permission table in `docs/authentication.md` with:
  - statement-format management page route: `statementformats:read`
  - hide/unhide actions: `statementformats:write`

Do not link this plan from non-plan documentation.

## Verification

Run focused checks first:

```bash
npx vitest src/api/__tests__/statementFormatApi.test.ts
npx vitest src/hooks/__tests__/useStatementFormats.test.tsx
npx vitest src/features/statement-formats/pages/__tests__/StatementFormatManagementPage.test.tsx
npx vitest src/features/transactions/components/__tests__/ImportButton.test.tsx
```

Then run the required quality command:

```bash
npm run lint:fix
```

Run coverage if the implementation touches shared query or route behavior
beyond the planned files:

```bash
npm run test:coverage
```

## Done Criteria

- Users with `statementformats:read` can reach a non-admin management screen.
- Users with `statementformats:write` can hide and unhide visible formats.
- The management screen uses `includeHidden=true` and remains able to recover
  hidden formats.
- The import dropdown uses the default statement-format list and has no
  hidden-format client filter.
- Tests cover hiding a system format, hiding a custom format, restoring a
  hidden format, and import dropdown exclusion with management recovery.
- Documentation reflects the new API usage and permissions.

## Completion Notes

Completed on 2026-06-02. Steps 7 and 8 are covered by MSW-backed management
page tests, import-dropdown exclusion tests, profile-menu permission tests, and
updated API/authentication documentation. The implementation uses the backend
visibility contract only; no client-side hidden-format preference fallback was
added.
