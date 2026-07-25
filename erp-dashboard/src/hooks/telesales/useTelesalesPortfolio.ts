import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { PortfolioPartner } from '@/types/telesalesAgent.types';

export const usePortfolio = (search: string) => {
    const [partners, setPartners] = useState<PortfolioPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.portfolio.get({ search: search || undefined, per_page: 100 });
            setPartners(result.partners);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du portefeuille');
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => {
        const t = setTimeout(fetch, search ? 300 : 0);
        return () => clearTimeout(t);
    }, [fetch, search]);

    return { partners, loading, error, refetch: fetch };
};
