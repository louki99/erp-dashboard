import apiClient from './client';
import type {
    ConfigSettingsResponse,
    SaveBatchRequest,
    ResetSettingRequest,
    ScopeEntity,
} from '@/types/config.types';

const SETTINGS_PATH = '/api/backend/settings';
const MASTERDATA_PATH = '/api/backend/masterdata';

// ─── Normalize masterdata response ────────────────────────────────────────────

const extractList = (d: unknown): any[] => {
    if (Array.isArray(d)) return d;
    if (d && typeof d === 'object') {
        const obj = d as Record<string, unknown>;
        if (Array.isArray(obj.data)) return obj.data as any[];
        for (const key of Object.keys(obj)) {
            if (Array.isArray(obj[key])) return obj[key] as any[];
        }
    }
    return [];
};

// ─── Settings CRUD ────────────────────────────────────────────────────────────

export const getSettings = async (
    type: string,
    id: number,
    keyFilter?: string
): Promise<ConfigSettingsResponse> => {
    const params: Record<string, string> = { type, id: String(id) };
    if (keyFilter) params.key = keyFilter;
    const response = await apiClient.get<ConfigSettingsResponse>(SETTINGS_PATH, { params });
    return response.data;
};

export const saveBatch = async (data: SaveBatchRequest): Promise<ConfigSettingsResponse> => {
    const response = await apiClient.post<ConfigSettingsResponse>(
        `${SETTINGS_PATH}/save-batch`,
        data
    );
    return response.data;
};

export const resetSetting = async (data: ResetSettingRequest): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(
        `${SETTINGS_PATH}/reset`,
        { data }
    );
    return response.data;
};

// ─── System params catalog (for column headers / default values) ──────────────

export const getSystemParams = async (): Promise<{ key: string; value_type: string; default_value: unknown; description?: string }[]> => {
    const response = await apiClient.get('/api/backend/admin/system-settings');
    const d = response.data;
    return Array.isArray(d) ? d : (d?.data ?? d?.params ?? []);
};

export const getSfaParams = async (prefix?: string, search?: string): Promise<import('@/types/config.types').SfaParamsResponse> => {
    const queryParams: Record<string, string> = {};
    if (prefix) queryParams.prefix = prefix;
    if (search) queryParams.search = search;
    const response = await apiClient.get(`${MASTERDATA_PATH}/sfa-params`, { params: queryParams });
    const d = response.data;
    // Actual response: { success: true, data: [...], grouped: { visit: [...], ... } }
    // d.data is the flat array, d.grouped is the namespace map
    const paramsList: unknown[] = Array.isArray(d?.data)
        ? d.data
        : Array.isArray(d?.params)
            ? d.params
            : [];
    const grouped: Record<string, unknown[]> = d?.grouped ?? {};
    return { params: paramsList as any, grouped: grouped as any };
};

// ─── Entity pickers — all via /masterdata ─────────────────────────────────────

export const getRoles = async (q?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/roles`, {
        params: q ? { q } : {},
    });
    const list = extractList(response.data);
    return list.map((r: any) => ({ id: r.id, name: r.name, description: r.guard_name }));
};

export const getUsers = async (q?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/users`, {
        params: { ...(q ? { search: q } : {}), per_page: 50 },
    });
    const list = extractList(response.data);
    return list.map((u: any) => ({
        id: u.id,
        name: u.name || `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim(),
        description: u.email,
    }));
};

export const getAccessProfiles = async (q?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/access-profiles`, {
        params: q ? { q } : {},
    });
    const list = extractList(response.data);
    return list.map((p: any) => ({ id: p.id, name: p.name, description: p.description }));
};

export const getBranches = async (type?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/branches`, {
        params: type ? { type } : {},
    });
    const list = extractList(response.data);
    return list.map((b: any) => ({ id: b.id, name: b.name, description: b.type ?? b.code }));
};

export const getShops = async (branchId?: number): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/shops`, {
        params: branchId ? { branch_id: branchId } : {},
    });
    const list = extractList(response.data);
    return list.map((s: any) => ({ id: s.id, name: s.name, description: s.branch?.name ?? s.code }));
};

export const getCompanies = async (q?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/companies`, {
        params: q ? { q } : {},
    });
    const list = extractList(response.data);
    return list.map((c: any) => ({ id: c.id, name: c.name, description: c.code }));
};

export const getPartners = async (q?: string): Promise<ScopeEntity[]> => {
    const response = await apiClient.get(`${MASTERDATA_PATH}/partners`, {
        params: { ...(q ? { q } : {}), per_page: 50 },
    });
    const list = extractList(response.data);
    return list.map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.code,
        code: p.code,
    }));
};
