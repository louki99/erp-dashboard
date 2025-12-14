import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DechargesResponse, DechargeDetailResponse } from '@/types/dispatcher.types';

export const useDispatcherDechargesList = (filters?: { type?: string; status?: string; search?: string; page?: number }) => {
    const [data, setData] = useState<DechargesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDecharges = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.decharges.getList(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch decharges');
            console.error('Failed to fetch decharges:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDecharges();
    }, [filters?.type, filters?.status, filters?.search, filters?.page]);

    return { data, loading, error, refetch: fetchDecharges };
};

export const useDispatcherDechargeDetail = (dechargeId: number | null) => {
    const [data, setData] = useState<DechargeDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDecharge = async () => {
        if (!dechargeId) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.decharges.getById(dechargeId);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch decharge');
            console.error('Failed to fetch decharge:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDecharge();
    }, [dechargeId]);

    return { data, loading, error, refetch: fetchDecharge };
};

export const useApproveDechargeReturn = () => {
    const [loading, setLoading] = useState(false);

    const approve = async (dechargeId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.decharges.approveReturn(dechargeId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { approve, loading };
};

export const useRejectDecharge = () => {
    const [loading, setLoading] = useState(false);

    const reject = async (dechargeId: number, reason: string) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.decharges.reject(dechargeId, reason);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { reject, loading };
};
