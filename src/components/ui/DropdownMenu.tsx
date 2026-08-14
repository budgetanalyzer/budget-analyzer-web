import * as React from 'react';
import { cn } from '@/utils/cn';

type OpenChangeHandler = (open: boolean) => void;
type MenuItemElement = HTMLElement & { disabled?: boolean };

interface OpenOptions {
  focusFirst?: boolean;
}

interface DropdownMenuContextValue {
  contentId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  focusFirstOnOpenRef: React.MutableRefObject<boolean>;
  handleNativeToggle: (event: Event) => void;
  open: boolean;
  pendingNativeStateRef: React.MutableRefObject<boolean | null>;
  requestOpenChange: (open: boolean, options?: OpenOptions) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

interface DropdownMenuSubContextValue {
  contentId: string;
  contentRef: React.RefObject<HTMLDivElement | null>;
  focusFirstOnOpenRef: React.MutableRefObject<boolean>;
  handleNativeToggle: (event: Event) => void;
  open: boolean;
  pendingNativeStateRef: React.MutableRefObject<boolean | null>;
  requestOpenChange: (open: boolean, options?: OpenOptions) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const DropdownMenuContext = React.createContext<DropdownMenuContextValue | undefined>(undefined);
const DropdownMenuSubContext = React.createContext<DropdownMenuSubContextValue | undefined>(
  undefined,
);

function useDropdownMenu() {
  const context = React.useContext(DropdownMenuContext);
  if (!context) throw new Error('Dropdown menu components must be used within DropdownMenu');
  return context;
}

function useDropdownMenuSub() {
  const context = React.useContext(DropdownMenuSubContext);
  if (!context) throw new Error('Dropdown submenu components must be used within DropdownMenuSub');
  return context;
}

function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  callerHandler: ((event: E) => void) | undefined,
  componentHandler: ((event: E) => void) | undefined,
) {
  return (event: E) => {
    callerHandler?.(event);
    if (!event.defaultPrevented) componentHandler?.(event);
  };
}

function mergeRefs<T>(...refs: Array<React.ForwardedRef<T> | undefined>) {
  return (node: T | null) => {
    refs.forEach((ref) => {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    });
  };
}

function isPopoverOpen(element: HTMLElement) {
  return element.matches(':popover-open');
}

function syncPopover(
  element: HTMLElement,
  open: boolean,
  pendingStateRef: React.MutableRefObject<boolean | null>,
  source: HTMLElement | null,
) {
  if (isPopoverOpen(element) === open) {
    pendingStateRef.current = null;
    return;
  }

  pendingStateRef.current = open;
  try {
    if (open) {
      const showPopover = element.showPopover as (options?: { source?: HTMLElement }) => void;
      showPopover.call(element, source ? { source } : undefined);
    } else element.hidePopover();
  } catch (error) {
    pendingStateRef.current = null;
    if (!(error instanceof DOMException) || error.name !== 'InvalidStateError') throw error;
  }
}

function getEnabledItems(menu: HTMLElement) {
  return Array.from(menu.querySelectorAll<MenuItemElement>('[role="menuitem"]')).filter(
    (item) =>
      item.closest<HTMLElement>('[role="menu"]') === menu &&
      !item.disabled &&
      item.getAttribute('aria-disabled') !== 'true',
  );
}

function focusFirstItem(menu: HTMLElement | null) {
  if (menu) getEnabledItems(menu)[0]?.focus();
}

function focusItemAt(items: MenuItemElement[], index: number) {
  if (items.length === 0) return;
  items[(index + items.length) % items.length]?.focus();
}

interface MenuKeyboardOptions {
  close: (restoreFocus: boolean) => void;
  closeSubmenu?: () => void;
}

function handleMenuKeyboard(
  event: React.KeyboardEvent<HTMLDivElement>,
  options: MenuKeyboardOptions,
) {
  const menu = event.currentTarget;
  const target = event.target as HTMLElement;
  if (target.closest<HTMLElement>('[role="menu"]') !== menu) return;

  const items = getEnabledItems(menu);
  const currentIndex = items.indexOf(target as MenuItemElement);

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    focusItemAt(items, currentIndex + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    focusItemAt(items, currentIndex === -1 ? items.length - 1 : currentIndex - 1);
  } else if (event.key === 'Home') {
    event.preventDefault();
    focusItemAt(items, 0);
  } else if (event.key === 'End') {
    event.preventDefault();
    focusItemAt(items, items.length - 1);
  } else if (event.key === 'Enter' || event.key === ' ') {
    if (currentIndex !== -1) {
      event.preventDefault();
      items[currentIndex]?.click();
    }
  } else if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    if (options.closeSubmenu) options.closeSubmenu();
    else options.close(true);
  } else if (event.key === 'ArrowLeft' && options.closeSubmenu) {
    event.preventDefault();
    event.stopPropagation();
    options.closeSubmenu();
  } else if (event.key === 'Tab') {
    options.close(false);
  }
}

interface DropdownMenuProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: OpenChangeHandler;
  open?: boolean;
}

export function DropdownMenu({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}: DropdownMenuProps) {
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const resolvedOpen = controlled ? open : uncontrolledOpen;
  const contentId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLElement>(null);
  const focusFirstOnOpenRef = React.useRef(false);
  const pendingNativeStateRef = React.useRef<boolean | null>(null);
  const openRef = React.useRef(resolvedOpen);
  openRef.current = resolvedOpen;

  const requestOpenChange = React.useCallback(
    (nextOpen: boolean, options?: OpenOptions) => {
      if (nextOpen && options?.focusFirst) focusFirstOnOpenRef.current = true;
      if (openRef.current === nextOpen) {
        if (nextOpen && options?.focusFirst) focusFirstItem(contentRef.current);
        return;
      }

      if (!controlled) {
        openRef.current = nextOpen;
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const handleNativeToggle = React.useCallback(
    (event: Event) => {
      const nextOpen = (event as Event & { newState?: string }).newState === 'open';
      if (pendingNativeStateRef.current !== null) {
        if (pendingNativeStateRef.current === nextOpen) pendingNativeStateRef.current = null;
        return;
      }
      if (openRef.current === nextOpen) return;

      if (!controlled) {
        openRef.current = nextOpen;
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const context = React.useMemo<DropdownMenuContextValue>(
    () => ({
      contentId,
      contentRef,
      focusFirstOnOpenRef,
      handleNativeToggle,
      open: resolvedOpen,
      pendingNativeStateRef,
      requestOpenChange,
      triggerRef,
    }),
    [contentId, handleNativeToggle, requestOpenChange, resolvedOpen],
  );

  return <DropdownMenuContext.Provider value={context}>{children}</DropdownMenuContext.Provider>;
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

export const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  (
    { asChild = false, children, className, disabled, onClick, onKeyDown, ...props },
    forwardedRef,
  ) => {
    const menu = useDropdownMenu();
    const child = asChild ? React.Children.only(children) : undefined;
    const childProps =
      child && React.isValidElement(child)
        ? (child.props as React.HTMLAttributes<HTMLElement> & {
            disabled?: boolean;
            ref?: React.Ref<HTMLElement>;
          })
        : undefined;
    const childRef = childProps?.ref;
    const childOnClick = childProps?.onClick;
    const childOnKeyDown = childProps?.onKeyDown;
    const childDisabled = Boolean(disabled || childProps?.disabled);

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (childDisabled) return;
        event.preventDefault();
        menu.requestOpenChange(!menu.open);
      },
      [childDisabled, menu],
    );
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLElement>) => {
        if (childDisabled) return;
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          menu.requestOpenChange(true, { focusFirst: true });
        }
      },
      [childDisabled, menu],
    );
    const mergedRef = React.useMemo(
      () => mergeRefs<HTMLElement>(menu.triggerRef, forwardedRef, childRef),
      [childRef, forwardedRef, menu.triggerRef],
    );
    const composedClick = React.useMemo(
      () =>
        composeEventHandlers(
          composeEventHandlers(childOnClick, onClick as React.MouseEventHandler<HTMLElement>),
          handleClick,
        ),
      [childOnClick, handleClick, onClick],
    );
    const composedKeyDown = React.useMemo(
      () =>
        composeEventHandlers(
          composeEventHandlers(
            childOnKeyDown,
            onKeyDown as React.KeyboardEventHandler<HTMLElement>,
          ),
          handleKeyDown,
        ),
      [childOnKeyDown, handleKeyDown, onKeyDown],
    );

    const sharedProps = {
      'aria-controls': menu.contentId,
      'aria-expanded': menu.open,
      'aria-haspopup': 'menu' as const,
      'data-state': menu.open ? 'open' : 'closed',
      popoverTarget: menu.contentId,
    };

    if (child && React.isValidElement(child)) {
      const existingProps = child.props as React.HTMLAttributes<HTMLElement> & {
        disabled?: boolean;
      };
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...props,
        ...sharedProps,
        className: cn(existingProps.className, className),
        disabled: childDisabled || undefined,
        onClick: composedClick,
        onKeyDown: composedKeyDown,
        ref: mergedRef,
      });
    }

    return (
      <button
        {...props}
        {...sharedProps}
        ref={mergedRef as React.Ref<HTMLButtonElement>}
        type="button"
        className={className}
        disabled={childDisabled}
        onClick={composedClick}
        onKeyDown={composedKeyDown}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: 'start' | 'end';
}

export const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ align = 'end', children, className, onKeyDown, ...props }, forwardedRef) => {
    const menu = useDropdownMenu();
    const mergedRef = React.useMemo(
      () => mergeRefs<HTMLDivElement>(menu.contentRef, forwardedRef),
      [forwardedRef, menu.contentRef],
    );

    React.useEffect(() => {
      const element = menu.contentRef.current;
      if (!element) return;
      element.addEventListener('toggle', menu.handleNativeToggle);
      return () => element.removeEventListener('toggle', menu.handleNativeToggle);
    }, [menu.contentRef, menu.handleNativeToggle]);

    React.useEffect(() => {
      const element = menu.contentRef.current;
      if (!element) return;
      syncPopover(element, menu.open, menu.pendingNativeStateRef, menu.triggerRef.current);
      if (menu.open && menu.focusFirstOnOpenRef.current) {
        menu.focusFirstOnOpenRef.current = false;
        focusFirstItem(element);
      }
    }, [menu]);

    const close = React.useCallback(
      (restoreFocus: boolean) => {
        menu.requestOpenChange(false);
        if (restoreFocus) queueMicrotask(() => menu.triggerRef.current?.focus());
      },
      [menu],
    );
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => handleMenuKeyboard(event, { close }),
      [close],
    );
    const composedKeyDown = React.useMemo(
      () => composeEventHandlers(onKeyDown, handleKeyDown),
      [handleKeyDown, onKeyDown],
    );

    return (
      <div
        {...props}
        ref={mergedRef}
        id={menu.contentId}
        popover="auto"
        role="menu"
        aria-hidden={menu.open ? undefined : true}
        data-align={align}
        data-state={menu.open ? 'open' : 'closed'}
        className={cn(
          'fixed inset-auto m-0 z-50 max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] min-w-[8rem] overflow-auto rounded-md border bg-background p-1 text-foreground shadow-lg',
          '[position-anchor:auto]',
          '[position-try-fallbacks:flip-block,flip-inline]',
          align === 'start'
            ? '[left:anchor(left)] [top:calc(anchor(bottom)_+_0.25rem)]'
            : '[right:anchor(right)] [top:calc(anchor(bottom)_+_0.25rem)]',
          className,
        )}
        onKeyDown={composedKeyDown}
      >
        {children}
      </div>
    );
  },
);
DropdownMenuContent.displayName = 'DropdownMenuContent';

interface DropdownMenuItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  asChild?: boolean;
  destructive?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
}

export const DropdownMenuItem = React.forwardRef<HTMLElement, DropdownMenuItemProps>(
  (
    { asChild = false, children, className, destructive = false, disabled, onClick, ...props },
    forwardedRef,
  ) => {
    const menu = useDropdownMenu();
    const child = asChild ? React.Children.only(children) : undefined;
    const childProps =
      child && React.isValidElement(child)
        ? (child.props as React.HTMLAttributes<HTMLElement> & {
            disabled?: boolean;
            ref?: React.Ref<HTMLElement>;
          })
        : undefined;
    const childRef = childProps?.ref;
    const childOnClick = childProps?.onClick;
    const childDisabled = Boolean(disabled || childProps?.disabled);
    const mergedRef = React.useMemo(
      () => mergeRefs<HTMLElement>(forwardedRef, childRef),
      [childRef, forwardedRef],
    );
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (childDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        menu.requestOpenChange(false);
      },
      [childDisabled, menu],
    );
    const handleChildClick = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (childDisabled) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        childOnClick?.(event);
        if (event.defaultPrevented) return;
        onClick?.(event);
        if (!event.defaultPrevented) menu.requestOpenChange(false);
      },
      [childDisabled, childOnClick, menu, onClick],
    );
    const composedClick = React.useMemo(
      () => composeEventHandlers(onClick, handleClick),
      [handleClick, onClick],
    );
    const itemClassName = cn(
      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
      'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
      destructive && 'text-destructive hover:text-destructive focus:text-destructive',
      'disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50',
      className,
    );

    if (child && React.isValidElement(child)) {
      const existingProps = child.props as React.HTMLAttributes<HTMLElement>;
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
        ...props,
        'aria-disabled': childDisabled || undefined,
        'data-destructive': destructive || undefined,
        className: cn(existingProps.className, itemClassName),
        onClick: handleChildClick,
        ref: mergedRef,
        role: 'menuitem',
        tabIndex: -1,
      });
    }

    return (
      <button
        {...props}
        ref={mergedRef as React.Ref<HTMLButtonElement>}
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={childDisabled}
        data-destructive={destructive || undefined}
        className={itemClassName}
        onClick={composedClick}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuItem.displayName = 'DropdownMenuItem';

export const DropdownMenuSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn('-mx-1 my-1 h-px bg-border', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator';

interface DropdownMenuSubProps {
  children: React.ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: OpenChangeHandler;
  open?: boolean;
}

export function DropdownMenuSub({
  children,
  defaultOpen = false,
  onOpenChange,
  open,
}: DropdownMenuSubProps) {
  useDropdownMenu();
  const controlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const resolvedOpen = controlled ? open : uncontrolledOpen;
  const contentId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const focusFirstOnOpenRef = React.useRef(false);
  const pendingNativeStateRef = React.useRef<boolean | null>(null);
  const openRef = React.useRef(resolvedOpen);
  openRef.current = resolvedOpen;

  const requestOpenChange = React.useCallback(
    (nextOpen: boolean, options?: OpenOptions) => {
      if (nextOpen && options?.focusFirst) focusFirstOnOpenRef.current = true;
      if (openRef.current === nextOpen) {
        if (nextOpen && options?.focusFirst) focusFirstItem(contentRef.current);
        return;
      }
      if (!controlled) {
        openRef.current = nextOpen;
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const handleNativeToggle = React.useCallback(
    (event: Event) => {
      const nextOpen = (event as Event & { newState?: string }).newState === 'open';
      if (pendingNativeStateRef.current !== null) {
        if (pendingNativeStateRef.current === nextOpen) pendingNativeStateRef.current = null;
        return;
      }
      if (openRef.current === nextOpen) return;
      if (!controlled) {
        openRef.current = nextOpen;
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );

  const context = React.useMemo<DropdownMenuSubContextValue>(
    () => ({
      contentId,
      contentRef,
      focusFirstOnOpenRef,
      handleNativeToggle,
      open: resolvedOpen,
      pendingNativeStateRef,
      requestOpenChange,
      triggerRef,
    }),
    [contentId, handleNativeToggle, requestOpenChange, resolvedOpen],
  );

  return (
    <DropdownMenuSubContext.Provider value={context}>{children}</DropdownMenuSubContext.Provider>
  );
}

type DropdownMenuSubTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const DropdownMenuSubTrigger = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuSubTriggerProps
>(
  (
    { children, className, disabled, onClick, onKeyDown, onPointerEnter, ...props },
    forwardedRef,
  ) => {
    const submenu = useDropdownMenuSub();
    const mergedRef = React.useMemo(
      () => mergeRefs<HTMLButtonElement>(submenu.triggerRef, forwardedRef),
      [forwardedRef, submenu.triggerRef],
    );
    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        submenu.requestOpenChange(!submenu.open, { focusFirst: !submenu.open });
      },
      [disabled, submenu],
    );
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          submenu.requestOpenChange(true, { focusFirst: true });
        }
      },
      [disabled, submenu],
    );
    const handlePointerEnter = React.useCallback(() => {
      if (!disabled) submenu.requestOpenChange(true);
    }, [disabled, submenu]);
    const composedClick = React.useMemo(
      () => composeEventHandlers(onClick, handleClick),
      [handleClick, onClick],
    );
    const composedKeyDown = React.useMemo(
      () => composeEventHandlers(onKeyDown, handleKeyDown),
      [handleKeyDown, onKeyDown],
    );
    const composedPointerEnter = React.useMemo(
      () => composeEventHandlers(onPointerEnter, handlePointerEnter),
      [handlePointerEnter, onPointerEnter],
    );

    return (
      <button
        {...props}
        ref={mergedRef}
        type="button"
        role="menuitem"
        tabIndex={-1}
        disabled={disabled}
        popoverTarget={submenu.contentId}
        aria-controls={submenu.contentId}
        aria-expanded={submenu.open}
        aria-haspopup="menu"
        data-state={submenu.open ? 'open' : 'closed'}
        className={cn(
          'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors',
          'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
          'data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        onClick={composedClick}
        onKeyDown={composedKeyDown}
        onPointerEnter={composedPointerEnter}
      >
        {children}
        <svg
          aria-hidden="true"
          focusable="false"
          className="ml-auto h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    );
  },
);
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger';

type DropdownMenuSubContentProps = React.HTMLAttributes<HTMLDivElement>;

export const DropdownMenuSubContent = React.forwardRef<HTMLDivElement, DropdownMenuSubContentProps>(
  ({ children, className, onKeyDown, ...props }, forwardedRef) => {
    const menu = useDropdownMenu();
    const submenu = useDropdownMenuSub();
    const mergedRef = React.useMemo(
      () => mergeRefs<HTMLDivElement>(submenu.contentRef, forwardedRef),
      [forwardedRef, submenu.contentRef],
    );

    React.useEffect(() => {
      const element = submenu.contentRef.current;
      if (!element) return;
      element.addEventListener('toggle', submenu.handleNativeToggle);
      return () => element.removeEventListener('toggle', submenu.handleNativeToggle);
    }, [submenu.contentRef, submenu.handleNativeToggle]);

    React.useEffect(() => {
      const element = submenu.contentRef.current;
      if (!element) return;
      syncPopover(element, submenu.open, submenu.pendingNativeStateRef, submenu.triggerRef.current);
      if (submenu.open && submenu.focusFirstOnOpenRef.current) {
        submenu.focusFirstOnOpenRef.current = false;
        focusFirstItem(element);
      }
    }, [submenu]);

    const closeRoot = React.useCallback(
      (restoreFocus: boolean) => {
        menu.requestOpenChange(false);
        if (restoreFocus) queueMicrotask(() => menu.triggerRef.current?.focus());
      },
      [menu],
    );
    const closeSubmenu = React.useCallback(() => {
      submenu.requestOpenChange(false);
      queueMicrotask(() => submenu.triggerRef.current?.focus());
    }, [submenu]);
    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) =>
        handleMenuKeyboard(event, { close: closeRoot, closeSubmenu }),
      [closeRoot, closeSubmenu],
    );
    const composedKeyDown = React.useMemo(
      () => composeEventHandlers(onKeyDown, handleKeyDown),
      [handleKeyDown, onKeyDown],
    );

    return (
      <div
        {...props}
        ref={mergedRef}
        id={submenu.contentId}
        popover="auto"
        role="menu"
        aria-hidden={submenu.open ? undefined : true}
        data-state={submenu.open ? 'open' : 'closed'}
        className={cn(
          'fixed inset-auto m-0 z-50 max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] min-w-[8rem] overflow-auto rounded-md border bg-background p-1 text-foreground shadow-lg',
          '[position-anchor:auto]',
          '[left:calc(anchor(right)_+_0.25rem)] [top:anchor(top)] [position-try-fallbacks:flip-inline,flip-block]',
          className,
        )}
        onKeyDown={composedKeyDown}
      >
        {children}
      </div>
    );
  },
);
DropdownMenuSubContent.displayName = 'DropdownMenuSubContent';
