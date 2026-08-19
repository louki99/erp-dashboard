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
    GcomReturnDeliveryNoteLinePayload,
    GcomReturnDeliveryNoteLineResponse,
    GcomDeliveryNoteReturn,
    GcomDeliveryNoteReturnsListResponse,
    GcomInstrumentDepositPayload,
    GcomInstrumentRejectPayload,
    GcomFinancialInstrumentActionResponse,
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
    GcomFinancialInstrumentsGlobalFilters,
    GcomBatchDepositPayload,
    GcomBatchDepositResponse,
    GcomSoucheKind,
    GcomAccountStatement,
    GcomAccountStatementResponse,
    GcomLedgerEntry,
    GcomLedgerFilters,
    GcomLedgerResponse,
    GcomPdfPriceMode,
} from '@/types/gcom.types';

const BASE = '/api/backend/gcom';

const genIdempotencyKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const idempotent = () => ({ headers: { 'X-Idempotency-Key': genIdempotencyKey() } });

// Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
// fetch as a blob and hand the caller an object URL to open/download instead.
const fetchPdfBlobUrl = async (url: string, priceMode?: GcomPdfPriceMode): Promise<string> => {
    const response = await apiClient.get(url, {
        responseType: 'blob',
        params: priceMode ? { price_mode: priceMode } : undefined,
    });
    return URL.createObjectURL(response.data as Blob);
};

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
        // presence triggers restock of those specific lines. 500 bug fixed
        // 2026-08-18 (agency-code series resolution) — verified live, creates
        // a real "AVR..." numbered credit note now.
        createCreditNote: async (invoiceId: number, payload: GcomCreateCreditNotePayload): Promise<GcomCreditNote> => {
            const response = await apiClient.post<GcomCreateCreditNoteResponse>(
                `${BASE}/invoices/${invoiceId}/credit-notes`,
                payload,
                idempotent(),
            );
            return response.data.credit_note;
        },

        // Bon d'avoir — same DocumentService/documents._layout pipeline as
        // BC/Devis/BL/Facture/bon de retour (2026-08-18).
        getCreditNotePdfBlobUrl: (invoiceId: number, creditNoteId: number): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/invoices/${invoiceId}/credit-notes/${creditNoteId}/pdf`),

        // Fixed 2026-08-17 — the invoice pdf now runs through the same
        // DocumentService/DocumentDataResolver pipeline as BC/Devis/BL (was
        // the older InvoiceDocumentService before, which didn't know about
        // price_mode or the modern documents._layout template — a real
        // architecture gap, not a one-off bug). `price_mode` genuinely
        // affects the rendered output now, defaults to `ttc` if omitted.
        getPdfBlobUrl: (invoiceId: number, priceMode?: GcomPdfPriceMode): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/invoices/${invoiceId}/pdf`, priceMode),
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

        // Default HT if `priceMode` omitted (unchanged behavior).
        getPdfBlobUrl: (quoteId: number, priceMode?: GcomPdfPriceMode): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/quotes/${quoteId}/pdf`, priceMode),
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
        // the existing invoice instead of erroring. `souche_kind` (§17, 2026-08-26) —
        // explicit override, beats the PaymentTerm-derived default; omit to keep it.
        convertToInvoice: async (orderId: number, instrument?: GcomInstrumentInput | null, soucheKind?: GcomSoucheKind | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/orders/${orderId}/convert-to-invoice`,
                { instrument: instrument ?? null, souche_kind: soucheKind ?? null },
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

        // Default HT if `priceMode` omitted (unchanged behavior).
        getPdfBlobUrl: (orderId: number, priceMode?: GcomPdfPriceMode): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/orders/${orderId}/pdf`, priceMode),
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
        // underlying BC's payment_method is cheque/effet. `souche_kind` (§17,
        // 2026-08-26) — explicit override, beats the PaymentTerm-derived default.
        convertToInvoice: async (deliveryNoteId: number, instrument?: GcomInstrumentInput | null, soucheKind?: GcomSoucheKind | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/convert-to-invoice`,
                { instrument: instrument ?? null, souche_kind: soucheKind ?? null },
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

        // CAS 1 of the returns architecture (§9bis) — partial line reduction
        // before invoicing. 422 if already invoiced, quantity >= current, or
        // `reason` isn't one of the GcomReturnReason enum values.
        returnLine: async (deliveryNoteId: number, itemId: number, payload: GcomReturnDeliveryNoteLinePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomReturnDeliveryNoteLineResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/lines/${itemId}/return`,
                payload,
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // Every CAS 1 return event recorded against this BL, newest first —
        // 2026-08-18, closes the "no persisted return reason/history" gap.
        listReturns: async (deliveryNoteId: number): Promise<GcomDeliveryNoteReturn[]> => {
            const response = await apiClient.get<GcomDeliveryNoteReturnsListResponse>(`${BASE}/delivery-notes/${deliveryNoteId}/returns`);
            return response.data.returns;
        },

        // Bon de retour — one row from listReturns() prints as one document
        // (each return call only ever touches one line, no aggregation).
        // Same DocumentService/documents._layout pipeline as BC/Devis/BL/Facture.
        getReturnPdfBlobUrl: (deliveryNoteId: number, returnId: number): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/delivery-notes/${deliveryNoteId}/returns/${returnId}/pdf`),

        // Default TTC if `priceMode` omitted (unchanged behavior).
        getPdfBlobUrl: (deliveryNoteId: number, priceMode?: GcomPdfPriceMode): Promise<string> =>
            fetchPdfBlobUrl(`${BASE}/delivery-notes/${deliveryNoteId}/pdf`, priceMode),
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

        // Relevé de Compte PDF (2026-08-24) — same builder as the JSON /ledger
        // endpoint above, so the PDF can never diverge from what the screen
        // shows. No `download` param sent — inline view via window.open,
        // matching every other GCOM PDF button in this module.
        getLedgerPdfBlobUrl: async (partnerId: number, filters?: GcomLedgerFilters): Promise<string> => {
            const response = await apiClient.get(`${BASE}/partners/${partnerId}/ledger/pdf`, {
                responseType: 'blob',
                params: filters,
            });
            return URL.createObjectURL(response.data as Blob);
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

    // Lifecycle transitions for chèque/effet instruments (2026-08-18) — not
    // partner-scoped, unlike partners.financialInstruments() (the list).
    financialInstruments: {
        // Company-wide "Portefeuille" (built 2026-08-24) — every instrument
        // across every partner of the acting user's company, for the
        // dedicated cross-client Liste. branch_id is best-effort (only
        // resolvable for at-sale instruments, see the type's comment) — a
        // deferred règlement's instrument never matches a branch_id filter,
        // not a bug.
        list: async (filters?: GcomFinancialInstrumentsGlobalFilters): Promise<GcomPaginator<GcomFinancialInstrument>> => {
            const response = await apiClient.get<GcomFinancialInstrumentsResponse>(`${BASE}/financial-instruments`, { params: filters });
            return response.data.financial_instruments;
        },

        // "Remise en banque groupée" — one deposit_date/deposit_reference
        // applied to the whole selection. Best-effort, always 200 (read
        // data.deposited/data.errors, not the status) — a non-PENDING id or
        // one from another company lands in errors, doesn't fail the batch.
        batchDeposit: async (payload: GcomBatchDepositPayload): Promise<GcomBatchDepositResponse['data']> => {
            const response = await apiClient.post<GcomBatchDepositResponse>(`${BASE}/financial-instruments/batch-deposit`, payload, idempotent());
            return response.data.data;
        },

        // PENDING → DEPOSITED. Both fields optional (deposit_date defaults to today).
        deposit: async (instrumentId: number, payload?: GcomInstrumentDepositPayload): Promise<GcomFinancialInstrument> => {
            const response = await apiClient.post<GcomFinancialInstrumentActionResponse>(
                `${BASE}/financial-instruments/${instrumentId}/deposit`,
                payload ?? {},
                idempotent(),
            );
            return response.data.financial_instrument;
        },

        // DEPOSITED → CLEARED. No body.
        clear: async (instrumentId: number): Promise<GcomFinancialInstrument> => {
            const response = await apiClient.post<GcomFinancialInstrumentActionResponse>(
                `${BASE}/financial-instruments/${instrumentId}/clear`,
                {},
                idempotent(),
            );
            return response.data.financial_instrument;
        },

        // DEPOSITED → REJECTED. `reason` required. Fixed 2026-08-20 (was
        // flagged as a gap earlier): rejecting now reopens every invoice that
        // instrument's settlement touched (paid_amount reverses, status
        // recalculates) and pulls the amount back out of whichever branch
        // caisse it landed in — a backend-only side effect, no new response
        // field to read. Re-fetch the invoice if the screen needs to reflect
        // the reopened state immediately.
        reject: async (instrumentId: number, payload: GcomInstrumentRejectPayload): Promise<GcomFinancialInstrument> => {
            const response = await apiClient.post<GcomFinancialInstrumentActionResponse>(
                `${BASE}/financial-instruments/${instrumentId}/reject`,
                payload,
                idempotent(),
            );
            return response.data.financial_instrument;
        },

        // REJECTED → PENDING (2026-08-21) — completes the state machine's
        // HTTP surface. Resets status/rejection_reason/rejected_at/
        // deposited_at only — does NOT re-close the invoice or re-credit the
        // branch caisse (those stay reversed). If the retry actually clears,
        // that's a fresh deposit()/clear() call, no automatic replay.
        redeposit: async (instrumentId: number): Promise<GcomFinancialInstrument> => {
            const response = await apiClient.post<GcomFinancialInstrumentActionResponse>(
                `${BASE}/financial-instruments/${instrumentId}/redeposit`,
                {},
                idempotent(),
            );
            return response.data.financial_instrument;
        },
    },
};
