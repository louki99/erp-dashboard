import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { achatsApi } from '@/services/api/achatsApi';
import { supplierInvoiceKeys } from '@/hooks/achats/useSupplierInvoices';
import type {
    CreateSupplierPaymentPayload, LetterSupplierPaymentPayload, SupplierLedgerFilters,
    SupplierPaymentsStatementsListFilters,
} from '@/types/achats.types';

export const supplierPaymentKeys = {
    all: ['supplier-payments'] as const,
    statement: (supplierId: number) => [...supplierPaymentKeys.all, 'statement', supplierId] as const,
    ledger: (supplierId: number, filters?: SupplierLedgerFilters) => [...supplierPaymentKeys.all, 'ledger', supplierId, filters] as const,
    statementsList: (filters?: SupplierPaymentsStatementsListFilters) => [...supplierPaymentKeys.all, 'statements-list', filters] as const,
};

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

// Invalidates broadly (statement + ledger for the affected supplier, plus
// supplier-invoices — a payment/lettering changes an invoice's reconciled
// state even though SupplierInvoice's own JSON doesn't expose that field
// today, see achats.types.ts's comment) rather than trying to patch caches
// in place, matching this module's existing invalidation grain.
const invalidateSupplierAccount = (qc: ReturnType<typeof useQueryClient>, supplierId: number) => {
    qc.invalidateQueries({ queryKey: supplierPaymentKeys.statement(supplierId) });
    qc.invalidateQueries({ queryKey: [...supplierPaymentKeys.all, 'ledger', supplierId] });
    qc.invalidateQueries({ queryKey: supplierPaymentKeys.all });
    qc.invalidateQueries({ queryKey: supplierInvoiceKeys.all });
};

export const useCreateSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CreateSupplierPaymentPayload) => achatsApi.supplierPayments.create(payload),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id),
    });
};

export const useLetterSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: LetterSupplierPaymentPayload }) => achatsApi.supplierPayments.letter(id, payload),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id),
    });
};

export const useUnletterSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (letteringId: number) => achatsApi.supplierPayments.unletter(letteringId),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id),
    });
};

export const useCancelSupplierPayment = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => achatsApi.supplierPayments.cancel(id),
        onSuccess: (data) => invalidateSupplierAccount(qc, data.data.supplier_id),
    });
};
