import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gcomApi } from '@/services/api/gcomApi';
import { creditNoteKeys } from '@/hooks/gcom/useGcomCreditNotes';
import { noteKeys } from '@/hooks/gcom/useGcomDeliveryNotes';
import type { GcomCatalogEntrySubmitPayload } from '@/components/gcom/GcomCatalogEntryScreen';
import type { GcomInvoice, GcomInvoiceListFilters, GcomCreateCreditNotePayload, GcomConsolidateInvoicePayload } from '@/types/gcom.types';

export const invoiceKeys = {
    all: ['gcom-invoices'] as const,
    list: (filters?: GcomInvoiceListFilters) => [...invoiceKeys.all, 'list', filters] as const,
    detail: (id: number) => [...invoiceKeys.all, 'detail', id] as const,
    creditNotes: (id: number) => [...invoiceKeys.all, 'credit-notes', id] as const,
};

const PAGE_SIZE = 30;

export const useInvoices = (filters: Omit<GcomInvoiceListFilters, 'per_page' | 'page'>) =>
    useInfiniteQuery({
        queryKey: invoiceKeys.list(filters),
        queryFn: ({ pageParam }) => gcomApi.invoices.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const useInvoice = (id: number | null) =>
    useQuery({
        queryKey: invoiceKeys.detail(id ?? 0),
        queryFn: () => gcomApi.invoices.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useInvoiceCreditNotes = (id: number | null) =>
    useQuery({
        queryKey: invoiceKeys.creditNotes(id ?? 0),
        queryFn: () => gcomApi.invoices.creditNotes(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateCreditNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ invoiceId, payload }: { invoiceId: number; payload: GcomCreateCreditNotePayload }) =>
            gcomApi.invoices.createCreditNote(invoiceId, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: invoiceKeys.detail(vars.invoiceId) });
            qc.invalidateQueries({ queryKey: invoiceKeys.creditNotes(vars.invoiceId) });
            qc.invalidateQueries({ queryKey: invoiceKeys.all });
            // The new credit note should also show up on AvoirsPage.
            qc.invalidateQueries({ queryKey: creditNoteKeys.all });
        },
    });
};

// BonLivraisonPage.tsx's "Consolider en une facture" — groups ≥2 BLs (same
// partner) into one invoice.
export const useConsolidateInvoices = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: GcomConsolidateInvoicePayload) => gcomApi.invoices.consolidate(payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: invoiceKeys.all });
            qc.invalidateQueries({ queryKey: noteKeys.all });
        },
    });
};

// Comptoir (§17) — BC + stock-out + invoice created in one call. Invalidates
// the invoice list so FacturesPage picks up the new record without waiting
// out its own staleTime.
export const useCreateDirectInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: GcomCatalogEntrySubmitPayload): Promise<GcomInvoice> =>
            gcomApi.directInvoices.create(payload),
        onSuccess: () => qc.invalidateQueries({ queryKey: invoiceKeys.all }),
    });
};