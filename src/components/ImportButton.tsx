// src/components/ImportButton.tsx
import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { useImportTransactions } from '@/hooks/useImportTransactions';
import { motion, AnimatePresence } from 'framer-motion';
import { collapseHorizontalVariants, collapseTransition } from '@/lib/animations';
import { Transaction } from '@/types/transaction';

interface ImportButtonProps {
  onSuccess?: (count: number, transactions: Transaction[]) => void;
  onError?: (error: Error) => void;
}

const FORMAT_OPTIONS = [
  { label: 'Capital One', value: 'capital-one' },
  { label: 'Bangkok Bank', value: 'bkk-bank' },
  { label: 'Bangkok Bank Statement', value: 'bkk-bank-statement' },
  { label: 'Truist', value: 'truist' },
];

export function ImportButton({ onSuccess, onError }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: importTransactions, isPending } = useImportTransactions();
  const [isExpanded, setIsExpanded] = useState(false);
  const [format, setFormat] = useState<string>('');
  const [accountId, setAccountId] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleImport = () => {
    if (!format || selectedFiles.length === 0) {
      return;
    }

    importTransactions(
      { files: selectedFiles, format, accountId: accountId || undefined },
      {
        onSuccess: (data) => {
          // Clear the form
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          setSelectedFiles([]);
          setFormat('');
          setAccountId('');
          setIsExpanded(false);
          onSuccess?.(data.length, data);
        },
        onError: (error) => {
          onError?.(error);
        },
      },
    );
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    setIsExpanded(false);
    setFormat('');
    setAccountId('');
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleFileChange}
        className="hidden"
        aria-label="CSV file input"
      />

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={collapseHorizontalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={collapseTransition}
            className="flex items-center gap-2"
          >
            <div className="flex items-center">
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="w-auto min-w-[180px]">
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 overflow-hidden">
              <Input
                type="text"
                placeholder="Account ID (optional)"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-[180px]"
              />

              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={handleChooseFile}
                className="whitespace-nowrap"
              >
                {selectedFiles.length > 0 ? `${selectedFiles.length} file(s)` : 'Choose File'}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCancel}
                title="Cancel"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isExpanded ? (
        <Button onClick={() => setIsExpanded(true)} size="default" variant="default">
          <Upload className="mr-2 h-4 w-4" />
          Import Transactions
        </Button>
      ) : (
        <Button
          onClick={handleImport}
          disabled={isPending || !format || selectedFiles.length === 0}
          size="default"
          variant="default"
        >
          <Upload className="mr-2 h-4 w-4" />
          {isPending ? 'Importing...' : 'Import'}
        </Button>
      )}
    </div>
  );
}
