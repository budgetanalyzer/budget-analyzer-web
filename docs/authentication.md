# Authentication Integration Guide

## Overview

Budget Analyzer uses a **Session Gateway pattern** with **Istio ext_authz** for per-request validation. This means:
- JWTs are never exposed to the browser (XSS protection)
- Session cookies are HttpOnly, Secure, and SameSite
- Auth lifecycle flows are handled server-side by the Session Gateway
- Per-request session validation is handled by ext_authz at the Istio ingress layer
- Frontend only needs to call `/user` endpoint and redirect to login/logout

## Architecture

```
API requests:
  Browser → Istio Ingress (:443) → ext_authz (:9002) → NGINX (:8080) → Backend Services

Auth paths (/oauth2/*, /login/oauth2/*, /logout, /user, /auth/*):
  Browser → Istio Ingress (:443) → Session Gateway (:8081)

Frontend pages:
  Browser → Istio Ingress (:443) → NGINX (:8080) → Vite (:3000)
```

### Component Roles

| Component | Port | Role |
|-----------|------|------|
| Istio Ingress Gateway | 443 (HTTPS) | SSL termination, ext_authz enforcement on `/api/*`, auth-path rate limiting, routing |
| ext_authz | 9002 (HTTP) | Per-request session validation via Redis lookup, identity header injection |
| Session Gateway | 8081 (HTTP) | OAuth2 flows, session lifecycle, token storage, session hash creation in Redis |
| NGINX Gateway | 8080 (HTTP) | Request routing, backend rate limiting, load balancing |
| Permission Service | 8086 (HTTP) | Roles/permissions resolution (called by Session Gateway) |

## Development Setup

### Access URLs

**Development:**
- Frontend: `https://app.budgetanalyzer.localhost` (Istio Ingress Gateway)
- DO NOT use `http://localhost:3000` (Vite dev server) - authentication won't work

**Production:**
- Frontend: Load balancer domain (e.g., `https://budgetanalyzer.com`)

### Request Flow (Development)

For frontend pages:
1. Browser requests `https://app.budgetanalyzer.localhost/`
2. Istio Ingress Gateway terminates SSL
3. Istio routes to NGINX (8080)
4. NGINX proxies to Vite dev server (3000)
5. Vite serves React app with HMR

For API requests:
1. Browser requests `https://app.budgetanalyzer.localhost/api/transactions`
2. Istio Ingress calls ext_authz (9002)
3. ext_authz looks up session in Redis (`session:{id}`)
4. If valid: ext_authz injects `X-User-Id`, `X-Roles`, `X-Permissions` headers
5. Istio routes to NGINX (8080) with injected identity headers
6. NGINX routes to appropriate backend service
7. Backend service reads identity from headers and enforces data-level authorization

## Authentication Flows

### Login Flow

```typescript
// User clicks login button
const { login } = useAuth();
login(); // Redirects to /oauth2/authorization/idp

// Session Gateway handles:
// 1. Redirect to IdP login
// 2. OAuth callback (/login/oauth2/code/idp)
// 3. Exchange authorization code for tokens
// 4. Store tokens in Redis session hash (for refresh)
// 5. Call permission-service to resolve roles/permissions
// 6. Write session data to Redis hash (session:{id})
// 7. Set session cookie (HttpOnly, Secure, SameSite)
// 8. Redirect back to frontend
```

### Logout Flow

```typescript
// User clicks logout button
const { logout } = useAuth();
logout(); // Navigates to /logout

// Session Gateway handles:
// 1. Delete session hash from Redis
// 2. Clear session cookie
// 3. Redirect to IdP logout
// 4. Redirect back to frontend
```

### Check Authentication Status

```typescript
// On app load, check if user is authenticated
const { user, isAuthenticated, isLoading } = useAuth();

// Internally calls GET /user endpoint (routed to Session Gateway)
// Returns user info if session is valid
// Returns null if no valid session
```

### Session Heartbeat

The frontend periodically calls `GET /auth/session` to keep the session alive and validate the IDP grant. This provides:

- **Sliding session TTL**: Each heartbeat resets the 30-minute session expiry
- **IDP grant validation**: If Auth0 has revoked the user's grant (disabled account, withdrawn consent), the refresh fails and the session is terminated
- **Token refresh**: When the IDP access token is within 10 minutes of expiry, the heartbeat triggers a server-side token refresh

**Response:**
```json
{
  "authenticated": true,
  "userId": "user123",
  "roles": ["ADMIN", "USER"],
  "expiresAt": 1711720800,
  "tokenRefreshed": false
}
```

**Behavior:**
- 200: Session is valid (may have refreshed IDP token)
- 401: No valid session or IDP grant revoked — redirect to login
- 502: Transient IDP error — retry on next interval

**Recommended interval**: ~5 minutes (provides 6x safety margin with 30-minute session TTL).

## API Client Configuration

### Axios Configuration

```typescript
// All requests include session cookies
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Include session cookies
});

// No need to manually add Authorization header
// ext_authz validates the session and injects identity headers
```

### Error Handling

```typescript
// 401 Unauthorized → redirect to login
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

## Configuration Files

### Frontend (.env)

```bash
# API base URL - all API requests go here
VITE_API_BASE_URL=/api

# Access app via Istio Ingress Gateway in development
# https://app.budgetanalyzer.localhost
```

### Routing (Istio Ingress Gateway)

The Istio Ingress Gateway routes requests based on path:

- `/auth/*`, `/oauth2/*`, `/login/oauth2/*`, `/logout`, `/user` → Session Gateway (8081)
- `/api/*` → NGINX (8080), with ext_authz enforcement
- `/login`, `/*` → NGINX (8080), frontend (no auth required)

Session Gateway does **not** proxy API or frontend requests. It only handles auth lifecycle paths.

## User Info Structure

```typescript
interface User {
  sub: string;             // User ID (IdP subject)
  email: string;
  name?: string;
  picture?: string;        // Profile picture URL
  authenticated: boolean;
  roles: UserRole[];       // Resolved by permission-service
}
```

## Production Deployment

### Environment Variables

```bash
# Production .env
VITE_API_BASE_URL=/api
```

### Build Process

```bash
# Build static files (served at /)
npm run build

# Build for production-smoke verification (served at /_prod-smoke/)
npm run build:prod-smoke

# Output: dist/ directory
# NGINX serves these files in production
```

The `build:prod-smoke` command produces a bundle whose assets and router basename
are set to `/_prod-smoke/`. This is used only by orchestration to verify
production CSP and browser security behavior on the real public origin — it is
not a separate application mode. Auth and API paths remain root-relative (`/api`,
`/oauth2/authorization/idp`, `/logout`) regardless of which build is used.

### Production Entry Point

Single entry point: Istio Ingress Gateway (port 443)
- All browser traffic enters through Istio Ingress
- Session Gateway and NGINX are internal services, not directly accessible

## Security Features

### Session Cookies

- **HttpOnly**: JavaScript cannot access cookies (XSS protection)
- **Secure**: HTTPS only (in production)
- **SameSite=Strict**: CSRF protection
- **30-minute timeout**: Sliding session expiration

### Token Management

- Auth0 refresh tokens stored server-side in Redis session hash (`session:{id}`)
- ext_authz reads session hashes directly from Redis for per-request validation
- Frontend heartbeat (`GET /auth/session`) refreshes IDP tokens near expiry and extends session TTL
- No tokens in browser localStorage/sessionStorage
- No tokens in browser JavaScript

### Defense in Depth

1. **Session Gateway**: Manages auth lifecycle, prevents token exposure to browser
2. **ext_authz (Istio Ingress)**: Validates every API request via Redis session lookup, injects identity headers
3. **Backend Services**: Enforce data-level authorization using identity headers

### Instant Session Revocation

Delete the Redis session key → next request immediately fails at ext_authz. No token expiry window to wait out.

## Common Issues

### "Not authenticated" even after login

**Cause**: Accessing Vite dev server directly (http://localhost:3000)
**Solution**: Access via Istio Ingress Gateway (https://app.budgetanalyzer.localhost)

### CORS errors

**Cause**: Making requests to different origins
**Solution**: All requests should go to same origin (Istio Ingress Gateway, port 443)

### Session expires immediately

**Cause**: Cookies not being sent
**Solution**: Ensure `withCredentials: true` in axios config

## Testing Authentication

### Manual Testing

1. Navigate to `https://app.budgetanalyzer.localhost/login`
2. Click "Sign in"
3. Login with your credentials
4. Check browser DevTools → Application → Cookies
5. Should see `SESSION` cookie with HttpOnly flag
6. Navigate to `https://app.budgetanalyzer.localhost/admin`
7. Should see admin panel (if user has ADMIN role)

### Automated Testing

```typescript
// Mock authenticated user
vi.mock('@/features/admin/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      sub: 'test-user',
      email: 'test@example.com',
      authenticated: true,
      roles: ['ADMIN'],
    },
    isAuthenticated: true,
    isLoading: false,
  }),
}));
```

## References

See the [orchestration repository](https://github.com/budgetanalyzer/orchestration) for:
- [Security Architecture](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/security-architecture.md)
- [Session-Based Edge Authorization Pattern](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/session-edge-authorization-pattern.md)
- [Port Reference](https://github.com/budgetanalyzer/orchestration/blob/main/docs/architecture/port-reference.md)
- Session Gateway Repository
