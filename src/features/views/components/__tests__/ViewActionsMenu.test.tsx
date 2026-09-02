import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePermission } from '@/features/auth/hooks/usePermission';
import { ViewActionsMenu } from '@/features/views/components/ViewActionsMenu';

vi.mock('@/features/auth/hooks/usePermission');

const mockUsePermission = vi.mocked(usePermission);

describe('ViewActionsMenu', () => {
  beforeEach(() => {
    mockUsePermission.mockReset();
  });

  it('uses an accessible icon-only trigger and closes before dispatching each action', async () => {
    mockUsePermission.mockReturnValue(true);
    const onRenameClick = vi.fn();
    const onDuplicateClick = vi.fn();
    const onDeleteClick = vi.fn();
    const user = userEvent.setup();
    render(
      <ViewActionsMenu
        onRenameClick={onRenameClick}
        onDuplicateClick={onDuplicateClick}
        onDeleteClick={onDeleteClick}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'View actions' });
    expect(trigger).toHaveAttribute('aria-label', 'View actions');
    expect(trigger).toHaveTextContent('');

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Rename view' }));
    expect(onRenameClick).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate view' }));
    expect(onDuplicateClick).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Delete view' }));
    expect(onDeleteClick).toHaveBeenCalledOnce();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('shows rename and duplicate without delete for write-only access', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:write');
    const user = userEvent.setup();
    render(
      <ViewActionsMenu
        onRenameClick={vi.fn()}
        onDuplicateClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View actions' }));

    expect(screen.getByRole('menuitem', { name: 'Rename view' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Duplicate view' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Delete view' })).not.toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('shows only delete for delete-only access', async () => {
    mockUsePermission.mockImplementation((permission) => permission === 'views:delete');
    const user = userEvent.setup();
    render(
      <ViewActionsMenu
        onRenameClick={vi.fn()}
        onDuplicateClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View actions' }));

    expect(screen.queryByRole('menuitem', { name: 'Rename view' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Duplicate view' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete view' })).toBeInTheDocument();
    expect(screen.queryByRole('separator')).not.toBeInTheDocument();
  });

  it('orders destructive delete after the write actions and separator', async () => {
    mockUsePermission.mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <ViewActionsMenu
        onRenameClick={vi.fn()}
        onDuplicateClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'View actions' }));

    const menu = screen.getByRole('menu');
    const items = within(menu).getAllByRole('menuitem');
    const separator = within(menu).getByRole('separator');
    expect(items.map((item) => item.textContent)).toEqual([
      'Rename view',
      'Duplicate view',
      'Delete view',
    ]);
    expect(separator.previousElementSibling).toBe(items[1]);
    expect(separator.nextElementSibling).toBe(items[2]);
    expect(items[2]).toHaveAttribute('data-destructive', 'true');
  });

  it('does not render when all action permissions are denied', () => {
    mockUsePermission.mockReturnValue(false);
    render(
      <ViewActionsMenu
        onRenameClick={vi.fn()}
        onDuplicateClick={vi.fn()}
        onDeleteClick={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'View actions' })).not.toBeInTheDocument();
  });
});
