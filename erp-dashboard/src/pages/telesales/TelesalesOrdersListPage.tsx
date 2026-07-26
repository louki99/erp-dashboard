import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ClipboardList, RefreshCw, Plus, X } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { ListPanel, DetailHeader, EmptySelection, StatCard, StatusPill } from '@/components/telesales/panels';
import { useOrdersList } from '@/hooks/telesales/useTelesalesOrders';
import type { OrderStatus, TelesalesOrder } from '@/types/telesalesAgent.types';

const STATUS_LABELS: Record<string, string> = {
    draft: 'Brouillon',
    submitted: 'Soumise',
    confirmed: 'Confirmée',
    pending_derogation: 'Dérogation en attente',
    cancelled: 'Annulée',
};

const STATUS_ACCENT: Record<string, 'gray' | 'blue' | 'emerald' | 'amber' | 'red'> = {
    draft: 'gray',
    submitted: 'blue',
    confirmed: 'emerald',
    pending_derogation: 'amber',
    cancelled: 'red',
};

const formatMoney = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

// §correctif 2026-08 — real browsable order history for a partner's fiche
// (order_history on GET /planning|/visits is an aggregated snapshot only).
// ?partner_id=X scopes the list; the same screen also serves as "Mes commandes".
export const TelesalesOrdersListPage = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const partnerId = searchParams.get('partner_id');
    const partnerName = searchParams.get('partner_name');
    const [statusFilter, setStatusFilter] = useState('');

    const { orders, loading, refetch } = useOrdersList({
        status: statusFilter || undefined,
        partner_id: partnerId ? Number(partnerId) : undefined,
    });

    const clearPartnerFilter = () => {
        const next = new URLSearchParams(searchParams);
        next.delete('partner_id');
        next.delete('partner_name');
        setSearchParams(next);
    };

    const totalValue = useMemo(() => orders.reduce((sum, o) => sum + (o.final_total ?? o.total_amount), 0), [orders]);

    const leftContent = (
        <ListPanel
            icon={ClipboardList}
            title="Mes commandes"
            subtitle={`${orders.length} commande${orders.length !== 1 ? 's' : ''}`}
            accent="blue"
            items={orders}
            loading={loading}
            emptyIcon={ClipboardList}
            emptyText="Aucune commande"
            selectedId={null}
            getId={(o) => o.id}
            onSelect={(o) => navigate(`/telesales/orders/${o.id}`)}
            filters={
                <div className="space-y-2">
                    {partnerId && (
                        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] font-semibold text-blue-700">
                            <span className="truncate">{partnerName || `Partenaire #${partnerId}`}</span>
                            <button onClick={clearPartnerFilter} className="shrink-0 text-blue-400 hover:text-blue-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    >
                        <option value="">Tous les statuts</option>
                        {Object.keys(STATUS_LABELS).map((s) => (
                            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                    </select>
                </div>
            }
            renderRow={(o: TelesalesOrder) => (
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{o.bc_number || `#${o.id}`}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{o.partner?.name}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-700">{formatMoney(o.final_total ?? o.total_amount)}</p>
                        <StatusPill label={STATUS_LABELS[o.status as OrderStatus] ?? o.status_label ?? o.status} accent={STATUS_ACCENT[o.status as OrderStatus] ?? 'gray'} />
                    </div>
                </div>
            )}
        />
    );

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={ClipboardList}
                title={partnerId ? `Commandes — ${partnerName || `Partenaire #${partnerId}`}` : 'Mes commandes'}
                subtitle="Historique des commandes prises pendant les appels"
                accent="blue"
                actions={
                    <button
                        onClick={() => navigate('/telesales/orders/new')}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nouvelle commande
                    </button>
                }
            />
            <TelesalesSessionBanner />
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-3xl space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <StatCard label="Commandes" value={orders.length} icon={ClipboardList} accent="blue" muted={orders.length === 0} />
                        <StatCard label="Valeur totale" value={formatMoney(totalValue)} icon={ClipboardList} accent="emerald" muted={orders.length === 0} />
                    </div>
                    <EmptySelection icon={ClipboardList} title="Sélectionnez une commande" hint="Cliquez sur une commande de la liste pour l'ouvrir" />
                </div>
            </div>
        </div>
    );

    return (
        <MasterLayout
            leftContent={leftContent}
            mainContent={mainContent}
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                { icon: Plus, label: 'Nouvelle commande', variant: 'sage', onClick: () => navigate('/telesales/orders/new') },
                                { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};

export default TelesalesOrdersListPage;
