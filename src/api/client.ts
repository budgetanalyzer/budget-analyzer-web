// src/api/client.ts
import axios, { AxiosError, AxiosInstance } from 'axios';
import { ApiError, ApiErrorResponse } from '@/types/apiError';

/**
 * API Client Configuration
 *
 * Authentication flow:
 * - All requests include session cookies automatically (withCredentials: true)
 * - Session Gateway validates session cookie
 * - Session Gateway adds JWT to Authorization header
 * - Session Gateway forwards request to NGINX
 * - NGINX validates JWT and routes to backend services
 *
 * No need to manually add Authorization header - Session Gateway handles it.
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

// Request interceptor for debugging credentials
apiClient.interceptors.request.use(
  (config) => {
    // Debug logging to help diagnose cookie issues
    console.group('[API Client] Request Debug Info');
    console.log('URL:', config.url);
    console.log('Base URL:', config.baseURL);
    console.log('Full URL:', (config.baseURL || '') + (config.url || ''));
    console.log('Method:', config.method?.toUpperCase());
    console.log('withCredentials:', config.withCredentials);
    console.log('Cookies available:', document.cookie || '(none)');

    // Check if Cookie header is being set
    // Note: Browser may not expose Cookie header in config.headers for security reasons
    // But we can verify cookies exist in document.cookie
    const hasCookies = document.cookie.length > 0;
    if (!hasCookies) {
      console.warn('⚠️  NO COOKIES FOUND - Request will fail authentication');
      console.warn('Expected to find session cookie (SESSION or JSESSIONID)');
      console.warn('Current origin:', window.location.origin);
    } else {
      console.log('✓ Cookies are available and should be sent with request');
    }

    console.groupEnd();
    return config;
  },
  (error) => {
    console.error('[API Client] Request interceptor error:', error);
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log('[API Client] Response received:', response.status, response.config.url);
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    console.group('[API Client] Response Error');
    console.log('Status:', error.response?.status || 'No response');
    console.log('URL:', error.config?.url);
    console.log('Error type:', error.code);
    console.log('Error message:', error.message);

    // Handle 401 Unauthorized - session expired or invalid
    if (error.response?.status === 401) {
      console.warn('⚠️  401 Unauthorized - Session cookie missing or invalid');
      console.warn('Redirecting to login...');
      console.groupEnd();
      // Redirect to login - Session Gateway will handle OAuth flow
      window.location.href = '/oauth2/authorization/auth0';
      return;
    }

    if (error.response?.data) {
      // API returned a structured error
      console.log('API Error Response:', error.response.data);
      console.groupEnd();
      const apiErrorResponse = error.response.data;
      throw new ApiError(error.response.status, apiErrorResponse, apiErrorResponse.message);
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received from server');
      console.log('Possible causes:');
      console.log('1. Session cookie not being sent (check request headers in Network tab)');
      console.log('2. Backend not running or not accessible');
      console.log('3. CORS configuration blocking credentials');
      console.log('4. Network timeout (check if backend is responding slowly)');
      console.groupEnd();

      // Enhanced error message based on context
      const hasCookies = document.cookie.length > 0;
      const errorMessage = hasCookies
        ? 'Unable to reach the server. The session cookie exists but may not be sent with the request. Check browser console for details.'
        : 'Unable to reach the server. No session cookie found - you may need to log in again.';

      throw new ApiError(503, {
        type: 'SERVICE_UNAVAILABLE',
        message: errorMessage,
      });
    } else {
      // Something else happened
      console.error('Request setup error:', error.message);
      console.groupEnd();
      throw new ApiError(500, {
        type: 'INTERNAL_ERROR',
        message: error.message,
      });
    }
  },
);
