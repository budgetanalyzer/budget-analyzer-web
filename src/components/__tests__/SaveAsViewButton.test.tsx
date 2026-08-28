import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveAsViewButton } from '@/components/SaveAsViewButton';
import { renderWithProviders } from '@/testing/test-utils';

const modalProps = vi.hoisted(() => ({ current: undefined as unknown }));

vi.mock('@/components/CreateViewModal', () => ({
  CreateViewModal: (props: unknown) => {
    modalProps.current = props;
    return <div data-testid="create-modal" />;
  },
}));

describe('SaveAsViewButton', () => {
  beforeEach(() => {
    modalProps.current = undefined;
  });

  it('passes the exact visible ids and opens the modal', async () => {
    renderWithProviders(
      <SaveAsViewButton
        transactionIds={[9, 3]}
        isTransactionIdsReady
        label="Clone View"
        dialogTitle="Clone view"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clone View' }));

    expect(modalProps.current).toEqual(
      expect.objectContaining({
        open: true,
        transactionIds: [9, 3],
        isTransactionIdsReady: true,
        title: 'Clone view',
      }),
    );
  });

  it('disables creation while the visible id set is unresolved', () => {
    renderWithProviders(<SaveAsViewButton transactionIds={[1]} isTransactionIdsReady={false} />);
    expect(screen.getByRole('button', { name: 'Save as View' })).toBeDisabled();
  });
});
