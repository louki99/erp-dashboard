import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { CreateOrderRequest, RequestDerogationRequest, TelesalesOrder, OrderSummaryResponse } from '@/types/telesalesAgent.types';

export const useOrderDetail = (id: number | null) => {
    const [order, setOrder] = useState<TelesalesOrder | null>(null);
    const [loading, setLoading] = useState(!!id);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await telesalesApi.orders.getDetail(id);
            setOrder(res.order);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement de la commande');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { order, setOrder, loading, error, refetch: fetch };
};

export const useCreateOrder = () => {
    const [loading, setLoading] = useState(false);
    const createOrder = useCallback(async (data: CreateOrderRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.orders.create(data);
            return res.order;
        } finally {
            setLoading(false);
        }
    }, []);
    return { createOrder, loading };
};

export const useUpdateOrder = () => {
    const [loading, setLoading] = useState(false);
    const updateOrder = useCallback(async (id: number, data: Partial<CreateOrderRequest>) => {
        setLoading(true);
        try {
            const res = await telesalesApi.orders.update(id, data);
            return res.order;
        } finally {
            setLoading(false);
        }
    }, []);
    return { updateOrder, loading };
};

// Agent's own orders list (§5) — backs the "Mes commandes" left panel. Also
// used with `partner_id` (correctif 2026-08) to show a partner's real order
// history — `order_history` on the visit/planning partner object is an
// aggregated snapshot only, not a browsable list.
export const useOrdersList = (filters: { status?: string; search?: string; partner_id?: number } = {}) => {
    const [orders, setOrders] = useState<TelesalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await telesalesApi.orders.getList({
                status: filters.status || undefined,
                search: filters.search || undefined,
                partner_id: filters.partner_id || undefined,
            });
            setOrders(res.orders);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des commandes');
        } finally {
            setLoading(false);
        }
    }, [filters.status, filters.search, filters.partner_id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { orders, loading, error, refetch: fetch };
};

// §5.5 — orders scheduled for a given day (dashboard "Programmées" section).
export const useScheduledOrders = (date?: string) => {
    const [orders, setOrders] = useState<TelesalesOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await telesalesApi.orders.getScheduled(date ? { date } : undefined);
            setOrders(res.orders);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des commandes programmées');
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => { fetch(); }, [fetch]);

    return { orders, loading, error, refetch: fetch };
};

// 422 credit-exceeded (docs §5.3) is a normal business state — this hook lets the
// order-taking screen distinguish it from a hard failure via err.response.data.credit_validation.
export const useSubmitOrder = () => {
    const [loading, setLoading] = useState(false);
    const submit = useCallback(async (id: number) => {
        setLoading(true);
        try {
            return await telesalesApi.orders.submit(id);
        } finally {
            setLoading(false);
        }
    }, []);
    return { submit, loading };
};

// §5.2-bis — fetched on demand when the agent opens the récapitulatif step,
// not on mount, since it only makes sense once an order (draft) exists.
export const useOrderSummary = () => {
    const [summary, setSummary] = useState<OrderSummaryResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const fetchSummary = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const res = await telesalesApi.orders.getSummary(id);
            setSummary(res);
            return res;
        } finally {
            setLoading(false);
        }
    }, []);
    const reset = useCallback(() => setSummary(null), []);
    return { summary, loading, fetchSummary, reset };
};

export const useRequestDerogation = () => {
    const [loading, setLoading] = useState(false);
    const requestDerogation = useCallback(async (id: number, data: RequestDerogationRequest, idempotencyKey?: string) => {
        setLoading(true);
        try {
            return await telesalesApi.orders.requestDerogation(id, data, idempotencyKey);
        } finally {
            setLoading(false);
        }
    }, []);
    return { requestDerogation, loading };
};
