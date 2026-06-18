// ─── Status enums ─────────────────────────────────────────────────────────────

export type BlStatus =
  | 'draft'
  | 'confirmed'
  | 'batched'
  | 'submitted_to_magasinier'
  | 'in_preparation'
  | 'ready'
  | 'loaded'
  | 'in_transit'
  | 'delivered'
  | 'partially_delivered'
  | 'returned'
  | 'cancelled';

export type BchStatus =
  | 'pending'
  | 'in_preparation'
  | 'prepared'
  | 'validated'
  | 'loaded'
  | 'in_transit'
  | 'completed'
  | 'cancelled';

export type BpStatus =
  | 'pending'
  | 'in_progress'
  | 'completed_full'
  | 'completed_partial'
  | 'shortage_accepted'
  | 'awaiting_shortage_review'
  | 'partial_rework_requested'
  | 'shortage_split_done'
  | 'rejected';

// Two separate, non-intersecting pipelines share this enum (docs §2, confirmed by backend
// 2026-06-16): Pipeline 1 (LOT path) uses draft/pending_allocation/allocated/
// partially_allocated/validated; Pipeline 2 (Dispatch V2) uses draft/pending_allocation/
// optimized/in_preparation/prepared/ready_for_loading/dispatched. A DO follows one or the
// other, never both — don't treat this as one linear chain.
export type DoStatus =
  | 'draft'
  | 'pending_allocation'
  | 'allocated'
  | 'partially_allocated'
  | 'validated'
  | 'optimized'
  | 'in_preparation'
  | 'prepared'
  | 'ready_for_loading'
  | 'dispatched'
  | 'cancelled'
  | 'rejected';

// LOT lifecycle is just open → sealed (create_batch/seal_batch) — no ready/in_progress/completed
// states exist on LogisticsBatch (docs §12).
export type BatchStatus = 'open' | 'sealed';

// Aspirational/unwired — no decision, controller, or route populates DeliveryMission yet (docs §12b).
export type DeliveryMissionStatus = 'created' | 'started' | 'closed';

// Real status values from code (docs §12c, corrected 2026-06-17) — the previously documented
// 7-status ship/receive lifecycle doesn't exist; no ship/in_transit/receive transitions anywhere
// in WarehouseTransferService or the controller.
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
  /** Returned on DO detail (`deliveryOrder.vehicle`) instead of `plate` */
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
  // usable_volume_ratio/loading_efficiency_ratio/capacity_length/width/height confirmed by
  // backend 2026-06-18 to now be returned by BOTH `GET /backend/dispatcher/vehicles` (§12) and
  // `GET /backend/riders/with-vehicles` (§12d) — full parity, no longer with-vehicles-only.
  usable_volume_ratio?: number;
  loading_efficiency_ratio?: number;
  fuel_type?: string;
  // Confirmed by backend 2026-06-18 — real column on `vehicles`, now selected by
  // `GET /backend/dispatcher/vehicles` (previously omitted from the query, not a missing column).
  cold_chain_enabled?: boolean;
  notes?: string | null;
  display_name?: string;
  status?: string;
  branch_code?: string;
  // Added by backend 2026-06-17 (docs §12d "Active-shipment guard on unassign") on all 3
  // vehicle-listing endpoints — true when the vehicle/its rider is linked to a non-terminal
  // shipment (pending/in_preparation/prepared/validated/loaded/in_transit). `unassignRider` 422s
  // when this is true; use it to disable "Retirer" proactively instead of waiting for the error.
  has_active_shipments?: boolean;
}

// ─── Fleet & Rider Master Data (docs §12d, verified against real code 2026-06-17) ────────────

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
  quantity: number;
  allocated_qty: number;
  prepared_quantity?: number | null;
  unit_price: number;
  total_price: number;
  product: { id: number; name: string; sku: string };
}

export interface DeliveryNote {
  id: number;
  delivery_number: string;
  status: BlStatus;
  total_amount: number;
  delivery_date?: string | null;
  notes?: string | null;
  branch_code: string;
  is_quantity_locked: boolean;
  partner: { id: number; name: string; code: string };
  order?: { id: number; order_code: string; bc_status: string } | null;
  rider?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  items?: DeliveryNoteItem[];
  bon_chargement?: Pick<Shipment, 'id' | 'shipment_number' | 'status'> | null;
  preparation?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  created_at: string;
}

export interface Shipment {
  id: number;
  shipment_number: string;
  status: BchStatus;
  branch_code: string;
  has_shortage: boolean;
  shortage_acknowledged: boolean;
  notes?: string | null;
  estimated_departure?: string | null;
  rider?: Rider | null;
  /** Alias used for `rider` on the DO detail's `bchs[]` (docs §9) */
  livreur?: Rider | null;
  dispatcher?: { id: number; name: string } | null;
  vehicle?: Vehicle | null;
  delivery_notes?: DeliveryNote[];
  delivery_notes_count?: number;
  preparation_order?: PreparationOrder | null;
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
}

export interface PreparationOrder {
  id: number;
  bp_number: string;
  status: BpStatus;
  total_shortage_percentage?: number;
  is_critical_shortage?: boolean;
  shortage_acknowledged: boolean;
  preparation_efficiency?: number | null;
  magasinier?: { id: number; name: string } | null;
  shipment?: Pick<Shipment, 'id' | 'shipment_number' | 'status' | 'has_shortage'> | null;
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
    delivery_order_id?: number | null;
  } | null;

  financial_metadata?: DispatcherOrderFinancialMetadata | null;

  order_products?: Array<{
    id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    total_price?: number;
    product?: { id: number; name: string; sku: string };
  }>;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export interface DispatcherDashboardData {
  pipeline: {
    bc_confirmed: number;
    do_active: number;
    lot_open: number;
    lot_sealed: number;
    lot_in_preparation: number;
    bp_pending: number;
    bp_in_progress: number;
    bp_shortage_queue: number;
    bp_rejected: number;
    bl_draft: number;
    bl_confirmed: number;
    bl_ready: number;
    bch_pending: number;
    bch_in_preparation: number;
    bch_prepared: number;
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
      shipment_number?: string;
      status?: string;
      rider?: Rider | null;
    }>;
    recent_shortages: Array<{
      id: number;
      bp_number?: string;
      status?: BpStatus;
      shipment?: { id: number; shipment_number: string };
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

export interface BchIndexResponse {
  bch: PaginatedResponse<Shipment>;
  stats: {
    total: number;
    pending: number;
    in_preparation: number;
    prepared: number;
    completed: number;
  };
}

// ─── Balance / Shortage ───────────────────────────────────────────────────────

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
  bch_id: number;
  shipment_number: string;
  products: ShortageProductBalance[];
}

export interface BalanceAdjustment {
  bl_item_id: number;
  new_quantity: number;
  reason?: string;
}

// ─── Logistics Batch (LOT) ───────────────────────────────────────────────────

export interface LogisticsBatch {
  id: number;
  batch_number: string;
  status: BatchStatus;
  branch_code: string;
  dispatcher?: { id: number; name: string };
  sealed_at?: string | null;
  preparation_order_id?: number | null;
  delivery_notes?: DeliveryNote[];
  preparation_order?: Pick<PreparationOrder, 'id' | 'bp_number' | 'status'> | null;
  notes?: string | null;
  created_at: string;
}

export interface CreateBatchPayload {
  delivery_order_ids: number[];
  // Optional: omitted when the current user's branch can't be resolved client-side — the backend
  // can derive it from the delivery orders' own branch when not supplied.
  branch_code?: string;
}

export interface UpdateBatchPayload {
  add_delivery_order_ids?: number[];
  remove_delivery_order_ids?: number[];
  notes?: string;
}

// ─── Delivery Mission (DM) — schema exists, NOT wired to any decision/controller/route ────
// See [LOOSE END / FUTURE TODO GAP] in docs §12b. Do not build a frontend screen against this yet.

export interface DeliveryMission {
  id: number;
  mission_number: string;
  status: DeliveryMissionStatus;
  rider_id: number;
  shipment_id: number;
  vehicle_id?: number | null;
  branch_code: string;
  started_at?: string | null;
  closed_at?: string | null;
  van_stock_reconciled: boolean;
  cod_reconciled: boolean;
  returns_reconciled: boolean;
  total_bls?: number | null;
  delivered_bls?: number | null;
  failed_bls?: number | null;
  total_returns?: number | null;
  total_cod_collected?: number | null;
}

// ─── Warehouse Transfer (WT) ─────────────────────────────────────────────────
// Rewritten 2026-06-17 against backend's correction (docs §12c) — the previous shape
// (source_branch_id/destination_branch_id/items[] free-form creation) was fabricated. A WT moves
// stock from the main warehouse to a rider's van, created only from a completed BCH
// (`from-bch/{bchId}`) — there is no manual/arbitrary branch-to-branch creation endpoint.

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
  stock_batch_id?: number | null;
  batch_number?: string | null;
  expiry_date?: string | null;
  sales_group_code?: string | null;
  product?: { id: number; name: string };
}

export interface WarehouseTransfer {
  id: number;
  transfer_number: string;
  status: TransferStatus;
  shipment_id?: number | null;
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
  bon_chargement?: { id: number; shipment_number: string; delivery_notes?: Array<{ id: number; partner?: { id: number; name: string } }> };
  livreur?: { id: number; name: string };
  items?: WarehouseTransferItem[];
  delivery_mission_id?: number | null;
  loading_request_id?: number | null;
  decharge_reconciliation_request_id?: number | null;
  period_id?: number | null;
  created_at: string;
}

// ─── Delivery Order (DO) ─────────────────────────────────────────────────────

export interface DeliveryOrder {
  id: number;
  do_number: string;
  status: DoStatus;
  branch_code?: string;
  planned_delivery_date: string;
  delivery_zone?: string | null;
  itinerary_id?: number | null;
  allocation_run_id?: number | null;
  created_by?: number | null;
  validated_by?: number | null;
  validated_at?: string | null;
  orders_count: number;
  products_count?: number;
  total_ordered_amount: number | string;
  total_allocated_amount?: number | string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  company_id?: number;
  logistics_batch_id?: number | null;
  driver_id?: number | null;
  vehicle_id?: number | null;
  dispatched_bch_id?: number | null;
  optimized_by?: number | null;
  optimized_at?: string | null;
  dispatched_by?: number | null;
  dispatched_at?: string | null;
  period_id?: number | null;
  /** Populated only when eager-loaded (not present in list response) */
  driver?: Rider | null;
  vehicle?: Vehicle | null;
  logistics_batch?: Pick<LogisticsBatch, 'id' | 'batch_number' | 'status'> | null;
  itinerary?: { id: number; code: string; name: string } | null;
  items?: Array<{
    id: number;
    product_id: number;
    product?: { id: number; name: string; sku: string };
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  orders?: Array<Pick<DispatcherOrder, 'id' | 'order_code' | 'bc_status' | 'total_amount' | 'partner'>>;
  delivery_notes?: Array<Pick<DeliveryNote, 'id' | 'delivery_number' | 'status' | 'total_amount' | 'partner'>>;
  shipments?: Array<Pick<Shipment, 'id' | 'shipment_number' | 'status'>>;
  /** Sibling fields from the detail envelope (`{data:{deliveryOrder, batches, bchs}}`), merged in by getById */
  batches?: LogisticsBatch[];
  bchs?: Shipment[];
  created_at?: string;
  updated_at?: string;
}

/** Real backend wraps the list in `{ success, data: { deliveryOrders: <paginated> } }` */
export interface DeliveryOrdersListEnvelope {
  success?: boolean;
  data?: {
    deliveryOrders?: PaginatedResponse<DeliveryOrder>;
  };
}

/** Backend wraps the detail as `{ success, data: { deliveryOrder, batches, bchs } }` (see docs §9) */
export interface DeliveryOrderDetailEnvelope {
  success?: boolean;
  data?: {
    deliveryOrder?: DeliveryOrder;
    batches?: LogisticsBatch[];
    bchs?: Shipment[];
  };
}

// ─── Décharges ────────────────────────────────────────────────────────────────

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
  shipment?: Pick<Shipment, 'id' | 'shipment_number' | 'status'> | null;
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

export interface CreateBchPayload {
  decision: 'create_bch';
  bl_ids: number[];
  rider_id?: number;
  vehicle_id?: number;
  planned_date?: string;
  notes?: string;
}

export interface UpdateBchPayload {
  decision: 'update_bch';
  rider_id?: number;
  planned_date?: string;
  notes?: string;
}

export interface CancelBchPayload {
  decision: 'cancel_bch';
  reason: string;
}

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

export interface CreateDoPayload {
  order_ids: number[];
  delivery_zone?: string;
  planned_delivery_date?: string;
  itinerary_id?: number;
  notes?: string;
}

export type DoDecisionKey =
  | 'create_delivery_order'
  | 'update_delivery_order'
  | 'validate_delivery_order'
  | 'optimize_do'
  | 'start_do_preparation'
  | 'complete_do_preparation'
  | 'generate_bch_from_dos'
  | 'delete_delivery_order';

export type DoDecisionFieldType = 'text' | 'number' | 'date' | 'textarea';

export interface DoDecisionField {
  name: string;
  type: DoDecisionFieldType;
  label: string;
  required: boolean;
}

export interface DoDecisionItem {
  decision: DoDecisionKey | string;
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
