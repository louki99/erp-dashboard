import { useQuery } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { rbacApi } from '@/services/api/rbacApi';
import type { RbacUserRow } from '@/types/rbac.types';

// ─── Query keys ──────────────────────────────────────────────────────────────

const rbacKeys = {
    all: ['rbac'] as const,
    users: (params: RbacUsersParams) => ['rbac', 'users', params] as const,
};

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RbacUsersParams {
    search?: string;
    role?: string;
    access_profile_id?: number;
    branch_id?: number;
    per_page?: number;
}

export interface RbacUsersResult {
    data: RbacUserRow[];
    total: number;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Generic hook for GET /api/backend/rbac/users.
 * Pass `role` to filter by role group / alias / exact name.
 * Examples: role="vendeur", role="livreur", role="vanSelling,cdz"
 */
export function useRbacUsers(params: RbacUsersParams = {}) {
    return useQuery<RbacUsersResult, AxiosError>({
        queryKey: rbacKeys.users(params),
        queryFn: async () => {
            const res = await rbacApi.getUsers(params);
            return {
                data: res.data?.data ?? [],
                total: res.data?.total ?? 0,
            };
        },
        staleTime: 2 * 60 * 1000,
    });
}

/**
 * Convenience hook — returns field-sales users (vanSelling + CDZ)
 * for use in itinerary / routing rider dropdowns.
 */
export function useVendeurs(perPage = 500) {
    return useRbacUsers({ role: 'vendeur', per_page: perPage });
}

/**
 * Convenience hook — returns delivery agents (livreur / driver role).
 */
export function useLivreurs(perPage = 500) {
    return useRbacUsers({ role: 'livreur', per_page: perPage });
}
