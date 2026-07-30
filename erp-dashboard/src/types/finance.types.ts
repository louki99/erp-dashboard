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
