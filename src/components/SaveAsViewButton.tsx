import { useCallback, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { CreateViewModal } from '@/components/CreateViewModal';
import { Button } from '@/components/ui/Button';

interface SaveAsViewButtonProps {
  transactionIds: number[];
  isTransactionIdsReady: boolean;
  label?: string;
}

export function SaveAsViewButton({
  transactionIds,
  isTransactionIdsReady,
  label = 'Save as View',
}: SaveAsViewButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleOpenModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      <Button
        onClick={handleOpenModal}
        disabled={!isTransactionIdsReady}
        size="default"
        variant="outline"
      >
        <Bookmark className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <CreateViewModal
        open={isModalOpen}
        onClose={handleCloseModal}
        transactionIds={transactionIds}
        isTransactionIdsReady={isTransactionIdsReady}
        title={label}
      />
    </>
  );
}
