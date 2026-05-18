import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ViewCriteriaSummary } from '@/features/views/components/ViewCriteriaSummary';

describe('ViewCriteriaSummary', () => {
  it('renders dateFrom, dateTo, and transaction type criteria', () => {
    render(
      <ViewCriteriaSummary
        criteria={{ dateFrom: '2026-01-01', dateTo: '2026-01-31', type: 'DEBIT' }}
        excludedCount={0}
        openEnded={false}
      />,
    );

    expect(screen.getByText('Jan 1, 2026 - Jan 31, 2026')).toBeInTheDocument();
    expect(screen.getByText('Debit')).toBeInTheDocument();
  });

  it('calls the restore handler from the excluded badge', () => {
    const handleRestoreExcludedClick = vi.fn();

    render(
      <ViewCriteriaSummary
        criteria={{}}
        excludedCount={33}
        openEnded={false}
        onRestoreExcludedClick={handleRestoreExcludedClick}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Restore 33 excluded transactions' }));

    expect(handleRestoreExcludedClick).toHaveBeenCalledTimes(1);
  });
});
