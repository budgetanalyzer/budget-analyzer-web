# Transaction Import Warning Integration Plan

## Context

The transaction service preview and batch import APIs now return more explicit
warning metadata for import review:

- Exact uploaded file re-import status is reported through
  `PreviewResponse.fileImport`.
- Likely duplicate transactions are reported on each preview row through
  `duplicate` and `duplicateReason`.
- Batch import requires `previewImportToken`.
- Duplicate rows are skipped by default unless the client sends
  `allowDuplicate: true` for that row.

The frontend still uses the previous preview shape in a few places. In
particular, `src/types/transaction.ts` still models a top-level
`warnings: PreviewWarning[]`, and `src/api/transactionApi.ts` still posts only
`{ transactions }` to `/v1/transactions/batch`.

## Product Decisions

Use these UI decisions for the implementation:

1. Exact same statement file uploaded again:
   Show a strong inline warning in the preview modal with previous import
   metadata, but allow the user to continue. Duplicate rows still skip by
   default.

2. Duplicate transaction rows:
   Keep duplicate rows visible in the preview table. Mark them clearly, skip
   them by default, and provide a per-row "Import anyway" checkbox for duplicate
   rows only.

3. Editing a duplicate row:
   If the user edits a duplicate-key field, clear that row's visible duplicate
   warning locally because the original preview match may no longer apply. The
   backend still performs the authoritative duplicate check during batch import.

These choices keep the current review-before-import flow intact while making
warnings explicit and reversible.

## API Contract Updates

Verify `docs/api/budget-analyzer-api.yaml` against the generated unified API
spec before implementation. The checked-in YAML already contains the new
`PreviewFileImportStatusResponse`, `previewImportToken`, `duplicate`,
`duplicateReason`, `allowDuplicate`, and `duplicatesImported` fields, but the
file is generated and should be refreshed from orchestration when possible.

Preferred refresh path:

```bash
cd ../orchestration
./scripts/repo/generate-unified-api-docs.sh
```

If the local cluster is unavailable, compare this repo's
`docs/api/budget-analyzer-api.yaml` with
`../orchestration/docs-aggregator/openapi.yaml` and only copy/update the
generated artifact when it reflects the current service contract.

## Type And API Client Changes

Update `src/types/transaction.ts`:

- Remove `PreviewWarning`.
- Add `PreviewDuplicateReason = 'EXISTING_TRANSACTION' | 'IN_BATCH'`.
- Add `PreviewFileWarningCode = 'FILE_ALREADY_IMPORTED'`.
- Add `PreviousFileImportResponse`.
- Add `PreviewFileImportStatusResponse`.
- Extend `PreviewTransaction` with:
  - `duplicate: boolean`
  - `duplicateReason?: PreviewDuplicateReason | null`
- Add `BatchImportTransactionRequest`, with the same editable transaction fields
  plus optional `allowDuplicate`.
- Change `BatchImportRequest` to:
  - `previewImportToken: string`
  - `transactions: BatchImportTransactionRequest[]`
- Extend `BatchImportResponse` with `duplicatesImported`.
- Keep dates as LocalDate strings and timestamps as ISO strings, using
  `src/utils/dates.ts` for display formatting.

Update `src/api/transactionApi.ts`:

- Keep preview request behavior unchanged.
- Change `batchImportTransactions` to accept a full `BatchImportRequest`.
- Post `{ previewImportToken, transactions }`.
- Do not send preview-only fields such as `duplicate` or `duplicateReason` in
  the batch payload.

Update `src/features/transactions/hooks/useBatchImport.ts`:

- Change mutation variables from `PreviewTransaction[]` to `BatchImportRequest`.
- Keep invalidation of `['transactions']` and `['transactionCount']`.

## Preview Modal Flow

Update `src/features/transactions/components/TransactionPreviewModal.tsx`:

- Initialize modal state from `previewData.transactions`.
- Stop reading `previewData.warnings`.
- Keep `previewData.previewImportToken` as opaque client state.
- Track per-row duplicate override state through the edited transaction model or
  a parallel row state structure.
- On import, build a `BatchImportRequest`:
  - include `previewData.previewImportToken`
  - include all currently visible rows
  - set `allowDuplicate: true` only for duplicate rows where the user checked
    "Import anyway"
  - omit `allowDuplicate` or send `false` for all other rows
- Disable Import when there are no rows or when every visible row would be
  skipped as a duplicate. Keep the `Import 0 Transactions, Skip n Duplicates`
  label visible so Cancel is the clear way out of the dialog.
- Update the import button label to reflect skipped duplicate rows, for example:
  `Import 12 Transactions, Skip 3 Duplicates`.
- On success, pass `created`, `duplicatesSkipped`, and `duplicatesImported` up to
  the page-level import message handler.

Use the existing controlled `Dialog` flow and existing `useEffect` sync pattern
unless the implementation can be simplified without changing behavior.

## File-Level Warning UI

Create or replace the existing warning banner with a component that understands
the new file-level object:

- Suggested file:
  `src/features/transactions/components/PreviewFileImportWarningBanner.tsx`
- Render only when `fileImport.alreadyImported` is true.
- Use existing warning styling conventions: yellow background, `AlertTriangle`,
  compact text, no tooltip.
- Include:
  - uploaded file has already been imported
  - previous filename
  - previous import timestamp formatted via `formatTimestamp`
  - previous format
  - previous account ID when present
  - previous transaction count
- Do not block the import action.

Remove or repurpose `PreviewWarningBanner.tsx` so there is not a stale
top-level warning model left in the transaction feature.

## Row-Level Duplicate UI

Update `PreviewTable.tsx` and `PreviewTableRow.tsx`:

- Add duplicate warning/status controls to the row review actions column with
  the remove action so editable fields stay compact on smaller screens.
- Let the preview dialog use available viewport width when duplicate review
  controls are present, keep horizontal table scrolling visible, and collapse
  the review column back to remove-action width when no duplicate rows remain.
- For `duplicateReason === 'EXISTING_TRANSACTION'`, show "Already imported".
- For `duplicateReason === 'IN_BATCH'`, show "Duplicate in file".
- Style duplicate rows with a subtle warning background or left border using
  Tailwind classes only.
- Provide a `Checkbox` labeled "Import anyway" for duplicate rows.
- Hide the checkbox for non-duplicate rows.
- Keep the remove button behavior unchanged.

When a user edits any duplicate-key field, clear the visible duplicate metadata
for that row:

- `date`
- `description`
- `amount`
- `type`
- `bankName`
- `currencyIsoCode`
- `accountId`

The current UI only edits date, description, amount, type, and account ID.
Clearing on those edits is enough unless the table later adds bank or currency
editing.

## Import Message Updates

Update `src/features/transactions/hooks/useImportMessageHandler.ts` and
`src/features/transactions/utils/messageBuilder.ts`:

- Accept `created`, `duplicatesSkipped`, and `duplicatesImported`.
- Keep the existing filter warning text when filters are active.
- Example success messages:
  - `Successfully imported 12 transactions.`
  - `Successfully imported 12 transactions. Skipped 3 duplicates.`
  - `Successfully imported 12 transactions, including 2 duplicates. Skipped 3 duplicates.`
- Preserve auto-dismiss for success messages.

Update `src/features/transactions/components/ImportButton.tsx` so
`handlePreviewImportComplete` forwards all counts instead of only `created`.

## Error Messages

Update `src/utils/errorMessages.ts` to keep 422 mappings synced with the
OpenAPI/service contract:

- `MISSING_ORIGINAL_FILENAME`
- `BATCH_IMPORT_NO_TRANSACTIONS_CREATED`
- `PREVIEW_IMPORT_TOKEN_INVALID`
- `PREVIEW_IMPORT_TOKEN_EXPIRED`

Suggested user-facing messages:

- `MISSING_ORIGINAL_FILENAME`: `The uploaded file must include a filename.`
- `BATCH_IMPORT_NO_TRANSACTIONS_CREATED`: `All submitted rows were skipped as duplicates.`
- `PREVIEW_IMPORT_TOKEN_INVALID`: `This preview has expired or is no longer valid. Please preview the file again.`
- `PREVIEW_IMPORT_TOKEN_EXPIRED`: `This preview has expired. Please preview the file again.`

## Documentation Updates

Update `docs/api-integration.md` after implementation:

- Add `/api/v1/transactions/preview`.
- Add `/api/v1/transactions/batch`.
- Document that preview returns `fileImport`, row duplicate metadata, and
  `previewImportToken`.
- Document that batch import requires `previewImportToken` and uses
  `allowDuplicate` per row.

Update this plan if implementation discovers a different backend shape.

## Tests

Add focused tests around the changed behavior:

- Type/API payload behavior:
  - batch import sends `previewImportToken`
  - batch import includes `allowDuplicate` only when requested
  - preview-only duplicate metadata is not sent as batch payload
- Preview modal:
  - file-level reupload warning renders previous import metadata
  - duplicate rows render the correct labels
  - duplicate rows are skipped by default
  - checking "Import anyway" sends `allowDuplicate: true`
  - editing a duplicate-key field clears the visible duplicate warning
- Import messages:
  - created-only message
  - skipped duplicate count
  - imported duplicate count
  - active filter warning remains appended

Use existing Vitest and React Testing Library patterns. Update MSW handlers only
if tests need realistic preview/batch endpoints.

## Verification

Run:

```bash
npm run lint:fix
npx vitest src/features/transactions
npx vitest src/test
npm run build
```

For CSP-sensitive UI changes, do not add runtime style-injecting dependencies,
inline `style={...}` props, or tooltip-only disclosure. Use Tailwind classes and
existing UI primitives.
