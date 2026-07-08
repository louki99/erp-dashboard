// ─── Token Series & Device Keys ─────────────────────────────────────────────
// Type definitions for /api/backend/access-control/token-series and
// /api/backend/access-control/device-keys.
// See docs/modules/TOKEN_SERIES_AND_DEVICE_KEYS_UI_GUIDE.md

export const TOKEN_SERIE_SCOPES = ['global', 'branch', 'device'] as const;
export type TokenSerieScope = (typeof TOKEN_SERIE_SCOPES)[number];

// ─── Token Serie ─────────────────────────────────────────────────────────────

export interface TokenSerieNumbering {
    invoice_prefix: string | null;
    invoice_next_number: number;
    order_prefix: string | null;
    order_next_number: number;
    payment_prefix: string | null;
    payment_next_number: number;
    cash_payment_prefix: string | null;
    cash_payment_next_number: number;
    check_payment_prefix: string | null;
    check_payment_next_number: number;
    credit_note_prefix: string | null;
    credit_note_next_number: number;
    deposit_slip_prefix: string | null;
    deposit_slip_next_number: number;
    activity_prefix: string | null;
    activity_next_number: number;
    do_prefix: string | null;
    do_next_number: number;
    batch_prefix: string | null;
    batch_next_number: number;
    visit_prefix: string | null;
    visit_next_number: number;
    loading_prefix: string | null;
    loading_next_number: number;
    transfer_prefix: string | null;
    transfer_next_number: number;
    return_prefix: string | null;
    return_next_number: number;
    damage_prefix: string | null;
    damage_next_number: number;
    unloading_prefix: string | null;
    unloading_next_number: number;
    session_prefix: string | null;
    session_next_number: number;
    expense_prefix: string | null;
    expense_next_number: number;
}

export interface TokenSerie extends TokenSerieNumbering {
    id: number;
    code: string;
    name: string;
    description: string | null;
    scope: TokenSerieScope;
    allowed_branches: string[] | null;
    branch_code: string | null;
    digits_in_counter: number;
    is_default: boolean;
    is_active: boolean;
    auto_generated: boolean;
    created_by: number | null;
    updated_by: number | null;
    created_at: string;
    updated_at: string;
}

export interface TokenSerieUsage {
    device_keys_count: number;
    pos_devices_count: number;
}

export interface TokenSerieDetail {
    data: TokenSerie;
    usage: TokenSerieUsage;
}

export interface CreateTokenSeriePayload {
    code: string;
    name: string;
    description?: string;
    scope: TokenSerieScope;
    allowed_branches?: string[] | null;
    digits_in_counter?: number;
    is_default?: boolean;
    is_active?: boolean;
    invoice_prefix?: string;
    invoice_next_number?: number;
    order_prefix?: string;
    order_next_number?: number;
    payment_prefix?: string;
    payment_next_number?: number;
    cash_payment_prefix?: string;
    cash_payment_next_number?: number;
    check_payment_prefix?: string;
    check_payment_next_number?: number;
    credit_note_prefix?: string;
    credit_note_next_number?: number;
    deposit_slip_prefix?: string;
    deposit_slip_next_number?: number;
    activity_prefix?: string;
    activity_next_number?: number;
    do_prefix?: string;
    do_next_number?: number;
    batch_prefix?: string;
    batch_next_number?: number;
    visit_prefix?: string;
    visit_next_number?: number;
    loading_prefix?: string;
    loading_next_number?: number;
    transfer_prefix?: string;
    transfer_next_number?: number;
    return_prefix?: string;
    return_next_number?: number;
    damage_prefix?: string;
    damage_next_number?: number;
    unloading_prefix?: string;
    unloading_next_number?: number;
    session_prefix?: string;
    session_next_number?: number;
    expense_prefix?: string;
    expense_next_number?: number;
}

export type UpdateTokenSeriePayload = Partial<CreateTokenSeriePayload>;

export interface TokenSerieListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface TokenSerieListLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
}

export interface TokenSerieListResponse {
    data: TokenSerie[];
    meta: TokenSerieListMeta;
    links: TokenSerieListLinks;
}

export interface TokenSerieSingleResponse {
    data: TokenSerie;
}

export interface TokenSerieDeleteResponse {
    message: string;
}

export interface TokenSerieConflictResponse {
    message: string;
    references: string[];
}

export interface TokenSerieFilters {
    active_only?: boolean;
    per_page?: number;
    page?: number;
}

// ─── Device Key ──────────────────────────────────────────────────────────────

export interface DeviceKeyUser {
    id: number;
    name: string;
    email: string;
}

export interface DeviceKeyBranch {
    code: string;
    name: string;
}

export interface DeviceKeyTokenSerie {
    id: number;
    code: string;
    name: string;
    order_next_number: number;
}

export interface DeviceKey {
    id: number;
    user_id: number;
    user?: DeviceKeyUser;
    key: string;
    device_type: string | null;
    branch_id: number | null;
    branch?: DeviceKeyBranch;
    token_series_code: string | null;
    token_serie?: DeviceKeyTokenSerie;
    hardware_serial: string | null;
    device_model_code: string | null;
    device_id_digest: string | null;
    push_token: string | null;
    app_version: string | null;
    os_version: string | null;
    last_known_ip: string | null;
    peripherals: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    activation_token: string | null;
    activation_expires_at: string | null;
    activated_at: string | null;
    failed_attempts: number;
    locked_until: string | null;
    last_seen_at: string | null;
    last_sync_at: string | null;
    last_successful_sync_at: string | null;
    revoked_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface CreateDeviceKeyPayload {
    user_id: number;
    key?: string;
    device_type?: string;
    branch_code?: string;
    token_series_code?: string;
    hardware_serial?: string;
    device_model_code?: string;
    push_token?: string;
    app_version?: string;
    os_version?: string;
    peripherals?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface UpdateDeviceKeyPayload {
    device_type?: string;
    branch_code?: string | null;
    token_series_code?: string | null;
    hardware_serial?: string | null;
    device_model_code?: string | null;
    device_id_digest?: string | null;
    push_token?: string | null;
    app_version?: string | null;
    os_version?: string | null;
    peripherals?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    last_known_ip?: string | null;
}

export interface RotateKeyPayload {
    key?: string;
}

export interface SetPinPayload {
    pin: string;
}

export interface PinOperationResult {
    id: number;
    user_id: number;
    key: string;
    failed_attempts: number;
    locked_until: string | null;
    requires_pin_setup: boolean;
}

export interface DeviceKeyListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface DeviceKeyListLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
}

export interface DeviceKeyListResponse {
    data: DeviceKey[];
    meta: DeviceKeyListMeta;
    links: DeviceKeyListLinks;
}

export interface DeviceKeySingleResponse {
    data: DeviceKey;
}

export interface DeviceKeyMessageResponse {
    message: string;
    data: DeviceKey;
}

export interface DeviceKeyDeleteResponse {
    message: string;
}

export interface DeviceKeyFilters {
    user_id?: number;
    revoked?: boolean;
    branch_code?: string;
    token_series_code?: string;
    key?: string;
    per_page?: number;
    page?: number;
}

// ─── Selector options ────────────────────────────────────────────────────────

export interface EntityOption {
    value: string | number;
    label: string;
    description?: string;
}
