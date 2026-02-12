import apiClient from './client';
import type {
    StockListResponse,
    StockFilters,
    MovementListResponse,
    MovementFilters,
    EffectiveStockResponse,
    EffectiveStockFilters,
    CreateProvisionalRequest,
    ReconcileX3Request,
    ApiSuccessResponse,
} from '@/types/stock.types';

const BASE = '/api/backend/stock-management';

export const stockManagementApi = {
    /**
     * 1) List Stocks (Projected Availability)
     * GET /stocks?branch_code=...&search=...&low_stock=...&out_of_stock=...
     */
    getStocks: async (filters: StockFilters): Promise<StockListResponse> => {
        const params: Record<string, any> = { branch_code: filters.branch_code };
        if (filters.search) params.search = filters.search;
        if (filters.low_stock) params.low_stock = 1;
        if (filters.out_of_stock) params.out_of_stock = 1;
        if (filters.page) params.page = filters.page;
        if (filters.per_page) params.per_page = filters.per_page;

        const response = await apiClient.get<StockListResponse>(`${BASE}/stocks`, { params });
        return response.data;
    },

    /**
     * 2) List Stock Movements (Ledger)
     * GET /movements?branch_code=...&type=...&movement_status=...
     */
    getMovements: async (filters: MovementFilters): Promise<MovementListResponse> => {
        const params: Record<string, any> = { branch_code: filters.branch_code };
        if (filters.type) params.type = filters.type;
        if (filters.movement_status) params.movement_status = filters.movement_status;
        if (filters.source_system) params.source_system = filters.source_system;
        if (filters.product_id) params.product_id = filters.product_id;
        if (filters.date_from) params.date_from = filters.date_from;
        if (filters.date_to) params.date_to = filters.date_to;
        if (filters.page) params.page = filters.page;
        if (filters.per_page) params.per_page = filters.per_page;

        const response = await apiClient.get<MovementListResponse>(`${BASE}/movements`, { params });
        return response.data;
    },

    /**
     * 3) Effective Stock Breakdown (Single Product)
     * GET /effective?product_id=...&branch_code=...
     */
    getEffectiveStock: async (filters: EffectiveStockFilters): Promise<EffectiveStockResponse> => {
        const params: Record<string, any> = { product_id: filters.product_id };
        if (filters.branch_code) params.branch_code = filters.branch_code;

        const response = await apiClient.get<EffectiveStockResponse>(`${BASE}/effective`, { params });
        return response.data;
    },

    /**
     * 4) Create Provisional Movement (Local Reception / Adjustment)
     * POST /provisional
     */
    createProvisional: async (data: CreateProvisionalRequest): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${BASE}/provisional`, data);
        return response.data;
    },

    /**
     * 5) Reconcile From X3 (Confirm + Reverse Provisional)
     * POST /reconcile-x3
     */
    reconcileX3: async (data: ReconcileX3Request): Promise<ApiSuccessResponse> => {
        const response = await apiClient.post<ApiSuccessResponse>(`${BASE}/reconcile-x3`, data);
        return response.data;
    },
};
