import { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, AlertTriangle, Truck, RotateCcw, Clock, XCircle, Wallet, ClipboardList, FileSignature,
} from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { useGcomAlerts } from '@/hooks/useGcomAlerts';
import type { GcomAlertsSummary } from '@/types/gcom.types';

const fmtMAD = (n: number | undefined) =>
    n == null ? null : `${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;

type AlertKey = Exclude<keyof GcomAlertsSummary, 'total_alerts_count'>;

const CATEGORY_META: Record<AlertKey, { label: string; icon: React.ElementType; tone: 'red' | 'amber'; route: string }> = {
    overdue_invoices:          { label: 'Factures en retard',              icon: AlertTriangle,  tone: 'red',   route: '/gcom/factures' },
    uninvoiced_delivery_notes: { label: 'BL livrés non facturés',          icon: Truck,          tone: 'amber', route: '/gcom/bons-livraison' },
    unallocated_credit_notes:  { label: 'Avoirs non imputés',              icon: RotateCcw,      tone: 'amber', route: '/gcom/avoirs' },
    pending_instruments_due:   { label: 'Chèques/Effets proches échéance', icon: Clock,          tone: 'amber', route: '/gcom/instruments' },
    rejected_instruments:      { label: 'Chèques/Effets rejetés',          icon: XCircle,        tone: 'red',   route: '/gcom/instruments' },
    unclosed_cash_sessions:    { label: 'Sessions de caisse non clôturées',icon: Wallet,          tone: 'amber', route: '/gcom/ma-caisse' },
    pending_orders:            { label: "BC en attente d'expédition",     icon: ClipboardList,  tone: 'amber', route: '/gcom/bons-commande' },
    expiring_quotes:           { label: 'Devis bientôt expirés',          icon: FileSignature,  tone: 'amber', route: '/gcom/devis' },
};

const TONE_CLASSES: Record<'red' | 'amber', { bg: string; text: string; dot: string }> = {
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   dot: 'bg-red-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
};

// 2026-09-03 — the header's notification bell (MasterLayout.tsx) was fully
// decorative until this: a hardcoded red dot, no click handler, no data.
// Self-contained component (checks its own manage-gcom permission, renders
// nothing if absent) so MasterLayout stays module-agnostic — dropped in to
// replace the old static <Bell> button. Polls GET /gcom/alerts/summary via
// useGcomAlerts; see that hook's own comment for why polling over a Reverb
// push channel was chosen as the MVP here.
export const GcomAlertsBell: React.FC = () => {
    const { has } = usePermissions();
    const canSeeAlerts = has('manage-gcom');
    const { alerts, loading, refresh } = useGcomAlerts(canSeeAlerts);
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    if (!canSeeAlerts) {
        return (
            <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative">
                <Bell className="w-5 h-5" />
            </button>
        );
    }

    const total = alerts?.total_alerts_count ?? 0;
    const categories = (Object.keys(CATEGORY_META) as AlertKey[])
        .map(key => ({ key, meta: CATEGORY_META[key], data: alerts?.[key] }))
        .filter(c => (c.data?.count ?? 0) > 0);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => { setOpen(v => !v); if (!open) refresh(); }}
                className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative"
                aria-label="Alertes GCOM"
                aria-expanded={open}
            >
                <Bell className="w-5 h-5" />
                {total > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full border-2 border-[#1a1a1a]">
                        {total > 99 ? '99+' : total}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-80 max-h-[28rem] overflow-y-auto bg-white rounded-xl shadow-lg border border-gray-100 z-50">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-900">Alertes GCOM</span>
                        {loading && <span className="text-[10px] text-gray-400">Actualisation…</span>}
                    </div>
                    {categories.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-gray-400">
                            {loading ? 'Chargement…' : 'Aucune alerte en attente.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {categories.map(({ key, meta, data }) => {
                                const Icon = meta.icon;
                                const tone = TONE_CLASSES[meta.tone];
                                const amount = fmtMAD(data?.total_amount);
                                return (
                                    <button
                                        key={key}
                                        onClick={() => { setOpen(false); navigate(meta.route); }}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                                    >
                                        <div className={`shrink-0 w-8 h-8 rounded-lg ${tone.bg} flex items-center justify-center`}>
                                            <Icon className={`w-4 h-4 ${tone.text}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-semibold text-gray-800">{meta.label}</p>
                                            {amount && <p className="text-[11px] text-gray-400 mt-0.5">{amount}</p>}
                                        </div>
                                        <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${tone.bg} ${tone.text}`}>
                                            {data?.count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
