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

  it('passes the exact visible ids and readiness in create mode', async () => {
    renderWithProviders(<SaveAsViewButton transactionIds={[9, 3]} isTransactionIdsReady />);

    await userEvent.click(screen.getByRole('button', { name: 'Save as View' }));

    expect(modalProps.current).toEqual(
      expect.objectContaining({
        open: true,
        transactionIds: [9, 3],
        isTransactionIdsReady: true,
        title: 'Save as view',
      }),
    );
    expect(modalProps.current).not.toHaveProperty('sourceViewId');
  });

  it('passes only the source view identity in clone mode', async () => {
    renderWithProviders(
      <SaveAsViewButton sourceViewId="source-view" label="Clone View" dialogTitle="Clone view" />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Clone View' }));

    expect(modalProps.current).toEqual(
      expect.objectContaining({
        open: true,
        sourceViewId: 'source-view',
        title: 'Clone view',
      }),
    );
    expect(modalProps.current).not.toHaveProperty('transactionIds');
    expect(modalProps.current).not.toHaveProperty('isTransactionIdsReady');
  });

  it('disables creation while the visible id set is unresolved', () => {
    renderWithProviders(<SaveAsViewButton transactionIds={[1]} isTransactionIdsReady={false} />);
    expect(screen.getByRole('button', { name: 'Save as View' })).toBeDisabled();
  });

  it('keeps clone mode available without transaction readiness', () => {
    renderWithProviders(<SaveAsViewButton sourceViewId="source-view" label="Clone View" />);
    expect(screen.getByRole('button', { name: 'Clone View' })).toBeEnabled();
  });
});
