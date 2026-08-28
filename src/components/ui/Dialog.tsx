// src/components/ui/Dialog.tsx
import * as React from 'react';
import { cn } from '@/utils/cn';
import { X } from 'lucide-react';
import { acquireBodyScrollLock } from '@/utils/bodyScrollLock';

interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

interface DialogContentContextValue {
  titleId: string;
  descriptionId: string;
  setTitleElement: (element: HTMLHeadingElement | null) => void;
  setDescriptionElement: (element: HTMLParagraphElement | null) => void;
}

const DialogContext = React.createContext<DialogContextValue | undefined>(undefined);
const DialogContentContext = React.createContext<DialogContentContextValue | undefined>(undefined);

const FOCUSABLE_ELEMENT_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const openDialogStack: HTMLElement[] = [];

const useDialog = () => {
  const context = React.useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within Dialog');
  }
  return context;
};

const useDialogContent = () => {
  const context = React.useContext(DialogContentContext);
  if (!context) {
    throw new Error('DialogTitle and DialogDescription must be used within DialogContent');
  }
  return context;
};

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR)).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.hidden &&
      element.getAttribute('aria-hidden') !== 'true' &&
      !element.closest('[inert]'),
  );
}

function removeOpenDialog(content: HTMLElement): boolean {
  const wasTopmost = openDialogStack[openDialogStack.length - 1] === content;
  const stackIndex = openDialogStack.lastIndexOf(content);

  if (stackIndex !== -1) openDialogStack.splice(stackIndex, 1);

  return wasTopmost;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = React.useCallback(
    (value: boolean) => {
      if (onOpenChange) {
        onOpenChange(value);
      } else {
        setInternalOpen(value);
      }
    },
    [onOpenChange],
  );
  const contextValue = React.useMemo(() => ({ open, setOpen }), [open, setOpen]);

  React.useEffect(() => {
    if (!open) return;

    return acquireBodyScrollLock();
  }, [open]);

  return <DialogContext.Provider value={contextValue}>{children}</DialogContext.Provider>;
}

interface DialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children, asChild }: DialogTriggerProps) {
  const { setOpen } = useDialog();
  const handleClick = React.useCallback(() => {
    setOpen(true);
  }, [setOpen]);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: handleClick,
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button onClick={handleClick} type="button">
      {children}
    </button>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  dismissible?: boolean;
}

export function DialogContent({ children, className, dismissible = true }: DialogContentProps) {
  const { open, setOpen } = useDialog();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descriptionId = React.useId();
  const [titleElement, setTitleElement] = React.useState<HTMLHeadingElement | null>(null);
  const [descriptionElement, setDescriptionElement] = React.useState<HTMLParagraphElement | null>(
    null,
  );

  const requestDismiss = React.useCallback(() => {
    if (dismissible) setOpen(false);
  }, [dismissible, setOpen]);

  const handleBackdropClick = React.useCallback(() => {
    requestDismiss();
  }, [requestDismiss]);

  const handleCloseClick = React.useCallback(() => {
    requestDismiss();
  }, [requestDismiss]);

  const contentContextValue = React.useMemo(
    () => ({ titleId, descriptionId, setTitleElement, setDescriptionElement }),
    [descriptionId, titleId],
  );

  React.useEffect(() => {
    if (!open) return;

    const content = contentRef.current;
    if (!content) return;

    const previouslyFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openDialogStack.push(content);
    const focusableElements = getFocusableElements(content);
    const autofocusElement = content.querySelector<HTMLElement>('[autofocus]');
    const initialFocusElement =
      autofocusElement && focusableElements.includes(autofocusElement)
        ? autofocusElement
        : (focusableElements[0] ?? content);

    if (!content.contains(document.activeElement) || autofocusElement) {
      initialFocusElement.focus();
    }

    return () => {
      const wasTopmost = removeOpenDialog(content);

      if (wasTopmost && previouslyFocusedElement?.isConnected) {
        previouslyFocusedElement.focus();
      }
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      const content = contentRef.current;
      if (!content || openDialogStack[openDialogStack.length - 1] !== content) return;

      if (e.key === 'Escape') {
        requestDismiss();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(content);
      if (focusableElements.length === 0) {
        e.preventDefault();
        content.focus();
        return;
      }

      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        e.shiftKey &&
        (activeElement === firstFocusableElement || !content.contains(activeElement))
      ) {
        e.preventDefault();
        lastFocusableElement.focus();
      } else if (
        !e.shiftKey &&
        (activeElement === lastFocusableElement || !content.contains(activeElement))
      ) {
        e.preventDefault();
        firstFocusableElement.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, requestDismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleElement ? titleId : undefined}
        aria-describedby={descriptionElement ? descriptionId : undefined}
        tabIndex={-1}
        className={cn(
          'relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg',
          'animate-in fade-in-0 zoom-in-95',
          className,
        )}
      >
        <DialogContentContext.Provider value={contentContextValue}>
          {dismissible && (
            <button
              onClick={handleCloseClick}
              className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              type="button"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          )}
          {children}
        </DialogContentContext.Provider>
      </div>
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return (
    <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}>
      {children}
    </div>
  );
}

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogFooter({ children, className }: DialogFooterProps) {
  return (
    <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}>
      {children}
    </div>
  );
}

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  const { titleId, setTitleElement } = useDialogContent();

  return (
    <h2
      ref={setTitleElement}
      id={titleId}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    >
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  const { descriptionId, setDescriptionElement } = useDialogContent();

  return (
    <p
      ref={setDescriptionElement}
      id={descriptionId}
      className={cn('text-sm text-muted-foreground', className)}
    >
      {children}
    </p>
  );
}
