// GCOM (Gestion Commerciale Pure) — see docs/modules/28-gcom.md §8/§13/§14.

export type GcomPaymentMethod = 'cash' | 'card' | 'credit' | 'cheque' | 'effet' | 'transfer';

export interface GcomInstrumentInput {
    reference_number: string;
    due_date: string; // YYYY-MM-DD
    bank_name?: string;
    bank_account?: string;
}

export interface GcomItemInput {
    product_id: number;
    quantity: number;
}

export interface GcomDirectInvoicePayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    notes?: string;
    payment_term_id?: number | null;
    instrument?: GcomInstrumentInput | null;
}

export interface GcomInvoiceItem {
    id: number;
    product_id: number;
    product_name?: string;
    quantity: number;
    unit_price?: number | string;
    sub_total?: number | string;
    tax_amount?: number | string;
    total_amount?: number | string;
}

export type GcomInvoiceStatus = 'pending' | 'partially_paid' | 'fully_paid' | 'overdue';

export interface GcomInvoice {
    id: number;
    invoice_number?: string;
    status: GcomInvoiceStatus;
    sub_total?: number | string;
    tax_amount?: number | string;
    stamp_duty?: number | string;
    total_amount: number | string;
    paid_amount?: number | string;
    remaining_amount: number | string;
    invoice_date?: string;
    due_date?: string | null;
    items?: GcomInvoiceItem[];
    partner?: { id: number; name: string; code?: string };
    order?: { id: number; bc_status?: string };
}

export interface GcomDirectInvoiceResponse {
    success: boolean;
    message?: string;
    invoice: GcomInvoice;
}
