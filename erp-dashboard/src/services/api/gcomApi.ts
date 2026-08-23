import apiClient from './client';
import { showPdfGeneratingToast, showPdfReadyToast, showPdfFailedToast } from '@/lib/gcom/pdfReadyToast';
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
    GcomCreateFreeStandingCreditNotePayload,
    GcomCreditNotesGlobalListFilters,
    GcomCreditNotesGlobalListResponse,
    GcomCreditNoteDetailResponse,
    GcomRedeemCreditNotePayload,
    GcomRedeemCreditNoteResponse,
    GcomAvoirAllocation,
    GcomPaymentMethod,
    GcomConsolidateInvoicePayload,
    GcomCaisseListResponse,
    GcomParameter,
    GcomParametersResponse,
    GcomAlertsSummary,
    GcomAlertsSummaryResponse,
    GcomCloseCaissePayload,
    GcomCaisseCloseResult,
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
    GcomOrderListViewRow,
    GcomOrderListViewResponse,
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
    GcomDeliveryNoteListViewRow,
    GcomDeliveryNoteListViewResponse,
    GcomDeliveryNoteShowResponse,
    GcomDeliveryNoteMutationResponse,
    GcomCreateDeliveryNotePayload,
    GcomCancelDeliveryNotePayload,
    GcomAddDeliveryNoteLinePayload,
    GcomUpdateDeliveryNoteLinePayload,
    GcomRemoveDeliveryNoteLinePayload,
    GcomApplyDeliveryNoteDiscountPayload,
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
    GcomPartnerStatementRow,
    GcomPartnerStatementsListFilters,
    GcomPartnerStatementsListResponse,
    GcomLedgerEntry,
    GcomLedgerFilters,
    GcomLedgerResponse,
    GcomPdfPriceMode,
    GcomRepresentative,
    GcomRepresentativesListFilters,
    GcomRepresentativesListResponse,
    GcomRepresentativeShowResponse,
    GcomCreateRepresentativePayload,
    GcomUpdateRepresentativePayload,
    GcomRepresentativeMutationResponse,
    GcomRepresentativeRemoveResponse,
} from '@/types/gcom.types';

const BASE = '/api/backend/gcom';

const genIdempotencyKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const idempotent = () => ({ headers: { 'X-Idempotency-Key': genIdempotencyKey() } });

// Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
// fetch as a blob and hand the caller an object URL to open/download instead.
//
// 2026-09-03 — "PDF stays in sync after an edit": a recent mutation can leave
// the document mid-regeneration, in which case this same endpoint returns 202
// with a JSON body (`{ status: 'generating', retry_after_seconds }`) instead of
// the PDF — axios still hands it back as an opaque Blob since we asked for
// responseType: 'blob', so detection has to happen on response.status, not
// content.
//
// 2026-09-03, revised same day: a 202 isn't actually the only slow case —
// live-tested a cold-cache PDF that returned a perfectly normal 200, just
// after 31s (a warm re-request of the exact same document was 2.3s). The
// backend doc only defines 202 for a genuinely in-flight regeneration; a slow
// *synchronous* render on a cache miss is a real, separate case that still
// looks identical to the user (a stuck "Imprimer" button) and needed the same
// treatment. So instead of only reacting to a 202, every request now races
// against PDF_SLOW_THRESHOLD_MS: if it hasn't settled by then — 202 or just
// slow — stop blocking the caller and hand it off to the same background
// path. A 202 that arrives fast still backgrounds immediately (no need to
// wait out the threshold once the status is already known). Not a blocking
// retry loop (an earlier version of this was — reverted after user feedback:
// don't make someone stare at one button for 30-50s, unable to navigate,
// for something they don't need to watch). Callers get `null` back the
// moment this call stops blocking; a toast (`pdfReadyToast.tsx` — kept out of
// this plain .ts file since it needs JSX for the clickable action) lets the
// user open the PDF once it's ready, from wherever they've navigated to
// since. Opening automatically once ready was considered and rejected:
// window.open() outside a direct user gesture (e.g. from a
// setTimeout/promise continuation) gets silently killed by the browser's
// popup blocker — routing it through a toast the user clicks themselves
// sidesteps that entirely. Not wired to the document.pdf.ready WebSocket
// event (documents.{type}.{id}) — polling is simpler and just as correct now
// that nothing blocks on it; the socket event would only save the last few
// seconds before the next poll tick anyway.
const PDF_SLOW_THRESHOLD_MS = 8_000; // don't block the caller past this — background it and notify instead
const PDF_GENERATING_MAX_WAIT_MS = 110_000; // under the backend's 2min safety-net TTL
const PDF_GENERATING_DEFAULT_RETRY_MS = 3_000;

const readRetryAfterMs = async (blob: Blob): Promise<number> => {
    try {
        const body = JSON.parse(await blob.text()) as { retry_after_seconds?: number };
        return body.retry_after_seconds ? body.retry_after_seconds * 1000 : PDF_GENERATING_DEFAULT_RETRY_MS;
    } catch {
        return PDF_GENERATING_DEFAULT_RETRY_MS; // malformed/unexpected body
    }
};

// 2026-09-03 — the PDF endpoints send `Cache-Control: max-age=300, private`
// (live-verified via curl), so the *browser's own* HTTP cache can silently
// serve a 5-minute-old response for an identical URL — completely bypassing
// this file's "always fetch fresh" logic, since the cache hit happens before
// the request ever reaches the network. Live-reproduced: opened a genuinely
// new blob: tab (a real new URL.createObjectURL call, so a fresh network
// layer request had to have happened) that still showed pre-edit data. A
// unique per-request query param defeats browser caching by making every
// request address a URL the cache has never seen, without touching the
// server's own Cache-Control header (reported to backend separately — even
// a short max-age is at odds with a document that can now be edited and
// regenerated at any time).
const withCacheBust = <T extends object>(params: T | undefined): T & { _: string } =>
    ({ ...params, _: Date.now().toString() }) as T & { _: string };

const pollPdfInBackground = async (
    url: string,
    params: Record<string, unknown> | undefined,
    toastId: string,
    firstDelayMs: number,
): Promise<void> => {
    const deadline = Date.now() + PDF_GENERATING_MAX_WAIT_MS;
    let delay = firstDelayMs;
    for (;;) {
        await new Promise(resolve => setTimeout(resolve, delay));
        let response;
        try {
            response = await apiClient.get(url, { responseType: 'blob', params: withCacheBust(params) });
        } catch {
            showPdfFailedToast(toastId, 'Erreur lors de la génération du document.');
            return;
        }
        if (response.status !== 202) {
            showPdfReadyToast(toastId, URL.createObjectURL(response.data as Blob));
            return;
        }
        if (Date.now() >= deadline) {
            showPdfFailedToast(toastId, 'Le document met plus de temps que prévu à se générer — réessayez depuis l’écran.');
            return;
        }
        delay = PDF_GENERATING_DEFAULT_RETRY_MS;
    }
};

// 2026-09-03 — generalized from a (url, priceMode) pair to a plain (url,
// params) pair once the Relevé de Compte PDF needed to reuse this (it takes
// GcomLedgerFilters — {from, to} — not a price mode). Callers that need
// price_mode build that one-key object themselves now.
const fetchPdfBlobUrl = (url: string, params?: Record<string, unknown>): Promise<string | null> => {
    const requestPromise = apiClient.get(url, { responseType: 'blob', params: withCacheBust(params) });

    return new Promise<string | null>((resolve, reject) => {
        let settled = false;

        // The in-flight request may still resolve into either a real PDF (it was
        // just slow, not a 202) or a genuine 202 — handle both the same way the
        // fast path below would have.
        const backgroundFromHere = (toastId: string) => {
            requestPromise
                .then(async response => {
                    if (response.status !== 202) {
                        showPdfReadyToast(toastId, URL.createObjectURL(response.data as Blob));
                        return;
                    }
                    const retryAfterMs = await readRetryAfterMs(response.data as Blob);
                    void pollPdfInBackground(url, params, toastId, retryAfterMs);
                })
                .catch(() => showPdfFailedToast(toastId, 'Impossible de charger le PDF.'));
        };

        const slowTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const toastId = showPdfGeneratingToast('Génération du document en cours… vous serez notifié, vous pouvez continuer à naviguer.');
            backgroundFromHere(toastId);
            resolve(null);
        }, PDF_SLOW_THRESHOLD_MS);

        requestPromise
            .then(async response => {
                if (settled) return; // already handed off to backgroundFromHere above
                clearTimeout(slowTimer);
                settled = true;
                if (response.status !== 202) {
                    resolve(URL.createObjectURL(response.data as Blob));
                    return;
                }
                // A 202 that arrived fast still needs the background treatment —
                // it just skips waiting out the threshold since the status is
                // already known.
                const toastId = showPdfGeneratingToast('Génération du document en cours… vous serez notifié, vous pouvez continuer à naviguer.');
                const retryAfterMs = await readRetryAfterMs(response.data as Blob);
                void pollPdfInBackground(url, params, toastId, retryAfterMs);
                resolve(null);
            })
            .catch(err => {
                if (settled) return; // already backgrounded — its own .catch handles the failure toast
                clearTimeout(slowTimer);
                settled = true;
                reject(err);
            });
    });
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
        getCreditNotePdfBlobUrl: (invoiceId: number, creditNoteId: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/invoices/${invoiceId}/credit-notes/${creditNoteId}/pdf`),

        // Fixed 2026-08-17 — the invoice pdf now runs through the same
        // DocumentService/DocumentDataResolver pipeline as BC/Devis/BL (was
        // the older InvoiceDocumentService before, which didn't know about
        // price_mode or the modern documents._layout template — a real
        // architecture gap, not a one-off bug). `price_mode` genuinely
        // affects the rendered output now, defaults to `ttc` if omitted.
        getPdfBlobUrl: (invoiceId: number, priceMode?: GcomPdfPriceMode): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/invoices/${invoiceId}/pdf`, priceMode ? { price_mode: priceMode } : undefined),

        // 2026-09-01 — groups ≥2 delivery notes (separate orders, same
        // partner) into one invoice. A real JSON endpoint despite one
        // doc line implying otherwise (verified live) — goes through the
        // normal fetch wrapper like every other GCOM mutation, not a
        // direct download link. See GcomConsolidateInvoicePayload's
        // comment for the optional-unless-disagreement fields.
        consolidate: async (payload: GcomConsolidateInvoicePayload): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/invoices/consolidate`,
                payload,
                idempotent(),
            );
            return response.data.invoice;
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

        // Default HT if `priceMode` omitted (unchanged behavior).
        getPdfBlobUrl: (quoteId: number, priceMode?: GcomPdfPriceMode): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/quotes/${quoteId}/pdf`, priceMode ? { price_mode: priceMode } : undefined),
    },

    orders: {
        list: async (filters?: GcomOrderListFilters): Promise<GcomPaginator<GcomOrder>> => {
            const response = await apiClient.get<GcomOrderListResponse>(`${BASE}/orders`, { params: filters });
            return response.data.orders;
        },

        // Lean grid-only projection (2026-09-03) — see GcomOrderListViewRow's
        // comment. Use for the BC datagrid; use list() (above) wherever full
        // GcomOrder fields are needed.
        listView: async (filters?: GcomOrderListFilters): Promise<GcomPaginator<GcomOrderListViewRow>> => {
            const response = await apiClient.get<GcomOrderListViewResponse>(`${BASE}/orders/list-view`, { params: filters });
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
        // `avoirAllocations` (2026-08-20) — required (and must sum exactly to the
        // sale total) when the BC's payment_method is 'avoir'.
        // `paymentMethodOverride` — generalized 2026-09-01: any real settlement
        // method (cash/card/cheque/effet/credit/transfer) can now be swapped in
        // at convert-to-invoice regardless of what the BC was created with —
        // avoir is not a valid target here, that's the separate avoir_allocations
        // mechanism above. Originally (2026-08-20) this was narrowly restricted
        // to cash/card and only accepted when the stored method was genuinely
        // 'avoir' — that narrow case (avoir too small, needs a cash/card
        // remainder) still works the same way, it's just no longer the only
        // case. `paymentTermId` — only meaningful when overriding to
        // credit/transfer; optional, falls back to the partner's default
        // payment term, 422 if neither resolves. Rejected with 422 if the
        // document is already invoiced (closes the old silent-ignore gap: a
        // retry/double-click used to 200 and silently keep the original
        // method). Not supported at all yet for a 1_FAC_PER_ORDER partner.
        convertToInvoice: async (orderId: number, instrument?: GcomInstrumentInput | null, soucheKind?: GcomSoucheKind | null, avoirAllocations?: GcomAvoirAllocation[], paymentMethodOverride?: Exclude<GcomPaymentMethod, 'avoir'>, paymentTermId?: number | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/orders/${orderId}/convert-to-invoice`,
                { instrument: instrument ?? null, souche_kind: soucheKind ?? null, avoir_allocations: avoirAllocations ?? undefined, payment_method: paymentMethodOverride ?? undefined, payment_term_id: paymentTermId ?? undefined },
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
        getPdfBlobUrl: (orderId: number, priceMode?: GcomPdfPriceMode): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/orders/${orderId}/pdf`, priceMode ? { price_mode: priceMode } : undefined),
    },

    deliveryNotes: {
        list: async (filters?: GcomDeliveryNoteListFilters): Promise<GcomPaginator<GcomDeliveryNote>> => {
            const response = await apiClient.get<GcomDeliveryNoteListResponse>(`${BASE}/delivery-notes`, { params: filters });
            return response.data.delivery_notes;
        },

        // Lean grid-only projection (2026-09-03) — see GcomDeliveryNoteListViewRow's
        // comment. Use for the BL datagrid; use list() (above) wherever full
        // GcomDeliveryNote fields are needed.
        listView: async (filters?: GcomDeliveryNoteListFilters): Promise<GcomPaginator<GcomDeliveryNoteListViewRow>> => {
            const response = await apiClient.get<GcomDeliveryNoteListViewResponse>(`${BASE}/delivery-notes/list-view`, { params: filters });
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

        // 2026-08-29 — in_transit → delivered, sets delivered_at. No body.
        // 422 if the BL isn't currently in_transit. Does NOT touch stock
        // (already deducted at BL creation) or trigger settlement — that
        // still only happens at convert-to-invoice, unchanged.
        confirmDelivery: async (deliveryNoteId: number): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/confirm-delivery`,
                {},
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // Flow #4's second hop — BC → BL → Facture. `instrument` required if the
        // underlying BC's payment_method is cheque/effet. `souche_kind` (§17,
        // 2026-08-26) — explicit override, beats the PaymentTerm-derived default.
        // 2026-08-29: 422s if the BL is still in_transit — call confirmDelivery
        // first (the UI should gate this action on status === 'delivered', not
        // just rely on the 422).
        // `avoirAllocations`/`paymentMethodOverride`/`paymentTermId` — see
        // orders.convertToInvoice's comment for all three (generalized
        // 2026-09-01, same contract on this endpoint). The BL-specific bug
        // backend fixed while building the original narrow version: generateFromDeliveryNote()
        // reads the BL's own total_amount snapshot (taken at BL creation), not
        // the order's live total — stamp duty recalculated on the order alone
        // would never have reached the invoice without also updating
        // delivery_note.total_amount. Verified live on this exact endpoint
        // (BC→BL→Facture chain, cash override + partial avoir, and again for
        // the generalized any-method override).
        convertToInvoice: async (deliveryNoteId: number, instrument?: GcomInstrumentInput | null, soucheKind?: GcomSoucheKind | null, avoirAllocations?: GcomAvoirAllocation[], paymentMethodOverride?: Exclude<GcomPaymentMethod, 'avoir'>, paymentTermId?: number | null): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomConvertToInvoiceResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/convert-to-invoice`,
                { instrument: instrument ?? null, souche_kind: soucheKind ?? null, avoir_allocations: avoirAllocations ?? undefined, payment_method: paymentMethodOverride ?? undefined, payment_term_id: paymentTermId ?? undefined },
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

        // BL editing (2026-09-01) — see GcomAddDeliveryNoteLinePayload's
        // comment for the full guard/permission/stock-delta rundown.
        // addLine currently 500s unconditionally on this tenant, live-verified
        // — do not call from any UI action until backend confirms a fix.
        addLine: async (deliveryNoteId: number, payload: GcomAddDeliveryNoteLinePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/lines`,
                payload,
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // Omitting unit_price/discount_percent/discount_amount re-prices the
        // line fresh from catalog, dropping any existing override — same as
        // the BC equivalent.
        updateLine: async (deliveryNoteId: number, itemId: number, payload: GcomUpdateDeliveryNoteLinePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.patch<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/lines/${itemId}`,
                payload,
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // Restocks the line's full remaining quantity as a flat `adjustment`
        // movement (no condition routing — that's the CAS-1 return endpoint's
        // job, not this one). Removing the last line cancels the whole BL+order.
        removeLine: async (deliveryNoteId: number, itemId: number, payload: GcomRemoveDeliveryNoteLinePayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/lines/${itemId}/remove`,
                payload,
                idempotent(),
            );
            return response.data.delivery_note;
        },

        // 2026-09-01 — see GcomApplyDeliveryNoteDiscountPayload's comment:
        // always redistributes from each line's stable pre-discount price,
        // repeat calls don't compound. Pass {} to clear.
        applyDiscount: async (deliveryNoteId: number, payload: GcomApplyDeliveryNoteDiscountPayload): Promise<GcomDeliveryNote> => {
            const response = await apiClient.post<GcomDeliveryNoteMutationResponse>(
                `${BASE}/delivery-notes/${deliveryNoteId}/discount`,
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
        getReturnPdfBlobUrl: (deliveryNoteId: number, returnId: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/delivery-notes/${deliveryNoteId}/returns/${returnId}/pdf`),

        // Default TTC if `priceMode` omitted (unchanged behavior).
        getPdfBlobUrl: (deliveryNoteId: number, priceMode?: GcomPdfPriceMode): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/delivery-notes/${deliveryNoteId}/pdf`, priceMode ? { price_mode: priceMode } : undefined),
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
        //
        // 2026-09-03 — routed through the shared fetchPdfBlobUrl (generalized
        // the same day from a (url, priceMode) pair to a plain (url, params)
        // pair specifically so this could reuse it) instead of its own raw
        // apiClient.get() — same 202/slow-render race-timeout/cache-bust
        // handling every other GCOM PDF button gets, no separate
        // implementation to keep in sync. Doesn't matter that this endpoint
        // isn't in backend's documented "PDF stays in sync" mutation list
        // (BC/BL/Devis/Facture/Avoir only) — the race-against-timeout half of
        // fetchPdfBlobUrl protects against a slow-but-plain-200 Gotenberg
        // render regardless of whether a given endpoint ever returns 202.
        getLedgerPdfBlobUrl: (partnerId: number, filters?: GcomLedgerFilters): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/partners/${partnerId}/ledger/pdf`, filters as unknown as Record<string, unknown> | undefined),

        // Relevé de Compte Global (2026-08-30) — company-wide, mass-aggregated
        // server-side (~6 GROUP BY queries, not a per-partner loop). Excludes
        // clients with zero GCOM activity unless include_zero_balance is set.
        statementsList: async (filters?: GcomPartnerStatementsListFilters): Promise<GcomPaginator<GcomPartnerStatementRow>> => {
            const response = await apiClient.get<GcomPartnerStatementsListResponse>(`${BASE}/partners/statements`, { params: filters });
            return response.data.statements;
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

        // Reçu d'encaissement (2026-09-03) — same DocumentService/documents._layout
        // pipeline and "PDF stays in sync" 202/cache-bust handling as every other
        // GCOM PDF, via the shared fetchPdfBlobUrl. Amount-in-words, imputation
        // table (live "Reste à Payer" per invoice, not frozen at payment time),
        // and the new solde dû are all computed server-side through the same
        // GcomPartnerLedgerBuilder /statement and /ledger already use — never a
        // third source of truth that could drift, directly closing the class of
        // bug the remaining_amount fix (2026-09-03) addressed.
        getPdfBlobUrl: (paymentId: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/payments/${paymentId}/pdf`),
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

        // Bordereau de remise (2026-08-20) — id-based like every other GCOM
        // PDF, never keyed on the free-text deposit_reference. A single
        // deposit() creates its own 1-instrument BankDeposit too, so this
        // works for any DEPOSITED/CLEARED/REJECTED instrument's
        // bank_deposit_id, not just ones from a batch deposit.
        getBankDepositPdfBlobUrl: (bankDepositId: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/financial-instruments/bank-deposits/${bankDepositId}/pdf`),
    },

    // Company-wide Avoirs (2026-08-20) — separate from invoices.creditNotes()/
    // createCreditNote(), which stay invoice-scoped. Each row already nests
    // invoice{}/partner{} (verified live), so the global "Avoirs" Liste and its
    // detail panel need no follow-up calls.
    creditNotes: {
        list: async (filters?: GcomCreditNotesGlobalListFilters): Promise<GcomPaginator<GcomCreditNote>> => {
            const response = await apiClient.get<GcomCreditNotesGlobalListResponse>(`${BASE}/credit-notes`, { params: filters });
            return response.data.credit_notes;
        },

        get: async (creditNoteId: number): Promise<GcomCreditNote> => {
            const response = await apiClient.get<GcomCreditNoteDetailResponse>(`${BASE}/credit-notes/${creditNoteId}`);
            return response.data.credit_note;
        },

        // 2026-09-02 — standalone "avoir libre", no invoice_id/order_id.
        // See GcomCreateFreeStandingCreditNotePayload's comment for the full
        // permission/cap/PDF-gap rundown.
        createFreeStanding: async (payload: GcomCreateFreeStandingCreditNotePayload): Promise<GcomCreditNote> => {
            const response = await apiClient.post<GcomCreateCreditNoteResponse>(
                `${BASE}/credit-notes`,
                payload,
                idempotent(),
            );
            return response.data.credit_note;
        },

        // Resolves (fully, or partially via `amount`) a credit note's
        // `remaining_amount` — journals a negative branch-caisse entry for the
        // redeemed amount. Draws from the same `remaining_amount` pool that
        // `payment_method: 'avoir'` allocations draw from (2026-08-20), so a
        // note can never be spent twice across the two channels. Only the
        // event that brings `remaining_amount` to exactly 0 stamps
        // refund_method/refund_reference/refund_processed_at — a partial call
        // in between leaves those three untouched (verified live). 422 if
        // already fully resolved, nothing due, or an unknown method.
        redeem: async (creditNoteId: number, payload: GcomRedeemCreditNotePayload): Promise<GcomCreditNote> => {
            const response = await apiClient.post<GcomRedeemCreditNoteResponse>(
                `${BASE}/credit-notes/${creditNoteId}/redeem`,
                payload,
                idempotent(),
            );
            return response.data.credit_note;
        },
    },

    // §18, built 2026-08-27/28 — thin GCOM-scoped façade over plain Users
    // holding the gcom_representative role. Tenant-scoped to the acting
    // admin's own company automatically, nothing to pass for that.
    representatives: {
        list: async (filters?: GcomRepresentativesListFilters): Promise<GcomPaginator<GcomRepresentative>> => {
            const response = await apiClient.get<GcomRepresentativesListResponse>(`${BASE}/representatives`, { params: filters });
            return response.data.representatives;
        },

        get: async (userId: number): Promise<GcomRepresentative> => {
            const response = await apiClient.get<GcomRepresentativeShowResponse>(`${BASE}/representatives/${userId}`);
            return response.data.representative;
        },

        // Always assigns gcom_representative — the role is never a request
        // parameter. company_id defaults to the acting admin's own.
        create: async (payload: GcomCreateRepresentativePayload): Promise<GcomRepresentative> => {
            const response = await apiClient.post<GcomRepresentativeMutationResponse>(`${BASE}/representatives`, payload, idempotent());
            return response.data.representative;
        },

        update: async (userId: number, payload: GcomUpdateRepresentativePayload): Promise<GcomRepresentative> => {
            const response = await apiClient.put<GcomRepresentativeMutationResponse>(`${BASE}/representatives/${userId}`, payload, idempotent());
            return response.data.representative;
        },

        // Removes the gcom_representative role only — never deletes the
        // user account. Any BC/BL/Facture already attributed to them via
        // sales_rep_id keeps that history; they just stop being selectable
        // for new ones.
        remove: async (userId: number): Promise<void> => {
            await apiClient.delete<GcomRepresentativeRemoveResponse>(`${BASE}/representatives/${userId}`, idempotent());
        },
    },

    // Caisses individuelles (2026-08-20) — every GCOM cash-in now credits the
    // CONNECTED user's own USER_CAISSE, not the branch's BRANCH_CAISSE (which
    // becomes a pure coffre, fed only by the closure transfers below). If the
    // acting user has no active journal for a given method, the underlying
    // sale/règlement/redeem call 422s: "Aucun journal de caisse actif n'est
    // assigné à votre compte utilisateur pour cette agence." — not something
    // this namespace itself guards against, since the failure surfaces
    // naturally through whichever sale/payment endpoint was actually called.
    caisse: {
        // My own caisses (one per method — ESP/CHQ/EFF/VIR) with live balances.
        list: async (): Promise<GcomCaisseListResponse['data']> => {
            const response = await apiClient.get<GcomCaisseListResponse>(`${BASE}/caisse`);
            return response.data.data;
        },

        // Closes today's session for ONE method at a time (not all 4 at
        // once) and immediately transfers the theoretical balance to the
        // branch coffre — validated on the spot, no separate confirmation
        // step. Cheque/effet transfers land one-per-instrument (an
        // instrument isn't divisible), verified live — `data.transfers`
        // reflects that. 422 if that method's session is already closed
        // today ("Aucune nouvelle opération autorisée jusqu'à la prochaine
        // ouverture."), verified live.
        close: async (payload: GcomCloseCaissePayload): Promise<GcomCaisseCloseResult['data']> => {
            const response = await apiClient.post<GcomCaisseCloseResult>(`${BASE}/caisse/close`, payload, idempotent());
            return response.data.data;
        },
    },

    // 2026-09-02 — see GcomParametersResponse's comment: read-only registry,
    // `current_value` already resolved for the acting user.
    parameters: {
        get: async (module: 'GCOM' = 'GCOM'): Promise<GcomParameter[]> => {
            const response = await apiClient.get<GcomParametersResponse>(`${BASE}/parameters`, { params: { module } });
            return response.data.parameters;
        },
    },

    // Proactive alerts (2026-09-03) — feeds the notification bell. See
    // GcomAlertsSummary's own comment for the per-category semantics/caveats.
    alerts: {
        summary: async (branchId?: number): Promise<GcomAlertsSummary> => {
            const response = await apiClient.get<GcomAlertsSummaryResponse>(`${BASE}/alerts/summary`, {
                params: branchId ? { branch_id: branchId } : undefined,
            });
            return response.data.alerts;
        },
    },
};
