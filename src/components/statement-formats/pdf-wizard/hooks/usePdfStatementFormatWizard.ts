import { useMutation, useQueryClient } from '@tanstack/react-query';
import { statementFormatApi } from '@/api/statementFormatApi';
import { statementFormatsKeys } from '@/hooks/useStatementFormats';
import type { ApiError } from '@/types/apiError';
import type {
  PdfWizardAnalysisResponse,
  PdfWizardMappingPreviewRequest,
  PdfWizardPreviewResponse,
  PdfWizardSaveRequest,
  StatementFormat,
} from '@/types/statementFormat';

interface PdfWizardRequestVariables<TRequest> {
  file: File;
  request: TRequest;
}

export function useAnalyzePdfWizardSample() {
  return useMutation<PdfWizardAnalysisResponse, ApiError, File>({
    mutationFn: (file) => statementFormatApi.analyzePdfSample(file),
  });
}

export function usePreviewPdfWizardMapping() {
  return useMutation<
    PdfWizardPreviewResponse,
    ApiError,
    PdfWizardRequestVariables<PdfWizardMappingPreviewRequest>
  >({
    mutationFn: ({ file, request }) => statementFormatApi.previewPdfMapping(file, request),
  });
}

export function useSavePdfWizardFormat() {
  const queryClient = useQueryClient();

  return useMutation<StatementFormat, ApiError, PdfWizardRequestVariables<PdfWizardSaveRequest>>({
    mutationFn: ({ file, request }) => statementFormatApi.savePdfWizardFormat(file, request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: statementFormatsKeys.all });
    },
  });
}
