import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { InactivityWarningModal } from '@/components/InactivityWarningModal';
import { submitLogoutForm } from '@/utils/logout';

vi.mock('@/utils/logout', () => ({
  submitLogoutForm: vi.fn(),
}));

describe('InactivityWarningModal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(submitLogoutForm).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when open is false', () => {
    render(
      <InactivityWarningModal
        open={false}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={null}
        canExtend
      />,
    );
    expect(screen.queryByText('Session Expiring')).not.toBeInTheDocument();
  });

  it('renders fallback text when expiresAt is null', () => {
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={null}
        canExtend
      />,
    );
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your session will expire soon due to inactivity. Click Continue to stay signed in.',
      ),
    ).toBeInTheDocument();
  });

  it('renders countdown when expiresAt is provided', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={now + 105}
        canExtend
      />,
    );
    expect(screen.getByText(/1:45/)).toBeInTheDocument();
  });

  it('submits logout when countdown reaches 0', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={now + 2}
        canExtend
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(submitLogoutForm).toHaveBeenCalledTimes(1);
  });

  it('does not submit logout on initial render before countdown initializes', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={now + 60}
        canExtend
      />,
    );

    expect(submitLogoutForm).not.toHaveBeenCalled();
  });

  it('does not submit logout while heartbeat is in flight', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={true}
        onContinue={vi.fn()}
        expiresAt={now + 2}
        canExtend
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(submitLogoutForm).not.toHaveBeenCalled();
  });

  it('calls onContinue when Continue button is clicked', () => {
    const onContinue = vi.fn();
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={onContinue}
        expiresAt={null}
        canExtend
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('disables Continue button when isSending is true', () => {
    render(
      <InactivityWarningModal
        open={true}
        isSending={true}
        onContinue={vi.fn()}
        expiresAt={null}
        canExtend
      />,
    );
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('replaces Continue with a sign-out action when the session cannot be extended', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={now + 105}
        canExtend={false}
      />,
    );

    expect(
      screen.getByText(
        'Your session has reached its maximum length and will end in 1:45. Sign in again to keep working.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sign out now' }));
    expect(submitLogoutForm).toHaveBeenCalledTimes(1);
  });

  it('submits logout when a session that cannot be extended reaches 0', () => {
    const now = Math.floor(Date.now() / 1000);
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={now + 2}
        canExtend={false}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(submitLogoutForm).toHaveBeenCalledTimes(1);
  });

  it('is not dismissable via Escape key', () => {
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={null}
        canExtend
      />,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });

  it('is not dismissable via backdrop click', () => {
    render(
      <InactivityWarningModal
        open={true}
        isSending={false}
        onContinue={vi.fn()}
        expiresAt={null}
        canExtend
      />,
    );
    // Click the backdrop (the element with aria-hidden)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });
});
