// CSP-compliant toast primitives built on @radix-ui/react-toast. All styling
// is Tailwind classes — no runtime CSS injection. Replaces `sonner` which
// violates strict style-src 'self' CSP by calling document.createElement('style')
// on import. Do NOT replace with sonner or any library that injects styles at runtime.
import * as React from 'react';
import * as ToastPrimitives from '@radix-ui/react-toast';
import { cn } from '@/utils/cn';
import { X } from 'lucide-react';
import type { ToastVariant } from '@/hooks/useToast';

const variantStyles: Record<ToastVariant, string> = {
  default: 'border bg-background text-foreground',
  success: 'border-success bg-success text-success-foreground',
  destructive: 'border-destructive bg-destructive text-destructive-foreground',
  warning: 'border-warning bg-warning text-warning-foreground',
};

export const ToastProvider = ToastPrimitives.Provider;

export const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Viewport
    ref={ref}
    className={cn(
      'fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col gap-2 p-4 sm:max-w-[420px]',
      className,
    )}
    {...props}
  />
));
ToastViewport.displayName = 'ToastViewport';

interface ToastProps extends React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> {
  variant?: ToastVariant;
}

export const Toast = React.forwardRef<React.ComponentRef<typeof ToastPrimitives.Root>, ToastProps>(
  ({ className, variant = 'default', ...props }, ref) => (
    <ToastPrimitives.Root
      ref={ref}
      className={cn(
        'group pointer-events-auto relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-md border p-4 shadow-lg',
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Toast.displayName = 'Toast';

export const ToastClose = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Close>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Close
    ref={ref}
    className={cn(
      'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2',
      className,
    )}
    toast-close=""
    {...props}
  >
    <X className="h-4 w-4" />
  </ToastPrimitives.Close>
));
ToastClose.displayName = 'ToastClose';

export const ToastTitle = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Title ref={ref} className={cn('text-sm font-semibold', className)} {...props} />
));
ToastTitle.displayName = 'ToastTitle';

export const ToastDescription = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Description
    ref={ref}
    className={cn('text-sm opacity-90', className)}
    {...props}
  />
));
ToastDescription.displayName = 'ToastDescription';

export const ToastAction = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitives.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitives.Action
    ref={ref}
    className={cn(
      'inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50',
      className,
    )}
    {...props}
  />
));
ToastAction.displayName = 'ToastAction';
