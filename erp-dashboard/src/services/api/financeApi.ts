import apiClient from './client';
import type { Journal, LedgerEntry, LedgerTotals, Transfer, Settlement } from '@/types/finance.types';

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
    method_suffix?: string;
    active_only?: boolean;
    search?: string;
    per_page?: number;
  }) => {
    const response = await apiClient.get<{ success: boolean; data: Journal[] }>(`${FINANCE_BASE}/journals`, { params });
    return response.data;
  },

  getJournal: async (id: number) => {
    const response = await apiClient.get<{ success: boolean; data: Journal }>(`${FINANCE_BASE}/journals/${id}`);
    return response.data;
  },

  createJournal: async (payload: { user_id: number; method_suffix: string; branch_id?: number }) => {
    const response = await apiClient.post<{ success: boolean; data: Journal; message?: string }>(`${FINANCE_BASE}/journals`, payload);
    return response.data;
  },

  updateJournal: async (id: number, payload: { is_active?: boolean; currency?: string }) => {
    const response = await apiClient.put<{ success: boolean; data: Journal; message?: string }>(`${FINANCE_BASE}/journals/${id}`, payload);
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
    const response = await apiClient.get<{
      success: boolean;
      data: LedgerEntry[];
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

  // ==================== Transfers ====================
  getTransfers: async (params?: {
    status?: number;
    journal_code?: string;
    from_date?: string;
    to_date?: string;
    per_page?: number;
  }) => {
    const response = await apiClient.get<{ success: boolean; data: Transfer[] }>(`${FINANCE_BASE}/transfers`, { params });
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
