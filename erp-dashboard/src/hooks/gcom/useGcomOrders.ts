import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gcomApi } from '@/services/api/gcomApi';
import { noteKeys } from '@/hooks/gcom/useGcomDeliveryNotes';
import { invoiceKeys } from '@/hooks/gcom/useGcomInvoices';
import type {
    GcomOrderListFilters, GcomConvertToBlPayload, GcomCancelOrderPayload,
    GcomCancelOrderLinePayload, GcomUpdateOrderLinePayload, GcomAddOrderLinePayload,
    GcomInstrumentInput, GcomSoucheKind, GcomAvoirAllocation, GcomPaymentMethod,
} from '@/types/gcom.types';

export const orderKeys = {
    all: ['gcom-orders'] as const,
    list: (filters?: GcomOrderListFilters) => [...orderKeys.all, 'list', filters] as const,
    detail: (id: number) => [...orderKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 30;

export const useOrders = (filters: Omit<GcomOrderListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: orderKeys.list(filters),
        queryFn: ({ pageParam }) => gcomApi.orders.listView({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const useOrder = (id: number | null) =>
    useQuery({
        queryKey: orderKeys.detail(id ?? 0),
        queryFn: () => gcomApi.orders.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: gcomApi.orders.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: orderKeys.all }),
    });
};

export const useConvertOrderToBl = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload?: GcomConvertToBlPayload }) => gcomApi.orders.convertToBl(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

interface ConvertToInvoiceVars {
    target: { type: 'order' | 'bl'; id: number };
    instrument?: GcomInstrumentInput | null;
    soucheKind?: GcomSoucheKind | null;
    avoirAllocations?: GcomAvoirAllocation[];
    paymentMethodOverride?: Exclude<GcomPaymentMethod, 'avoir'>;
    paymentTermId?: number | null;
}

// Shared by BC's "Convertir en Facture" (order target) and its "Convertir le
// BL en Facture" action (bl target, when the order already hopped to a BL) —
// same two backend endpoints BonLivraisonPage.tsx will call directly once it
// migrates.
export const useConvertToInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (vars: ConvertToInvoiceVars) =>
            vars.target.type === 'order'
                ? gcomApi.orders.convertToInvoice(vars.target.id, vars.instrument, vars.soucheKind, vars.avoirAllocations, vars.paymentMethodOverride, vars.paymentTermId)
                : gcomApi.deliveryNotes.convertToInvoice(vars.target.id, vars.instrument, vars.soucheKind, vars.avoirAllocations, vars.paymentMethodOverride, vars.paymentTermId),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.all });
            qc.invalidateQueries({ queryKey: noteKeys.all });
            qc.invalidateQueries({ queryKey: invoiceKeys.all });
            if (vars.target.type === 'bl') qc.invalidateQueries({ queryKey: noteKeys.detail(vars.target.id) });
        },
    });
};

export const useCancelOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: GcomCancelOrderPayload }) => gcomApi.orders.cancel(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
};

export const useCancelOrderLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, lineId, payload }: { id: number; lineId: number; payload: GcomCancelOrderLinePayload }) =>
            gcomApi.orders.cancelLine(id, lineId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
};

export const useUpdateOrderLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, lineId, payload }: { id: number; lineId: number; payload: GcomUpdateOrderLinePayload }) =>
            gcomApi.orders.updateLine(id, lineId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
};

export const useAddOrderLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: GcomAddOrderLinePayload }) => gcomApi.orders.addLine(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
};