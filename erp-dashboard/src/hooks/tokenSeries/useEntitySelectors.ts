import { useQuery } from '@tanstack/react-query';
import { getBranches, getUsers } from '@/services/api/configApi';
import { getTokenSeries } from '@/services/api/tokenSeriesApi';
import type { EntityOption, TokenSerieFilters } from '@/types/tokenSeries.types';

const SELECTORS_BASE_KEY = ['access-control-selectors'] as const;

function mapUsers(list: Awaited<ReturnType<typeof getUsers>>): EntityOption[] {
    return list.map((u) => ({ value: u.id, label: u.name, description: u.description }));
}

function mapBranches(list: Awaited<ReturnType<typeof getBranches>>): EntityOption[] {
    return list.map((b) => ({ value: b.id, label: b.name, description: b.description }));
}

function mapTokenSeries(list: Awaited<ReturnType<typeof getTokenSeries>>['data']): EntityOption[] {
    return list.map((s) => ({ value: s.code, label: `${s.code} — ${s.name}`, description: s.scope }));
}

export function useUsersOptions(search?: string) {
    return useQuery<EntityOption[]>({
        queryKey: [...SELECTORS_BASE_KEY, 'users', search ?? ''],
        queryFn: () => getUsers(search).then(mapUsers),
        staleTime: 60_000,
    });
}

export function useBranchesOptions() {
    return useQuery<EntityOption[]>({
        queryKey: [...SELECTORS_BASE_KEY, 'branches'],
        queryFn: () => getBranches().then(mapBranches),
        staleTime: 60_000,
    });
}

export function useTokenSeriesOptions(filters: TokenSerieFilters = { active_only: true, per_page: 500 }) {
    return useQuery<EntityOption[]>({
        queryKey: [...SELECTORS_BASE_KEY, 'token-series', filters],
        queryFn: () => getTokenSeries(filters).then((r) => mapTokenSeries(r.data)),
        staleTime: 60_000,
    });
}
