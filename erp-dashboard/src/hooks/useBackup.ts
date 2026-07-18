import { useState, useCallback, useRef, useEffect } from 'react';
import * as backupApi from '../services/api/backupApi';
import type {
    BackupListData,
    BackupOperation,
    BackupSchedule,
    CreateSchedulePayload,
    UpdateSchedulePayload,
} from '../types/backup.types';

// ─── Backup list ──────────────────────────────────────────────────────────────

export function useBackupList() {
    const [data, setData] = useState<BackupListData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await backupApi.listBackups();
            setData(result);
        } catch (err: any) {
            setError(err?.response?.data?.message ?? err?.message ?? 'Erreur chargement');
        } finally {
            setLoading(false);
        }
    }, []);

    return { data, loading, error, refresh };
}

// ─── Operation poller ─────────────────────────────────────────────────────────

const TERMINAL = new Set(['completed', 'failed']);

// Cap: 3 min of wall time. Backend guarantees terminal within 45 min via reap job,
// but 3 min is enough for a normal run (typical backup: ~6s). Past this cap, the UI
// stops auto-polling and shows "still running — refresh to check" instead of spinning forever.
const DEFAULT_TIMEOUT_MS = 3 * 60 * 1000;

export function usePollOperation(timeoutMs = DEFAULT_TIMEOUT_MS) {
    const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const activeRef  = useRef(false);
    const deadlineRef = useRef<number>(0);

    const stop = useCallback(() => {
        activeRef.current = false;
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    const start = useCallback(
        (
            operationId: number,
            onResult:  (op: BackupOperation) => void,
            onError?:  (err: string) => void,
            onTimeout?: () => void,
        ) => {
            stop();
            activeRef.current  = true;
            deadlineRef.current = Date.now() + timeoutMs;

            const tick = async () => {
                if (!activeRef.current) return;

                // Client-side cap — stop polling and surface "still running" state
                if (Date.now() >= deadlineRef.current) {
                    activeRef.current = false;
                    onTimeout?.();
                    return;
                }

                try {
                    const op = await backupApi.pollOperation(operationId);
                    if (!activeRef.current) return;
                    onResult(op);
                    if (!TERMINAL.has(op.status)) {
                        timerRef.current = setTimeout(tick, 2500);
                    } else {
                        activeRef.current = false;
                    }
                } catch (err: any) {
                    if (!activeRef.current) return;
                    const msg = err?.response?.data?.message ?? err?.message ?? 'Erreur polling';
                    if (onError) onError(msg);
                    // retry after 3s on network error (still subject to deadline above)
                    timerRef.current = setTimeout(tick, 3000);
                }
            };

            tick();
        },
        [stop, timeoutMs],
    );

    useEffect(() => () => stop(), [stop]);

    return { start, stop };
}

// ─── Schedules ────────────────────────────────────────────────────────────────

export function useSchedules() {
    const [schedules, setSchedules] = useState<BackupSchedule[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await backupApi.listSchedules();
            setSchedules(list);
        } catch (err: any) {
            setError(err?.response?.data?.message ?? err?.message ?? 'Erreur chargement');
        } finally {
            setLoading(false);
        }
    }, []);

    const create = useCallback(async (payload: CreateSchedulePayload): Promise<BackupSchedule> => {
        const created = await backupApi.createSchedule(payload);
        setSchedules(prev => [...prev, created]);
        return created;
    }, []);

    const update = useCallback(async (id: number, payload: UpdateSchedulePayload): Promise<BackupSchedule> => {
        const updated = await backupApi.updateSchedule(id, payload);
        setSchedules(prev => prev.map(s => (s.id === id ? updated : s)));
        return updated;
    }, []);

    const remove = useCallback(async (id: number): Promise<void> => {
        await backupApi.deleteSchedule(id);
        setSchedules(prev => prev.filter(s => s.id !== id));
    }, []);

    return { schedules, loading, error, refresh, create, update, remove };
}
