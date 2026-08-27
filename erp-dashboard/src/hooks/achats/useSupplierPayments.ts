import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achatsApi } from '@/services/api/achatsApi';
import { supplierInvoiceKeys } from '@/hooks/achats/useSupplierInvoices';
import type {
    CreateSupplierPaymentPayload, LetterSupplierPaymentPayload, SupplierLedgerFilters,
    SupplierPaymentsStatementsListFilters, CancelSupplierPaymentPayload, SupplierPaymentListFilters,
} from '@/types/achats.types';

export const supplierPaymentKeys = {
    all: ['supplier-payments'] as const,
    list: (filters?: SupplierPaymentListFilters) => [...supplierPaymentKeys.all, 'list', filters] as const,
    detail: (id: number) => [...supplierPaymentKeys.all, 'detail', id] as const,
    statement: (supplierId: number) => [...supplierPaymentKeys.all, 'statement', supplierId] as const,
    ledger: (supplierId: number, filters?: SupplierLedgerFilters) => [...supplierPaymentKeys.all, 'ledger', supplierId, filters] as const,
    statementsList: (filters?: SupplierPaymentsStatementsListFilters) => [...supplierPaymentKeys.all, 'statements-list', filters] as const,
};

const PAGE_SIZE = 30;

// §12.1bis (2026-08-27, doc fix) — GET /supplier-payments existed since the
// same commit as POST, just wasn't documented in §12. Lets a screen list/
// select a past décaissement to letter/unletter/cancel against.
export const useSupplierPayments = (filters: Omit<SupplierPaymentListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: supplierPaymentKeys.list(filters),
        queryFn: ({ pageParam }) => achatsApi.supplierPayments.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 15_000,
    });

export const useSupplierPayment = (id: number | null) =>
    useQuery({
        queryKey: supplierPaymentKeys.detail(id ?? 0),
        queryFn: () => achatsApi.supplierPayments.get(id!),
        enabled: id != null,
        staleTime: 10_000,
    });

export const useSupplierStatement = (supplierId: number | null) =>
    useQuery({
        queryKey: supplierPaymentKeys.statement(supplierId ?? 0),
        queryFn: () => achatsApi.supplierPayments.statement(supplierId!),
        enabled: supplierId != null,
        staleTime: 15_000,
    });

export const useSupplierLedger = (supplierId: number | null, filters?: SupplierLedgerFilters) =>
    useQuery({
        queryKey: supplierPaymentKeys.ledger(supplierId ?? 0, filters),
        queryFn: () => achatsApi.supplierPayments.ledger(supplierId!, filters),
        enabled: supplierId != null,
        staleTime: 15_000,
    });

export const useSupplierStatementsList = (filters?: SupplierPaymentsStatementsListFilters) =>
    useQuery({
        queryKey: supplierPaymentKeys.statementsList(filters),
        queryFn: () => achatsApi.supplierPayments.statementsList(filters),
        staleTime: 30_000,
    });

// Invalidates broadly (statement + ledger + list/detail for the affected
// supplier/payment, plus supplier-invoices — a payment/lettering changes an
// invoice's paid_amount/remaining_amount/payment_status) rather than trying
// to patch caches in place, matching this module's existing invalidation grain.
const invalidateSupplierAccount = (qc: ReturnType<typeof useQueryClient>, supplierId: number, paymentId?: number) => {
    qc.invalidateQueries({ queryKey: supplierPaymentKeys.statement(supplierId) });
    qc.invalidateQueries({ queryKey: [...supplierPaymentKeys.all, 'ledger', supplierId] });
    qc.invalidateQueries({ queryKey: supplierPaymentKeys.all });
    qc.invalidateQueries({ queryKey: supplierInvoiceKeys.all });
    if (paymentId != null) qc.invalidateQueries({ queryKey: supplierPaymentKeys.detail(paymentId) });
};

export const useCreateSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateSupplierPaymentPayload) => achatsApi.supplierPayments.create(payload),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id, data.data.id),
    });
};

export const useLetterSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: LetterSupplierPaymentPayload }) => achatsApi.supplierPayments.letter(id, payload),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id, data.data.id),
    });
};

export const useUnletterSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (letteringId: number) => achatsApi.supplierPayments.unletter(letteringId),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id, data.data.id),
    });
};

export const useCancelSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: CancelSupplierPaymentPayload }) => achatsApi.supplierPayments.cancel(id, payload),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id, data.data.id),
    });
};
