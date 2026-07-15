import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getWmsStockLevels,
    getWmsPickTasks,
    completeWmsPickTask,
    getWmsBatchesExpiry,
    bulkBlockBatches,
    bulkUnblockBatches,
    createWmsReceipt,
    createWmsTransfer,
    createWmsAdjustment,
} from '@/services/api/wmsApi';
import type {
    StockLevelFilters,
    WmsPickTaskFilters,
    CompletePickTaskPayload,
    BatchExpiryFilters,
    BulkBatchActionPayload,
    GoodsReceiptPayload,
    TransferPayload,
    AdjustmentPayload,
} from '@/types/stock.types';

// ─── Stock Levels ─────────────────────────────────────────────────────────────

export const useWmsStockLevels = (filters?: StockLevelFilters) =>
    useQuery({
        queryKey: ['wms-stock-levels', filters],
        queryFn: () => getWmsStockLevels(filters),
        staleTime: 30_000,
    });

// ─── Pick Tasks ───────────────────────────────────────────────────────────────

export const useWmsPickTasks = (filters?: WmsPickTaskFilters) =>
    useQuery({
        queryKey: ['wms-pick-tasks', filters],
        queryFn: () => getWmsPickTasks(filters),
        staleTime: 15_000,
    });

export const useCompletePickTask = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CompletePickTaskPayload }) =>
            completeWmsPickTask(id, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-pick-tasks'] }),
    });
};

// ─── Batch Expiry ─────────────────────────────────────────────────────────────

export const useWmsBatchesExpiry = (filters?: BatchExpiryFilters) =>
    useQuery({
        queryKey: ['wms-batches-expiry', filters],
        queryFn: () => getWmsBatchesExpiry(filters),
        staleTime: 30_000,
    });

export const useBulkBlockBatches = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: BulkBatchActionPayload) => bulkBlockBatches(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-batches-expiry'] }),
    });
};

export const useBulkUnblockBatches = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: BulkBatchActionPayload) => bulkUnblockBatches(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-batches-expiry'] }),
    });
};

// ─── Goods Receipt ────────────────────────────────────────────────────────────

export const useCreateWmsReceipt = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: GoodsReceiptPayload) => createWmsReceipt(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-stock-levels'] }),
    });
};

// ─── Transfer ─────────────────────────────────────────────────────────────────

export const useCreateWmsTransfer = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: TransferPayload) => createWmsTransfer(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['wms-stock-levels'] }),
    });
};

// ─── Adjustment ───────────────────────────────────────────────────────────────

export const useCreateWmsAdjustment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: AdjustmentPayload) => createWmsAdjustment(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['wms-stock-levels'] });
            qc.invalidateQueries({ queryKey: ['wms-batches-expiry'] });
        },
    });
};
