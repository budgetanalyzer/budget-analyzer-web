import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { UserSearchTable } from '@/features/admin/users/components/UserSearchTable';
import type { UserSummary } from '@/types/user';

describe('UserSearchTable', () => {
  it('renders ISO createdAt values with the local calendar date helper', () => {
    const users: UserSummary[] = [
      {
        id: 'usr_1',
        idpSub: 'auth0|usr_1',
        email: 'user@example.com',
        displayName: 'Example User',
        status: 'ACTIVE',
        roleIds: ['ADMIN'],
        createdAt: '2026-01-15T01:30:00Z',
        updatedAt: '2026-01-15T01:30:00Z',
      },
    ];

    render(
      <MemoryRouter>
        <UserSearchTable
          data={users}
          metadata={{
            page: 0,
            size: 50,
            numberOfElements: 1,
            totalElements: 1,
            totalPages: 1,
            first: true,
            last: true,
          }}
          sort={['createdAt,DESC', 'id,DESC']}
          isLoading={false}
          isFetching={false}
          onPageChange={() => {}}
          onSizeChange={() => {}}
          onSortChange={() => {}}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Jan 14, 2026')).toBeInTheDocument();
  });
});
