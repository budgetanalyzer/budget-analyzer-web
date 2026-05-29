# User-Scoped Statement Format Wizard: Phase 3 Web Plan

**Status:** Draft
**Scope:** budget-analyzer-web
**Upstream plan:** `/workspace/transaction-service/docs/plans/user-scoped-statement-format-wizard.md`
**Phase covered:** Phase 3, steps 9-12

## Goal

Add the user-facing CSV statement-format wizard to the transaction import
screen. A user can start from `Create new statement format`, upload a CSV
sample, confirm or adjust the inferred mapping, inspect a read-only parser
preview, save a user-scoped statement format, and immediately continue through
the existing normal transaction import preview flow with the new
`statementFormatId` selected.

The wizard preview is only parser validation. It must not include duplicate
handling, transaction editing, row removal, batch import, or any import preview
token behavior.

## Required Backend Prerequisites

Stop before implementation if any of these are not true in the generated API
spec and transaction-service behavior:

- `GET /v1/statement-formats` returns visible statement formats keyed by
  `StatementFormatResponse.id`, including user-scoped formats.
- `POST /v1/transactions/preview` accepts `statementFormatId`, not only
  `format`.
- CSV wizard endpoints exist and are protected by the expected
  `statementformats:write` permission:
  - `POST /v1/statement-formats/csv-wizard/analyze`
  - `POST /v1/statement-formats/csv-wizard/preview`
  - `POST /v1/statement-formats/csv-wizard/save`
- CSV wizard endpoints accept multipart requests with `file` and, where needed,
  a JSON `request` part.
- CSV wizard validation errors return structured `ApiErrorResponse.fieldErrors`
  with field paths that can be mapped to form controls.
- Saving returns the created `StatementFormatResponse`, and the returned `id`
  works immediately with normal transaction preview.

Current frontend gap to close first: the import flow still uses `formatKey`
through `src/features/transactions/components/ImportButton.tsx`,
`src/features/transactions/hooks/usePreviewTransactions.ts`, and
`src/api/transactionApi.ts`. Phase 3 web work should include the frontend side
of the identity migration needed for the import select and preview request.

## Existing Frontend Context

- Import entry point:
  `src/features/transactions/components/ImportButton.tsx`
- Normal import preview modal:
  `src/features/transactions/components/TransactionPreviewModal.tsx`
- Editable import preview table:
  `src/features/transactions/components/PreviewTable.tsx`
- Transaction preview API:
  `src/api/transactionApi.ts`
- Statement-format API and hooks:
  `src/api/statementFormatApi.ts`,
  `src/hooks/useStatementFormats.ts`
- Statement-format types:
  `src/types/statementFormat.ts`
- Error handling:
  `src/types/apiError.ts`, `src/utils/errorMessages.ts`
- Test style:
  `src/features/transactions/components/__tests__/ImportButton.test.tsx`,
  `src/api/__tests__/statementFormatApi.test.ts`,
  `src/api/__tests__/transactionApi.test.ts`

Do not import from `src/features/admin/statement-formats` for the user wizard.
Those components are admin CRUD surfaces and still expose legacy CSV config
fields directly.

## Proposed File Layout

Create a user-facing statement-format feature separate from admin CRUD:

```text
src/features/statement-formats/
  csv-wizard/
    components/
      CsvStatementFormatWizardDialog.tsx
      CsvWizardUploadStep.tsx
      CsvWizardMappingStep.tsx
      CsvWizardParserPreviewStep.tsx
      CsvWizardReadOnlyPreviewTable.tsx
      CsvWizardFieldErrors.tsx
    hooks/
      useCsvWizardAnalyze.ts
      useCsvWizardPreview.ts
      useCsvWizardSave.ts
    utils/
      csvWizardMapping.ts
    __tests__/
      CsvStatementFormatWizardDialog.test.tsx
```

Keep API functions in `src/api/statementFormatApi.ts` and shared DTOs in
`src/types/statementFormat.ts`, matching the existing repository pattern.

## Data And API Changes

### Statement Format Identity

Update `src/types/statementFormat.ts` to match `StatementFormatResponse`:

- Keep `id: number` as the import identity.
- Add `scope?: 'SYSTEM' | 'USER'`, `ownerId?: string | null`,
  `createdAt?: string`, `updatedAt?: string`, `createdBy?: string`,
  `updatedBy?: string`.
- Treat `formatKey` as legacy/admin-only if the backend still returns it during
  migration. New import code must not depend on it.

Update `useStatementFormats` query keys:

- Keep `statementFormatsKeys.all`.
- Change detail keys and hook parameter naming from `formatKey` to `id` once
  the admin routes are migrated.
- If admin CRUD still requires `formatKey`, isolate that as a legacy admin path
  and do not let the import flow use it.

### Normal Import Preview Request

Change `transactionApi.previewTransactions` to accept:

```ts
{
  file: File;
  statementFormatId: number;
  accountId?: string;
}
```

The request URL should be:

```text
POST /v1/transactions/preview?statementFormatId={id}&accountId={accountId}
```

Update `usePreviewTransactions`, `ImportButton`, and tests accordingly. Keep the
existing 413 upload-size mapping.

### CSV Wizard DTOs

Add types based on the generated OpenAPI:

```ts
export type CsvWizardAmountMode =
  | 'SINGLE_AMOUNT_WITH_TYPE'
  | 'DEBIT_CREDIT_COLUMNS';

export interface CsvWizardColumnMappingRequest {
  dateColumn?: string;
  dateFormat?: string;
  descriptionColumn?: string;
  amountMode: CsvWizardAmountMode;
  amountColumn?: string;
  debitColumn?: string;
  creditColumn?: string;
  typeColumn?: string;
  categoryColumn?: string;
}

export interface CsvWizardAnalysisResponse {
  headers?: string[];
  sampleRows?: Record<string, string>[];
  inferredMapping?: CsvWizardColumnMappingResponse;
  confidence?: number;
  columnConfidences?: Record<string, number>;
  warnings?: CsvWizardWarningResponse[];
}

export interface CsvWizardMappingPreviewRequest {
  bankName: string;
  defaultCurrencyIsoCode: string;
  accountId?: string;
  mapping: CsvWizardColumnMappingRequest;
}

export interface CsvWizardSaveRequest {
  displayName: string;
  bankName: string;
  defaultCurrencyIsoCode: string;
  mapping: CsvWizardColumnMappingRequest;
}
```

Reuse `PreviewTransaction` for `CsvWizardPreviewResponse.transactions`, but show
it through a read-only wizard table.

### CSV Wizard API Functions

Add to `src/api/statementFormatApi.ts`:

- `analyzeCsvSample(file: File): Promise<CsvWizardAnalysisResponse>`
- `previewCsvMapping(file: File, request: CsvWizardMappingPreviewRequest):
  Promise<CsvWizardPreviewResponse>`
- `saveCsvWizardFormat(file: File, request: CsvWizardSaveRequest):
  Promise<StatementFormat>`

Use `FormData`:

```ts
formData.append('file', file);
formData.append(
  'request',
  new Blob([JSON.stringify(request)], { type: 'application/json' }),
);
```

Keep the multipart header override pattern already used in
`transactionApi.previewTransactions`.

### CSV Wizard Hooks

Add React Query mutation hooks:

- `useAnalyzeCsvWizardSample`
- `usePreviewCsvWizardMapping`
- `useSaveCsvWizardFormat`

On successful save, invalidate `statementFormatsKeys.all`. Export
`statementFormatsKeys` from `src/hooks/useStatementFormats.ts` if needed so the
wizard hook does not duplicate query key literals.

Components should call `mutate(payload, { onSuccess, onError })`. Do not use
`mutateAsync` with `try/catch` in components.

## Step 9: Import-Screen Entry Point

### Import Select Behavior

Update `ImportButton` so the statement-format select uses IDs:

- Store `selectedStatementFormatId: number | null`.
- Render enabled formats with `value={String(format.id)}`.
- Compute `selectedFormat` by `format.id`.
- Sort by `displayName`; if duplicate display names are visible, render a
  small source suffix such as `Custom` or `System` based on `scope`. Do not show
  parser revisions.
- Keep filtering out disabled formats and formats whose default currency is not
  enabled.

Add a special select item:

```text
Create new statement format
```

Selecting it should:

- Open `CsvStatementFormatWizardDialog`.
- Clear the select value back to the previous real format, or no format if none
  was selected.
- Leave the import form expanded so the user can continue after saving.

Use a sentinel constant such as `CREATE_FORMAT_SELECT_VALUE =
'__create_statement_format__'`. Never send the sentinel to APIs.

### Wizard Open State

`ImportButton` owns:

- `isCsvWizardOpen`
- `selectedStatementFormatId`
- normal import `selectedFile`
- normal import `accountId`

Pass to the wizard:

- `open`
- `onOpenChange`
- `initialAccountId` from the normal import form
- `onSaved(format: StatementFormat)`

On wizard cancellation, just close the wizard and preserve the normal import
form state.

## Step 10: CSV Wizard Flow

Build the dialog as a small state machine. Suggested states:

```ts
type CsvWizardStep = 'upload' | 'mapping' | 'parser-preview';
```

Keep the uploaded sample `File` in memory for the wizard lifetime. The backend
plan says phase 3 does not persist uploaded files, so each analyze, preview,
and save request must send the file again.

### Upload Step

Controls:

- CSV file input, accepting `.csv,text/csv`.
- Analyze button.
- Cancel button.

Behavior:

- Disable Analyze until a file is selected.
- On Analyze, call `useAnalyzeCsvWizardSample`.
- On success, store:
  - `headers`
  - `sampleRows`
  - `inferredMapping`
  - `confidence`
  - `columnConfidences`
  - `warnings`
- Initialize editable mapping state from `inferredMapping`, defaulting
  `amountMode` to `SINGLE_AMOUNT_WITH_TYPE` only if the backend omitted it.
- Move to `mapping`.
- On error, show `ErrorBanner` or `MessageBanner` inside the dialog.

### Mapping Step

Render the sample headers and a small read-only sample-row grid. Keep stable
table dimensions and horizontal scrolling for mobile.

Render mapping controls:

- `dateColumn` select, required.
- `dateFormat` input, required when `dateColumn` is set. Use OpenAPI
  `maxLength=50`; default from inference if present.
- `descriptionColumn` select, required.
- `amountMode` segmented control:
  - `SINGLE_AMOUNT_WITH_TYPE`
  - `DEBIT_CREDIT_COLUMNS`
- For `SINGLE_AMOUNT_WITH_TYPE`:
  - `amountColumn` select, required.
  - `typeColumn` select, optional unless backend validation requires it.
- For `DEBIT_CREDIT_COLUMNS`:
  - `debitColumn` select, required.
  - `creditColumn` select, required.
- `categoryColumn` select, optional.
- `displayName` input, required, `maxLength=100`.
- `bankName` input, required, `maxLength=100`.
- `defaultCurrencyIsoCode` select, required, populated from `useCurrencies(true)`
  plus `USD`.
- `accountId` input, optional, `maxLength=100`, used only for parser preview.

Do not add client-only parser rules that could disagree with the backend. Use
HTML constraints for obvious required and max-length checks, then rely on the
preview/save endpoints for parser validation. Field-specific API errors should
render next to the matching control when `fieldErrors` paths are available.

Primary action:

- `Preview Mapping`
- Sends `CsvWizardMappingPreviewRequest`.
- On success, stores read-only parsed transactions and warnings, then moves to
  `parser-preview`.

Secondary actions:

- Back to upload.
- Cancel.

### Parser Preview Step

Render:

- Display name, bank, currency, and file name summary.
- Any warnings returned by preview.
- A read-only parsed transaction table with columns:
  - Date
  - Description
  - Type
  - Amount
  - Currency
  - Account ID

Create `CsvWizardReadOnlyPreviewTable` instead of reusing `PreviewTable`,
because `PreviewTable` intentionally exposes edit, remove, duplicate, and
import-review affordances.

Actions:

- `Back` returns to mapping and preserves user edits.
- `Save Format` calls `saveCsvWizardFormat`.
- `Cancel` closes the wizard.

Save payload must not include `accountId`; account ID is an import-time value,
not part of a reusable statement format.

## Step 11: Save, Refresh, Select, And Continue Import

On successful save:

1. `useSaveCsvWizardFormat` invalidates `statementFormatsKeys.all`.
2. `ImportButton.onSaved` receives the created `StatementFormat`.
3. Set `selectedStatementFormatId` to `createdFormat.id`.
4. Close the wizard.
5. Keep the import form expanded.
6. Preserve the normal import `accountId`.
7. Clear the wizard sample file and internal wizard state.
8. Show inline success feedback near the import controls, using existing
   `MessageBanner` or the custom `useToast` system. Do not add a new toast
   dependency.

After save, the user should be able to choose the actual statement file and
click `Preview Transactions`. The normal preview request must use the saved
format ID:

```text
POST /v1/transactions/preview?statementFormatId={createdFormat.id}
```

If the same sample file is also the file the user wants to import, do not auto
submit it to normal import. The product flow says saving a parser and importing
transactions are separate actions.

## Step 12: Focused Tests

### API Tests

Update `src/api/__tests__/statementFormatApi.test.ts`:

- `analyzeCsvSample` posts multipart `file`.
- `previewCsvMapping` posts multipart `file` plus JSON `request`.
- `saveCsvWizardFormat` posts multipart `file` plus JSON `request` and returns
  the created `StatementFormat`.

Update `src/api/__tests__/transactionApi.test.ts`:

- `previewTransactions` sends `statementFormatId`, not `format`.
- Existing account ID behavior remains unchanged.
- Existing 413 mapping still works.

### Hook Tests

Update or add tests near `src/hooks/__tests__/useStatementFormats.test.tsx`:

- Save mutation invalidates the statement-format list.
- Detail/list query keys do not depend on `formatKey` for import behavior.

### Import Entry Tests

Extend `src/features/transactions/components/__tests__/ImportButton.test.tsx`:

- Enabled formats render using `id` values and preview submits
  `statementFormatId`.
- `Create new statement format` opens the CSV wizard.
- Cancelling the wizard leaves the import form open and does not call preview.
- Saving a new format selects its `id`.
- After save, choosing a normal transaction file and clicking preview sends the
  saved `statementFormatId`.
- Duplicate display names are disambiguated with `Custom` or `System` without
  exposing revisions.

### Wizard UI Tests

Add `CsvStatementFormatWizardDialog.test.tsx`:

- Happy path:
  - upload sample CSV
  - analyze returns headers and inferred mapping
  - user adjusts a column
  - preview returns read-only transactions
  - save returns a new `StatementFormat`
  - `onSaved` receives that format
- Validation errors:
  - preview/save 422 field errors render beside matching controls.
  - generic 422 errors render as dialog-level errors.
- Cancellation:
  - cancel from upload closes without API calls beyond none.
  - cancel from mapping/preview closes without save.
- Read-only preview:
  - no edit inputs, remove buttons, duplicate controls, or import button appear
    in wizard preview.
- Retry:
  - after an analyze or preview error, correcting input and submitting again
    uses the current file and mapping.

Use MSW for API-facing tests unless a component-level hook mock is materially
narrower for the scenario.

## UX And Accessibility Requirements

- No inline `style={...}` props; use Tailwind classes only.
- No tooltips; all required context must be visible inline.
- No new UI dependency unless the strict CSP bundle check is clean.
- Use existing Shadcn/UI primitives: `Dialog`, `Button`, `Input`, `Select`,
  `Table`, `Badge`, `Skeleton` where appropriate.
- Use lucide icons only where they add clear affordance, such as upload/back.
- Keep dialog content scrollable on mobile with stable max dimensions.
- Every input needs a visible label.
- Disabled buttons should correspond to obvious missing required input or
  pending network work.
- Button labels should reflect the action:
  - `Analyze CSV`
  - `Preview Mapping`
  - `Save Format`
  - `Preview Transactions`

## Error Handling

- Use `formatApiError` for dialog-level failures.
- Use `ApiError.response.fieldErrors` for field-level validation.
- Add new CSV wizard 422 codes to `src/utils/errorMessages.ts` only when the
  generated OpenAPI/backend exposes stable codes.
- Preserve backend wording for parser-specific validation where it is already
  user-facing and field-addressable.
- Do not hide backend 403/401 behavior behind permission checks inside the
  wizard. The import button is already gated by `transactions:write`; the wizard
  action itself requires statement-format write permission from the backend.

## Implementation Order

1. Verify the generated OpenAPI spec and backend prerequisites.
2. Migrate normal import preview from `formatKey`/`format` to
   `statementFormatId`.
3. Update statement-format response types for `id`, `scope`, and owner metadata.
4. Add CSV wizard DTOs, API functions, mutation hooks, and API tests.
5. Add the read-only wizard preview table.
6. Build the wizard dialog and step components.
7. Wire `Create new statement format` into `ImportButton`.
8. Implement save refresh/select behavior.
9. Add and update focused UI tests.
10. Run `npm run lint:fix`.
11. Run targeted Vitest files for changed code.
12. Run `npm run test:coverage` if the change meaningfully affects coverage or
    before merging a broad implementation.

Do not run `npm run dev`; the user controls the dev server.

## Acceptance Criteria

- The import screen includes `Create new statement format`.
- Existing saved formats still use the normal import preview flow.
- The import preview request sends `statementFormatId`.
- The CSV wizard can analyze, map, preview, and save a CSV format.
- Wizard preview is read-only and cannot import transactions.
- Saving refreshes the format list, selects the new format, and returns the user
  to the expanded normal import controls.
- The saved format can be used in normal transaction preview without a page
  reload.
- Focused tests cover happy path, validation errors, cancellation, and normal
  preview with the saved format.
- No inline styles, runtime style injection, new toast dependency, or direct
  `date-fns` imports are introduced.
