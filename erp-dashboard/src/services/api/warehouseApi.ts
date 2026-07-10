import apiClient from './client';
import type {
    Warehouse,
    WarehouseListResponse,
    WarehouseFilters,
    WarehouseLocationsResponse,
    CreateWarehousePayload,
    UpdateWarehousePayload,
    CreateLocationPayload,
    UpdateLocationPayload,
    StorageLocation,
    StockRowListResponse,
    StockRowFilters,
    StockSummaryResponse,
    StockRow,
    PreparationBillListResponse,
    PreparationBillDetailResponse,
    BPFilters,
    CreatePreparationBillPayload,
    UpdatePreparationBillPayload,
} from '@/types/stock.types';

const BASE = '/api/backend';

function unwrap<T>(raw: any): T {
    if (raw?.data !== undefined) return raw.data as T;
    return raw as T;
}

// ─── Warehouses ───────────────────────────────────────────────────────────────

export const getWarehouses = async (filters?: WarehouseFilters): Promise<WarehouseListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.branch_id) params.branch_id = filters.branch_id;
    if (filters?.branch_code) params.branch_code = filters.branch_code;
    if (filters?.type) params.type = filters.type;
    if (filters?.active_only) params.active_only = true;
    if (filters?.search) params.search = filters.search;
    if (filters?.per_page) params.per_page = filters.per_page;
    const res = await apiClient.get<WarehouseListResponse>(`${BASE}/warehouses`, { params });
    return unwrap<WarehouseListResponse>(res.data);
};

export const createWarehouse = async (payload: CreateWarehousePayload): Promise<{ success: boolean; message: string; warehouse: Warehouse }> => {
    const res = await apiClient.post(`${BASE}/warehouses`, payload);
    return unwrap(res.data);
};

export const updateWarehouse = async (id: number, payload: UpdateWarehousePayload): Promise<{ success: boolean; message: string; warehouse: Warehouse }> => {
    const res = await apiClient.put(`${BASE}/warehouses/${id}`, payload);
    return unwrap(res.data);
};

// ─── Storage Locations ────────────────────────────────────────────────────────

export const getWarehouseLocations = async (warehouseId: number): Promise<WarehouseLocationsResponse> => {
    const res = await apiClient.get<WarehouseLocationsResponse>(`${BASE}/warehouses/${warehouseId}/locations`);
    return unwrap<WarehouseLocationsResponse>(res.data);
};

export const createLocation = async (warehouseId: number, payload: CreateLocationPayload): Promise<{ success: boolean; message: string; location: StorageLocation }> => {
    const res = await apiClient.post(`${BASE}/warehouses/${warehouseId}/locations`, payload);
    return unwrap(res.data);
};

export const updateLocation = async (locationId: number, payload: UpdateLocationPayload): Promise<{ success: boolean; message: string; location: StorageLocation }> => {
    const res = await apiClient.put(`${BASE}/warehouses/locations/${locationId}`, payload);
    return unwrap(res.data);
};

// ─── Stock (read-only) ────────────────────────────────────────────────────────

export const getStock = async (filters?: StockRowFilters): Promise<StockRowListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.branch_id) params.branch_id = filters.branch_id;
    if (filters?.warehouse_code) params.warehouse_code = filters.warehouse_code;
    if (filters?.product_id) params.product_id = filters.product_id;
    if (filters?.location_type) params.location_type = filters.location_type;
    if (filters?.per_page) params.per_page = filters.per_page;
    if (filters?.page) params.page = filters.page;
    const res = await apiClient.get<StockRowListResponse>(`${BASE}/stock`, { params });
    const raw: any = res.data;
    if (raw?.success !== undefined) return raw;
    return { success: true, data: { current_page: 1, data: Array.isArray(raw) ? raw : raw?.data ?? [], total: 0, per_page: 50 } };
};

export const getStockSummary = async (branchId?: number): Promise<StockSummaryResponse> => {
    const params: Record<string, any> = {};
    if (branchId) params.branch_id = branchId;
    const res = await apiClient.get<StockSummaryResponse>(`${BASE}/stocks/summary`, { params });
    return unwrap<StockSummaryResponse>(res.data);
};

export const getLowStock = async (branchId?: number): Promise<StockRowListResponse> => {
    const params: Record<string, any> = {};
    if (branchId) params.branch_id = branchId;
    const res = await apiClient.get(`${BASE}/stocks/low-stock`, { params });
    const raw: any = res.data;
    if (raw?.success !== undefined) return raw;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    return { success: true, data: { current_page: 1, data: list, total: list.length, per_page: 50 } };
};

export const getStockByProduct = async (productId: number): Promise<{ data: StockRow[] }> => {
    const res = await apiClient.get(`${BASE}/stocks/${productId}`);
    const raw: any = res.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    return { data: list };
};

export const getStockByLocation = async (locationCode: string): Promise<{ data: StockRow[] }> => {
    const res = await apiClient.get(`${BASE}/stocks/location/${encodeURIComponent(locationCode)}`);
    const raw: any = res.data;
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    return { data: list };
};

// ─── Preparation Bills ────────────────────────────────────────────────────────

export const getPreparationBills = async (filters?: BPFilters): Promise<PreparationBillListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.magasinier_id) params.magasinier_id = filters.magasinier_id;
    if (filters?.delivery_mission_id) params.delivery_mission_id = filters.delivery_mission_id;
    if (filters?.from_date) params.from_date = filters.from_date;
    if (filters?.to_date) params.to_date = filters.to_date;
    if (filters?.search) params.search = filters.search;
    if (filters?.per_page) params.per_page = filters.per_page;
    if (filters?.page) params.page = filters.page;
    const res = await apiClient.get<PreparationBillListResponse>(`${BASE}/stock/preparation-bills`, { params });
    return unwrap<PreparationBillListResponse>(res.data);
};

export const getPreparationBill = async (id: number): Promise<PreparationBillDetailResponse> => {
    const res = await apiClient.get<PreparationBillDetailResponse>(`${BASE}/stock/preparation-bills/${id}`);
    return unwrap<PreparationBillDetailResponse>(res.data);
};

export const createPreparationBill = async (payload: CreatePreparationBillPayload) => {
    const res = await apiClient.post(`${BASE}/stock/preparation-bills`, payload);
    return unwrap(res.data);
};

export const updatePreparationBill = async (id: number, payload: UpdatePreparationBillPayload) => {
    const res = await apiClient.put(`${BASE}/stock/preparation-bills/${id}`, payload);
    return unwrap(res.data);
};
