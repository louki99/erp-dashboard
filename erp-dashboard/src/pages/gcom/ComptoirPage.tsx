import React, { useState } from 'react';
import { CheckCircle2, RefreshCw, FileText, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

import type { ActionItemProps } from '@/components/layout/ActionPanel';
import { GcomCatalogEntryScreen, type GcomCatalogEntrySubmitPayload } from '@/components/gcom/GcomCatalogEntryScreen';
import { gcomApi } from '@/services/api/gcomApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useCreateDirectInvoice } from '@/hooks/gcom/useGcomInvoices';
import type { GcomInvoice } from '@/types/gcom.types';

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;

const printInvoicePdf = async (invoiceId: number) => {
    try {
        const url = await gcomApi.invoices.getPdfBlobUrl(invoiceId);
        // null = still generating (rare right after a fresh sale, before the
        // warm-cache job has run) — a toast will let the user open/print it
        // manually once ready, nothing to auto-print yet.
        if (!url) return;
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        iframe.onload = () => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        };
        document.body.appendChild(iframe);
    } catch {
        toast.error('Impression impossible — la facture reste disponible en PDF');
    }
};

export default function ComptoirPage() {
    const [pdfLoading, setPdfLoading] = useState(false);
    // 2026-09-01 — manual negotiation now branché on direct-invoices too
    // (same contract as BC/BL). See BonCommandePage.tsx's identical comment
    // for the usePermissions/admin-bypass rationale.
    const { has } = usePermissions();
    const canPriceOverride = has('gcom-price-override');
    const canDiscountLine = has('gcom-discount-line');
    const canDiscountGlobal = has('gcom-discount-global');
    const createDirectInvoice = useCreateDirectInvoice();

    const handleSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomInvoice> => {
        try {
            const invoice = await createDirectInvoice.mutateAsync(payload);
            toast.success('Facture créée');
            printInvoicePdf(invoice.id);
            return invoice;
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg ?? 'Erreur lors de la validation de la vente');
        }
    };

    const openPdf = async (invoiceId: number) => {
        setPdfLoading(true);
        try {
            const url = await gcomApi.invoices.getPdfBlobUrl(invoiceId);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    return (
        <GcomCatalogEntryScreen<GcomInvoice>
            submitLabel="Valider & Imprimer"
            submitIcon={Printer}
            needsInstrumentAtSubmit
            showSoucheKindSelector
            onSubmit={handleSubmit}
            enableNegotiation
            canPriceOverride={canPriceOverride}
            canDiscountLine={canDiscountLine}
            canDiscountGlobal={canDiscountGlobal}
            draftKey="gcom-comptoir-create"
            renderSuccess={(invoice) => (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                        <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Vente enregistrée</h2>
                    <p className="text-xs text-gray-500 mb-6">
                        Facture {invoice.invoice_number ?? `#${invoice.id}`} — {invoice.status === 'fully_paid' ? 'payée' : 'en attente de règlement'} · impression envoyée
                        {invoice.souche_kind === 'internal' && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 align-middle">Souche interne</span>
                        )}
                    </p>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 w-full max-w-sm space-y-2 text-left">
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Sous-total HT</span><span className="font-medium text-gray-900">{fmtMAD(invoice.subtotal)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">TVA</span><span className="font-medium text-gray-900">{fmtMAD(invoice.tax_amount)}</span></div>
                        {Number(invoice.order?.financial_metadata?.stamp_duty) > 0 && (
                            <div className="flex justify-between text-xs"><span className="text-gray-400">Timbre</span><span className="font-medium text-gray-900">{fmtMAD(invoice.order?.financial_metadata?.stamp_duty)}</span></div>
                        )}
                        <div className="flex justify-between text-sm pt-2 border-t border-gray-100"><span className="font-semibold text-gray-700">Total TTC</span><span className="font-bold text-gray-900">{fmtMAD(invoice.total_amount)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-gray-400">Restant dû</span><span className={`font-medium ${Number(invoice.remaining_amount) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmtMAD(invoice.remaining_amount)}</span></div>
                    </div>
                </div>
            )}
            successActionItems={(invoice, { reset }): ActionItemProps[] => [
                { icon: RefreshCw, label: 'Nouvelle vente', variant: 'sage', onClick: reset },
                { icon: FileText, label: 'Facture PDF', variant: 'default', onClick: () => openPdf(invoice.id), disabled: pdfLoading },
            ]}
        />
    );
}
