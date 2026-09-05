// Types for /api/backend/access-control/sales-souches.
// See docs/modules/TOKEN_SERIES_AND_DEVICE_KEYS_UI_GUIDE.md §10.

export type SalesSoucheFiscalType = 'declared' | 'internal';

export interface SalesSoucheTokenSerieRef {
    id: number;
    code: string;
    name: string;
}

export interface SalesSouche {
    id: number;
    company_id: number | null;
    branch_code: string | null;
    code: string;
    name: string;
    fiscal_type: SalesSoucheFiscalType;
    token_serie_id: number;
    token_serie?: SalesSoucheTokenSerieRef;
    is_active: boolean;
    is_default: boolean;
    created_at: string;
    updated_at: string;
}

export interface CreateSalesSouchePayload {
    branch_code?: string | null;
    code: string;
    name: string;
    fiscal_type: SalesSoucheFiscalType;
    token_serie_id: number;
    is_active?: boolean;
    is_default?: boolean;
}

// token_serie_id is deliberately not editable — see §10.4 (re-pointing an
// existing souche at another series would restart that series' counter
// under the same fiscal identity, a bigger risk than a naming mistake).
export interface UpdateSalesSouchePayload {
    branch_code?: string | null;
    code?: string;
    name?: string;
    fiscal_type?: SalesSoucheFiscalType;
    is_active?: boolean;
    is_default?: boolean;
}

export interface SalesSoucheFilters {
    branch_code?: string;
    active_only?: boolean;
    per_page?: number;
    page?: number;
}

export interface SalesSoucheListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface SalesSoucheListResponse {
    data: SalesSouche[];
    links?: Record<string, unknown>;
    meta?: SalesSoucheListMeta;
}

export interface SalesSoucheSingleResponse {
    data: SalesSouche;
}

// 409 on POST/PUT — a default souche already exists for this (company, branch).
export interface SalesSoucheDefaultConflictResponse {
    message: string;
    conflicting_sales_souche_id: number;
}

// 409 on DELETE — souche still referenced (is_default and/or a PaymentTerm's
// default_sales_souche_id).
export interface SalesSoucheDeleteConflictResponse {
    message: string;
    references: string[];
}

export interface SalesSoucheDeleteResponse {
    message: string;
}

// Sent on the 4 GCOM endpoints listed in §10.6 — replaces the old souche_kind.
export interface SalesSoucheOverride {
    sales_souche_id?: number | null;
}
