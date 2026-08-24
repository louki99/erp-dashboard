import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { gcomApi } from '@/services/api/gcomApi';
import type { GcomCreditNotesGlobalListFilters } from '@/types/gcom.types';

export const creditNoteKeys = {
    all: ['gcom-credit-notes'] as const,
    list: (filters?: GcomCreditNotesGlobalListFilters) => [...creditNoteKeys.all, 'list', filters] as const,
    detail: (id: number) => [...creditNoteKeys.all, 'detail', id] as const,
};

// AvoirsPage doesn't paginate (flat per_page:100, no "load more") — plain
// useQuery, unlike Devis/Facture/BC/BL's useInfiniteQuery.
export const useCreditNotes = (filters?: GcomCreditNotesGlobalListFilters) =>
    useQuery({
        queryKey: creditNoteKeys.list(filters),
        queryFn: () => gcomApi.creditNotes.list(filters),
        staleTime: 30_000,
    });

export const useCreditNote = (id: number | null) =>
    useQuery({
        queryKey: creditNoteKeys.detail(id ?? 0),
        queryFn: () => gcomApi.creditNotes.get(id!),
        enabled: id != null,
        staleTime: 15_000,
    });

export const useCreateFreeStandingCreditNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: gcomApi.creditNotes.createFreeStanding,
        onSuccess: () => qc.invalidateQueries({ queryKey: creditNoteKeys.all }),
    });
};

export const useRedeemCreditNote = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof gcomApi.creditNotes.redeem>[1] }) =>
            gcomApi.creditNotes.redeem(id, payload),
        onSuccess: (_data, vars) => {
            qc.invalidateQueries({ queryKey: creditNoteKeys.detail(vars.id) });
            qc.invalidateQueries({ queryKey: creditNoteKeys.all });
        },
    });
};