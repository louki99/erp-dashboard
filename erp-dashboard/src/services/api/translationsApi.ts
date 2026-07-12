import apiClient from './client';

export interface TranslationEntity {
    entity: string;
    translatable_fields: string[];
    rows_count: number;
    translated_rows_count: number;
}

export interface TranslationRow {
    id: number;
    code?: string;
    base: Record<string, string>;
    translations: Record<string, Record<string, string>>;
}

export interface TranslationEntitiesResponse {
    success: boolean;
    entities: TranslationEntity[];
    supported_locales: string[];
}

export interface TranslationRowsResponse {
    success: boolean;
    data: TranslationRow[];
    meta?: { current_page: number; last_page: number; total: number; per_page: number };
}

const BASE = '/api/backend/translations';

export const translationsApi = {
    getEntities: async (): Promise<TranslationEntitiesResponse> => {
        const res = await apiClient.get<TranslationEntitiesResponse>(`${BASE}/entities`);
        return res.data;
    },

    getRows: async (entity: string, params?: { per_page?: number; page?: number; search?: string }): Promise<TranslationRowsResponse> => {
        const res = await apiClient.get<TranslationRowsResponse>(`${BASE}/${entity}`, { params });
        return res.data;
    },

    updateRow: async (entity: string, id: number, translations: Record<string, Record<string, string>>): Promise<{ success: boolean; message?: string }> => {
        const res = await apiClient.put(`${BASE}/${entity}/${id}`, { translations });
        return res.data;
    },
};
