import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { PaginatedResponse, Partner, PartnerDetailResponse, PartnerFilters } from '@/types/adv.types';

/**
 * Custom hook to fetch pending partners list
 * @param filters - Optional filters for partners list
 * @returns Partners list, loading state, error, and refetch function
 */
export const useAdvPartners = (filters?: PartnerFilters) => {
    const [data, setData] = useState<PaginatedResponse<Partner> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPartners = async () => {
        setLoading(true);
        setError(null);

        try {
            const partnersData = await advApi.partners.getPending(filters);
            setData(partnersData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch partners');
            console.error('Failed to fetch partners:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPartners();
    }, [filters?.status, filters?.page]);

    return { partners: data, loading, error, refetch: fetchPartners };
};

/**
 * Custom hook to fetch partner detail by ID
 * @param partnerId - Partner ID
 * @returns Partner detail data, loading state, error, and refetch function
 */
export const useAdvPartnerDetail = (partnerId: number | null) => {
    const [data, setData] = useState<PartnerDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchPartnerDetail = async () => {
        if (!partnerId) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const partnerDetail = await advApi.partners.getById(partnerId);
            setData(partnerDetail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch partner detail');
            console.error('Failed to fetch partner detail:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPartnerDetail();
    }, [partnerId]);

    return {
        partner: data?.partner || null,
        creditHistory: data?.creditHistory || [],
        paymentHistory: data?.paymentHistory || [],
        loading,
        error,
        refetch: fetchPartnerDetail,
    };
};
