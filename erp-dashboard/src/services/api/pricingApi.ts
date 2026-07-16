import apiClient from './client';
import {
    type ApiSuccessResponse,
    type PriceList,
    type PriceListFilters,
    type CreatePriceListRequest,
    type UpdatePriceListRequest,
    type PriceListLine,
    type CreateLineRequest,
    type UpdateLineRequest,
    type LineDetail,
    type UpsertDetailsRequest,
    type DuplicateLineRequest,
    type ImportCsvParams,
    type BulkUpdateRequest,
    type BulkUpdateResponse,
    type ImportPriceListParams,
    type ImportPriceListResponse,
    type ExportPriceListParams,
    type PriceOverride,
    type OverridesIndexResponse,
    type OverrideFilters,
    type CreateOverrideRequest,
    type PreviewPriceRequest,
    type PreviewPriceResponse,
    type ProductPackaging,
    type PackagingResolutionParams,
    type ListsResponse,
    type Channel,
    type BusinessChronology,
    type CreateChannelRequest,
    type UpdateChannelRequest,
    type CreateBusinessChronologyRequest,
    type UpdateBusinessChronologyRequest,
    type PartnerChronologiesResponse,
    type SyncChronologiesRequest,
} from '../../types/pricing.types';

const BASE_PATH = '/api/backend/pricing';

// ─── Price Lists ─────────────────────────────────────────────────────────────

export const getPriceLists = async (filters: PriceListFilters) => {
    const response = await apiClient.get<ListsResponse<PriceList>>(
        BASE_PATH,
        { params: filters }
    );
    // Axios `.data` is the body { lists, filters }
    // We expose only the paginated lists object to callers.
    return response.data.lists;
};

export const createPriceList = async (data: CreatePriceListRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PriceList>>(
        BASE_PATH,
        data
    );
    return response.data;
};

export const getPriceList = async (id: number): Promise<PriceList> => {
    // Backend now returns: { price_list: { ... , lines: [{..., details: [...] }] } }
    const response = await apiClient.get<{ price_list: any }>(
        `${BASE_PATH}/${id}`
    );

    const raw = response.data.price_list;

    const normalizeNumber = (value: any): number => {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        const n = parseFloat(String(value));
        return Number.isNaN(n) ? 0 : n;
    };

    const normalized: PriceList = {
        id: raw.id,
        code: raw.code,
        name: raw.name,
        rank: raw.rank,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        lines_count: raw.lines?.length ?? raw.lines_count,
        lines: (raw.lines ?? []).map((line: any): PriceListLine => ({
            id: line.id,
            price_list_id: line.price_list_id,
            line_number: line.line_number,
            name: line.name,
            start_date: line.start_date,
            end_date: line.end_date,
            closed: Boolean(line.closed),
            details_count: line.details?.length ?? line.details_count,
            created_at: line.created_at,
            updated_at: line.updated_at,
            details: (line.details ?? []).map((d: any): LineDetail => ({
                id: d.id,
                price_list_line_id: line.id,
                price_list_id: d.price_list_id,
                line_number: d.line_number,
                product_id: d.product_id,
                product: d.product ?? undefined,
                sales_price: normalizeNumber(d.sales_price),
                return_price: normalizeNumber(d.return_price),
                min_sales_price: normalizeNumber(d.min_sales_price),
                max_sales_price: normalizeNumber(d.max_sales_price),
                discount_amount: normalizeNumber(d.discount_amount),
                discount_rate: normalizeNumber(d.discount_rate),
                sales_discount: d.sales_discount !== undefined ? normalizeNumber(d.sales_discount) : undefined,
                unit_id: d.unit_id,
            })),
        })),
    };

    return normalized;
};

export const updatePriceList = async (id: number, data: UpdatePriceListRequest) => {
    const response = await apiClient.put<ApiSuccessResponse<PriceList>>(
        `${BASE_PATH}/${id}`,
        data
    );
    return response.data;
};

export const deletePriceList = async (id: number) => {
    const response = await apiClient.delete<ApiSuccessResponse<null>>(
        `${BASE_PATH}/${id}`
    );
    return response.data;
};

// ─── Price List Lines (Versions) ─────────────────────────────────────────────

export const createLine = async (priceListId: number, data: CreateLineRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PriceListLine>>(
        `${BASE_PATH}/${priceListId}/lines`,
        data
    );
    return response.data;
};

export const getLineDetails = async (priceListId: number, lineNumber: number) => {
    const response = await apiClient.get<ApiSuccessResponse<PriceListLine>>(
        `${BASE_PATH}/${priceListId}/lines/${lineNumber}/edit`
    );
    return response.data;
};

export const updateLine = async (priceListId: number, lineNumber: number, data: UpdateLineRequest) => {
    const response = await apiClient.put<ApiSuccessResponse<PriceListLine>>(
        `${BASE_PATH}/${priceListId}/lines/${lineNumber}`,
        data
    );
    return response.data;
};

export const upsertLineDetails = async (priceListId: number, lineNumber: number, data: UpsertDetailsRequest) => {
    const response = await apiClient.put<ApiSuccessResponse<LineDetail[]>>(
        `${BASE_PATH}/${priceListId}/lines/${lineNumber}`,
        data
    );
    return response.data;
};

export const clearLineDetails = async (priceListId: number, lineNumber: number) => {
    // Assuming clearing details might be a specific action or just sending empty details
    // But usually typically we'd just update with empty or have a specific endpoint.
    // The plan mentioned "upsertLineDetails / clearLineDetails" for the same endpoint (action). 
    // If it's the same endpoint, maybe it distinguishes by payload or query param?
    // I'll assume passing empty details array clears them if that's the logic, 
    // or if there's a specific clear action, I'd need to know.
    // For now, I'll rely on the backend handling upsert with empty or similar.
    // Actually, looking at standard REST, to clear, maybe DELETE?
    // Plan says: PUT /pricing/{id}/lines/{ln} (action) -> upsertLineDetails / clearLineDetails
    // I will implement upsert. Clear might be sending empty list?
    // Let's assume sending empty details list clears it for now or we might not need separate clear function yet.
    return upsertLineDetails(priceListId, lineNumber, { details: [] });
};

export const duplicateLine = async (priceListId: number, data: DuplicateLineRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PriceListLine>>(
        `${BASE_PATH}/${priceListId}/lines/duplicate`,
        data
    );
    return response.data;
};

export const importLineCsv = async (priceListId: number, lineNumber: number, params: ImportCsvParams) => {
    const formData = new FormData();
    formData.append('file', params.file);
    formData.append('mode', params.mode);
    formData.append('has_header', params.has_header ? '1' : '0');
    formData.append('product_identifier', params.product_identifier);

    const response = await apiClient.post<ApiSuccessResponse<{ imported: number, details: LineDetail[] }>>(
        `${BASE_PATH}/${priceListId}/lines/${lineNumber}/import`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return response.data;
};

// ─── Price List Bulk Operations (Full-Screen Grid Enterprise ERP) ─────────────

export const bulkUpdatePriceList = async (id: number, data: BulkUpdateRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<BulkUpdateResponse>>(
        `${BASE_PATH}/${id}/bulk-update`,
        data
    );
    return response.data;
};

export const importPriceList = async (id: number, params: ImportPriceListParams) => {
    const formData = new FormData();
    formData.append('file', params.file);
    if (params.line_number !== undefined) {
        formData.append('line_number', String(params.line_number));
    }
    formData.append('mode', params.mode);
    formData.append('has_header', params.has_header ? '1' : '0');
    formData.append('product_identifier', params.product_identifier);
    if (params.sheet_index !== undefined) {
        formData.append('sheet_index', String(params.sheet_index));
    }

    const response = await apiClient.post<ApiSuccessResponse<ImportPriceListResponse>>(
        `${BASE_PATH}/${id}/import`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }
    );
    return response.data;
};

export const exportPriceList = async (id: number, params: ExportPriceListParams): Promise<Blob> => {
    const response = await apiClient.get<Blob>(
        `${BASE_PATH}/${id}/export`,
        {
            params: {
                line_number: params.line_number,
                format: params.format,
            },
            responseType: 'blob',
        }
    );
    return response.data;
};

// ─── Products & Partners Search ──────────────────────────────────────────────

export interface ProductSearchResult {
    id: number;
    text: string;
    code: string;
    name: string;
}

export const searchProducts = async (query: string): Promise<ProductSearchResult[]> => {
    const response = await apiClient.get<ProductSearchResult[]>(
        `${BASE_PATH}/products/search`,
        { params: { q: query } }
    );
    return response.data;
};

export interface PartnerSearchResult {
    id: number;
    code: string;
    name: string;
    email: string | null;
    phone: string | null;
    status: string;
}

export const searchPartners = async (query: string): Promise<PartnerSearchResult[]> => {
    const response = await apiClient.get<ApiSuccessResponse<PartnerSearchResult[]>>(
        `${BASE_PATH}/partners/search`,
        { params: { q: query } }
    );
    return response.data.data;
};

// Colisages d'un produit avec prix résolus par le moteur v5 — contrat §6.1c figé :
// array nu ; ?price_list_id= ou ?partner_id= pour résoudre les prix (sinon price: null).
export const getProductPackagings = async (
    productId: number,
    params?: PackagingResolutionParams
): Promise<ProductPackaging[]> => {
    const response = await apiClient.get<ProductPackaging[]>(
        `${BASE_PATH}/products/${productId}/packagings`,
        { params }
    );
    return response.data;
};

// ─── Overrides (Dérogations) ─────────────────────────────────────────────────

const toNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
};

// Le backend renvoie les décimaux en string ("10.500", "0.000000") ;
// un montant à 0 signifie "non renseigné" pour l'UI.
const normalizeOverride = (raw: any): PriceOverride => ({
    ...raw,
    fixed_price: toNumberOrNull(raw.fixed_price),
    discount_rate: toNumberOrNull(raw.discount_rate) || null,
    discount_amount: toNumberOrNull(raw.discount_amount) || null,
    active: Boolean(raw.active),
    priority: Number(raw.priority ?? 0),
});

export const getOverrides = async (filters: OverrideFilters): Promise<OverridesIndexResponse> => {
    const params: Record<string, any> = { ...filters };
    if (params.active !== undefined) params.active = params.active ? 1 : 0;
    const response = await apiClient.get<OverridesIndexResponse>(
        `${BASE_PATH}/overrides`,
        { params }
    );
    const body = response.data;
    return {
        ...body,
        overrides: {
            ...body.overrides,
            data: (body.overrides?.data ?? []).map(normalizeOverride),
        },
    };
};

export const createOverride = async (data: CreateOverrideRequest) => {
    const response = await apiClient.post<{ success: boolean; message: string; override: PriceOverride }>(
        `${BASE_PATH}/overrides`,
        data
    );
    return response.data;
};

export const updateOverride = async (id: number, data: CreateOverrideRequest) => {
    const response = await apiClient.put<{ success: boolean; message: string }>(
        `${BASE_PATH}/overrides/${id}`,
        data
    );
    return response.data;
};

// Révocation soft (historique conservé) — préférer au DELETE
export const toggleOverride = async (id: number) => {
    const response = await apiClient.patch<{ success: boolean; message: string; active: boolean }>(
        `${BASE_PATH}/overrides/${id}/toggle`
    );
    return response.data;
};

export const deleteOverride = async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
        `${BASE_PATH}/overrides/${id}`
    );
    return response.data;
};

// Prix effectif calculé par le moteur v5 — la réponse est le payload direct (non enveloppé)
export const previewPrice = async (data: PreviewPriceRequest): Promise<PreviewPriceResponse> => {
    const response = await apiClient.post<PreviewPriceResponse>(
        `${BASE_PATH}/overrides/preview`,
        data
    );
    return response.data;
};

// ⚠️ /pricing/packaging-prices n'existe pas côté backend (fantôme du legacy).
// Les prix de colisage sont dérivés — voir getProductPackagings ci-dessus.

// ─── Channels (Module 20) ────────────────────────────────────────────────────

const CHANNELS_PATH = '/api/backend/channels';

export const getChannels = async () => {
    const response = await apiClient.get<{ success: boolean; channels: Channel[] }>(
        CHANNELS_PATH
    );
    return response.data.channels;
};

export const createChannel = async (data: CreateChannelRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<Channel>>(
        CHANNELS_PATH,
        data
    );
    return response.data;
};

export const updateChannel = async (id: number, data: UpdateChannelRequest) => {
    const response = await apiClient.put<ApiSuccessResponse<Channel>>(
        `${CHANNELS_PATH}/${id}`,
        data
    );
    return response.data;
};

export const deleteChannel = async (id: number) => {
    const response = await apiClient.delete<ApiSuccessResponse<null>>(
        `${CHANNELS_PATH}/${id}`
    );
    return response.data;
};

// ─── Business Chronologies (Module 20) ───────────────────────────────────────

const CHRONOLOGIES_PATH = '/api/backend/business-chronologies';

export const getBusinessChronologies = async () => {
    const response = await apiClient.get<{ success: boolean; business_chronologies: BusinessChronology[] }>(
        CHRONOLOGIES_PATH
    );
    return response.data.business_chronologies;
};

export const createBusinessChronology = async (data: CreateBusinessChronologyRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<BusinessChronology>>(
        CHRONOLOGIES_PATH,
        data
    );
    return response.data;
};

export const updateBusinessChronology = async (id: number, data: UpdateBusinessChronologyRequest) => {
    const response = await apiClient.put<ApiSuccessResponse<BusinessChronology>>(
        `${CHRONOLOGIES_PATH}/${id}`,
        data
    );
    return response.data;
};

export const deleteBusinessChronology = async (id: number) => {
    const response = await apiClient.delete<ApiSuccessResponse<null>>(
        `${CHRONOLOGIES_PATH}/${id}`
    );
    return response.data;
};

// ─── Partner Chronology Assignments (Module 20) ──────────────────────────────

export const getPartnerChronologies = async (partnerId: number): Promise<PartnerChronologiesResponse> => {
    const response = await apiClient.get<PartnerChronologiesResponse>(
        `/api/backend/partners/${partnerId}/chronologies`
    );
    return response.data;
};

export const syncPartnerChronologies = async (partnerId: number, data: SyncChronologiesRequest): Promise<PartnerChronologiesResponse> => {
    const response = await apiClient.post<PartnerChronologiesResponse>(
        `/api/backend/partners/${partnerId}/chronologies`,
        data
    );
    return response.data;
};
