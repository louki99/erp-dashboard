import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gcomApi } from '@/services/api/gcomApi';
import { invoiceKeys } from '@/hooks/gcom/useGcomInvoices';
import type { GcomQuoteStatus } from '@/types/gcom.types';

export const quoteKeys = {
    all: ['gcom-quotes'] as const,
    list: (filters?: { status?: GcomQuoteStatus }) => [...quoteKeys.all, 'list', filters] as const,
    detail: (id: number) => [...quoteKeys.all, 'detail', id] as const,
};

const PAGE_SIZE = 30;

// Plain useQuery elsewhere in this app (useWarehouse.ts/useRouting.ts) never
// needed pagination-with-accumulation — Devis/Facture/BC/BL's "Charger plus"
// UX is a real infinite-scroll list, so useInfiniteQuery (same package,
// designed for exactly this) is the right tool here, not a deviation.
export const useQuotes = (filters: { status?: GcomQuoteStatus }) =>
    useInfiniteQuery({
        queryKey: quoteKeys.list(filters),
        queryFn: ({ pageParam }) => gcomApi.quotes.list({ ...filters, per_page: PAGE_SIZE, page: pageParam }),
        initialPageParam: 1,
        getNextPageParam: last => (last.current_page < last.last_page ? last.current_page + 1 : undefined),
        staleTime: 30_000,
    });

export const useQuote = (id: number | null) =>
    useQuery({
        queryKey: quoteKeys.detail(id ?? 0),
        queryFn: () => gcomApi.quotes.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateQuote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: gcomApi.quotes.create,
        onSuccess: () => qc.invalidateQueries({ queryKey: quoteKeys.all }),
    });
};

export const useConvertQuoteToOrder = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof gcomApi.quotes.convertToOrder>[1] }) =>
            gcomApi.quotes.convertToOrder(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: quoteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: quoteKeys.all });
        },
    });
};

export const useConvertQuoteToInvoice = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof gcomApi.quotes.convert>[1] }) =>
            gcomApi.quotes.convert(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: quoteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: quoteKeys.all });
            // A direct invoice was created server-side — keep FacturesPage in sync too.
            qc.invalidateQueries({ queryKey: invoiceKeys.all });
        },
    });
};