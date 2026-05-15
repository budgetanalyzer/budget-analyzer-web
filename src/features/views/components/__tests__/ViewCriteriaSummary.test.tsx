import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
