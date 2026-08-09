// ─── Status enums ─────────────────────────────────────────────────────────────

// 2026-06-20 architecture migration (docs §1/§3): the old BC → DO → LOT/BCH pipeline and the
// parallel "Dispatch V2" BC → DO → BP → BCH pipeline are both gone — `shipments`,
// `shipment_deliveries`, `shipment_delivery_orders`, `delivery_orders`, `delivery_order_items`,
// `delivery_order_orders`, `logistics_batches`, `preparation_delivery_notes` tables are dropped.
// Replaced by a single Delivery Mission pipeline (see DeliveryMission below). BchStatus, DoStatus,
// BatchStatus, Shipment, LogisticsBatch, DeliveryOrder and friends are removed — do not reintroduce.

// Per-base-unit logistics figures — added 2026-06-22 by backend on order_products.product (§6),
// DeliveryNoteItem.product (§7.4), and delivery-mission detail's items[].product (§8.8). Resolved
// server-side from product_logistics_profiles.shipping_level → product_packaging_levels
// (volume_m3/gross_weight_kg ÷ units_per_package). Both null until that catalog master data is
// filled in for a given SKU — confirmed by backend most of the current 212 profiles have no
// volume/weight set yet, so treat absence as "unknown", not "zero", in any load calculation.
export interface ProductLogistics {
  unit_volume_m3?: number | null;
  unit_weight_kg?: number | null;
}

export type BlStatus =
  | 'draft' // freshly created, in a draft mission
  | 'confirmed' // stock allocated, via confirm_delivery_mission (2026-06-22, atomic on the mission)
  | 'batched' // integrated into a mission's BP picking run (no more logistics_batches row backing this)
  | 'submitted_to_magasinier' // reserved value, not currently set by the mission pipeline
  | 'in_preparation'
  | 'ready' // picked, warehouse transfer generated
  | 'loaded'
  | 'in_transit' // mission started — rider departed
  | 'delivered'
  | 'partially_delivered'
  | 'returned'
  | 'cancelled';

// docs §10 (dispatcher) — full shortage-resolution flow added 2026-06-23:
// completed_partial --[review_partial_preparation]--> awaiting_shortage_review
//   --[accept_partial_preparation]--> shortage_accepted --(auto-chained)--> shortage_split_done
//   --[request_rework]--> partial_rework_requested --(magasinier: continue_preparation)--> completed_full | completed_partial
export type BpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed_full'
  | 'completed_partial'
  | 'shortage_accepted'
  | 'shortage_split_done'
  | 'awaiting_shortage_review'
  | 'partial_rework_requested'
  | 'rejected';

// docs §3 "Delivery Mission statuses" — the new top-level pipeline status.
// `awaiting_shortage_review` added 2026-06-23 — backend closed a real state-machine gap: the
// mission used to stay `in_preparation` (passively, indistinguishable from "still picking
// normally") through the whole completed_partial → review/accept/rework loop, which is why this
// app's own mission-card shortage panel previously had to derive "needs review" purely from the
// nested BP's status. Now the mission itself flips to this status atomically (same transaction as
// the BP update) the moment completed_partial is reached, and back to in_preparation on
// request_rework, then either ready (fully resolved) or back to awaiting_shortage_review (still
// short) on the magasinier's continue_preparation. NOTE: not yet reflected in docs/modules/
// 15-dispatcher.md §3/§5 on disk as of this writing (still only lists the original 6 values) —
// flagged back to backend, this enum is built directly off their chat description pending the doc
// catching up.
export type DeliveryMissionStatus =
  | 'draft'
  | 'in_preparation'
  | 'awaiting_shortage_review'
  | 'ready'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

// Real status values from code (docs §12c) — pending → accepted → completed, plus
// rejected/validated (validated only via the separate décharge-reconciliation creation path).
export type TransferStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'rejected'
  | 'validated';

export type SplitStrategy = 'manual' | 'equal' | 'fifo';

// ─── Core models ──────────────────────────────────────────────────────────────

export interface Rider {
  id: number;
  name: string;
  phone?: string;
}

export interface Vehicle {
  id: number;
  plate?: string;
  plate_number?: string;
  internal_code?: string;
  type?: string;
  make?: string;
  model?: string;
  year?: number;
  capacity_kg?: number;
  // Fields confirmed by backend 2026-06-17 on `GET /backend/dispatcher/vehicles` — capacity_volume
  // in m³, capacity_weight/payload_kg in kg. No real-time availability flag yet, only `status`.
  capacity_volume?: number;
  capacity_weight?: number;
  capacity_length?: number;
  capacity_width?: number;
  capacity_height?: number;
  payload_kg?: number | null;
  usable_volume_ratio?: number;
  loading_efficiency_ratio?: number;
  fuel_type?: string;
  cold_chain_enabled?: boolean;
  notes?: string | null;
  display_name?: string;
  status?: string;
  branch_code?: string;
  // true when the vehicle/its rider is linked to a non-terminal mission/shipment — gate for
  // disabling "Retirer" proactively. Confirmed present on all 3 vehicle-listing endpoints.
  has_active_shipments?: boolean;
}

// POST /api/backend/dispatcher/vehicles (root/admin/supervisor only). A `van` type
// auto-provisions its warehouse + storage location server-side; truck/motorcycle don't.
export interface CreateVehiclePayload {
  plate_number: string;
  make: string;
  model: string;
  year: number;
  type: 'van' | 'truck' | 'motorcycle';
  internal_code?: string;
  branch_code: string;
  cold_chain_enabled?: boolean;
  payload_kg?: number | null;
  fuel_type?: string;
  // Physical capacity fields accepted by POST/PUT since 2026-08 (docs §12d-bis).
  capacity_volume?: number | null;
  capacity_weight?: number | null;
  capacity_length?: number | null;
  capacity_width?: number | null;
  capacity_height?: number | null;
  usable_volume_ratio?: number | null;
  loading_efficiency_ratio?: number | null;
}

// PUT/PATCH /api/backend/dispatcher/vehicles/{id} (root/admin/supervisor only, 2026-08-01).
// Same fields as create but ALL optional — send only what changes. `status` is editable here
// (active/maintenance/retired); DELETE is a soft-retire, so this is the way to reactivate too.
export type UpdateVehiclePayload = Partial<CreateVehiclePayload> & {
  status?: 'active' | 'maintenance' | 'retired';
};

// ─── Fleet & Rider Master Data (docs §12d) — unaffected by the 2026-06-20 migration ───────────

export interface Branch {
  code: string;
  name: string;
}

export interface RiderFull {
  id: number;
  name: string;
  last_name?: string;
  phone?: string;
  email?: string;
  branch_code?: string;
  branch?: Branch;
  is_active: boolean;
  active_delivery_notes?: Array<{ id: number; status: string; partner?: { id: number; name: string } }>;
  completed_delivery_notes_count?: number;
  total_b2b_deliveries?: number;
}

// `GET /backend/riders/with-vehicles` — one rider + their currently assigned vehicle(s) in one
// call. `vehicles` is usually 0 or 1 in practice; empty array means unassigned.
export interface RiderWithVehicles {
  id: number;
  name: string;
  // Backend replaced `last_name` with `code` here (2026-08-01) — rider matricule, e.g. "LIV000012".
  // Nullable: legacy/demo riders may have no code yet.
  code?: string | null;
  phone?: string;
  branch?: Branch;
  is_active: boolean;
  vehicles: Vehicle[];
}

export interface DeliveryNoteItem {
  id: number;
  product_id: number;
  quantity?: number;
  ordered_quantity?: number;
  allocated_quantity?: number;
  /** Legacy field name — prefer allocated_quantity */
  allocated_qty?: number;
  prepared_quantity?: number | null;
  unit_price: number;
  total_price?: number;
  product: { id: number; name: string; sku?: string } & ProductLogistics;
}

export interface DeliveryNote {
  id: number;
  delivery_number: string;
  status: BlStatus;
  total_amount: number;
  delivery_date?: string | null;
  notes?: string | null;
  branch_code: string;
  is_quantity_locked?: boolean;
  partner: { id: number; name: string; code: string };
  order?: { id: number; order_code: string; bc_status: string } | null;
  orders?: Array<{ id: number; order_code: string; bc_status: string }> | null;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  items?: DeliveryNoteItem[];
  // Replaces the old `bon_chargement` (Shipment/BCH) reference — a BL now belongs to a mission.
  delivery_mission_id?: number | null;
  delivery_mission?: { id: number; mission_number: string; status: DeliveryMissionStatus } | null;
  preparation?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  created_at: string;
}

export interface PreparationOrderItem {
  id: number;
  product_id: number;
  requested_quantity: number;
  available_quantity?: number;
  prepared_quantity: number;
  shortage_quantity: number;
  shortage_reason?: string | null;
  shortage_reported_at?: string | null;
  // do_item removed from the response (docs §8 BP note) — items now relate directly to the
  // mission's aggregated BL items, not a per-DO breakdown.
  product?: { id: number; name: string; code?: string };
}

export interface PreparationOrder {
  id: number;
  bp_number: string;
  status: BpStatus;
  total_shortage_percentage?: number;
  is_critical_shortage?: boolean;
  shortage_acknowledged?: boolean;
  preparation_efficiency?: number | null;
  magasinier?: { id: number; name: string } | null;
  // Replaces the old `shipment` (Shipment/BCH) field — a BP now belongs to a mission. Field name
  // confirmed `delivery_mission` (not `mission`) on the live shortage-queue response, docs §10.
  delivery_mission_id?: number | null;
  delivery_mission?: (Pick<DeliveryMission, 'id' | 'mission_number' | 'status'> & {
    branch_code?: string;
    rider?: Pick<Rider, 'id' | 'name'> | null;
  }) | null;
  items?: PreparationOrderItem[];
  created_at: string;
  prepared_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
}

export interface DispatcherOrderItinerary {
  id?: number;
  code: string;
  name: string;
  routing_index?: number;
  day_of_week?: number | null;
  frequency?: string;
  geo_area_id?: number | null;
  branch_id?: number;
  pivot?: {
    partner_code?: string;
    itinerary_id?: number;
    line_number?: number;
    rank?: number;
    is_stop_point?: boolean;
    visit_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    mileage?: number | null;
  };
}

export interface DispatcherOrderGeoArea {
  id?: number;
  code?: string;  // absent on embedded order geo_area (only present on full GeoArea objects)
  name: string;
  geo_area_type?: { code: string; name: string };
  parent?: { id?: number; code?: string; name: string };
}

export interface DispatcherOrderFinancialMetadata {
  is_credit_sale: boolean;
  payment_term_id?: number | null;
  // Returned by the detail endpoint only (/orders/{id}), not by the list (/orders/pending)
  payment_method?: string | null;
}

export interface DispatcherOrder {
  id: number;
  order_code: string;
  bc_status?: string;
  order_status?: string;
  payment_status?: string;
  canal?: string;
  total_amount: number | string;
  sub_total?: number | string;
  tax_amount?: number | string;
  order_date?: string;
  confirmed_at?: string;
  approved_at?: string;
  due_date?: string;
  branch_id?: number;
  branch_code?: string;
  partner_id?: number;
  delivery_mission_id?: number | null;
  salesperson_id?: number;
  /** Legacy field — prefer salesperson_data.salesperson */
  salesperson?: { id: number; name: string } | null;

  partner: {
    id?: number;
    code: string;
    name: string;
    address_line1?: string;
    geo_lat?: string | number | null;
    geo_lng?: string | number | null;
    delivery_zone?: string | null;
    geo_area_id?: number | null;       // raw FK — read geo_area object for display
    default_address_id?: number | null; // raw FK — ignore, read address_line1 instead
    geo_area?: DispatcherOrderGeoArea | null;
    active_itineraries?: DispatcherOrderItinerary[];
  };

  salesperson_data?: {
    salesperson?: {
      id?: number;
      name: string;
      code?: string;
      phone?: string;
    } | null;
  } | null;

  logistics_details?: {
    delivery_date?: string | null;
    pick_date?: string | null;
  } | null;

  financial_metadata?: DispatcherOrderFinancialMetadata | null;

  // Pre-computed totals written by CalculateDocumentPhysicalMetrics queued job (§20.2).
  // Null = job hasn't run yet for this order — treat as data_incomplete in capacity checks.
  total_weight_kg?: string | number | null;
  total_volume_m3?: string | number | null;
  physical_metrics_calculated_at?: string | null;

  order_products?: Array<{
    id: number;
    order_id?: number;
    product_id: number;
    quantity: number | string;          // backend returns string e.g. "20.0000"
    ordered_quantity?: number | string;
    allocated_quantity?: number | string;
    shortage_quantity?: number | string;
    price: number | string;             // unit price — backend returns string e.g. "66.94"
    total_price?: number | string;      // line total (quantity × price)
    final_price?: number | string;      // unit price after promo — prefer over price
    product?: {
      id: number;
      name: string;
      code?: string;
      sku?: string;
      thumbnail?: string | null;
    } & ProductLogistics;
  }>;
}

// ─── Delivery Mission — replaces DO + LOT + BCH/Shipment (docs §8, 2026-06-20) ────────────────
// A Delivery Mission is the dispatcher's drag&drop container — one zone/tour, one driver, one
// vehicle. Creating one also generates its BLs directly from the selected confirmed orders, in
// the same call (rider_id/vehicle_id required up front, unlike the old DO/BCH split).

export interface DeliveryMission {
  id: number;
  mission_number: string;
  branch_code: string;
  dispatcher_id?: number;
  // nullable since 2026-07-21 — auto-planned missions start without a rider (docs §17/§19.5)
  rider_id: number | null;
  vehicle_id: number;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  vehicle?: Vehicle | null;
  status: DeliveryMissionStatus;
  started_at?: string | null;
  closed_at?: string | null;
  delivery_date?: string | null;
  notes?: string | null;
  delivery_notes?: DeliveryNote[];
  bl_count?: number;
  preparation_order?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status' | 'items'> | null;
  // New 2026-07-21 — non-null when this mission was auto-created by the scheduler (docs §17/§19.5).
  // Use this to distinguish auto-planned missions from manually created ones (planning_run_id != null).
  planning_run_id?: number | null;
  // Explicit flag returned by GET /dispatcher/delivery-missions. Same signal as planning_run_id != null
  // but more legible. Auto-planned missions start with rider_id: null — prompt to assign before confirm.
  is_auto_planned?: boolean;
  // Populated by complete_delivery_mission (docs §8.5)
  total_bls?: number;
  delivered_bls?: number;
  failed_bls?: number;
  total_returns?: number;
  total_cod_collected?: number;
  delivery_rate?: number;
  created_at: string;
  _decisions?: DoDecisionItem[];
}

// ─── Mission Planning Templates (docs §19, new 2026-07-21) ───────────────────────────────────

export interface MissionPlanningCommercial {
  id: number;
  name: string;
  code?: string;
}

export interface MissionPlanningPartner {
  id: number;
  name: string;
  code?: string;
}

export interface MissionPlanningRun {
  id: number;
  template_id: number;
  delivery_mission_id: number | null;
  triggered_at: string;
  status: 'pending' | 'success' | 'failed' | 'skipped';
  orders_injected: number;
  error_message: string | null;
}

export interface MissionPlanningTemplate {
  id: number;
  name: string | null;
  branch_id: number;
  branch?: { id: number; code: string; name: string } | null;
  dispatcher_id: number;
  dispatcher?: { id: number; name: string } | null;
  is_active: boolean;
  // ISO day integers: 0=Sun, 1=Mon … 6=Sat. Empty array [] = every day.
  days_of_week: number[];
  trigger_time: string;
  // Pre-computed human label ("Lun, Mer, Ven à 04h00") — display directly, don't recompute.
  schedule_label: string;
  last_triggered_at: string | null;
  notes: string | null;
  commercials: MissionPlanningCommercial[];
  partners: MissionPlanningPartner[];
  last_run: MissionPlanningRun | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMissionPlanningTemplatePayload {
  name?: string;
  days_of_week?: number[];
  trigger_time: string;
  commercial_ids: number[];
  partner_ids: number[];
  notes?: string;
}

export interface UpdateMissionPlanningTemplatePayload {
  name?: string;
  is_active?: boolean;
  days_of_week?: number[];
  trigger_time?: string;
  // Full replacement — send all IDs to keep (backend does sync()).
  commercial_ids?: number[];
  partner_ids?: number[];
  notes?: string;
}

/** §19.7 — Calendar event returned by GET /dispatcher/mission-planning/calendar */
export interface MissionPlanningCalendarEvent {
  id: string;
  template_id: number;
  title: string;
  start: string;
  status: 'success' | 'failed' | 'skipped' | 'pending';
  type: 'past' | 'future';
  delivery_mission_id: number | null;
  orders_injected: number;
  schedule_label: string;
}

export interface CreateDeliveryMissionPayload {
  order_ids: number[];
  rider_id: number;
  vehicle_id: number;
  // Optional: omitted when the current user's branch can't be resolved client-side — the backend
  // derives it from the selected orders' branch_id when not supplied.
  branch_code?: string;
  notes?: string;
  // Planned delivery date for all BLs in this mission (YYYY-MM-DD).
  // Backend confirmed live 2026-06-24 — stored on delivery_missions.delivery_date,
  // propagated to each delivery_notes.delivery_date in the same call.
  delivery_date?: string;
}

/** `GET /backend/workflow/delivery-mission/{id}` response shape (docs §8.8) */
export interface DeliveryMissionDetailResponse {
  success: boolean;
  mission: DeliveryMission;
  delivery_notes: DeliveryNote[];
  preparation_order: Pick<PreparationOrder, 'id' | 'bp_number' | 'status' | 'items'> | null;
}

/** `GET /backend/dispatcher/delivery-missions/batch-preview` (docs §8.9) — virtual, nothing persisted */
export interface MissionBatchPreviewResponse {
  success: boolean;
  missions: Array<{
    id: number;
    mission_number: string;
    status: DeliveryMissionStatus;
    rider?: Rider | null;
    vehicle?: Pick<Vehicle, 'id' | 'plate_number'> | null;
    bp_id?: number | null;
    bp_number?: string | null;
  }>;
  products: Array<{
    product_id: number;
    product_name: string;
    total_requested: number;
    total_prepared: number;
    missions: Array<{ mission_id: number; bp_id: number; quantity: number }>;
  }>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DispatcherDashboardData {
  pipeline: {
    bc_confirmed: number;
    // 2026-06-20: replaces do_active/lot_open/lot_sealed/lot_in_preparation/bch_pending/
    // bch_in_preparation/bch_prepared (docs §5).
    missions_draft: number;
    missions_in_preparation: number;
    // New 2026-06-23, alongside the `awaiting_shortage_review` mission status itself — not yet in
    // docs §5 on disk, built directly off backend's chat description.
    missions_awaiting_shortage_review: number;
    missions_ready: number;
    missions_in_transit: number;
    bp_pending: number;
    bp_in_progress: number;
    bp_shortage_queue: number;
    bp_rejected: number;
    bl_draft: number;
    bl_confirmed: number;
    bl_ready: number;
    bl_loaded: number;
    bl_in_transit: number;
    delivered_today: number;
  };
  alerts: {
    shortage_queue: number;
    rejected_bps: number;
    overdue_deliveries: number;
  };
  activity: {
    recent_orders: Array<{
      id: number;
      order_code: string;
      bc_status: string;
      total_amount: string | number;
      order_date: string;
      partner_id: number;
      branch_id: number;
      partner: { id: number; name: string; code: string };
    }>;
    active_deliveries: Array<{
      id: number;
      delivery_number?: string;
      status?: string;
      livreur?: Rider | null;
    }>;
    recent_shortages: Array<{
      id: number;
      bp_number?: string;
      status?: BpStatus;
      total_shortage_percentage?: number;
      delivery_mission_id?: number | null;
      deliveryMission?: { id: number; mission_number: string; status: DeliveryMissionStatus } | null;
    }>;
  };
}

// ─── Paginated responses ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  // Flat Laravel pagination (most endpoints)
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  // Meta-wrapped pagination (orders/pending)
  meta?: {
    current_page: number;
    last_page?: number;
    per_page: number;
    total: number;
  };
}

// ─── Balance / Shortage ───────────────────────────────────────────────────────
// NOTE: `adjust_quantities` (the decision these types model) has NO delivery-mission equivalent
// as of the 2026-06-20 migration (docs §16 "Known gaps") — it was previously a bon-chargement
// (BCH) decision and BCH no longer exists. Kept here only because the Shortage Queue list itself
// (GET /backend/dispatcher/preparations/shortage-queue) still works; the "Save Balance" mutation
// UI must be disabled until backend ports an equivalent. Do not wire `adjust_quantities` calls.

export interface ShortageProductBalance {
  product_id: number;
  product_name: string;
  sku: string;
  total_requested: number;
  total_prepared: number;
  shortage: number;
  requesting_bls: Array<{
    bl_id: number;
    delivery_number: string;
    partner_name: string;
    requested: number;
    current_prepared: number;
    suggested_equal: number;
    suggested_fifo: number;
  }>;
}

export interface BalanceAnalysis {
  bp_id: number;
  bp_number: string;
  products: ShortageProductBalance[];
}

export interface BalanceAdjustment {
  bl_item_id: number;
  new_quantity: number;
  reason?: string;
}

// ─── Preparation shortage resolution (docs §10, fixed/verified live 2026-06-23) ────────────────
// 3 decisions on `bon-preparation`, all via POST /workflow/bon-preparation/{id}/execute:
// review_partial_preparation (analysis only) → accept_partial_preparation (auto-chains a backlog
// BC split) or request_rework (sends back to the magasinier). All three were broken/silently
// dropping their metadata fields before this fix — see DecisionActionsBar's FIELD_META and the
// `metadata` nesting convention already established for every other module.

export interface ReviewPartialPreparationOutput {
  bp_id: number;
  bp_status: BpStatus;
  mission_id?: number;
  analysis: {
    total_requested: number;
    total_prepared: number;
    total_shortage: number;
    shortage_percentage: number;
    shortage_value: number;
    is_critical: boolean;
    critical_items_count: number;
    shortage_items_count: number;
  };
  shortage_details: Array<{
    product_id: number;
    product_name: string;
    requested_quantity: number;
    prepared_quantity: number;
    shortage_quantity: number;
    unit_price: number;
    shortage_value: number;
    // New 2026-06-23 — every mission BL that ordered this product, with how much of *that BL's*
    // allocation could be cut. Raw material for accept_partial_preparation's now-required
    // `metadata.allocations` — the dispatcher chooses explicitly, no more system auto-split.
    // IMPORTANT: only returned by review_partial_preparation's own execution output — there is no
    // separate read endpoint, so this is lost if the page reloads after review but before accept.
    affected_bls: Array<{
      bl_id: number;
      delivery_number: string;
      partner_id: number;
      partner_name: string;
      bl_item_id: number;
      allocated_quantity: number;
    }>;
  }>;
  critical_items: unknown[];
  recommended_action: 'accept_and_split' | 'request_rework' | string;
  available_actions: Array<{ action: string; decision: string; label: string; available: boolean }>;
  decision_guidance?: string;
}

export interface AcceptPartialPreparationOutput {
  bp_id: number;
  bp_status: BpStatus;
  mission_id?: number;
  total_prepared: number;
  total_shortage: number;
  shortage_percentage: number;
  accepted_items: Array<{ product_id: number; product_name: string; prepared_quantity: string | number; shortage_quantity: string | number; shortage_reason?: string }>;
  acceptance_reason: string;
  next_actions?: Record<string, string>;
  // Nested result of the auto-chained split_remaining_quantity — the BP actually ends at
  // shortage_split_done, not shortage_accepted (that status is only observable mid-transaction).
  backlog?: {
    bp_status: BpStatus;
    original_bls_count: number;
    backlog_orders_count: number;
    backlog_orders: Array<{ id: number; order_code: string; parent_order_id?: number; parent_order_code?: string; items_count: number; total_quantity: number }>;
    total_shortage_released: number;
    // `pending` (not null) once every BL on the mission is settled — same WT gate as the
    // no-shortage path (§2/§12c): stock still untouched until the rider accepts the transfer.
    warehouse_transfer?: { id: number; transfer_number: string; status: string } | null;
    message?: string;
  };
}

export interface RequestReworkOutput {
  bp_id: number;
  bp_status: BpStatus;
  mission_id?: number;
  rework_count: number;
  rework_reason: string;
  shortage_items: Array<{ product_id: number; product_name: string; shortage_quantity: number; shortage_reason?: string }>;
  message?: string;
}

// GET /dispatcher/preparations/shortage-queue's own envelope is {success, ui, data} (raw
// paginator under data) — different from the {success, message, decision, output} decision
// envelope used everywhere else, since it's a plain listing route, not a decision execution.
export interface ShortageQueueResponse {
  success: boolean;
  ui?: { fr?: { title?: string; description?: string; status_labels?: Record<string, string> } };
  data: PaginatedResponse<PreparationOrder>;
}

// ─── Warehouse Transfer (WT) ─────────────────────────────────────────────────
// 2026-06-20: WT creation is now 100% automatic (WarehouseTransferService::createFromMission(),
// called by complete_preparation the moment a mission's BP completes) — there is no longer any
// dispatcher-triggered "create" endpoint (the old `from-bch/{bchId}` is gone, and there is no
// `from-mission` replacement either). The dispatcher only ever reads/accepts/rejects a WT.

export interface WarehouseTransferItem {
  id: number;
  product_id: number;
  product_code?: string;
  product_name?: string;
  requested_quantity: number;
  transferred_quantity?: number;
  delivered_quantity?: number;
  returned_quantity?: number;
  unit_price: number;
  delivery_note_id?: number | null;
  sales_group_code?: string | null;
  product?: { id: number; name: string };
}

export interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  status: TransferStatus;
  // Replaces shipment_id (BCH) — a WT is now keyed by the mission it came from.
  delivery_mission_id?: number | null;
  delivery_mission?: { id: number; mission_number: string; delivery_notes?: Array<{ id: number; partner?: { id: number; name: string } }> } | null;
  rider_id?: number | null;
  livreur_emplacement_code?: string | null;
  from_warehouse?: string | null;
  to_warehouse?: string | null;
  from_storage_location_id?: number | null;
  to_storage_location_id?: number | null;
  transfer_type?: string;
  progress_level?: number;
  synced_to_erp?: boolean;
  accepted_by?: number | { id: number; name: string } | null;
  accepted_at?: string | null;
  notes?: string | null;
  livreur?: { id: number; name: string };
  items?: WarehouseTransferItem[];
  loading_request_id?: number | null;
  decharge_reconciliation_request_id?: number | null;
  period_id?: number | null;
  created_at: string;
}

// ─── Décharges ────────────────────────────────────────────────────────────────
// docs §11: list/approve/reject still work, but the `bonChargement`/`bon_chargement` nested field
// references a dropped table (Shipment) and may throw or be absent on read — render defensively,
// don't hard-depend on it.

export interface DechargeItem {
  id: number;
  product_id?: number;
  product_name?: string;
  delivered_quantity?: number;
  returned_quantity?: number;
  return_reason?: string;
}

export interface Decharge {
  id: number;
  decharge_number?: string;
  type?: string;
  status?: string;
  comment?: string;
  reason?: string;
  delivery_note?: Pick<DeliveryNote, 'id' | 'delivery_number' | 'status'> | null;
  /** Confirmed broken (docs §11) — references a dropped table, may be absent/throw. Optional chain everywhere. */
  bon_chargement?: { id: number; shipment_number?: string; status?: string } | null;
  partner?: { id: number; name: string; code: string } | null;
  rider?: Rider | null;
  created_at?: string;
  items?: DechargeItem[];
}

// ─── Workflow responses ───────────────────────────────────────────────────────

export interface ApiSuccessResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  // Most decisions in the new mission pipeline return their payload under `output`
  // (e.g. { mission_id, status, allocation_rate, ... } — see docs §8 examples).
  output?: Record<string, unknown>;
}

export interface WorkflowConstraint {
  name: string;
  reason: string;
  context?: Record<string, unknown>;
}

export interface WorkflowBlockedResponse {
  success: false;
  message: string;
  constraints: WorkflowConstraint[];
}

// ─── Request payloads ─────────────────────────────────────────────────────────

export interface SaveBalancePayload {
  decision: 'adjust_quantities';
  split_strategy: SplitStrategy;
  adjustments?: BalanceAdjustment[];
}

export interface SplitBlPayload {
  decision: 'split_delivery';
  splits: Array<{ label?: string; item_ids: number[] }>;
}

export interface CancelBlPayload {
  decision: 'cancel_delivery';
  reason: string;
}

export interface UpdateBlPayload {
  decision?: 'update_delivery';
  delivery_date?: string;
  rider_id?: number;
  notes?: string;
}

// `confirm_delivery_mission` output shape — backend breaking change 2026-06-22: the old per-BL
// `allocate_delivery_note` (POST /bon-livraisons/{id}/allocate) and `generate_preparation_for_
// mission` decisions are both REMOVED. confirm_delivery_mission now does both atomically in one
// call: reserves stock for every BL on the mission (same shortage-tolerant semantics the old
// allocate had — never fails on shortage, creates backlog orders instead) and generates the BP.
// Mission goes draft → in_preparation directly; the intermediate "confirmed" mission status never
// existed as a real state and must not be tested for anywhere in the UI.
export interface ConfirmDeliveryMissionOutput {
  allocations: Array<{
    delivery_note_id: number;
    delivery_number: string;
    status: BlStatus;
    total_ordered: number;
    total_allocated: number;
    allocation_rate: number;
    backlog_orders: Array<{ id: number; order_code: string; bc_status: string }>;
    backlog_orders_count: number;
  }>;
  preparation: {
    id: number;
    bp_number: string;
    status: string;
  };
}

// Decision keys for the `delivery-mission` model type (docs §16) — generic naming on the shared
// fields (DecisionItem/DecisionsResponse) is historical (originally modeled on the old DO
// decisions) but the shape is model-agnostic and reused as-is for missions/BLs/etc.
export type DeliveryMissionDecisionKey =
  | 'create_delivery_mission'
  // confirm_delivery_mission (2026-06-22) replaces allocate_delivery_note + generate_preparation_
  // for_mission — one atomic call: reserves stock for every BL, generates the BP, draft →
  // in_preparation directly. See ConfirmDeliveryMissionOutput for its output shape.
  | 'confirm_delivery_mission'
  | 'reopen_delivery_mission'
  | 'start_delivery_mission'
  | 'complete_delivery_mission'
  | 'update_delivery_mission'
  | 'cancel_delivery_mission';

export type DoDecisionFieldType = 'text' | 'number' | 'date' | 'textarea' | 'boolean';

export interface DoDecisionField {
  name: string;
  type: DoDecisionFieldType;
  label: string;
  required: boolean;
}

export interface DoDecisionItem {
  decision: DeliveryMissionDecisionKey | string;
  label: string;
  description?: string;
  intent?: 'EDIT' | 'VALIDATE' | 'DISPATCH' | 'DELETE' | string;
  confirm: boolean;
  danger: boolean;
  fields: DoDecisionField[];
}

export interface DoDecisionsResponse {
  success: boolean;
  model_type: string;
  model_id: number;
  current_state?: string | null;
  current_step_name?: string | null;
  workflow_status?: string | null;
  decisions: DoDecisionItem[];
}

export interface WorkflowContextResponse<TDetail> {
  model_status: string;
  shortage_phase?: string | null;
  model_detail_url?: string;
  detail: TDetail;
  decisions: DoDecisionItem[];
  _links?: {
    self?: string;
    decisions?: string;
    execute?: string;
    history?: string;
  };
}

export interface OrdersPendingFilters {
  search?: string;
  page?: number;
  per_page?: number;
  // Geography
  geo_area_id?: number;
  delivery_zone?: string;
  itinerary_id?: number;
  // People
  salesperson_id?: number;
  branch_id?: number;
  // Dates
  date_from?: string;
  date_to?: string;
  // Map bbox
  lat_min?: number;
  lat_max?: number;
  lng_min?: number;
  lng_max?: number;
  // Sort
  sort_by?: 'order_date' | 'total_amount' | 'created_at';
  sort_dir?: 'asc' | 'desc';
}
