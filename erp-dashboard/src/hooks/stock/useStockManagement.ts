import { useEffect, useState, useCallback } from 'react';
import { stockManagementApi } from '@/services/api/stockManagementApi';
import type {
    StockListResponse,
    StockFilters,
    MovementListResponse,
    MovementFilters,
    EffectiveStockResponse,
    EffectiveStockFilters,
    CreateProvisionalRequest,
    ReconcileX3Request,
    ApiSuccessResponse,
} from '@/types/stock.types';

// ─── List Stocks ──────────────────────────────────────────────────────────────

export const useStockList = (filters: StockFilters) => {
    const [data, setData] = useState<StockListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = useCallback(async () => {
        if (!filters.branch_code) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await stockManagementApi.getStocks(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des stocks');
            console.error('Failed to fetch stocks:', err);
        } finally {
            setLoading(false);
        }
    }, [filters.branch_code, filters.search, filters.low_stock, filters.out_of_stock, filters.page]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    return { data, loading, error, refetch: fetchList };
};

// ─── List Movements ───────────────────────────────────────────────────────────

export const useStockMovements = (filters: MovementFilters) => {
    const [data, setData] = useState<MovementListResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchMovements = useCallback(async () => {
        if (!filters.branch_code) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await stockManagementApi.getMovements(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des mouvements');
            console.error('Failed to fetch movements:', err);
        } finally {
            setLoading(false);
        }
    }, [
        filters.branch_code, filters.type, filters.movement_status,
        filters.source_system, filters.product_id, filters.date_from, filters.date_to, filters.page,
    ]);

    useEffect(() => {
        fetchMovements();
    }, [fetchMovements]);

    return { data, loading, error, refetch: fetchMovements };
};

// ─── Effective Stock Breakdown ────────────────────────────────────────────────

export const useEffectiveStock = (filters: EffectiveStockFilters | null) => {
    const [data, setData] = useState<EffectiveStockResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEffective = useCallback(async () => {
        if (!filters?.product_id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await stockManagementApi.getEffectiveStock(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du stock effectif');
            console.error('Failed to fetch effective stock:', err);
        } finally {
            setLoading(false);
        }
    }, [filters?.product_id, filters?.branch_code]);

    useEffect(() => {
        fetchEffective();
    }, [fetchEffective]);

    return { data, loading, error, refetch: fetchEffective };
};

// ─── Create Provisional Movement ─────────────────────────────────────────────

export const useCreateProvisional = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createProvisional = async (payload: CreateProvisionalRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await stockManagementApi.createProvisional(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec de la création');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { createProvisional, loading, error };
};

// ─── Reconcile From X3 ───────────────────────────────────────────────────────

export const useReconcileX3 = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reconcile = async (payload: ReconcileX3Request): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await stockManagementApi.reconcileX3(payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec de la réconciliation');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { reconcile, loading, error };
};
