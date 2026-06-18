import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { EcheancesResponse, EcheancesStats, Invoice, EcheanceFilters } from '@/types/adv.types';

export const useAdvEcheances = (filters?: EcheanceFilters) => {
    const [data, setData] = useState<EcheancesResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEcheances = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await advApi.echeances.getList(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des échéances');
            console.error('Failed to fetch echeances:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEcheances();
    }, [filters?.page, filters?.partner_id, filters?.date_from, filters?.date_to, filters?.overdue_only]);

    const invoices: Invoice[] = data?.echeances?.data ?? [];
    const stats: EcheancesStats = data?.stats ?? { total_overdue: 0, total_due_this_week: 0, overdue_count: 0 };

    return { invoices, stats, loading, error, refetch: fetchEcheances };
};
