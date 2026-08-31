import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RemoveViewTransactionsBar } from '@/features/views/components/RemoveViewTransactionsBar';

describe('RemoveViewTransactionsBar', () => {
  it('reports the exact count and invokes removal and clear actions', async () => {
    const onRemove = vi.fn();
    const onClearSelection = vi.fn();
    render(
      <RemoveViewTransactionsBar
        selectedCount={12}
        isVisible
        onRemove={onRemove}
        onClearSelection={onClearSelection}
      />,
    );

    expect(screen.getByText('12 transactions selected')).toBeInTheDocument();
    const removeButton = screen.getByRole('button', { name: 'Remove from view' });
    expect(removeButton).toHaveClass('border', 'border-input', 'bg-background');
    expect(removeButton).not.toHaveClass('bg-destructive', 'text-destructive');

    await userEvent.click(removeButton);
    await userEvent.click(screen.getByRole('button', { name: 'Clear selection' }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it('does not render while selection is empty', () => {
    render(
      <RemoveViewTransactionsBar
        selectedCount={0}
        isVisible={false}
        onRemove={vi.fn()}
        onClearSelection={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Remove from view' })).not.toBeInTheDocument();
  });
});
