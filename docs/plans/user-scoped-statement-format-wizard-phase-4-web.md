# User-Scoped Statement Format Wizard: Phase 4 Web Plan

**Status:** Implemented
**Scope:** budget-analyzer-web
**Upstream plan:** `/workspace/transaction-service/docs/plans/user-scoped-statement-format-wizard.md`
**Phase covered:** Phase 4, steps 10-13

## Goal

Extend the user-facing create-format wizard so it supports text-based PDF
statement formats in addition to the existing CSV flow. A user can start from
`New format`, upload a CSV or PDF sample, branch into the appropriate wizard,
confirm the inferred mapping, inspect a read-only parser preview, save a
user-scoped statement format, and immediately continue through the normal
transaction import preview flow with the new `statementFormatId` selected.

CSV behavior must stay unchanged. The PDF wizard should reuse the same product
shape and code patterns as the CSV wizard, but keep PDF-specific concepts
limited to what users can act on: candidate transaction tables, visible headers,
simple column mapping, date-year handling, and debit/credit direction.

The wizard preview remains parser validation only. It must not include duplicate
handling, transaction editing, row removal, batch import, preview import tokens,
or file import history.

## Required Backend Prerequisites

Stop before implementation if any of these are not true in the generated API
spec and transaction-service behavior:

- Phase 4 service steps 1-9 from the upstream plan are implemented.
- `POST /v1/statement-formats/pdf-wizard/analyze` accepts a multipart PDF
  `file` and returns ranked transaction-table candidates or user-facing
  rejection reasons without persisting the file.
- `POST /v1/statement-formats/pdf-wizard/preview` accepts multipart `file` plus
  JSON `request` and returns read-only parsed `transactions` plus diagnostics
  without creating import state.
- `POST /v1/statement-formats/pdf-wizard/save` accepts multipart `file` plus
  JSON `request`, creates a user-scoped PDF `StatementFormat`, and returns the
  created `StatementFormatResponse`.
- PDF wizard endpoints are protected by `statementformats:write`.
- PDF validation errors return the existing `ApiErrorResponse.fieldErrors`
  shape with field paths that can be mapped to form controls.
- Scanned or OCR-dependent PDFs are rejected with a clear user-facing error
  through either `ApiErrorResponse.message`/`code` or
  `PdfWizardAnalysisResponse.rejectionReasons`.
- A saved PDF format works immediately with normal
  `POST /v1/transactions/preview?statementFormatId=<id>` and then batch import.
- Parser revisions and parser internals remain hidden from the public import
  and wizard APIs.

Current frontend baseline already satisfies the phase 3 identity work:
`ImportButton` stores `selectedStatementFormatId`, normal preview submits
`statementFormatId`, the CSV wizard invalidates `statementFormatsKeys.all`, and
save selects the returned format ID.

## Existing Frontend Context

- Import entry point:
  `src/features/transactions/components/ImportButton.tsx`
- CSV wizard:
  `src/components/statement-formats/csv-wizard/CsvStatementFormatWizardDialog.tsx`
- CSV wizard hooks:
  `src/components/statement-formats/csv-wizard/hooks/useCsvStatementFormatWizard.ts`
- Read-only wizard preview table:
  `src/components/statement-formats/csv-wizard/CsvWizardReadOnlyPreviewTable.tsx`
- Statement-format API:
  `src/api/statementFormatApi.ts`
- Statement-format types:
  `src/types/statementFormat.ts`
- Statement-format query keys and mutations:
  `src/hooks/useStatementFormats.ts`
- Normal transaction preview API:
  `src/api/transactionApi.ts`
- Error handling:
  `src/types/apiError.ts`, `src/utils/errorMessages.ts`
- Import behavior documentation:
  `docs/api-integration.md`
- Existing tests to mirror:
  `src/api/__tests__/statementFormatApi.test.ts`,
  `src/hooks/__tests__/useStatementFormats.test.tsx`,
  `src/features/transactions/components/__tests__/ImportButton.test.tsx`,
  `src/components/statement-formats/csv-wizard/__tests__/CsvStatementFormatWizardDialog.test.tsx`

Do not import from `src/features/admin/statement-formats` for this wizard. Those
components are admin CRUD surfaces, not the user-scoped parser setup flow.

## Proposed File Layout

Keep the existing CSV wizard in place and add a small shared entry point plus
PDF-specific components:

```text
src/components/statement-formats/
  StatementFormatWizardDialog.tsx
  shared/
    StatementFormatWizardReadOnlyPreviewTable.tsx
    WizardFieldErrorMessage.tsx
    WizardUnsupportedFileState.tsx
  csv-wizard/
    CsvStatementFormatWizardDialog.tsx
    hooks/
      useCsvStatementFormatWizard.ts
  pdf-wizard/
    PdfStatementFormatWizardDialog.tsx
    PdfWizardCandidateReview.tsx
    PdfWizardMappingForm.tsx
    hooks/
      usePdfStatementFormatWizard.ts
    utils/
      pdfWizardMapping.ts
    __tests__/
      PdfStatementFormatWizardDialog.test.tsx
```

The wrapper `StatementFormatWizardDialog` is the public entry used by
`ImportButton`. It owns the first file-type branch and delegates to the CSV or
PDF dialog. The CSV dialog should keep its current behavior; only add narrow
props if needed for the wrapper, such as `initialFile`.

If the wrapper would cause excessive churn, a lower-risk implementation is to
keep the CSV dialog public for phase 3 tests and make the wrapper render the
existing CSV dialog unchanged after a CSV file is selected. Do not duplicate the
CSV state machine.

## Data And API Changes

### PDF Wizard DTOs

Add PDF wizard types in `src/types/statementFormat.ts`, matching the generated
OpenAPI names:

```ts
export type PdfWizardAmountMode = 'SIGNED_AMOUNT' | 'DEBIT_CREDIT_COLUMNS';
export type PdfWizardNegativeMeans = 'CREDIT' | 'DEBIT';
export type PdfWizardYearSource = 'EXPLICIT_DATE' | 'STATEMENT_PERIOD';

export interface PdfWizardColumnMappingRequest {
  dateHeader?: string;
  dateFormat?: string;
  descriptionHeader?: string;
  amountMode: PdfWizardAmountMode;
  amountHeader?: string;
  debitHeader?: string;
  creditHeader?: string;
  typeHeader?: string;
  negativeMeans?: PdfWizardNegativeMeans;
}

export type PdfWizardColumnMappingResponse = PdfWizardColumnMappingRequest;

export interface PdfWizardTableCandidateResponse {
  candidateId?: string;
  pageNumber?: number;
  startLineNumber?: number;
  endLineNumber?: number;
  rowCount?: number;
  repeatedHeaderCount?: number;
  headers?: string[];
  sampleRows?: string[][];
  inferredMapping?: PdfWizardColumnMappingResponse;
  confidence?: number;
  columnConfidences?: Record<string, number>;
}

export interface PdfWizardAnalysisResponse {
  candidates?: PdfWizardTableCandidateResponse[];
  confidence?: number;
  rejectionReasons?: string[];
}

export interface PdfWizardMappingPreviewRequest {
  bankName: string;
  defaultCurrencyIsoCode: string;
  accountId?: string;
  headerMustContain?: string[];
  minimumRows?: number;
  yearSource: PdfWizardYearSource;
  mapping: PdfWizardColumnMappingRequest;
}

export interface PdfWizardSaveRequest {
  displayName: string;
  bankName: string;
  defaultCurrencyIsoCode: string;
  headerMustContain?: string[];
  minimumRows?: number;
  yearSource: PdfWizardYearSource;
  mapping: PdfWizardColumnMappingRequest;
}

export interface PdfWizardPreviewResponse {
  transactions?: PreviewTransaction[];
  diagnostics?: string[];
}
```

Keep `FormatType = 'CSV' | 'PDF' | 'XLSX'`; no new top-level format type is
needed.

### Derived Hidden PDF Parser Inputs

The API exposes parser setup fields that should not become advanced UI controls:

- `headerMustContain`
- `minimumRows`

Derive these from the selected table candidate and keep them in wizard state:

- Default `headerMustContain` from selected candidate headers that participate
  in the mapping.
- Default `minimumRows` from the candidate row count, clamped to a conservative
  value if the backend does not return one.
- Send these fields on preview/save, but do not render them as editable parser
  settings in the first version.

Use `candidateId` only as a local React key and candidate-selection identity
unless the generated API starts requiring it. Do not expose candidate IDs,
revision IDs, anchors, regexes, page coordinates, or raw parser rules.

### PDF Wizard API Functions

Rename the private CSV helper in `src/api/statementFormatApi.ts` from
`buildCsvWizardFormData` to `buildWizardFormData`, then add:

- `analyzePdfSample(file: File): Promise<PdfWizardAnalysisResponse>`
- `previewPdfMapping(file: File, request: PdfWizardMappingPreviewRequest):
  Promise<PdfWizardPreviewResponse>`
- `savePdfWizardFormat(file: File, request: PdfWizardSaveRequest):
  Promise<StatementFormat>`

Use the same multipart request shape as CSV:

```ts
formData.append('file', file);
formData.append(
  'request',
  new Blob([JSON.stringify(request)], { type: 'application/json' }),
);
```

Endpoints:

```text
POST /v1/statement-formats/pdf-wizard/analyze
POST /v1/statement-formats/pdf-wizard/preview
POST /v1/statement-formats/pdf-wizard/save
```

Keep the explicit multipart header pattern used by the CSV wizard API methods.

### PDF Wizard Hooks

Add React Query mutation hooks in
`src/components/statement-formats/pdf-wizard/hooks/usePdfStatementFormatWizard.ts`:

- `useAnalyzePdfWizardSample`
- `usePreviewPdfWizardMapping`
- `useSavePdfWizardFormat`

Use the same mutation variable shape as the CSV hook:

```ts
interface PdfWizardRequestVariables<TRequest> {
  file: File;
  request: TRequest;
}
```

On successful PDF save, invalidate `statementFormatsKeys.all`. Components must
call `mutate(payload, { onSuccess, onError })`; do not use `mutateAsync` with
`try/catch` in components.

## Step 10: Branching Create-Format Wizard And PDF Flow

### Entry Branch

Update `ImportButton` to import `StatementFormatWizardDialog` instead of
`CsvStatementFormatWizardDialog`.

Rename local state and handlers so they are no longer CSV-specific:

- `isCsvWizardOpen` -> `isStatementFormatWizardOpen`
- `handleOpenCsvWizard` -> `handleOpenStatementFormatWizard`
- `handleCsvWizardSaved` -> `handleStatementFormatWizardSaved`

Keep the visible button label `New format`.

The wrapper dialog should start with a sample upload step:

- File input accepts `.csv,text/csv,.pdf,application/pdf`.
- Disable continue/analyze until a file is selected.
- Detect type by extension and MIME type.
- Route `.csv`/`text/csv` to the existing CSV dialog flow.
- Route `.pdf`/`application/pdf` to the PDF wizard flow.
- Reject anything else inline with a simple message.

The existing normal import file input already accepts `.csv,.pdf`; do not change
normal import behavior.

### PDF Wizard State Machine

Build the PDF dialog as a small state machine, mirroring CSV:

```ts
type PdfWizardStep =
  | 'upload'
  | 'candidate-review'
  | 'mapping'
  | 'parser-preview'
  | 'unsupported';
```

Keep the uploaded sample `File` in memory for the wizard lifetime. The backend
does not persist wizard sample files, so analyze, preview, and save must send
the file again.

If the shared wrapper owns upload and passes an `initialFile`, the PDF dialog can
start at `candidate-review` after analyze. If the PDF dialog owns upload, keep
the same upload step internally. Pick the smaller change after reading the CSV
dialog test impact.

### PDF Upload / Analyze

Controls:

- PDF file input, accepting `.pdf,application/pdf`.
- Analyze button.
- Cancel button.

Behavior:

- Disable Analyze until a file is selected.
- On Analyze, call `useAnalyzePdfWizardSample`.
- On success with candidates:
  - Store `candidates`.
  - Select the highest-ranked first candidate by default.
  - Initialize editable mapping state from selected candidate
    `inferredMapping`, defaulting `amountMode` to `SIGNED_AMOUNT` only if the
    backend omitted it.
  - Initialize `headerMustContain`, `minimumRows`, and `yearSource`.
  - Move to `candidate-review` or `mapping`.
- On success with no candidates and `rejectionReasons`, move to `unsupported`.
- On 422 error, show a dialog-level message using `formatApiError`; scanned PDF
  and no-text cases should be presented as unsupported-file states when the
  backend provides user-facing wording.

### Candidate Review

Render candidate selection only from user-meaningful fields:

- Candidate rank, such as `Best match`, `Option 2`, `Option 3`.
- Page number if available.
- Row count.
- Repeated header count if it helps explain confidence.
- Confidence as a percentage when provided.
- A read-only sample-row grid using candidate `headers` and `sampleRows`.

Do not show line numbers, candidate IDs, parser revision IDs, anchors, regexes,
raw extracted text, or page coordinates.

Low-confidence state:

- Do not block solely on a client-side confidence threshold.
- If confidence is present and low, show a warning banner such as
  `We are not fully confident this is the transaction table. Review the rows and mapping before previewing.`
- Let the preview/save endpoints be the source of truth for validity.

Primary action:

- `Continue Mapping`

Secondary actions:

- Back to upload or file selection.
- Cancel.

### PDF Mapping Step

Render the selected candidate summary and a small read-only sample-row grid.
Keep stable table dimensions and horizontal scrolling for mobile.

Common format controls, matching CSV:

- `displayName` input, required, `maxLength=100`.
- `bankName` input, required, `maxLength=100`.
- `defaultCurrencyIsoCode` select, required, populated from
  `useCurrencies(true)` plus `USD`.
- `accountId` input, optional, `maxLength=100`, used only for parser preview.

PDF mapping controls:

- `dateHeader` select, required.
- `dateFormat` input, required when `dateHeader` is set, `maxLength=50`.
- `yearSource` simple choice, required:
  - `Dates include a year` -> `EXPLICIT_DATE`
  - `Use the statement period` -> `STATEMENT_PERIOD`
- `descriptionHeader` select, required.
- `amountMode` segmented control:
  - `SIGNED_AMOUNT`
  - `DEBIT_CREDIT_COLUMNS`
- For `SIGNED_AMOUNT`:
  - `amountHeader` select, required.
  - `negativeMeans` simple choice, required:
    - `Negative means money received` -> `CREDIT`
    - `Negative means money spent` -> `DEBIT`
- For `DEBIT_CREDIT_COLUMNS`:
  - `debitHeader` select, required.
  - `creditHeader` select, required.
- `typeHeader` select, optional.

Ambiguous debit/credit direction:

- If inference omits `negativeMeans`, render the negative-amount question
  prominently for signed amount mode.
- If preview/save returns a field error for `mapping.negativeMeans` or
  `negativeMeans`, keep the user on mapping and show the error beside that
  question.
- Do not expose internal wording such as parser confidence formulas or rule
  names.

Do not add client-only parser validation that can drift from the backend. Use
HTML constraints for required and max-length checks, then rely on the
preview/save endpoints for parser validation. Field-specific API errors should
render beside matching controls using the same field-error lookup pattern as
the CSV wizard.

Primary action:

- `Preview Mapping`
- Sends `PdfWizardMappingPreviewRequest`.
- On success, stores read-only parsed transactions and diagnostics, then moves
  to `parser-preview`.

Secondary actions:

- Back to candidate review.
- Cancel.

### PDF Parser Preview Step

Render:

- Display name, bank, currency, file name, and selected candidate summary.
- User-facing diagnostics returned by preview.
- A read-only parsed transaction table with the same columns as CSV:
  - Date
  - Description
  - Type
  - Amount
  - Currency
  - Account ID

Extract `CsvWizardReadOnlyPreviewTable` to a shared
`StatementFormatWizardReadOnlyPreviewTable` and update the CSV wizard to use
the shared name. Do not reuse `PreviewTable`, because that table intentionally
exposes edit, remove, duplicate, and import-review affordances.

Actions:

- `Back` returns to mapping and preserves user edits.
- `Save Format` calls `savePdfWizardFormat`.
- `Cancel` closes the wizard.

Save payload must not include `accountId`; account ID is an import-time preview
value, not part of a reusable statement format.

## Step 11: PDF-Specific Unsupported And Low-Confidence States

### Unsupported File State

Render a dedicated unsupported state when:

- Analyze returns no candidates plus `rejectionReasons`.
- Analyze returns a 422 that clearly represents scanned/OCR-dependent PDF, no
  extractable text, no transaction table, too few valid rows, or ambiguous table
  structure.

UI content:

- A clear heading such as `This PDF cannot be used to create a format`.
- A short list of backend-provided rejection reasons.
- A primary action to choose another file.
- A secondary Cancel action.

Do not suggest OCR support, manual parser rules, support submission, or admin
diagnostics unless those workflows exist.

### Scanned PDF Rejection

If the backend returns a stable code for scanned PDFs, add it to
`src/utils/errorMessages.ts` with wording that tells the user the PDF has no
extractable text. If the backend only returns a clear message, preserve it
through `formatApiError`.

Suggested user-facing wording:

```text
This PDF appears to be scanned, so there is no selectable text to read. Try a
downloaded statement PDF or use a CSV export if your bank provides one.
```

### Ambiguous Direction

Ambiguous debit/credit direction should be handled in the mapping step, not by
exposing parser internals:

- For signed amount tables, require the `negativeMeans` question before preview
  when inference cannot confidently fill it.
- For debit/credit column tables, make debit and credit column selections
  explicit.
- Show backend field errors next to the relevant controls.

### Diagnostics

`PdfWizardPreviewResponse.diagnostics` can be rendered as warning text only if
the strings are user-facing. If diagnostics contain internal parser terms, hide
them in the first web implementation and coordinate a backend wording change
before surfacing them.

## Step 12: Save, Refresh, Select, And Continue Import

On successful PDF save:

1. `useSavePdfWizardFormat` invalidates `statementFormatsKeys.all`.
2. `StatementFormatWizardDialog.onSaved` receives the created
   `StatementFormat`.
3. `ImportButton` sets `selectedStatementFormatId` to `createdFormat.id`.
4. Close the wizard.
5. Keep the import form expanded.
6. Preserve the normal import `accountId`.
7. Clear wizard sample file and internal wizard state.
8. Show inline success feedback near the import controls using the existing
   `MessageBanner` or custom `useToast`; do not add a toast dependency.

Use a format-agnostic success message:

```text
{displayName} saved. Choose the statement file to preview transactions.
```

After save, the user should manually choose the actual statement file and click
`Preview Transactions`. Do not auto-submit the sample PDF to normal import, even
if it is the same file the user wants to import. Parser creation and transaction
import remain separate actions.

The normal preview request must use the saved PDF format ID:

```text
POST /v1/transactions/preview?statementFormatId={createdFormat.id}
```

## Step 13: Focused Tests

### API Tests

Extend `src/api/__tests__/statementFormatApi.test.ts`:

- `analyzePdfSample` posts multipart `file` to
  `/v1/statement-formats/pdf-wizard/analyze`.
- `previewPdfMapping` posts multipart `file` plus JSON `request` to
  `/v1/statement-formats/pdf-wizard/preview`.
- `savePdfWizardFormat` posts multipart `file` plus JSON `request` to
  `/v1/statement-formats/pdf-wizard/save` and returns the created
  `StatementFormat`.
- Existing CSV wizard API tests still pass after the multipart helper rename.

### Hook Tests

Extend `src/hooks/__tests__/useStatementFormats.test.tsx` or add a focused
hook test near the PDF wizard hook:

- PDF save mutation invalidates `statementFormatsKeys.all`.
- PDF analyze and preview hooks call the expected API methods with the current
  file and request.

### Import Entry Tests

Extend `src/features/transactions/components/__tests__/ImportButton.test.tsx`:

- `New format` opens the generic create-format wizard.
- Saving a PDF format selects the returned `id`.
- After PDF save, choosing a normal statement file and clicking preview sends
  the saved `statementFormatId`.
- Existing CSV save/select behavior still works.
- Cancelling the generic wizard leaves the import form open and does not call
  normal preview.

If `New format` is gated with `usePermission('statementformats:write')`, add:

- Users with the permission see the button.
- Users without the permission do not see the button.

### PDF Wizard UI Tests

Add
`src/components/statement-formats/pdf-wizard/__tests__/PdfStatementFormatWizardDialog.test.tsx`:

- Happy path:
  - upload sample PDF
  - analyze returns candidates and inferred mapping
  - selected candidate sample rows render
  - user adjusts a column or direction
  - preview returns read-only transactions
  - save returns a new PDF `StatementFormat`
  - `onSaved` receives that format
- Unsupported scanned PDF:
  - analyze returns 422 or rejection reasons
  - unsupported state renders the user-facing reason
  - no mapping, preview, or save action is available
- Low confidence:
  - low candidate confidence renders a warning
  - user can still continue to preview
- Mapping correction:
  - user changes amount mode from `SIGNED_AMOUNT` to
    `DEBIT_CREDIT_COLUMNS`
  - preview request contains debit and credit headers
  - signed-only fields are not sent as active mapping choices
- Ambiguous direction:
  - missing `negativeMeans` requires the simple negative-amount choice
  - field error for `mapping.negativeMeans` renders beside that choice
- Save validation:
  - save 422 field errors return the user to mapping
  - dialog-level save errors render through `formatApiError`
- Read-only preview:
  - no edit inputs, remove buttons, duplicate controls, or import button appear
    in wizard preview
- No parser internals:
  - candidate ID, revision ID, anchors, regexes, and line numbers are not
    rendered
- Retry:
  - after analyze or preview error, correcting input and submitting again uses
    the current file and mapping

Use MSW for API-facing tests unless a component-level hook mock is materially
narrower for the scenario.

## UX And Accessibility Requirements

- No inline `style={...}` props; use Tailwind classes only.
- No tooltips; all required context must be visible inline.
- No new UI dependency unless the strict CSP bundle check is clean.
- Use existing Shadcn/UI primitives: `Dialog`, `Button`, `Input`, `Select`,
  `Table`, `Badge`, `Skeleton` where appropriate.
- Use lucide icons only where they add clear affordance.
- Keep dialog content scrollable on mobile with stable max dimensions.
- Every input needs a visible label.
- Disabled buttons should correspond to obvious missing required input or
  pending network work.
- Button labels should reflect the action:
  - `Analyze PDF`
  - `Continue Mapping`
  - `Preview Mapping`
  - `Save Format`
  - `Preview Transactions`

## Authorization

The backend enforces `statementformats:write` for wizard endpoints. For the
frontend action, prefer gating the `New format` button with
`usePermission('statementformats:write')` if the current permission bundle does
not guarantee import-capable users can create formats.

Do not gate on roles. If this action-level gate is added, update the
authorization table in `AGENTS.md` and the relevant auth docs in the same
implementation work.

Route-level `<PermissionGuard>` is not needed because the wizard is an inline
dialog, not a route.

## Error Handling

- Use `formatApiError` for dialog-level failures.
- Use `ApiError.response.fieldErrors` for field-level validation.
- Keep the CSV field-error helper behavior and extend it for PDF field aliases,
  such as `mapping.dateHeader` / `dateHeader`.
- Add new PDF wizard 422 codes to `src/utils/errorMessages.ts` only when the
  generated OpenAPI or backend exposes stable codes.
- Preserve backend wording for parser-specific validation when it is already
  user-facing and field-addressable.
- Do not hide backend 403/401 behavior inside the wizard; the action gate is
  only an affordance, and the API remains authoritative.

## Documentation Updates During Implementation

Because the implementation will change import wizard behavior, update
documentation in the same work:

- `docs/api-integration.md`: change the `New format` description from CSV-only
  to CSV/PDF branching and document PDF wizard parser preview at the same level
  as CSV.
- `AGENTS.md`: update the action-level gating table if `New format` becomes
  gated by `statementformats:write`.
- Do not link this plan from non-plan documentation.

## Implementation Order

1. Verify the generated OpenAPI spec and backend prerequisites.
2. Add PDF wizard DTOs to `src/types/statementFormat.ts`.
3. Add PDF wizard API methods to `src/api/statementFormatApi.ts` and update API
   tests.
4. Add PDF wizard mutation hooks and save invalidation tests.
5. Extract the read-only wizard preview table to a shared component and update
   the CSV wizard imports without changing CSV behavior.
6. Add the generic `StatementFormatWizardDialog` entry wrapper.
7. Add the PDF wizard state machine, candidate review, mapping form, unsupported
   state, parser preview, and save handling.
8. Update `ImportButton` to open the generic wizard and keep the existing
   save/select/continue behavior.
9. Add focused PDF wizard UI tests and update import entry tests.
10. Update `docs/api-integration.md` and any authorization docs affected by
    action gating.
11. Run `npm run lint:fix`.
12. Run targeted Vitest files for changed code.
13. Run `npm run test:coverage` if the implementation is broad or before
    merging.

Do not run `npm run dev`; the user controls the dev server.

## Acceptance Criteria

- `New format` can start a create-format flow for CSV or PDF samples.
- Existing CSV wizard behavior and tests still pass.
- PDF analyze shows candidate table review with sample rows and no parser
  internals.
- Scanned/unsupported PDFs render clear user-facing rejection states.
- Low-confidence candidates are clearly marked without being blocked solely by
  frontend thresholds.
- Ambiguous debit/credit direction is resolved through simple mapping controls.
- PDF parser preview is read-only and cannot import transactions.
- PDF save refreshes the format list, selects the new format ID, preserves the
  normal import account ID, and returns the user to expanded normal import
  controls.
- The saved PDF format can be used in normal transaction preview without a page
  reload.
- Focused tests cover PDF happy path, unsupported scanned PDF, mapping
  correction, save, and normal preview using the saved PDF format.
- No inline styles, runtime style injection, new toast dependency, direct
  `date-fns` imports, role-based action gates, or parser-internal UI are
  introduced.
