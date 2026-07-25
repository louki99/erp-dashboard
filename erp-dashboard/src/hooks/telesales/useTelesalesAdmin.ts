import { useCallback, useEffect, useState } from 'react';
import { telesalesAdminApi } from '@/services/api/telesalesAdminApi';
import { rbacApi } from '@/services/api/rbacApi';
import type {
    TelesalesAgentOption,
    SchedulesListFilters,
    AssignmentsListFilters,
    TeleVisit,
    TelesalesAssignmentJoined,
} from '@/types/telesales.types';
import type {
    CreateScheduleRequest,
    CreateScheduleResponse,
    BulkScheduleRequest,
    BulkScheduleResponse,
    CreateAssignmentRequest,
    CreateAssignmentResponse,
    MonitoringSessionsResponse,
    MonitoringKpisResponse,
} from '@/types/telesales.types';

// ─── Generic mutation helper (same shape as usePartners.ts) ─────────────────

const useMutation = <T, R>(mutationFn: (args: T) => Promise<R>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (args: T): Promise<R> => {
        setLoading(true);
        setError(null);
        try {
            return await mutationFn(args);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
};

// ─── Agent lookup (role: télévendeur) — no dedicated telesales endpoint,     ─
// ─── reuses GET /rbac/users?role=televendeur ─────────────────────────────────

export const useTelesalesAgents = () => {
    const [data, setData] = useState<TelesalesAgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await rbacApi.getUsers({ role: 'televendeur', per_page: 200 });
            setData(result.data.data.map((u) => ({ id: u.id, name: u.name, email: u.email })));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des télévendeurs');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Schedules (§7.1–7.3) ─────────────────────────────────────────────────────

export const useSchedulesList = (filters: SchedulesListFilters) => {
    const [data, setData] = useState<TeleVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesAdminApi.schedules.getList(filters);
            // Defensive: the exact envelope for this GET wasn't in the original spec doc
            // (added later as a fix) — guard against a paginator wrapper (`visits.data`)
            // or an unexpected shape instead of assuming a flat array.
            const raw: unknown = result?.visits;
            const list = Array.isArray(raw)
                ? raw
                : Array.isArray((raw as { data?: unknown })?.data)
                    ? (raw as { data: TeleVisit[] }).data
                    : [];
            if (!Array.isArray(raw) && raw !== undefined) {
                console.warn('[telesales] Unexpected GET /schedules response shape:', result);
            }
            setData(list);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du semainier');
        } finally {
            setLoading(false);
        }
    }, [filters.user_id, filters.date_from, filters.date_to]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

export const useCreateSchedule = () => {
    const { execute, loading, error } = useMutation<CreateScheduleRequest, CreateScheduleResponse>(
        (data) => telesalesAdminApi.schedules.create(data)
    );
    return { createSchedule: execute, loading, error };
};

export const useBulkCreateSchedules = () => {
    const { execute, loading, error } = useMutation<BulkScheduleRequest, BulkScheduleResponse>(
        (data) => telesalesAdminApi.schedules.bulkCreate(data)
    );
    return { bulkCreateSchedules: execute, loading, error };
};

export const useDeleteSchedule = () => useMutation((id: number) => telesalesAdminApi.schedules.remove(id));

// ─── Assignments (§7.4) ───────────────────────────────────────────────────────

export const useAssignmentsList = (filters: AssignmentsListFilters) => {
    const [data, setData] = useState<TelesalesAssignmentJoined[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesAdminApi.assignments.getList(filters);
            // Defensive: same envelope-shape uncertainty as GET /schedules above.
            const raw: unknown = result?.assignments;
            const list = Array.isArray(raw)
                ? raw
                : Array.isArray((raw as { data?: unknown })?.data)
                    ? (raw as { data: TelesalesAssignmentJoined[] }).data
                    : [];
            if (!Array.isArray(raw) && raw !== undefined) {
                console.warn('[telesales] Unexpected GET /assignments response shape:', result);
            }
            setData(list);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du portefeuille');
        } finally {
            setLoading(false);
        }
    }, [filters.user_id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

export const useCreateAssignment = () => {
    const { execute, loading, error } = useMutation<CreateAssignmentRequest, CreateAssignmentResponse>(
        (data) => telesalesAdminApi.assignments.create(data)
    );
    return { createAssignment: execute, loading, error };
};

// ─── Monitoring (§7.5–7.6) ────────────────────────────────────────────────────

export const useMonitoringSessions = (pollIntervalMs?: number) => {
    const [data, setData] = useState<MonitoringSessionsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setError(null);
        try {
            const result = await telesalesAdminApi.monitoring.getSessions();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des sessions');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setLoading(true);
        fetch();
        if (!pollIntervalMs) return;
        const interval = setInterval(fetch, pollIntervalMs);
        return () => clearInterval(interval);
    }, [fetch, pollIntervalMs]);

    return { data, loading, error, refetch: fetch };
};

export const useMonitoringKpis = (filters: { date_from?: string; date_to?: string }) => {
    const [data, setData] = useState<MonitoringKpisResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesAdminApi.monitoring.getKpis(filters);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des KPIs');
        } finally {
            setLoading(false);
        }
    }, [filters.date_from, filters.date_to]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};
