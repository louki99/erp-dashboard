import apiClient from './client';
import type {
    AssignDaysPayload,
    AssignDaysResponse,
    AssignGeoAreaUserResponse,
    AssignPartnerPayload,
    AssignUserPayload,
    BulkAssignPartnersPayload,
    BulkAssignPartnersResult,
    CreateBusinessNaturePayload,
    CreateGeoAreaPayload,
    CreateItineraryPayload,
    CreateItineraryTypePayload,
    GeoArea,
    GeoAreaBounds,
    GeoAreaDetailResponse,
    GeoAreaFeatureCollection,
    GeoAreaFilters,
    GeoAreaListResponse,
    GeoAreaStatistics,
    GeoAreaToggleResponse,
    GeoAreaUsersResponse,
    Itinerary,
    ItineraryBusinessNature,
    ItineraryDetailResponse,
    ItineraryFilters,
    ItineraryListResponse,
    ItineraryMessageResponse,
    ItineraryPartner,
    ItineraryPlanning,
    ItineraryPlanningDaily,
    ItineraryType,
    ItineraryTypeDeleteResponse,
    ItineraryTypeDetailResponse,
    ItineraryTypeFilters,
    ItineraryTypeListResponse,
    MapLayersParams,
    PlanningDailyFilters,
    PlanningDailyListResponse,
    PlanningFilters,
    PlanningListResponse,
    PlanningUsersFilters,
    PlanningUsersResponse,
    PlanningSummaryResponse,
    UpdatePlanningDayPayload,
    UpdatePlanningDayResponse,
    SyncItineraryUsersPayload,
    SyncItineraryUsersResponse,
    SyncLocalitesPayload,
    SyncLocalitesResponse,
    SyncPartnersPayload,
    SyncPartnersResponse,
    UpdateBusinessNaturePayload,
    UpdateGeoAreaPayload,
    UpdateItineraryPayload,
    UpdateItineraryTypePayload,
    UpdatePartnerGpsResponse,
    UpsertForDatePayload,
    UpsertForDateResponse,
} from '@/types/routing.types';

const GEO_AREAS_BASE = '/api/backend/geo-areas';
const ITINERARY_TYPES_BASE = '/api/backend/itinerary-types';
const ITINERARIES_BASE = '/api/backend/itineraries';

// ─── Geo Areas ──────────────────────────────────────────────────────────────

export const getGeoAreas = async (filters: GeoAreaFilters = {}): Promise<GeoAreaListResponse> => {
    const response = await apiClient.get<GeoAreaListResponse>(GEO_AREAS_BASE, { params: filters });
    return response.data;
};

export const getGeoArea = async (id: number): Promise<GeoArea> => {
    const response = await apiClient.get<GeoAreaDetailResponse>(`${GEO_AREAS_BASE}/${id}`);
    return response.data.data;
};

export const createGeoArea = async (payload: CreateGeoAreaPayload): Promise<GeoArea> => {
    const response = await apiClient.post<GeoAreaDetailResponse>(GEO_AREAS_BASE, payload);
    return response.data.data;
};

export const updateGeoArea = async (id: number, payload: UpdateGeoAreaPayload): Promise<GeoArea> => {
    const response = await apiClient.put<GeoAreaDetailResponse>(`${GEO_AREAS_BASE}/${id}`, payload);
    return response.data.data;
};

export const deleteGeoArea = async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`${GEO_AREAS_BASE}/${id}`);
    return response.data;
};

export const toggleGeoArea = async (id: number): Promise<GeoAreaToggleResponse> => {
    const response = await apiClient.get<GeoAreaToggleResponse>(`${GEO_AREAS_BASE}/${id}/toggle`);
    return response.data;
};

export const getGeoHierarchy = async (): Promise<GeoArea[]> => {
    const response = await apiClient.get<GeoArea[]>(`${GEO_AREAS_BASE}/hierarchy`);
    return response.data;
};

export const getGeoAreaChildren = async (parentCode: string): Promise<GeoArea[]> => {
    const response = await apiClient.get<GeoArea[]>(`${GEO_AREAS_BASE}/${parentCode}/children`);
    return response.data;
};

export const getGeoAreaUsers = async (id: number): Promise<GeoAreaUsersResponse> => {
    const response = await apiClient.get<GeoAreaUsersResponse>(`${GEO_AREAS_BASE}/${id}/users`);
    return response.data;
};

export const assignGeoAreaUser = async (id: number, userId: number): Promise<AssignGeoAreaUserResponse> => {
    const response = await apiClient.post<AssignGeoAreaUserResponse>(`${GEO_AREAS_BASE}/${id}/assign-user`, { user_id: userId });
    return response.data;
};

export const removeGeoAreaUser = async (id: number, userId: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`${GEO_AREAS_BASE}/${id}/users/${userId}`);
    return response.data;
};

// ─── Itinerary Types ────────────────────────────────────────────────────────

export const getItineraryTypes = async (filters: ItineraryTypeFilters = {}): Promise<ItineraryTypeListResponse> => {
    const response = await apiClient.get<ItineraryTypeListResponse>(ITINERARY_TYPES_BASE, { params: filters });
    return response.data;
};

export const getItineraryType = async (id: number): Promise<ItineraryType> => {
    const response = await apiClient.get<ItineraryTypeDetailResponse>(`${ITINERARY_TYPES_BASE}/${id}`);
    return response.data.data;
};

export const createItineraryType = async (payload: CreateItineraryTypePayload): Promise<ItineraryType> => {
    const response = await apiClient.post<ItineraryTypeDetailResponse>(ITINERARY_TYPES_BASE, payload);
    return response.data.data;
};

export const updateItineraryType = async (id: number, payload: UpdateItineraryTypePayload): Promise<ItineraryType> => {
    const response = await apiClient.put<ItineraryTypeDetailResponse>(`${ITINERARY_TYPES_BASE}/${id}`, payload);
    return response.data.data;
};

export const deleteItineraryType = async (id: number): Promise<ItineraryTypeDeleteResponse> => {
    const response = await apiClient.delete<ItineraryTypeDeleteResponse>(`${ITINERARY_TYPES_BASE}/${id}`);
    return response.data;
};

// ─── Itinerary Business Natures ─────────────────────────────────────────────
// Response shape not yet documented in docs/api — unwrap both `{data: [...]}`
// and bare-array forms defensively (schema confirmation requested to backend).

const BUSINESS_NATURES_BASE = '/api/backend/itinerary-business-natures';

function unwrapData<T>(raw: unknown): T {
    if (raw && typeof raw === 'object' && 'data' in raw) {
        return (raw as { data: T }).data;
    }
    return raw as T;
}

export const getBusinessNatures = async (): Promise<ItineraryBusinessNature[]> => {
    const response = await apiClient.get(BUSINESS_NATURES_BASE);
    const list = unwrapData<ItineraryBusinessNature[] | { data: ItineraryBusinessNature[] }>(response.data);
    return Array.isArray(list) ? list : unwrapData<ItineraryBusinessNature[]>(list);
};

export const getBusinessNature = async (id: number): Promise<ItineraryBusinessNature> => {
    const response = await apiClient.get(`${BUSINESS_NATURES_BASE}/${id}`);
    return unwrapData<ItineraryBusinessNature>(response.data);
};

export const createBusinessNature = async (payload: CreateBusinessNaturePayload): Promise<ItineraryBusinessNature> => {
    const response = await apiClient.post(BUSINESS_NATURES_BASE, payload);
    return unwrapData<ItineraryBusinessNature>(response.data);
};

export const updateBusinessNature = async (id: number, payload: UpdateBusinessNaturePayload): Promise<ItineraryBusinessNature> => {
    const response = await apiClient.put(`${BUSINESS_NATURES_BASE}/${id}`, payload);
    return unwrapData<ItineraryBusinessNature>(response.data);
};

export const deleteBusinessNature = async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`${BUSINESS_NATURES_BASE}/${id}`);
    return response.data;
};

// ─── Itineraries ────────────────────────────────────────────────────────────

export const getItineraries = async (filters: ItineraryFilters = {}): Promise<ItineraryListResponse> => {
    const response = await apiClient.get<ItineraryListResponse>(ITINERARIES_BASE, { params: filters });
    return response.data;
};

export const getItinerary = async (id: number): Promise<ItineraryDetailResponse> => {
    const response = await apiClient.get<ItineraryDetailResponse>(`${ITINERARIES_BASE}/${id}`);
    return response.data;
};

export const createItinerary = async (payload: CreateItineraryPayload): Promise<Itinerary> => {
    const response = await apiClient.post<{ data: Itinerary }>(ITINERARIES_BASE, payload);
    return response.data.data;
};

export const updateItinerary = async (id: number, payload: UpdateItineraryPayload): Promise<Itinerary> => {
    const response = await apiClient.put<{ data: Itinerary }>(`${ITINERARIES_BASE}/${id}`, payload);
    return response.data.data;
};

export const deleteItinerary = async (id: number): Promise<{ message: string }> => {
    const response = await apiClient.delete<{ message: string }>(`${ITINERARIES_BASE}/${id}`);
    return response.data;
};

export const syncItineraryPartners = async (id: number, payload: SyncPartnersPayload): Promise<SyncPartnersResponse> => {
    const response = await apiClient.post<SyncPartnersResponse>(`${ITINERARIES_BASE}/${id}/sync-partners`, payload);
    return response.data;
};

export const assignItineraryPartner = async (id: number, payload: AssignPartnerPayload): Promise<ItineraryPartner> => {
    const response = await apiClient.post<{ data: ItineraryPartner }>(`${ITINERARIES_BASE}/${id}/assign-partner`, payload);
    return response.data.data;
};

export const removeItineraryPartner = async (id: number, partnerId: number): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.delete<ItineraryMessageResponse>(`${ITINERARIES_BASE}/${id}/partner/${partnerId}`);
    return response.data;
};

export const syncItineraryUsers = async (id: number, payload: SyncItineraryUsersPayload): Promise<SyncItineraryUsersResponse> => {
    const response = await apiClient.post<SyncItineraryUsersResponse>(`${ITINERARIES_BASE}/${id}/sync-users`, payload);
    return response.data;
};

export const assignItineraryUser = async (id: number, payload: AssignUserPayload): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.post<ItineraryMessageResponse>(`${ITINERARIES_BASE}/${id}/assign-user`, payload);
    return response.data;
};

export const removeItineraryUser = async (id: number, userId: number): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.delete<ItineraryMessageResponse>(`${ITINERARIES_BASE}/${id}/users/${userId}`);
    return response.data;
};

export const syncItineraryLocalites = async (id: number, payload: SyncLocalitesPayload): Promise<SyncLocalitesResponse> => {
    const response = await apiClient.post<SyncLocalitesResponse>(`${ITINERARIES_BASE}/${id}/sync-localites`, payload);
    return response.data;
};

// ─── Geo Area Statistics ────────────────────────────────────────────────────

export const getGeoAreaStatistics = async (): Promise<GeoAreaStatistics> => {
    const response = await apiClient.get<GeoAreaStatistics>(`${GEO_AREAS_BASE}/statistics`);
    return response.data;
};

// ─── Planning hebdomadaire ──────────────────────────────────────────────────

const PLANNING_BASE = '/api/backend/itinerary-planning';

export const getItineraryPlanning = async (filters: PlanningFilters = {}): Promise<PlanningListResponse> => {
    const response = await apiClient.get(PLANNING_BASE, { params: filters });
    // Response shape varies (bare array / {data:[...]} / paginated {data:{data:[...]}})
    const raw = response.data;
    const list: ItineraryPlanning[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
        ? raw.data.data
        : [];
    return { data: list };
};

export const getItineraryPlanningById = async (id: number): Promise<ItineraryPlanning> => {
    const response = await apiClient.get<{ data: ItineraryPlanning }>(`${PLANNING_BASE}/${id}`);
    return response.data.data;
};

export const createItineraryPlanning = async (payload: Omit<ItineraryPlanning, 'id' | 'user' | 'itinerary'>): Promise<ItineraryPlanning> => {
    const response = await apiClient.post<{ data: ItineraryPlanning }>(PLANNING_BASE, payload);
    return response.data.data;
};

export const updateItineraryPlanning = async (id: number, payload: Partial<ItineraryPlanning>): Promise<ItineraryPlanning> => {
    const response = await apiClient.put<{ data: ItineraryPlanning }>(`${PLANNING_BASE}/${id}`, payload);
    return response.data.data;
};

export const deleteItineraryPlanning = async (id: number): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.delete<ItineraryMessageResponse>(`${PLANNING_BASE}/${id}`);
    return response.data;
};

export const assignDays = async (payload: AssignDaysPayload): Promise<AssignDaysResponse> => {
    const response = await apiClient.post<AssignDaysResponse>(`${PLANNING_BASE}/assign-days`, payload);
    return response.data;
};

export const unassignDay = async (userId: number, dayCode: number): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.delete<ItineraryMessageResponse>(`${PLANNING_BASE}/users/${userId}/days/${dayCode}`);
    return response.data;
};

export const getPlanningUsers = async (filters: PlanningUsersFilters = {}): Promise<PlanningUsersResponse> => {
    const response = await apiClient.get<PlanningUsersResponse>(`${PLANNING_BASE}/users`, { params: filters });
    return response.data;
};

export const getPlanningSummary = async (userId: number): Promise<PlanningSummaryResponse> => {
    const response = await apiClient.get<PlanningSummaryResponse>(`${PLANNING_BASE}/summary`, {
        params: { user_id: userId },
    });
    return response.data;
};

export const updatePlanningDay = async (
    id: number,
    payload: UpdatePlanningDayPayload
): Promise<UpdatePlanningDayResponse> => {
    const response = await apiClient.put<UpdatePlanningDayResponse>(`${PLANNING_BASE}/${id}`, payload);
    return response.data;
};

// ─── Planning journalier (overrides) ────────────────────────────────────────

const PLANNING_DAILY_BASE = '/api/backend/itinerary-planning-daily';

export const getPlanningDaily = async (filters: PlanningDailyFilters = {}): Promise<PlanningDailyListResponse> => {
    const response = await apiClient.get(PLANNING_DAILY_BASE, { params: filters });
    // Response shape varies (bare array / {data:[...]} / paginated {data:{data:[...]}})
    const raw = response.data;
    const list: ItineraryPlanningDaily[] = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : Array.isArray(raw?.data?.data)
        ? raw.data.data
        : [];
    return { data: list };
};

export const getPlanningDailyById = async (id: number): Promise<ItineraryPlanningDaily> => {
    const response = await apiClient.get<{ data: ItineraryPlanningDaily }>(`${PLANNING_DAILY_BASE}/${id}`);
    return response.data.data;
};

export const deletePlanningDaily = async (id: number): Promise<ItineraryMessageResponse> => {
    const response = await apiClient.delete<ItineraryMessageResponse>(`${PLANNING_DAILY_BASE}/${id}`);
    return response.data;
};

export const upsertForDate = async (payload: UpsertForDatePayload): Promise<UpsertForDateResponse> => {
    const response = await apiClient.post<UpsertForDateResponse>(`${PLANNING_DAILY_BASE}/upsert-for-date`, payload);
    return response.data;
};

// ─── Geo Routing PostGIS ────────────────────────────────────────────────────

const GEO_ROUTING_BASE = '/api/backend/geo-routing';

export const getMapLayers = async (params: MapLayersParams = {}): Promise<GeoAreaFeatureCollection> => {
    const p: Record<string, unknown> = { ...params };
    if (params.type_ids && params.type_ids.length > 0) {
        p['type_ids[]'] = params.type_ids;
        delete p.type_ids;
    }
    const response = await apiClient.get<GeoAreaFeatureCollection>(`${GEO_ROUTING_BASE}/map-layers`, { params: p });
    return response.data;
};

export const getGeoRoutingBounds = async (id: number): Promise<GeoAreaBounds> => {
    const response = await apiClient.get<GeoAreaBounds>(`${GEO_ROUTING_BASE}/bounds/${id}`);
    return response.data;
};

export const bulkAssignPartners = async (payload: BulkAssignPartnersPayload): Promise<BulkAssignPartnersResult> => {
    const response = await apiClient.post<BulkAssignPartnersResult>(`${GEO_ROUTING_BASE}/bulk-assign-partners`, payload);
    return response.data;
};

// ─── Partner GPS location update ─────────────────────────────────────────────

const PARTNERS_BASE = '/api/backend/partners';

export const updatePartnerGpsLocation = async (
    partnerCode: string,
    payload: { latitude: number; longitude: number }
): Promise<UpdatePartnerGpsResponse> => {
    const response = await apiClient.patch<UpdatePartnerGpsResponse>(
        `${PARTNERS_BASE}/${partnerCode}/gps-location`,
        payload
    );
    return response.data;
};
