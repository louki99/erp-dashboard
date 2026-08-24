import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gcomApi } from '@/services/api/gcomApi';
import { orderKeys } from '@/hooks/gcom/useGcomOrders';
import type {
    GcomDeliveryNoteListFilters, GcomCreateDeliveryNotePayload, GcomCancelDeliveryNotePayload,
    GcomUpdateDeliveryNoteLinePayload, GcomRemoveDeliveryNoteLinePayload, GcomApplyDeliveryNoteDiscountPayload,
    GcomReturnDeliveryNoteLinePayload,
} from '@/types/gcom.types';

export const noteKeys = {
    all: ['gcom-delivery-notes'] as const,
    list: (filters?: GcomDeliveryNoteListFilters) => [...noteKeys.all, 'list', filters] as const,
    detail: (id: number) => [...noteKeys.all, 'detail', id] as const,
    returns: (id: number) => [...noteKeys.all, 'returns', id] as const,
};

const PAGE_SIZE = 30;

// NOT switched to listView() — ConsolidateModal needs partner.id, which the
// lean projection doesn't carry yet (see project memory: backend asked to
// add it, not shipped as of this migration). Revert to listView() once
// available, matching BonCommandePage.tsx's useOrders.
export const useNotes = (filters: Omit<GcomDeliveryNoteListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: noteKeys.list(filters),
        queryFn: ({ pageParam }) => gcomApi.deliveryNotes.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const useNote = (id: number | null) =>
    useQuery({
        queryKey: noteKeys.detail(id ?? 0),
        queryFn: () => gcomApi.deliveryNotes.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useNoteReturns = (id: number | null) =>
    useQuery({
        queryKey: noteKeys.returns(id ?? 0),
        queryFn: () => gcomApi.deliveryNotes.listReturns(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: GcomCreateDeliveryNotePayload) => gcomApi.deliveryNotes.create(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: noteKeys.all }),
    });
};

export const useConfirmBlDelivery = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ blId }: { blId: number; orderId: number }) => gcomApi.deliveryNotes.confirmDelivery(blId),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.blId) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
            // BC's own "Documents liés" reads bl.status off the order's own
            // embedded delivery_notes[0], not a separate BL query.
            qc.invalidateQueries({ queryKey: orderKeys.detail(vars.orderId) });
            qc.invalidateQueries({ queryKey: orderKeys.all });
        },
    });
};

export const useCancelNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: GcomCancelDeliveryNotePayload }) => gcomApi.deliveryNotes.cancel(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

export const useUpdateNoteLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, itemId, payload }: { id: number; itemId: number; payload: GcomUpdateDeliveryNoteLinePayload }) =>
            gcomApi.deliveryNotes.updateLine(id, itemId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

export const useRemoveNoteLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, itemId, payload }: { id: number; itemId: number; payload: GcomRemoveDeliveryNoteLinePayload }) =>
            gcomApi.deliveryNotes.removeLine(id, itemId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

export const useApplyNoteDiscount = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: GcomApplyDeliveryNoteDiscountPayload }) =>
            gcomApi.deliveryNotes.applyDiscount(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

export const useReturnNoteLine = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, itemId, payload }: { id: number; itemId: number; payload: GcomReturnDeliveryNoteLinePayload }) =>
            gcomApi.deliveryNotes.returnLine(id, itemId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: noteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.returns(vars.id) });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};