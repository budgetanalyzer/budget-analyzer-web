# Cookie Authentication Issue - Diagnosis and Resolution

## Problem Summary

After Auth0 integration, transaction imports fail with "Unable to reach the server" error after ~15 seconds. Investigation revealed that **session cookies exist in browser storage but are NOT being sent with API requests**.

## Root Cause

The session cookie is not being included in the `Cookie` header when making API requests to `/api/v1/transactions/import`, even though:
- Cookie exists in browser's Application → Cookies storage
- Request is same-origin (`http://localhost:8081`)
- Axios is configured with `withCredentials: true`
- Login flow works correctly

## Investigation Results

### Confirmed Working ✅
1. User can access app via `http://localhost:8081` (Session Gateway)
2. Auth0 login flow completes successfully
3. Session cookie appears in DevTools → Application → Cookies
4. Frontend code has `withCredentials: true` configured
5. Request reaches the browser and appears in Network tab

### Confirmed Broken ❌
1. Cookie header is NOT present in Network tab → Request Headers
2. Browser is blocking the cookie from being sent
3. Backend receives unauthenticated request
4. Request times out or returns 401 (but response doesn't reach frontend)

## Likely Causes

### Most Likely: SameSite Cookie Attribute Issue

Modern browsers enforce `SameSite` cookie policies:
- **SameSite=Lax** (default): Blocks cookies on cross-site POST/PUT/DELETE requests
- **SameSite=Strict**: Blocks cookies on all cross-site requests
- **SameSite=None**: Allows cookies on all requests (requires `Secure` flag)

**The issue**: If the session cookie has `SameSite=Lax`, the browser may block it from being sent with POST requests, even on same-origin requests in certain scenarios (like when the request is triggered by JavaScript rather than a form submission).

### Other Possible Causes

1. **Cookie Domain Mismatch**: Cookie set for wrong domain/subdomain
2. **Missing CORS Headers**: Backend not returning `Access-Control-Allow-Credentials: true`
3. **Cookie Path Issue**: Cookie set for path that doesn't match `/api/*`
4. **Secure Flag Issue**: Cookie requires HTTPS but app is on HTTP

## Required Backend Fixes

### 1. Session Cookie Configuration (Session Gateway)

**Current (problematic) configuration:**
```yaml
server:
  servlet:
    session:
      cookie:
        name: SESSION
        # Likely has SameSite=Lax or Strict
```

**Required configuration:**
```yaml
server:
  servlet:
    session:
      cookie:
        name: SESSION
        same-site: none       # ← CRITICAL: Allow cross-site requests
        secure: true          # ← REQUIRED when SameSite=None
        http-only: true       # Security best practice
        path: /               # Allow cookie for all paths
        domain: localhost     # Explicitly set domain
```

**Note**: `SameSite=None` requires HTTPS. For local development, you may need to:
- Use `SameSite=Lax` but ensure it works with POST requests
- OR set up local HTTPS (mkcert)
- OR use development-specific profile with relaxed settings

### 2. CORS Configuration (NGINX or Session Gateway)

Ensure CORS headers allow credentials:

```nginx
# NGINX configuration
add_header 'Access-Control-Allow-Credentials' 'true' always;
add_header 'Access-Control-Allow-Origin' 'http://localhost:8081' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization' always;
```

**OR** in Spring Boot (Session Gateway):

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins("http://localhost:8081")
            .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);  // ← CRITICAL
    }
}
```

### 3. Verify Cookie is Being Set Correctly

Check what the Session Gateway is actually setting when user logs in:

**Expected response headers after Auth0 callback:**
```
Set-Cookie: SESSION=abc123...; Path=/; Domain=localhost; SameSite=None; Secure; HttpOnly
```

**To debug in backend:**
- Log the `Set-Cookie` header being sent
- Log the session cookie configuration on startup
- Verify cookie attributes match requirements

## Frontend Debugging Added

Added comprehensive logging in `src/api/client.ts` that will help diagnose:

1. **Request interceptor** logs:
   - Full URL being requested
   - Whether `withCredentials` is enabled
   - Whether cookies exist in `document.cookie`
   - Warning if no cookies found

2. **Response interceptor** logs:
   - Success/failure status
   - Detailed error diagnostics
   - Possible causes when requests fail

## Testing After Backend Fixes

1. **Clear all cookies** in DevTools → Application → Cookies
2. **Log in** via Auth0
3. **Check cookie attributes** in Application → Cookies:
   - Should see `SameSite=None` (or appropriate value)
   - Should see `Secure=true` if using HTTPS
   - Should see `HttpOnly=true`
4. **Try transaction import**
5. **Check Network tab** → Request Headers:
   - Should see `Cookie: SESSION=...`
6. **Check console logs** for debug output

## Workarounds for Development

### Option A: Enable Mock Mode
```env
# .env
VITE_USE_MOCK_DATA=true
```
This bypasses the backend entirely and uses static mock data.

### Option B: Temporarily Disable Authentication
Configure Session Gateway to allow unauthenticated requests for development (NOT for production).

### Option C: Use Local HTTPS
Set up HTTPS for local development using mkcert to satisfy `Secure` flag requirement.

## Related Documentation

- [MDN: SameSite Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)
- [Spring Session Cookie Configuration](https://docs.spring.io/spring-session/reference/configuration/common.html#custom-cookie)
- [CORS with Credentials](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#requests_with_credentials)

## Next Steps

1. **Share console output** from transaction import attempt (with new debugging)
2. **Check actual cookie attributes** in DevTools → Application → Cookies
3. **Coordinate with backend team** to update Session Gateway cookie configuration
4. **Re-test** after backend changes deployed

## Contact

If the cookie attributes look correct but issue persists, we may need to investigate:
- Browser-specific cookie handling
- Proxy configuration in the request chain
- Session Gateway → NGINX → Backend service routing
