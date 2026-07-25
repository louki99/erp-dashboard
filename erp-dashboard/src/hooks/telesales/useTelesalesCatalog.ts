import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { CatalogProduct, CatalogPage } from '@/types/telesalesAgent.types';

export const useCatalogProducts = (filters: { search?: string; product_page_code?: string; partner_id?: number; per_page?: number; page?: number }) => {
    const [products, setProducts] = useState<CatalogProduct[]>([]);
    const [pagination, setPagination] = useState<{ current_page: number; total_pages: number; total: number; per_page: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.catalog.getProducts(filters);
            setProducts(result.products);
            setPagination(result.pagination);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du catalogue');
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.search, filters.product_page_code, filters.partner_id, filters.per_page, filters.page]);

    useEffect(() => { fetch(); }, [fetch]);

    return { products, pagination, loading, error, refetch: fetch };
};

export const useCatalogPages = () => {
    const [pages, setPages] = useState<CatalogPage[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const result = await telesalesApi.catalog.getPages();
                setPages(result.pages);
            } catch {
                setPages([]);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    return { pages, loading };
};
