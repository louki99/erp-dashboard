import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { PaginatedResponse, DispatcherOrder, OrdersPendingFilters } from '@/types/dispatcher.types';

// Helpers to read either flat or meta-wrapped pagination
const getTotal   = (r: PaginatedResponse<unknown>) => r.meta?.total    ?? r.total    ?? 0;
const getLastPage= (r: PaginatedResponse<unknown>) => r.meta?.last_page ?? r.last_page ?? 1;
const getCurrent = (r: PaginatedResponse<unknown>) => r.meta?.current_page ?? r.current_page ?? 1;

export type { PaginatedResponse };
export { getTotal, getLastPage, getCurrent };

export const useDispatcherPendingOrders = (filters?: OrdersPendingFilters) => {
    const [data, setData] = useState<PaginatedResponse<DispatcherOrder> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await dispatcherApi.orders.getPending(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement des commandes');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [
        filters?.search,
        filters?.date_from,
        filters?.date_to,
        filters?.page,
        filters?.per_page,
        filters?.branch_id,
        filters?.salesperson_id,
        filters?.geo_area_id,
        filters?.delivery_zone,
        filters?.itinerary_id,
        filters?.lat_min,
        filters?.lat_max,
        filters?.lng_min,
        filters?.lng_max,
        filters?.sort_by,
        filters?.sort_dir,
    ]);

    return { data, loading, error, refetch: fetchOrders };
};

export const useDispatcherOrderDetail = (orderId: number | null) => {
    const [data, setData] = useState<DispatcherOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOrder = async () => {
        if (!orderId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await dispatcherApi.orders.getById(orderId);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erreur lors du chargement de la commande');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (orderId) fetchOrder();
        else setData(null);
    }, [orderId]);

    return { data, loading, error, refetch: fetchOrder };
};
