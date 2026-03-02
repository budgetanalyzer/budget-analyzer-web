// src/features/transactions/components/PreviewWarningBanner.tsx
import { AlertTriangle } from 'lucide-react';
import { PreviewWarning } from '@/types/transaction';

interface PreviewWarningBannerProps {
  warnings: PreviewWarning[];
}

export function PreviewWarningBanner({ warnings }: PreviewWarningBannerProps) {
  if (warnings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
      <div className="flex">
        <div className="flex-shrink-0">
          <AlertTriangle className="h-5 w-5 text-yellow-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            {warnings.length} warning{warnings.length !== 1 ? 's' : ''} detected
          </h3>
          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
            <ul className="list-disc space-y-1 pl-5">
              {warnings.map((warning, idx) => (
                <li key={`${warning.index}-${warning.field}-${idx}`}>
                  Row {warning.index + 1}, {warning.field}: {warning.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
