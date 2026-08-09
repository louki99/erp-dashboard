import { useState, useCallback, useEffect } from 'react';
import * as routeOptimizerApi from '../../services/api/routeOptimizerApi';
import type {
    OptimizeDispatchRequest,
    OptimizeDispatchResponse,
    OptimizerHealth,
} from '../../types/route-optimizer.types';

// ─── Batch ID ─────────────────────────────────────────────────────────────────

export function generateBatchId(): string {
    const date = new Date().toISOString().slice(0, 10);
    return `dispatch-${date}-${Date.now()}`;
}

// ─── Route optimizer ──────────────────────────────────────────────────────────

type OptimizeError = { type: 'validation' | 'solver_unavailable' | 'unknown'; message: string };

export function useRouteOptimizer() {
    const [result, setResult] = useState<OptimizeDispatchResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<OptimizeError | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);

    const optimize = useCallback(async (payload: OptimizeDispatchRequest) => {
        setLoading(true);
        setError(null);
        setResult(null);
        setConfirmed(false);
        setConfirmError(null);
        setCancelled(false);
        setCancelError(null);
        try {
            const res = await routeOptimizerApi.optimizeDispatch(payload);
            setResult(res);
            return res;
        } catch (err: any) {
            const status = err?.response?.status;
            const message = err?.response?.data?.message ?? err?.message ?? 'Erreur inattendue';
            const type: OptimizeError['type'] =
                status === 422 ? 'validation' :
                status === 500 ? 'solver_unavailable' : 'unknown';
            setError({ type, message });
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const confirm = useCallback(async (batchId: string) => {
        setConfirming(true);
        setConfirmError(null);
        try {
            await routeOptimizerApi.confirmBatch(batchId);
            setConfirmed(true);
        } catch (err: any) {
            const status = err?.response?.status;
            const message =
                status === 404
                    ? 'Lot introuvable — veuillez relancer l\'optimisation.'
                    : (err?.response?.data?.message ?? err?.message ?? 'Erreur confirmation');
            setConfirmError(message);
            throw err;
        } finally {
            setConfirming(false);
        }
    }, []);

    const cancel = useCallback(async (batchId: string) => {
        setCancelling(true);
        setCancelError(null);
        try {
            await routeOptimizerApi.cancelBatch(batchId);
            setCancelled(true);
        } catch (err: any) {
            const status = err?.response?.status;
            const message =
                status === 409
                    ? 'Ce lot est déjà confirmé — annulation impossible via cette action.'
                    : status === 404
                    ? 'Lot introuvable.'
                    : (err?.response?.data?.message ?? err?.message ?? 'Erreur annulation');
            setCancelError(message);
            throw err;
        } finally {
            setCancelling(false);
        }
    }, []);

    const reset = useCallback(() => {
        setResult(null);
        setError(null);
        setConfirmed(false);
        setConfirmError(null);
        setCancelled(false);
        setCancelError(null);
    }, []);

    return { result, loading, error, optimize, confirm, confirming, confirmed, confirmError, cancel, cancelling, cancelled, cancelError, reset };
}

// ─── Optimizer health ─────────────────────────────────────────────────────────

export function useOptimizerHealth() {
    const [health, setHealth] = useState<OptimizerHealth | null>(null);

    const check = useCallback(async () => {
        try {
            const h = await routeOptimizerApi.getOptimizerHealth();
            setHealth(h);
        } catch (err: any) {
            // 404 = health endpoint not implemented yet — don't block the optimizer
            if (err?.response?.status === 404) {
                setHealth(null);
                return;
            }
            setHealth({
                status: 'unhealthy',
                database_connected: false,
                osrm_connected: false,
                solver_connected: false,
            });
        }
    }, []);

    useEffect(() => { check(); }, [check]);

    return { health, recheck: check };
}
