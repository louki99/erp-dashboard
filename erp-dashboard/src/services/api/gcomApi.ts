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

        // Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
        // fetch as a blob and hand the caller an object URL to open/download instead.
        getPdfBlobUrl: async (invoiceId: number): Promise<string> => {
            const response = await apiClient.get(`${BASE}/invoices/${invoiceId}/pdf`, {
                responseType: 'blob',
            });
            return URL.createObjectURL(response.data as Blob);
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

        // Flow #4's first hop — BC → BL. No body.
        // §8 documents this route as taking no body — `payload` is sent anyway
        // (delivery_date/payment_method) pending backend confirmation it's read.
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
    },
};
