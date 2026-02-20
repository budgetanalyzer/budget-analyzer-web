// src/components/SaveAsViewButton.tsx
import { useState, useCallback } from 'react';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CreateViewModal } from '@/components/CreateViewModal';
import { ViewCriteriaApi } from '@/types/view';

interface SaveAsViewButtonProps {
  criteria: ViewCriteriaApi;
  disabled?: boolean;
}

export function SaveAsViewButton({ criteria, disabled }: SaveAsViewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <Button onClick={handleOpenModal} disabled={disabled} size="default" variant="outline">
        <Bookmark className="mr-2 h-4 w-4" />
        Save as View
      </Button>
      <CreateViewModal open={isModalOpen} onClose={handleCloseModal} criteria={criteria} />
    </>
  );
}
