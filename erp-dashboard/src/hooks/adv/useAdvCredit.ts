import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { CreditListResponse, CreditFilters } from '@/types/adv.types';

/**
 * Custom hook to fetch credit management data
 * @param filters - Optional filters for credit list
 * @returns Credit list data, stats, loading state, error, and refetch function
 */
export const useAdvCredit = (filters?: CreditFilters) => {
    const [data, setData] = useState<CreditListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCredit = async () => {
        setLoading(true);
        setError(null);

        try {
            const creditData = await advApi.credit.getList(filters);
            setData(creditData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch credit data');
            console.error('Failed to fetch credit data:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCredit();
    }, [filters?.page, filters?.min_utilization, filters?.max_utilization]);

    return {
        partners: data?.partners || null,
        totalExposure: data?.totalExposure,
        totalLimit: data?.totalLimit,
        utilizationRate: data?.utilizationRate,
        loading,
        error,
        refetch: fetchCredit,
    };
};
