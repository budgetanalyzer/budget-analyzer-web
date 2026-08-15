import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DateRangeFilter } from '@/components/DateRangeFilter';

describe('DateRangeFilter', () => {
  it('relies on the native picker indicator for both date inputs', () => {
    const { container } = render(<DateRangeFilter from={null} to={null} onChange={vi.fn()} />);

    expect(container.querySelectorAll('input[type="date"]')).toHaveLength(2);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
