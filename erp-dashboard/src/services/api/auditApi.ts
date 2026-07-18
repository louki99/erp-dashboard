import apiClient from './client';
import type {
    ActivityFilters,
    AnomalyFilters,
    DbDeletionFilters,
    PaginatedActivityLogs,
    PaginatedAnomalyLogs,
    PaginatedDbDeletions,
    ActivityDetailResponse,
    AnomalyLog,
    DbDeletion,
    ExportRequest,
    ExportResponse,
    PurgeRequest,
    PurgeResponse,
    AuditSettings,
    UpdateAuditSettingsRequest,
} from '../../types/audit.types';

const BASE = '/api/backend/admin/logs';

// ─── Activities ───────────────────────────────────────────────────────────────

export const getActivities = async (filters: ActivityFilters): Promise<PaginatedActivityLogs> => {
    const res = await apiClient.get(`${BASE}/activities`, { params: filters });
    const data = res.data?.data;
    // When correlation_id is present the backend returns an unpaginated array (capped at 500)
    // instead of the normal Laravel paginator shape.
    if (Array.isArray(data)) {
        return { current_page: 1, data, total: data.length, per_page: data.length, last_page: 1 };
    }
    return data as PaginatedActivityLogs;
};

export const getActivityById = async (id: number): Promise<ActivityDetailResponse> => {
    const res = await apiClient.get(`${BASE}/activities/${id}`);
    return { data: res.data?.data, diff: res.data?.diff ?? [] };
};

// ─── Anomalies ────────────────────────────────────────────────────────────────

export const getAnomalies = async (filters: AnomalyFilters): Promise<PaginatedAnomalyLogs> => {
    const res = await apiClient.get(`${BASE}/anomalies`, { params: filters });
    return res.data?.data as PaginatedAnomalyLogs;
};

export const getAnomalyById = async (id: number): Promise<AnomalyLog> => {
    const res = await apiClient.get(`${BASE}/anomalies/${id}`);
    return res.data?.data as AnomalyLog;
};

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportLogs = async (payload: ExportRequest): Promise<ExportResponse> => {
    const res = await apiClient.post(`${BASE}/export/download`, payload);
    return res.data?.data as ExportResponse;
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export const getAuditSettings = async (): Promise<AuditSettings> => {
    const res = await apiClient.get(`${BASE}/settings`);
    return res.data?.data as AuditSettings;
};

export const updateAuditSettings = async (payload: UpdateAuditSettingsRequest): Promise<AuditSettings> => {
    const res = await apiClient.put(`${BASE}/settings`, payload);
    return res.data?.data as AuditSettings;
};

// ─── DB Deletion Log ─────────────────────────────────────────────────────────

export const getDbDeletions = async (filters: DbDeletionFilters): Promise<PaginatedDbDeletions> => {
    const res = await apiClient.get(`${BASE}/db-deletions`, { params: filters });
    return res.data?.data as PaginatedDbDeletions;
};

export const getDbDeletionsByTransaction = async (txnId: number): Promise<DbDeletion[]> => {
    const res = await apiClient.get(`${BASE}/db-deletions/transaction/${txnId}`);
    // Returns array directly (all rows in one Postgres transaction, ordered chronologically)
    const data = res.data?.data;
    return Array.isArray(data) ? data : (data?.data ?? []);
};

// ─── Purge ────────────────────────────────────────────────────────────────────

export const purgeAuditLogs = async (payload: PurgeRequest): Promise<PurgeResponse> => {
    const res = await apiClient.post(`${BASE}/purge`, payload);
    return res.data?.data as PurgeResponse;
};
