import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achatsApi } from '@/services/api/achatsApi';
import { purchaseOrderKeys } from '@/hooks/achats/usePurchaseOrders';
import type { SupplierInvoiceListFilters, CreateSupplierInvoicePayload, CancelSupplierInvoicePayload } from '@/types/achats.types';

export const supplierInvoiceKeys = {
    all: ['supplier-invoices'] as const,
    list: (filters?: SupplierInvoiceListFilters) => [...supplierInvoiceKeys.all, 'list', filters] as const,
    detail: (id: number) => [...supplierInvoiceKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 30;

export const useSupplierInvoices = (filters: Omit<SupplierInvoiceListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: supplierInvoiceKeys.list(filters),
        queryFn: ({ pageParam }) => achatsApi.supplierInvoices.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const useSupplierInvoice = (id: number | null) =>
    useQuery({
        queryKey: supplierInvoiceKeys.detail(id ?? 0),
        queryFn: () => achatsApi.supplierInvoices.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateSupplierInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateSupplierInvoicePayload) => achatsApi.supplierInvoices.create(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: supplierInvoiceKeys.all }),
    });
};

export const useApproveSupplierInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => achatsApi.supplierInvoices.approve(id),
        onSuccess: (_data, id) => {
            qc.invalidateQueries({ queryKey: supplierInvoiceKeys.detail(id) });
            qc.invalidateQueries({ queryKey: supplierInvoiceKeys.all });
            // Approval is the bascule point that bumps purchase_order_lines.
            // invoiced_quantity (doc §11.1) — bust every BC detail/list cache
            // broadly rather than tracking which purchase_order_line_ids were
            // touched, matching this module's existing invalidation grain.
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};

export const useCancelSupplierInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CancelSupplierInvoicePayload }) => achatsApi.supplierInvoices.cancel(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: supplierInvoiceKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: supplierInvoiceKeys.all });
            qc.invalidateQueries({ queryKey: purchaseOrderKeys.all });
        },
    });
};
