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
- `POST /api/v1/transactions/preview` — Preview an uploaded statement file before import. The response includes `previewImportToken`, `fileImport` re-import status, and per-row duplicate metadata (`duplicate`, `duplicateReason`).
- `POST /api/v1/transactions/batch` — Import reviewed preview rows. The request requires `previewImportToken` and may set per-row `allowDuplicate: true` when the user explicitly imports a duplicate row.
- `GET /api/v1/currencies` — List currencies
- `GET /api/v1/exchange-rates` — Get exchange rates

**API Documentation**: `https://app.budgetanalyzer.localhost/api/docs`

## Saved Views

Saved-view criteria mirror the user-facing transaction filters supported by the backend contract. The frontend sends date bounds as `dateFrom` and `dateTo`, preserves the selected transaction `type` (`DEBIT` or `CREDIT`), and does not send the retired `startDate` or `endDate` fields.

`searchText` is a saved-view description filter. The Transactions and View table search boxes filter the already loaded rows locally with a case-insensitive substring match against transaction descriptions only; use the explicit bank filter when the saved view should persist a bank criterion.

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

## Transaction Import Review

Statement imports use a two-step review flow:

1. `POST /api/v1/transactions/preview?format=<format>&accountId=<optional-account-id>` uploads the statement file as multipart form data and returns editable preview rows.
2. `POST /api/v1/transactions/batch` submits the reviewed rows as JSON with the same `previewImportToken`.

The import format dropdown is populated from `GET /api/v1/statement-formats`. The UI shows enabled formats whose default currency is available, sorted by API-provided `displayName`, and submits the selected `formatKey` as the `format` query parameter.

The preview response includes:

- `previewImportToken` — opaque token required for the batch request. Treat it as client state only; do not parse it.
- `fileImport` — file-level re-import status for the current user and uploaded bytes.
- `transactions[].duplicate` and `transactions[].duplicateReason` — advisory row-level duplicate metadata.

`fileImport.alreadyImported` means the exact uploaded file was imported before. The UI shows previous import metadata from `fileImport.previousImport` but does not block the batch import action.

Duplicate reasons map to UI labels:

| `duplicateReason`      | Meaning                                                   | UI label          |
| ---------------------- | --------------------------------------------------------- | ----------------- |
| `EXISTING_TRANSACTION` | Row matches an existing active owner-owned transaction    | Already imported  |
| `IN_BATCH`             | Row duplicates an earlier row in the same preview payload | Duplicate in file |

Duplicate preview rows stay visible in the UI and are skipped by default. A row is imported despite duplicate metadata only when the batch payload sets `allowDuplicate: true` for that row. If every visible row would be skipped, the UI disables the import action and leaves Cancel as the way out of the review dialog. Preview-only fields such as `duplicate` and `duplicateReason` are never sent in the batch request.

Batch request shape:

```json
{
  "previewImportToken": "v2.dGVzdGl2MTIzNDU.Kc4WwTqfh1sFD8pxVq7Hxg",
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
}
```

The batch response reports:

- `created` — number of transactions created.
- `duplicatesSkipped` — duplicate rows skipped because `allowDuplicate` was false or omitted.
- `duplicatesImported` — duplicate rows intentionally imported with `allowDuplicate: true`.

Relevant 422 import error codes surfaced through `formatApiError`:

| Code                                   | User-facing handling                           |
| -------------------------------------- | ---------------------------------------------- |
| `MISSING_ORIGINAL_FILENAME`            | The uploaded file must include a filename.     |
| `BATCH_IMPORT_NO_TRANSACTIONS_CREATED` | All submitted rows were skipped as duplicates. |
| `PREVIEW_IMPORT_TOKEN_INVALID`         | Prompt the user to preview the file again.     |
| `PREVIEW_IMPORT_TOKEN_EXPIRED`         | Prompt the user to preview the file again.     |

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

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/oauth2/authorization/idp';
    }
    throw error;
  },
);
```

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
