import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as tokenSeriesApi from '@/services/api/tokenSeriesApi';
import type {
    CreateTokenSeriePayload,
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
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: tokenSeriesKeys.all });
        },
    });
}
