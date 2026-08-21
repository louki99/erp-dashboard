import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import { AvoirAllocationPicker } from '@/components/gcom/AvoirAllocationPicker';
import { canMixAvoirWith } from '@/lib/gcom/avoirAllocations';
import type { Bank } from '@/services/api/masterdataApi';
import type { PaymentTermOption } from '@/types/partner.types';
import type { GcomAvoirAllocation, GcomInstrumentInput, GcomPaymentMethod, GcomSoucheKind } from '@/types/gcom.types';

// 2026-09-01 — the shared "which method, and whatever that method needs"
// block used at convert-to-invoice (BC→Facture and BL→Facture alike), in
// both BonCommandePage.tsx and BonLivraisonPage.tsx. Extracted because the
// generalized payment_method override (any real method, not just the old
// avoir-too-small cash/card case) made the previously-separate "instrument
// panel" and "plain confirm modal" need the exact same fields — whichever
// one opens first, the user can switch to any other method and the right
// fields must appear. NOT used inside the exact-avoir panel (BL/BC stored
// as 'avoir') — that flow has its own narrower cash/card-only remainder
// override, a different (older, still valid) mechanism.
export interface ConvertToInvoicePaymentFieldsProps {
    invoicingMode: '1_FAC_PER_BL' | '1_FAC_PER_ORDER' | 'PERIODIC_FIN_DE_MOIS' | null;
    method: Exclude<GcomPaymentMethod, 'avoir'>;
    onMethodChange: (m: Exclude<GcomPaymentMethod, 'avoir'>) => void;
    instrument: GcomInstrumentInput;
    onInstrumentChange: (updater: (p: GcomInstrumentInput) => GcomInstrumentInput) => void;
    banks: Bank[];
    bankOther: boolean;
    onBankOtherChange: (v: boolean) => void;
    creditTerms: PaymentTermOption[];
    termId: number | null;
    onTermIdChange: (id: number | null) => void;
    soucheKind: GcomSoucheKind;
    onSoucheKindChange: (k: GcomSoucheKind) => void;
    mixAvoirEnabled: boolean;
    onMixAvoirEnabledChange: (v: boolean) => void;
    avoirAllocations: GcomAvoirAllocation[];
    onAvoirAllocationsChange: (a: GcomAvoirAllocation[]) => void;
    partnerId: number | null;
    total: number;
    // 2026-09-01 — POST /invoices/consolidate has no avoir_allocations
    // concept at all (avoir isn't even a valid override target there);
    // showing the mix checkbox would offer a control the endpoint can't
    // honor. Default false (shown) — every convert-to-invoice caller needs it.
    hideAvoirMix?: boolean;
}

export const ConvertToInvoicePaymentFields = ({
    invoicingMode, method, onMethodChange, instrument, onInstrumentChange, banks, bankOther, onBankOtherChange,
    creditTerms, termId, onTermIdChange, soucheKind, onSoucheKindChange, hideAvoirMix = false,
    mixAvoirEnabled, onMixAvoirEnabledChange, avoirAllocations, onAvoirAllocationsChange, partnerId, total,
}: ConvertToInvoicePaymentFieldsProps) => {
    // 1_FAC_PER_ORDER — doc: "not supported at all yet for a 1_FAC_PER_ORDER
    // partner" — same restriction already applied to souche_kind. The method
    // stays whatever the document was created with, no picker shown.
    const overrideDisabled = invoicingMode === '1_FAC_PER_ORDER';
    const needsInstrument = method === 'cheque' || method === 'effet';
    const needsTerm = method === 'credit' || method === 'transfer';

    return (
        <>
            {overrideDisabled ? (
                <p className="text-[10px] text-gray-400 italic">Mode de règlement fixé à la création du BC/BL — non modifiable pour ce mode de facturation (1 facture / commande).</p>
            ) : (
                <div className="space-y-1.5">
                    <span className="text-[10px] text-gray-500">Mode de règlement :</span>
                    <div className="flex flex-wrap gap-1.5">
                        {PAYMENT_METHODS.filter((m): m is typeof m & { value: Exclude<GcomPaymentMethod, 'avoir'> } => m.value !== 'avoir').map(m => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => onMethodChange(m.value)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                    method === m.value ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                <m.icon className="w-3.5 h-3.5" /> {m.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {needsInstrument && (
                <div className="grid grid-cols-2 gap-2">
                    <input value={instrument.reference_number} onChange={e => onInstrumentChange(p => ({ ...p, reference_number: e.target.value }))} placeholder="Référence *" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                    <input type="date" value={instrument.due_date} onChange={e => onInstrumentChange(p => ({ ...p, due_date: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                    {banks.length > 0 && !bankOther ? (
                        <select
                            value={instrument.bank_name}
                            onChange={e => {
                                if (e.target.value === '__other__') { onBankOtherChange(true); onInstrumentChange(p => ({ ...p, bank_name: '' })); }
                                else onInstrumentChange(p => ({ ...p, bank_name: e.target.value }));
                            }}
                            className="px-2 py-1.5 text-xs border border-gray-200 rounded-md bg-white"
                        >
                            <option value="">Banque</option>
                            {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                            <option value="__other__">Autre…</option>
                        </select>
                    ) : (
                        <input value={instrument.bank_name} onChange={e => onInstrumentChange(p => ({ ...p, bank_name: e.target.value }))} placeholder={banks.length > 0 ? 'Banque (saisie libre)' : 'Banque'} className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                    )}
                    <input value={instrument.bank_account} onChange={e => onInstrumentChange(p => ({ ...p, bank_account: e.target.value }))} placeholder="N° compte" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                </div>
            )}

            {needsTerm && (
                creditTerms.length > 0 ? (
                    <select
                        value={termId ?? ''}
                        onChange={e => onTermIdChange(e.target.value ? parseInt(e.target.value, 10) : null)}
                        className="w-full max-w-xs px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                    >
                        {creditTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                ) : (
                    <p className="text-[11px] text-red-600 font-medium">Aucun terme de paiement à crédit configuré pour ce client — impossible de facturer avec ce mode.</p>
                )
            )}

            {!overrideDisabled && (
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-gray-400 mr-0.5">Souche :</span>
                    {(['declared', 'internal'] as GcomSoucheKind[]).map(k => (
                        <button
                            key={k}
                            type="button"
                            onClick={() => onSoucheKindChange(k)}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                soucheKind === k ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            {k === 'declared' ? 'Déclarée' : 'Interne'}
                        </button>
                    ))}
                </div>
            )}

            {/* Avoir mix — not offered for credit/transfer (backend 422s that combination). */}
            {!hideAvoirMix && canMixAvoirWith(method) && (
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={mixAvoirEnabled}
                            onChange={e => { onMixAvoirEnabledChange(e.target.checked); if (!e.target.checked) onAvoirAllocationsChange([]); }}
                            className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                        />
                        Appliquer un avoir en réduction du montant
                    </label>
                    {mixAvoirEnabled && (
                        <AvoirAllocationPicker
                            partnerId={partnerId}
                            total={total}
                            value={avoirAllocations}
                            onChange={onAvoirAllocationsChange}
                            mode="partial"
                        />
                    )}
                </div>
            )}
        </>
    );
};

export default ConvertToInvoicePaymentFields;
