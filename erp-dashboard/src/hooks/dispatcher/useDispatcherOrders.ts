import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DispatcherOrdersPendingResponse, DispatcherOrderDetailResponse } from '@/types/dispatcher.types';

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

export const useDispatcherOrderDetail = (orderId: number | null) => {
    const [data, setData] = useState<DispatcherOrderDetailResponse | null>(null);
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
            setError(err instanceof Error ? err.message : 'Failed to fetch order');
            console.error('Failed to fetch order:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrder();
    }, [orderId]);

    return { data, loading, error, refetch: fetchOrder };
};

export const useConvertToBl = () => {
    const [loading, setLoading] = useState(false);

    const convert = async (orderId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.orders.convertToBl(orderId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { convert, loading };
};

export const useConvertMultipleToBl = () => {
    const [loading, setLoading] = useState(false);

    const convertMultiple = async (orderIds: number[]) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.orders.convertMultipleToBl(orderIds);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { convertMultiple, loading };
};
