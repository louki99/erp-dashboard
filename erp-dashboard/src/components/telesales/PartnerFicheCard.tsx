// Fiche partenaire block reused on Planning/Visit detail panels — identity,
// address, credit and order history, all embedded on the visit/planning
// `partner` object (correctif 2026-08: previously silently null). Shows the
// real order list via GET /orders?partner_id=X since `order_history` is an
// aggregated snapshot only, not a browsable list.
import { MapPin, Wallet, History, ChevronRight, Loader2, ClipboardList, Phone, TrendingUp, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useOrdersList } from '@/hooks/telesales/useTelesalesOrders';
import type { TeleVisitPartner } from '@/types/telesalesAgent.types';

const formatMoney = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

const formatAddress = (a: NonNullable<TeleVisitPartner['address']>) => {
    const parts = [a.line1, a.line2, [a.postal_code, a.city].filter(Boolean).join(' '), a.region, a.country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : null;
};

const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

export const PartnerFicheCard = ({ partner }: { partner: TeleVisitPartner }) => {
    const navigate = useNavigate();
    const { orders, loading: loadingOrders } = useOrdersList({ partner_id: partner.id });
    const address = partner.address ? formatAddress(partner.address) : null;
    const recentOrders = orders.slice(0, 3);

    const creditUsedPercent = partner.credit && partner.credit.limit > 0
        ? Math.min(100, Math.round((partner.credit.used / partner.credit.limit) * 100))
        : 0;

    return (
        <div className="space-y-5">
            {/* Identity */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center shrink-0 text-sage-700 font-bold text-lg tracking-tight">
                        {initialsOf(partner.name)}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                        <h3 className="text-base font-bold text-gray-900 truncate">{partner.name}</h3>
                        <p className="text-sm text-gray-500 font-medium mt-0.5">{partner.code}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-sm text-gray-600">
                            {partner.phone && (
                                <span className="inline-flex items-center gap-1.5">
                                    <Phone className="w-3.5 h-3.5 text-sage-600" />
                                    {partner.phone}
                                </span>
                            )}
                            {address && (
                                <span className="inline-flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-sage-600" />
                                    <span className="truncate max-w-[280px]">{address}</span>
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Credit */}
            {partner.credit && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center">
                                <Wallet className="w-4 h-4 text-sage-600" />
                            </div>
                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Crédit client</h4>
                        </div>
                        <span className="text-xs font-semibold text-gray-400">{creditUsedPercent}% utilisé</span>
                    </div>

                    <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-5">
                        <div
                            className={`h-full rounded-full transition-all duration-500 ${
                                creditUsedPercent > 90 ? 'bg-red-500' : creditUsedPercent > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${creditUsedPercent}%` }}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="rounded-xl bg-gray-50 p-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Plafond</div>
                            <div className="text-sm font-bold text-gray-800">{formatMoney(partner.credit.limit)}</div>
                        </div>
                        <div className="rounded-xl bg-gray-50 p-3">
                            <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Utilisé</div>
                            <div className="text-sm font-bold text-amber-700">{formatMoney(partner.credit.used)}</div>
                        </div>
                        <div className="rounded-xl bg-emerald-50/70 p-3">
                            <div className="text-[10px] font-bold text-emerald-600/80 uppercase mb-1">Disponible</div>
                            <div className="text-sm font-bold text-emerald-700">{formatMoney(partner.credit.available)}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order history */}
            {partner.order_history && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center">
                                <History className="w-4 h-4 text-sage-600" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Historique commandes</h4>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {partner.order_history.total_orders_count} commande{partner.order_history.total_orders_count !== 1 ? 's' : ''} · panier moyen {formatMoney(partner.order_history.average_order_value)}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => navigate(`/telesales/orders?partner_id=${partner.id}&partner_name=${encodeURIComponent(partner.name)}`)}
                            className="flex items-center gap-0.5 text-xs font-bold text-sage-600 hover:text-sage-700 hover:underline"
                        >
                            Voir tout <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <div className="px-5 py-4 grid grid-cols-3 gap-4 border-b border-gray-50 bg-gray-50/30">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                                <Package className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">Commandes</div>
                                <div className="text-sm font-bold text-gray-800">{partner.order_history.total_orders_count}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                                <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">Valeur totale</div>
                                <div className="text-sm font-bold text-gray-800">{formatMoney(partner.order_history.total_orders_value)}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
                                <History className="w-3.5 h-3.5 text-gray-500" />
                            </div>
                            <div>
                                <div className="text-[10px] text-gray-400">Dernière</div>
                                <div className="text-sm font-bold text-gray-800">
                                    {partner.order_history.last_order_date
                                        ? new Date(partner.order_history.last_order_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
                                        : '-'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {loadingOrders ? (
                        <div className="flex items-center justify-center py-8 text-gray-400">
                            <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                    ) : recentOrders.length === 0 ? (
                        <div className="py-6 text-center">
                            <ClipboardList className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                            <p className="text-xs text-gray-400">Aucune commande récente</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {recentOrders.map((o) => (
                                <button
                                    key={o.id}
                                    onClick={() => navigate(`/telesales/orders/${o.id}`)}
                                    className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-sage-50/40 transition-colors group"
                                >
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                                        <ClipboardList className="w-4 h-4 text-blue-600" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs font-bold text-gray-800 truncate">{o.bc_number || `Commande #${o.id}`}</div>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{new Date(o.created_at).toLocaleDateString('fr-FR')}</div>
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
