import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes, useLocation } from 'react-router';
import { http, HttpResponse } from 'msw';

import { UsersListPage } from '@/features/admin/users/pages/UsersListPage';
import { server } from '@/testing/mocks/server';
import { renderWithProviders } from '@/testing/test-utils';
import type { PageMetadata, PagedResponse } from '@/types/transactionSearch';
import type { UserSummary } from '@/types/user';

const adminUser: UserSummary = {
  id: 'usr_abc123',
  idpSub: 'auth0|67fd70c38eb9d43f1c93ea44',
  email: 'admin@example.com',
  displayName: 'Admin User',
  status: 'ACTIVE',
  roleIds: ['ADMIN'],
  createdAt: '2026-04-01T12:00:00Z',
  updatedAt: '2026-04-08T12:00:00Z',
};

function createMetadata(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    page: 0,
    size: 50,
    numberOfElements: 1,
    totalElements: 1,
    totalPages: 1,
    first: true,
    last: true,
    ...overrides,
  };
}

function createPage(
  content: UserSummary[],
  metadata: Partial<PageMetadata> = {},
): PagedResponse<UserSummary> {
  return {
    content,
    metadata: createMetadata({
      numberOfElements: content.length,
      totalElements: content.length,
      totalPages: content.length === 0 ? 0 : 1,
      last: true,
      ...metadata,
    }),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPage(initialPath = '/admin/users') {
  return renderWithProviders(
    <Routes>
      <Route
        path="/admin/users"
        element={
          <>
            <LocationProbe />
            <UsersListPage />
          </>
        }
      />
    </Routes>,
    { initialEntries: [initialPath] },
  );
}

describe('UsersListPage', () => {
  it('renders successful user search results', async () => {
    renderPage();

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('ADMIN')).toBeInTheDocument();
    expect(screen.getByText('Showing 1–3 of 3 users')).toBeInTheDocument();
  });

  it('submits filters, serializes them to the URL, and requests the parsed API query', async () => {
    const user = userEvent.setup();
    let latestRequestUrl: URL | null = null;

    server.use(
      http.get('/api/v1/users', ({ request }) => {
        latestRequestUrl = new URL(request.url);
        return HttpResponse.json(createPage([adminUser]));
      }),
    );

    renderPage();

    await screen.findByText('admin@example.com');

    await user.type(screen.getByPlaceholderText('Search email'), 'admin@example.com');
    await user.click(screen.getByRole('button', { name: /^all$/i }));
    await user.click(screen.getByRole('button', { name: 'Active' }));
    await user.click(screen.getByRole('button', { name: /More filters/i }));
    await user.type(screen.getByPlaceholderText(/display name/i), 'Admin User');
    await user.type(screen.getByPlaceholderText(/IdP subject/i), 'auth0|admin');
    await user.type(screen.getByPlaceholderText('From date'), '2026-04-01');
    await user.type(screen.getByPlaceholderText('To date'), '2026-04-30');
    await user.click(screen.getByRole('button', { name: /^Search$/ }));

    await waitFor(() => {
      const params = new URLSearchParams(
        screen.getByTestId('location').textContent?.split('?')[1] ?? '',
      );
      expect(params.get('q')).toBe('admin@example.com');
      expect(params.get('name')).toBe('Admin User');
      expect(params.get('idpSub')).toBe('auth0|admin');
      expect(params.get('status')).toBe('ACTIVE');
      expect(params.get('createdAfter')).toBe('2026-04-01T07:00:00.000Z');
      expect(params.get('createdBefore')).toBe('2026-05-01T06:59:59.999Z');
    });

    await waitFor(() => {
      expect(latestRequestUrl?.searchParams.get('email')).toBe('admin@example.com');
      expect(latestRequestUrl?.searchParams.get('displayName')).toBe('Admin User');
      expect(latestRequestUrl?.searchParams.get('idpSub')).toBe('auth0|admin');
      expect(latestRequestUrl?.searchParams.get('status')).toBe('ACTIVE');
      expect(latestRequestUrl?.searchParams.get('createdAfter')).toBe('2026-04-01T07:00:00.000Z');
      expect(latestRequestUrl?.searchParams.get('createdBefore')).toBe('2026-05-01T06:59:59.999Z');
    });
  });

  it('parses URL state into visible filters and defaulted API request params', async () => {
    let requestUrl: URL | null = null;

    server.use(
      http.get('/api/v1/users', ({ request }) => {
        requestUrl = new URL(request.url);
        return HttpResponse.json(createPage([adminUser]));
      }),
    );

    renderPage(
      '/admin/users?q=admin@example.com&name=Admin%20User&status=active&page=-1&size=13&sort=notAllowed,DESC',
    );

    expect(await screen.findByDisplayValue('admin@example.com')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Admin User')).toBeInTheDocument();

    await waitFor(() => {
      expect(requestUrl?.searchParams.get('email')).toBe('admin@example.com');
      expect(requestUrl?.searchParams.get('displayName')).toBe('Admin User');
      expect(requestUrl?.searchParams.get('status')).toBe('ACTIVE');
      expect(requestUrl?.searchParams.get('page')).toBe('0');
      expect(requestUrl?.searchParams.get('size')).toBe('50');
      expect(requestUrl?.searchParams.getAll('sort')).toEqual(['createdAt,DESC', 'id,DESC']);
    });
  });

  it('renders an empty user result state', async () => {
    server.use(http.get('/api/v1/users', () => HttpResponse.json(createPage([]))));

    renderPage();

    expect(await screen.findByText('No users found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filters to broaden the search')).toBeInTheDocument();
  });

  it('renders API errors from user search', async () => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json(
          {
            type: 'APPLICATION_ERROR',
            code: 'USER_SEARCH_FAILED',
            message: 'User search failed',
          },
          { status: 500 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByText('User search failed', {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Error code: USER_SEARCH_FAILED')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('serializes sorting changes to URL state', async () => {
    const user = userEvent.setup();

    server.use(
      http.get('/api/v1/users', ({ request }) => {
        const url = new URL(request.url);
        const sort = url.searchParams.getAll('sort');
        return HttpResponse.json(
          createPage(
            [
              {
                ...adminUser,
                email: sort.includes('email,DESC') ? 'sorted-admin@example.com' : adminUser.email,
              },
            ],
            { totalElements: 1 },
          ),
        );
      }),
    );

    renderPage();

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Email/ }));

    await waitFor(() => {
      const params = new URLSearchParams(
        screen.getByTestId('location').textContent?.split('?')[1] ?? '',
      );
      expect(params.getAll('sort')).toEqual(['email,DESC', 'id,DESC']);
    });
    expect(await screen.findByText('sorted-admin@example.com')).toBeInTheDocument();
  });
});
