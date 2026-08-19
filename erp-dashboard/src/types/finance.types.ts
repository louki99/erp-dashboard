export type JournalType = 'AGENT_CASH' | 'BANK_ACCOUNT' | string;

export interface Journal {
  id: number;
  code: string;
  // 'BANK_ACCOUNT' = company bank/deposit account (user is null, scoped to a branch);
  // otherwise a personal agent cash register. May be absent on legacy rows.
  type?: JournalType;
  method_suffix: 'ESP' | 'CHQ' | 'EFF' | 'VIR' | 'VER';
  currency: string;
  cached_balance: string;
  is_active: boolean;
  // null for a BANK_ACCOUNT journal.
  user: { id: number; name: string; code: string; branch_id: number | null } | null;
  branch?: { id: number; code: string; name: string } | null;
  bank_name?: string | null;
  rib?: string | null;
  computed_balance: number;
  transit_balance: number;
  available_balance: number;
}

export interface LedgerEntry {
  id: number;
  transfer_id: number;
  journal_code: string;
  compte_comptable: string;
  debit_amount: string;
  credit_amount: string;
  date_comptable: string;
  libelle: string;
  period: { id: number; code: string } | null;
}

export interface LedgerTotals {
  total_debit: number;
  total_credit: number;
}

export type TransferStatus = 2 | 3 | 4 | 5; // REQUESTED | ACCEPTED | REJECTED | CANCELLED

export interface Transfer {
  id: number;
  status: TransferStatus;
  amount: string;
  currency: string;
  transfer_type: 'DIRECT' | 'BANK_DEPOSIT' | null;
  versement_reference: string | null;
  versement_photo_path: string | null;
  // Ready-to-display URL for the deposit receipt (use for <img src>); distinct from
  // versement_photo_path which is the raw storage path, not displayable.
  versement_photo_url: string | null;
  bank_name: string | null;
  deposit_date: string | null;
  intake_line_id: number | null;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  // Verified live 2026-08-18: the real field names are snake_case
  // (source_journal/dest_journal), not the sourceJournal/destJournal this
  // type originally declared — that mismatch crashed TransferDetail
  // (`transfer.sourceJournal.code` on `undefined`) on every real transfer.
  source_journal: { id: number; code: string; method_suffix: string };
  dest_journal: { id: number; code: string; method_suffix: string };
  // Also verified live: the API only ever returns a bare `created_by` id,
  // never a nested user object — there is no name available to display.
  created_by: number;
}

// Clôture de caisse (Z de caisse) — built 2026-08-21 (§16). One row per
// (journal, business_date). Verified live: `business_date`/`opened_at`/
// `closed_at` come back as full UTC datetimes even though business_date is
// conceptually a plain date — format with the same fmtDate helper used
// elsewhere, don't assume a bare YYYY-MM-DD string.
export type TreasuryClosureStatus = 'OPEN' | 'CLOSED';

export interface JournalClosure {
  id: number;
  journal_id: number;
  business_date: string;
  status: TreasuryClosureStatus;
  opening_balance: string;
  // Only present once CLOSED.
  theoretical_closing_balance?: string;
  counted_balance?: string;
  // counted_balance - theoretical_closing_balance — positive = surplus, negative = shortage.
  discrepancy?: string;
  notes?: string | null;
  opened_by: number;
  opened_at: string;
  closed_by?: number;
  closed_at?: string;
  // Correction (§16, built 2026-08-22) — POST .../closures/{closure}/correct.
  // original_counted_balance/original_discrepancy are set ONCE, on the first
  // correction only (survive every later correction unchanged) — read them
  // to show "corrigé, valeur d'origine : X" rather than the current values.
  correction_count?: number;
  original_counted_balance?: string;
  original_discrepancy?: string;
  last_corrected_by?: number;
  last_corrected_at?: string;
  last_correction_reason?: string;
}

// Encaissements — every settlement that filled a given caisse, traceable
// back to order_id. Verified live 2026-08-22 (`GET /finance/intake-lines?
// journal_id=X`): amount/status are the raw API types (amount is a string
// like everywhere else in this API; status is a bare numeric code, no enum
// documented — display it as-is rather than guessing a label mapping).
export interface IntakeLine {
  id: number;
  journal_id: number;
  order_id: number | null;
  amount: string;
  status: number;
  payment_method: string;
  note: string | null;
  created_by: number;
  created_at: string;
  journal?: { id: number; code: string; method_suffix: string; user_id: number | null };
}

// Full operations trail for one journal (every intake, transfer
// request/approve/reject, auth check, caisse open/close/correct).
// Verified live: `created_at` here is a plain "YYYY-MM-DD HH:mm:ss" string,
// NOT the ISO 8601 the rest of this API uses elsewhere — still parses fine
// via `new Date()`/the shared formatDateTime helper, just don't assume the
// `T`/`Z` shape if this field is ever read raw. `metadata` shape varies by
// `operation_type`, treat it as opaque/display-only.
export interface AuditLogEntry {
  id: number;
  operation_type: string;
  journal_code: string;
  transfer_id: number | null;
  user_id: number;
  amount: string | null;
  previous_state: string | null;
  new_state: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Settlement {
  id: number;
  status: string;
  expected_cash_total: number;
  counted_cash_total: number | null;
  cash_difference: number | null;
  notes: string | null;
  reconciled_at: string | null;
  vendor_personal_debt_balance?: number;
  vendor?: { id: number; name: string; code?: string };
  work_session?: { id: number; date?: string };
  debtMovements?: any[];
}
