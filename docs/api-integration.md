# API Integration

## Overview

All API requests use same-origin session cookies for authentication. The Session Gateway manages OAuth2 sessions server-side — no tokens are exposed to the browser. API calls are validated per-request via a session lookup in Redis before reaching backend services.

## Connecting to Backend

Ensure backend infrastructure is running (see [Development Guide](development.md)), then configure `.env`:

```env
VITE_API_BASE_URL=/api
```

All requests route through the gateway at `https://app.budgetanalyzer.localhost/api/*`.

## Endpoints

All endpoints accessed through the gateway:

- `GET /api/v1/transactions` — List all transactions
- `GET /api/v1/transactions/{id}` — Get single transaction
- `POST /api/v1/transactions/preview` — Preview one or more ordered statement files before import. The grouped response includes one `previewImportToken`, `fileImport` re-import status, and transaction list per source file.
- `POST /api/v1/transactions/batch` — Import ordered groups of reviewed preview rows. Each file group requires its own `previewImportToken` and may set per-row `allowDuplicate: true` when the user explicitly imports a duplicate row.
- `GET /api/v1/currencies` — List currencies
- `GET /api/v1/exchange-rates` — Get exchange rates

**API Documentation**: `https://app.budgetanalyzer.localhost/api/docs`

## Saved Views

Saved-view criteria mirror the user-facing transaction filters supported by the backend contract. The frontend sends date bounds as `dateFrom` and `dateTo`, preserves the selected transaction `type` (`DEBIT` or `CREDIT`), and does not send the retired `startDate` or `endDate` fields.

`searchText` is a saved-view description filter. The Transactions and View table search boxes filter the already loaded rows locally with a case-insensitive substring match against transaction descriptions only; use the explicit bank filter when the saved view should persist a bank criterion.

View detail also supports URL-backed table filters for the visible saved-view
membership: `dateFrom`, `dateTo`, and `q`. Date filters are applied before the
local description search so the stats and table rows are derived from the same
filtered transaction list.

`Find Transfers & Refunds` is a client-side discovery workflow owned by View
detail. It scans the complete active transaction collection, anchored on each
credit, to derive deterministic possible refunds and transfers. Candidate
amount comparison follows two paths: same-currency pairs are compared directly
in their original currency and do not require an exchange rate, while
cross-currency pairs convert each side using its own transaction-date exchange
rate. Transfer candidates must be no more than seven absolute days apart and
their comparison amounts must differ by no more than five percent; there is no
fixed-amount tolerance. Canonical, unfiltered saved-view membership is the
exclusion boundary: a debit or credit outside the view may remain visible as
`Not currently in this view` evidence, but only current members receive
independent exclusion controls. Temporary View table filters do not narrow the
evidence pool or change exclusion eligibility.

Confirming the review sends the unique selected debit and credit IDs through
the existing bulk exclusion endpoint. The server persists only those saved-view
exclusions; it does not receive or store candidates, relationship metadata, or
review state. Exclusions remain reversible through the existing Restore
Excluded workflow. No recommendation or relationship API is involved, and this
discovery is unrelated to transaction import duplicate review.

Analytics URLs carry an explicit source scope. Missing `scope` still means all
transactions for backward compatibility, while scoped saved-view analytics use
`scope=view&viewId=<id>`. Saved-view analytics resolves data through the same
canonical membership endpoint as view detail, so pinned transactions are
included and excluded transactions are omitted. Analytics drilldown links route
to the operational surface for that source: all-transaction analytics link to
`/?dateFrom=...&dateTo=...`, and saved-view analytics link to
`/views/<id>?dateFrom=...&dateTo=...`. Both include `returnTo` and
`breadcrumbLabel` so the filtered operational page can navigate back to the
same analytics state.

When reconciling saved-view membership with cached transactions, the frontend
first removes excluded IDs and de-duplicates visible membership IDs before
fetching any missing transaction details. If an inconsistent membership payload
places the same visible ID in multiple groups, the row is rendered once.

Successful transaction imports, edits, and deletions invalidate the complete
saved-view query family. Saved-view membership and transaction counts depend on
the active transaction set, so inactive views refetch their current membership
when they are next opened.

View detail and saved-view cards expose normal analytics links built as
`/analytics?scope=view&viewId=<id>&viewMode=monthly&transactionType=debit`.
The analytics page fills the year from the latest transaction year when the URL
does not provide one.

Saved views support bulk membership updates through `POST /api/v1/views/{id}/pin` and `POST /api/v1/views/{id}/exclude`. Both endpoints accept:

```json
{
  "ids": [1, 2, 3]
}
```

Both endpoints return:

```json
{
  "updatedCount": 2,
  "notFoundIds": [999]
}
```

`notFoundIds` are transaction IDs that are missing, deleted, or not owned by the caller.

After a successful bulk saved-view membership update, the frontend invalidates
the saved-view detail, saved-view transactions, and saved-view list queries. It
does not apply optimistic count updates because the bulk response does not
include an updated saved view.

The saved-view transaction table supports row selection. Its "select all"
checkbox selects the current page; when all page rows are selected, the table
can expand selection to every transaction in the current visible/search-filtered
view result. The floating bulk action bar can pin or exclude the selected
transactions. Bulk pin sends only selected transactions that are not already
pinned; bulk exclude sends the selected transaction IDs. Partial successes are
shown as warning toast feedback with the number of transactions that were not
found or unavailable.

Visible saved-view membership changes happen from the view table: matched rows
can be pinned or excluded, pinned rows can be unpinned or excluded, and selected
visible rows can be bulk pinned or bulk excluded. Excluded transactions are
intentionally absent from the table; when a view has exclusions, the View detail
header shows a Restore Excluded action and the criteria summary's excluded badge
opens the same restore modal. The modal lists only excluded transactions and
restores them one at a time. Restoring waits for the saved-view detail,
saved-view transaction membership, and saved-view list queries to refresh before
the restore action completes, so the background view reflects the restored row
without a manual page refresh.

## Transaction Import Review

Statement imports use a two-step review flow:

1. The browser's native file picker supplies one or more statement files in selection order. `POST /api/v1/transactions/preview?statementFormatId=<id>&accountId=<optional-account-id>` sends them as repeated multipart `files` parts and returns an ordered result group per file.
2. `POST /api/v1/transactions/batch` submits the ordered reviewed file groups as JSON, pairing each transaction list with its source file's `previewImportToken`.

Grouped transaction preview overrides the API client's general 10-second Axios
timeout with a 60-second endpoint timeout because the request combines multipart
upload and statement parsing. Other API requests retain the general timeout.

Cancelling from the import controls, statement-format wizard, or transaction
review ends the complete import workflow. The frontend clears selected files,
format, account ID, wizard state, preview data, and pending mutation state so the
entry action returns to `Import Transactions` and the next attempt starts fresh.

The import format dropdown is populated from `GET /api/v1/statement-formats`
without query parameters, so formats hidden by the current user are omitted by
the API default. Statement-format management screens call the same list endpoint
with `includeHidden=true` and use `POST /api/v1/statement-formats/{id}/hide` or
`POST /api/v1/statement-formats/{id}/unhide` for current-user visibility
changes. The user-facing management screen is available at `/statement-formats`
for users with `statementformats:read`, and its hide/restore actions require
`statementformats:write`. Hidden is a current-user import-list preference;
disabled is a global catalog state, so management screens may show disabled
formats without offering enable/disable controls. The import UI shows enabled
formats whose default currency is available, sorted by API-provided
`displayName`, disambiguates duplicate visible names with `System` or `Custom`,
and submits the selected `id` as the `statementFormatId` query parameter. Users
with `statementformats:write` also see `New format`, which opens a user
statement-format wizard entry point without submitting a sentinel option to the
preview API. The wizard accepts a CSV or text-based PDF sample, immediately
routes to the matching parser setup flow after file selection, and saves the
resulting user-scoped format. After the wizard saves a format, the import
controls stay open, the existing account ID is preserved, the saved format is
selected by `id`, and inline success feedback prompts the user to choose the
actual statement file before running normal preview. PDF wizard analysis shows
a dedicated unsupported-file state for backend rejection reasons and clear
scanned/no-text/table-detection failures. PDF preview diagnostics are shown only
when they are user-facing; parser revision, header-token, candidate, and rule
internals stay hidden.

The service currently defaults to a `25MB` limit for each repeated file part
and a `25MB` limit for the combined multipart body. Deployments and gateways
may configure different limits, so the frontend does not enforce a fixed file
count or size. If the upload is rejected with HTTP `413`, its body may not use
the backend JSON error shape; the frontend instead shows the neutral import-page
message `The selected files exceed the upload size limit.`

Each item in the preview response's ordered `files` array includes:

- `sourceFile` and `statementFormatId` — the source identity and format used for parsing.
- `previewImportToken` — opaque token required for the batch request. Treat it as client state only; do not parse it.
- `fileImport` — file-level re-import status for the current user and uploaded bytes.
- `transactions[].duplicate` and `transactions[].duplicateReason` — advisory row-level duplicate metadata.

The service hashes each source file's bytes for exact-file import history.
`fileImport.alreadyImported` means the current user imported bytes with that
same hash before. This status is an advisory exact-reimport warning orthogonal
to row-level duplicate detection: the combined review dialog identifies each
affected source file and its previous import, but does not block import. Source
grouping is retained internally for this warning and token-backed submission;
it is not exposed as a way to organize transactions.

Duplicate reasons map to UI labels:

| `duplicateReason`      | Meaning                                                   | UI label          |
| ---------------------- | --------------------------------------------------------- | ----------------- |
| `EXISTING_TRANSACTION` | Row matches an existing active owner-owned transaction    | Already imported  |
| `IN_BATCH`             | Row matches a row from a completed earlier source file    | Matches earlier file |

Rows within their own source file are not compared with each other. All source
groups appear as one continuous transaction review set without row-level file
attribution, while edits and removals remain associated with the correct
ordered group for batch submission. Duplicate preview rows stay visible and
are skipped by default. A row is imported despite duplicate metadata only when
the batch payload sets `allowDuplicate: true` for that row. Preview warnings
are advisory: the backend re-evaluates the edited grouped batch and remains
authoritative about which rows are duplicates. If every visible row would be
skipped, the UI disables the import action and leaves Cancel as the way out of
the review dialog. Preview-only fields such as `duplicate` and
`duplicateReason` are never sent in the batch request.

Batch request shape:

```json
{
  "files": [
    {
      "previewImportToken": "v2.january-token",
      "transactions": [
        {
          "date": "2026-05-01",
          "description": "Coffee",
          "amount": 4.5,
          "type": "DEBIT",
          "category": "Dining",
          "bankName": "Test Bank",
          "currencyIsoCode": "USD",
          "accountId": "checking-123"
        },
        {
          "date": "2026-05-01",
          "description": "Coffee duplicate",
          "amount": 4.5,
          "type": "DEBIT",
          "category": "Dining",
          "bankName": "Test Bank",
          "currencyIsoCode": "USD",
          "accountId": "checking-123",
          "allowDuplicate": true
        }
      ]
    },
    {
      "previewImportToken": "v2.february-token",
      "transactions": []
    }
  ]
}
```

Every preview file remains in the request in its original order, including an
empty reviewed transaction group. An empty group is valid in a mixed import and
receives an ordered zero-count result, but the complete batch must create at
least one transaction. If every group is empty or every submitted row is
skipped as a duplicate, the backend returns
`BATCH_IMPORT_NO_TRANSACTIONS_CREATED`.

The batch response reports:

- `created`, `duplicatesSkipped`, and `duplicatesImported` — aggregate counts
  across the complete request. The frontend closes the review dialog and uses
  these aggregates for its success feedback.
- `files` — ordered per-source `sourceFile`, counts, and created transactions;
  this preserves API provenance without adding a post-import file results view.

Relevant 422 import error codes are mapped by `formatApiError`. Preview errors
appear in the import-page banner; batch errors appear as a toast while the
review dialog remains open:

| Code                                   | User-facing handling                                                       |
| -------------------------------------- | -------------------------------------------------------------------------- |
| `MISSING_ORIGINAL_FILENAME`            | Explain that a filename is required so the user can reselect the files.    |
| `BATCH_IMPORT_NO_TRANSACTIONS_CREATED` | Explain that every submitted row was skipped; review or cancel the import. |
| `BATCH_IMPORT_SOURCE_MISMATCH`          | Prompt the user to preview the files together again.                       |
| `PREVIEW_IMPORT_TOKEN_INVALID`         | Explain that the preview is invalid or expired and prompt another preview. |
| `PREVIEW_IMPORT_TOKEN_EXPIRED`         | Explain that the preview expired and prompt another preview.               |

## Axios Configuration

```typescript
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Include session cookies
});

// No manual Authorization header needed —
// the gateway validates the session and injects identity headers
```

### 401 Handling

An API 401 means the current session is absent, expired, or revoked. The Axios
response interceptor asks the shared auth navigation utility for one replacement
navigation to `/oauth2/authorization/idp`, preserving the browser's current
same-origin path, query, and hash as `returnUrl`. Concurrent 401 responses share
the navigation latch, so only one OAuth2 navigation starts per document.

Navigation does not change the request contract: every unauthorized request
still rejects independently as an `ApiError`. Structured JSON 401 bodies retain
their API error fields; empty, text, and HTML bodies normalize to an
`UNAUTHORIZED` error with a stable user-safe message. A 403 remains a normal
authorization failure and never starts login. The interceptor has no fulfilled
401 path: navigation is a side effect, not a replacement for rejecting the
failed request.

### Collection Response Contracts

TypeScript response generics do not validate network data. At the API adapter
boundary, documented top-level array responses are therefore accepted as
`unknown` and returned only after `Array.isArray` succeeds. This applies to
enabled/all currencies, exchange rates, current-user transactions, statement
formats, and saved views.

A malformed HTTP 200 collection body is rejected as a retryable HTTP 502
`ApiError` with type `INTERNAL_ERROR` and code
`INVALID_COLLECTION_RESPONSE`. The error message never includes the response
payload. Adapters do not coerce malformed data to `[]` or unwrap undocumented
envelopes, so React Query records an error instead of caching a plausible empty
list. The assertion validates only the top-level collection shape; item-level
fields remain governed by the OpenAPI contract. Object and paginated endpoints,
including cross-user transaction search, retain their documented adapters.

## Error Format

The app expects the generated `ApiErrorResponse` shape and normalizes Axios failures to `ApiError` in `src/api/client.ts`:

```json
{
  "type": "APPLICATION_ERROR",
  "message": "All submitted rows were skipped as duplicates.",
  "code": "BATCH_IMPORT_NO_TRANSACTIONS_CREATED"
}
```

Validation errors may include `fieldErrors`:

```json
{
  "type": "VALIDATION_ERROR",
  "message": "Validation failed",
  "fieldErrors": [
    {
      "field": "transactions[0].description",
      "message": "must not be blank",
      "index": 0
    }
  ]
}
```

Specific 422 application errors include `code`; user-facing copy for those codes belongs in `src/utils/errorMessages.ts`.

## Error Handling Strategy

- Network error recovery with retry
- User-friendly error messages
- Error boundaries for graceful degradation
