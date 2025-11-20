# Reference Implementation: RBAC + Permissions Authorization System

**Created:** 2025-11-20
**Status:** Planned
**Goal:** Create a reference implementation for user roles and permissions that's easy on frontend and backend

---

## Executive Summary

This plan redesigns the authorization system to follow 2025 best practices:
- **Hybrid RBAC + Permissions** - Roles for broad access, permissions for granularity
- **CASL for frontend** - Declarative, isomorphic, battle-tested
- **Backend database + Policy as Code** - Roles in Auth0 (identity), permissions in DB (authorization), rules in code (policy)
- **Resource ownership** - Essential for "users see only their data" patterns

Key principle: **"Identity in token, authorization in policy"**

---

## Current Design Evaluation

### Strengths
- **BFF Pattern with Session Gateway** - Excellent security (JWTs never exposed to browser)
- **Auth0 Integration** - Solid identity provider choice
- **HttpOnly Secure Cookies** - Best practice for session management
- **Basic RBAC Infrastructure** - ProtectedRoute, useAuth hook, role helpers

### Gaps to Address
1. **Coarse-grained access control** - Only 3 static roles (USER, ADMIN, SUPER_ADMIN)
2. **No permission-level granularity** - Can't express "user can READ transactions but not DELETE"
3. **No centralized permission engine** - Authorization logic scattered across components
4. **Missing resource ownership model** - No "users can only access their own data" pattern
5. **No frontend permission library** - Manual role checks vs declarative authorization
6. **Incomplete backend enforcement patterns** - Documentation exists but implementation details needed

---

## Architecture Overview

```
Auth0 (Roles) → Session Gateway → Backend DB (Permissions) → CASL (Rules)
     ↓                                    ↓
  Identity                          Authorization
```

**Separation of concerns:**
- **Auth0**: Manages roles (USER, ADMIN, SUPER_ADMIN) - identity
- **Backend DB**: Stores permissions per role + custom user permissions - authorization
- **Code (CASL)**: Defines rules (how permissions map to abilities) - policy

---

## Phase 1: Permission Model Design

### 1.1 Define Permission Schema

```typescript
// Action + Subject pattern (CASL-compatible)
type Action = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subject = 'Transaction' | 'Currency' | 'User' | 'all';
type Permission = `${Action}:${Subject}`; // e.g., "read:Transaction"
```

### 1.2 Role-Permission Mapping

```typescript
const rolePermissions = {
  USER: [
    'create:Transaction', 'read:Transaction', 'update:Transaction', 'delete:Transaction', // own only
    'read:Currency'
  ],
  ADMIN: [
    'manage:Transaction',  // all users
    'manage:Currency',
    'read:User'
  ],
  SUPER_ADMIN: [
    'manage:all'  // everything
  ]
};
```

### 1.3 Ownership Rules (Resource-level)

- USER can only access `Transaction` where `transaction.userId === currentUser.id`
- ADMIN can access all `Transaction` records
- Ownership checked in CASL conditions

---

## Phase 2: Backend Implementation

### 2.1 Database Schema (PostgreSQL)

```sql
-- Permissions table
CREATE TABLE permissions (
  id SERIAL PRIMARY KEY,
  action VARCHAR(50) NOT NULL,     -- 'create', 'read', 'update', 'delete', 'manage'
  subject VARCHAR(100) NOT NULL,   -- 'Transaction', 'Currency', etc.
  conditions JSONB,                -- {'userId': '${user.id}'} for ownership
  inverted BOOLEAN DEFAULT false   -- for 'cannot' rules
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
  role VARCHAR(50) NOT NULL,       -- 'USER', 'ADMIN', 'SUPER_ADMIN'
  permission_id INT REFERENCES permissions(id),
  PRIMARY KEY (role, permission_id)
);

-- Optional: User-specific permission overrides
CREATE TABLE user_permissions (
  user_id VARCHAR(100) NOT NULL,   -- Auth0 sub
  permission_id INT REFERENCES permissions(id),
  granted BOOLEAN DEFAULT true,    -- can grant or revoke
  PRIMARY KEY (user_id, permission_id)
);
```

### 2.2 Permissions API Endpoint

```
GET /api/v1/permissions
```

Returns CASL-compatible ability rules based on user's roles:

```json
{
  "rules": [
    { "action": "read", "subject": "Transaction", "conditions": { "userId": "auth0|123" } },
    { "action": "create", "subject": "Transaction" },
    { "action": "read", "subject": "Currency" }
  ]
}
```

### 2.3 Backend Enforcement (Spring Security)

- Use `@PreAuthorize` with SpEL expressions
- Check ownership in service layer
- Never trust frontend - always validate server-side

---

## Phase 3: Frontend Implementation (CASL)

### 3.1 Install CASL

```bash
npm install @casl/ability @casl/react
```

### 3.2 Core Files to Create

| File | Purpose |
|------|---------|
| `src/lib/casl/ability.ts` | Define Ability class and AppAbility type |
| `src/lib/casl/can.ts` | Create Can component and useAbility hook |
| `src/api/permissions.ts` | Fetch permissions from backend |
| `src/features/auth/hooks/usePermissions.ts` | React Query hook for permissions |
| `src/features/auth/context/AbilityContext.tsx` | Provide ability to app |

### 3.3 Ability Definition

```typescript
// src/lib/casl/ability.ts
import { AbilityBuilder, PureAbility } from '@casl/ability';

type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'Transaction' | 'Currency' | 'User' | 'all';

export type AppAbility = PureAbility<[Actions, Subjects]>;

export function defineAbilityFor(rules: Rule[]) {
  return new PureAbility<[Actions, Subjects]>(rules);
}
```

### 3.4 Permission Hook

```typescript
// src/features/auth/hooks/usePermissions.ts
export function usePermissions() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['permissions', user?.sub],
    queryFn: () => fetchPermissions(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });
}
```

### 3.5 Usage in Components

```tsx
import { Can } from '@/lib/casl/can';

// Declarative
<Can I="delete" a="Transaction">
  <DeleteButton />
</Can>

// With conditions (ownership)
<Can I="update" this={transaction}>
  <EditButton />
</Can>

// Imperative
const ability = useAbility();
if (ability.can('create', 'Currency')) {
  // show create button
}
```

### 3.6 Protected Route Enhancement

```typescript
// Add permission-based protection
<ProtectedRoute requiredPermission={{ action: 'manage', subject: 'Currency' }}>
  <CurrencyAdminPage />
</ProtectedRoute>
```

---

## Phase 4: Auth0 Configuration

### 4.1 Keep Roles Simple

- USER (default)
- ADMIN
- SUPER_ADMIN

### 4.2 Auth0 Action (Post-Login)

```javascript
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://budgetanalyzer.com';
  const roles = event.authorization?.roles || ['USER'];

  // Only add roles to token (identity)
  // Permissions fetched from backend (authorization)
  api.accessToken.setCustomClaim(`${namespace}/roles`, roles);
  api.idToken.setCustomClaim(`${namespace}/roles`, roles);
};
```

---

## Phase 5: Testing Strategy

### 5.1 Frontend Tests

- Mock CASL abilities for different roles
- Test `Can` component rendering
- Test permission-based route protection
- Add MSW handlers for `/permissions` endpoint

### 5.2 Backend Tests

- Unit test permission resolution
- Integration test ownership checks
- Test role hierarchy inheritance

### 5.3 E2E Tests

- Login as USER → verify limited access
- Login as ADMIN → verify elevated access
- Test ownership (USER can't see other's transactions)

---

## Phase 6: Documentation Updates

- Update `docs/rbac-integration.md` with new permission model
- Create `docs/casl-usage.md` with frontend patterns
- Add permission matrix table
- Document how to add new permissions

---

## Implementation Order

1. **Backend first** - Design DB schema, create permissions API
2. **Frontend types** - Define CASL ability types
3. **Permission hook** - Fetch and cache permissions
4. **Ability context** - Provide to app
5. **Can component** - Create CASL React integration
6. **Migrate existing** - Replace `hasRole()` with `ability.can()`
7. **Add ownership** - Implement resource-level conditions
8. **Tests** - Unit and integration tests
9. **Documentation** - Update all docs

---

## Files to Create/Modify

### New Files

- `src/lib/casl/ability.ts`
- `src/lib/casl/can.ts`
- `src/api/permissions.ts`
- `src/features/auth/hooks/usePermissions.ts`
- `src/features/auth/context/AbilityContext.tsx`
- `src/types/permission.ts`
- `src/mocks/handlers/permissions.ts` (MSW)

### Modify

- `src/App.tsx` - Wrap with AbilityContext
- `src/features/admin/components/ProtectedRoute.tsx` - Add permission support
- `src/features/auth/hooks/useAuth.ts` - Integrate with usePermissions
- `docs/rbac-integration.md` - Update documentation

---

## Why This is a Good Reference Implementation

1. **Scalable** - Add permissions without role explosion
2. **Secure** - Backend enforcement, frontend is UX only
3. **Flexible** - Resource ownership + role hierarchy
4. **Testable** - CASL abilities easily mocked
5. **Maintainable** - Centralized policy definitions
6. **Isomorphic** - CASL rules work frontend + backend
7. **Industry standard** - CASL used by Auth0, Airbnb, others

---

## 2025 Best Practices Applied

Based on research from Bulletproof React, OWASP, and industry sources:

1. **Backend enforcement is NON-NEGOTIABLE** - Frontend checks are for UX only
2. **Hybrid RBAC + PBAC** - Roles for broad access, permissions for granularity
3. **Centralized policy engines** - CASL (frontend), Spring Security (backend)
4. **Identity in token, authorization in policy** - Separate concerns
5. **Principle of least privilege** - Grant minimum necessary access
6. **Policy as Code** - Version controlled, testable authorization rules
7. **Resource ownership** - Users can only access their own data by default

---

## References

- [Bulletproof React Security](https://github.com/alan2207/bulletproof-react/blob/master/docs/security.md)
- [CASL Documentation](https://casl.js.org/)
- [Auth0 RBAC](https://auth0.com/docs/manage-users/access-control/rbac)
- [FreeCodeCamp: Scalable Access Control](https://www.freecodecamp.org/news/how-to-build-scalable-access-control-for-your-web-app/)
- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
