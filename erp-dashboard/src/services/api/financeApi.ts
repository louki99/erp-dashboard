import apiClient from './client';
import type { Journal, LedgerEntry, LedgerTotals, Transfer, Settlement, JournalClosure, TreasuryClosureStatus, IntakeLine, AuditLogEntry } from '@/types/finance.types';

const FINANCE_BASE = '/api/backend/finance';

export interface FinanceHelperUser {
  id: number;
  name: string;
  code: string;
  email?: string;
  branch_id?: number;
}

export interface FinanceHelperBranch {
  id: number;
  code: string;
  name: string;
}

export const financeApi = {
  // ==================== Journals ====================
  getJournals: async (params?: {
    branch_id?: number;
    user_id?: number;
    type?: string;
    method_suffix?: string;
    active_only?: boolean;
    search?: string;
    per_page?: number;
  }) => {
    // Backend returns a paginated object { data: { data: Journal[], ... } }
    // but keep union for backward compatibility with bare-array responses.
    const response = await apiClient.get<{ success: boolean; data: { data: Journal[] } | Journal[] }>(`${FINANCE_BASE}/journals`, { params });
    return response.data;
  },

  getJournal: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: Journal }>(`${FINANCE_BASE}/journals/${id}`);
    return response.data;
  },

  // Two shapes (backend 2026-08): default (agent cash register) requires user_id and
  // auto-generates the code; type: "BANK_ACCOUNT" is a company bank/deposit account —
  // no owner, caller-chosen free `code`, scoped to a branch, with optional bank_name/rib.
  createJournal: async (payload:
    | { user_id: number; method_suffix: string; branch_id?: number }
    | { type: 'BANK_ACCOUNT'; code: string; method_suffix: string; branch_id: number; bank_name?: string; rib?: string }
  ) => {
    const response = await apiClient.post<{ success: boolean; data: Journal; message?: string }>(`${FINANCE_BASE}/journals`, payload);
    return response.data;
  },

  // Agent cash journal: is_active/currency. BANK_ACCOUNT journal: only bank_name/rib are
  // editable (branch_id/code/type are frozen; other fields → 422 FINANCE_NOT_A_BANK_ACCOUNT).
  updateJournal: async (id: number, payload: { is_active?: boolean; currency?: string; bank_name?: string; rib?: string }) => {
    const response = await apiClient.put<{ success: boolean; data: Journal; message?: string }>(`${FINANCE_BASE}/journals/${id}`, payload);
    return response.data;
  },

  // ==================== Clôture de caisse (Z de caisse, §16) ====================
  getClosures: async (journalId: number, params?: { business_date?: string; status?: TreasuryClosureStatus; per_page?: number }) => {
    const response = await apiClient.get<{ success: boolean; data: { data: JournalClosure[] } | JournalClosure[] }>(`${FINANCE_BASE}/journals/${journalId}/closures`, { params });
    return response.data;
  },

  getClosure: async (journalId: number, closureId: number) => {
    const response = await apiClient.get<{ success: boolean; data: JournalClosure }>(`${FINANCE_BASE}/journals/${journalId}/closures/${closureId}`);
    return response.data;
  },

  // Idempotent — explicit only if a declared opening balance is wanted; the
  // first settlement of the day auto-opens one otherwise.
  openClosure: async (journalId: number) => {
    const response = await apiClient.post<{ success: boolean; message?: string; data: JournalClosure }>(`${FINANCE_BASE}/journals/${journalId}/closures/open`, {});
    return response.data;
  },

  // discrepancy = counted_balance - theoretical_closing_balance, never
  // auto-applied to the journal's own balance — a recorded fact, not a
  // correction. No reopen endpoint exists (§16, deliberate) — this is final
  // for the day once called.
  closeClosure: async (journalId: number, closureId: number, payload: { counted_balance: number; notes?: string }) => {
    const response = await apiClient.post<{ success: boolean; message?: string; data: JournalClosure }>(`${FINANCE_BASE}/journals/${journalId}/closures/${closureId}/close`, payload);
    return response.data;
  },

  // Fixes a wrong counted_balance after the fact — `reason` required
  // (unlike close()'s optional notes). theoretical_closing_balance is never
  // recomputed, only counted_balance/discrepancy change. Gated by
  // adjust-finance-ledger, not manage-finance-journals.
  correctClosure: async (journalId: number, closureId: number, payload: { counted_balance: number; reason: string }) => {
    const response = await apiClient.post<{ success: boolean; message?: string; data: JournalClosure }>(`${FINANCE_BASE}/journals/${journalId}/closures/${closureId}/correct`, payload);
    return response.data;
  },

  // Best-effort, not all-or-nothing — always 200, read closed/skipped/errors
  // in the body. `counts` is one { journal_id, counted_balance, notes? } per
  // journal being closed together.
  batchCloseBranch: async (branchId: number, counts: { journal_id: number; counted_balance: number; notes?: string }[]) => {
    const response = await apiClient.post<{
      success: boolean;
      closed: JournalClosure[];
      skipped: number[];
      errors: { journal_id: number; message: string }[];
    }>(`${FINANCE_BASE}/branches/${branchId}/closures/close-all`, { counts });
    return response.data;
  },

  // ==================== Ledger ====================
  getLedger: async (params?: {
    from_date?: string;
    to_date?: string;
    journal_code?: string;
    type?: 'IN' | 'OUT';
    compte_comptable?: string;
    transfer_id?: number;
    period_id?: number;
    per_page?: number;
  }) => {
    // Verified live 2026-08-22: despite the flat-array shape this type
    // originally declared, the real response is paginated (`data.data`),
    // same as every other list endpoint in this file — `LedgerPage.tsx`
    // already defends against both shapes, this type declaration just
    // hadn't caught up.
    const response = await apiClient.get<{
      success: boolean;
      data: { data: LedgerEntry[] } | LedgerEntry[];
      totals?: LedgerTotals;
    }>(`${FINANCE_BASE}/ledger`, { params });
    return response.data;
  },

  adjustLedger: async (entryId: number, payload: { reason: string; date_comptable?: string }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: LedgerEntry[];
      message?: string;
      error?: string;
      error_code?: string;
    }>(`${FINANCE_BASE}/ledger/${entryId}/adjust`, payload);
    return response.data;
  },

  // ==================== Consultation (Encaissements / Audit) ====================
  // Every settlement that filled a given caisse, traceable back to order_id
  // — the "Encaissements" tab on a caisse's detail view.
  getIntakeLines: async (params?: { journal_id?: number; untransferred_only?: boolean; per_page?: number }) => {
    const response = await apiClient.get<{ success: boolean; data: { data: IntakeLine[] } | IntakeLine[] }>(`${FINANCE_BASE}/intake-lines`, { params });
    return response.data;
  },

  // Full operations trail for one journal (intake, transfer request/
  // approve/reject, auth check, caisse open/close/correct).
  getAuditLogs: async (params?: { journal_code?: string; per_page?: number }) => {
    const response = await apiClient.get<{ success: boolean; data: { data: AuditLogEntry[] } | AuditLogEntry[] }>(`${FINANCE_BASE}/audit-logs`, { params });
    return response.data;
  },

  // ==================== Transfers ====================
  getTransfers: async (params?: {
    status?: number;
    journal_code?: string;
    from_date?: string;
    to_date?: string;
    per_page?: number;
  }) => {
    // Same pagination mismatch as getLedger, verified live 2026-08-22 — the
    // real response is `{data: {data: Transfer[], ...}}`, not a bare array.
    // TransfersPage.tsx already defends against both shapes at the call site.
    const response = await apiClient.get<{ success: boolean; data: { data: Transfer[] } | Transfer[] }>(`${FINANCE_BASE}/transfers`, { params });
    return response.data;
  },

  createTransfer: async (payload: {
    source_journal_id: number;
    dest_journal_id: number;
    amount: number;
    transfer_type?: string;
    versement_reference?: string;
    versement_photo_path?: string;
    bank_name?: string;
    deposit_date?: string;
    intake_line_id?: number;
    note?: string;
  }) => {
    const response = await apiClient.post<{ success: boolean; data: Transfer; message?: string; error?: string; error_code?: string }>(`${FINANCE_BASE}/transfers`, payload);
    return response.data;
  },

  approveTransfer: async (id: number, payload: { comment?: string; confirmed_amount?: number }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: Transfer;
      entries?: LedgerEntry[];
      message?: string;
      error?: string;
      error_code?: string;
    }>(`${FINANCE_BASE}/transfers/${id}/approve`, payload);
    return response.data;
  },

  rejectTransfer: async (id: number, payload: { reason: string }) => {
    const response = await apiClient.post<{ success: boolean; data: Transfer; message?: string; error?: string; error_code?: string }>(`${FINANCE_BASE}/transfers/${id}/reject`, payload);
    return response.data;
  },

  // ==================== Settlements ====================
  getSettlements: async (params?: {
    pending_only?: boolean;
    user_id?: number;
    from_date?: string;
  }) => {
    const response = await apiClient.get<{ success: boolean; data: Settlement[] }>(`${FINANCE_BASE}/settlements`, { params });
    return response.data;
  },

  getSettlement: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: Settlement }>(`${FINANCE_BASE}/settlements/${id}`);
    return response.data;
  },

  // ==================== Helpers / Lookup ====================
  getHelperUsers: async (params?: { search?: string; branch_id?: number; limit?: number }) => {
    const response = await apiClient.get<{ success: boolean; data: FinanceHelperUser[] }>(`${FINANCE_BASE}/helpers/users`, { params });
    return response.data;
  },

  getHelperBranches: async (params?: { search?: string; limit?: number }) => {
    const response = await apiClient.get<{ success: boolean; data: FinanceHelperBranch[] }>(`${FINANCE_BASE}/helpers/branches`, { params });
    return response.data;
  },

  getHelperMethods: async () => {
    const response = await apiClient.get<{ success: boolean; data: Record<string, string> }>(`${FINANCE_BASE}/helpers/methods`);
    return response.data;
  },

  // ==================== Settlements ====================
  reconcileSettlement: async (payload: {
    vendor_settlement_id?: number;
    work_session_id?: number;
    counted_cash_total: number;
    notes?: string;
  }) => {
    const response = await apiClient.post<{
      success: boolean;
      data: Settlement;
      message?: string;
      error?: string;
      error_code?: string;
      details?: any;
    }>(`${FINANCE_BASE}/settlements/reconcile`, payload);
    return response.data;
  },
};
