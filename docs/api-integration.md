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
- `GET /api/v1/currencies` — List currencies
- `GET /api/v1/exchange-rates` — Get exchange rates

**API Documentation**: `https://app.budgetanalyzer.localhost/api/docs`

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
