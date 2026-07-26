// Fiche partenaire block reused on Planning/Visit detail panels — identity,
// address, credit and order history, all embedded on the visit/planning
// `partner` object (correctif 2026-08: previously silently null). Shows the
// real order list via GET /orders?partner_id=X since `order_history` is an
// aggregated snapshot only, not a browsable list.
import { MapPin, Wallet, History, ChevronRight, Loader2, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useOrdersList } from '@/hooks/telesales/useTelesalesOrders';
import type { TeleVisitPartner } from '@/types/telesalesAgent.types';

const formatMoney = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

const formatAddress = (a: NonNullable<TeleVisitPartner['address']>) => {
    const parts = [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
};

export const PartnerFicheCard = ({ partner }: { partner: TeleVisitPartner }) => {
    const navigate = useNavigate();
    const { orders, loading: loadingOrders } = useOrdersList({ partner_id: partner.id });
    const address = partner.address ? formatAddress(partner.address) : null;
    const recentOrders = orders.slice(0, 3);

    return (
        <div className="space-y-3">
            {address && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                        <MapPin className="w-3.5 h-3.5" /> Adresse
                    </div>
                    <div className="text-sm font-semibold text-gray-800">{address}</div>
                </div>
            )}

            {partner.credit && (
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                            <Wallet className="w-3.5 h-3.5" /> Plafond
                        </div>
                        <div className="text-sm font-bold text-gray-700">{formatMoney(partner.credit.limit)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Utilisé</div>
                        <div className="text-sm font-bold text-amber-600">{formatMoney(partner.credit.used)}</div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Disponible</div>
                        <div className="text-sm font-bold text-emerald-600">{formatMoney(partner.credit.available)}</div>
                    </div>
                </div>
            )}

            {partner.order_history && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <History className="w-3.5 h-3.5 text-gray-400" />
                            <h3 className="text-[11px] font-bold text-gray-500 uppercase">Historique commandes</h3>
                        </div>
                        <button
                            onClick={() => navigate(`/telesales/orders?partner_id=${partner.id}&partner_name=${encodeURIComponent(partner.name)}`)}
                            className="flex items-center gap-0.5 text-[11px] font-bold text-sage-600 hover:underline"
                        >
                            Voir tout <ChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-gray-50">
                        <div>
                            <div className="text-[10px] text-gray-400">Commandes</div>
                            <div className="text-sm font-bold text-gray-800">{partner.order_history.total_orders_count}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">Valeur totale</div>
                            <div className="text-sm font-bold text-gray-800">{formatMoney(partner.order_history.total_orders_value)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] text-gray-400">Dernière commande</div>
                            <div className="text-sm font-bold text-gray-800">
                                {partner.order_history.last_order_date
                                    ? new Date(partner.order_history.last_order_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                    : '-'}
                            </div>
                        </div>
                    </div>
                    {loadingOrders ? (
                        <div className="flex items-center justify-center py-6 text-gray-400">
                            <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <p className="py-4 text-center text-xs text-gray-400">Aucune commande</p>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {recentOrders.map((o) => (
                                <button
                                    key={o.id}
                                    onClick={() => navigate(`/telesales/orders/${o.id}`)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-sage-50/50 transition-colors"
                                >
                                    <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                                        <ClipboardList className="w-3.5 h-3.5 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-gray-800 truncate">{o.bc_number || `#${o.id}`}</div>
                                    </div>
                                    <div className="text-xs font-bold text-gray-700 shrink-0">{formatMoney(o.final_total ?? o.total_amount)}</div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PartnerFicheCard;
