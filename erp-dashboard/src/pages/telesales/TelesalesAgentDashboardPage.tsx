import { useNavigate } from 'react-router-dom';
import {
    CalendarDays, FileText, ShoppingCart, Briefcase, RotateCcw, PhoneCall, ChevronRight,
    Headset, Clock, Package, Users, RefreshCw, Phone, ClipboardList, Loader2,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { ListPanel, DetailHeader, StatCard } from '@/components/telesales/panels';
import { usePlanning, useVisitsHistory } from '@/hooks/telesales/useTelesalesVisits';
import { useScheduledOrders } from '@/hooks/telesales/useTelesalesOrders';
import type { TeleVisit, TelesalesOrder } from '@/types/telesalesAgent.types';

const todayIso = () => new Date().toISOString().slice(0, 10);

const visitStatus = (visit: TeleVisit) =>
    visit.started_at
        ? { label: 'En cours', cls: 'bg-amber-100 text-amber-700' }
        : { label: 'En attente', cls: 'bg-gray-100 text-gray-500' };

// Écran 1 (docs §8.1) — bandeau de session + KPIs du jour + accès rapide aux
// autres écrans du poste. "Cockpit" (2026-08) is the all-in-one in-call
// workspace (planning/portefeuille → fiche → catalogue → panier, no page
// navigation) — the primary entry point for actually working a call.
const SECTIONS = [
    { icon: Headset, label: 'Cockpit Télévendeur', description: "Appel en cours : fiche, qualification et commande sur un seul écran", route: '/telesales/cockpit' },
    { icon: CalendarDays, label: 'Planning / Semainier', description: 'Planifier un appel futur, semainier', route: '/telesales/planning' },
    { icon: ShoppingCart, label: 'Catalogue & Prise de commande', description: 'Rechercher un produit, créer une commande', route: '/telesales/catalog' },
    { icon: ClipboardList, label: 'Mes commandes', description: 'Historique des commandes prises pendant les appels', route: '/telesales/orders' },
    { icon: Briefcase, label: 'Devis B2B', description: 'Créer, envoyer, convertir un devis', route: '/telesales/devis' },
    { icon: Briefcase, label: 'Mon portefeuille', description: 'Partenaires assignés par le superviseur', route: '/telesales/portfolio' },
    { icon: RotateCcw, label: 'Retours clients', description: 'Retours commerciaux différés', route: '/telesales/returns' },
];

const formatAmount = (amount: number) =>
    `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;

export const TelesalesAgentDashboardPage = () => {
    const navigate = useNavigate();
    const today = todayIso();

    const { visits, loading: loadingVisits, refetch: refetchVisits } = usePlanning(today);
    const { visits: historyVisits, loading: loadingHistory, refetch: refetchHistory } = useVisitsHistory({ date_from: today, date_to: today });
    const { orders, loading: loadingOrders, refetch: refetchOrders } = useScheduledOrders(today);

    const qualifiedCount = historyVisits.filter((v) => v.outcome).length;

    const refetchAll = () => {
        refetchVisits();
        refetchHistory();
        refetchOrders();
    };

    // ── Left panel — appels du jour ───────────────────────────────────────────

    const leftContent = (
        <ListPanel
            icon={Phone}
            title="Appels du jour"
            subtitle={`${visits.length} appel${visits.length !== 1 ? 's' : ''}`}
            accent="sage"
            items={visits}
            loading={loadingVisits}
            emptyIcon={CalendarDays}
            emptyText="Aucun appel planifié aujourd'hui"
            selectedId={null}
            getId={(v) => v.id}
            onSelect={() => navigate('/telesales/planning')}
            renderRow={(v) => {
                const s = visitStatus(v);
                return (
                    <>
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
                                <Clock className="w-3.5 h-3.5 text-sage-600" />
                                {v.scheduled_at
                                    ? new Date(v.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                    : '--:--'}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${s.cls}`}>
                                {s.label}
                            </span>
                        </div>
                        <p className="text-xs font-semibold text-gray-800 truncate">
                            {v.partner?.name ?? `Partenaire #${v.partner_id}`}
                        </p>
                        {v.partner?.code && (
                            <p className="text-[10px] text-gray-400 mt-0.5">{v.partner.code}</p>
                        )}
                    </>
                );
            }}
        />
    );

    // ── Center panel — accueil du poste ───────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={Headset}
                title="Poste Télévendeur"
                subtitle={new Date(`${today}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                accent="sage"
            />
            <TelesalesSessionBanner />

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-5xl space-y-8">
                    {/* KPIs du jour */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard
                            label="Appels planifiés"
                            value={visits.length}
                            icon={Phone}
                            accent="sage"
                            muted={visits.length === 0}
                        />
                        <StatCard
                            label="Appels qualifiés"
                            value={loadingHistory ? '…' : qualifiedCount}
                            icon={FileText}
                            accent="emerald"
                            muted={!loadingHistory && qualifiedCount === 0}
                        />
                        <StatCard
                            label="Commandes programmées"
                            value={orders.length}
                            icon={ClipboardList}
                            accent="blue"
                            muted={orders.length === 0}
                        />
                    </div>

                    {/* §8.1 — commandes programmées du jour */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Commandes programmées</h3>
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            {loadingOrders ? (
                                <div className="flex items-center justify-center py-10 text-gray-400 text-xs">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2 text-sage-500" />
                                    Chargement...
                                </div>
                            ) : orders.length === 0 ? (
                                <p className="py-10 text-center text-xs text-gray-400">Aucune commande programmée</p>
                            ) : (
                                <div className="divide-y divide-gray-100">
                                    {orders.map((o: TelesalesOrder) => (
                                        <button
                                            key={o.id}
                                            onClick={() => navigate(`/telesales/orders/${o.id}`)}
                                            className="w-full flex items-center gap-4 px-5 py-3.5 text-left hover:bg-sage-50/50 transition-colors group"
                                        >
                                            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                                <ClipboardList className="w-4 h-4 text-blue-600" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-gray-900 truncate">
                                                    {o.bc_number || `#${o.id}`}
                                                </div>
                                                <div className="text-xs text-gray-400 truncate">{o.partner?.name}</div>
                                            </div>
                                            <div className="text-sm font-bold text-gray-800 shrink-0">
                                                {formatAmount(o.final_total ?? o.total_amount)}
                                            </div>
                                            <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                                {o.status_label || o.status}
                                            </span>
                                            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-sage-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Accès rapide */}
                    <section>
                        <h3 className="text-sm font-bold text-gray-900 mb-3">Accès rapide</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                            {SECTIONS.map(({ icon: Icon, label, description, route }) => (
                                <button
                                    key={label}
                                    onClick={() => navigate(route)}
                                    className="text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-sage-300 hover:shadow-md transition-all group"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="w-10 h-10 rounded-xl bg-sage-50 flex items-center justify-center mb-3">
                                            <Icon className="w-5 h-5 text-sage-600" />
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-sage-500 group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                    <div className="text-sm font-bold text-gray-800">{label}</div>
                                    <div className="text-xs text-gray-400 mt-1">{description}</div>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => navigate('/telesales/planning')}
                            className="mt-6 flex items-center gap-2 px-5 py-3 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow"
                        >
                            <PhoneCall className="w-4 h-4" />
                            Appel libre
                        </button>
                    </section>
                </div>
            </div>
        </div>
    );

    // ── Right panel — actions ─────────────────────────────────────────────────

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        { icon: CalendarDays, label: 'Planning', variant: 'sage', onClick: () => navigate('/telesales/planning') },
                        { icon: Package, label: 'Catalogue', onClick: () => navigate('/telesales/catalog') },
                        { icon: Users, label: 'Portefeuille', onClick: () => navigate('/telesales/portfolio') },
                    ],
                },
                {
                    items: [
                        { icon: RefreshCw, label: 'Rafraîchir', onClick: refetchAll },
                    ],
                },
            ]}
        />
    );

    return (
        <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
    );
};

export default TelesalesAgentDashboardPage;
