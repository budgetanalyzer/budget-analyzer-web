// src/types/apiError.ts
export interface FieldError {
  field: string;
  message: string;
  rejectedValue?: unknown;
  index?: number;
}

export type ApiErrorType =
  | 'INVALID_REQUEST'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'APPLICATION_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN';

export interface ApiErrorResponse {
  type: ApiErrorType;
  message: string;
  code?: string;
  fieldErrors?: FieldError[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public response: ApiErrorResponse,
    message?: string,
  ) {
    super(message || response.message);
    this.name = 'ApiError';
  }
}
