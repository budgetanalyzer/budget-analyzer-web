# Role-Based Access Control (RBAC) Integration Guide

## Overview

This guide documents how to integrate role-based security across the Budget Analyzer system architecture. The frontend RBAC infrastructure is **production-ready** and waiting for backend role propagation.

## Architecture Summary

```
Auth0 → Session Gateway → Frontend → Backend Services
(JWT    (extracts user   (receives    (validates roles
 with   WITH roles)       user WITH    from JWT)
 roles)                   roles)
```

## Frontend Status: ✅ Production Ready

The React frontend has complete RBAC infrastructure already implemented:

### Type Definitions

**File:** [src/types/auth.ts](../src/types/auth.ts)

```typescript
export type UserRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';

export interface User {
  sub: string;             // User ID (Auth0 subject)
  email: string;
  name?: string;
  picture?: string;
  emailVerified?: boolean;
  authenticated: boolean;
  registrationId?: string; // "auth0"
  roles?: UserRole[];      // Custom roles from JWT
}
```

### Authentication Hook

**File:** [src/features/admin/hooks/useAuth.ts](../src/features/admin/hooks/useAuth.ts)

```typescript
export function useAuth() {
  // ... React Query logic to fetch user from /user endpoint

  return {
    user,
    isAuthenticated: !!user,

    // Authorization helpers
    hasRole: (role: UserRole) => user?.roles?.includes(role) ?? false,
    hasAnyRole: (...roles: UserRole[]) =>
      roles.some(role => user?.roles?.includes(role)),
    hasAllRoles: (...roles: UserRole[]) =>
      roles.every(role => user?.roles?.includes(role)),
  };
}
```

### Protected Route Component

**File:** [src/features/admin/components/ProtectedRoute.tsx](../src/features/admin/components/ProtectedRoute.tsx)

```typescript
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;          // Single role required
  requireAnyRole?: UserRole[];      // At least one role required
  requireAllRoles?: UserRole[];     // All roles required
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireAnyRole,
  requireAllRoles
}: ProtectedRouteProps) {
  const { isAuthenticated, hasRole, hasAnyRole, hasAllRoles } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (requiredRole && !hasRole(requiredRole))
    return <Navigate to="/unauthorized" replace />;
  if (requireAnyRole && !hasAnyRole(...requireAnyRole))
    return <Navigate to="/unauthorized" replace />;
  if (requireAllRoles && !hasAllRoles(...requireAllRoles))
    return <Navigate to="/unauthorized" replace />;

  return <>{children}</>;
}
```

### Route Usage Example

**File:** [src/App.tsx](../src/App.tsx)

```typescript
<Route
  path="/admin"
  element={
    <ProtectedRoute requiredRole="ADMIN">
      <AdminLayout />
    </ProtectedRoute>
  }
>
  <Route path="currencies" element={<CurrenciesListPage />} />
  <Route path="currencies/new" element={<CurrencyCreatePage />} />
  <Route path="currencies/:id" element={<CurrencyEditPage />} />
</Route>
```

## Backend Integration Requirements

### 1. Auth0 Configuration

**Goal:** Add custom claims to JWT with user roles

**Implementation:** Create an Auth0 Action in the Login flow

```javascript
// Auth0 Actions > Flows > Login
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://budgetanalyzer.com';

  // Get roles from user metadata or Auth0 role assignments
  const roles = event.authorization?.roles || ['USER'];

  // Add roles to access token (JWT)
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);

  // Add roles to ID token
  api.idToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

**Steps:**
1. Go to Auth0 Dashboard > Actions > Flows > Login
2. Create new action with the code above
3. Add action to the Login flow
4. Test by logging in and inspecting the JWT at jwt.io

**Role Assignment:**
1. Create roles in Auth0: `USER`, `ADMIN`, `SUPER_ADMIN`
2. Assign roles to users via:
   - Auth0 Dashboard > User Management > Users > [Select User] > Roles
   - Or Auth0 Management API

**Namespace Convention:**
- Use your domain as namespace: `https://budgetanalyzer.com`
- Auth0 requires namespaced custom claims
- Don't use `auth0.com`, `webtask.io`, or `webtask.run` namespaces

### 2. Session Gateway Configuration

**Goal:** Extract roles from Auth0 JWT and include in `/user` endpoint response

**Current State:** Session Gateway extracts basic user info but likely doesn't include roles.

**Required Changes:**

#### A. Extract Roles from OAuth2 User

```java
@Configuration
public class OAuth2Config {

  @Bean
  public OAuth2UserService<OAuth2UserRequest, OAuth2User> oauth2UserService() {
    DefaultOAuth2UserService delegate = new DefaultOAuth2UserService();

    return userRequest -> {
      OAuth2User oauth2User = delegate.loadUser(userRequest);
      Map<String, Object> attributes = new HashMap<>(oauth2User.getAttributes());

      // Extract roles from Auth0 custom claim
      String rolesKey = "https://budgetanalyzer.com/roles";
      List<String> roles = (List<String>) attributes.getOrDefault(
        rolesKey,
        List.of("USER")
      );

      // Add roles to attributes for easy access
      attributes.put("roles", roles);

      return new DefaultOAuth2User(
        oauth2User.getAuthorities(),
        attributes,
        "sub" // Use 'sub' claim as principal name
      );
    };
  }
}
```

#### B. Include Roles in /user Endpoint

```java
@RestController
public class UserController {

  @GetMapping("/user")
  public Map<String, Object> user(@AuthenticationPrincipal OAuth2User principal) {
    if (principal == null) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }

    Map<String, Object> user = new HashMap<>();
    user.put("sub", principal.getAttribute("sub"));
    user.put("email", principal.getAttribute("email"));
    user.put("name", principal.getAttribute("name"));
    user.put("picture", principal.getAttribute("picture"));
    user.put("emailVerified", principal.getAttribute("email_verified"));
    user.put("authenticated", true);
    user.put("registrationId", "auth0");
    user.put("roles", principal.getAttribute("roles")); // ⚠️ Add this

    return user;
  }
}
```

**Testing:**
```bash
# With authenticated session
curl -H "Cookie: SESSION=xxx" http://localhost:8081/user

# Expected response:
{
  "sub": "auth0|123456",
  "email": "admin@example.com",
  "name": "Admin User",
  "authenticated": true,
  "roles": ["ADMIN", "USER"]
}
```

### 3. Backend Services Authorization

**Goal:** Enforce role-based authorization on API endpoints

**Convention:**
- Public endpoints: `/v1/{resource}` - No role required (authenticated users only)
- Admin endpoints: `/v1/admin/{resource}` - Require `ADMIN` role

#### A. Spring Security Configuration

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

  @Bean
  public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http
      .authorizeHttpRequests(auth -> auth
        // Public endpoints - any authenticated user
        .requestMatchers(HttpMethod.GET, "/v1/currencies").permitAll()
        .requestMatchers(HttpMethod.GET, "/v1/transactions/**").authenticated()

        // Admin endpoints - require ADMIN role
        .requestMatchers("/v1/admin/**").hasRole("ADMIN")

        // Default - require authentication
        .anyRequest().authenticated()
      )
      .oauth2ResourceServer(oauth2 -> oauth2
        .jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
      );

    return http.build();
  }

  @Bean
  public JwtAuthenticationConverter jwtAuthenticationConverter() {
    // Extract authorities from custom roles claim
    JwtGrantedAuthoritiesConverter grantedAuthoritiesConverter =
      new JwtGrantedAuthoritiesConverter();
    grantedAuthoritiesConverter.setAuthoritiesClaimName(
      "https://budgetanalyzer.com/roles"
    );
    grantedAuthoritiesConverter.setAuthorityPrefix("ROLE_");

    JwtAuthenticationConverter jwtAuthenticationConverter =
      new JwtAuthenticationConverter();
    jwtAuthenticationConverter.setJwtGrantedAuthoritiesConverter(
      grantedAuthoritiesConverter
    );

    return jwtAuthenticationConverter;
  }
}
```

#### B. Method-Level Security (Optional)

```java
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig {
  // Enables @PreAuthorize, @PostAuthorize annotations
}

@RestController
@RequestMapping("/v1/admin/currencies")
public class CurrencyAdminController {

  @PreAuthorize("hasRole('ADMIN')")
  @PostMapping
  public Currency createCurrency(@RequestBody Currency currency) {
    // Only ADMIN role can access
    return currencyService.create(currency);
  }

  @PreAuthorize("hasRole('SUPER_ADMIN')")
  @DeleteMapping("/{id}")
  public void deleteCurrency(@PathVariable Long id) {
    // Only SUPER_ADMIN role can access
    currencyService.delete(id);
  }
}
```

#### C. Controller-Level Role Checks

```java
@RestController
@RequestMapping("/v1/transactions")
public class TransactionController {

  @GetMapping
  public List<Transaction> getTransactions(
    @AuthenticationPrincipal Jwt jwt
  ) {
    String userId = jwt.getSubject();
    List<String> roles = jwt.getClaimAsStringList("https://budgetanalyzer.com/roles");

    // Users can only see their own transactions
    // Admins can see all transactions
    if (roles != null && roles.contains("ADMIN")) {
      return transactionService.findAll();
    } else {
      return transactionService.findByUserId(userId);
    }
  }
}
```

### 4. NGINX Configuration (No Changes Required)

NGINX already validates JWT signatures via `auth_request` module. No changes needed for role-based authorization - this is handled by backend services.

## Testing Strategy

### Frontend Testing

**Mock Authenticated User:**
```typescript
// In test files
import { vi } from 'vitest';

vi.mock('@/features/admin/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      sub: 'test-admin',
      email: 'admin@example.com',
      authenticated: true,
      roles: ['ADMIN'],
    },
    isAuthenticated: true,
    isLoading: false,
    hasRole: (role: UserRole) => role === 'ADMIN',
    hasAnyRole: (...roles: UserRole[]) => roles.includes('ADMIN'),
    hasAllRoles: (...roles: UserRole[]) => roles.includes('ADMIN'),
  }),
}));
```

**Test Protected Routes:**
```typescript
describe('ProtectedRoute', () => {
  it('redirects to /unauthorized when user lacks required role', () => {
    // Mock user without ADMIN role
    vi.mocked(useAuth).mockReturnValue({
      user: { sub: '123', email: 'user@example.com', roles: ['USER'] },
      isAuthenticated: true,
      hasRole: (role) => role === 'USER',
    });

    render(
      <ProtectedRoute requiredRole="ADMIN">
        <div>Admin Content</div>
      </ProtectedRoute>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/unauthorized', { replace: true });
  });
});
```

### Integration Testing

**1. Auth0 JWT Claims:**
```bash
# Login and copy access token
# Decode at jwt.io and verify:
{
  "https://budgetanalyzer.com/roles": ["ADMIN", "USER"],
  "sub": "auth0|123456",
  "email": "admin@example.com"
}
```

**2. Session Gateway /user Endpoint:**
```bash
# Test with authenticated session
curl -H "Cookie: SESSION=xxx" http://localhost:8081/user | jq

# Verify response includes roles:
{
  "roles": ["ADMIN", "USER"]
}
```

**3. Backend Authorization:**
```bash
# As ADMIN - should succeed
curl -H "Cookie: SESSION=xxx" http://localhost:8081/api/v1/admin/currencies

# As USER (non-admin) - should return 403 Forbidden
curl -H "Cookie: SESSION=xxx" http://localhost:8081/api/v1/admin/currencies
# Expected: {"status": 403, "error": "Forbidden"}
```

**4. Frontend Route Protection:**
```bash
# Navigate to /admin as non-admin user
# Expected: Redirect to /unauthorized

# Navigate to /admin as admin user
# Expected: Display admin content
```

### End-to-End Testing

**Test Scenario 1: Non-Admin User**
1. Login as user with `USER` role only
2. Verify `/user` endpoint returns `roles: ['USER']`
3. Navigate to `/admin/currencies` - expect redirect to `/unauthorized`
4. Call `GET /api/v1/admin/currencies` - expect 403 Forbidden

**Test Scenario 2: Admin User**
1. Login as user with `ADMIN` role
2. Verify `/user` endpoint returns `roles: ['ADMIN', 'USER']`
3. Navigate to `/admin/currencies` - expect admin page display
4. Call `GET /api/v1/admin/currencies` - expect 200 OK with data
5. Create new currency - expect 201 Created

**Test Scenario 3: Session Timeout**
1. Login as admin
2. Wait for session timeout (30 minutes)
3. Navigate to `/admin/currencies` - expect redirect to login
4. Call API endpoint - expect 401 Unauthorized with redirect

## Security Considerations

### Defense in Depth (3 Layers)

1. **Layer 1: Session Gateway**
   - Validates session cookie
   - Only includes roles from validated JWT
   - Cannot be bypassed (all requests go through gateway)

2. **Layer 2: NGINX**
   - Validates JWT signature
   - Ensures token hasn't been tampered with
   - Routes based on service paths

3. **Layer 3: Backend Services**
   - Validates roles from JWT claims
   - Enforces data-level authorization
   - Checks resource ownership

### Important Security Notes

**✅ Do:**
- Always enforce authorization at the backend
- Use HttpOnly, Secure, SameSite=Strict cookies
- Validate JWT signatures
- Check roles from JWT claims (never trust frontend)
- Use HTTPS in production
- Set appropriate CORS policies

**❌ Don't:**
- Trust role information from frontend (display only)
- Store JWTs in localStorage or sessionStorage
- Expose JWTs to JavaScript
- Skip backend authorization checks
- Use long session timeouts in production

### OWASP Top 10 Mitigations

- **A01: Broken Access Control** - Prevented by defense-in-depth authorization
- **A02: Cryptographic Failures** - JWTs never exposed to browser (XSS protection)
- **A03: Injection** - Not applicable (no SQL/command injection in auth flow)
- **A05: Security Misconfiguration** - Proper cookie flags, CORS, CSP headers
- **A07: Auth Failures** - OAuth2/OIDC with Auth0, secure session management

## Role Definitions

| Role | Description | Permissions |
|------|-------------|-------------|
| `USER` | Default role for all authenticated users | Read own transactions, upload files, view public data |
| `ADMIN` | Administrative users | All USER permissions + CRUD currencies, view all transactions, manage users |
| `SUPER_ADMIN` | System administrators | All ADMIN permissions + delete currencies, system configuration |

## API Endpoint Conventions

| Pattern | Auth Required | Role Required | Example |
|---------|---------------|---------------|---------|
| `GET /v1/{resource}` | No (public) | None | `GET /v1/currencies?enabledOnly=true` |
| `GET /v1/{resource}/:id` | Yes | None (own data) | `GET /v1/transactions/123` |
| `POST /v1/{resource}` | Yes | None | `POST /v1/transactions` |
| `GET /v1/admin/{resource}` | Yes | ADMIN | `GET /v1/admin/currencies` |
| `POST /v1/admin/{resource}` | Yes | ADMIN | `POST /v1/admin/currencies` |
| `DELETE /v1/admin/{resource}` | Yes | SUPER_ADMIN | `DELETE /v1/admin/currencies/123` |

## Troubleshooting

### Roles Not Appearing in Frontend

**Symptom:** `user.roles` is `undefined` or empty

**Checklist:**
1. ✅ Auth0 Action is added to Login flow and enabled
2. ✅ JWT contains roles claim (check at jwt.io)
3. ✅ Session Gateway extracts roles from JWT
4. ✅ `/user` endpoint includes roles in response
5. ✅ Frontend `User` type includes `roles?: UserRole[]`

**Debug:**
```bash
# Check Session Gateway /user endpoint
curl -H "Cookie: SESSION=xxx" http://localhost:8081/user | jq .roles

# Check Auth0 JWT
# Login, copy access token, decode at jwt.io
# Look for: "https://budgetanalyzer.com/roles": ["ADMIN"]
```

### 403 Forbidden on Admin Endpoints

**Symptom:** Admin user receives 403 on `/v1/admin/*` endpoints

**Checklist:**
1. ✅ User has ADMIN role in Auth0
2. ✅ JWT includes roles claim
3. ✅ Backend extracts roles from correct claim name
4. ✅ Authority prefix is `ROLE_` (Spring Security default)
5. ✅ Endpoint requires `hasRole('ADMIN')` not `hasAuthority('ADMIN')`

**Debug:**
```bash
# Check JWT authorities in backend logs
# Should show: [ROLE_ADMIN, ROLE_USER]
```

### Protected Routes Not Working

**Symptom:** Non-admin users can access `/admin/*` routes

**Checklist:**
1. ✅ Route wrapped in `<ProtectedRoute requiredRole="ADMIN">`
2. ✅ `useAuth()` returns correct roles
3. ✅ `/user` endpoint returns roles
4. ✅ React Router configured correctly

**Debug:**
```typescript
// Add console logs to ProtectedRoute
console.log('User roles:', user?.roles);
console.log('Required role:', requiredRole);
console.log('Has role:', hasRole(requiredRole));
```

## Migration Checklist

### Phase 1: Auth0 Setup
- [ ] Create roles in Auth0 (USER, ADMIN, SUPER_ADMIN)
- [ ] Assign roles to test users
- [ ] Create Auth0 Action to add roles to JWT
- [ ] Enable Action in Login flow
- [ ] Test: Login and verify JWT contains roles claim

### Phase 2: Session Gateway
- [ ] Extract roles from Auth0 JWT in OAuth2UserService
- [ ] Include roles in `/user` endpoint response
- [ ] Test: `/user` endpoint returns roles
- [ ] Test: Session timeout and refresh still work

### Phase 3: Backend Services
- [ ] Configure JwtAuthenticationConverter with custom claims
- [ ] Add role-based authorization rules to SecurityFilterChain
- [ ] Protect `/v1/admin/*` endpoints with `hasRole('ADMIN')`
- [ ] Test: Admin endpoints return 403 for non-admin users
- [ ] Test: Admin endpoints return data for admin users

### Phase 4: Frontend Verification
- [ ] Test: Admin routes redirect non-admin users to /unauthorized
- [ ] Test: Admin routes display for admin users
- [ ] Test: `useAuth()` returns correct roles
- [ ] Test: `ProtectedRoute` component works correctly
- [ ] Test: Logout clears roles

### Phase 5: End-to-End Testing
- [ ] Test complete user flow (login, navigate, API calls, logout)
- [ ] Test complete admin flow
- [ ] Test session timeout and automatic refresh
- [ ] Load test with multiple concurrent users

## References

### Frontend Files (Production Ready)
- [src/types/auth.ts](../src/types/auth.ts) - User and UserRole types
- [src/features/admin/hooks/useAuth.ts](../src/features/admin/hooks/useAuth.ts) - Authentication hook
- [src/features/admin/components/ProtectedRoute.tsx](../src/features/admin/components/ProtectedRoute.tsx) - Route protection
- [src/api/auth.ts](../src/api/auth.ts) - Auth API client
- [src/api/client.ts](../src/api/client.ts) - API client with credentials
- [src/App.tsx](../src/App.tsx) - Route configuration

### Documentation
- [authentication.md](./authentication.md) - Session Gateway authentication guide
- [README.md](../README.md) - Development setup
- [CLAUDE.md](../CLAUDE.md) - Codebase architecture

### External Resources
- [Auth0 Custom Claims](https://auth0.com/docs/customize/actions/flows-and-triggers/login-flow)
- [Spring Security OAuth2 Resource Server](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html)
- [React Router Authentication](https://reactrouter.com/en/main/start/tutorial#authentication)

## Summary

The Budget Analyzer frontend is **production-ready** for role-based access control. All necessary infrastructure is implemented:

✅ Type-safe role definitions
✅ Authentication hook with authorization helpers
✅ Protected route component with flexible role requirements
✅ Admin routes configured with role protection
✅ API client configured for session-based auth

**Next Steps:** Configure Auth0 custom claims, Session Gateway role extraction, and backend authorization enforcement following this guide.
