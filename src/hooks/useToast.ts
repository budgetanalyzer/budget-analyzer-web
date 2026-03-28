// CSP-compliant toast system. Replaces `sonner` which injects <style> elements
// via document.createElement('style') on module load, violating strict
// style-src 'self' CSP. Do NOT reintroduce sonner or any toast library that
// performs runtime CSS injection.
import { useSyncExternalStore } from 'react';

export type ToastVariant = 'default' | 'success' | 'destructive' | 'warning';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
}

type Listener = () => void;

let toasts: ToastData[] = [];
const listeners = new Set<Listener>();
let counter = 0;

function notify() {
  listeners.forEach((l) => l());
}

function addToast(message: string, variant: ToastVariant): string {
  const id = String(++counter);
  toasts = [{ id, message, variant }, ...toasts];
  notify();
  return id;
}

export function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export const toast = {
  success: (message: string) => addToast(message, 'success'),
  error: (message: string) => addToast(message, 'destructive'),
  warning: (message: string) => addToast(message, 'warning'),
};

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return toasts;
}

export function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot);
  return { toasts: currentToasts, dismiss };
}
