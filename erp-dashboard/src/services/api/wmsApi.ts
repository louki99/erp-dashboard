import apiClient from './client';
import type {
    StockLevelFilters,
    StockLevelListResponse,
    WmsPickTaskFilters,
    WmsPickTaskListResponse,
    CompletePickTaskPayload,
    BatchExpiryFilters,
    BatchExpiryListResponse,
    BulkBatchActionPayload,
    GoodsReceiptPayload,
    GoodsReceiptResponse,
    TransferPayload,
    TransferResponse,
    AdjustmentPayload,
    AdjustmentResponse,
} from '@/types/stock.types';

const BASE = '/api/backend';

// ─── Stock Levels — GET /wms/stock-levels ─────────────────────────────────────

export const getWmsStockLevels = async (filters?: StockLevelFilters): Promise<StockLevelListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.warehouse_id) params.warehouse_id = filters.warehouse_id;
    if (filters?.storage_location_id) params.storage_location_id = filters.storage_location_id;
    if (filters?.product_id) params.product_id = filters.product_id;
    if (filters?.branch_id) params.branch_id = filters.branch_id;
    if (filters?.low_stock_only) params.low_stock_only = 1;
    if (filters?.page) params.page = filters.page;
    if (filters?.per_page) params.per_page = filters.per_page;
    const res = await apiClient.get<StockLevelListResponse>(`${BASE}/wms/stock-levels`, { params });
    return res.data;
};

// ─── Pick Tasks — GET /wms/pick-tasks ─────────────────────────────────────────

export const getWmsPickTasks = async (filters?: WmsPickTaskFilters): Promise<WmsPickTaskListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.preparation_order_id) params.preparation_order_id = filters.preparation_order_id;
    if (filters?.status) params.status = filters.status;
    if (filters?.page) params.page = filters.page;
    if (filters?.per_page) params.per_page = filters.per_page;
    const res = await apiClient.get<WmsPickTaskListResponse>(`${BASE}/wms/pick-tasks`, { params });
    return res.data;
};

// ─── Complete Pick Task — POST /wms/pick-tasks/{id}/complete ──────────────────

export const completeWmsPickTask = async (id: number, payload: CompletePickTaskPayload) => {
    const res = await apiClient.post(`${BASE}/wms/pick-tasks/${id}/complete`, payload);
    return res.data;
};

// ─── Batch Expiry — GET /wms/batches/expiry ──────────────────────────────────

export const getWmsBatchesExpiry = async (filters?: BatchExpiryFilters): Promise<BatchExpiryListResponse> => {
    const params: Record<string, any> = {};
    if (filters?.warehouse_code) params.warehouse_code = filters.warehouse_code;
    if (filters?.product_id) params.product_id = filters.product_id;
    if (filters?.include_all) params.include_all = 1;
    if (filters?.page) params.page = filters.page;
    if (filters?.per_page) params.per_page = filters.per_page;
    const res = await apiClient.get<BatchExpiryListResponse>(`${BASE}/wms/batches/expiry`, { params });
    return res.data;
};

// ─── Bulk Block — POST /wms/batches/bulk-block ────────────────────────────────

export const bulkBlockBatches = async (payload: BulkBatchActionPayload) => {
    const res = await apiClient.post(`${BASE}/wms/batches/bulk-block`, payload);
    return res.data;
};

// ─── Bulk Unblock — POST /wms/batches/bulk-unblock ───────────────────────────

export const bulkUnblockBatches = async (payload: BulkBatchActionPayload) => {
    const res = await apiClient.post(`${BASE}/wms/batches/bulk-unblock`, payload);
    return res.data;
};

// ─── Goods Receipt — POST /wms/receipts ──────────────────────────────────────

export const createWmsReceipt = async (payload: GoodsReceiptPayload): Promise<GoodsReceiptResponse> => {
    const res = await apiClient.post<GoodsReceiptResponse>(`${BASE}/wms/receipts`, payload);
    return res.data;
};

// ─── Transfer — POST /wms/transfers ──────────────────────────────────────────

export const createWmsTransfer = async (payload: TransferPayload): Promise<TransferResponse> => {
    const res = await apiClient.post<TransferResponse>(`${BASE}/wms/transfers`, payload);
    return res.data;
};

// ─── Adjustment — POST /wms/adjustments ──────────────────────────────────────
// NOTE: do NOT include performed_by_user_id — ignored server-side (security).

export const createWmsAdjustment = async (payload: AdjustmentPayload): Promise<AdjustmentResponse> => {
    const res = await apiClient.post<AdjustmentResponse>(`${BASE}/wms/adjustments`, payload);
    return res.data;
};
