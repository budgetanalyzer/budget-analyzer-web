# Plan: Remove RBAC, Allow Any Authenticated User to Access /Admin

## Goal

Remove role-based access control so any logged-in user can view `/admin` pages. Keep basic authentication in place.

## Problem

The `/admin` routes require the `ADMIN` role, but the backend hasn't implemented role propagation from Auth0 yet. Users cannot access admin pages because `roles` is always `undefined`.

## Outcome

Any logged-in user can access `/admin/currencies` and other admin pages without role restrictions.

---

## Phase 1: Remove Role Requirement from Routes

**File: `src/App.tsx`** (line 39)

- Remove `requiredRole="ADMIN"` from the ProtectedRoute wrapping `/admin`
- Change from `<ProtectedRoute requiredRole="ADMIN">` to `<ProtectedRoute>`

---

## Phase 2: Simplify ProtectedRoute Component

**File: `src/features/admin/components/ProtectedRoute.tsx`**

- Remove all role-related props (`requiredRole`, `requireAnyRole`, `requireAllRoles`)
- Remove role-checking logic (lines 46-60)
- Keep only the `isAuthenticated` check and loading state
- Result: Component only checks if user is logged in

---

## Phase 3: Remove Role Helpers from useAuth Hook

**File: `src/features/auth/hooks/useAuth.ts`**

- Remove `hasRole`, `hasAnyRole`, `hasAllRoles` methods from the return object (lines 78-83)
- Remove `useRequireRole` hook export (lines 100-116) - unused but related
- Keep: `user`, `isAuthenticated`, `isLoading`, `login`, `logout`

---

## Phase 4: Clean Up Auth Types

**File: `src/types/auth.ts`**

- Remove `UserRole` type definition
- Remove `roles?: UserRole[]` from `User` interface

---

## Phase 5: Update Components Using Roles

**File: `src/features/admin/components/AdminLayout.tsx`**

- Remove any display of user roles (if present)

**File: `src/features/admin/components/UnauthorizedPage.tsx`**

- Keep the page (may still be useful for other auth errors), or optionally remove it

---

## Phase 6: Cleanup

- Run `npm run lint:fix` to auto-fix any issues
- Run `npm run build` to verify no type errors
- Run tests to ensure nothing breaks

---

## Summary

### Files Changed (6-7 files)

1. `src/App.tsx` - Remove role requirement
2. `src/features/admin/components/ProtectedRoute.tsx` - Simplify component
3. `src/features/auth/hooks/useAuth.ts` - Remove role methods
4. `src/types/auth.ts` - Remove role types
5. `src/features/admin/components/AdminLayout.tsx` - Remove role display
6. Possibly `src/features/admin/components/UnauthorizedPage.tsx` - Review/remove

### What Stays

- Basic authentication (login/logout)
- Session Gateway integration
- API client with credentials
- UserProfileDropdown
- LoginPage

### Future Considerations

When ready to re-implement RBAC, refer to `docs/rbac-integration.md` for the complete integration guide.
