import { AlertTriangle } from 'lucide-react';
import type { PreviewFileImportStatusResponse } from '@/types/transaction';
import { formatTimestamp } from '@/utils/dates';

interface PreviewFileImportWarningBannerProps {
  fileImport: PreviewFileImportStatusResponse;
}

export function PreviewFileImportWarningBanner({
  fileImport,
}: PreviewFileImportWarningBannerProps) {
  if (!fileImport.alreadyImported) {
    return null;
  }

  const previousImport = fileImport.previousImport;

  return (
    <div
      role="alert"
      className="rounded-md border border-warning/30 bg-warning/15 px-4 py-3 text-sm"
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
        <div className="space-y-2">
          <p className="font-semibold text-foreground">
            This uploaded file has already been imported.
          </p>
          {previousImport && (
            <dl className="grid gap-x-6 gap-y-1 text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="font-medium text-foreground">Previous file</dt>
                <dd>{previousImport.originalFilename}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Imported</dt>
                <dd>{formatTimestamp(previousImport.importedAt)}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Format</dt>
                <dd>{previousImport.format}</dd>
              </div>
              {previousImport.accountId && (
                <div>
                  <dt className="font-medium text-foreground">Account ID</dt>
                  <dd>{previousImport.accountId}</dd>
                </div>
              )}
              <div>
                <dt className="font-medium text-foreground">Previous transactions</dt>
                <dd>{previousImport.transactionCount}</dd>
              </div>
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
