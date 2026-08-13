// src/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { replaceWithLogin } from '@/features/auth/utils/loginRedirect';
import { ApiError, ApiErrorResponse } from '@/types/apiError';

/**
 * API Client Configuration
 *
 * Authentication flow:
 * - All requests include session cookies automatically (withCredentials: true)
 * - Istio ingress ext_authz validates session cookie via Redis lookup
 * - ext_authz injects identity headers (X-User-Id, X-Roles, X-Permissions)
 * - NGINX routes request to backend services
 *
 * No need to manually add Authorization header - ext_authz handles identity.
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
const unauthorizedMessage = 'Your session has expired. Please sign in again.';

function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    'message' in data &&
    typeof data.type === 'string' &&
    typeof data.message === 'string'
  );
}

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include session cookies in all requests
  timeout: 10000,
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    // Handle 401 Unauthorized - session expired or invalid
    if (error.response?.status === 401) {
      const returnUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      replaceWithLogin(returnUrl);

      if (isApiErrorResponse(error.response.data)) {
        const apiErrorResponse = error.response.data;
        throw new ApiError(401, apiErrorResponse, apiErrorResponse.message);
      }

      throw new ApiError(401, {
        type: 'UNAUTHORIZED',
        message: unauthorizedMessage,
      });
    }

    if (error.response) {
      // API returned a structured error
      if (isApiErrorResponse(error.response.data)) {
        const apiErrorResponse = error.response.data;
        throw new ApiError(error.response.status, apiErrorResponse, apiErrorResponse.message);
      }

      throw new ApiError(error.response.status, {
        type: 'INTERNAL_ERROR',
        message: error.message || `Request failed with status code ${error.response.status}`,
      });
    }

    if (error.request) {
      // Request made but no response received
      // Note: BA_SESSION cookie is HttpOnly so document.cookie cannot detect it.
      // A missing document.cookie does NOT mean the user is unauthenticated.
      throw new ApiError(503, {
        type: 'SERVICE_UNAVAILABLE',
        message: 'Unable to reach the server. Please try again later.',
      });
    }

    throw new ApiError(500, {
      type: 'INTERNAL_ERROR',
      message: error.message,
    });
  },
);
