import apiClient from './client';
import type { GcomDirectInvoicePayload, GcomDirectInvoiceResponse, GcomInvoice } from '@/types/gcom.types';

const BASE = '/api/backend/gcom';

const genIdempotencyKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const gcomApi = {
    directInvoices: {
        // Flow #6 — Comptoir: BC + stock-out + invoice in one call.
        create: async (payload: GcomDirectInvoicePayload): Promise<GcomInvoice> => {
            const response = await apiClient.post<GcomDirectInvoiceResponse>(
                `${BASE}/direct-invoices`,
                payload,
                { headers: { 'X-Idempotency-Key': genIdempotencyKey() } },
            );
            return response.data.invoice;
        },
    },

    invoices: {
        // Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
        // fetch as a blob and hand the caller an object URL to open/download instead.
        getPdfBlobUrl: async (invoiceId: number): Promise<string> => {
            const response = await apiClient.get(`${BASE}/invoices/${invoiceId}/pdf`, {
                responseType: 'blob',
            });
            return URL.createObjectURL(response.data as Blob);
        },
    },
};
