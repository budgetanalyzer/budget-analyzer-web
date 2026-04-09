import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UserSearchFiltersPanel } from '@/features/admin/users/components/UserSearchFiltersPanel';
import type { UserSearchQuery } from '@/types/user';

function createQuery(overrides: Partial<UserSearchQuery> = {}): UserSearchQuery {
  return {
    page: 0,
    size: 50,
    sort: ['createdAt,DESC', 'id,DESC'],
    ...overrides,
  };
}

describe('UserSearchFiltersPanel', () => {
  it('hydrates date inputs from ISO timestamp filters in local timezone', () => {
    const { container } = render(
      <UserSearchFiltersPanel
        query={createQuery({
          createdAfter: '2026-01-15T08:00:00.000Z',
          createdBefore: '2026-01-16T07:59:59.999Z',
        })}
        onChange={() => {}}
        onClear={() => {}}
      />,
    );

    const inputs = Array.from(
      container.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[];

    expect(inputs).toHaveLength(2);
    expect(inputs[0].value).toBe('2026-01-15');
    expect(inputs[1].value).toBe('2026-01-15');
  });

  it('submits selected local dates as local-day ISO timestamp bounds', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <UserSearchFiltersPanel query={createQuery()} onChange={handleChange} onClear={() => {}} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /More filters/i }));

    const inputs = Array.from(
      container.querySelectorAll('input[type="date"]'),
    ) as HTMLInputElement[];
    fireEvent.change(inputs[0], { target: { value: '2026-01-15' } });
    fireEvent.change(inputs[1], { target: { value: '2026-01-15' } });
    fireEvent.click(screen.getByRole('button', { name: /^Search$/ }));

    expect(handleChange).toHaveBeenCalledWith({
      email: undefined,
      displayName: undefined,
      id: undefined,
      idpSub: undefined,
      status: undefined,
      createdAfter: '2026-01-15T08:00:00.000Z',
      createdBefore: '2026-01-16T07:59:59.999Z',
    });
  });
});
