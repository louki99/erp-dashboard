import apiClient from './client';
import type {
    GcomDirectInvoicePayload,
    GcomDirectInvoiceResponse,
    GcomInvoice,
    GcomInvoiceListFilters,
    GcomInvoiceListResponse,
    GcomInvoiceShowResponse,
    GcomPaginator,
    GcomCreditNote,
    GcomCreditNotesListResponse,
    GcomCreateCreditNotePayload,
    GcomCreateCreditNoteResponse,
    GcomQuote,
    GcomQuoteListFilters,
    GcomQuoteListResponse,
    GcomQuoteShowResponse,
    GcomQuoteMutationResponse,
    GcomCreateQuotePayload,
    GcomConvertQuotePayload,
    GcomConvertQuoteResponse,
    GcomConvertQuoteToOrderPayload,
    GcomConvertQuoteToOrderResponse,
    GcomOrder,
    GcomOrderListFilters,
    GcomOrderListResponse,
    GcomOrderShowResponse,
    GcomOrderMutationResponse,
    GcomCreateOrderPayload,
    GcomConvertToInvoiceResponse,
    GcomConvertToBlResponse,
    GcomConvertToBlPayload,
    GcomCancelOrderPayload,
    GcomCancelOrderLinePayload,
    GcomUpdateOrderLinePayload,
    GcomAddOrderLinePayload,
    GcomInstrumentInput,
    GcomDeliveryNoteRef,
    GcomDeliveryNote,
    GcomDeliveryNoteListFilters,
    GcomDeliveryNoteListResponse,
    GcomDeliveryNoteShowResponse,
    GcomDeliveryNoteMutationResponse,
    GcomCreateDeliveryNotePayload,
    GcomCancelDeliveryNotePayload,
    GcomOpenInvoicesResponse,
    GcomOpenInvoice,
    GcomPayment,
    GcomPaymentListFilters,
    GcomPaymentListResponse,
    GcomRegisterPaymentPayload,
    GcomRegisterPaymentResponse,
    GcomFinancialInstrument,
    GcomFinancialInstrumentsFilters,
    GcomFinancialInstrumentsResponse,
    GcomAccountStatement,
    GcomAccountStatementResponse,
    GcomLedgerEntry,
    GcomLedgerFilters,
    GcomLedgerResponse,
} from '@/types/gcom.types';

const BASE = '/api/backend/gcom';

const genIdempotencyKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const idempotent = () => ({ headers: { 'X-Idempotency-Key': genIdempotencyKey() } });

export const gcomApi = {
    directInvoices: {
        // Flow #6 — Comptoir: BC + stock-out + invoice in one call.
        create: async (payload: GcomDirectInvoicePayload): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomDirectInvoiceResponse>(
                `${BASE}/direct-invoices`,
                payload,
                idempotent(),
            );
            return response.data.invoice;
        },
    },

    invoices: {
        list: async (filters?: GcomInvoiceListFilters): Promise<GcomPaginator<GcomInvoice>> => {
            const response = await apiClient.get<GcomInvoiceListResponse>(`${BASE}/invoices`, { params: filters });
            return response.data.invoices;
        },

        get: async (invoiceId: number): Promise<GcomInvoice> => {
            const response = await apiClient.get<GcomInvoiceShowResponse>(`${BASE}/invoices/${invoiceId}`);
            return response.data.invoice;
        },

        creditNotes: async (invoiceId: number): Promise<GcomCreditNote[]> => {
            const response = await apiClient.get<GcomCreditNotesListResponse>(`${BASE}/invoices/${invoiceId}/credit-notes`);
            return response.data.credit_notes;
        },

        // Omitting `amount` cancels the invoice for its full amount. `items`
        // presence triggers restock of those specific lines.
        createCreditNote: async (invoiceId: number, payload: GcomCreateCreditNotePayload): Promise<GcomCreditNote> => {
            const response = await apiClient.post<GcomCreateCreditNoteResponse>(
                `${BASE}/invoices/${invoiceId}/credit-notes`,
                payload,
                idempotent(),
            );
            return response.data.credit_note;
        },

        // Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
        // fetch as a blob and hand the caller an object URL to open/download instead.
        getPdfBlobUrl: async (invoiceId: number): Promise<string> => {
            const response = await apiClient.get(`${BASE}/invoices/${invoiceId}/pdf`, {
                responseType: 'blob',
            });
            return URL.createObjectURL(response.data as Blob);
        },
    },

    quotes: {
        // Own-quotes only — `Quote.user_id = current user`, no cross-user listing.
        list: async (filters?: GcomQuoteListFilters): Promise<GcomPaginator<GcomQuote>> => {
            const response = await apiClient.get<GcomQuoteListResponse>(`${BASE}/quotes`, { params: filters });
            return response.data.quotes;
        },

        get: async (quoteId: number): Promise<GcomQuote> => {
            const response = await apiClient.get<GcomQuoteShowResponse>(`${BASE}/quotes/${quoteId}`);
            return response.data.quote;
        },

        // Flow #1/#2's entry point — no payment info collected here, just the
        // client/articles/notes/expiry. Payment is chosen at convert time.
        create: async (payload: GcomCreateQuotePayload): Promise<GcomQuote> => {
            const response = await apiClient.post<GcomQuoteMutationResponse>(`${BASE}/quotes`, payload, idempotent());
            return response.data.quote;
        },

        // Flow #2 — Devis → Facture Directe, skips the BC stage entirely.
        convert: async (quoteId: number, payload?: GcomConvertQuotePayload): Promise<GcomConvertQuoteResponse> => {
            const response = await apiClient.post<GcomConvertQuoteResponse>(
                `${BASE}/quotes/${quoteId}/convert`,
                payload ?? {},
                idempotent(),
            );
            return response.data;
        },

        // Flow #1, first hop — Devis → BC.
        convertToOrder: async (quoteId: number, payload?: GcomConvertQuoteToOrderPayload): Promise<GcomConvertQuoteToOrderResponse> => {
            const response = await apiClient.post<GcomConvertQuoteToOrderResponse>(
                `${BASE}/quotes/${quoteId}/convert-to-order`,
                payload ?? {},
                idempotent(),
            );
            return response.data;
        },
    },

    orders: {
        list: async (filters?: GcomOrderListFilters): Promise<GcomPaginator<GcomOrder>> => {
            const response = await apiClient.get<GcomOrderListResponse>(`${BASE}/orders`, { params: filters });
            return response.data.orders;
        },

        get: async (orderId: number): Promise<GcomOrder> => {
            const response = await apiClient.get<GcomOrderShowResponse>(`${BASE}/orders/${orderId}`);
            return response.data.order;
        },

        // Flow #1 (second hop) / #3 / #4's BC leg — never deducts stock, never invoices.
        create: async (payload: GcomCreateOrderPayload): Promise<GcomOrder> => {
            const response = await apiClient.post<GcomOrderMutationResponse>(`${BASE}/orders`, payload, idempotent());
            return response.data.order;
        },

        // Flow #3 — BC → Facture, no BL. `instrument` required if the BC's payment_method
        // is cheque/effet. Idempotent: re-calling on an already-invoiced order returns
        // the existing invoice instead of erroring.
        convertToInvoice: async (orderId: number, instrument?: GcomInstrumentInput | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/orders/${orderId}/convert-to-invoice`,
                { instrument: instrument ?? null },
                idempotent(),
            );
            return response.data.invoice;
        },

        // Flow #4's first hop — BC → BL. `delivery_date`/`payment_method` are
        // both optional and genuinely persisted (verified live 2026-08-15) —
        // see GcomConvertToBlPayload for the side effects of changing the method.
        convertToBl: async (orderId: number, payload?: GcomConvertToBlPayload): Promise<GcomDeliveryNoteRef> => {
            const response = await apiClient.post<GcomConvertToBlResponse>(
                `${BASE}/orders/${orderId}/convert-to-bl`,
                payload ?? {},
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // Only allowed while the BC has no BL and no invoice yet.
        cancel: async (orderId: number, payload: GcomCancelOrderPayload): Promise<GcomOrder> => {
            const response = await apiClient.post<GcomOrderMutationResponse>(
                `${BASE}/orders/${orderId}/cancel`,
                payload,
                idempotent(),
            );
            return response.data.order;
        },

        // Partial (pass `quantity`) or full (omit it) single-line cancellation — same
        // "before any BL/invoice" guard. Removing the last line cancels the whole BC.
        cancelLine: async (orderId: number, orderProductId: number, payload: GcomCancelOrderLinePayload): Promise<GcomOrder> => {
            const response = await apiClient.post<GcomOrderMutationResponse>(
                `${BASE}/orders/${orderId}/lines/${orderProductId}/cancel`,
                payload,
                idempotent(),
            );
            return response.data.order;
        },

        // The inverse of cancelLine — raises a line's quantity. Despite not being
        // marked 🔁 in the announcement, it DOES require X-Idempotency-Key —
        // verified live (omitting it 422s with "Idempotency-Key header is
        // required for this endpoint"). Don't trust the doc/announcement's
        // silence on this per-endpoint; same lesson as the pivot.id saga.
        updateLine: async (orderId: number, orderProductId: number, payload: GcomUpdateOrderLinePayload): Promise<GcomOrder> => {
            const response = await apiClient.patch<GcomOrderMutationResponse>(
                `${BASE}/orders/${orderId}/lines/${orderProductId}`,
                payload,
                idempotent(),
            );
            return response.data.order;
        },

        // Adds a brand-new product line to an existing BC. 422 if the product is
        // already on the order. Verified live: also requires X-Idempotency-Key.
        addLine: async (orderId: number, payload: GcomAddOrderLinePayload): Promise<GcomOrder> => {
            const response = await apiClient.post<GcomOrderMutationResponse>(
                `${BASE}/orders/${orderId}/lines`,
                payload,
                idempotent(),
            );
            return response.data.order;
        },
    },

    deliveryNotes: {
        list: async (filters?: GcomDeliveryNoteListFilters): Promise<GcomPaginator<GcomDeliveryNote>> => {
            const response = await apiClient.get<GcomDeliveryNoteListResponse>(`${BASE}/delivery-notes`, { params: filters });
            return response.data.delivery_notes;
        },

        get: async (deliveryNoteId: number): Promise<GcomDeliveryNote> => {
            const response = await apiClient.get<GcomDeliveryNoteShowResponse>(`${BASE}/delivery-notes/${deliveryNoteId}`);
            return response.data.delivery_note;
        },

        // Flow #5 — BL Direct → Facture. Creates an underlying BC transparently,
        // then the BL — stock deducts here (the only document that exists yet).
        create: async (payload: GcomCreateDeliveryNotePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(`${BASE}/delivery-notes`, payload, idempotent());
            return response.data.delivery_note;
        },

        // Flow #4's second hop — BC → BL → Facture. `instrument` required if the
        // underlying BC's payment_method is cheque/effet.
        convertToInvoice: async (deliveryNoteId: number, instrument?: GcomInstrumentInput | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/convert-to-invoice`,
                { instrument: instrument ?? null },
                idempotent(),
            );
            return response.data.invoice;
        },

        // Only allowed while the BL has no invoice yet. Restocks immediately.
        cancel: async (deliveryNoteId: number, payload: GcomCancelDeliveryNotePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/cancel`,
                payload,
                idempotent(),
            );
            return response.data.delivery_note;
        },
    },

    partners: {
        // Convenience lookup for building a "which invoices does this règlement
        // cover" picker.
        openInvoices: async (partnerId: number): Promise<GcomOpenInvoice[]> => {
            const response = await apiClient.get<GcomOpenInvoicesResponse>(`${BASE}/partners/${partnerId}/open-invoices`);
            return response.data.invoices;
        },

        // Real per-instrument chèque/effet portfolio (added 2026-08-16).
        financialInstruments: async (partnerId: number, filters?: GcomFinancialInstrumentsFilters): Promise<GcomPaginator<GcomFinancialInstrument>> => {
            const response = await apiClient.get<GcomFinancialInstrumentsResponse>(`${BASE}/partners/${partnerId}/financial-instruments`, { params: filters });
            return response.data.financial_instruments;
        },

        // Treasury-unification gap fixed 2026-08-17 — see the comment on
        // GcomAccountStatement in gcom.types.ts. Safe to use directly.
        statement: async (partnerId: number): Promise<GcomAccountStatement> => {
            const response = await apiClient.get<GcomAccountStatementResponse>(`${BASE}/partners/${partnerId}/statement`);
            return response.data.statement;
        },

        ledger: async (partnerId: number, filters?: GcomLedgerFilters): Promise<GcomLedgerEntry[]> => {
            const response = await apiClient.get<GcomLedgerResponse>(`${BASE}/partners/${partnerId}/ledger`, { params: filters });
            return response.data.ledger;
        },
    },

    payments: {
        // Channel-agnostic — every payment for the partner, not just GCOM-originated.
        // `partner_id` is required by the API, no cross-partner feed exists.
        listForPartner: async (filters: GcomPaymentListFilters): Promise<GcomPaginator<GcomPayment>> => {
            const response = await apiClient.get<GcomPaymentListResponse>(`${BASE}/payments`, { params: filters });
            return response.data.payments;
        },

        // Registers a règlement and letters it in one call — either against
        // explicit `allocations`, or oldest-open-invoice-first via `auto_letter`.
        // See GcomRegisterPaymentPayload for the payment_term_id/bank_id
        // constraints verified live (not in the doc).
        register: async (payload: GcomRegisterPaymentPayload): Promise<GcomPayment> => {
            const response = await apiClient.post<GcomRegisterPaymentResponse>(`${BASE}/payments`, payload, idempotent());
            return response.data.payment;
        },
    },
};
