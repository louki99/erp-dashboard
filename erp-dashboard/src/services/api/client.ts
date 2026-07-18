import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import toast from 'react-hot-toast';
import i18n from '@/i18n';

// Base API configuration
const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: 60000, // Increased to 60 seconds for workflow operations
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
});

// Request interceptor - Add auth token and active locale
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get token from localStorage - using 'erp_token' to match AuthContext
        const token = localStorage.getItem('erp_token');

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Send active locale so backend can return translated data and messages.
        const locale = localStorage.getItem('erp_locale') || 'fr';
        if (config.headers) {
            config.headers['Accept-Language'] = locale;
        }

        return config;
    },
    (error: AxiosError) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
        // Clear any active maintenance banner on a successful response
        window.dispatchEvent(new CustomEvent('app:maintenance:clear'));
        return response;
    },
    (error: AxiosError) => {
        // Handle different error types
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as any;

            switch (status) {
                case 401:
                    toast.error(i18n.t('errors.sessionExpired'));
                    localStorage.removeItem('erp_token');
                    localStorage.removeItem('erp_user');
                    window.location.href = '/login';
                    break;

                case 403:
                    toast.error(i18n.t('errors.unauthorized'));
                    break;

                case 404:
                    toast.error(i18n.t('errors.notFound'));
                    break;

                case 422:
                    // Validation error — handled in each component
                    break;

                case 500:
                    toast.error(data?.message || i18n.t('errors.serverError'));
                    break;

                case 503: {
                    // App is in maintenance mode (e.g. a DB restore is running).
                    // The backup-operations polling endpoint is explicitly excluded by the
                    // backend from maintenance mode and will keep returning 200, so we
                    // won't see 503 from there. All other endpoints may return 503.
                    // Show a global banner instead of a toast; the banner handles retry UX.
                    const retryAfter = Number(
                        (error.response.headers as Record<string, string>)['retry-after'] ?? 15,
                    );
                    window.dispatchEvent(
                        new CustomEvent('app:maintenance', { detail: { retryAfter } }),
                    );
                    break;
                }

                default:
                    toast.error(data?.message || i18n.t('errors.generic'));
            }
        } else if (error.request) {
            toast.error(i18n.t('errors.network'));
        } else {
            toast.error(i18n.t('errors.generic'));
        }

        return Promise.reject(error);
    }
);

export default apiClient;
