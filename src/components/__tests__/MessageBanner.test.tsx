import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MessageBanner } from '@/components/MessageBanner';

describe('MessageBanner', () => {
  it('renders an atomic alert with the visible error message', () => {
    render(<MessageBanner type="error" message="Unable to save the view." onClose={vi.fn()} />);

    const alert = screen.getByRole('alert');

    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert).toHaveTextContent('Unable to save the view.');
  });

  it.each(['success', 'warning'] as const)('renders %s messages as an atomic status', (type) => {
    const message = `${type} message`;

    render(<MessageBanner type={type} message={message} onClose={vi.fn()} />);

    const status = screen.getByRole('status');

    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(status).toHaveTextContent(message);
  });

  it('provides an accessible dismiss control that invokes onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<MessageBanner type="error" message="Unable to save the view." onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders an optional action outside the atomic message and invokes it independently', async () => {
    const onAction = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <MessageBanner
        type="error"
        message="Some sessions may still be active."
        onClose={onClose}
        action={{ label: 'Retry session revocation', onClick: onAction }}
      />,
    );

    const alert = screen.getByRole('alert');
    const action = screen.getByRole('button', { name: 'Retry session revocation' });

    expect(alert).toHaveTextContent('Some sessions may still be active.');
    expect(alert).not.toHaveTextContent('Retry session revocation');

    await user.click(action);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render an action when one is not supplied', () => {
    render(<MessageBanner type="error" message="Unable to save the view." onClose={vi.fn()} />);

    expect(
      screen.queryByRole('button', { name: 'Retry session revocation' }),
    ).not.toBeInTheDocument();
  });

  it('does not submit an owning form when the action is used', async () => {
    const onAction = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <MessageBanner
          type="error"
          message="Some sessions may still be active."
          onClose={vi.fn()}
          action={{ label: 'Retry session revocation', onClick: onAction }}
        />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Retry session revocation' }));

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit an owning form when dismissed', async () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <MessageBanner type="error" message="Unable to save the view." onClose={onClose} />
      </form>,
    );

    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
