// ─── Data Rules ─────────────────────────────────────────────────────────────
// Type definitions for the dynamic visibility matrix (/api/backend/access-control/data-rules)
// See docs/modules/DATA_RULES_UI_GUIDE.md

export const DATA_RULE_SCOPE_TYPES = ['user', 'profile', 'role', 'branch', 'partner'] as const;
export const DATA_RULE_ACTIONS = ['allow', 'deny'] as const;
export const DATA_RULE_MODEL_TYPES = [
    'App\\Models\\ProductPage',
    'App\\Models\\PaymentTerm',
    'App\\Models\\PaymentMethod',
    'App\\Models\\Category',
    'App\\Models\\Product',
] as const;

export const DATA_RULE_SUBJECTS = [
    'product_page',
    'payment_term',
    'payment_method',
    'category',
    'product',
] as const;

export type DataRuleScopeType = (typeof DATA_RULE_SCOPE_TYPES)[number];
export type DataRuleAction = (typeof DATA_RULE_ACTIONS)[number];
export type DataRuleModelType = (typeof DATA_RULE_MODEL_TYPES)[number];
export type DataRuleSubject = (typeof DATA_RULE_SUBJECTS)[number];

// ─── Entity ──────────────────────────────────────────────────────────────────

export interface DataRule {
    id: number;
    model_type: DataRuleModelType;
    model_id: number | null;
    scope_type: DataRuleScopeType;
    scope_value: string;
    action: DataRuleAction;
    // Hydrated labels (new)
    model_type_label: string;
    resource_label: string;
    scope_label: string;
    created_at: string;
    updated_at: string;
}

// ─── Payloads ────────────────────────────────────────────────────────────────

export interface CreateDataRulePayload {
    model_type: DataRuleModelType;
    model_id?: number | null;
    scope_type: DataRuleScopeType;
    scope_value: string;
    action: DataRuleAction;
    confirm_wildcard_deny?: boolean;
}

export interface UpdateDataRulePayload {
    model_type?: DataRuleModelType;
    model_id?: number | null;
    scope_type?: DataRuleScopeType;
    scope_value?: string;
    action?: DataRuleAction;
    confirm_wildcard_deny?: boolean;
}

export interface DenyBySubjectCodePayload {
    subject: DataRuleSubject;
    code: string;
    scope_type: DataRuleScopeType;
    scope_value: string;
}

export interface BulkReplaceRuleEntry {
    model_id: number | null;
    action: DataRuleAction;
    confirm_wildcard_deny?: boolean;
}

export interface BulkReplacePayload {
    scope_type: DataRuleScopeType;
    scope_value: string;
    model_type: DataRuleModelType;
    rules: BulkReplaceRuleEntry[];
}

// ─── Responses ───────────────────────────────────────────────────────────────

export interface DataRuleListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface DataRuleListLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
}

export interface DataRuleListResponse {
    data: DataRule[];
    meta: DataRuleListMeta;
    links: DataRuleListLinks;
}

export interface DataRuleSingleResponse {
    data: DataRule;
}

export interface DataRuleDeleteResponse {
    message: string;
    data: { id: number };
}

export interface BulkReplaceResponse {
    message: string;
    count: number;
    data: DataRule[];
}

export interface RevokeDenyResponse {
    message: string;
    deleted: number;
}

export interface WildcardDenyErrorResponse {
    message: string;
    requires: 'confirm_wildcard_deny';
}

// ─── Scopes & Resources selectors ────────────────────────────────────────────

export interface DataRuleScopeOption {
    value: string;
    label: string;
}

export interface DataRuleScopesResponse {
    type: DataRuleScopeType;
    data: DataRuleScopeOption[];
}

export interface DataRuleResource {
    id: number;
    label: string;
    code?: string;
    parent_id?: number | null;
    is_credit?: boolean;
    is_cash?: boolean;
}

export interface DataRuleResourcesResponse {
    model_type: DataRuleModelType;
    model_type_label: string;
    data: DataRuleResource[];
}

// ─── UI Filters ──────────────────────────────────────────────────────────────

export interface DataRuleFilters {
    model_type?: DataRuleModelType;
    scope_type?: DataRuleScopeType;
    scope_value?: string;
    action?: DataRuleAction;
    model_id?: number;
    per_page?: number;
    page?: number;
}

// ─── UI helpers ──────────────────────────────────────────────────────────────

export interface ModelTypeOption {
    label: string;
    value: DataRuleModelType;
    subject: DataRuleSubject;
}

export interface ScopeTypeOption {
    label: string;
    value: DataRuleScopeType;
    example: string;
}
