// CSP-compliant toaster. See Toast.tsx and useToast.ts for rationale.
// Do NOT replace with sonner — it violates strict CSP.
import { useToast, dismiss } from '@/hooks/useToast';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastViewport } from './Toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={5000} swipeDirection="right">
      {toasts.map((t) => (
        <Toast
          key={t.id}
          variant={t.variant}
          onOpenChange={(open) => {
            if (!open) dismiss(t.id);
          }}
        >
          <ToastDescription>{t.message}</ToastDescription>
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
