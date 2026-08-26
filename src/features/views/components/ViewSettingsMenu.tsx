import { useCallback, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { usePermission } from '@/features/auth/hooks/usePermission';

interface ViewSettingsMenuProps {
  onRenameClick: () => void;
  onDeleteClick: () => void;
}

export function ViewSettingsMenu({ onRenameClick, onDeleteClick }: ViewSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const canRename = usePermission('views:write');
  const canDelete = usePermission('views:delete');

  const handleRenameClick = useCallback(() => {
    setIsOpen(false);
    onRenameClick();
  }, [onRenameClick]);

  const handleDeleteClick = useCallback(() => {
    setIsOpen(false);
    onDeleteClick();
  }, [onDeleteClick]);

  if (!canRename && !canDelete) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">View settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {canRename && (
          <DropdownMenuItem onClick={handleRenameClick}>
            <Pencil className="mr-2 h-4 w-4" />
            Rename View
          </DropdownMenuItem>
        )}
        {canRename && canDelete && <DropdownMenuSeparator />}
        {canDelete && (
          <DropdownMenuItem onClick={handleDeleteClick} destructive>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete View
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
