// ─── Routing / Sectorisation / Tournées ─────────────────────────────────────
// Type definitions for /api/backend/geo-areas, /api/backend/itinerary-types
// and /api/backend/itineraries.
// See docs/modules/ROUTING_INTEGRATION.md

// ─── Geo Area ───────────────────────────────────────────────────────────────

export interface GeoAreaType {
    id: number;
    code: string;
    name: string;
    name_ar: string | null;
    rank: number;
    is_active: boolean;
}

export interface GeoArea {
    id: number;
    code: string;
    name: string;
    name_ar: string | null;
    geo_area_type_id: number;
    parent_code: string | null;
    // API returns decimals as strings (e.g. "33.573100") — parse before numeric ops
    latitude: string | number | null;
    longitude: string | number | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    geo_area_type?: GeoAreaType;
    parent?: Pick<GeoArea, 'id' | 'code' | 'name'>;
    children?: GeoArea[];
}

export interface GeoAreaUser {
    id: number;
    name: string;
    email: string;
    assigned_at: string;
}

export interface CreateGeoAreaPayload {
    code: string;
    name: string;
    name_ar?: string | null;
    geo_area_type_id: number;
    parent_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    description?: string | null;
    is_active?: boolean;
    sort_order?: number;
}

export type UpdateGeoAreaPayload = Partial<CreateGeoAreaPayload>;

export interface GeoAreaToggleResponse {
    success: boolean;
    is_active: boolean;
}

export interface GeoAreaUsersResponse {
    geo_area: Pick<GeoArea, 'id' | 'code' | 'name'>;
    users: GeoAreaUser[];
}

export interface AssignGeoAreaUserResponse {
    message: string;
    user: GeoAreaUser;
}

export interface GeoAreaListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface GeoAreaListLinks {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
}

export interface GeoAreaListResponse {
    geoAreas: {
        data: GeoArea[];
    } & GeoAreaListMeta;
    geoAreaTypes: GeoAreaType[];
    parentAreas: Array<Pick<GeoArea, 'id' | 'code' | 'name'>>;
}

export interface GeoAreaDetailResponse {
    data: GeoArea;
}

export interface GeoAreaFilters {
    type_id?: number;
    parent_code?: string;
    search?: string;
    page?: number;
    per_page?: number;
}

// ─── Itinerary Type ─────────────────────────────────────────────────────────

export interface ItineraryType {
    id: number;
    code: string;
    name: string;
    name_ar: string | null;
    description: string | null;
    business_nature_id: number | null;
    is_active: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface CreateItineraryTypePayload {
    code: string;
    name: string;
    name_ar?: string | null;
    description?: string | null;
    business_nature_id?: number | null;
    is_active?: boolean;
}

export type UpdateItineraryTypePayload = Partial<CreateItineraryTypePayload>;

export interface ItineraryTypeListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface ItineraryTypeListResponse {
    data: {
        data: ItineraryType[];
    } & ItineraryTypeListMeta;
}

export interface ItineraryTypeDetailResponse {
    data: ItineraryType;
}

export interface ItineraryTypeFilters {
    search?: string;
    is_active?: boolean;
    page?: number;
    per_page?: number;
}

export interface ItineraryTypeDeleteResponse {
    message: string;
}

// ─── Itinerary Business Nature ──────────────────────────────────────────────
// Playbooks de visite — quasi-static config (see docs/modules/ROUTING_INTEGRATION.md §4).
// action_rules is complex business JSON: displayed read-only, edited as raw
// JSON by super_admin only.

export interface BusinessNatureAction {
    visit_action_code: string;
    required?: boolean;
    gates_any?: string[][];
    [key: string]: unknown;
}

export interface BusinessNatureActionRules {
    actions?: BusinessNatureAction[];
    [key: string]: unknown;
}

export interface ItineraryBusinessNature {
    id: number;
    code: string;
    label: string;
    name?: string | null;
    description?: string | null;
    action_rules: BusinessNatureActionRules | null;
    is_active?: boolean;
    itinerary_types_count?: number;
    created_at?: string;
    updated_at?: string;
}

export interface CreateBusinessNaturePayload {
    code: string;
    label: string;
    description?: string | null;
    action_rules?: BusinessNatureActionRules | null;
    is_active?: boolean;
}

export type UpdateBusinessNaturePayload = Partial<CreateBusinessNaturePayload>;

// ─── Itinerary ──────────────────────────────────────────────────────────────

export interface Itinerary {
    id: number;
    code: string;
    name: string;
    name_ar: string | null;
    itinerary_type_id: number;
    itinerary_type?: ItineraryType;
    branch_id: number | null;
    branch?: { id: number; code: string; name: string };
    geo_area_id: number | null;
    geo_area?: Pick<GeoArea, 'id' | 'code' | 'name'>;
    rider_id: number | null;
    rider?: { id: number; name: string };
    is_active: boolean;
    start_date: string | null;
    end_date: string | null;
    sort_order: number;
    itinerary_partners?: ItineraryPartner[];
    itinerary_users?: ItineraryUser[];
}

export interface ItineraryPartner {
    id: number;
    itinerary_id: number;
    line_number: number;
    partner_code: string;
    rank: number;
    is_stop_point: boolean;
    visit_date: string | null;
    start_time: string | null;
    end_time: string | null;
    mileage: number | null;
    visit_frequency_days: number;
    notes: string | null;
    is_active: boolean;
    // geo_lat / geo_lng come back as decimal strings from the API (e.g. "33.614503")
    partner?: {
        code: string;
        name: string;
        name_ar?: string | null;
        geo_lat?: string | number | null;
        geo_lng?: string | number | null;
        phone?: string | null;
        whatsapp?: string | null;
        email?: string | null;
        address_line1?: string | null;
        address_line2?: string | null;
        city?: string | null;
        channel?: string | null;
        partner_type?: string | null;
        status?: string | null;
        credit_limit?: string | number | null;
        credit_used?: string | number | null;
        currency?: string | null;
        total_orders_count?: number | null;
        total_orders_value?: string | number | null;
        last_order_date?: string | null;
    };
}

export interface SyncPartnerEntry {
    partner_code: string;
    rank?: number;
    is_stop_point?: boolean;
    start_time?: string | null;
    end_time?: string | null;
    mileage?: number | null;
    visit_frequency_days?: number;
    notes?: string | null;
}

export interface ItineraryUser {
    id: number;
    user_id: number;
    name: string;
    email: string;
    is_active: boolean;
    display_order: number;
}

export interface CreateItineraryPayload {
    code: string;
    name: string;
    name_ar?: string | null;
    itinerary_type_id: number;
    branch_id?: number | null;
    geo_area_id?: number | null;
    rider_id?: number | null;
    is_active?: boolean;
    start_date?: string | null;
    end_date?: string | null;
    sort_order?: number;
}

export type UpdateItineraryPayload = Partial<CreateItineraryPayload>;

export interface ItineraryListMeta {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
}

export interface ItineraryListResponse {
    itineraries: {
        data: Itinerary[];
    } & ItineraryListMeta;
    branches: Array<{ id: number; code: string; name: string }>;
    geoAreas: Array<Pick<GeoArea, 'id' | 'code' | 'name'>>;
    riders: Array<{ id: number; name: string }>;
}

export interface ItineraryDetailResponse {
    itinerary: Itinerary;
    availablePartners: Array<{ code: string; name: string }>;
    availableUsers: Array<{ id: number; name: string; email: string }>;
}

export interface ItineraryFilters {
    branch_id?: number;
    rider_id?: number;
    geo_area_id?: number;
    itinerary_type_id?: number;
    is_active?: boolean;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface SyncPartnersPayload {
    partners: SyncPartnerEntry[];
}

export interface SyncPartnersResponse {
    success: boolean;
    message: string;
    partners: ItineraryPartner[];
}

export interface SyncItineraryUsersPayload {
    user_ids: number[];
}

export interface SyncItineraryUsersResponse {
    success: boolean;
    message: string;
    users: ItineraryUser[];
}

export interface AssignPartnerPayload {
    partner_code: string;
    rank?: number;
    visit_frequency_days?: number;
}

export interface AssignUserPayload {
    user_id: number;
    is_active?: boolean;
    display_order?: number;
}

export interface ItineraryMessageResponse {
    message: string;
}

// ─── ItineraryLocalite ──────────────────────────────────────────────────────

export interface SyncLocaliteEntry {
    id: number;
    sort_order?: number;
}

export interface SyncLocalitesPayload {
    localites: SyncLocaliteEntry[];
}

export interface SyncLocalitesResponse {
    success: boolean;
    message: string;
    localites: Array<{ id: number; code: string; name: string }>;
}

// ─── ItineraryUser pivot ────────────────────────────────────────────────────

export interface ItineraryUserEntry {
    user_id: number;
    is_active?: boolean;
    display_order?: number;
}

export interface SyncItineraryUsersRichPayload {
    users: ItineraryUserEntry[];
}

// ─── Itinerary Master Data (GET /api/backend/masterdata/itineraries) ─────────

export interface ItineraryMasterDataResponse {
    branches: Array<{ id: number; code: string; name: string }>;
    geo_areas: Array<{ id: number; code: string; name: string }>;
    riders: Array<{ id: number; name: string; email?: string }>;
    itinerary_types: Array<{ id: number; code: string; name: string }>;
}

// ─── Partner → Itinerary lookup (GET /api/backend/partners/{id}/itinerary) ──

export interface PartnerItineraryResponse {
    itinerary: Itinerary | null;
    message?: string;
}

// ─── SDUI / Mobile screen responses (GET /api/screens/itineraries[/{id}/partners]) ──
// The screens API returns server-driven UI component trees for the SFA mobile app.
// Shape is opaque from the dashboard perspective — typed as a passthrough.

export interface SduiComponent {
    type: string;
    [key: string]: unknown;
}

export interface ScreenItinerariesResponse {
    components?: SduiComponent[];
    [key: string]: unknown;
}

export interface ScreenItineraryPartnersResponse {
    components?: SduiComponent[];
    [key: string]: unknown;
}

// ─── Planning users (GET /itinerary-planning/users) ─────────────────────────

export interface PlanningUser {
    id: number;
    name: string;
    email: string;
    branch_code: string | null;
    geo_area_code: string | null;
    b2b_role: 'salesRep' | 'livreur' | string;
}

export interface PlanningUsersResponse {
    users: PlanningUser[];
}

export interface PlanningUsersFilters {
    branch_code?: string;
    search?: string;
}

// ─── Planning summary (GET /itinerary-planning/summary?user_id=X) ────────────

export interface PlanningSummaryItinerary {
    planning_id: number;
    id: number;
    code: string;
    name: string;
    geo_area_code: string | null;
    partners_count: number;
    estimated_km: number;
}

export interface PlanningSummaryDay {
    day_code: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    label: string;
    itineraries: PlanningSummaryItinerary[];
    total_partners: number;
    total_km: number;
}

export interface PlanningSummaryResponse {
    user_id: number;
    user: {
        id: number;
        name: string;
        email: string;
        branch_code: string | null;
        b2b_role: string;
    };
    week: PlanningSummaryDay[];
}

// ─── Update planning day (PUT /itinerary-planning/{id}) ─────────────────────

export interface UpdatePlanningDayPayload {
    day_code: number;
}

export interface UpdatePlanningDayResponse {
    success: boolean;
    message: string;
    planning: {
        id: number;
        user_id: number;
        itinerary_id: number;
        day_code: number;
        is_active: boolean;
        user: { id: number; name: string };
        itinerary: { id: number; code: string; name: string };
    };
}

// ─── Planning hebdomadaire ──────────────────────────────────────────────────

export interface ItineraryPlanning {
    id: number;
    user_id: number;
    itinerary_id: number;
    day_code: 1 | 2 | 3 | 4 | 5 | 6 | 7;
    is_active: boolean;
    user?: { id: number; name: string; email: string };
    itinerary?: { id: number; code: string; name: string };
}

export interface AssignDaysPayload {
    user_id: number;
    itinerary_id: number;
    day_codes: number[];
    is_active?: boolean;
}

export interface AssignDaysResponse {
    success: boolean;
    planning: ItineraryPlanning[];
}

export interface PlanningFilters {
    user_id?: number;
    itinerary_id?: number;
    day_code?: number;
    is_active?: boolean;
}

export interface PlanningListResponse {
    data: ItineraryPlanning[];
}

// ─── Planning journalier (overrides) ────────────────────────────────────────

export type PlanningDailyStrategyMode = 'REPLACE' | 'APPEND';

export interface ItineraryPlanningDaily {
    id: number;
    user_id: number;
    itinerary_id: number;
    work_date: string;
    is_active: boolean;
    strategy_mode: PlanningDailyStrategyMode;
    user?: { id: number; name: string; email: string };
    itinerary?: { id: number; code: string; name: string };
}

export interface UpsertForDateEntry {
    itinerary_id: number;
    is_active?: boolean;
    strategy_mode?: PlanningDailyStrategyMode;
}

export interface UpsertForDatePayload {
    user_id: number;
    work_date: string;
    entries: UpsertForDateEntry[];
}

export interface UpsertForDateResponse {
    message: string;
    data: ItineraryPlanningDaily[];
}

export interface PlanningDailyFilters {
    user_id?: number;
    itinerary_id?: number;
    work_date?: string;
    from?: string;
    to?: string;
    is_active?: boolean;
}

export interface PlanningDailyListResponse {
    data: ItineraryPlanningDaily[];
}

// ─── Geo Routing PostGIS ────────────────────────────────────────────────────

export interface GeoAreaFeatureProperties {
    code: string;
    name: string;
    name_ar: string | null;
    type_id: number;
    parent_code: string | null;
    description: string | null;
    is_active: boolean;
    sort_order: number;
}

export interface GeoAreaFeature {
    type: 'Feature';
    id: number;
    geometry: object | null;
    properties: GeoAreaFeatureProperties;
}

export interface GeoAreaFeatureCollection {
    type: 'FeatureCollection';
    features: GeoAreaFeature[];
}

export interface GeoAreaBounds {
    id: number;
    code: string;
    name: string;
    has_geometry: boolean;
    center: { lat: number; lng: number } | null;
    bbox: { min_lat: number; min_lng: number; max_lat: number; max_lng: number } | null;
}

export interface MapLayersParams {
    type_ids?: number[];
    parent_code?: string;
    active_only?: boolean;
    bbox?: string;
}

export interface BulkAssignPartnersPayload {
    itinerary_id: number;
    partner_codes: string[];
    options?: {
        replace_existing?: boolean;
        default_visit_frequency_days?: number;
        default_start_time?: string | null;
        default_end_time?: string | null;
    };
}

export interface BulkAssignPartnersResult {
    success: true;
    added: number;
    already_present: number;
    total_in_itinerary: number;
    partners: ItineraryPartner[];
}

// ─── Partner GPS location (PATCH /partners/{code}/gps-location) ─────────────
// The PostGIS trigger fn_assign_partner_geo_area re-assigns geo_area_code
// automatically when the new point falls into another sector.

export interface UpdatePartnerGpsResponse {
    success: boolean;
    message: string;
    partner_code: string;
    geo_lat: number;
    geo_lng: number;
    geo_area_code: string | null;
}

// ─── GeoArea Statistics ─────────────────────────────────────────────────────

export interface GeoAreaStatistics {
    total_areas: number;
    active_areas: number;
    with_coordinates: number;
    top_level: number;
    by_type: Array<{ id: number; code: string; name: string; geo_areas_count: number }>;
}
