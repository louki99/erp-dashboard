import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { BCListResponse, BCFilters } from '@/types/adv.types';

/**
 * Custom hook to fetch BC list with filters
 * @param filters - Optional filters for BC list
 * @returns BC list data, stats, loading state, error, and refetch function
 */
export const useAdvBCList = (filters?: BCFilters) => {
    const [data, setData] = useState<BCListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBCList = async () => {
        setLoading(true);
        setError(null);

        try {
            const bcData = await advApi.bc.getList(filters);
            setData(bcData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BC list');
            console.error('Failed to fetch BC list:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBCList();
    }, [filters?.status, filters?.search, filters?.page]);

    return {
        bcs: data?.bcs || null,
        stats: data?.stats || null,
        loading,
        error,
        refetch: fetchBCList,
    };
};
