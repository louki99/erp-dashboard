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

export type BpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed_full'
  | 'completed_partial'
  | 'shortage_accepted'
  | 'awaiting_shortage_review'
  | 'rejected';

// docs §3 "Delivery Mission statuses" — the new top-level pipeline status.
export type DeliveryMissionStatus =
  | 'draft'
  | 'in_preparation'
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
  last_name?: string;
  phone?: string;
  email?: string;
  branch_code?: string;
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
  // Replaces the old `shipment` (Shipment/BCH) field — a BP now belongs to a mission.
  delivery_mission_id?: number | null;
  mission?: Pick<DeliveryMission, 'id' | 'mission_number' | 'status'> | null;
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
  code: string;
  name: string;
  geo_area_type?: { code: string; name: string };
  parent?: { id?: number; code: string; name: string };
}

export interface DispatcherOrderFinancialMetadata {
  id?: number;
  order_id?: number;
  is_credit_sale: boolean;
  payment_term_id?: number | null;
  payment_method?: string | null;
  stamp_duty?: string | number | null;
  avoir_id?: number | null;
  approved_by?: number | null;
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
  salesperson_id?: number;
  /** Legacy field — prefer salesperson_data.salesperson */
  salesperson?: { id: number; name: string } | null;

  partner: {
    id?: number;
    code: string;
    name: string;
    city?: string;
    address?: string;
    geo_lat?: string | number | null;
    geo_lng?: string | number | null;
    delivery_zone?: string | null;
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

  order_products?: Array<{
    id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price?: number;
    product?: { id: number; name: string; sku: string } & ProductLogistics;
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
  rider_id: number;
  vehicle_id: number;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  vehicle?: Vehicle | null;
  status: DeliveryMissionStatus;
  started_at?: string | null;
  closed_at?: string | null;
  notes?: string | null;
  delivery_notes?: DeliveryNote[];
  bl_count?: number;
  preparation_order?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status' | 'items'> | null;
  // Populated by complete_delivery_mission (docs §8.5)
  total_bls?: number;
  delivered_bls?: number;
  failed_bls?: number;
  total_returns?: number;
  total_cod_collected?: number;
  delivery_rate?: number;
  created_at: string;
}

export interface CreateDeliveryMissionPayload {
  order_ids: number[];
  rider_id: number;
  vehicle_id: number;
  // Optional: omitted when the current user's branch can't be resolved client-side — the backend
  // derives it from the selected orders' branch_id when not supplied.
  branch_code?: string;
  notes?: string;
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
  | 'start_delivery_mission'
  | 'complete_delivery_mission'
  | 'update_delivery_mission'
  | 'cancel_delivery_mission';

export type DoDecisionFieldType = 'text' | 'number' | 'date' | 'textarea';

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
