// src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currencyCode: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
  }).format(amount);
}

export function formatDate(date: string): string {
  // Parse date components manually to avoid timezone issues
  // Date strings from API are in YYYY-MM-DD format
  const [year, month, day] = date.split('-').map(Number);

  // Create date in local timezone (months are 0-indexed in Date constructor)
  const dateObj = new Date(year, month - 1, day);

  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
