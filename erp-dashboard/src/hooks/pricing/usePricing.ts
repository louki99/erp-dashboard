import { useState, useEffect, useCallback } from 'react';
import * as pricingApi from '../../services/api/pricingApi';
import type {
    PriceListFilters,
    PriceList,
    PaginatedResponse,
    ApiSuccessResponse,
    UpdatePriceListRequest,
    OverrideFilters,
    PriceOverride,
    CreateLineRequest,
    UpdateLineRequest,
    UpsertDetailsRequest,
    DuplicateLineRequest,
    ImportCsvParams,
    BulkUpdateRequest,
    BulkUpdateResponse,
    ImportPriceListParams,
    ImportPriceListResponse,
    ExportPriceListParams,
    CreateOverrideRequest,
    PreviewPriceRequest,
    PreviewPriceResponse,
    PriceListLine,
    LineDetail,
    Channel,
    BusinessChronology,
    UpdateChannelRequest,
    UpdateBusinessChronologyRequest,
    PartnerChronologiesResponse,
    SyncChronologiesRequest,
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
    const [partners, setPartners] = useState<Array<{ id: number; code: string; name: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchOverrides = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await pricingApi.getOverrides(filters);
            setData(response.overrides);
            setPartners(response.partners ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des dérogations');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.per_page, filters.partner_id, filters.product_id, filters.active, filters.q]);

    useEffect(() => {
        fetchOverrides();
    }, [fetchOverrides]);

    return { data, partners, loading, error, refetch: fetchOverrides };
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

export const useCreatePriceList = () => {
    const { loading, error, execute } = useMutation(pricingApi.createPriceList);
    return { createPriceList: execute, execute, loading, error };
};
export const useUpdatePriceList = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdatePriceListRequest }, any>(
        async ({ id, data }) => pricingApi.updatePriceList(id, data)
    );
    return { updatePriceList: execute, loading, error };
};
export const useDeletePriceList = () => {
    const { loading, error, execute } = useMutation((id: number) => pricingApi.deletePriceList(id));
    return { deletePriceList: execute, execute, loading, error };
};

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

// ─── Price List Bulk Operations (Full-Screen Grid Enterprise ERP) ─────────────

export const useBulkUpdatePriceList = () => {
    const { loading, error, execute } = useMutation<
        { priceListId: number; data: BulkUpdateRequest },
        ApiSuccessResponse<BulkUpdateResponse>
    >(
        async ({ priceListId, data }) => pricingApi.bulkUpdatePriceList(priceListId, data)
    );
    return { bulkUpdatePriceList: execute, loading, error };
};

export const useImportPriceList = () => {
    const { loading, error, execute } = useMutation<
        { priceListId: number; params: ImportPriceListParams },
        ApiSuccessResponse<ImportPriceListResponse>
    >(
        async ({ priceListId, params }) => pricingApi.importPriceList(priceListId, params)
    );
    return { importPriceList: execute, loading, error };
};

export const useExportPriceList = () => {
    const { loading, error, execute } = useMutation<
        { priceListId: number; params: ExportPriceListParams },
        Blob
    >(
        async ({ priceListId, params }) => pricingApi.exportPriceList(priceListId, params)
    );
    return { exportPriceList: execute, loading, error };
};

export const useCreateOverride = () => {
    const { loading, error, execute } = useMutation<CreateOverrideRequest, any>(pricingApi.createOverride);
    return { createOverride: execute, execute, loading, error };
};
// PUT exige le payload complet du formulaire (partner_id et product_id requis)
export const useUpdateOverride = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: CreateOverrideRequest }, any>(
        async ({ id, data }) => pricingApi.updateOverride(id, data)
    );
    return { updateOverride: execute, loading, error };
};
export const useToggleOverride = () => {
    const { loading, error, execute } = useMutation<number, { success: boolean; message: string; active: boolean }>(pricingApi.toggleOverride);
    return { toggleOverride: execute, loading, error };
};
export const useDeleteOverride = () => {
    const { loading, error, execute } = useMutation<number, any>(pricingApi.deleteOverride);
    return { deleteOverride: execute, loading, error };
};
export const usePreviewPrice = () => useMutation<PreviewPriceRequest, PreviewPriceResponse>(pricingApi.previewPrice);

// ─── Channels (Module 20) ────────────────────────────────────────────────────

export const useChannels = () => {
    const [data, setData] = useState<Channel[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchChannels = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await pricingApi.getChannels();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des canaux');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchChannels();
    }, [fetchChannels]);

    return { data, loading, error, refetch: fetchChannels };
};

export const useCreateChannel = () => {
    const { loading, error, execute } = useMutation(pricingApi.createChannel);
    return { createChannel: execute, execute, loading, error };
};
export const useUpdateChannel = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdateChannelRequest }, Channel>(
        async ({ id, data }) => pricingApi.updateChannel(id, data)
    );
    return { updateChannel: execute, loading, error };
};
export const useDeleteChannel = () => {
    const { loading, error, execute } = useMutation((id: number) => pricingApi.deleteChannel(id));
    return { deleteChannel: execute, execute, loading, error };
};

// ─── Business Chronologies (Module 20) ───────────────────────────────────────

export const useBusinessChronologies = () => {
    const [data, setData] = useState<BusinessChronology[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBusinessChronologies = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await pricingApi.getBusinessChronologies();
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des chronologies');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchBusinessChronologies();
    }, [fetchBusinessChronologies]);

    return { data, loading, error, refetch: fetchBusinessChronologies };
};

export const useCreateBusinessChronology = () => {
    const { loading, error, execute } = useMutation(pricingApi.createBusinessChronology);
    return { createBusinessChronology: execute, execute, loading, error };
};
export const useUpdateBusinessChronology = () => {
    const { loading, error, execute } = useMutation<{ id: number; data: UpdateBusinessChronologyRequest }, BusinessChronology>(
        async ({ id, data }) => pricingApi.updateBusinessChronology(id, data)
    );
    return { updateBusinessChronology: execute, loading, error };
};
export const useDeleteBusinessChronology = () => {
    const { loading, error, execute } = useMutation((id: number) => pricingApi.deleteBusinessChronology(id));
    return { deleteBusinessChronology: execute, execute, loading, error };
};

// ─── Partner Chronology Assignments (Module 20) ──────────────────────────────

export const usePartnerChronologies = (partnerId: number | null) => {
    const [data, setData] = useState<PartnerChronologiesResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchChronologies = useCallback(async () => {
        if (!partnerId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await pricingApi.getPartnerChronologies(partnerId);
            setData(result);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des chronologies client');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [partnerId]);

    useEffect(() => {
        fetchChronologies();
    }, [fetchChronologies]);

    return { data, loading, error, refetch: fetchChronologies };
};

export const useSyncPartnerChronologies = () => {
    const { loading, error, execute } = useMutation<{ partnerId: number; data: SyncChronologiesRequest }, PartnerChronologiesResponse>(
        async ({ partnerId, data }) => pricingApi.syncPartnerChronologies(partnerId, data)
    );
    return { syncChronologies: execute, loading, error };
};
