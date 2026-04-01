import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InactivityWarningModal } from '@/components/InactivityWarningModal';

describe('InactivityWarningModal', () => {
  it('does not render when open is false', () => {
    render(<InactivityWarningModal open={false} isSending={false} onContinue={vi.fn()} />);
    expect(screen.queryByText('Session Expiring')).not.toBeInTheDocument();
  });

  it('renders modal content when open is true', () => {
    render(<InactivityWarningModal open={true} isSending={false} onContinue={vi.fn()} />);
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your session will expire soon due to inactivity. Click Continue to stay signed in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('calls onContinue when Continue button is clicked', () => {
    const onContinue = vi.fn();
    render(<InactivityWarningModal open={true} isSending={false} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('disables Continue button when isSending is true', () => {
    render(<InactivityWarningModal open={true} isSending={true} onContinue={vi.fn()} />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeDisabled();
  });

  it('is not dismissable via Escape key', () => {
    render(<InactivityWarningModal open={true} isSending={false} onContinue={vi.fn()} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });

  it('is not dismissable via backdrop click', () => {
    render(<InactivityWarningModal open={true} isSending={false} onContinue={vi.fn()} />);
    // Click the backdrop (the element with aria-hidden)
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    expect(screen.getByText('Session Expiring')).toBeInTheDocument();
  });
});
