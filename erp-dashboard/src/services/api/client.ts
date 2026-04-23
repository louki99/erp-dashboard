import axios, { type AxiosInstance, type AxiosError, type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';
import toast from 'react-hot-toast';

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

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get token from localStorage - using 'erp_token' to match AuthContext
        const token = localStorage.getItem('erp_token');

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
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
        return response;
    },
    (error: AxiosError) => {
        // Handle different error types
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as any;

            switch (status) {
                case 401:
                    // Unauthorized - redirect to login
                    toast.error('Session expirée. Veuillez vous reconnecter.');
                    localStorage.removeItem('erp_token');
                    localStorage.removeItem('erp_user');
                    window.location.href = '/login';
                    break;

                case 403:
                    // Forbidden
                    toast.error('Accès refusé. Vous n\'avez pas les permissions nécessaires.');
                    break;

                case 404:
                    // Not found
                    toast.error('Ressource introuvable.');
                    break;

                case 422:
                    // Validation error - handle in component
                    break;

                case 500:
                    // Server error
                    toast.error(data?.message || 'Erreur serveur. Veuillez réessayer.');
                    break;

                default:
                    toast.error(data?.message || 'Une erreur est survenue.');
            }
        } else if (error.request) {
            // Network error
            toast.error('Erreur de connexion. Vérifiez votre connexion internet.');
        } else {
            // Other errors
            toast.error('Une erreur est survenue.');
        }

        return Promise.reject(error);
    }
);

export default apiClient;
