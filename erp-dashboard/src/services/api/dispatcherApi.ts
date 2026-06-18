import apiClient from './client';
import type {
  DispatcherDashboardData,
  PaginatedResponse,
  DispatcherOrder,
  DeliveryNote,
  BchIndexResponse,
  Shipment,
  BalanceAnalysis,
  PreparationOrder,
  Decharge,
  LogisticsBatch,
  DeliveryOrder,
  DeliveryOrdersListEnvelope,
  DeliveryOrderDetailEnvelope,
  DoDecisionsResponse,
  WarehouseTransfer,
  Rider,
  RiderFull,
  RiderWithVehicles,
  Branch,
  Vehicle,
  ApiSuccessResponse,
  CreateBchPayload,
  UpdateBchPayload,
  CancelBchPayload,
  SaveBalancePayload,
  SplitBlPayload,
  CancelBlPayload,
  UpdateBlPayload,
  CreateDoPayload,
  OrdersPendingFilters,
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
    }): Promise<PaginatedResponse<DeliveryNote>> => {
      const r = await apiClient.get<PaginatedResponse<DeliveryNote>>(`${BASE}/bon-livraisons`, { params });
      return r.data;
    },

    getDraft: async (): Promise<PaginatedResponse<DeliveryNote>> => {
      const r = await apiClient.get<PaginatedResponse<DeliveryNote>>(`${BASE}/bon-livraisons/draft`);
      return r.data;
    },

    getConfirmed: async (): Promise<PaginatedResponse<DeliveryNote>> => {
      const r = await apiClient.get<PaginatedResponse<DeliveryNote>>(`${BASE}/bon-livraisons/confirmed`);
      return r.data;
    },

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

    // Generic decision list for this BL — docs §16 "How to check available decisions for a record"
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/bon-livraison/${id}/decisions`);
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

  // ─── Bon de Chargement (BCH) ─────────────────────────────────────────────
  bonChargements: {
    getList: async (params?: {
      status?: string;
      rider_id?: number;
      search?: string;
      page?: number;
    }): Promise<BchIndexResponse> => {
      const r = await apiClient.get<BchIndexResponse>(`${BASE}/bon-chargements`, { params });
      return r.data;
    },

    getById: async (id: number): Promise<Shipment> => {
      const r = await apiClient.get<Shipment>(`${BASE}/bon-chargements/${id}`);
      return r.data;
    },

    create: async (payload: CreateBchPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/bon-chargements`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bch:create:${payload.bl_ids.join('-')}`) },
      });
      return r.data;
    },

    update: async (id: number, payload: UpdateBchPayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.put<ApiSuccessResponse>(`${BASE}/bon-chargements/${id}`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bch:${id}:update`) },
      });
      return r.data;
    },

    addBls: async (id: number, blIds: number[]): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/bon-chargements/${id}/bls`,
        { decision: 'update_bch', add_delivery_note_ids: blIds },
        { headers: { 'Idempotency-Key': mkKey(`bch:${id}:add-bls`) } }
      );
      return r.data;
    },

    removeBl: async (id: number, blId: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.delete<ApiSuccessResponse>(`${BASE}/bon-chargements/${id}/bls/${blId}`, {
        data: { decision: 'update_bch', remove_delivery_note_ids: [blId] },
        headers: { 'Idempotency-Key': mkKey(`bch:${id}:remove-bl:${blId}`) },
      });
      return r.data;
    },

    submit: async (id: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/bon-chargements/${id}/submit`, {}, {
        headers: { 'Idempotency-Key': mkKey(`bch:${id}:submit`) },
      });
      return r.data;
    },

    resubmit: async (id: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/bon-chargements/${id}/resubmit`,
        { decision: 'resubmit_bch' },
        { headers: { 'Idempotency-Key': mkKey(`bch:${id}:resubmit`) } }
      );
      return r.data;
    },

    cancel: async (id: number, reason: string): Promise<ApiSuccessResponse> => {
      const payload: CancelBchPayload = { decision: 'cancel_bch', reason };
      const r = await apiClient.post<ApiSuccessResponse>(`${BASE}/bon-chargements/${id}/cancel`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bch:${id}:cancel`) },
      });
      return r.data;
    },

    // Generic decision list for this BCH — docs §16 "How to check available decisions for a record"
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/bon-chargement/${id}/decisions`);
      return r.data;
    },

    // BCH decisions, same `metadata` nesting requirement as BL/DO/LOT decisions — see comment on
    // bonLivraisons.executeDecision above for the backend-confirmed convention.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/bon-chargement/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`bch:${id}:${decision}`) } }
      );
      return r.data;
    },

    validateShipment: async (id: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/bon-chargement/${id}/execute`,
        { decision: 'validate_shipment' },
        { headers: { 'Idempotency-Key': mkKey(`bch:${id}:validate`) } }
      );
      return r.data;
    },

    print: async (id: number): Promise<unknown> => {
      const r = await apiClient.get(`${BASE}/bon-chargements/${id}/print`);
      return r.data;
    },

    getBalance: async (id: number): Promise<BalanceAnalysis> => {
      const r = await apiClient.get<BalanceAnalysis>(`${BASE}/bon-chargements/${id}/balance`);
      return r.data;
    },

    saveBalance: async (id: number, payload: SaveBalancePayload): Promise<ApiSuccessResponse> => {
      const r = await apiClient.put<ApiSuccessResponse>(`${BASE}/bon-chargements/${id}/balance`, payload, {
        headers: { 'Idempotency-Key': mkKey(`bch:${id}:balance:${payload.split_strategy}`) },
      });
      return r.data;
    },
  },

  // ─── Shortage Queue ──────────────────────────────────────────────────────
  preparations: {
    getShortageQueue: async (params?: { page?: number }): Promise<PaginatedResponse<PreparationOrder>> => {
      const r = await apiClient.get<PaginatedResponse<PreparationOrder>>(
        `${BASE}/preparations/shortage-queue`,
        { params }
      );
      return r.data;
    },
  },

  // ─── Décharges ────────────────────────────────────────────────────────────
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

  // ─── Delivery Orders (DO) ────────────────────────────────────────────────
  deliveryOrders: {
    // Docs §9 say flat Laravel paginator (like orders/pending); some responses were seen double-wrapped
    // as { success, data: { deliveryOrders: <paginated> } } — support both.
    getList: async (params?: {
      status?: string;
      search?: string;
      page?: number;
      per_page?: number;
    }): Promise<PaginatedResponse<DeliveryOrder>> => {
      const r = await apiClient.get<DeliveryOrdersListEnvelope | PaginatedResponse<DeliveryOrder>>(
        `${BASE}/delivery-orders`,
        { params }
      );
      const body = r.data as DeliveryOrdersListEnvelope;
      if (body?.data?.deliveryOrders) return body.data.deliveryOrders;
      return r.data as PaginatedResponse<DeliveryOrder>;
    },
    // Backend wraps the detail as { success, data: { deliveryOrder, batches, bchs } } (docs §9)
    getById: async (id: number): Promise<DeliveryOrder> => {
      const r = await apiClient.get<DeliveryOrderDetailEnvelope | DeliveryOrder>(`${BASE}/delivery-orders/${id}`);
      const body = r.data as DeliveryOrderDetailEnvelope;
      if (body?.data?.deliveryOrder) {
        return { ...body.data.deliveryOrder, batches: body.data.batches, bchs: body.data.bchs };
      }
      // Fallback: some earlier responses returned the DO flat under data
      const flatData = (r.data as { data?: unknown })?.data;
      if (flatData && typeof flatData === 'object' && 'do_number' in flatData) {
        return flatData as DeliveryOrder;
      }
      return r.data as DeliveryOrder;
    },
    create: async (payload: CreateDoPayload): Promise<ApiSuccessResponse & { data?: DeliveryOrder }> => {
      const r = await apiClient.post<ApiSuccessResponse & { data?: DeliveryOrder }>(
        `${BASE}/delivery-orders`,
        payload,
        { headers: { 'Idempotency-Key': mkKey(`do:create:${payload.order_ids.join('-')}`) } }
      );
      return r.data;
    },
    // DO workflow via engine (allocate_do, optimize_do, submit_do_to_warehouse, cancel_do)
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/delivery-order/${id}/decisions`);
      return r.data;
    },
    // DO decisions — fields must nest under `metadata`, confirmed by backend 2026-06-17 as the
    // established convention (docs §16): every *Decision::validate()/doExecute() reads
    // $context->data['metadata'], so a flat or `data`-nested payload is silently ignored.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/delivery-order/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`do:${id}:${decision}`) } }
      );
      return r.data;
    },
  },

  // ─── Riders ───────────────────────────────────────────────────────────────
  livreurs: {
    getList: async (): Promise<Rider[]> => {
      const r = await apiClient.get<Rider[]>(`${BASE}/livreurs`);
      return r.data;
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

  // ─── Fleet & Rider Master Data (docs §12d, verified against real code 2026-06-17) ──────────
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

  // ─── Logistics Batches (LOT) ─────────────────────────────────────────────
  batches: {
    // Query params per docs §12: status (open/sealed), search, per_page — no rider_id.
    // Actual response (verified live, differs from doc's flat-paginator example):
    // { success, data: { batches: PaginatedResponse<LogisticsBatch>, stats: {...} } }.
    getList: async (params?: {
      status?: string;
      search?: string;
      per_page?: number;
    }): Promise<PaginatedResponse<LogisticsBatch>> => {
      const r = await apiClient.get<
        { success: boolean; data: { batches: PaginatedResponse<LogisticsBatch> } } | PaginatedResponse<LogisticsBatch>
      >(`${BASE}/batches`, { params });
      const body = r.data as { success: boolean; data: { batches: PaginatedResponse<LogisticsBatch> } };
      if (body?.data?.batches) return body.data.batches;
      return r.data as PaginatedResponse<LogisticsBatch>;
    },
    // Wrapped, not flat — { success, data: { batch } } (docs §12)
    getById: async (id: number): Promise<LogisticsBatch> => {
      const r = await apiClient.get<{ success: boolean; data: { batch: LogisticsBatch } } | LogisticsBatch>(
        `${BASE}/batches/${id}`
      );
      const body = r.data as { success: boolean; data: { batch: LogisticsBatch } };
      if (body?.data?.batch) return body.data.batch;
      return r.data as LogisticsBatch;
    },
    // Generic decision list for this LOT — docs §16 "How to check available decisions for a record"
    getDecisions: async (id: number): Promise<DoDecisionsResponse> => {
      const r = await apiClient.get<DoDecisionsResponse>(`${WORKFLOW}/logistics-batch/${id}/decisions`);
      return r.data;
    },
    // Logistics-batch decisions, same `metadata` nesting requirement — see comment on
    // deliveryOrders.executeDecision above.
    executeDecision: async (
      id: number,
      decision: string,
      extra?: Record<string, unknown>
    ): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${WORKFLOW}/logistics-batch/${id}/execute`,
        { decision, metadata: extra ?? {} },
        { headers: { 'Idempotency-Key': mkKey(`batch:${id}:${decision}`) } }
      );
      return r.data;
    },
  },

  // ─── Delivery Missions (DM) ──────────────────────────────────────────────
  // No controller, route, or decision exists for delivery-missions yet — schema only
  // (docs §12b [LOOSE END / FUTURE TODO GAP]). Intentionally no API methods here; do not
  // add calls against `${BASE}/delivery-missions` until the backend wires it up.

  // ─── Warehouse Transfers (WT) ─────────────────────────────────────────────
  // Rewritten 2026-06-17 against backend's correction (docs §12c) — the previous `data`/`create`
  // shapes were fabricated. A WT moves stock main-warehouse → rider's van, created only from a
  // completed BCH; there is no manual/arbitrary branch-to-branch creation endpoint. accept/reject
  // are direct `$model->update()` calls (no status guard, no Decision-engine replay semantics)
  // unlike the rest of this API — confirmed by backend, not a frontend assumption.
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
    // Only real creation path — derives items/quantities from a *completed* BCH automatically, no
    // request body to author manually. 422 if the BCH isn't `completed`.
    createFromBch: async (bchId: number): Promise<ApiSuccessResponse> => {
      const r = await apiClient.post<ApiSuccessResponse>(
        `${BASE}/warehouse-transfers/from-bch/${bchId}`,
        {},
        { headers: { 'Idempotency-Key': mkKey(`wt:create:${bchId}`) } }
      );
      return r.data;
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
};

export default dispatcherApi;
