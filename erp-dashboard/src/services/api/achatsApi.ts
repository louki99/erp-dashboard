import apiClient from './client';
import { fetchPdfBlobUrl } from '@/lib/gcom/fetchPdfBlobUrl';
import type {
    PurchaseOrderListFilters, PurchaseOrderListResponse, PurchaseOrderShowResponse,
    CreatePurchaseOrderPayload, PurchaseOrderMutationResponse, CancelPurchaseOrderPayload,
    PurchaseOrderLinePayload,
    PurchaseReceptionListFilters, PurchaseReceptionListResponse, PurchaseReceptionShowResponse,
    CreatePurchaseReceptionPayload, PurchaseReceptionMutationResponse, CancelPurchaseReceptionPayload,
    SupplierInvoiceListFilters, SupplierInvoiceListResponse, SupplierInvoiceShowResponse,
    CreateSupplierInvoicePayload, SupplierInvoiceMutationResponse, CancelSupplierInvoicePayload,
    PurchaseOrderSuppliersResponse,
    CreateSupplierPaymentPayload, SupplierPaymentMutationResponse, LetterSupplierPaymentPayload,
    SupplierAccountStatementResponse, SupplierLedgerFilters, SupplierLedgerResponse,
    SupplierPaymentsStatementsListFilters, SupplierPaymentsStatementsListResponse,
} from '@/types/achats.types';

const BASE = '/api/backend';

// No X-Idempotency-Key on any endpoint here — unlike gcomApi.ts's orders/
// delivery-notes/etc, the Achats doc (30-achats-purchase-orders.md) never
// mentions it for purchase-orders/purchase-receptions, so it's not sent.
export const achatsApi = {
    purchaseOrders: {
        // §3.8 — the correct source for the "Fournisseur" combobox (NOT
        // GET /partners, which is customers; NOT GET /suppliers or
        // GET /master-data/suppliers, root/admin-only). No query params, no
        // pagination — callers filter the flat list client-side.
        suppliers: async (): Promise<PurchaseOrderSuppliersResponse['data']> => {
            const response = await apiClient.get<PurchaseOrderSuppliersResponse>(`${BASE}/purchase-orders/suppliers`);
            return response.data.data;
        },
        list: async (filters?: PurchaseOrderListFilters): Promise<PurchaseOrderListResponse['data']> => {
            const response = await apiClient.get<PurchaseOrderListResponse>(`${BASE}/purchase-orders`, { params: filters });
            return response.data.data;
        },
        get: async (id: number) => {
            const response = await apiClient.get<PurchaseOrderShowResponse>(`${BASE}/purchase-orders/${id}`);
            return response.data.data;
        },
        create: async (payload: CreatePurchaseOrderPayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders`, payload);
            return response.data;
        },
        update: async (id: number, payload: Partial<CreatePurchaseOrderPayload>) => {
            const response = await apiClient.put<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}`, payload);
            return response.data;
        },
        addLine: async (id: number, payload: PurchaseOrderLinePayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/lines`, payload);
            return response.data;
        },
        deleteLine: async (id: number, lineId: number) => {
            const response = await apiClient.delete<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/lines/${lineId}`);
            return response.data;
        },
        confirm: async (id: number) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/confirm`);
            return response.data;
        },
        cancel: async (id: number, payload: CancelPurchaseOrderPayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/cancel`, payload);
            return response.data;
        },
        // §3.10 — same Document Studio pipeline as every GCOM PDF (backend's
        // own words), hence the shared fetchPdfBlobUrl (202/slow-cache/toast
        // handling) rather than a plain apiClient.get. Opens inline in a new
        // tab, matching every other "Imprimer" button in this app — the
        // browser's own PDF viewer offers Save/Print from there, so no
        // separate ?download=1 variant is wired up.
        getPdfBlobUrl: (id: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/purchase-orders/${id}/pdf`),
    },
    purchaseReceptions: {
        list: async (filters?: PurchaseReceptionListFilters): Promise<PurchaseReceptionListResponse['data']> => {
            const response = await apiClient.get<PurchaseReceptionListResponse>(`${BASE}/purchase-receptions`, { params: filters });
            return response.data.data;
        },
        get: async (id: number) => {
            const response = await apiClient.get<PurchaseReceptionShowResponse>(`${BASE}/purchase-receptions/${id}`);
            return response.data.data;
        },
        create: async (payload: CreatePurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions`, payload);
            return response.data;
        },
        validate: async (id: number) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/validate`);
            return response.data;
        },
        cancel: async (id: number, payload: CancelPurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/cancel`, payload);
            return response.data;
        },
        reverse: async (id: number, payload: CancelPurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/reverse`, payload);
            return response.data;
        },
        // §4.6 — Bon de Réception, for magasinier sign-off / dock inspection.
        getPdfBlobUrl: (id: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/purchase-receptions/${id}/pdf`),
    },
    supplierInvoices: {
        list: async (filters?: SupplierInvoiceListFilters): Promise<SupplierInvoiceListResponse['data']> => {
            const response = await apiClient.get<SupplierInvoiceListResponse>(`${BASE}/supplier-invoices`, { params: filters });
            return response.data.data;
        },
        get: async (id: number) => {
            const response = await apiClient.get<SupplierInvoiceShowResponse>(`${BASE}/supplier-invoices/${id}`);
            return response.data.data;
        },
        create: async (payload: CreateSupplierInvoicePayload) => {
            const response = await apiClient.post<SupplierInvoiceMutationResponse>(`${BASE}/supplier-invoices`, payload);
            return response.data;
        },
        // No request body (doc §11.4) — a 400 with an explicit message is the
        // expected response when a discrepancy line blocks approval without
        // override-purchase-matching-tolerance. Never swallow/reinterpret
        // that message client-side; surface it verbatim (doc's explicit UX
        // requirement — see SupplierInvoicePage.tsx's handleApprove).
        approve: async (id: number) => {
            const response = await apiClient.post<SupplierInvoiceMutationResponse>(`${BASE}/supplier-invoices/${id}/approve`);
            return response.data;
        },
        cancel: async (id: number, payload: CancelSupplierInvoicePayload) => {
            const response = await apiClient.post<SupplierInvoiceMutationResponse>(`${BASE}/supplier-invoices/${id}/cancel`, payload);
            return response.data;
        },
        // §11.6bis — 3-way matching recap (Commandé/Reçu/Facturé + écarts %
        // + statut par ligne), useful both pending_review (for a comptable
        // to decide) and approved (archivable proof).
        getPdfBlobUrl: (id: number): Promise<string | null> =>
            fetchPdfBlobUrl(`${BASE}/supplier-invoices/${id}/pdf`),
    },
    // §12 — no plain GET /supplier-payments list endpoint is documented
    // (only create/letter/unletter/cancel + statement/ledger/statements-list).
    // Don't invent one — a "history of past décaissements" screen isn't
    // buildable against the confirmed contract; flagged to backend/product,
    // see [[project_achats_module]].
    supplierPayments: {
        create: async (payload: CreateSupplierPaymentPayload) => {
            const response = await apiClient.post<SupplierPaymentMutationResponse>(`${BASE}/supplier-payments`, payload);
            return response.data;
        },
        letter: async (id: number, payload: LetterSupplierPaymentPayload) => {
            const response = await apiClient.post<SupplierPaymentMutationResponse>(`${BASE}/supplier-payments/${id}/letter`, payload);
            return response.data;
        },
        unletter: async (letteringId: number) => {
            const response = await apiClient.post<SupplierPaymentMutationResponse>(`${BASE}/supplier-payments/letterings/${letteringId}/unletter`);
            return response.data;
        },
        // Doc's §12.3 prose never shows a request body for cancel (unlike
        // purchase-orders/-receptions/supplier-invoices, which all explicitly
        // require {reason}, 10-500 chars) — sent with no body here rather
        // than guessing a required field the doc never confirmed. If a live
        // 422 says otherwise, fix this then (see [[project_achats_module]]).
        cancel: async (id: number) => {
            const response = await apiClient.post<SupplierPaymentMutationResponse>(`${BASE}/supplier-payments/${id}/cancel`);
            return response.data;
        },
        statement: async (supplierId: number): Promise<SupplierAccountStatementResponse['data']> => {
            const response = await apiClient.get<SupplierAccountStatementResponse>(`${BASE}/supplier-payments/suppliers/${supplierId}/statement`);
            return response.data.data;
        },
        ledger: async (supplierId: number, filters?: SupplierLedgerFilters): Promise<SupplierLedgerResponse> => {
            const response = await apiClient.get<SupplierLedgerResponse>(`${BASE}/supplier-payments/suppliers/${supplierId}/ledger`, { params: filters });
            return response.data;
        },
        // §12.4 — deliberately nested under supplier-payments/, not
        // /suppliers/statements, to avoid colliding with the master-data
        // suppliers apiResource's show($supplier) route.
        statementsList: async (filters?: SupplierPaymentsStatementsListFilters): Promise<SupplierPaymentsStatementsListResponse['data']> => {
            const response = await apiClient.get<SupplierPaymentsStatementsListResponse>(`${BASE}/supplier-payments/suppliers/statements`, { params: filters });
            return response.data.data;
        },
    },
};
