# Frontend API Integration

This document owns the SPA's request adapters, response normalization, cache
integration, and feature-specific API behavior. It is not an endpoint inventory.
Endpoint paths, methods, parameters, and payload schemas are owned by the
generated specifications:

- [Unified backend API](api/budget-analyzer-api.yaml) for transactions, saved
  views, currencies, statement formats, exchange rates, and users.
- [Session Gateway API](api/session-gateway-api.yaml) for current-user,
  heartbeat, and logout behavior.

Authentication lifecycle and permission gating belong to
[Authentication and authorization](authentication.md). Environment setup and
the ingress URL belong to [Development](development.md).

## Shared API Client

`src/api/client.ts` exports the Axios instance used by backend adapters under
`src/api/`.

- `VITE_API_BASE_URL` selects the base URL and defaults to `/api`.
- Requests include credentials and default to JSON with a 10-second timeout.
- No browser `Authorization` header is added. The opaque session cookie is
  validated at ingress and identity headers are added before the request reaches
  a backend service.
- Endpoint adapters return response data to TanStack Query hooks; React
  components do not call Axios directly.

`src/api/auth.ts` uses a separate credentialed Axios instance rooted at `/` for
Session Gateway paths. This prevents `/auth/*` from being prefixed by the
backend API base URL.

### Error normalization

The shared backend client rejects failures as `ApiError` from
`src/types/apiError.ts`:

- A structured API response with string `type` and `message` fields preserves
  the HTTP status, response fields, optional application `code`, and optional
  `fieldErrors`.
- An unstructured HTTP response becomes an `INTERNAL_ERROR` at the received
  status.
- A request that receives no response becomes a retryable HTTP 503
  `SERVICE_UNAVAILABLE` error with user-safe copy.
- A failure before a request is sent becomes an HTTP 500 `INTERNAL_ERROR`.

An API 401 also asks the shared auth navigation utility to start one replacement
navigation to OAuth2 with the current same-origin path, query, and hash as
`returnUrl`. Parallel 401s share the navigation latch, but each request still
rejects independently. Structured 401 bodies are retained; empty, text, and
HTML bodies become a stable `UNAUTHORIZED` response. A 403 is normalized like
any other authorization error and does not start login. See
[Authentication and authorization](authentication.md#api-401-after-bootstrap).

### Collection response validation

TypeScript response generics do not validate network data. Adapters for
documented top-level arrays accept `unknown` and call
`src/api/collectionResponse.ts`. This currently covers:

- current-user transactions and saved views;
- enabled or all currencies and exchange rates; and
- statement formats.

A non-array HTTP 200 response is rejected as HTTP 502 `INTERNAL_ERROR` with
code `INVALID_COLLECTION_RESPONSE`. Adapters neither coerce it to `[]` nor
unwrap an undocumented envelope, so TanStack Query cannot cache a malformed
response as a plausible empty list. This guard validates only the top-level
collection shape; item fields remain governed by the generated OpenAPI schema.
Object and paginated endpoints keep their documented response adapters.

### User-facing error messages

`src/utils/errorMessages.ts` is the single frontend map for application error
codes that require stable user-facing copy. `formatApiError` uses that map for
HTTP 422 errors and otherwise uses the normalized server message. Keep the map
synchronized with the generated unified specification when backend application
codes change.

Feedback belongs at the narrowest feature boundary that contains the event. An
obvious successful direct manipulation needs no detached confirmation: the
updated value, closed dialog, removed row, changed status, or refreshed action
state communicates success. Keep an explicit message when it conveys
information the changed interface does not make clear, including non-obvious
counts, partial outcomes, consequences, next steps, cross-route results,
ongoing conditions, failures, and background or global events. The message
should remain available in proportion to how consequential or actionable that
information is.

Actionable mutation failures stay at the initiating feature boundary. Present
normalized `formatApiError` copy as a persistent alert, preserve the user's
input or selection, and keep the relevant form, dialog, or control available
for dismissal or retry. Shared `MessageBanner` errors expose `role="alert"`;
its success and warning variants expose `role="status"`, and all variants make
the complete message atomic for assistive technology.

Query and load failures normally remain visible in an `ErrorBanner`. Some
older page and workflow error states use specialized persistent callouts rather
than `MessageBanner`; those surfaces are not covered by its status-message
semantics. Repository test conventions and MSW ownership are documented in the
[Testing guide](testing-guide.md).

Current contextual mutation boundaries are:

- Saved-view creation failures remain in the create dialog, including the
  stale-snapshot instruction. Rename, deletion, and both membership-removal
  workflows keep persistent errors beside their dialog actions. Add-to-view
  failures remain beside the page selection controls.
- Inline transaction edit failures render below the affected row. Detail-page
  edit failures remain beside the edit controls. Single- and bulk-deletion
  request failures remain inside their confirmation dialogs, preserving the
  transaction context or selection for retry.
- Import-preview request failures remain at the import surface. Reviewed batch-
  import failures remain inside the review dialog and preserve edited rows.
  Successful imports retain the page-level result banner because created,
  skipped, and intentionally imported duplicate counts—and whether active
  filters may hide new rows—cannot be inferred reliably from the refreshed
  table.
- Statement-format hide and restore failures render directly below the
  affected management row. Currency and statement-format form failures remain
  above their forms; their cross-route create/update results use destination
  flash banners.
- User deactivation failures remain on the user detail page, and statement-
  format wizard failures remain inside the active wizard.

A successful bulk-delete response is converged state even when some or all
requested IDs were already absent. Full, partial, and zero-deletion responses
therefore close the dialog, clear selection, and refresh the table without a
detached result message. A display-currency change similarly clears incompatible
amount-filter URL state without a message because the cleared controls and URL
are the visible result.

## TanStack Query Boundary

TanStack Query owns server data, cache lifetime, retries, errors, and
invalidation. API adapters own transport details; hooks own query keys and
mutation-driven cache changes; components supply callbacks. Do not copy API
responses into Redux or implement request lifecycle state in effects.

Most current-user collections use a five-minute stale time and one retry. Query
keys and feature-specific invalidation rules live with their hooks, including
`src/hooks/useTransactions.ts` and `src/hooks/useViews.ts`. The complete state
placement rules are in [State architecture](state-architecture.md).

## Saved-View Integration Contracts

### Static membership and local filters

Saved views are static transaction collections. Creation sends a name and the
exact currently visible transaction ID array; an empty array is valid. Cloning
sends another independent `{name, transactionIds}` request and does not persist
the source view, filters, sort order, or other lineage. Rename uses `PATCH` with
`{name}` only.

`GET /v1/views/{id}/transactions` returns the complete deterministically ordered
`transactionIds` membership. `useViewTransactions` intersects that order with
the complete active current-user transaction snapshot. Missing snapshot IDs are
reported diagnostically and skipped; the frontend never fans out individual
transaction requests for them.

Successful membership changes invalidate list metadata, detail metadata, and
membership. A `SAVED_VIEW_MEMBERSHIP_STALE` creation or addition also refreshes
the complete transaction snapshot without retrying the mutation or dropping IDs.
Transaction edits and imports do not change static membership. Transaction
deletion invalidates view resources because the backend owns membership cleanup.

Membership removal sends one atomic `PATCH` delta with both required arrays:
`{addTransactionIds: [], removeTransactionIds: [...]}`. IDs are unique positive
integers. The `204` response has no count or response body; removing an unknown
ID is idempotent success. The frontend therefore closes a removal workflow and
invalidates metadata and membership only after the request succeeds, without
inventing partial-success or updated-count semantics.

Membership addition uses the same endpoint once per reviewed selection with
`{addTransactionIds: [...], removeTransactionIds: []}`. The frontend removes
known members and duplicate IDs before submission. A stale addition keeps the
mode and remaining selection, refreshes the complete transaction snapshot plus
view metadata and membership, and requires another user selection change before
resubmission; it is never retried automatically.

Transfer/refund assistance compares ordinary transactions against the current
member-ID set. A nonmember may be displayed as supporting evidence but is not
selectable, and the frontend records no inference about whether it belonged to
the view previously. Candidate removal submits only current member IDs. Same-
currency comparisons stay in that currency; cross-currency comparisons project
each amount to USD using the exact transaction-date rate and omit pairs whose
required conversion is unavailable.

View-table filters and analytics source/navigation parameters are URL state and
do not change collection membership. Ordinary Transactions-page and saved-view
filters are applied to the already loaded browser snapshot; they are not
backend criteria and are never sent to the current-user transaction or saved-
view endpoints. Their contract is documented in
[State architecture](state-architecture.md#url-backed-route-state).

## Selected-Currency Amount Contracts

Ordinary current-user transaction surfaces project each stored transaction
amount through the shared discriminated display-amount contract. The projection
normalizes the stored transaction amount to a positive magnitude. Currency
Service returns a dense row for each date in the requested inclusive range;
conversion uses only a row whose effective `date` exactly equals the transaction
LocalDate. The frontend never searches another date. A missing or invalid exact
row produces an unavailable result; consumers must not display, relabel, or
aggregate the stored transaction amount as selected currency.

An available result retains zero, one, or two rate legs. Each leg preserves the
effective transaction `date` and Currency Service's `publishedDate`. When the
publication precedes the effective date, the UI describes Currency Service's
weekend/holiday carry-forward rather than a client-side nearest-date lookup.
Non-USD conversions use USD as the explicit two-leg bridge.

Transaction lists and static saved views build one projection per transaction
at their page boundary. Each available result is quantized once at the selected
ISO currency's minor-unit precision before it becomes authoritative for amount
filtering, sorting, cells, and per-transaction summing; saved-view creation IDs
come from that same filtered collection. Ordinary current-user presentation
shows only that selected-currency value, or a persistent selected-currency
unavailability state when the projection is unavailable. It does not fall back
to the stored transaction amount.

The dedicated transaction detail page is the sole ordinary current-user surface
that also discloses the positive stored transaction amount and its ISO currency.
When the stored and selected currencies differ, the detail page presents that
stored amount once and presents the selected-currency conversion separately with
its rate-leg provenance. An unavailable conversion does not hide the detail
page's explicit stored-amount disclosure.

Analytics counts every qualifying debit or credit but sums only available,
already-quantized display values. A mixed period is visibly partial and exposes
its unavailable count. A period containing transactions whose amounts are all
unavailable has no monetary total, while an empty period remains a real zero.

The display preference remains Redux state. When a URL contains amount bounds,
`amountCurrency` records the enabled display currency that gives those numbers
meaning. The parsing, deep-link synchronization, invalid-currency, legacy-link,
and currency-change clearing rules belong to
[State architecture](state-architecture.md#transaction-and-saved-view-filters).

## Administrative Transaction Search Exception

Cross-user administrative search remains a backend-filtered, backend-sorted,
paged request. Its amount bounds and `sort=amount` compare each transaction's
stored signed numeric amount without FX normalization. `currencyIsoCode` is an
independent exact filter: an amount-only search may span currencies, while
combining it with bounds makes the numeric comparison currency-specific. The
table formats every returned amount in its stored ISO currency and does not use
the selected display-currency projection or preference.

## Transaction Import Review Contracts

### Ordered preview and batch

Statement import is a two-request protocol:

1. `POST /v1/transactions/preview` sends selected files in browser selection
   order as repeated multipart `files` parts with `statementFormatId` and an
   optional `accountId` query parameter.
2. `POST /v1/transactions/batch` sends the reviewed file groups in the same
   order. Every group carries the opaque `previewImportToken` issued for that
   source file.

The preview adapter overrides the shared 10-second timeout with 60 seconds and
lets Axios provide the multipart boundary. Other API requests retain the shared
timeout. The frontend does not parse preview tokens.

Every preview group remains in the batch request, including a group whose rows
were all removed during review. An empty group is valid in a mixed import, but
the complete batch must create at least one transaction. Before submission,
`src/api/transactionApi.ts` reconstructs each row from supported request fields
and includes `allowDuplicate` only when it is explicitly `true`; preview-only
metadata is never sent.

### Duplicate and source-file semantics

Each preview file group contains `sourceFile`, `statementFormatId`,
`previewImportToken`, `fileImport`, and its transaction rows.
`fileImport.alreadyImported` is an advisory exact-byte re-import warning for the
current user. It is independent from row-level duplicate detection.

Row duplicate metadata is also advisory:

| Reason                 | Frontend meaning                                          |
| ---------------------- | --------------------------------------------------------- |
| `EXISTING_TRANSACTION` | Matches an existing active current-user transaction       |
| `IN_BATCH`             | Matches a row from an earlier completed source-file group |

Duplicate rows remain reviewable and are skipped by default. A row is imported
despite its warning only when the reviewed batch explicitly sets
`allowDuplicate: true`. The backend re-evaluates the edited batch and remains
authoritative. If all visible rows would be skipped, the import action stays
disabled.

The batch response's aggregate `created`, `duplicatesSkipped`, and
`duplicatesImported` counts drive success feedback. Its ordered per-file
results preserve source provenance without creating a separate post-import
results model. A successful batch invalidates current-user transactions,
transaction count, and all saved-view queries.

### Statement-format visibility and upload failures

The normal import selector calls `GET /v1/statement-formats` without
`includeHidden`, so the backend omits formats hidden by the current user.
Management screens request `includeHidden=true`; hide and unhide are
current-user visibility operations, while disabled is global catalogue state.
Creating a format through the CSV or PDF wizard is permission-gated as described
in [Authentication and authorization](authentication.md#permissions-are-for-actions-and-features).

Deployments can choose multipart limits, so the frontend enforces no fixed file
count or size. A preview HTTP 413 may be generated before the request reaches a
backend JSON handler; the adapter normalizes it to the neutral message
`The selected files exceed the upload size limit.`

The import error codes `MISSING_ORIGINAL_FILENAME`,
`BATCH_IMPORT_NO_TRANSACTIONS_CREATED`, `BATCH_IMPORT_SOURCE_MISMATCH`,
`PREVIEW_IMPORT_TOKEN_INVALID`, and `PREVIEW_IMPORT_TOKEN_EXPIRED` have stable
copy in `src/utils/errorMessages.ts`. Preview failures appear at the import
surface; batch failures appear inside the review dialog and leave its edited
rows available for dismissal or retry. Successful batch results continue to
use the transactions-page banner because their counts and possible filter
consequences are informative rather than redundant.

For application structure and client/backend boundaries, see
[Architecture](architecture.md). For request and feature tests, see the
[Testing guide](testing-guide.md).
