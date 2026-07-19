import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as routingApi from '@/services/api/routingApi';
import type {
    AssignDaysPayload,
    AssignDaysResponse,
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
    GeoAreaFeatureCollection,
    GeoAreaFilters,
    GeoAreaStatistics,
    GeoAreaUser,
    Itinerary,
    ItineraryBusinessNature,
    ItineraryFilters,
    ItineraryListResponse,
    ItineraryMasterDataResponse,
    ItineraryMessageResponse,
    ItineraryPartner,
    ItineraryPlanning,
    ItineraryPlanningDaily,
    ItineraryType,
    ItineraryTypeFilters,
    ItineraryTypeListResponse,
    MapLayersParams,
    PartnerItineraryResponse,
    PlanningDailyFilters,
    PlanningFilters,
    PlanningUser,
    PlanningUsersFilters,
    PlanningUsersResponse,
    PlanningSummaryResponse,
    ScreenItinerariesResponse,
    ScreenItineraryPartnersResponse,
    UpdatePlanningDayPayload,
    UpdatePlanningDayResponse,
    SyncItineraryUsersPayload,
    SyncLocalitesPayload,
    SyncLocalitesResponse,
    SyncPartnersPayload,
    UpdateBusinessNaturePayload,
    UpdateGeoAreaPayload,
    UpdateItineraryPayload,
    UpdateItineraryTypePayload,
    UpdatePartnerGpsResponse,
    UpsertForDatePayload,
    UpsertForDateResponse,
} from '@/types/routing.types';

// ─── Query keys ─────────────────────────────────────────────────────────────

const ROUTING_BASE_KEY = ['routing'] as const;

export const routingKeys = {
    all: ROUTING_BASE_KEY,
    itineraryMasterData: () => [...ROUTING_BASE_KEY, 'itineraries', 'masterdata'] as const,
    geoAreas: () => [...ROUTING_BASE_KEY, 'geo-areas'] as const,
    geoAreaList: (filters: GeoAreaFilters) => [...routingKeys.geoAreas(), 'list', filters] as const,
    geoAreaDetail: (id: number) => [...routingKeys.geoAreas(), 'detail', id] as const,
    geoHierarchy: () => [...routingKeys.geoAreas(), 'hierarchy'] as const,
    geoAreaChildren: (parentCode: string) => [...routingKeys.geoAreas(), 'children', parentCode] as const,
    geoAreaUsers: (id: number) => [...routingKeys.geoAreas(), id, 'users'] as const,

    itineraryTypes: () => [...ROUTING_BASE_KEY, 'itinerary-types'] as const,
    itineraryTypeList: (filters: ItineraryTypeFilters) => [...routingKeys.itineraryTypes(), 'list', filters] as const,
    itineraryTypeDetail: (id: number) => [...routingKeys.itineraryTypes(), 'detail', id] as const,

    itineraries: () => [...ROUTING_BASE_KEY, 'itineraries'] as const,
    itineraryList: (filters: ItineraryFilters) => [...routingKeys.itineraries(), 'list', filters] as const,
    itineraryDetail: (id: number) => [...routingKeys.itineraries(), 'detail', id] as const,
};

// ─── Geo Areas ──────────────────────────────────────────────────────────────

export function useGeoAreas(filters: GeoAreaFilters = {}) {
    return useQuery({
        queryKey: routingKeys.geoAreaList(filters),
        queryFn: () => routingApi.getGeoAreas(filters),
    });
}

export function useGeoArea(id: number | null) {
    return useQuery<GeoArea>({
        queryKey: id ? routingKeys.geoAreaDetail(id) : ['geo-area', 'detail', 'noop'],
        queryFn: () => routingApi.getGeoArea(id as number),
        enabled: !!id,
    });
}

export function useGeoHierarchy() {
    return useQuery<GeoArea[]>({
        queryKey: routingKeys.geoHierarchy(),
        queryFn: () => routingApi.getGeoHierarchy(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useGeoAreaChildren(parentCode: string | null) {
    return useQuery<GeoArea[]>({
        queryKey: parentCode ? routingKeys.geoAreaChildren(parentCode) : ['geo-area', 'children', 'noop'],
        queryFn: () => routingApi.getGeoAreaChildren(parentCode as string),
        enabled: !!parentCode,
    });
}

export function useCreateGeoArea() {
    const queryClient = useQueryClient();
    return useMutation<GeoArea, AxiosError, CreateGeoAreaPayload>({
        mutationFn: (payload) => routingApi.createGeoArea(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreas() });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoHierarchy() });
        },
    });
}

export function useUpdateGeoArea(id: number) {
    const queryClient = useQueryClient();
    return useMutation<GeoArea, AxiosError, UpdateGeoAreaPayload>({
        mutationFn: (payload) => routingApi.updateGeoArea(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreas() });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoHierarchy() });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreaDetail(id) });
        },
    });
}

export function useDeleteGeoArea() {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, number>({
        mutationFn: (id) => routingApi.deleteGeoArea(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreas() });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoHierarchy() });
        },
    });
}

export function useToggleGeoArea() {
    const queryClient = useQueryClient();
    return useMutation<{ success: boolean; is_active: boolean }, AxiosError, number>({
        mutationFn: (id) => routingApi.toggleGeoArea(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreaList({}) });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreaDetail(id) });
            queryClient.invalidateQueries({ queryKey: routingKeys.geoHierarchy() });
        },
    });
}

export function useGeoAreaStatistics() {
    return useQuery<GeoAreaStatistics, AxiosError>({
        queryKey: [...routingKeys.geoAreas(), 'statistics'],
        queryFn: () => routingApi.getGeoAreaStatistics(),
        staleTime: 60 * 1000,
    });
}

export function useGeoAreaUsers(id: number | null) {
    return useQuery({
        queryKey: id ? routingKeys.geoAreaUsers(id) : ['geo-area', 'users', 'noop'],
        queryFn: () => routingApi.getGeoAreaUsers(id as number),
        enabled: !!id,
    });
}

export function useAssignGeoAreaUser(id: number) {
    const queryClient = useQueryClient();
    return useMutation<GeoAreaUser, AxiosError, number>({
        mutationFn: (userId) => routingApi.assignGeoAreaUser(id, userId).then((r) => r.user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreaUsers(id) });
        },
    });
}

export function useRemoveGeoAreaUser(id: number) {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, number>({
        mutationFn: (userId) => routingApi.removeGeoAreaUser(id, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.geoAreaUsers(id) });
        },
    });
}

// ─── Itinerary Types ────────────────────────────────────────────────────────

export function useItineraryTypes(filters: ItineraryTypeFilters = {}) {
    return useQuery<ItineraryTypeListResponse>({
        queryKey: routingKeys.itineraryTypeList(filters),
        queryFn: () => routingApi.getItineraryTypes(filters),
    });
}

export function useItineraryType(id: number | null) {
    return useQuery<ItineraryType>({
        queryKey: id ? routingKeys.itineraryTypeDetail(id) : ['itinerary-type', 'detail', 'noop'],
        queryFn: () => routingApi.getItineraryType(id as number),
        enabled: !!id,
    });
}

export function useCreateItineraryType() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryType, AxiosError, CreateItineraryTypePayload>({
        mutationFn: (payload) => routingApi.createItineraryType(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryTypes() });
        },
    });
}

export function useUpdateItineraryType(id: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryType, AxiosError, UpdateItineraryTypePayload>({
        mutationFn: (payload) => routingApi.updateItineraryType(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryTypes() });
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryTypeDetail(id) });
        },
    });
}

export function useDeleteItineraryType() {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, number>({
        mutationFn: (id) => routingApi.deleteItineraryType(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryTypes() });
        },
    });
}

// ─── Itinerary Master Data ───────────────────────────────────────────────────

export function useItineraryMasterData() {
    return useQuery<ItineraryMasterDataResponse, AxiosError>({
        queryKey: routingKeys.itineraryMasterData(),
        queryFn: () => routingApi.getItineraryMasterData(),
        staleTime: 5 * 60 * 1000,
    });
}

// ─── Itineraries ────────────────────────────────────────────────────────────

export function useItineraries(filters: ItineraryFilters = {}) {
    return useQuery<ItineraryListResponse>({
        queryKey: routingKeys.itineraryList(filters),
        queryFn: () => routingApi.getItineraries(filters),
    });
}

export function useItinerary(id: number | null) {
    return useQuery({
        queryKey: id ? routingKeys.itineraryDetail(id) : ['itinerary', 'detail', 'noop'],
        queryFn: () => routingApi.getItinerary(id as number),
        enabled: !!id,
    });
}

export function useCreateItinerary() {
    const queryClient = useQueryClient();
    return useMutation<Itinerary, AxiosError, CreateItineraryPayload>({
        mutationFn: (payload) => routingApi.createItinerary(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraries() });
        },
    });
}

export function useUpdateItinerary(id: number) {
    const queryClient = useQueryClient();
    return useMutation<Itinerary, AxiosError, UpdateItineraryPayload>({
        mutationFn: (payload) => routingApi.updateItinerary(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraries() });
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(id) });
        },
    });
}

export function useDeleteItinerary() {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, number>({
        mutationFn: (id) => routingApi.deleteItinerary(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraries() });
        },
    });
}

export function useSyncItineraryPartners(id: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryPartner[], AxiosError, SyncPartnersPayload>({
        mutationFn: (payload) => routingApi.syncItineraryPartners(id, payload).then((r) => r.partners),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(id) });
        },
    });
}

export function useSyncItineraryUsers(id: number) {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, SyncItineraryUsersPayload>({
        mutationFn: (payload) => routingApi.syncItineraryUsers(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(id) });
        },
    });
}

export function useSyncItineraryLocalites(id: number) {
    const queryClient = useQueryClient();
    return useMutation<SyncLocalitesResponse, AxiosError, SyncLocalitesPayload>({
        mutationFn: (payload) => routingApi.syncItineraryLocalites(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(id) });
        },
    });
}

export function useAssignItineraryPartner(itineraryId: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryPartner, AxiosError, AssignPartnerPayload>({
        mutationFn: (payload) => routingApi.assignItineraryPartner(itineraryId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(itineraryId) });
        },
    });
}

export function useRemoveItineraryPartner(itineraryId: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, number>({
        mutationFn: (partnerId) => routingApi.removeItineraryPartner(itineraryId, partnerId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(itineraryId) });
        },
    });
}

export function useAssignItineraryUser(itineraryId: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, AssignUserPayload>({
        mutationFn: (payload) => routingApi.assignItineraryUser(itineraryId, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(itineraryId) });
        },
    });
}

export function useRemoveItineraryUser(itineraryId: number) {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, number>({
        mutationFn: (userId) => routingApi.removeItineraryUser(itineraryId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(itineraryId) });
        },
    });
}

// ─── Partner → Itinerary lookup ──────────────────────────────────────────────

export function usePartnerItinerary(partnerId: number | null) {
    return useQuery<PartnerItineraryResponse, AxiosError>({
        queryKey: partnerId
            ? [...routingKeys.itineraries(), 'partner-lookup', partnerId]
            : ['itinerary', 'partner-lookup', 'noop'],
        queryFn: () => routingApi.getPartnerItinerary(partnerId as number),
        enabled: partnerId !== null && partnerId > 0,
    });
}

// ─── SDUI / Mobile screen hooks ───────────────────────────────────────────────

export function useScreenItineraries() {
    return useQuery<ScreenItinerariesResponse, AxiosError>({
        queryKey: [...routingKeys.itineraries(), 'screen', 'list'],
        queryFn: () => routingApi.getScreenItineraries(),
        staleTime: 60 * 1000,
    });
}

export function useScreenItineraryPartners(itineraryId: number | null) {
    return useQuery<ScreenItineraryPartnersResponse, AxiosError>({
        queryKey: itineraryId
            ? [...routingKeys.itineraryDetail(itineraryId), 'screen', 'partners']
            : ['itinerary', 'screen', 'partners', 'noop'],
        queryFn: () => routingApi.getScreenItineraryPartners(itineraryId as number),
        enabled: itineraryId !== null && itineraryId > 0,
        staleTime: 60 * 1000,
    });
}

// ─── Itinerary Business Natures ──────────────────────────────────────────────

const businessNatureKeys = {
    all: [...ROUTING_BASE_KEY, 'business-natures'] as const,
    detail: (id: number) => [...businessNatureKeys.all, 'detail', id] as const,
};

export function useBusinessNatures() {
    return useQuery<ItineraryBusinessNature[], AxiosError>({
        queryKey: businessNatureKeys.all,
        queryFn: () => routingApi.getBusinessNatures(),
        staleTime: 5 * 60 * 1000,
    });
}

export function useBusinessNature(id: number | null) {
    return useQuery<ItineraryBusinessNature, AxiosError>({
        queryKey: id ? businessNatureKeys.detail(id) : ['business-nature', 'detail', 'noop'],
        queryFn: () => routingApi.getBusinessNature(id as number),
        enabled: !!id,
    });
}

export function useCreateBusinessNature() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryBusinessNature, AxiosError, CreateBusinessNaturePayload>({
        mutationFn: (payload) => routingApi.createBusinessNature(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: businessNatureKeys.all });
        },
    });
}

export function useUpdateBusinessNature() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryBusinessNature, AxiosError, { id: number } & UpdateBusinessNaturePayload>({
        mutationFn: ({ id, ...payload }) => routingApi.updateBusinessNature(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: businessNatureKeys.all });
        },
    });
}

export function useDeleteBusinessNature() {
    const queryClient = useQueryClient();
    return useMutation<{ message: string }, AxiosError, number>({
        mutationFn: (id) => routingApi.deleteBusinessNature(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: businessNatureKeys.all });
        },
    });
}

// ─── Planning hebdomadaire ───────────────────────────────────────────────────

const planningKeys = {
    all: [...ROUTING_BASE_KEY, 'planning'] as const,
    list: (filters: PlanningFilters) => [...planningKeys.all, 'list', filters] as const,
    detail: (id: number) => [...planningKeys.all, 'detail', id] as const,
};

export function useItineraryPlanning(filters: PlanningFilters = {}) {
    return useQuery<{ data: ItineraryPlanning[] }, AxiosError>({
        queryKey: planningKeys.list(filters),
        queryFn: () => routingApi.getItineraryPlanning(filters),
    });
}

export function useAssignDays() {
    const queryClient = useQueryClient();
    return useMutation<AssignDaysResponse, AxiosError, AssignDaysPayload>({
        mutationFn: (payload) => routingApi.assignDays(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function useUnassignDay() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, { userId: number; dayCode: number }>({
        mutationFn: ({ userId, dayCode }) => routingApi.unassignDay(userId, dayCode),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function useDeleteItineraryPlanning() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, number>({
        mutationFn: (id) => routingApi.deleteItineraryPlanning(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

export function usePlanningUsers(filters: PlanningUsersFilters = {}) {
    return useQuery<PlanningUsersResponse, AxiosError>({
        queryKey: [...planningKeys.all, 'users', filters] as const,
        queryFn: () => routingApi.getPlanningUsers(filters),
        staleTime: 5 * 60 * 1000,
    });
}

export function usePlanningSummary(userId: number | null) {
    return useQuery<PlanningSummaryResponse, AxiosError>({
        queryKey: [...planningKeys.all, 'summary', userId] as const,
        queryFn: () => routingApi.getPlanningSummary(userId as number),
        enabled: userId !== null && userId > 0,
    });
}

export function useUpdatePlanningDay() {
    const queryClient = useQueryClient();
    return useMutation<UpdatePlanningDayResponse, AxiosError, { id: number } & UpdatePlanningDayPayload>({
        mutationFn: ({ id, day_code }) => routingApi.updatePlanningDay(id, { day_code }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningKeys.all });
        },
    });
}

// ─── Planning journalier ─────────────────────────────────────────────────────

const planningDailyKeys = {
    all: [...ROUTING_BASE_KEY, 'planning-daily'] as const,
    list: (filters: PlanningDailyFilters) => [...planningDailyKeys.all, 'list', filters] as const,
};

export function usePlanningDaily(filters: PlanningDailyFilters = {}, enabled = true) {
    return useQuery<{ data: ItineraryPlanningDaily[] }, AxiosError>({
        queryKey: planningDailyKeys.list(filters),
        queryFn: () => routingApi.getPlanningDaily(filters),
        enabled,
    });
}

export function useUpsertForDate() {
    const queryClient = useQueryClient();
    return useMutation<UpsertForDateResponse, AxiosError, UpsertForDatePayload>({
        mutationFn: (payload) => routingApi.upsertForDate(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningDailyKeys.all });
        },
    });
}

export function useDeletePlanningDaily() {
    const queryClient = useQueryClient();
    return useMutation<ItineraryMessageResponse, AxiosError, number>({
        mutationFn: (id) => routingApi.deletePlanningDaily(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: planningDailyKeys.all });
        },
    });
}

// ─── Geo Routing PostGIS ─────────────────────────────────────────────────────

export function useMapLayers(params: MapLayersParams = {}, enabled = true) {
    return useQuery<GeoAreaFeatureCollection, AxiosError>({
        queryKey: [...ROUTING_BASE_KEY, 'geo-routing', 'map-layers', params],
        queryFn: () => routingApi.getMapLayers(params),
        enabled,
        staleTime: 60 * 1000,
    });
}

export function useGeoRoutingBounds(geoAreaId: number | null) {
    return useQuery<GeoAreaBounds, AxiosError>({
        queryKey: [...ROUTING_BASE_KEY, 'geo-routing', 'bounds', geoAreaId],
        queryFn: () => routingApi.getGeoRoutingBounds(geoAreaId as number),
        enabled: geoAreaId !== null && geoAreaId > 0,
        staleTime: 5 * 60 * 1000,
    });
}

export function useBulkAssignPartners() {
    const queryClient = useQueryClient();
    return useMutation<BulkAssignPartnersResult, AxiosError, BulkAssignPartnersPayload>({
        mutationFn: (payload) => routingApi.bulkAssignPartners(payload),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraryDetail(variables.itinerary_id) });
        },
    });
}

export function useUpdatePartnerGpsLocation() {
    const queryClient = useQueryClient();
    return useMutation<
        UpdatePartnerGpsResponse,
        AxiosError,
        { partner_code: string; latitude: number; longitude: number }
    >({
        mutationFn: ({ partner_code, latitude, longitude }) =>
            routingApi.updatePartnerGpsLocation(partner_code, { latitude, longitude }),
        onSuccess: () => {
            // The PostGIS trigger may have re-assigned geo_area_code — refresh itinerary detail
            queryClient.invalidateQueries({ queryKey: routingKeys.itineraries() });
        },
    });
}
