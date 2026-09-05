import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as salesSouchesApi from '@/services/api/salesSouchesApi';
import type {
    CreateSalesSouchePayload,
    SalesSouche,
    SalesSoucheDeleteConflictResponse,
    SalesSoucheDeleteResponse,
    SalesSoucheFilters,
    SalesSoucheListResponse,
    UpdateSalesSouchePayload,
} from '@/types/salesSouches.types';

export const SALES_SOUCHES_BASE_KEY = ['sales-souches'] as const;

export const salesSouchesKeys = {
    all: SALES_SOUCHES_BASE_KEY,
    lists: () => [...SALES_SOUCHES_BASE_KEY, 'list'] as const,
    list: (filters: SalesSoucheFilters) => [...salesSouchesKeys.lists(), filters] as const,
    detail: (id: number) => [...SALES_SOUCHES_BASE_KEY, 'detail', id] as const,
};

export function useSalesSouches(filters: SalesSoucheFilters = {}, options: { enabled?: boolean } = {}) {
    return useQuery<SalesSoucheListResponse>({
        queryKey: salesSouchesKeys.list(filters),
        queryFn: () => salesSouchesApi.getSalesSouches(filters),
        enabled: options.enabled,
    });
}

export function useSalesSouche(id: number | null) {
    return useQuery<SalesSouche>({
        queryKey: id ? salesSouchesKeys.detail(id) : ['sales-souches', 'detail', 'noop'],
        queryFn: () => salesSouchesApi.getSalesSouche(id as number),
        enabled: !!id,
    });
}

export function useCreateSalesSouche() {
    const queryClient = useQueryClient();

    return useMutation<SalesSouche, AxiosError, CreateSalesSouchePayload>({
        mutationFn: (payload) => salesSouchesApi.createSalesSouche(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: salesSouchesKeys.all });
        },
    });
}

export function useUpdateSalesSouche(id: number) {
    const queryClient = useQueryClient();

    return useMutation<SalesSouche, AxiosError, UpdateSalesSouchePayload>({
        mutationFn: (payload) => salesSouchesApi.updateSalesSouche(id, payload),
        onSuccess: (souche) => {
            queryClient.setQueryData(salesSouchesKeys.detail(id), souche);
            queryClient.invalidateQueries({ queryKey: salesSouchesKeys.all });
        },
    });
}

export function useDeleteSalesSouche() {
    const queryClient = useQueryClient();

    // Scoped the same way as useDeleteTokenSerie — see that hook's comment.
    // A blanket `all` invalidation here would re-trigger the just-deleted
    // souche's own detail query (still enabled by the delete-confirm dialog
    // at the moment onSuccess runs) and 404 it right after a successful delete.
    return useMutation<SalesSoucheDeleteResponse | SalesSoucheDeleteConflictResponse, AxiosError, number>({
        mutationFn: (id) => salesSouchesApi.deleteSalesSouche(id),
        onSuccess: (_data, id) => {
            queryClient.removeQueries({ queryKey: salesSouchesKeys.detail(id) });
            queryClient.invalidateQueries({ queryKey: salesSouchesKeys.lists() });
        },
    });
}
