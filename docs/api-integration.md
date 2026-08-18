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

Error banners and toasts are presentation choices at the feature boundary:
query/load failures normally remain visible in an `ErrorBanner`, while mutation
failures use the custom toast system when the initiating dialog or control stays
mounted. Repository test conventions and MSW ownership are documented in the
[Testing guide](testing-guide.md).

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

### Criteria, membership, and local filters

Saved-view criteria use the backend names `dateFrom` and `dateTo`, preserve
`type` as `DEBIT` or `CREDIT`, and do not send the retired `startDate` or
`endDate` fields. `searchText` is a persisted description criterion. The
Transactions and View table `q` inputs are local, case-insensitive description
filters over already loaded rows; a saved bank criterion uses the explicit bank
filter.

`GET /v1/views/{id}/transactions` is the canonical membership source. It
returns matched, pinned, and excluded transaction IDs. The frontend:

1. removes excluded IDs from visible membership;
2. de-duplicates IDs, with pinned membership taking precedence if an
   inconsistent payload lists an ID in both visible groups;
3. reuses cached current-user transactions; and
4. fetches missing visible transaction details individually.

Excluded transactions remain outside the visible table and are loaded
separately only for restore workflows. Pin, unpin, exclude, restore, and bulk
membership successes invalidate the view detail, membership, and list queries.
Bulk responses can report unavailable IDs, so the frontend shows partial
success feedback and does not invent optimistic counts.

Transaction imports, edits, and deletes invalidate the complete saved-view
query family because saved criteria and membership counts depend on the active
transaction collection.

Temporary view-table filters and analytics source/navigation parameters are URL
state rather than API criteria. Their contract is documented in
[State architecture](state-architecture.md#url-backed-route-state).

### Transfer and refund discovery

`Find Transfers & Refunds` is entirely client-side. It scans active
transactions while requiring at least one side of a candidate to be visible in
the canonical view. Same-currency amounts are compared directly; cross-currency
amounts are normalized with each transaction date's exchange rate.

The deterministic matcher retains one-to-one pairs. Refunds require the same
known bank and account, a credit zero to 90 days after the debit, shared
meaningful description text, and an amount difference within the greater of 3
percent or one comparison unit. Transfers require different banks or different
known accounts at the same bank, no more than seven absolute days, and no more
than a 5 percent amount difference.

Transactions outside current visible membership can remain evidence, but only
currently visible, not-already-excluded IDs are eligible for exclusion. The
review sends selected unique IDs through the existing bulk exclusion endpoint.
The server stores only saved-view exclusions: it receives no candidate,
relationship, review, or provenance data. Restore uses the normal unexclude
endpoint. This workflow is unrelated to import duplicate detection.

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
surface; batch failures leave the review open and use a toast.

For application structure and client/backend boundaries, see
[Architecture](architecture.md). For request and feature tests, see the
[Testing guide](testing-guide.md).
