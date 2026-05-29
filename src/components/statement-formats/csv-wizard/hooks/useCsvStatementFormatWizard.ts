import { useMutation, useQueryClient } from '@tanstack/react-query';
import { statementFormatApi } from '@/api/statementFormatApi';
import { statementFormatsKeys } from '@/hooks/useStatementFormats';
import type { ApiError } from '@/types/apiError';
import type {
  CsvWizardAnalysisResponse,
  CsvWizardMappingPreviewRequest,
  CsvWizardPreviewResponse,
  CsvWizardSaveRequest,
  StatementFormat,
} from '@/types/statementFormat';

interface CsvWizardRequestVariables<TRequest> {
  file: File;
  request: TRequest;
}

export function useAnalyzeCsvWizardSample() {
  return useMutation<CsvWizardAnalysisResponse, ApiError, File>({
    mutationFn: (file) => statementFormatApi.analyzeCsvSample(file),
  });
}

export function usePreviewCsvWizardMapping() {
  return useMutation<
    CsvWizardPreviewResponse,
    ApiError,
    CsvWizardRequestVariables<CsvWizardMappingPreviewRequest>
  >({
    mutationFn: ({ file, request }) => statementFormatApi.previewCsvMapping(file, request),
  });
}

export function useSaveCsvWizardFormat() {
  const queryClient = useQueryClient();

  return useMutation<StatementFormat, ApiError, CsvWizardRequestVariables<CsvWizardSaveRequest>>({
    mutationFn: ({ file, request }) => statementFormatApi.saveCsvWizardFormat(file, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
    },
  });
}
