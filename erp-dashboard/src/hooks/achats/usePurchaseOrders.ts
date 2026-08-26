import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achatsApi } from '@/services/api/achatsApi';
import type {
    PurchaseOrderListFilters, CreatePurchaseOrderPayload, CancelPurchaseOrderPayload,
    PurchaseOrderLinePayload,
} from '@/types/achats.types';

export const purchaseOrderKeys = {
    all: ['purchase-orders'] as const,
    list: (filters?: PurchaseOrderListFilters) => [...purchaseOrderKeys.all, 'list', filters] as const,
    detail: (id: number) => [...purchaseOrderKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 30;

export const usePurchaseOrders = (filters: Omit<PurchaseOrderListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: purchaseOrderKeys.list(filters),
        queryFn: ({ pageParam }) => achatsApi.purchaseOrders.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const usePurchaseOrder = (id: number | null) =>
    useQuery({
        queryKey: purchaseOrderKeys.detail(id ?? 0),
        queryFn: () => achatsApi.purchaseOrders.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreatePurchaseOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreatePurchaseOrderPayload) => achatsApi.purchaseOrders.create(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: purchaseOrderKeys.all }),
    });
};

export const useConfirmPurchaseOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => achatsApi.purchaseOrders.confirm(id),
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(id) });
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};

export const useCancelPurchaseOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CancelPurchaseOrderPayload }) => achatsApi.purchaseOrders.cancel(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};

export const useAddPurchaseOrderLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: PurchaseOrderLinePayload }) => achatsApi.purchaseOrders.addLine(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};

export const useDeletePurchaseOrderLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, lineId }: { id: number; lineId: number }) => achatsApi.purchaseOrders.deleteLine(id, lineId),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};
