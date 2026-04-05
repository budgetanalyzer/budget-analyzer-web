// src/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
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
      // Redirect to login - Session Gateway will handle OAuth flow
      window.location.href = '/oauth2/authorization/idp';
      return;
    }

    if (error.response?.data) {
      // API returned a structured error
      const apiErrorResponse = error.response.data;
      throw new ApiError(error.response.status, apiErrorResponse, apiErrorResponse.message);
    } else if (error.request) {
      // Request made but no response received
      const hasCookies = document.cookie.length > 0;
      const errorMessage = hasCookies
        ? 'Unable to reach the server. The session cookie exists but may not be sent with the request. Check browser console for details.'
        : 'Unable to reach the server. No session cookie found - you may need to log in again.';

      throw new ApiError(503, {
        type: 'SERVICE_UNAVAILABLE',
        message: errorMessage,
      });
    } else {
      throw new ApiError(500, {
        type: 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  },
);
