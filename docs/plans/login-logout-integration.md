# Login/Logout Integration Plan

## Overview
Add authentication UI to the public Layout header so users can log in from anywhere in the app, with a user profile dropdown when authenticated.

## Requirements
- **Location**: Main header (public Layout)
- **Redirect**: Back to same page after login
- **User access**: All authenticated users (not just admins)
- **UI Style**: User profile dropdown with avatar/name and logout option

## Changes Required

### 1. Move useAuth hook to shared location
- Move from `features/admin/hooks/useAuth.ts` to `features/auth/hooks/useAuth.ts`
- Update the `login()` function to accept optional `returnUrl` parameter
- Store current path before redirecting to Auth0
- Update all imports in AdminLayout and other components

### 2. Create UserProfileDropdown component
- New file: `features/auth/components/UserProfileDropdown.tsx`
- Use Shadcn's DropdownMenu component
- Display user avatar (Auth0 picture field) using Shadcn Avatar component
- Show user name, email, and roles in dropdown
- Include logout button that calls `logout()` from useAuth
- Handle loading states during logout

### 3. Update Layout component
File: `components/Layout.tsx`

- Add useAuth hook call to check authentication status
- In header (next to theme toggle and currency selector):
  - **Not authenticated**: Show "Login" button that calls `login()` with current path as returnUrl
  - **Authenticated**: Show UserProfileDropdown component
- Handle loading states while checking auth

### 4. Update backend returnUrl handling
**(Coordination needed with backend team)**

- Frontend will pass `returnUrl` query parameter to `/oauth2/authorization/auth0?returnUrl={path}`
- Backend Session Gateway needs to support storing and redirecting to returnUrl after OAuth completes
- **NOTE**: Verify this is already implemented in Session Gateway or coordinate backend changes

### 5. Update routing (if needed)
- Ensure `/login` page still works for direct login access
- Update LoginPage to also support returnUrl handling

## Technical Considerations

- **State management**: Use React Query in useAuth (already implemented)
- **Security**: Validate returnUrl to prevent open redirect vulnerabilities (backend responsibility)
- **UX**: Show loading spinner in header while auth state is being determined
- **Responsive**: Ensure dropdown works on mobile
- **Path aliases**: Use `@/` imports throughout

## Files to Modify

1. **Move**: `features/admin/hooks/useAuth.ts` → `features/auth/hooks/useAuth.ts`
2. **Create**: `features/auth/components/UserProfileDropdown.tsx`
3. **Update**: `components/Layout.tsx`
4. **Update**: `features/admin/components/AdminLayout.tsx` (import path)
5. **Update**: `features/auth/pages/LoginPage.tsx` (returnUrl support)

## Testing Checklist

- [ ] Login from transactions page returns to transactions
- [ ] Login from analytics page returns to analytics
- [ ] Logout works from dropdown
- [ ] Admin users can still access /admin section
- [ ] Non-admin users can log in and see their profile
- [ ] Dropdown shows correct user info (name, email, roles)
- [ ] Mobile responsive design works

## Backend Coordination Required

Verify Session Gateway supports `returnUrl` parameter in OAuth flow:
- Query param: `/oauth2/authorization/auth0?returnUrl=/analytics`
- Session storage of return URL during OAuth flow
- Redirect to returnUrl after successful authentication
