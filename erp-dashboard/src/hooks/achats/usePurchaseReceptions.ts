import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achatsApi } from '@/services/api/achatsApi';
import { purchaseOrderKeys } from '@/hooks/achats/usePurchaseOrders';
import type {
    PurchaseReceptionListFilters, CreatePurchaseReceptionPayload, CancelPurchaseReceptionPayload,
} from '@/types/achats.types';

export const purchaseReceptionKeys = {
    all: ['purchase-receptions'] as const,
    list: (filters?: PurchaseReceptionListFilters) => [...purchaseReceptionKeys.all, 'list', filters] as const,
    detail: (id: number) => [...purchaseReceptionKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 30;

export const usePurchaseReceptions = (filters: Omit<PurchaseReceptionListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: purchaseReceptionKeys.list(filters),
        queryFn: ({ pageParam }) => achatsApi.purchaseReceptions.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const usePurchaseReception = (id: number | null) =>
    useQuery({
        queryKey: purchaseReceptionKeys.detail(id ?? 0),
        queryFn: () => achatsApi.purchaseReceptions.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreatePurchaseReception = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreatePurchaseReceptionPayload) => achatsApi.purchaseReceptions.create(payload),
        onSuccess: (data) => {
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.all });
            // A reception linked to a BC changes that BC's received_quantity/status
            // the moment it's later validated, but its lines already carry the BC's
            // ordered_quantity as soon as it's created — invalidate eagerly so a BC
            // detail view opened right after stays consistent.
            if (data.data.purchase_order_id) qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(data.data.purchase_order_id) });
        },
    });
};

export const useValidatePurchaseReception = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => achatsApi.purchaseReceptions.validate(id),
        onSuccess: (data, id) => {
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.detail(id) });
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.all });
            // Validating is what actually reconciles the linked BC (§5 of the doc) —
            // this is the one action that truly needs to bust the BC's cache.
            if (data.data.purchase_order_id) {
                qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(data.data.purchase_order_id) });
                qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            }
        },
    });
};

export const useCancelPurchaseReception = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CancelPurchaseReceptionPayload }) => achatsApi.purchaseReceptions.cancel(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.all });
        },
    });
};

export const useReversePurchaseReception = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CancelPurchaseReceptionPayload }) => achatsApi.purchaseReceptions.reverse(id, payload),
        onSuccess: (data, vars) => {
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: purchaseReceptionKeys.all });
            if (data.data.purchase_order_id) {
                qc.invalidateQueries({ queryKey: purchaseOrderKeys.detail(data.data.purchase_order_id) });
                qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
            }
        },
    });
};
