import apiClient from './client';
import type {
    BulkReplacePayload,
    BulkReplaceResponse,
    CreateDataRulePayload,
    DataRule,
    DataRuleDeleteResponse,
    DataRuleFilters,
    DataRuleListResponse,
    DataRuleResourcesResponse,
    DataRuleScopesResponse,
    DataRuleSingleResponse,
    DataRuleScopeType,
    DataRuleModelType,
    DenyBySubjectCodePayload,
    RevokeDenyResponse,
    UpdateDataRulePayload,
} from '../../types/dataRules.types';

const BASE_PATH = '/api/backend/access-control/data-rules';

// ─── List & Detail ───────────────────────────────────────────────────────────

export const getDataRules = async (filters: DataRuleFilters = {}): Promise<DataRuleListResponse> => {
    const response = await apiClient.get<DataRuleListResponse>(BASE_PATH, { params: filters });
    return response.data;
};

export const getDataRule = async (id: number): Promise<DataRule> => {
    const response = await apiClient.get<DataRuleSingleResponse>(`${BASE_PATH}/${id}`);
    return response.data.data;
};

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export const createDataRule = async (payload: CreateDataRulePayload): Promise<DataRule> => {
    const response = await apiClient.post<DataRuleSingleResponse>(BASE_PATH, payload);
    return response.data.data;
};

export const updateDataRule = async (id: number, payload: UpdateDataRulePayload): Promise<DataRule> => {
    const response = await apiClient.put<DataRuleSingleResponse>(`${BASE_PATH}/${id}`, payload);
    return response.data.data;
};

export const deleteDataRule = async (id: number): Promise<DataRuleDeleteResponse> => {
    const response = await apiClient.delete<DataRuleDeleteResponse>(`${BASE_PATH}/${id}`);
    return response.data;
};

// ─── Comfort endpoints ────────────────────────────────────────────────────────

export const denyBySubjectCode = async (payload: DenyBySubjectCodePayload): Promise<DataRule> => {
    const response = await apiClient.post<DataRuleSingleResponse>(`${BASE_PATH}/deny-by-subject-code`, payload);
    return response.data.data;
};

export const revokeDenyBySubjectCode = async (payload: DenyBySubjectCodePayload): Promise<RevokeDenyResponse> => {
    const response = await apiClient.post<RevokeDenyResponse>(`${BASE_PATH}/revoke-deny-by-subject-code`, payload);
    return response.data;
};

export const bulkReplaceDataRules = async (payload: BulkReplacePayload): Promise<BulkReplaceResponse> => {
    const response = await apiClient.post<BulkReplaceResponse>(`${BASE_PATH}/bulk-replace`, payload);
    return response.data;
};

// ─── Selector endpoints ───────────────────────────────────────────────────────

export const getDataRuleScopes = async (scopeType: DataRuleScopeType): Promise<DataRuleScopesResponse> => {
    const response = await apiClient.get<DataRuleScopesResponse>(`${BASE_PATH}/scopes`, {
        params: { type: scopeType },
    });
    return response.data;
};

export const getDataRuleResources = async (modelType: DataRuleModelType): Promise<DataRuleResourcesResponse> => {
    const response = await apiClient.get<DataRuleResourcesResponse>(`${BASE_PATH}/resources`, {
        params: { model_type: modelType },
    });
    return response.data;
};
