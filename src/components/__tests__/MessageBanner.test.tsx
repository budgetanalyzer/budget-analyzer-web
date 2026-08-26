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
