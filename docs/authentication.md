# Authentication Integration Guide

## Overview

Budget Analyzer uses a **Session Gateway (BFF) pattern** for authentication. This means:
- JWTs are never exposed to the browser (XSS protection)
- Session cookies are HttpOnly, Secure, and SameSite
- All auth flows are handled server-side by the Session Gateway
- Frontend only needs to call `/user` endpoint and redirect to login/logout

## Architecture

```
Browser → Session Gateway (8081) → NGINX (8080) → Backend Services
          ├─ OAuth2 flows
          ├─ Session cookies (HttpOnly)
          ├─ Token management in Redis
          └─ JWT relay to backend
```

## Development Setup

### Access URLs

**Development:**
- Frontend: `http://localhost:8081` (Session Gateway)
- DO NOT use `http://localhost:3000` (Vite dev server) - authentication won't work

**Production:**
- Frontend: Load balancer domain (e.g., `https://budgetanalyzer.com`)

### Request Flow (Development)

1. Browser requests `http://localhost:8081/`
2. Session Gateway proxies to NGINX (8080)
3. NGINX proxies to Vite dev server (3000)
4. Vite serves React app with HMR

For API requests:
1. Browser requests `http://localhost:8081/api/transactions`
2. Session Gateway validates session cookie
3. Session Gateway adds JWT from Redis
4. Session Gateway proxies to NGINX (8080)
5. NGINX validates JWT and routes to backend services

## Authentication Flows

### Login Flow

```typescript
// User clicks login button
const { login } = useAuth();
login(); // Redirects to /oauth2/authorization/auth0

// Session Gateway handles:
// 1. Redirect to Auth0 login
// 2. OAuth callback
// 3. Store JWT in Redis
// 4. Set session cookie
// 5. Redirect back to frontend
```

### Logout Flow

```typescript
// User clicks logout button
const { logout } = useAuth();
logout(); // Calls POST /logout

// Session Gateway handles:
// 1. Invalidate Redis session
// 2. Clear session cookie
// 3. Redirect to Auth0 logout
// 4. Redirect back to frontend
```

### Check Authentication Status

```typescript
// On app load, check if user is authenticated
const { user, isAuthenticated, isLoading } = useAuth();

// Internally calls GET /user endpoint
// Returns user info if session is valid
// Returns null if no valid session
```

## Configuration Files

### Frontend (.env)

```bash
# API base URL - all API requests go here
VITE_API_BASE_URL=/api

# Access app via Session Gateway in development
# http://localhost:8081
```

### Session Gateway (application.yml)

```yaml
# API route: /api/* → NGINX → Backend services
# Frontend route: /** → NGINX → React app (Vite or static files)

spring:
  cloud:
    gateway:
      routes:
        - id: api-route
          uri: http://localhost:8080
          predicates:
            - Path=/api/**
          filters:
            - TokenRefresh=
            - TokenRelay=

        - id: frontend-route
          uri: http://localhost:8080
          predicates:
            - Path=/**
          order: 10000
```

## API Client Configuration

### Axios Configuration

```typescript
// All requests include session cookies
const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true, // Include session cookies
});

// No need to manually add Authorization header
// Session Gateway adds JWT automatically
```

### Error Handling

```typescript
// 401 Unauthorized → redirect to login
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/oauth2/authorization/auth0';
    }
    throw error;
  }
);
```

## User Info Structure

```typescript
interface User {
  sub: string;             // User ID (Auth0 subject)
  email: string;
  name?: string;
  picture?: string;        // Profile picture URL
  emailVerified?: boolean;
  authenticated: boolean;
  registrationId?: string; // "auth0"
  roles?: UserRole[];      // Custom roles (if added by backend)
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
# Build static files
npm run build

# Output: dist/ directory
# NGINX serves these files in production
```

### Load Balancer Configuration

Two entry points:
- `budgetanalyzer.com` → Session Gateway (8081) - for web browsers
- `api.budgetanalyzer.com` → NGINX (8080) - for M2M clients

Session Gateway proxies to NGINX (8080) for both API and frontend requests.

## Security Features

### Session Cookies

- **HttpOnly**: JavaScript cannot access cookies (XSS protection)
- **Secure**: HTTPS only (in production)
- **SameSite=Strict**: CSRF protection
- **30-minute timeout**: Automatic session expiration

### Token Management

- JWTs stored server-side in Redis
- Automatic token refresh (5-minute threshold)
- No tokens in browser localStorage/sessionStorage
- No tokens in browser JavaScript

### Defense in Depth

1. **Session Gateway**: Validates session cookie
2. **NGINX**: Validates JWT signature (auth_request)
3. **Backend Services**: Enforce data-level authorization

## Common Issues

### "Not authenticated" even after login

**Cause**: Accessing Vite dev server directly (http://localhost:3000)
**Solution**: Access via Session Gateway (http://localhost:8081)

### CORS errors

**Cause**: Making requests to different origins
**Solution**: All requests should go to same origin (Session Gateway port 8081)

### Session expires immediately

**Cause**: Cookies not being sent
**Solution**: Ensure `withCredentials: true` in axios config

## Testing Authentication

### Manual Testing

1. Navigate to `http://localhost:8081/login`
2. Click "Sign in with Auth0"
3. Login with Auth0 credentials
4. Check browser DevTools → Application → Cookies
5. Should see `SESSION` cookie with HttpOnly flag
6. Navigate to `http://localhost:8081/admin`
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

- [Authentication Implementation Plan](../../orchestration/docs/architecture/authentication-implementation-plan.md)
- [Security Architecture](../../orchestration/docs/architecture/security-architecture.md)
- Session Gateway README: `../session-gateway/README.md`
