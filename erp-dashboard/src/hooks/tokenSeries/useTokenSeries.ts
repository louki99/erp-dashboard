import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as tokenSeriesApi from '@/services/api/tokenSeriesApi';
import type {
    CreateTokenSeriePayload,
    ResetTokenSerieFamilyPayload,
    TokenSerie,
    TokenSerieDeleteResponse,
    TokenSerieDetail,
    TokenSerieFilters,
    TokenSerieListResponse,
    UpdateTokenSeriePayload,
} from '@/types/tokenSeries.types';

export const TOKEN_SERIES_BASE_KEY = ['token-series'] as const;

export const tokenSeriesKeys = {
    all: TOKEN_SERIES_BASE_KEY,
    lists: () => [...TOKEN_SERIES_BASE_KEY, 'list'] as const,
    list: (filters: TokenSerieFilters) => [...tokenSeriesKeys.lists(), filters] as const,
    detail: (code: string) => [...TOKEN_SERIES_BASE_KEY, 'detail', code] as const,
};

export function useTokenSeries(filters: TokenSerieFilters = {}) {
    return useQuery<TokenSerieListResponse>({
        queryKey: tokenSeriesKeys.list(filters),
        queryFn: () => tokenSeriesApi.getTokenSeries(filters),
    });
}

export function useTokenSerie(code: string | null) {
    return useQuery<TokenSerieDetail>({
        queryKey: code ? tokenSeriesKeys.detail(code) : ['token-series', 'detail', 'noop'],
        queryFn: () => tokenSeriesApi.getTokenSerie(code as string),
        enabled: !!code,
    });
}

export function useCreateTokenSerie() {
    const queryClient = useQueryClient();

    return useMutation<TokenSerie, AxiosError, CreateTokenSeriePayload>({
        mutationFn: (payload) => tokenSeriesApi.createTokenSerie(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.all });
        },
    });
}

export function useUpdateTokenSerie(code: string) {
    const queryClient = useQueryClient();

    return useMutation<TokenSerie, AxiosError, UpdateTokenSeriePayload>({
        mutationFn: (payload) => tokenSeriesApi.updateTokenSerie(code, payload),
        onSuccess: (serie) => {
            queryClient.setQueryData(tokenSeriesKeys.detail(code), serie);
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.all });
        },
    });
}

export function useDeleteTokenSerie() {
    const queryClient = useQueryClient();

    return useMutation<TokenSerieDeleteResponse, AxiosError, string>({
        mutationFn: (code) => tokenSeriesApi.deleteTokenSerie(code) as Promise<TokenSerieDeleteResponse>,
        // Live bug (2026-08-27): invalidating tokenSeriesKeys.all here used to
        // also match the just-deleted code's OWN detail query
        // (['token-series','detail',code]). If a component still had that
        // exact query enabled at this moment (e.g. the delete-confirm
        // dialog's own usage check, or the detail view for the series being
        // deleted) — which it always does, since this onSuccess runs BEFORE
        // the page's own post-delete state-clearing runs, see
        // TokenSeriesPage.tsx's handleDelete — invalidation triggered an
        // immediate refetch against a resource that no longer exists, 404ing
        // and popping a spurious "Ressource introuvable" toast right after a
        // successful delete. Scoped to `lists()` + an explicit `removeQueries`
        // for the specific deleted code's detail entry instead of a blanket
        // `all` invalidation, which also collaterally busted unrelated
        // detail queries for other series.
        onSuccess: (_data, code) => {
            queryClient.removeQueries({ queryKey: tokenSeriesKeys.detail(code) });
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.lists() });
        },
    });
}

export function useResetTokenSerieFamily(code: string) {
    const queryClient = useQueryClient();

    return useMutation<TokenSerie, AxiosError, ResetTokenSerieFamilyPayload>({
        mutationFn: (payload) => tokenSeriesApi.resetTokenSerieFamily(code, payload),
        onSuccess: () => {
            // Busts the detail cache too — numbering_families' locked flags
            // change for the reset family (and its own counter/prefix reset),
            // not just the flat TokenSerie fields setQueryData below already covers.
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.detail(code) });
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.all });
        },
    });
}
