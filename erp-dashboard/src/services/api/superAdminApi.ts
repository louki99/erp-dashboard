import apiClient from './client';

const BASE = '/api/backend/super-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TenantStatus = 'active' | 'suspended' | 'blocked' | 'trial' | 'expired';
export type DomainStatus = 'active' | 'blocked' | 'pending' | 'unverified';
export type DomainTestResult = 'ok' | 'error' | 'timeout' | 'pending';

export interface TenantDomain {
    id: number;
    domain: string;
    status: DomainStatus;
    is_primary: boolean;
    verified: boolean;
    last_tested_at: string | null;
    test_result: DomainTestResult | null;
    test_message: string | null;
    created_at: string;
}

export interface Tenant {
    id: number;
    code: string;
    name: string;
    status: TenantStatus;
    plan: string | null;
    primary_domain: string | null;
    user_count: number;
    domain_count: number;
    created_at: string;
    expires_at: string | null;
    last_login_at: string | null;
    contact_email: string | null;
    contact_name: string | null;
    max_users: number | null;
    storage_used_mb: number | null;
    storage_limit_mb: number | null;
    domains?: TenantDomain[];
}

export interface TenantSummary {
    total: number;
    active: number;
    suspended: number;
    blocked: number;
    trial: number;
    expired: number;
}

export interface DomainTestResponse {
    domain: string;
    result: DomainTestResult;
    message: string;
    tested_at: string;
    checks: {
        dns: boolean;
        ssl: boolean;
        reachable: boolean;
        latency_ms: number | null;
    };
}

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const getTenants = async (): Promise<Tenant[]> => {
    const res = await apiClient.get(`${BASE}/tenants`);
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.tenants)) return d.tenants;
    return [];
};

export const getTenant = async (id: number): Promise<Tenant> => {
    const res = await apiClient.get(`${BASE}/tenants/${id}`);
    return res.data?.tenant ?? res.data;
};

export const updateTenantStatus = async (
    id: number,
    status: TenantStatus,
    reason?: string,
): Promise<Tenant> => {
    const res = await apiClient.patch(`${BASE}/tenants/${id}/status`, { status, reason });
    return res.data?.tenant ?? res.data;
};

export const createTenant = async (data: {
    code: string; name: string; contact_email?: string;
    contact_name?: string; plan?: string; max_users?: number;
    expires_at?: string;
}): Promise<Tenant> => {
    const res = await apiClient.post(`${BASE}/tenants`, data);
    return res.data?.tenant ?? res.data;
};

// ─── Domains ─────────────────────────────────────────────────────────────────

export const getTenantDomains = async (tenantId: number): Promise<TenantDomain[]> => {
    const res = await apiClient.get(`${BASE}/tenants/${tenantId}/domains`);
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.domains)) return d.domains;
    return [];
};

export const addDomain = async (
    tenantId: number,
    domain: string,
    isPrimary = false,
): Promise<TenantDomain> => {
    const res = await apiClient.post(`${BASE}/tenants/${tenantId}/domains`, { domain, is_primary: isPrimary });
    return res.data?.domain ?? res.data;
};

export const updateDomainStatus = async (
    tenantId: number,
    domainId: number,
    status: DomainStatus,
): Promise<TenantDomain> => {
    const res = await apiClient.patch(`${BASE}/tenants/${tenantId}/domains/${domainId}/status`, { status });
    return res.data?.domain ?? res.data;
};

export const testDomain = async (
    tenantId: number,
    domainId: number,
): Promise<DomainTestResponse> => {
    const res = await apiClient.post(`${BASE}/tenants/${tenantId}/domains/${domainId}/test`);
    return res.data;
};

export const deleteDomain = async (tenantId: number, domainId: number): Promise<void> => {
    await apiClient.delete(`${BASE}/tenants/${tenantId}/domains/${domainId}`);
};

// ─── Summary ─────────────────────────────────────────────────────────────────

export const getTenantSummary = async (): Promise<TenantSummary> => {
    const res = await apiClient.get(`${BASE}/summary`);
    return res.data?.summary ?? res.data;
};
