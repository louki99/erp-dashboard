import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { PartnerReturnSummary, CreateReturnRequest } from '@/types/telesalesAgent.types';

export const useReturnsList = (filters: { status?: string }) => {
    const [returns, setReturns] = useState<PartnerReturnSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.returns.getList(filters);
            setReturns(result.returns);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des retours');
        } finally {
            setLoading(false);
        }
    }, [filters.status]);

    useEffect(() => { fetch(); }, [fetch]);

    return { returns, loading, error, refetch: fetch };
};

export const useCreateReturn = () => {
    const [loading, setLoading] = useState(false);
    const createReturn = useCallback(async (data: CreateReturnRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.returns.create(data);
            return res.return;
        } finally {
            setLoading(false);
        }
    }, []);
    return { createReturn, loading };
};
