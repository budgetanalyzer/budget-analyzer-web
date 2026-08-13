# Multi-File Statement Preview and Import Web Plan

Update the React statement import workflow for the transaction service's breaking grouped preview
and batch contracts while keeping the interaction as close as possible to the existing single-file
flow. Users continue to choose a statement format and optional account, open the browser's native
file picker, review editable transactions in one large dialog, and receive the existing aggregate
success banner after import. The only selection change is enabling the native file input's
`multiple` behavior; this plan deliberately adds no custom picker, drag-and-drop surface, file
reordering controls, or frontend file-count limit.

The implementation must preserve the browser-supplied file order through multipart preview,
editable review state, grouped batch submission, and response assertions because the backend uses
that order for cross-file duplicate precedence. Keep each preview token associated with its own
file's reviewed rows as an internal API requirement even though the UI presents one combined set
of transactions. The product intent is to move transactions extracted from the selected files into
the database; users do not need to track which source file a transaction is mapped to during
review. File identity and hashing are an orthogonal concern surfaced only where they help warn that
the exact file was imported previously. Treat backend duplicate metadata as advisory and do not
reproduce normalized duplicate matching in JavaScript. After upstream edits or removals, later
`IN_BATCH` warnings may remain as preview-time information; the backend remains authoritative when
it reevaluates the grouped batch.

The transaction-service prerequisite is already represented by
`docs/api/budget-analyzer-api.yaml` and the completed sibling plan at
`../transaction-service/docs/plans/multi-file-statement-preview-import-phased.md`. Every phase in
this plan writes only to this repository. Do not introduce file navigation or transaction-to-file
mapping as a user-facing concept unless a separate future requirement demonstrates a need for it.

## Phase 1: Cut Over the Frontend Contracts and Ordered Transport

### Workspace

.

### Goal

Replace the old single-file preview and batch shapes with the grouped OpenAPI contract, send native
multi-file selections in order, and leave the application type-correct with a functional grouped
preview-to-import path.

### Scope

- Update transaction API types for `PreviewFileResponse`, grouped `PreviewResponse`,
  `BatchImportFileRequest`, grouped `BatchImportRequest`, `BatchImportFileResponse`, and grouped
  `BatchImportResponse`.
- Change the preview request type from one `File` to an ordered `File[]` and append every file as a
  repeated multipart `files` part.
- Serialize batch requests as an ordered top-level `files` array and sanitize each nested
  transaction before sending it.
- Enable native multi-selection in `ImportButton` and carry all selected files into the preview
  mutation without adding a custom file-selection component.
- Refactor preview modal state just enough to retain editable transactions per source token and
  submit every reviewed source group in order.
- Update the directly affected API and component contract tests.

### Non-goals

- Adding a drag-and-drop area, custom picker, file navigator, per-file selection controls,
  reordering controls, or a frontend file-count limit.
- Supporting different statement formats or account IDs in one selection.
- Changing statement-format wizard upload endpoints; their CSV and PDF sample pickers remain
  single-file workflows.
- Implementing local duplicate detection, changing transaction edit fields, or redesigning the
  review dialog in this phase.
- Preserving a fallback for the retired `file` multipart part or single-token batch JSON shape.
- Modifying the generated API specification or any sibling repository.

### Required context

- Read `AGENTS.md`, especially the component, testing, documentation, path alias, and strict CSP
  rules.
- Confirm `docs/api/budget-analyzer-api.yaml` defines repeated multipart `files`,
  `PreviewResponse.files`, `BatchImportRequest.files`, and `BatchImportResponse.files` as reviewed
  during plan creation. Stop if those prerequisite contracts are absent or materially different.
- Review `src/types/transaction.ts`, `src/api/transactionApi.ts`,
  `src/features/transactions/hooks/usePreviewTransactions.ts`,
  `src/features/transactions/hooks/useBatchImport.ts`, `ImportButton.tsx`, and
  `TransactionPreviewModal.tsx` before editing.
- Review the existing API adapter tests and multipart-testing guidance in `docs/testing-guide.md`;
  use the Axios adapter pattern rather than relying on MSW to decode uploaded files.
- Preserve unrelated working-tree changes, including the existing generated OpenAPI diff.

### Execution steps

1. Replace the single-file TypeScript contracts in `src/types/transaction.ts` with the exact
   grouped shapes from OpenAPI. `PreviewFileResponse` must contain `sourceFile`,
   `statementFormatId`, `previewImportToken`, `fileImport`, and `transactions`; remove the obsolete
   `detectedFormat`. Define nested batch request and response file types, retain aggregate counts on
   `BatchImportResponse`, and keep each response file's created transactions nested under its
   source.
2. Change `PreviewTransactionsRequest` to carry a non-empty-by-UI-construction ordered `files`
   array. In `transactionApi.previewTransactions`, append each `File` to `FormData` with the exact
   part name `files` and in array order, while retaining the shared `statementFormatId` and optional
   `accountId` query parameters. Do not set a count limit or sort, deduplicate, or otherwise rewrite
   the browser-provided order.
3. Update batch serialization so the JSON body is `{ files: [...] }`. For each file group, retain
   its opaque token and transaction order; strip preview-only metadata from every transaction and
   include `allowDuplicate` only when it is exactly `true`, matching the existing privacy and
   request-shaping behavior.
4. Change `ImportButton` from `File | null` to `File[]`, add the native `multiple` attribute to the
   existing hidden `<input type="file">`, and capture selections with `Array.from(files)`.
   Preserve `accept=".csv,.pdf"`, the selected statement format, optional shared account ID,
   pending/error callbacks, new-format wizard behavior, form reset, and native picker invocation.
5. Change `TransactionPreviewModal` state from one editable transaction list to an ordered list of
   editable source groups. Keep each file index, source filename, preview token, import-history
   status, and editable transaction array together. Submit all groups, including a group whose
   reviewed transaction array is empty, as long as the aggregate review still has an importable
   row. Initialize this state by mounting the modal only when preview data exists rather than
   adding a derived-state `useEffect`.
6. Update `transactionApi.test.ts`, `ImportButton.test.tsx`, and the minimum modal fixtures needed
   for the new contract. Assert repeated `files` parts and their order through an Axios adapter,
   grouped preview data reaching the modal, nested batch serialization, and omission of false
   `allowDuplicate` values. Keep assertions on URLs, query parameters, pending state, and error
   callbacks from the current tests.

### Implementation notes

- A native `<input type="file" multiple>` still opens the operating system/browser file picker;
  no new component or dependency is required.
- Multipart part order is semantic. Use the `File[]` order directly for `FormData.append(...)` and
  never sort by filename, type, date, or size.
- Keep state nested by source instead of storing one globally flattened editable array. A derived
  flat row list may be used for presentation later, but tokens and batch rows must remain grouped.
- The API permits an empty `transactions` array for one file. Do not drop that file's token from a
  mixed batch because the ordered zero-count response is part of the backend contract.
- Continue using React Query mutation callbacks; do not add `async`/`await` or inline JSX callback
  implementations to components.
- Use only Tailwind classes. This contract migration requires no dependency or runtime styling
  change.

### Validation

Run the focused API and component contract tests:

```bash
npx vitest src/api/__tests__/transactionApi.test.ts \
  src/features/transactions/components/__tests__/ImportButton.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx
```

Then confirm the cutover is type-correct:

```bash
npm run build:bundle
```

Inspect focused searches to ensure the retired request shapes are absent from production import
code:

```bash
rg -n "formData\.append\('file'|previewImportToken: request\.previewImportToken|detectedFormat" \
  src/api src/features/transactions src/types
```

### Completion criteria

- The frontend types exactly model grouped preview and batch request/response payloads.
- Preview sends one repeated `files` part per native selection in preserved order.
- Batch sends one ordered item per previewed source, with each token paired to that source's edited
  rows.
- The native picker accepts one or many CSV/PDF files without a frontend count limit.
- Single-file selection remains a valid path through the same grouped implementation.
- Focused API/component tests and `npm run build:bundle` pass.

## Phase 2: Preserve the Simple Continuous Review Experience

### Workspace

.

### Goal

Make grouped preview data understandable inside the existing large review dialog without adding a
file navigator or a new multi-step interaction. Present transactions as one combined review set
while preserving token/file boundaries behind the presentation and showing exact-file reimport
warnings as a separate concern.

### Scope

- Keep the current dialog and one continuous scrollable transaction table.
- Show a compact selection label before preview and an aggregate file/transaction summary in the
  dialog.
- Render exact-file reupload warnings for every affected source without hiding other files' rows.
- Apply row edits, removals, and import-anyway choices to the correct nested source group.
- Compute import button counts across all visible reviewed rows while retaining existing wording
  and behavior.
- Rename the `IN_BATCH` label to describe the new earlier-file meaning.

### Non-goals

- Adding tabs, a sidebar, accordion navigation, previous/next controls, virtualized tables, or
  custom file-order controls.
- Splitting import into one request per file or allowing per-file submit actions.
- Re-running preview after edits or trying to recalculate backend duplicate identity rules.
- Clearing every downstream warning when an earlier row changes.
- Adding a post-import results screen or changing the aggregate success banner.
- Changing the existing editable fields or adding tooltips.

### Required context

- Confirm Phase 1 is complete and its focused tests plus `npm run build:bundle` pass.
- Re-read the duplicate semantics in `docs/api/budget-analyzer-api.yaml`: `IN_BATCH` now means a
  match against a completed earlier source file, and rows within their own source are not compared.
- Review `TransactionPreviewModal.tsx`, `PreviewTable.tsx`, `PreviewTableRow.tsx`,
  `PreviewFileImportWarningBanner.tsx`, and their colocated tests.
- Review the static table width and CSP rules in `AGENTS.md`; do not introduce inline widths or a
  UI dependency.
- Preserve the existing callback-based mutation and memoized handler patterns.

### Execution steps

1. Keep the pre-preview selection display minimal: show the filename for one selected file and a
   compact phrase such as `3 files selected` for multiple files. The existing Choose File button
   must still invoke the native input, and choosing again replaces the native selection as it does
   today. Do not render a custom file list or individual remove controls.
2. Derive aggregate review data with `useMemo` from the nested editable file groups: total visible
   rows, preview-marked duplicates skipped by default, rows explicitly allowed, and aggregate
   importable rows. Preserve source file index and transaction index on derived table rows so
   handlers can update or remove the correct nested item without flattening the authoritative
   state.
3. Keep one `PreviewTable` in one scroll region and present all extracted transactions as one
   combined review set. Do not add a source-file column, file section headings, or other row-level
   transaction-to-file mapping; that association is retained only in internal state for the grouped
   API request.
4. Update row handler signatures to identify both file and transaction indexes. Editing a duplicate
   key on the warned row continues to clear that row's preview warning and `allowDuplicate`, while
   editing or removing an earlier file's row must not trigger local downstream duplicate matching.
   The backend will make the final decision on submit.
5. Render `PreviewFileImportWarningBanner` once for each source whose exact bytes were already
   imported. Include the current preview source filename in the banner so multiple warnings remain
   attributable, while retaining previous filename, timestamp, format, account, and transaction
   metadata.
6. Change the visible `IN_BATCH` status from `Duplicate in file` to concise earlier-file wording
   such as `Matches earlier file`. Keep `EXISTING_TRANSACTION` as `Already imported`, keep the
   explicit `Import anyway` control, and do not add explanatory tooltips.
7. Preserve the current aggregate action behavior: disable import only when no row across any file
   can be imported, retain the `Import N Transactions, Skip M Duplicates` label, close the modal on
   success, and call `onImportComplete` with the response's aggregate counts. Do not expose the
   per-file response as a second success screen.
8. Expand the modal and button tests for one-file compatibility, multiple-file selection text,
   combined dialog counts, absence of row-level source mapping, multiple reupload warnings, correct
   nested edits and removals, and unchanged close/cancel/pending behavior.

### Implementation notes

- The continuous table reflects the product goal: review extracted transactions and import them
  into the database. File-to-transaction association is transport metadata, not a review task.
  Never flatten tokens or batch request groups internally because the backend contract still
  requires them.
- File hashing is separate from transaction review. Surface the source filename when identifying an
  exact-file reimport warning, but do not use that warning requirement to add source attribution to
  every transaction row.
- Duplicate status is a preview-time advisory. If an upstream edit makes a later `IN_BATCH` flag
  stale, leaving the label visible is preferable to maintaining a second matcher in JavaScript;
  backend batch results and the existing aggregate success message report the authoritative counts.
- Keep every previewed file group in request order even when the user removes all of its rows.
- Duplicate filenames are valid. Use ordered indexes or stable internal identities for state and
  React keys instead of assuming `sourceFile` is unique.
- Do not add a `useEffect` to derive flat rows, totals, or labels; compute them during render with
  pure helpers or `useMemo`.
- Avoid unrelated table or dialog primitive changes. If a small shared prop is needed, keep it
  generic and cover it with the affected component tests.

### Validation

Run the focused review workflow tests:

```bash
npx vitest src/features/transactions/components/__tests__/ImportButton.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx
```

Run the API boundary test as a regression for nested state serialization:

```bash
npx vitest src/api/__tests__/transactionApi.test.ts
```

Then type-check and bundle:

```bash
npm run build:bundle
```

### Completion criteria

- One selected file looks and behaves substantially like the existing review flow.
- Transactions from multiple files appear as one continuous review set without row-level source
  attribution.
- Exact-file reimport warnings identify the affected file without turning file provenance into the
  primary review model.
- No ordered navigator, custom picker, reorder control, or extra import step exists.
- Edits, removals, duplicate overrides, tokens, and empty groups stay associated with the correct
  file and preserve order.
- `IN_BATCH` is described as an earlier-file match, and no JavaScript duplicate matcher is added.
- Import closes the modal and produces the same aggregate completion behavior as before.
- Focused tests and `npm run build:bundle` pass.

## Phase 3: Harden Grouped Errors, Empty Groups, and Ordering Regressions

### Workspace

.

### Goal

Cover the grouped workflow's boundary conditions and error semantics so future changes cannot
silently collapse file groups, reorder sources, drop empty reviewed files, or overstate local
duplicate knowledge.

### Scope

- Make preview upload-limit feedback accurate for single or combined multi-file request failures.
- Add user-facing handling for the new batch source mismatch code.
- Cover first-file failure behavior through the existing preview error callback/banner path.
- Add focused regression cases for order, empty source groups, aggregate-empty review, duplicate
  overrides, stale preview-time warnings, response handling, and cache invalidation.
- Audit test fixtures and shared MSW responses that still use retired single-file shapes.

### Non-goals

- Client-side file-size rejection or assumptions about a permanent 25MB deployment limit.
- Partial preview recovery after one file fails; the backend returns no partial response.
- Retrying files individually, importing successful subsets, or bypassing source mismatch errors.
- Parsing preview tokens or validating shared token identity in the browser.
- Implementing frontend duplicate normalization.

### Required context

- Confirm Phases 1 and 2 are complete and their focused tests plus bundle builds pass.
- Review `src/utils/errorMessages.ts` and its tests, the page-level
  `useImportMessageHandler` path, modal toast error handling, and React Query invalidations in
  `useBatchImport.ts`.
- Re-read the new OpenAPI examples for filename-bearing parsing errors,
  `BATCH_IMPORT_SOURCE_MISMATCH`, empty per-file transactions, aggregate counts, and ordered
  per-file responses.
- Search `src/testing`, API tests, and transaction component tests for old `previewImportToken` or
  `transactions` fields at the batch top level before editing fixtures.

### Execution steps

1. Replace the hard-coded singular 413 copy with deployment-neutral wording that works for a large
   single file or a combined request, such as `The selected files exceed the upload size limit.`
   Continue normalizing gateway HTML/non-JSON 413 responses to `ApiError` at the transaction API
   boundary.
2. Add `BATCH_IMPORT_SOURCE_MISMATCH` to the centralized error mapping with actionable wording that
   tells the user to preview the files together again. Update the missing-filename wording only if
   needed to make it grammatically correct for an indexed file part, and cover the final mappings
   in `errorMessages.test.ts`.
3. Expand API tests to prove exact multipart order with two files, one shared format/account query,
   grouped batch order, retention of an empty file group, nested stripping of preview-only fields,
   nested `allowDuplicate` behavior, and typed ordered per-file responses. Keep multipart
   introspection in the Axios adapter rather than moving it to MSW.
4. Expand `ImportButton` tests to prove that the native picker accepts multiple files, submits them
   in the captured order, displays only compact native-selection feedback, clears the entire
   selection on cancel/success, and passes a filename-bearing failure to the existing page error
   callback without opening a partial modal.
5. Expand modal tests for a mixed batch where one file has no remaining rows and another imports,
   an all-empty/all-skipped review that disables Import, duplicate overrides nested in the correct
   source, two files with the same filename, and aggregate response counts passed unchanged to the
   existing completion callback.
6. Add an explicit regression showing that editing or removing an earlier file row does not cause
   the frontend to recompute or clear a later file's `IN_BATCH` advisory. Separately preserve the
   current behavior where editing the warned row itself clears that row's warning before submit.
7. Confirm a successful grouped batch invalidates `['transactions']`, `['transactionCount']`, and
   `viewKeys.all` once for the atomic operation, and that an error leaves the modal open with the
   existing toast feedback.
8. Search and update shared transaction-import fixtures and mocks that assume the retired response
   or request shape. Do not churn unrelated transaction, wizard, or admin fixtures.

### Implementation notes

- Do not prevalidate file sizes in the browser. The effective limit belongs to the service and
  gateway configuration and may be raised independently.
- The UI cannot reliably distinguish a per-part limit from a combined-request limit when an
  upstream proxy returns 413, so the message must not promise which threshold was exceeded.
- `BATCH_IMPORT_SOURCE_MISMATCH` should be unreachable through the normal same-preview flow but
  still needs safe recovery text because tokens can expire, be mixed by a defect, or encounter a
  changed server contract.
- Test the frontend-owned boundary and behavior; do not duplicate transaction-service integration
  tests for atomic database writes or provenance.
- Preserve existing success-message construction and filter warnings; the new per-file response
  array is not a reason to change the post-import UI.

### Validation

Run all focused import and error tests:

```bash
npx vitest src/api/__tests__/transactionApi.test.ts \
  src/features/transactions/components/__tests__/ImportButton.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx \
  src/utils/__tests__/errorMessages.test.ts \
  src/features/transactions/utils/__tests__/messageBuilder.test.ts
```

Run the transaction page tests to verify its aggregate callback/error banner contract remains
unchanged:

```bash
npx vitest src/features/transactions/pages/__tests__/TransactionsPage.test.tsx
```

Then run:

```bash
npm run build:bundle
```

### Completion criteria

- Upload-limit and source-mismatch failures have accurate, actionable centralized messages.
- Tests prove multipart, review-state, and batch order for at least two files.
- Empty per-file groups are retained in mixed requests, while an aggregate-empty review cannot be
  submitted.
- Tests explicitly preserve backend-authoritative duplicate handling after cross-file edits.
- Aggregate completion, toast failure, and React Query invalidation behavior match the existing
  single-file user experience.
- Focused regression tests and `npm run build:bundle` pass.

## Phase 4: Update Import Documentation and Complete Repository Validation

### Workspace

.

### Goal

Document the durable grouped frontend contract, remove obsolete single-file guidance, and complete
the repository's formatting, linting, coverage, build, and final consistency checks.

### Scope

- Update `docs/api-integration.md` for repeated multipart files, grouped preview and batch payloads,
  per-file tokens/status, ordered semantics, empty groups, and aggregate results.
- Document the simple native-picker/continuous-review behavior only where needed to explain use of
  the API, without adding a component walkthrough.
- Document that the UI's purpose is to review and import one combined transaction set; per-file
  grouping is retained for the API contract and exact-file reimport warnings, not exposed as a
  transaction organization feature.
- Correct duplicate terminology and upload-limit guidance.
- Audit production code, tests, and directly affected documentation for retired shapes and labels.
- Run repository-required auto-fix, formatting, focused regression, coverage, and bundle commands.

### Non-goals

- Linking this ephemeral plan from non-plan documentation.
- Editing the generated `docs/api/budget-analyzer-api.yaml` by hand or changing its unrelated saved
  view descriptions.
- Introducing file navigation or row-level transaction-to-file attribution without a separate
  product requirement.
- Changing backend limits, orchestration configuration, transaction-service code, or API examples
  owned by sibling repositories.
- Adding a UI dependency, runtime CSS injection, inline styles, or git write operations.

### Required context

- Confirm Phases 1 through 3 are complete and every focused validation passes.
- Read `AGENTS.md` documentation discipline and command requirements again before editing docs or
  running repository-wide tools.
- Review the final implementation alongside the transaction import section of
  `docs/api-integration.md` and the multipart guidance in `docs/testing-guide.md`.
- Treat `docs/api/budget-analyzer-api.yaml` as the generated source contract. Update
  `docs/testing-guide.md` only if a genuinely new reusable testing rule was learned; do not
  duplicate its existing Axios adapter advice.
- Inspect current worktree changes so formatter or lint fixes do not overwrite unrelated user work.

### Execution steps

1. Rewrite the transaction preview/import endpoint summary and review-flow section in
   `docs/api-integration.md`: the native picker supplies one or more ordered files under repeated
   multipart `files` parts; preview returns `files[]`; every token remains nested with its source;
   batch accepts and returns ordered `files[]`; aggregate counts still drive success feedback.
2. Replace the old single-token JSON example with a grouped example containing at least two files,
   including one empty reviewed transaction array. Document that empty groups are retained in a
   mixed import, but the whole batch must create at least one row.
3. Correct duplicate guidance so `IN_BATCH` means an earlier source file, same-file repeated rows
   are not compared, preview warnings are advisory, and the backend reevaluates the edited grouped
   batch. Update the UI label table from `Duplicate in file` to the implemented earlier-file label.
4. Explain that transaction rows are presented as one combined review set even though the client
   retains their file groups internally for token-backed submission. Document file hashing and
   `fileImport` as an orthogonal exact-reimport warning mechanism, not as a reason for users to
   organize or review transactions by source.
5. Document that the service currently defaults to per-file and combined multipart limits and that
   the frontend uses a neutral 413 message because deployments may change those limits. Do not
   present 25MB as a frontend validation rule.
6. Add `BATCH_IMPORT_SOURCE_MISMATCH` to the documented error table and retain token-expired,
   missing-filename, and aggregate-empty recovery behavior. Confirm the documented message path
   agrees with `formatApiError` and the page/modal surfaces.
7. Search production code, tests, and directly affected docs for obsolete `file` multipart parts,
   top-level batch tokens/transactions, `detectedFormat`, and `Duplicate in file`. Review every
   match rather than blindly replacing wizard endpoints that intentionally remain single-file.
8. Run `npm run lint:fix` and `npm run format`, review their changes for unrelated churn, and rerun
   the complete focused import regression set. Fix failures without disabling lint rules or
   weakening behavioral assertions.
9. Run the full `npm run build` coverage gate and production bundle. Inspect the final diff for
   contract consistency, concise documentation, strict CSP compliance, absence of new
   dependencies, and preservation of unrelated generated API changes.

### Implementation notes

- Keep documentation focused on stable API and user behavior, not component state fields or a
  step-by-step code walkthrough.
- Searches for multipart `file` must distinguish the main transaction preview endpoint from the
  statement-format wizard endpoints, which remain correctly singular.
- `npm run build` already runs the coverage suite before type-checking and bundling; do not replace
  it with `build:bundle` in the final phase.
- Use `npm run lint:fix` directly as required; do not run the non-fixing lint command first.
- Do not run `npm run dev`, and do not perform commit, checkout, reset, push, or other git writes.

### Validation

Run formatting and lint auto-fix:

```bash
npm run lint:fix
npm run format
```

Run the complete focused regression set:

```bash
npx vitest src/api/__tests__/transactionApi.test.ts \
  src/features/transactions/components/__tests__/ImportButton.test.tsx \
  src/features/transactions/components/__tests__/TransactionPreviewModal.test.tsx \
  src/features/transactions/pages/__tests__/TransactionsPage.test.tsx \
  src/utils/__tests__/errorMessages.test.ts \
  src/features/transactions/utils/__tests__/messageBuilder.test.ts
```

Run the required full build:

```bash
npm run build
```

Audit stale contract language and accidental CSP violations in the affected implementation:

```bash
rg -n "formData\.append\('file'|detectedFormat|Duplicate in file|previewImportToken.*transactions" \
  src/api src/features/transactions src/types docs/api-integration.md
rg -n "style=\{|createElement\('style'\)|insertRule\(|cssText|new Function\(|eval\(" \
  src/api/transactionApi.ts src/features/transactions
git diff --check
```

Review any search match in context; intentional single-file wizard behavior and prose describing a
retired contract historically are not implementation failures.

### Completion criteria

- `docs/api-integration.md` and production code describe one consistent ordered grouped workflow.
- The documentation explains per-file tokens and warnings, grouped request/response shapes,
  the combined transaction review model, orthogonal exact-file reimport warnings,
  backend-authoritative duplicate handling, empty groups, and aggregate post-import behavior.
- No obsolete main-preview multipart name, single-token batch shape, `detectedFormat`, or same-file
  `IN_BATCH` label remains in active import code or guidance.
- No custom file picker, file navigator, frontend count/size limit, local duplicate matcher,
  post-import results screen, dependency, or CSP-unsafe styling was introduced.
- `npm run lint:fix`, `npm run format`, focused regressions, `npm run build`, and
  `git diff --check` complete successfully.
