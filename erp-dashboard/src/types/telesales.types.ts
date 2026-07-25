// Types for the Télévendeur (Tele-Sales) module — Lot 1: Admin/Superviseur screens.
// Base URL: /api/backend/admin/telesales/... — role admin|root only.
// Ref: docs/TeleSales_UI_Integration_Spec.md §7.

export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
}

export type TeleVisitOutcome =
    | 'ORDER_TAKEN'
    | 'UNAVAILABLE'
    | 'COMPLAINT'
    | 'NO_ANSWER'
    | 'BUSY'
    | 'RESTOCK_NEEDED';

export const TELE_VISIT_OUTCOME_LABELS: Record<TeleVisitOutcome, string> = {
    ORDER_TAKEN: 'Prise de commande',
    UNAVAILABLE: 'Client indisponible',
    COMPLAINT: 'Réclamation client',
    NO_ANSWER: 'Pas de réponse',
    BUSY: 'Occupé',
    RESTOCK_NEEDED: 'Reconstitution de stock',
};

export interface TeleVisitPartner {
    id: number;
    code: string;
    name: string;
    phone?: string | null;
}

export interface TeleVisit {
    id: number;
    user_id: number;
    partner_id: number;
    tele_sales_session_id: number | null;
    order_id: number | null;
    is_planned: boolean;
    scheduled_at: string | null;
    started_at: string | null;
    ended_at: string | null;
    outcome: TeleVisitOutcome | null;
    notes: string | null;
    partner?: TeleVisitPartner;
    user?: { id: number; name: string; email?: string };
}

// ─── §7.1 — POST /schedules ──────────────────────────────────────────────────

export interface CreateScheduleRequest {
    user_id: number;
    partner_id: number;
    scheduled_at: string; // "YYYY-MM-DD HH:mm:ss"
    notes?: string;
}

export interface CreateScheduleResponse extends ApiSuccessResponse {
    visit: TeleVisit;
}

// ─── GET /schedules (fix landed 2026-08 — was write-only before) ────────────

export interface SchedulesListFilters {
    user_id?: number;
    date_from?: string;
    date_to?: string;
}

export interface SchedulesListResponse extends ApiSuccessResponse {
    visits: TeleVisit[];
    pagination?: { current_page: number; total_pages: number; total: number; per_page: number };
}

// ─── §7.2 — POST /schedules/bulk ─────────────────────────────────────────────

export interface BulkScheduleEntry {
    user_id: number;
    partner_id: number;
    scheduled_at: string;
    notes?: string;
}

export interface BulkScheduleRequest {
    entries: BulkScheduleEntry[];
}

export interface BulkScheduleResponse {
    success: boolean;
    created_count: number;
    error_count: number;
    created: { index: number; visit_id: number }[];
    errors: { index: number; message: string }[];
}

// ─── §7.3 — DELETE /schedules/{id} ───────────────────────────────────────────

export type DeleteScheduleResponse = ApiSuccessResponse;

// ─── §7.4 — POST /assignments ────────────────────────────────────────────────

export interface CreateAssignmentRequest {
    user_id: number;
    partner_ids: number[];
}

export interface TelesalesAssignment {
    id: number;
    partner_id: number;
    user_id: number;
    assigned_by: number;
    assigned_at: string;
}

export interface CreateAssignmentResponse extends ApiSuccessResponse {
    assignments: TelesalesAssignment[];
}

// ─── GET /assignments (fix landed 2026-08 — was write-only before) ──────────
// Partner/agent joined server-side per the 2026-08 update — no extra round-trip needed.

export interface AssignmentsListFilters {
    user_id?: number;
}

export interface TelesalesAssignmentJoined extends TelesalesAssignment {
    partner?: TeleVisitPartner;
    user?: { id: number; name: string; email?: string };
}

export interface AssignmentsListResponse extends ApiSuccessResponse {
    assignments: TelesalesAssignmentJoined[];
}

// ─── §7.5 — GET /monitoring/sessions ─────────────────────────────────────────

export type TelesalesSessionStatus = 'active' | 'paused' | 'ended';

export interface TelesalesMonitoringSession {
    session_id: number;
    user: { id: number; name: string; email: string };
    status: TelesalesSessionStatus;
    started_at: string;
    paused_at: string | null;
    total_paused_seconds: number;
    elapsed_seconds: number;
}

export interface MonitoringSessionsResponse extends ApiSuccessResponse {
    sessions: TelesalesMonitoringSession[];
}

// ─── §7.6 — GET /monitoring/kpis ─────────────────────────────────────────────

export interface TelesalesAgentSales {
    user_id: number;
    user_name: string;
    orders_count: number;
    total_sales: number;
}

export interface MonitoringKpisResponse extends ApiSuccessResponse {
    period: { from: string; to: string };
    outcomes: Record<TeleVisitOutcome, number>;
    total_qualified_calls: number;
    conversion_rate_percent: number;
    sales_by_agent: TelesalesAgentSales[];
}

// ─── Agent (télévendeur user) lookup — via rbacApi.getUsers({ role: 'televendeur' }) ─

export interface TelesalesAgentOption {
    id: number;
    name: string;
    email?: string;
}
