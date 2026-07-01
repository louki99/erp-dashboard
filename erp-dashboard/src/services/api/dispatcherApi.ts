import apiClient from './client';
import type {
  DispatcherDashboardData,
  PaginatedResponse,
  DispatcherOrder,
  DeliveryNote,
  PreparationOrder,
  Decharge,
  DeliveryMissionDetailResponse,
  MissionBatchPreviewResponse,
  CreateDeliveryMissionPayload,
  WarehouseTransfer,
  Rider,
  RiderFull,
  RiderWithVehicles,
  Branch,
  Vehicle,
  ApiSuccessResponse,
  SplitBlPayload,
  CancelBlPayload,
  UpdateBlPayload,
  OrdersPendingFilters,
  DoDecisionsResponse,
  ShortageQueueResponse,
  WorkflowContextResponse,
  MissionPlanningTemplate,
  MissionPlanningRun,
  CreateMissionPlanningTemplatePayload,
  UpdateMissionPlanningTemplatePayload,
} from '@/types/dispatcher.types';

const BASE = '/api/backend/dispatcher';
const WORKFLOW = '/api/backend/workflow';
// Fleet & Rider Master Data (docs §12d) — root-level controllers, not under /dispatcher.
const RIDERS_BASE = '/api/backend/riders';
// Vehicle assign/unassign mutations live at the bare root `/api/...`, no `backend` segment at
// all — easy to miss, confirmed by backend 2026-06-17.
const VANS_BASE = '/api/vans';

const mkKey = (prefix: string) => `${prefix}:${Date.now()}`;

export const dispatcherApi = {
  // ─── Dashboard ───────────────────────────────────────────────────────────────
  dashboard: {
    get: async (): Promise<DispatcherDashboardData> => {
      const r = await apiClient.get<DispatcherDashboardData>(`${BASE}/dashboard`);
      return r.data;
    },
  },

  // ─── Orders (BC → Dispatch) ───────────────────────────────────────────────
  orders: {
    getPending: async (params?: OrdersPendingFilters): Promise<PaginatedResponse<DispatcherOrder>> => {
      const r = await apiClient.get<PaginatedResponse<DispatcherOrder>>(`${BASE}/orders/pending`, { params });
      return r.data;
    },
    getById: async (id: number): Promise<DispatcherOrder> => {
      const r = await apiClient.get<DispatcherOrder>(`${BASE}/orders/${id}`);
      return r.data;
    },
  },

  // ─── Bon de Livraison (BL) ───────────────────────────────────────────────
  bonLivraisons: {
    getList: async (params?: {
      status?: string;
      rider_id?: number;
      search?: string;
      page?: number;
      per_page?: number;
    }): Promise<PaginatedResponse<DeliveryNote>> => {
      // Real response (verified live 2026-06-21) is wrapped: { success, data: { deliveryNotes:
      // <paginator> } } — not a flat paginator. Support both shapes defensively.
      const r = await apiClient.get<
        { success: boolean; data: { deliveryNotes: PaginatedResponse<DeliveryNote> } } | PaginatedResponse<DeliveryNote>
      >(`${BASE}/bon-livraisons`, { params });
      const body = r.data as { success: boolean; data: { deliveryNotes: PaginatedResponse<DeliveryNote> } };
      if (body?.data?.deliveryNotes) return body.data.deliveryNotes;
      return r.data as PaginatedResponse<DeliveryNote>;
    },

    // §7.2/§7.3 (`/draft`, `/confirmed`) — fixed 2026-06-23 (were broken after the migration,
    // now functional). The generic list with a status filter (§7.1) also works and is preferred
    // for parameterized filtering; these shortcuts are kept for backward compatibility.
    getById: async (id: number): Promise<DeliveryNote> => {
      const r = await apiClient.get<DeliveryNote>(`${BASE}/bon-livraisons/${id}`);
      return r.data;
    },

    update: async (id: number, payload: UpdateBlPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.put<ApiSuccessResponse>(`${BASE}/bon-livraisons/${id}`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bl:${id}:update`) },
      });
      return r.data;
    },

    split: async (id: number, payload: SplitBlPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/bon-livraisons/${id}/split`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bl:${id}:split`) },
      });
      return r.data;
    },

    cancel: async (id: number, payload: CancelBlPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/bon-livraisons/${id}/cancel`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bl:${id}:cancel`) },
      });
      return r.data;
    },

    // REMOVED 2026-06-22 (backend breaking change) — `POST /bon-livraisons/{id}/allocate` (and the
    // `allocate_delivery_note` decision behind it) no longer exist. Allocation now happens
    // automatically, atomically, as part of `confirm_delivery_mission` on the mission itself
    // (deliveryMissions.executeDecision below) — there is no more per-BL allocate step.

    // Generic decision list for this BL — docs §16 "How to check available decisions for a record"
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/bon-livraison/${id}/decisions`);
      return r.data;
    },

    getContext: async (id: number): Promise<WorkflowContextResponse<DeliveryNote>> => {
      const r = await apiClient.get<WorkflowContextResponse<DeliveryNote>>(`${WORKFLOW}/bon-livraison/${id}/context`);
      return r.data;
    },

    // BL workflow via engine (confirm_delivery, update_delivery, etc.). Fields must nest under
    // `metadata` — confirmed by backend 2026-06-17 (docs §16): every *Decision::validate()/
    // doExecute() reads $context->data['metadata'], so a flat payload is silently ignored. This is
    // the established convention (verified by backend's own test suite), not a bug to be fixed.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/bon-livraison/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`bl:${id}:${decision}`) } }
      );
      return r.data;
    },
  },

  // ─── Shortage Queue & resolution (docs §10, fixed/verified live 2026-06-23) ────────────────
  preparations: {
    // Fixed 2026-06-23 — this used to crash (whereHas on dropped logisticsBatch/bonChargement
    // relations). Response envelope is { success, ui, data: <paginator> }, not a flat paginator
    // like every other list endpoint — `data` itself holds the page, not the row array directly.
    getShortageQueue: async (params?: { page?: number }): Promise<PaginatedResponse<PreparationOrder>> => {
      const r = await apiClient.get<ShortageQueueResponse>(
        `${BASE}/preparations/shortage-queue`,
        { params }
      );
      return r.data.data;
    },

    // Generic decision list for a BP — same "How to check available decisions" pattern as every
    // other model (docs §16). Drives review_partial_preparation / accept_partial_preparation /
    // request_rework dynamically via DecisionActionsBar, same as everywhere else in this app.
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/bon-preparation/${id}/decisions`);
      return r.data;
    },

    getContext: async (id: number): Promise<WorkflowContextResponse<PreparationOrder>> => {
      const r = await apiClient.get<WorkflowContextResponse<PreparationOrder>>(`${WORKFLOW}/bon-preparation/${id}/context`);
      return r.data;
    },

    // review_partial_preparation (no body) / accept_partial_preparation (metadata.
    // acceptance_reason, metadata.force_accept?) / request_rework (metadata.rework_reason) — all
    // 3 were fixed 2026-06-23: accept/rework previously read their text field from the wrong
    // payload location and silently dropped it (or hard-failed) — `metadata` nesting is the
    // confirmed-correct convention here too, same as every other decision in this app.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/bon-preparation/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`bp:${id}:${decision}`) } }
      );
      return r.data;
    },
  },

  // ─── Décharges ────────────────────────────────────────────────────────────
  // §11: list/approve/reject still work; the `bonChargement` nested field on detail references a
  // dropped table and may throw/be absent — render defensively, don't hard-depend on it.
  decharges: {
    getList: async (params?: { type?: string; status?: string; page?: number }): Promise<PaginatedResponse<Decharge>> => {
      const r = await apiClient.get<PaginatedResponse<Decharge>>(`${BASE}/decharges`, { params });
      return r.data;
    },
    getById: async (id: number): Promise<Decharge> => {
      const r = await apiClient.get<Decharge>(`${BASE}/decharges/${id}`);
      return r.data;
    },
    approveReturn: async (id: number, comment?: string): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/decharges/${id}/approve-return`,
        { comment },
        { headers: { 'Idempotency-Key': mkKey(`decharge:${id}:approve`) } }
      );
      return r.data;
    },
    reject: async (id: number, reason: string): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/decharges/${id}/reject`,
        { reason },
        { headers: { 'Idempotency-Key': mkKey(`decharge:${id}:reject`) } }
      );
      return r.data;
    },
  },

  // ─── Delivery Missions — replaces DO + LOT + BCH/Shipment (docs §8, 2026-06-20) ─────────────
  deliveryMissions: {
    // List endpoint — now available (was missing pre-2026-07). Returns paginated missions
    // scoped to the dispatcher's branch. Auto-planned missions (rider: null) are included.
    getList: async (params?: { status?: string; rider_id?: number; auto_planned?: boolean; per_page?: number; page?: number }): Promise<DeliveryMission[]> => {
      type ListResponse =
        | { success: boolean; data: DeliveryMission[] | { data: DeliveryMission[] } }
        | DeliveryMission[];
      const r = await apiClient.get<ListResponse>(`${BASE}/delivery-missions`, { params });
      if (Array.isArray(r.data)) return r.data;
      const body = r.data as { success: boolean; data: DeliveryMission[] | { data: DeliveryMission[] } };
      if (Array.isArray(body.data)) return body.data;
      return (body.data as { data: DeliveryMission[] }).data ?? [];
    },

    // Dedicated REST shortcut (docs §8.1) — thin wrapper around the `create_delivery_mission`
    // workflow decision, same guards/idempotency. Drag&drop confirmed orders + rider/vehicle
    // picked up front; generates one BL per partner in the same call.
    create: async (payload: CreateDeliveryMissionPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/delivery-missions`, payload, {
        headers: { 'Idempotency-Key': mkKey('mission:create') },
      });
      return r.data;
    },

    // Virtual, read-only — nothing persisted (docs §8.9). Replaces the old LogisticsBatch concept
    // for "combined picking PDF" purposes.
    getBatchPreview: async (missionIds: number[]): Promise<MissionBatchPreviewResponse> => {
      const r = await apiClient.get<MissionBatchPreviewResponse>(
        `${BASE}/delivery-missions/batch-preview`,
        { params: { 'mission_ids[]': missionIds } }
      );
      return r.data;
    },

    // Full detail — wrapper keys are `mission`/`delivery_notes`/`preparation_order`, not `data`
    // (docs §8.8). Different base (`/workflow/...`, not `/dispatcher/...`).
    getDetail: async (id: number): Promise<DeliveryMissionDetailResponse> => {
      const r = await apiClient.get<DeliveryMissionDetailResponse>(`${WORKFLOW}/delivery-mission/${id}`);
      return r.data;
    },

    // Generic decision list — docs §16 "How to check available decisions for a record". Model
    // type is `delivery-mission` (also accepted as `mission`, normalized server-side).
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/delivery-mission/${id}/decisions`);
      return r.data;
    },

    getContext: async (id: number): Promise<WorkflowContextResponse<DeliveryMissionDetailResponse>> => {
      const r = await apiClient.get<WorkflowContextResponse<DeliveryMissionDetailResponse>>(`${WORKFLOW}/delivery-mission/${id}/context`);
      return r.data;
    },

    // confirm_delivery_mission / start_delivery_mission / complete_delivery_mission /
    // update_delivery_mission / cancel_delivery_mission all go through here. Same `metadata`
    // nesting convention as every other module.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/delivery-mission/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`mission:${id}:${decision}`) } }
      );
      return r.data;
    },
  },

  // ─── Riders ───────────────────────────────────────────────────────────────
  livreurs: {
    // Docs (§12) give no response sample, only the curl example — observed live 2026-06-21 to be
    // wrapped rather than a flat array (same undocumented-wrapping pattern as bon-livraisons).
    // Defensive parsing covers flat array, { data: [...] }, and { riders: [...] } shapes.
    getList: async (): Promise<Rider[]> => {
      const r = await apiClient.get<Rider[] | { data?: Rider[]; riders?: Rider[] }>(`${BASE}/livreurs`);
      if (Array.isArray(r.data)) return r.data;
      return r.data?.data ?? r.data?.riders ?? [];
    },
  },

  // ─── Vehicles ─────────────────────────────────────────────────────────────
  // New endpoint confirmed by backend 2026-06-17 — wrapped { success, data: [...] }, scoped to the
  // logged-in dispatcher's branch server-side (no client-side branch filtering needed).
  vehicles: {
    getList: async (): Promise<Vehicle[]> => {
      const r = await apiClient.get<{ success: boolean; data: Vehicle[] }>(`${BASE}/vehicles`);
      return r.data?.data ?? [];
    },
  },

  // ─── Fleet & Rider Master Data (docs §12d, verified against real code 2026-06-17; unaffected
  // by the 2026-06-20 BCH/DO/LOT → Delivery Mission migration) ────────────────────────────────
  fleet: {
    // `index` — response wrapper key is `riders` (paginator), not `data`, plus a sibling
    // `branches` key for a branch-filter dropdown.
    getRiders: async (params?: {
      status?: string;
      branch_code?: string;
      search?: string;
      page?: number;
    }): Promise<{ riders: PaginatedResponse<RiderFull>; branches: Branch[] }> => {
      const r = await apiClient.get<{ riders: PaginatedResponse<RiderFull>; branches: Branch[] }>(
        RIDERS_BASE,
        { params }
      );
      return r.data;
    },
    getRiderById: async (id: number): Promise<{
      user: RiderFull;
      active_delivery_notes: Array<{ id: number; status: string }>;
      completed_delivery_notes_count: number;
      total_b2b_deliveries: number;
    }> => {
      const r = await apiClient.get(`${RIDERS_BASE}/${id}`);
      return r.data;
    },
    // Lightweight list for dropdowns — flat array, not paginated.
    getRidersSimple: async (params?: { branch_code?: string; status?: string }): Promise<RiderFull[]> => {
      const r = await apiClient.get<RiderFull[]>(`${RIDERS_BASE}/simple`, { params });
      return r.data;
    },
    // The key endpoint for an assignment screen — each rider with currently assigned vehicle(s).
    getRidersWithVehicles: async (params?: {
      branch_code?: string;
      status?: string;
      search?: string;
    }): Promise<RiderWithVehicles[]> => {
      const r = await apiClient.get<{ success: boolean; data: { riders: RiderWithVehicles[] } }>(
        `${RIDERS_BASE}/with-vehicles`,
        { params }
      );
      return r.data?.data?.riders ?? [];
    },
    // GET, not PATCH/POST — pre-existing REST inconsistency on the backend, kept as-is per docs.
    toggleRiderActive: async (id: number): Promise<{ success: boolean; message: string; is_active: boolean }> => {
      const r = await apiClient.get(`${RIDERS_BASE}/${id}/toggle`);
      return r.data;
    },
    // Different base URL — root `/api/vans`, not `/api/backend/...`. Works for any vehicle type
    // (truck/van/motorcycle) since the van-only guard was removed 2026-06-17; the `vans` in the
    // path is legacy naming only. starts_at/notes/role added 2026-06-17 — all optional except
    // user_id (defaults: starts_at=now(), role=van_seller). assigned_by is always server-set.
    assignVehicle: async (
      vehicleId: number,
      userId: number,
      extra?: { starts_at?: string; notes?: string; role?: 'van_seller' | 'delivery_agent' }
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${VANS_BASE}/${vehicleId}/assign`,
        { user_id: userId, ...extra },
        { headers: { 'Idempotency-Key': mkKey(`van:${vehicleId}:assign`) } }
      );
      return r.data;
    },
    // ends_at/notes added 2026-06-17 — both optional (default ends_at=now()).
    unassignVehicle: async (
      vehicleId: number,
      extra?: { ends_at?: string; notes?: string }
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${VANS_BASE}/${vehicleId}/unassign`,
        extra ?? {},
        { headers: { 'Idempotency-Key': mkKey(`van:${vehicleId}:unassign`) } }
      );
      return r.data;
    },
    // New 2026-06-17 — edits notes/ends_at/is_active on the CURRENT active assignment without
    // creating a new one (e.g. add a note without reassigning). 404s if no active assignment.
    updateAssignment: async (
      vehicleId: number,
      payload: { notes?: string; ends_at?: string; is_active?: boolean }
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.put<ApiSuccessResponse>(
        `${VANS_BASE}/${vehicleId}/assignment`,
        payload,
        { headers: { 'Idempotency-Key': mkKey(`van:${vehicleId}:assignment`) } }
      );
      return r.data;
    },
  },

  // ─── Warehouse Transfers (WT) ─────────────────────────────────────────────
  // 2026-06-20: WT creation is now 100% automatic (WarehouseTransferService::createFromMission(),
  // called by complete_preparation the moment a mission's BP completes) — there is no longer any
  // dispatcher-triggered "create" endpoint at all (the old `from-bch/{bchId}` is gone, no
  // `from-mission` replacement either). The dispatcher only ever reads/accepts/rejects a WT.
  // accept/reject are direct `$model->update()` calls (no status guard, no Decision-engine replay
  // semantics) unlike the rest of this API — confirmed by backend, not a frontend assumption.
  warehouseTransfers: {
    // Response wrapper key is `transfers`, not `data` (WarehouseTransferController::index()).
    getList: async (params?: {
      status?: string;
      sync_status?: string;
      rider_id?: number;
      page?: number;
    }): Promise<PaginatedResponse<WarehouseTransfer>> => {
      const r = await apiClient.get<{ transfers: PaginatedResponse<WarehouseTransfer> }>(`${BASE}/warehouse-transfers`, { params });
      return r.data.transfers;
    },
    // Response wrapper key is `transfer` (singular), not `data`.
    getById: async (id: number): Promise<WarehouseTransfer> => {
      const r = await apiClient.get<{ transfer: WarehouseTransfer }>(`${BASE}/warehouse-transfers/${id}`);
      return r.data.transfer;
    },
    accept: async (id: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/warehouse-transfers/${id}/accept`,
        {},
        { headers: { 'Idempotency-Key': mkKey(`wt:${id}:accept`) } }
      );
      return r.data;
    },
    // `reason` is stored in `notes` — there is no dedicated rejection-reason column.
    reject: async (id: number, reason: string): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/warehouse-transfers/${id}/reject`,
        { reason },
        { headers: { 'Idempotency-Key': mkKey(`wt:${id}:reject`) } }
      );
      return r.data;
    },
  },
  // ─── Mission Planning Templates (docs §19, 2026-07-21) ────────────────────
  // 4 CRUD endpoints for auto-planning ("Mission Vide"). Access: dispatcher/root/admin.
  missionPlanningTemplates: {
    getList: async (params?: {
      is_active?: boolean;
      page?: number;
    }): Promise<PaginatedResponse<MissionPlanningTemplate>> => {
      const r = await apiClient.get<{ success: boolean; data: PaginatedResponse<MissionPlanningTemplate> }>(
        `${BASE}/mission-planning-templates`,
        { params }
      );
      return r.data.data;
    },

    create: async (payload: CreateMissionPlanningTemplatePayload): Promise<{ success: boolean; message: string; data: MissionPlanningTemplate }> => {
      const r = await apiClient.post<{ success: boolean; message: string; data: MissionPlanningTemplate }>(
        `${BASE}/mission-planning-templates`,
        payload,
        { headers: { 'Idempotency-Key': mkKey('template:create') } }
      );
      return r.data;
    },

    update: async (id: number, payload: UpdateMissionPlanningTemplatePayload): Promise<{ success: boolean; message: string; data: MissionPlanningTemplate }> => {
      const r = await apiClient.put<{ success: boolean; message: string; data: MissionPlanningTemplate }>(
        `${BASE}/mission-planning-templates/${id}`,
        payload,
        { headers: { 'Idempotency-Key': mkKey(`template:${id}:update`) } }
      );
      return r.data;
    },

    delete: async (id: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.delete<ApiSuccessResponse>(
        `${BASE}/mission-planning-templates/${id}`,
        { headers: { 'Idempotency-Key': mkKey(`template:${id}:delete`) } }
      );
      return r.data;
    },
  },

  // ─── Mission Planning Runs — execution history (docs §19.5) ──────────────
  missionPlanningRuns: {
    getList: async (params: { template_id: number; page?: number }): Promise<MissionPlanningRun[]> => {
      const r = await apiClient.get<
        | { success: boolean; data: MissionPlanningRun[] | { data: MissionPlanningRun[] } }
        | MissionPlanningRun[]
      >(`${BASE}/mission-planning-runs`, { params });
      if (Array.isArray(r.data)) return r.data;
      const inner = (r.data as { success: boolean; data: MissionPlanningRun[] | { data: MissionPlanningRun[] } }).data;
      if (Array.isArray(inner)) return inner;
      return (inner as { data: MissionPlanningRun[] }).data ?? [];
    },
  },

  // ─── Commercials list — for template form multi-select ────────────────────
  // Users with commercial/salesperson role, scoped to the authenticated dispatcher's branch.
  commercials: {
    getList: async (): Promise<Array<{ id: number; name: string; code?: string }>> => {
      const r = await apiClient.get<
        { success: boolean; data: Array<{ id: number; name: string; code?: string }> }
        | Array<{ id: number; name: string; code?: string }>
      >(`${BASE}/commercials`);
      if (Array.isArray(r.data)) return r.data;
      return (r.data as { success: boolean; data: Array<{ id: number; name: string; code?: string }> }).data ?? [];
    },
  },

  // ─── Mission planning calendar — §19.7 ───────────────────────────────────
  missionPlanningCalendar: {
    getList: async (params: { start_date: string; end_date: string }) => {
      const r = await apiClient.get<import('@/types/dispatcher.types').MissionPlanningCalendarEvent[]>(
        `${BASE}/mission-planning/calendar`, { params }
      );
      return Array.isArray(r.data) ? r.data : [];
    },
  },

  // ─── Dispatcher-scoped partner list — for template form multi-select ──────
  // GET /api/backend/dispatcher/partners — branch-scoped active partners. Handles both
  // { success, data: [...] } and flat array response shapes defensively.
  dispatcherPartners: {
    getList: async (params?: { search?: string; page?: number; per_page?: number }): Promise<Array<{ id: number; name: string; code?: string }>> => {
      const r = await apiClient.get<
        { success: boolean; data: Array<{ id: number; name: string; code?: string }> }
        | Array<{ id: number; name: string; code?: string }>
      >(`${BASE}/partners`, { params });
      if (Array.isArray(r.data)) return r.data;
      const body = r.data as { success: boolean; data: Array<{ id: number; name: string; code?: string }> | { data: Array<{ id: number; name: string; code?: string }> } };
      // Handle both flat array and paginated shape under `data`
      if (Array.isArray(body.data)) return body.data;
      const nested = body.data as { data: Array<{ id: number; name: string; code?: string }> };
      return nested?.data ?? [];
    },
  },
};

export default dispatcherApi;
