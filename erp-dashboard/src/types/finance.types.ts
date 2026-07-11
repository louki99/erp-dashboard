export interface Journal {
  id: number;
  code: string;
  method_suffix: 'ESP' | 'CHQ' | 'EFF' | 'VIR' | 'VER';
  currency: string;
  cached_balance: string;
  is_active: boolean;
  user: { id: number; name: string; code: string; branch_id: number | null };
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
  bank_name: string | null;
  deposit_date: string | null;
  intake_line_id: number | null;
  note: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  cancelled_at: string | null;
  rejection_reason: string | null;
  sourceJournal: { id: number; code: string; method_suffix: string };
  destJournal: { id: number; code: string; method_suffix: string };
  createdBy?: { id: number; name: string };
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
