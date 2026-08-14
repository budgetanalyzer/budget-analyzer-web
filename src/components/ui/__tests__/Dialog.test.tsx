import { useCallback, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/Dialog';

const BODY_SCROLL_LOCK_CLASS = 'overflow-hidden';

function ControlledDialog() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Controlled dialog</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

function OverlappingDialogs() {
  const [firstOpen, setFirstOpen] = useState(true);
  const [secondOpen, setSecondOpen] = useState(true);
  const closeFirst = useCallback(() => setFirstOpen(false), []);
  const closeSecond = useCallback(() => setSecondOpen(false), []);

  return (
    <>
      <Dialog open={firstOpen} onOpenChange={setFirstOpen}>
        <DialogContent>
          <DialogTitle>First dialog</DialogTitle>
          <button type="button" onClick={closeFirst}>
            Close first
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={secondOpen} onOpenChange={setSecondOpen}>
        <DialogContent>
          <DialogTitle>Second dialog</DialogTitle>
          <button type="button" onClick={closeSecond}>
            Close second
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

afterEach(() => {
  cleanup();
  document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
});

describe('Dialog body scroll lock', () => {
  it('uses a static body class without creating inline or runtime styles', () => {
    const styleElementCount = document.querySelectorAll('style').length;
    const { container, unmount } = render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent>
          <DialogTitle>Static styles</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);
    expect(document.body).not.toHaveAttribute('style');
    expect(container.querySelector('[style]')).not.toBeInTheDocument();
    expect(document.querySelectorAll('style')).toHaveLength(styleElementCount);

    unmount();

    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('preserves a pre-existing body scroll-lock class after unmount', () => {
    document.body.classList.add(BODY_SCROLL_LOCK_CLASS);
    const { unmount } = render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent>
          <DialogTitle>Pre-existing lock</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    unmount();

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('releases the body scroll lock when a controlled dialog closes', async () => {
    const user = userEvent.setup();
    render(<ControlledDialog />);

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Controlled dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('releases the body scroll lock when an open dialog unmounts', () => {
    const { unmount } = render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent>
          <DialogTitle>Unmounted dialog</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    unmount();

    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });

  it('retains the body class until all overlapping dialogs close', async () => {
    const user = userEvent.setup();
    render(<OverlappingDialogs />);

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    await user.click(screen.getByRole('button', { name: 'Close first' }));

    expect(screen.queryByText('First dialog')).not.toBeInTheDocument();
    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);

    await user.click(screen.getByRole('button', { name: 'Close second' }));

    expect(screen.queryByText('Second dialog')).not.toBeInTheDocument();
    expect(document.body).not.toHaveClass(BODY_SCROLL_LOCK_CLASS);
  });
});
