import { useCallback, useRef, useState } from 'react';
import { ChevronDown, Copy, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { usePermission } from '@/features/auth/hooks/usePermission';

interface ViewActionsMenuProps {
  onRenameClick: () => void;
  onDuplicateClick: () => void;
  onDeleteClick: () => void;
}

export function ViewActionsMenu({
  onRenameClick,
  onDuplicateClick,
  onDeleteClick,
}: ViewActionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const canWrite = usePermission('views:write');
  const canDelete = usePermission('views:delete');

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
  }, []);

  const handleRenameClick = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
    onRenameClick();
  }, [onRenameClick]);

  const handleDuplicateClick = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
    onDuplicateClick();
  }, [onDuplicateClick]);

  const handleDeleteClick = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
    onDeleteClick();
  }, [onDeleteClick]);

  if (!canWrite && !canDelete) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="outline">
          View actions
          <ChevronDown className="ml-2 h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canWrite && (
          <>
            <DropdownMenuItem onClick={handleRenameClick}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />
              Rename view
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDuplicateClick}>
              <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
              Duplicate view
            </DropdownMenuItem>
          </>
        )}
        {canWrite && canDelete && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem onClick={handleDeleteClick} destructive>
            <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" />
            Delete view
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
