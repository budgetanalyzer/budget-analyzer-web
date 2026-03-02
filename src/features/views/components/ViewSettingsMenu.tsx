// src/features/views/components/ViewSettingsMenu.tsx
import { useCallback, useState } from 'react';
import { MoreHorizontal, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Button } from '@/components/ui/Button';
import { SavedView } from '@/types/view';
import { useUpdateView } from '@/hooks/useViews';

interface ViewSettingsMenuProps {
  view: SavedView;
  onEditClick: () => void;
  onDeleteClick: () => void;
}

export function ViewSettingsMenu({ view, onEditClick, onDeleteClick }: ViewSettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { mutate: updateView, isPending } = useUpdateView();

  const handleToggleOpenEnded = useCallback(() => {
    updateView({
      id: view.id,
      request: { openEnded: !view.openEnded },
    });
    setIsOpen(false);
  }, [updateView, view.id, view.openEnded]);

  const handleEditClick = useCallback(() => {
    setIsOpen(false);
    onEditClick();
  }, [onEditClick]);

  const handleDeleteClick = useCallback(() => {
    setIsOpen(false);
    onDeleteClick();
  }, [onDeleteClick]);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">View settings</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleEditClick}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleToggleOpenEnded} disabled={isPending}>
          {view.openEnded ? (
            <>
              <ToggleRight className="mr-2 h-4 w-4" />
              Disable Open-Ended
            </>
          ) : (
            <>
              <ToggleLeft className="mr-2 h-4 w-4" />
              Enable Open-Ended
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDeleteClick} destructive>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete View
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
