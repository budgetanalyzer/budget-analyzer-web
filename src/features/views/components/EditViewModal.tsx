// src/features/views/components/EditViewModal.tsx
import { useState, useCallback, FormEvent, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { useUpdateView } from '@/hooks/useViews';
import { SavedView } from '@/types/view';
import { formatLocalDate } from '@/utils/dates';

interface EditViewModalProps {
  open: boolean;
  onClose: () => void;
  view: SavedView;
}

export function EditViewModal({ open, onClose, view }: EditViewModalProps) {
  const [name, setName] = useState(view.name);
  const [openEnded, setOpenEnded] = useState(view.openEnded);
  const { mutate: updateView, isPending } = useUpdateView();

  // Reset form when view changes or modal opens
  useEffect(() => {
    if (open) {
      setName(view.name);
      setOpenEnded(view.openEnded);
    }
  }, [open, view.name, view.openEnded]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();

      if (!name.trim()) return;

      updateView(
        {
          id: view.id,
          request: {
            name: name.trim(),
            openEnded,
          },
        },
        {
          onSuccess: () => {
            onClose();
          },
        },
      );
    },
    [name, openEnded, updateView, view.id, onClose],
  );

  const handleCancel = useCallback(() => {
    setName(view.name);
    setOpenEnded(view.openEnded);
    onClose();
  }, [onClose, view.name, view.openEnded]);

  const handleOpenEndedChange = useCallback((checked: boolean | 'indeterminate') => {
    setOpenEnded(checked === true);
  }, []);

  // Build criteria summary lines
  const criteria = view.criteria;
  const criteriaLines: string[] = [];
  if (criteria.startDate || criteria.endDate) {
    const start = criteria.startDate ? formatLocalDate(criteria.startDate) : 'Any';
    const end = criteria.endDate ? formatLocalDate(criteria.endDate) : 'Ongoing';
    criteriaLines.push(`Dates: ${start} - ${end}`);
  }
  if (criteria.searchText) {
    criteriaLines.push(`Search: "${criteria.searchText}"`);
  }
  if (criteria.minAmount !== undefined || criteria.maxAmount !== undefined) {
    const min = criteria.minAmount !== undefined ? `$${criteria.minAmount}` : '$0';
    const max = criteria.maxAmount !== undefined ? `$${criteria.maxAmount}` : 'Any';
    criteriaLines.push(`Amount: ${min} - ${max}`);
  }
  if (criteria.accountIds && criteria.accountIds.length > 0) {
    criteriaLines.push(`Accounts: ${criteria.accountIds.join(', ')}`);
  }

  const hasCriteria = criteriaLines.length > 0;
  const hasChanges = name.trim() !== view.name || openEnded !== view.openEnded;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit View</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="view-name" className="text-sm font-medium">
                View Name
              </label>
              <Input
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., SF Trip December 2024"
                required
                maxLength={100}
                autoFocus
              />
            </div>

            {hasCriteria && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Current Criteria:</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                  {criteriaLines.map((line, index) => (
                    <li key={index}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-start space-x-3">
              <Checkbox
                id="open-ended"
                checked={openEnded}
                onCheckedChange={handleOpenEndedChange}
              />
              <div className="space-y-1">
                <label htmlFor="open-ended" className="cursor-pointer text-sm font-medium">
                  Keep view open-ended
                </label>
                <p className="text-xs text-muted-foreground">
                  Include future transactions matching these criteria
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim() || !hasChanges}>
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
