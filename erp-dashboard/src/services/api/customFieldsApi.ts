import apiClient from './client';
import type {
    CustomFieldListResponse,
    CustomFieldCreateFormResponse,
    CustomFieldEditFormResponse,
    CustomFieldMutationResponse,
    CustomFieldToggleResponse,
    CustomFieldReorderResponse,
    CustomFieldFilters,
    CreateCustomFieldRequest,
    UpdateCustomFieldRequest,
    ReorderRequest,
    CustomField,
} from '../../types/customFields.types';

const BASE_PATH = '/api/backend/custom-fields';

// ─── List custom fields ──────────────────────────────────────────────────────

export const getCustomFields = async (filters: CustomFieldFilters): Promise<CustomFieldListResponse> => {
    const response = await apiClient.get<CustomFieldListResponse>(BASE_PATH, {
        params: filters,
    });
    return response.data;
};

// ─── Create form metadata (field types & entity types) ───────────────────────

export const getCreateFormMeta = async (): Promise<CustomFieldCreateFormResponse> => {
    const response = await apiClient.get<CustomFieldCreateFormResponse>(`${BASE_PATH}/create`);
    return response.data;
};

// ─── Show one custom field ───────────────────────────────────────────────────

export const getCustomField = async (id: number): Promise<CustomField> => {
    const response = await apiClient.get<{ customField: CustomField }>(`${BASE_PATH}/${id}`);
    // Response may be { customField: {...} } or just the field directly
    return response.data.customField ?? (response.data as any);
};

// ─── Edit form (field + options_string, validation_rules_string) ─────────────

export const getEditFormMeta = async (id: number): Promise<CustomFieldEditFormResponse> => {
    const response = await apiClient.get<CustomFieldEditFormResponse>(`${BASE_PATH}/${id}/edit`);
    return response.data;
};

// ─── Create a custom field ───────────────────────────────────────────────────

export const createCustomField = async (data: CreateCustomFieldRequest): Promise<CustomFieldMutationResponse> => {
    const response = await apiClient.post<CustomFieldMutationResponse>(BASE_PATH, data);
    return response.data;
};

// ─── Update a custom field ───────────────────────────────────────────────────

export const updateCustomField = async (id: number, data: UpdateCustomFieldRequest): Promise<CustomFieldMutationResponse> => {
    const response = await apiClient.put<CustomFieldMutationResponse>(`${BASE_PATH}/${id}`, data);
    return response.data;
};

// ─── Delete a custom field ───────────────────────────────────────────────────

export const deleteCustomField = async (id: number): Promise<CustomFieldMutationResponse> => {
    const response = await apiClient.delete<CustomFieldMutationResponse>(`${BASE_PATH}/${id}`);
    return response.data;
};

// ─── Toggle active status ────────────────────────────────────────────────────

export const toggleCustomField = async (id: number): Promise<CustomFieldToggleResponse> => {
    const response = await apiClient.patch<CustomFieldToggleResponse>(`${BASE_PATH}/${id}/toggle`);
    return response.data;
};

// ─── Reorder custom fields ──────────────────────────────────────────────────

export const reorderCustomFields = async (data: ReorderRequest): Promise<CustomFieldReorderResponse> => {
    const response = await apiClient.post<CustomFieldReorderResponse>(`${BASE_PATH}/reorder`, data);
    return response.data;
};
