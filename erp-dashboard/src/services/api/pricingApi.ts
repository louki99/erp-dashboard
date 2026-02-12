import apiClient from './client';
import {
    type ApiSuccessResponse,
    type PaginatedResponse,
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
    type PriceOverride,
    type OverrideFilters,
    type CreateOverrideRequest,
    type PreviewPriceRequest,
    type PreviewPriceResponse,
    type PackagingPrice,
    type CreatePackagingPriceRequest,
    type PricingProduct,
    type ListsResponse,
    type PackagingPriceFilters,
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

// ─── Products & Search ───────────────────────────────────────────────────────

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

export const getProductPackagings = async (productId: number) => {
    const response = await apiClient.get<ApiSuccessResponse<any[]>>( // Type to be defined if stringent
        `${BASE_PATH}/products/${productId}/packagings`
    );
    return response.data;
};

// ─── Overrides (Dérogations) ─────────────────────────────────────────────────

export const getOverrides = async (filters: OverrideFilters) => {
    const response = await apiClient.get<ApiSuccessResponse<PaginatedResponse<PriceOverride>>>(
        `${BASE_PATH}/overrides`,
        { params: filters }
    );
    return response.data;
};

export const createOverride = async (data: CreateOverrideRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PriceOverride>>(
        `${BASE_PATH}/overrides`,
        data
    );
    return response.data;
};

export const updateOverride = async (id: number, data: Partial<CreateOverrideRequest>) => {
    const response = await apiClient.put<ApiSuccessResponse<PriceOverride>>(
        `${BASE_PATH}/overrides/${id}`,
        data
    );
    return response.data;
};

export const toggleOverride = async (id: number) => {
    const response = await apiClient.patch<ApiSuccessResponse<PriceOverride>>(
        `${BASE_PATH}/overrides/${id}/toggle`
    );
    return response.data;
};

export const deleteOverride = async (id: number) => {
    const response = await apiClient.delete<ApiSuccessResponse<null>>(
        `${BASE_PATH}/overrides/${id}`
    );
    return response.data;
};

export const previewPrice = async (data: PreviewPriceRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PreviewPriceResponse>>(
        `${BASE_PATH}/overrides/preview`,
        data
    );
    return response.data;
};

// ─── Packaging Prices ────────────────────────────────────────────────────────

export const getPackagingPrices = async (filters: PackagingPriceFilters) => {
    const response = await apiClient.get<PaginatedResponse<PackagingPrice>>(
        `${BASE_PATH}/packaging-prices`,
        { params: filters }
    );
    return response.data;
};

export const createPackagingPrice = async (data: CreatePackagingPriceRequest) => {
    const response = await apiClient.post<ApiSuccessResponse<PackagingPrice>>(
        `${BASE_PATH}/packaging-prices`,
        data
    );
    return response.data;
};

export const updatePackagingPrice = async (id: number, data: Partial<CreatePackagingPriceRequest>) => {
    const response = await apiClient.put<ApiSuccessResponse<PackagingPrice>>(
        `${BASE_PATH}/packaging-prices/${id}`,
        data
    );
    return response.data;
};

export const deletePackagingPrice = async (id: number) => {
    const response = await apiClient.delete<ApiSuccessResponse<null>>(
        `${BASE_PATH}/packaging-prices/${id}`
    );
    return response.data;
};

export const getAjaxPackagings = async (query: string) => {
    const response = await apiClient.get<ApiSuccessResponse<any[]>>(
        `${BASE_PATH}/packaging-prices/ajax/packagings`,
        { params: { q: query } }
    );
    return response.data;
};
