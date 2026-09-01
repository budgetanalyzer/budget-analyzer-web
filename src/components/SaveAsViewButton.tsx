import { useCallback, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { CreateViewModal } from '@/components/CreateViewModal';
import { Button } from '@/components/ui/Button';

interface SaveAsViewButtonCommonProps {
  label?: string;
  dialogTitle?: string;
}

type SaveAsViewButtonProps = SaveAsViewButtonCommonProps &
  (
    | {
        transactionIds: number[];
        isTransactionIdsReady: boolean;
        sourceViewId?: never;
      }
    | {
        sourceViewId: string;
        transactionIds?: never;
        isTransactionIdsReady?: never;
      }
  );

export function SaveAsViewButton(props: SaveAsViewButtonProps) {
  const { label = 'Save as View', dialogTitle = 'Save as view' } = props;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isCloneMode = props.sourceViewId !== undefined;

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
        disabled={!isCloneMode && !props.isTransactionIdsReady}
        size="default"
        variant="outline"
      >
        <Bookmark className="mr-2 h-4 w-4" />
        {label}
      </Button>
      <CreateViewModal
        open={isModalOpen}
        onClose={handleCloseModal}
        title={dialogTitle}
        {...(isCloneMode
          ? { sourceViewId: props.sourceViewId }
          : {
              transactionIds: props.transactionIds,
              isTransactionIdsReady: props.isTransactionIdsReady,
            })}
      />
    </>
  );
}
