import apiClient from './client';
import type {
    GeneralSettingsResponse,
    ThemeSettingsResponse,
    BusinessSettingsResponse,
    WithdrawSettingsResponse,
    AIPromptsResponse,
    AIConfigResponse
} from '@/types/settings.types';

export const settingsApi = {
    // Public Settings
    getPublicSettings: async () => {
        const response = await apiClient.get('/api/backend/settings/public');
        return response.data;
    },

    // Main General Settings
    getGeneralSettings: async () => {
        const response = await apiClient.get<GeneralSettingsResponse>('/api/backend/generale-setting');
        return response.data;
    },

    updateGeneralSettings: async (data: FormData | any) => {
        const headers = data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : {};
        const response = await apiClient.post('/api/backend/generale-setting', data, { headers });
        return response.data;
    },

    // Theme Settings
    getThemeSettings: async () => {
        const response = await apiClient.get<ThemeSettingsResponse>('/api/backend/generale-setting/theme');
        return response.data;
    },

    updateThemeSettings: async (data: { primary_color: string; secondary_color: string; direction?: 'ltr' | 'rtl' }) => {
        const response = await apiClient.post('/api/backend/generale-setting/theme', data);
        return response.data;
    },

    // Business Settings
    getBusinessSettings: async () => {
        const response = await apiClient.get<BusinessSettingsResponse>('/api/backend/generale-setting/business');
        return response.data;
    },

    updateBusinessSettings: async (data: any) => {
        const response = await apiClient.post('/api/backend/generale-setting/business', data);
        return response.data;
    },

    // Withdraw Settings
    getWithdrawSettings: async () => {
        const response = await apiClient.get<WithdrawSettingsResponse>('/api/backend/generale-setting/withdraw');
        return response.data;
    },

    updateWithdrawSettings: async (data: { min_withdraw: number; max_withdraw: number; withdraw_request: number }) => {
        const response = await apiClient.post('/api/backend/generale-setting/withdraw', data);
        return response.data;
    },

    // AI Settings
    getAIPrompts: async () => {
        const response = await apiClient.get<AIPromptsResponse>('/api/backend/ai-prompts');
        return response.data;
    },

    updateAIPrompts: async (data: { product_description: string; page_description: string; blog_description: string }) => {
        const response = await apiClient.post('/api/backend/ai-prompts/update', data);
        return response.data;
    },

    getAIConfigStatus: async () => {
        const response = await apiClient.get<AIConfigResponse>('/api/backend/ai-prompts/configure');
        return response.data;
    },

    updateAIConfig: async (data: { api_key: string; organization: string }) => {
        const response = await apiClient.post('/api/backend/ai-prompts/configure', data);
        return response.data;
    },

    // System Update
    runUpdateCommand: async () => {
        const response = await apiClient.post('/api/backend/generale-update-command');
        return response.data;
    }
};
