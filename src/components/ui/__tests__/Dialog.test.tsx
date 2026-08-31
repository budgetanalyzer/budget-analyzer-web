import { StrictMode, useCallback, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogPortalContainerProvider,
  DialogTitle,
} from '@/components/ui/Dialog';

const BODY_SCROLL_LOCK_CLASS = 'overflow-hidden';

interface BasicDialogProps {
  dismissible?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}

function BasicDialog({ dismissible, onOpenChange, open = true }: BasicDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dismissible={dismissible}>
        <DialogTitle>Account details</DialogTitle>
        <DialogDescription>Review this account before continuing.</DialogDescription>
        <button type="button">Continue</button>
      </DialogContent>
    </Dialog>
  );
}

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

function NonDismissibleCompletionDialog() {
  const [open, setOpen] = useState(true);
  const handleComplete = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent dismissible={false}>
        <DialogTitle>Saving changes</DialogTitle>
        <button type="button" onClick={handleComplete}>
          Complete request
        </button>
      </DialogContent>
    </Dialog>
  );
}

function RestorableDialog() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <button type="button" onClick={handleOpen}>
        Open dialog
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Restorable dialog</DialogTitle>
          <input aria-label="Dialog name" autoFocus />
        </DialogContent>
      </Dialog>
    </>
  );
}

function ConditionallyMountedRestorableDialog() {
  const [open, setOpen] = useState(false);
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <>
      <button type="button" onClick={handleOpen}>
        Open conditional dialog
      </button>
      {open && (
        <Dialog open onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Conditionally mounted dialog</DialogTitle>
            <input aria-label="Conditional dialog name" autoFocus />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ScopedPortalDialog() {
  const [open, setOpen] = useState(false);
  const portalContainerRef = useRef<HTMLDivElement>(null);
  const handleOpen = useCallback(() => setOpen(true), []);

  return (
    <DialogPortalContainerProvider containerRef={portalContainerRef}>
      <div data-testid="dialog-scope">
        <button type="button" onClick={handleOpen}>
          Open scoped dialog
        </button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Scoped dialog</DialogTitle>
          </DialogContent>
        </Dialog>
        <div ref={portalContainerRef} data-testid="dialog-portal-container" />
      </div>
    </DialogPortalContainerProvider>
  );
}

function OpeningOrderDialogs() {
  const [warningOpen, setWarningOpen] = useState(false);
  const handleOpenWarning = useCallback(() => setWarningOpen(true), []);

  return (
    <>
      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent dismissible={false}>
          <DialogTitle>Inactivity warning</DialogTitle>
          <button type="button">Continue session</button>
          <button type="button">Sign out</button>
        </DialogContent>
      </Dialog>
      <Dialog open>
        <DialogContent dismissible={false}>
          <DialogTitle>Application dialog</DialogTitle>
          <button type="button" onClick={handleOpenWarning}>
            Show warning
          </button>
          <button type="button">Application action</button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OverlappingDialogs({
  onFirstOpenChange,
  onSecondOpenChange,
}: {
  onFirstOpenChange?: (open: boolean) => void;
  onSecondOpenChange?: (open: boolean) => void;
}) {
  const [firstOpen, setFirstOpen] = useState(true);
  const [secondOpen, setSecondOpen] = useState(true);
  const closeFirst = useCallback(() => setFirstOpen(false), []);
  const closeSecond = useCallback(() => setSecondOpen(false), []);

  const handleFirstOpenChange = useCallback(
    (open: boolean) => {
      onFirstOpenChange?.(open);
      setFirstOpen(open);
    },
    [onFirstOpenChange],
  );
  const handleSecondOpenChange = useCallback(
    (open: boolean) => {
      onSecondOpenChange?.(open);
      setSecondOpen(open);
    },
    [onSecondOpenChange],
  );

  return (
    <>
      <Dialog open={firstOpen} onOpenChange={handleFirstOpenChange}>
        <DialogContent>
          <DialogTitle>First dialog</DialogTitle>
          <DialogDescription>First description</DialogDescription>
          <button type="button" onClick={closeFirst}>
            Close first
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={secondOpen} onOpenChange={handleSecondOpenChange}>
        <DialogContent>
          <DialogTitle>Second dialog</DialogTitle>
          <DialogDescription>Second description</DialogDescription>
          <button type="button" onClick={closeSecond}>
            Close second
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getBackdrop(dialog: HTMLElement): HTMLElement {
  const backdrop = dialog.previousElementSibling;

  if (!(backdrop instanceof HTMLElement)) {
    throw new Error('Expected a dialog backdrop');
  }

  return backdrop;
}

afterEach(() => {
  cleanup();
  document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
});

describe('Dialog accessibility', () => {
  it('associates the modal dialog with its title and description', () => {
    render(<BasicDialog />);

    const dialog = screen.getByRole('dialog', { name: 'Account details' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Review this account before continuing.');
    expect(dialog).toHaveAttribute(
      'aria-labelledby',
      screen.getByRole('heading', { name: 'Account details' }).id,
    );
    expect(dialog).toHaveAttribute(
      'aria-describedby',
      screen.getByText('Review this account before continuing.').id,
    );
  });

  it('omits a description association when no description is rendered', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title only</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog', { name: 'Title only' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });

  it('keeps generated associations unique across dialog instances', () => {
    render(<OverlappingDialogs />);

    const firstDialog = screen.getByRole('dialog', { name: 'First dialog' });
    const secondDialog = screen.getByRole('dialog', { name: 'Second dialog' });

    expect(firstDialog.getAttribute('aria-labelledby')).not.toBe(
      secondDialog.getAttribute('aria-labelledby'),
    );
    expect(firstDialog).toHaveAccessibleDescription('First description');
    expect(secondDialog).toHaveAccessibleDescription('Second description');
  });
});

describe('Dialog portal container', () => {
  it('portals into a registered container', async () => {
    const user = userEvent.setup();
    render(<ScopedPortalDialog />);

    await user.click(screen.getByRole('button', { name: 'Open scoped dialog' }));

    const dialog = screen.getByRole('dialog', { name: 'Scoped dialog' });
    expect(screen.getByTestId('dialog-portal-container')).toContainElement(dialog);
    expect(screen.getByTestId('dialog-scope')).toContainElement(dialog);
  });

  it('portals to the document body without a registered container', () => {
    render(<BasicDialog />);

    const portalLayer = screen.getByRole('dialog', { name: 'Account details' }).parentElement;
    expect(portalLayer?.parentElement).toBe(document.body);
  });
});

describe('Dialog dismissal', () => {
  it('requests dismissal from the close button', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BasicDialog onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requests dismissal from the backdrop', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BasicDialog onOpenChange={onOpenChange} />);

    await user.click(getBackdrop(screen.getByRole('dialog')));

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('requests dismissal from Escape', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BasicDialog onOpenChange={onOpenChange} />);

    await user.keyboard('{Escape}');

    expect(onOpenChange).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('suppresses every shared dismissal mechanism when dismissal is disabled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<BasicDialog dismissible={false} onOpenChange={onOpenChange} />);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();

    await user.click(getBackdrop(dialog));
    await user.keyboard('{Escape}');

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(dialog).toBeInTheDocument();
  });

  it('allows an owner to close a non-dismissible dialog programmatically', async () => {
    const user = userEvent.setup();
    render(<NonDismissibleCompletionDialog />);

    await user.click(screen.getByRole('button', { name: 'Complete request' }));

    expect(screen.queryByRole('dialog', { name: 'Saving changes' })).not.toBeInTheDocument();
  });

  it('removes its keyboard listener when the dialog unmounts', () => {
    const onOpenChange = vi.fn();
    const { unmount } = render(<BasicDialog onOpenChange={onOpenChange} />);

    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('gives only the topmost dialog ownership of Escape', async () => {
    const user = userEvent.setup();
    const onFirstOpenChange = vi.fn();
    const onSecondOpenChange = vi.fn();
    render(
      <OverlappingDialogs
        onFirstOpenChange={onFirstOpenChange}
        onSecondOpenChange={onSecondOpenChange}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onFirstOpenChange).not.toHaveBeenCalled();
    expect(onSecondOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog', { name: 'First dialog' })).toBeInTheDocument();
  });

  it('keeps opening-order rendering aligned with keyboard ownership', async () => {
    const user = userEvent.setup();
    render(<OpeningOrderDialogs />);

    await user.click(screen.getByRole('button', { name: 'Show warning' }));

    const applicationDialog = screen.getByRole('dialog', { name: 'Application dialog' });
    const warningDialog = screen.getByRole('dialog', { name: 'Inactivity warning' });

    expect(
      applicationDialog.compareDocumentPosition(warningDialog) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    screen.getByRole('button', { name: 'Sign out' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'Continue session' })).toHaveFocus();
  });
});

describe('Dialog focus lifecycle', () => {
  it('honors an intentional autofocus target', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit name</DialogTitle>
          <button type="button">Before input</button>
          <input aria-label="Name" autoFocus />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
  });

  it('focuses the first focusable element when no autofocus target exists', () => {
    render(
      <Dialog open>
        <DialogContent dismissible={false}>
          <DialogTitle>Choose an action</DialogTitle>
          <button type="button">First action</button>
          <button type="button">Second action</button>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('focuses the dialog container when it has no focusable descendants', () => {
    render(
      <Dialog open>
        <DialogContent dismissible={false}>
          <DialogTitle>Informational dialog</DialogTitle>
          <p>No available actions</p>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('wraps forward Tab from the last focusable element to the first', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent dismissible={false}>
          <DialogTitle>Forward focus</DialogTitle>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </DialogContent>
      </Dialog>,
    );

    screen.getByRole('button', { name: 'Last action' }).focus();
    await user.tab();

    expect(screen.getByRole('button', { name: 'First action' })).toHaveFocus();
  });

  it('wraps reverse Tab from the first focusable element to the last', async () => {
    const user = userEvent.setup();
    render(
      <Dialog open>
        <DialogContent dismissible={false}>
          <DialogTitle>Reverse focus</DialogTitle>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </DialogContent>
      </Dialog>,
    );

    screen.getByRole('button', { name: 'First action' }).focus();
    await user.tab({ shift: true });

    expect(screen.getByRole('button', { name: 'Last action' })).toHaveFocus();
  });

  it('restores focus captured before a descendant autofocuses', async () => {
    const user = userEvent.setup();
    render(<RestorableDialog />);

    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(trigger);
    expect(screen.getByRole('textbox', { name: 'Dialog name' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(trigger).toHaveFocus();
  });

  it('restores focus when mounted already open with an autofocus target', async () => {
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ConditionallyMountedRestorableDialog />
      </StrictMode>,
    );

    const trigger = screen.getByRole('button', { name: 'Open conditional dialog' });
    await user.click(trigger);

    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(trigger).toHaveFocus();
  });
});

describe('Dialog layout', () => {
  it('provides shared content separation and button gaps at every breakpoint', () => {
    render(
      <DialogFooter>
        <button type="button">Cancel</button>
        <button type="button">Confirm</button>
      </DialogFooter>,
    );

    const footer = screen.getByRole('button', { name: 'Cancel' }).parentElement;

    expect(footer).toHaveClass('mt-6', 'gap-2', 'flex-col-reverse', 'sm:flex-row');
  });
});

describe('Dialog body scroll lock', () => {
  it('uses a static body class without writing document.body.style', () => {
    const { unmount } = render(
      <Dialog open onOpenChange={vi.fn()}>
        <DialogContent>
          <DialogTitle>Static styles</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(document.body).toHaveClass(BODY_SCROLL_LOCK_CLASS);
    expect(document.body).not.toHaveAttribute('style');

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
