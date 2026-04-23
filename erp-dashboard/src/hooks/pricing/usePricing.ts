import { useState, useEffect, useCallback } from 'react';
import * as pricingApi from '../../services/api/pricingApi';
import type {
    PriceListFilters,
    PriceList,
    PaginatedResponse,
    UpdatePriceListRequest,
    OverrideFilters,
    PriceOverride,
    CreateLineRequest,
    UpdateLineRequest,
    UpsertDetailsRequest,
    DuplicateLineRequest,
    ImportCsvParams,
    CreateOverrideRequest,
    PackagingPrice,
    CreatePackagingPriceRequest,
    PriceListLine,
    LineDetail,
} from '../../types/pricing.types';

// ─── Price Lists Hooks ──────────────────────────────────────────────────────

export const usePriceLists = (filters: PriceListFilters) => {
    const [data, setData] = useState<PaginatedResponse<PriceList> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPriceLists = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // API returns the paginated "lists" object directly
            const result = await pricingApi.getPriceLists(filters);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des listes de prix');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.per_page, filters.search, filters.rank]);

    useEffect(() => {
        fetchPriceLists();
    }, [fetchPriceLists]);

    return { data, loading, error, refetch: fetchPriceLists };
};

export const usePriceListDetail = (id: number | null) => {
    const [data, setData] = useState<PriceList | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        if (!id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const pl = await pricingApi.getPriceList(id);
            setData(pl);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement de la liste de prix');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    return { data, loading, error, refetch: fetchDetail };
};

// ─── Line Details Hook ──────────────────────────────────────────────────────

export const useLineDetails = (priceListId: number | null, lineNumber: number | null) => {
    const [data, setData] = useState<PriceListLine | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchLine = useCallback(async () => {
        if (!priceListId || !lineNumber) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await pricingApi.getLineDetails(priceListId, lineNumber);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement de la ligne');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [priceListId, lineNumber]);

    useEffect(() => {
        fetchLine();
    }, [fetchLine]);

    return { data, loading, error, refetch: fetchLine };
};

// ─── Overrides Hook ─────────────────────────────────────────────────────────

export const useOverrides = (filters: OverrideFilters) => {
    const [data, setData] = useState<PaginatedResponse<PriceOverride> | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOverrides = useCallback(async () => {
        // Avoid fetching if minimal filters aren't present if needed, but usually we want to fetch initial data
        setLoading(true);
        setError(null);
        try {
            const response = await pricingApi.getOverrides(filters);
            setData(response.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des dérogations');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.per_page, filters.price_list_id, filters.partner_id, filters.product_id, filters.active, filters.search]);

    useEffect(() => {
        fetchOverrides();
    }, [fetchOverrides]);

    return { data, loading, error, refetch: fetchOverrides };
};

// ─── Packaging Prices Hook ──────────────────────────────────────────────────

export const usePackagingPrices = (filters: { price_list_id?: number; line_detail_id?: number; page?: number; per_page?: number }) => {
    const [data, setData] = useState<PaginatedResponse<PackagingPrice> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchPrices = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await pricingApi.getPackagingPrices(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des prix conditionnements');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.per_page, filters.price_list_id, filters.line_detail_id]);

    useEffect(() => {
        fetchPrices();
    }, [fetchPrices]);

    return { data, loading, error, refetch: fetchPrices };
};

// ─── Mutation Hooks ─────────────────────────────────────────────────────────

// Helper for basic mutations
const useMutation = <T, R>(mutationFn: (args: T) => Promise<any>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (args: T): Promise<R> => {
        setLoading(true);
        setError(null);
        try {
            const result = await mutationFn(args);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
};

export const useCreatePriceList = () => useMutation(pricingApi.createPriceList);
export const useUpdatePriceList = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdatePriceListRequest }, any>(
        async ({ id, data }) => pricingApi.updatePriceList(id, data)
    );
    return { updatePriceList: execute, loading, error };
};
export const useDeletePriceList = () => useMutation((id: number) => pricingApi.deletePriceList(id));

export const useCreateLine = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; data: CreateLineRequest }, PriceListLine>(
        async ({ priceListId, data }) => pricingApi.createLine(priceListId, data)
    );
    return { createLine: execute, loading, error };
};

export const useUpdateLine = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; lineId: number; data: UpdateLineRequest }, PriceListLine>(
        async ({ priceListId, lineId, data }) => pricingApi.updateLine(priceListId, lineId, data)
    );
    return { updateLine: execute, loading, error };
};

export const useUpsertDetails = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; lineId: number; data: UpsertDetailsRequest }, LineDetail[]>(
        async ({ priceListId, lineId, data }) => pricingApi.upsertLineDetails(priceListId, lineId, data)
    );
    return { upsertDetails: execute, loading, error };
};

export const useClearLineDetails = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; lineId: number }, any>(
        async ({ priceListId, lineId }) => pricingApi.clearLineDetails(priceListId, lineId)
    );
    return { clearLineDetails: execute, loading, error };
};

export const useDuplicateLine = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; data: DuplicateLineRequest }, PriceListLine>(
        async ({ priceListId, data }) => pricingApi.duplicateLine(priceListId, data)
    );
    return { duplicateLine: execute, loading, error };
};

export const useImportCsv = () => {
    const { loading, error, execute } = useMutation<{ priceListId: number; lineId: number; params: ImportCsvParams }, any>(
        async ({ priceListId, lineId, params }) => pricingApi.importLineCsv(priceListId, lineId, params)
    );
    return { importCsv: execute, loading, error };
};

export const useCreateOverride = () => useMutation(pricingApi.createOverride);
export const useUpdateOverride = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: Partial<CreateOverrideRequest> }, PriceOverride>(
        async ({ id, data }) => pricingApi.updateOverride(id, data)
    );
    return { updateOverride: execute, loading, error };
};
export const useToggleOverride = () => useMutation(pricingApi.toggleOverride);
export const useDeleteOverride = () => useMutation(pricingApi.deleteOverride);
export const usePreviewPrice = () => useMutation(pricingApi.previewPrice);

export const useCreatePackagingPrice = () => useMutation(pricingApi.createPackagingPrice);
export const useUpdatePackagingPrice = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: Partial<CreatePackagingPriceRequest> }, PackagingPrice>(
        async ({ id, data }) => pricingApi.updatePackagingPrice(id, data)
    );
    return { updatePackagingPrice: execute, loading, error };
};
export const useDeletePackagingPrice = () => useMutation(pricingApi.deletePackagingPrice);
