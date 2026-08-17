import React, { useState } from 'react';
import { Printer, Loader2, CheckCircle2 } from 'lucide-react';
import type { GcomPdfPriceMode } from '@/types/gcom.types';

// ─── Shared "choose HT or TTC before printing" modal ──────────────────────────
// Used by BC/Devis/BL — the three GCOM documents whose PDF endpoint accepts
// `?price_mode=ht|ttc`. Invoices don't have this param, so FacturesPage keeps
// its plain single "Facture PDF" button instead of using this component.

export interface PdfPriceModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (mode: GcomPdfPriceMode) => void;
    /** The document's own default mode if the param is omitted (BC/Devis: 'ht', BL: 'ttc') — pre-selected. */
    defaultMode: GcomPdfPriceMode;
    documentLabel: string; // e.g. "bon de commande", "devis", "bon de livraison"
    loading?: boolean;
}

const OPTIONS: { value: GcomPdfPriceMode; label: string; hint: string }[] = [
    { value: 'ht', label: 'Hors Taxe (HT)', hint: 'Prix unitaires et montants hors TVA' },
    { value: 'ttc', label: 'Toutes Taxes Comprises (TTC)', hint: 'Prix unitaires et montants TVA incluse' },
];

export function PdfPriceModeModal({ isOpen, onClose, onConfirm, defaultMode, documentLabel, loading = false }: PdfPriceModeModalProps) {
    const [mode, setMode] = useState<GcomPdfPriceMode>(defaultMode);
    // Reset to the document's default each time the modal (re)opens — done
    // during render (React's sanctioned "adjust state on prop change"
    // pattern), not in a useEffect, so it doesn't trigger a cascading re-render.
    const [wasOpen, setWasOpen] = useState(isOpen);
    if (isOpen !== wasOpen) {
        setWasOpen(isOpen);
        if (isOpen) setMode(defaultMode);
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                        <Printer className="w-4 h-4 text-sage-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Imprimer le {documentLabel}</h3>
                        <p className="text-[11px] text-gray-400">Le total HT/TVA/TTC reste toujours affiché en bas du document.</p>
                    </div>
                </div>

                <div className="space-y-2 mb-5">
                    {OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setMode(opt.value)}
                            className={`w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-lg border text-left transition-colors ${
                                mode === opt.value ? 'border-sage-500 bg-sage-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}
                        >
                            <div>
                                <p className={`text-sm font-semibold ${mode === opt.value ? 'text-sage-700' : 'text-gray-800'}`}>{opt.label}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{opt.hint}</p>
                                {opt.value === defaultMode && <p className="text-[10px] text-gray-400 mt-0.5">Mode par défaut de ce document</p>}
                            </div>
                            {mode === opt.value && <CheckCircle2 className="w-4 h-4 text-sage-600 shrink-0" />}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => onConfirm(mode)}
                        disabled={loading}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                        Générer le PDF
                    </button>
                    <button onClick={onClose} disabled={loading} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
}
