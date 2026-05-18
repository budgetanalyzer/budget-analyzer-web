import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router';
import { BackButton } from '@/components/BackButton';

function DetailPage() {
  return (
    <div>
      <BackButton />
      <p>Detail page</p>
    </div>
  );
}

function ListPage() {
  return (
    <div>
      <Link to="/transactions/1">Open detail</Link>
      <p>List page</p>
    </div>
  );
}

function renderRoutes(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<ListPage />} />
        <Route path="/transactions/:id" element={<DetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BackButton', () => {
  it('does not render on a direct detail-page load without return context', () => {
    renderRoutes(['/transactions/1']);

    expect(screen.queryByRole('button', { name: /Back/ })).not.toBeInTheDocument();
  });

  it('uses explicit returnTo URL context when present', () => {
    renderRoutes(['/transactions/1?returnTo=%2F&breadcrumbLabel=Jan%202026']);

    fireEvent.click(screen.getByRole('button', { name: /Back/ }));

    expect(screen.getByText('List page')).toBeInTheDocument();
  });

  it('uses browser history after in-app navigation', () => {
    renderRoutes(['/']);

    fireEvent.click(screen.getByRole('link', { name: /Open detail/ }));
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));

    expect(screen.getByText('List page')).toBeInTheDocument();
  });
});
