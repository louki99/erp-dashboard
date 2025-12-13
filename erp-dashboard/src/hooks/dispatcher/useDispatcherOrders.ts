import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DispatcherOrdersPendingResponse } from '@/types/dispatcher.types';

export const useDispatcherPendingOrders = (filters?: { search?: string; date_from?: string; date_to?: string; page?: number }) => {
    const [data, setData] = useState<DispatcherOrdersPendingResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.orders.getPending(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch pending orders');
            console.error('Failed to fetch pending orders:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [filters?.search, filters?.date_from, filters?.date_to, filters?.page]);

    return { data, loading, error, refetch: fetchOrders };
};
