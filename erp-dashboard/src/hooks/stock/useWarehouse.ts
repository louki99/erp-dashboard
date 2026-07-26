import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getWarehouses,
    createWarehouse,
    updateWarehouse,
    getWarehouseLocations,
    createLocation,
    updateLocation,
    getStock,
    getStockSummary,
    getLowStock,
    getStockByProduct,
    getStockByLocation,
    getPreparationBills,
    getPreparationBill,
    getPreparationBillMagasiniers,
    createPreparationBill,
    updatePreparationBill,
} from '@/services/api/warehouseApi';
import type {
    WarehouseFilters,
    CreateWarehousePayload,
    UpdateWarehousePayload,
    CreateLocationPayload,
    UpdateLocationPayload,
    StockRowFilters,
    BPFilters,
    CreatePreparationBillPayload,
    UpdatePreparationBillPayload,
} from '@/types/stock.types';

// ─── Warehouses ───────────────────────────────────────────────────────────────

export const useWarehouses = (filters?: WarehouseFilters) =>
    useQuery({
        queryKey: ['warehouses', filters],
        queryFn: () => getWarehouses(filters),
        staleTime: 30_000,
    });

export const useCreateWarehouse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateWarehousePayload) => createWarehouse(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
    });
};

export const useUpdateWarehouse = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: UpdateWarehousePayload }) => updateWarehouse(id, payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouses'] }),
    });
};

// ─── Storage Locations ────────────────────────────────────────────────────────

export const useWarehouseLocations = (warehouseId: number | null) =>
    useQuery({
        queryKey: ['warehouse-locations', warehouseId],
        queryFn: () => getWarehouseLocations(warehouseId!),
        enabled: warehouseId != null,
        staleTime: 30_000,
    });

export const useCreateLocation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ warehouseId, payload }: { warehouseId: number; payload: CreateLocationPayload }) =>
            createLocation(warehouseId, payload),
        onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['warehouse-locations', vars.warehouseId] }),
    });
};

export const useUpdateLocation = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ locationId, warehouseId, payload }: { locationId: number; warehouseId: number; payload: UpdateLocationPayload }) =>
            updateLocation(locationId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ['warehouse-locations', vars.warehouseId] });
            qc.invalidateQueries({ queryKey: ['warehouses'] });
        },
    });
};

// ─── Stock ────────────────────────────────────────────────────────────────────

export const useStockRows = (filters?: StockRowFilters) =>
    useQuery({
        queryKey: ['stock-rows', filters],
        queryFn: () => getStock(filters),
        staleTime: 60_000,
    });

export const useStockSummary = (branchId?: number) =>
    useQuery({
        queryKey: ['stock-summary', branchId],
        queryFn: () => getStockSummary(branchId),
        staleTime: 60_000,
    });

export const useLowStock = (branchId?: number) =>
    useQuery({
        queryKey: ['stock-low', branchId],
        queryFn: () => getLowStock(branchId),
        staleTime: 60_000,
    });

export const useStockByProduct = (productId: number | null) =>
    useQuery({
        queryKey: ['stock-by-product', productId],
        queryFn: () => getStockByProduct(productId!),
        enabled: productId != null,
        staleTime: 60_000,
    });

export const useStockByLocation = (locationCode: string | null) =>
    useQuery({
        queryKey: ['stock-by-location', locationCode],
        queryFn: () => getStockByLocation(locationCode!),
        enabled: locationCode != null && locationCode.length > 0,
        staleTime: 60_000,
    });

// ─── Preparation Bills ────────────────────────────────────────────────────────

export const usePreparationBills = (filters?: BPFilters) =>
    useQuery({
        queryKey: ['preparation-bills', filters],
        queryFn: () => getPreparationBills(filters),
        staleTime: 30_000,
    });

export const usePreparationBill = (id: number | null) =>
    useQuery({
        queryKey: ['preparation-bill', id],
        queryFn: () => getPreparationBill(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const usePreparationBillMagasiniers = (branchId?: number) =>
    useQuery({
        queryKey: ['preparation-bill-magasiniers', branchId],
        queryFn: () => getPreparationBillMagasiniers(branchId),
        staleTime: 60_000,
    });

export const useCreatePreparationBill = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreatePreparationBillPayload) => createPreparationBill(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['preparation-bills'] }),
    });
};

export const useUpdatePreparationBill = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: UpdatePreparationBillPayload }) => updatePreparationBill(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: ['preparation-bills'] });
            qc.invalidateQueries({ queryKey: ['preparation-bill', vars.id] });
        },
    });
};
