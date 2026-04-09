// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';
import type { UserDetail, UserReference } from '@/types/user';

function toUserReference(user: Pick<UserDetail, 'id' | 'displayName' | 'email'>): UserReference {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  };
}

function createMockUsers(): Record<string, UserDetail> {
  const adminUser: UserDetail = {
    id: 'usr_abc123',
    idpSub: 'auth0|67fd70c38eb9d43f1c93ea44',
    email: 'admin@example.com',
    displayName: 'Admin User',
    status: 'ACTIVE',
    roleIds: ['ADMIN'],
    createdAt: '2026-04-01T12:00:00Z',
    updatedAt: '2026-04-08T12:00:00Z',
  };

  return {
    usr_abc123: adminUser,
    usr_def456: {
      id: 'usr_def456',
      idpSub: 'auth0|5f91e3d4a2c1b8f0e6d72345',
      email: 'user@example.com',
      displayName: 'Regular User',
      status: 'ACTIVE',
      roleIds: [],
      createdAt: '2026-04-02T09:15:00Z',
      updatedAt: '2026-04-07T14:20:00Z',
    },
    usr_deactivated: {
      id: 'usr_deactivated',
      idpSub: 'auth0|1a2b3c4d5e6f7890abcdef12',
      email: 'former@example.com',
      displayName: 'Former User',
      status: 'DEACTIVATED',
      roleIds: [],
      createdAt: '2026-03-15T08:00:00Z',
      updatedAt: '2026-04-05T16:45:00Z',
      deactivatedAt: '2026-04-05T16:45:00Z',
      deactivatedBy: toUserReference(adminUser),
    },
  };
}

let mockUsers = createMockUsers();

export function resetMockHandlerState() {
  mockUsers = createMockUsers();
}

export const handlers = [
  http.get('/auth/v1/user', () => {
    return HttpResponse.json({
      sub: 'mock-user-id',
      email: 'admin@example.com',
      name: 'Admin User',
      authenticated: true,
      roles: ['ADMIN'],
      permissions: [
        'transactions:read',
        'transactions:read:any',
        'transactions:write',
        'transactions:write:any',
        'transactions:delete',
        'transactions:delete:any',
        'currencies:read',
        'currencies:write',
        'statementformats:read',
        'statementformats:write',
        'users:read',
        'users:write',
      ],
    });
  }),
  http.get('/api/v1/transactions', () => {
    return HttpResponse.json([
      {
        id: '1',
        accountId: 'acc1',
        bankName: 'Test Bank',
        date: '2024-01-01',
        amount: 100.5,
        type: 'debit',
        description: 'Test transaction',
      },
    ]);
  }),
  http.delete('/api/v1/transactions/:id', () => {
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('/api/v1/transactions/search', () => {
    return HttpResponse.json({
      content: [
        {
          id: 1,
          ownerId: 'usr_test123',
          accountId: 'checking-3223',
          bankName: 'Capital One',
          date: '2025-10-14',
          currencyIsoCode: 'USD',
          amount: 100.5,
          type: 'DEBIT',
          description: 'Grocery shopping',
          createdAt: '2025-10-14T10:30:00Z',
          updatedAt: '2025-10-14T10:30:00Z',
        },
      ],
      metadata: {
        page: 0,
        size: 50,
        numberOfElements: 1,
        totalElements: 1,
        totalPages: 1,
        first: true,
        last: true,
      },
    });
  }),
  http.get('/auth/v1/session', () => {
    return HttpResponse.json({
      userId: 'mock-user-id',
      roles: ['ADMIN'],
      expiresAt: Math.floor(Date.now() / 1000) + 1800,
    });
  }),
  http.get('/api/v1/users', () => {
    const users = Object.values(mockUsers);

    return HttpResponse.json({
      content: users.map((user) => ({
        id: user.id,
        idpSub: user.idpSub,
        email: user.email,
        displayName: user.displayName,
        status: user.status,
        roleIds: user.roleIds,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        deactivatedAt: user.deactivatedAt,
      })),
      metadata: {
        page: 0,
        size: 50,
        numberOfElements: users.length,
        totalElements: users.length,
        totalPages: 1,
        first: true,
        last: true,
      },
    });
  }),
  http.get('/api/v1/users/:id', ({ params }) => {
    const { id } = params;

    if (!id || !mockUsers[String(id)]) {
      return HttpResponse.json({ type: 'NOT_FOUND', message: 'User not found' }, { status: 404 });
    }

    return HttpResponse.json(mockUsers[String(id)]);
  }),
  http.post('/api/v1/users/:id/deactivate', ({ params }) => {
    const { id } = params;

    if (!id || !mockUsers[String(id)]) {
      return HttpResponse.json({ type: 'NOT_FOUND', message: 'User not found' }, { status: 404 });
    }

    const user = mockUsers[String(id)];
    const rolesRemoved = user.roleIds.length;

    mockUsers[String(id)] = {
      ...user,
      status: 'DEACTIVATED',
      roleIds: [],
      updatedAt: '2026-04-09T12:00:00Z',
      deactivatedAt: user.deactivatedAt ?? '2026-04-09T12:00:00Z',
      deactivatedBy: user.deactivatedBy ?? toUserReference(mockUsers.usr_abc123),
    };

    return HttpResponse.json({
      userId: String(id),
      status: 'DEACTIVATED',
      rolesRemoved: user.status === 'DEACTIVATED' ? 0 : rolesRemoved,
      sessionsRevoked: true,
    });
  }),
];
