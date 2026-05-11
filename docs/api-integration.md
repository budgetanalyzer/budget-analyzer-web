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

## Transaction Import Review

Statement imports use a two-step review flow:

1. `POST /api/v1/transactions/preview` uploads the file and returns editable preview rows. The response includes:
   - `previewImportToken` — opaque token required for the batch request
   - `fileImport` — file-level re-import status for the current user and uploaded bytes
   - `transactions[].duplicate` and `transactions[].duplicateReason` — advisory row-level duplicate metadata
2. `POST /api/v1/transactions/batch` submits the reviewed rows with the same `previewImportToken`.

Duplicate preview rows stay visible in the UI and are skipped by default. A row is imported despite duplicate metadata only when the batch payload sets `allowDuplicate: true` for that row. Preview-only fields such as `duplicate` and `duplicateReason` are never sent in the batch request.

If `fileImport.alreadyImported` is true, the UI shows the previous import metadata but does not block the batch import action.

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
  }
);
```

## Error Format

The app expects RFC 7807-inspired error responses:

```json
{
  "type": "not_found",
  "title": "Transaction Not Found",
  "status": 404,
  "detail": "Transaction with ID 123 could not be located",
  "instance": "/transactions/123",
  "timestamp": "2025-10-20T12:00:00Z"
}
```

## Error Handling Strategy

- Network error recovery with retry
- User-friendly error messages
- Error boundaries for graceful degradation
