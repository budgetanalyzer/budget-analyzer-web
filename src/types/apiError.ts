// src/types/apiError.ts
export interface FieldError {
  field: string;
  message: string;
  rejectedValue: unknown;
}

export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  timestamp: string;
  errors?: FieldError[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public response: ApiErrorResponse,
    message?: string,
  ) {
    super(message || response.title);
    this.name = 'ApiError';
  }
}
