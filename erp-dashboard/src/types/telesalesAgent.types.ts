// Types for the Télévendeur (Tele-Sales) module — Lot 2: Agent (poste télévendeur).
// Base URL: /api/backend/telesales/... — role televendeur|admin|root.
// Ref: docs/TeleSales_UI_Integration_Spec.md §1–6.
// NOT the same base URL as Lot 1 admin (/api/backend/admin/telesales/...) — see telesales.types.ts.

import type { TeleVisit, TeleVisitOutcome, TeleVisitPartner, ApiSuccessResponse } from './telesales.types';

export type { TeleVisit, TeleVisitOutcome, TeleVisitPartner };
export { TELE_VISIT_OUTCOME_LABELS } from './telesales.types';

// ─── §2 — Session ─────────────────────────────────────────────────────────────

export type TeleSalesSessionStatus = 'active' | 'paused' | 'ended';

export interface TeleSalesSession {
    id: number;
    user_id: number;
    status: TeleSalesSessionStatus;
    started_at: string;
    paused_at: string | null;
    resumed_at: string | null;
    ended_at: string | null;
    total_paused_seconds: number;
}

export interface CurrentSessionResponse extends ApiSuccessResponse {
    session: TeleSalesSession | null;
}

export interface SessionResponse extends ApiSuccessResponse {
    session: TeleSalesSession;
}

// ─── §3 — Planning / Visites ──────────────────────────────────────────────────

export interface PlanningResponse extends ApiSuccessResponse {
    date: string;
    visits: TeleVisit[];
}

export interface VisitsHistoryResponse extends ApiSuccessResponse {
    visits: TeleVisit[];
}

export interface CreateVisitRequest {
    partner_id: number;
    scheduled_at: string; // "YYYY-MM-DD HH:mm:ss"
    notes?: string;
}

export interface VisitResponse extends ApiSuccessResponse {
    visit: TeleVisit;
}

export interface StartAdhocVisitRequest {
    partner_id: number;
}

export interface CompleteVisitRequest {
    outcome: TeleVisitOutcome;
    notes?: string;
    order_id?: number;
}

// ─── §4 — Catalogue / Master data ────────────────────────────────────────────

export interface CatalogProductPackaging {
    packaging_id: number;
    unit_id: number;
    unit_name: string;
    quantity: number;
    is_default: boolean;
}

export interface ProductBrand {
    id: number;
    name: string;
}

// Only present on GET /catalog/products, and only if partner_id was resolved
// to an effective price list for that partner — null otherwise (never on /catalog/sync).
export interface ProductPriceList {
    id: number;
    code: string;
    name: string;
}

export interface ProductMarketing {
    is_new: boolean;
    is_featured: boolean;
}

// From `product_flags` — defaults below apply when no product_flags row exists
// for the product: is_salable/is_returnable/is_discountable/is_expirable = true,
// requires_refrigeration/decimal_quantity_allowed = false, min_quantity_order = 0.
export interface ProductFlags {
    is_salable: boolean;
    is_returnable: boolean;
    is_discountable: boolean;
    is_expirable: boolean;
    requires_refrigeration: boolean;
    decimal_quantity_allowed: boolean;
    min_quantity_order: number;
}

export interface CatalogProduct {
    id: number;
    code: string;
    name: string;
    short_description: string | null;
    barcode: string | null;
    brand: ProductBrand | null;
    product_page_code: string | null;
    unit_id: number;
    unit_name: string;
    price: number;
    price_source: 'partner' | 'generic';
    price_list: ProductPriceList | null;
    tax_rate: number;
    stock_available: number;
    marketing: ProductMarketing;
    // ⚠️ buy_price (cost) is deliberately never exposed to this sales channel — don't add it.
    flags: ProductFlags;
    packagings: CatalogProductPackaging[];
}

export interface CatalogProductsResponse extends ApiSuccessResponse {
    products: CatalogProduct[];
    pagination: { current_page: number; total_pages: number; total: number; per_page: number };
}

export interface CatalogPage {
    id: number;
    code: string;
    name: string;
    rank: number;
}

export interface CatalogPagesResponse extends ApiSuccessResponse {
    pages: CatalogPage[];
}

// ─── §4.4 — Sync local-first (cache IndexedDB) ───────────────────────────────
// Catalogue/partenaires cachés séparément (catalogue partagé, partenaires par
// agent) et combinés localement. Base price (générique→override→palier) est
// reproductible fidèlement ; les promotions ne le sont PAS (budget/cumul =
// état serveur mutable) — tout prix calculé localement doit être marqué
// "≈ estimé", confirmé seulement par POST /orders ou GET /orders/{id}/summary.

// Same enriched product object as GET /catalog/products (§4.1) — the two
// endpoints share the same back-end formatting code, so they can't diverge.
// `price_list` is always null here (this endpoint is never partner-scoped).
export interface CatalogSyncProduct {
    id: number;
    code: string;
    name: string;
    short_description: string | null;
    barcode: string | null;
    brand: ProductBrand | null;
    product_page_code: string | null;
    unit_id: number;
    unit_name: string;
    price: number;
    price_source: 'generic';
    price_list: null;
    tax_rate: number;
    stock_available: number;
    marketing: ProductMarketing;
    flags: ProductFlags;
    packagings: CatalogProductPackaging[];
    updated_at: string;
}

export interface CatalogSyncResponse extends ApiSuccessResponse {
    synced_at: string;
    products: CatalogSyncProduct[];
}

export interface PartnerPriceOverride {
    product_id: number;
    fixed_price: number | null;
    discount_rate: number | null;
    discount_amount: number | null;
    priority: number;
    valid_from: string;
    valid_to: string;
}

export interface PartnerSyncRecord {
    id: number;
    code: string;
    name: string;
    phone: string | null;
    status: string;
    credit_limit: number;
    current_balance: number;
    available_credit: number;
    payment_term_id: number | null;
    price_list_id: number | null;
    price_overrides: PartnerPriceOverride[];
    updated_at: string;
}

export interface PartnerSyncResponse extends ApiSuccessResponse {
    synced_at: string;
    partners: PartnerSyncRecord[];
}

export interface PriceTier {
    product_id: number;
    packaging_id: number;
    min_qty: number;
    max_qty: number | null;
    tier_price: number;
}

// ⚠️ "Ligne active" d'une price_list change dans le temps (fenêtre de dates) —
// ne jamais mettre ce résultat en cache long terme, le re-fetcher à chaque
// reprise de connexion (docs §4.4).
export interface CatalogTiersResponse extends ApiSuccessResponse {
    price_list_id: number;
    line_number: number | null;
    tiers: PriceTier[];
}

// §4.4 (correctif 2026-08) — le prix de base réel du partenaire pour la
// grande majorité des lignes de commande ; sans cet endpoint, le calcul
// local retombait à tort sur le prix générique dès qu'aucun override/tier
// n'existait (le cas le plus fréquent). `is_override` est interne à la
// liste de prix — ne pas confondre avec `price_overrides` de /partners/sync.
// Même règle de "ligne active" que /catalog/tiers — ne pas cacher long terme.
export interface PriceListLine {
    product_id: number;
    packaging_id: number;
    is_override: boolean;
    sales_price: number;
    min_sales_price: number | null;
    max_sales_price: number | null;
}

export interface CatalogPriceListResponse extends ApiSuccessResponse {
    price_list_id: number;
    line_number: number | null;
    lines: PriceListLine[];
}

export interface PaymentTermOption {
    id: number;
    code: string;
    name: string;
    days_number: number;
    is_credit: boolean;
    is_cash: boolean;
    discount: string;
}

export interface SalesGroupOption {
    code: string;
    name: string;
}

export interface MasterDataResponse extends ApiSuccessResponse {
    payment_terms: PaymentTermOption[];
    sales_groups: SalesGroupOption[];
}

// ─── §5.0 — Mon portefeuille ──────────────────────────────────────────────────

export interface PortfolioPartner {
    id: number;
    code: string;
    name: string;
    credit_available: number;
    assigned_at: string;
}

export interface PortfolioResponse extends ApiSuccessResponse {
    partners: PortfolioPartner[];
    pagination?: { current_page: number; total_pages: number; total: number; per_page: number };
}

// ─── §5 — Partenaires / Commandes ─────────────────────────────────────────────

export interface TelesalesPartnerSummary {
    id: number;
    code: string;
    name: string;
    phone?: string | null;
    credit_available?: number;
}

export interface PartnerCreditStatus {
    partner_id: number;
    credit_available: number;
    credit_limit: number;
    credit_used: number;
}

export interface TelesalesPromotion {
    id: number;
    code: string;
    name: string;
    [key: string]: unknown;
}

export type OrderStatus = 'draft' | 'submitted' | 'confirmed' | 'pending_derogation' | 'cancelled' | string;

export interface TelesalesOrderItem {
    product_id: number;
    quantity: number;
    price?: number;
}

export interface CreateOrderRequest {
    partner_id: number;
    items: TelesalesOrderItem[];
    notes?: string;
    payment_term_id?: number | null;
    scheduled_for?: string | null;
}

export interface TelesalesOrder {
    id: number;
    bc_number: string;
    status: OrderStatus;
    status_label: string;
    partner: { id: number; code: string; name: string };
    scheduled_for: string | null;
    total_amount: number;
    promotion_discount: number;
    final_total: number;
    items_count: number;
    created_at: string;
}

export interface CreateOrderResponse extends ApiSuccessResponse {
    order: TelesalesOrder;
}

// §5.2-bis — GET /orders/{id}/summary (2026-08 addition). Read-only: reflects
// exactly what the pricing/promotions engine already computed and persisted at
// order creation — never recomputed on read, so it always matches what will
// actually be billed. Meant as the "relecture" step right before /submit.
export interface OrderSummaryPromotion {
    applied: boolean;
    codes: string[];
    labels: string[];
    discount_amount: number;
    unit_price_ttc_after_discount: number;
}

export interface OrderSummaryItem {
    product_id: number;
    product_code: string;
    product_name: string;
    quantity: number;
    unit_price_ht: number;
    unit_price_ttc: number;
    tax_rate: number;
    promotion: OrderSummaryPromotion;
    tva_amount: number;
    line_total_ht: number;
    line_total_ttc: number;
}

export interface OrderSummaryTotals {
    sub_total_ht: number;
    tva_amount: number;
    original_total_ttc: number;
    promotion_discount: number;
    final_total_ttc: number;
    payable_amount: number;
}

export interface OrderSummaryResponse extends ApiSuccessResponse {
    order_id: number;
    bc_number: string;
    status: OrderStatus;
    partner: { id: number; code: string; name: string };
    items: OrderSummaryItem[];
    totals: OrderSummaryTotals;
}

// §5.3 — the 422 credit-exceeded response is a normal business state, not an error to swallow.
export interface CreditValidation {
    can_proceed: boolean;
    credit_available: number;
    order_amount: number;
    credit_after_order: number;
    warnings: { type: string; severity: string; message: string; excess_amount: number }[];
    requires_derogation: boolean;
}

export interface SubmitOrderCreditExceededResponse {
    success: false;
    message: string;
    credit_validation: CreditValidation;
    next_step: string;
}

export interface SubmitOrderResponse extends ApiSuccessResponse {
    order?: TelesalesOrder;
}

export interface RequestDerogationRequest {
    justification: string;
}

export interface RequestDerogationResponse extends ApiSuccessResponse {
    order: TelesalesOrder & { status: string };
    output: { derogation_id: number; excess_amount: number; status: string };
}

export interface RequestDerogationErrorResponse {
    success: false;
    message: string;
    decision?: { constraints: { reason: string }[] };
}

export interface ScheduledOrdersResponse extends ApiSuccessResponse {
    date: string;
    orders: TelesalesOrder[];
}

export interface OrdersListResponse extends ApiSuccessResponse {
    orders: TelesalesOrder[];
    pagination?: { current_page: number; total_pages: number; total: number; per_page: number };
}

export interface OrderDetailResponse extends ApiSuccessResponse {
    order: TelesalesOrder;
}

// ─── §6 — Devis B2B ────────────────────────────────────────────────────────────

export type DevisStatus = 'draft' | 'sent' | 'converted' | 'expired';

export interface DevisItem {
    id: number;
    product_id: number;
    quantity: string;
    price: string;
    line_total_ttc: string;
    product?: { id: number; name: string; code: string };
}

export interface Devis {
    id: number;
    quote_number: string;
    user_id: number;
    partner_id: number;
    status: DevisStatus;
    sub_total: string;
    tax_amount: string;
    total_amount: string;
    notes: string | null;
    expires_at: string | null;
    converted_order_id: number | null;
    items: DevisItem[];
    partner?: { id: number; code: string; name: string };
}

export interface DevisListResponse extends ApiSuccessResponse {
    devis: Devis[];
}

export interface DevisDetailResponse extends ApiSuccessResponse {
    devis: Devis;
}

export interface CreateDevisRequest {
    partner_id: number;
    items: TelesalesOrderItem[];
    notes?: string;
    expires_at?: string;
}

export interface UpdateDevisRequest {
    items: TelesalesOrderItem[];
}

export interface SendDevisResponse extends ApiSuccessResponse {
    quote: Devis;
    email: { sent: boolean; reason: string | null };
}

export interface ConvertDevisResponse extends ApiSuccessResponse {
    order_id: number;
    bc_number: string;
    quote: Devis;
}

// ─── §5.7 — Retours clients ────────────────────────────────────────────────────

export type ReturnCondition = 'good' | 'damaged' | 'expired';
export type ReturnReason = 'DAMAGED' | 'PRICING_ERROR' | 'COMMERCIAL_RETURN' | 'EXPIRED' | 'QUALITY_ISSUE';

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
    DAMAGED: 'Endommagé',
    PRICING_ERROR: 'Erreur de tarification',
    COMMERCIAL_RETURN: 'Retour commercial',
    EXPIRED: 'Périmé',
    QUALITY_ISSUE: 'Problème qualité',
};

export interface ReturnItemPayload {
    product_id: number;
    return_quantity: number;
    condition: ReturnCondition;
    reason: ReturnReason;
    unit_price: number;
}

export interface CreateReturnRequest {
    partner_id: number;
    delivery_note_id?: number | null;
    notes?: string;
    items: ReturnItemPayload[];
}

export interface PartnerReturnSummary {
    id: number;
    return_number: string;
    status: string;
    return_type: string;
    partner?: { id: number; code: string; name: string };
    created_at?: string;
}

export interface CreateReturnResponse extends ApiSuccessResponse {
    return: PartnerReturnSummary;
}

export interface ReturnsListResponse extends ApiSuccessResponse {
    returns: PartnerReturnSummary[];
}

export interface ReturnDetailResponse extends ApiSuccessResponse {
    return: PartnerReturnSummary & { items?: (ReturnItemPayload & { id: number })[] };
}
