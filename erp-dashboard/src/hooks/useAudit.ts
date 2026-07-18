import { useState, useCallback } from 'react';
import * as auditApi from '../services/api/auditApi';
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
} from '../types/audit.types';

// ─── Generic helper ───────────────────────────────────────────────────────────

function useAsync<T>() {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(async (fn: () => Promise<T>) => {
        setLoading(true);
        setError(null);
        try {
            const result = await fn();
            setData(result);
            return result;
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur inattendue';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, setData, loading, error, run };
}

// ─── Activities ───────────────────────────────────────────────────────────────

export function useActivities() {
    const { data, loading, error, run } = useAsync<PaginatedActivityLogs>();

    const fetch = useCallback((filters: ActivityFilters) => {
        return run(() => auditApi.getActivities(filters));
    }, [run]);

    return { activities: data, loading, error, fetch };
}

export function useActivityDetail() {
    const { data, loading, error, run } = useAsync<ActivityDetailResponse>();

    const fetch = useCallback((id: number) => {
        return run(() => auditApi.getActivityById(id));
    }, [run]);

    return { detail: data, loading, error, fetch };
}

// ─── Anomalies ────────────────────────────────────────────────────────────────

export function useAnomalies() {
    const { data, loading, error, run } = useAsync<PaginatedAnomalyLogs>();

    const fetch = useCallback((filters: AnomalyFilters) => {
        return run(() => auditApi.getAnomalies(filters));
    }, [run]);

    return { anomalies: data, loading, error, fetch };
}

export function useAnomalyDetail() {
    const { data, loading, error, run } = useAsync<AnomalyLog>();

    const fetch = useCallback((id: number) => {
        return run(() => auditApi.getAnomalyById(id));
    }, [run]);

    return { detail: data, loading, error, fetch };
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function useExportLogs() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (payload: ExportRequest): Promise<ExportResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await auditApi.exportLogs(payload);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur export';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { execute, loading, error };
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export function useAuditSettings() {
    const { data, setData, loading, error, run } = useAsync<AuditSettings>();

    const fetch = useCallback(() => {
        return run(() => auditApi.getAuditSettings());
    }, [run]);

    const save = useCallback(async (payload: UpdateAuditSettingsRequest) => {
        const updated = await auditApi.updateAuditSettings(payload);
        setData(updated);
        return updated;
    }, [setData]);

    return { settings: data, loading, error, fetch, save };
}

// ─── DB Deletion Log ─────────────────────────────────────────────────────────

export function useDbDeletions() {
    const { data, loading, error, run } = useAsync<PaginatedDbDeletions>();

    const fetch = useCallback((filters: DbDeletionFilters) => {
        return run(() => auditApi.getDbDeletions(filters));
    }, [run]);

    return { deletions: data, loading, error, fetch };
}

export function useDbDeletionCascade() {
    const { data, loading, error, run } = useAsync<DbDeletion[]>();

    const fetch = useCallback((txnId: number) => {
        return run(() => auditApi.getDbDeletionsByTransaction(txnId));
    }, [run]);

    return { cascade: data, loading, error, fetch };
}

// ─── Purge ────────────────────────────────────────────────────────────────────

export function usePurgeLogs() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = useCallback(async (payload: PurgeRequest): Promise<PurgeResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await auditApi.purgeAuditLogs(payload);
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur purge';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return { execute, loading, error };
}
