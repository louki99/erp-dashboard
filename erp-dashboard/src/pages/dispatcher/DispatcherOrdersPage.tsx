import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    RefreshCw, Plus, Package2, Filter, X, Search, ChevronRight,
    Calendar, User, MapPin, Loader2,
    AlertCircle, Map, List, Route, Navigation, Phone, Clock,
    ArrowUpDown, ExternalLink, CreditCard, Banknote, ChevronDown,
    PanelRightClose, PanelRightOpen, Maximize2, SlidersHorizontal,
    Printer, Download,
} from 'lucide-react';
import { openPdf, downloadPdf } from '@/utils/pdfUtils';
import { useNavigate } from 'react-router-dom';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { OrdersMapView } from '@/components/dispatcher/OrdersMapView';
import type { MapBbox } from '@/components/dispatcher/OrdersMapView';
import {
    useDispatcherPendingOrders,
    useDispatcherOrderDetail,
    getTotal,
    getLastPage,
} from '@/hooks/dispatcher/useDispatcherOrders';
import type { DispatcherOrder, OrdersPendingFilters } from '@/types/dispatcher.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getSalesperson = (o: DispatcherOrder) =>
    o.salesperson_data?.salesperson ?? (o.salesperson ? { name: o.salesperson.name, code: undefined, phone: undefined } : null);

const getZone = (o: DispatcherOrder): string => {
    if (o.partner?.delivery_zone) return o.partner.delivery_zone;
    if (o.partner?.geo_area?.parent?.name) return o.partner.geo_area.parent.name;
    if (o.partner?.geo_area?.name) return o.partner.geo_area.name;
    // Fallback: first itinerary name (most common real-world case)
    const itin = o.partner?.active_itineraries?.[0];
    if (itin?.name) return itin.name;
    return '—';
};

const getItinerary = (o: DispatcherOrder) =>
    o.partner?.active_itineraries?.[0] ?? null;

// Always false now — `logistics_details.delivery_order_id` referenced the removed DO concept
// (docs §9 "REMOVED"). The "already assigned" idea doesn't apply the same way under missions:
// once a BC joins a mission it moves from `confirmed` to `converted_to_bl` server-side and simply
// stops appearing in GET /orders/pending — there's nothing left to flag client-side.
const isAssigned = (_o: DispatcherOrder) => false;

const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtAmount = (v: number | string) =>
    Number(v).toLocaleString('fr-FR') + ' MAD';

// ─── Status badge ─────────────────────────────────────────────────────────────

const BCStatusBadge = ({ status }: { status?: string }) => {
    const map: Record<string, string> = {
        confirmed: 'bg-green-100 text-green-800',
        pending:   'bg-yellow-100 text-yellow-800',
        validated: 'bg-blue-100 text-blue-800',
        draft:     'bg-gray-100 text-gray-700',
        cancelled: 'bg-red-100 text-red-700',
    };
    const cls = map[status ?? ''] ?? 'bg-gray-100 text-gray-600';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {status ?? '—'}
        </span>
    );
};

const AssignedBadge = () => (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" /> En DO
    </span>
);

const CanalBadge = ({ canal }: { canal?: string }) => {
    if (!canal) return null;
    const cls = canal === 'SFA' ? 'bg-violet-100 text-violet-700' : 'bg-blue-100 text-blue-700';
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${cls}`}>{canal}</span>;
};

// ─── Filter Panel ─────────────────────────────────────────────────────────────

const LS_SECTIONS = 'disp_orders_sections';

type SectionId = 'period' | 'zone' | 'commercial' | 'sort';

const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
    period: true,
    zone: true,
    commercial: true,
    sort: false,
};

const loadSections = (): Record<SectionId, boolean> => {
    try {
        const raw = localStorage.getItem(LS_SECTIONS);
        if (raw) return { ...DEFAULT_SECTIONS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return { ...DEFAULT_SECTIONS };
};

const saveSections = (s: Record<SectionId, boolean>) => {
    try { localStorage.setItem(LS_SECTIONS, JSON.stringify(s)); } catch { /* ignore */ }
};

// Collapsible filter section
interface FilterSectionProps {
    id: SectionId;
    icon: React.ReactNode;
    label: string;
    isActive: boolean;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

const FilterSection = ({ icon, label, isActive, open, onToggle, children }: FilterSectionProps) => (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
        <button
            type="button"
            onClick={onToggle}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-left transition-colors ${
                open ? 'bg-sage-50' : 'bg-white hover:bg-gray-50'
            }`}
        >
            <span className={`${open ? 'text-sage-600' : 'text-gray-400'} transition-colors`}>
                {icon}
            </span>
            <span className={`flex-1 text-xs font-semibold uppercase tracking-wide ${open ? 'text-sage-700' : 'text-gray-600'}`}>
                {label}
            </span>
            {isActive && !open && (
                <span className="w-2 h-2 rounded-full bg-sage-500 shrink-0" />
            )}
            {isActive && open && (
                <span className="px-1.5 py-0.5 bg-sage-100 text-sage-700 text-xs font-bold rounded-full leading-none">
                    actif
                </span>
            )}
            <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 shrink-0 ${open ? 'rotate-180' : ''}`}
            />
        </button>
        <div
            className={`transition-all duration-200 overflow-hidden ${open ? 'max-h-96' : 'max-h-0'}`}
        >
            <div className="px-3 pb-3 pt-2 bg-white space-y-2">
                {children}
            </div>
        </div>
    </div>
);

const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 focus:bg-white transition-colors';

// ─── Collapsed filter strip ───────────────────────────────────────────────────

const CollapsedFilterStrip = ({ activeCount, onOpen }: { activeCount: number; onOpen: () => void }) => (
    <div className="h-full w-11 bg-white border-l border-gray-100 flex flex-col items-center py-3 gap-3">
        <button
            onClick={onOpen}
            title="Afficher les filtres"
            className="p-2 rounded-xl bg-sage-50 hover:bg-sage-100 text-sage-600 transition-colors"
        >
            <PanelRightOpen className="w-4 h-4" />
        </button>

        <div className="relative">
            <div className="p-2 rounded-xl text-gray-400">
                <Filter className="w-4 h-4" />
            </div>
            {activeCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-sage-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                    {activeCount}
                </span>
            )}
        </div>

        <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-300 uppercase tracking-widest [writing-mode:vertical-lr] rotate-180">
                Filtres
            </span>
        </div>
    </div>
);

// ─── Filter Panel ─────────────────────────────────────────────────────────────

interface FilterPanelProps {
    filters: OrdersPendingFilters;
    onChange: (f: Partial<OrdersPendingFilters>) => void;
    onReset: () => void;
    onClose: () => void;
    activeCount: number;
}

const FilterPanel = ({ filters, onChange, onReset, onClose, activeCount }: FilterPanelProps) => {
    const [open, setOpen] = useState<Record<SectionId, boolean>>(loadSections);

    const toggle = (id: SectionId) => {
        setOpen((prev) => {
            const next = { ...prev, [id]: !prev[id] };
            saveSections(next);
            return next;
        });
    };

    const isPeriodActive = !!(filters.date_from || filters.date_to);
    const isZoneActive   = !!(filters.delivery_zone || filters.geo_area_id || filters.itinerary_id);
    const isCommActive   = !!(filters.salesperson_id);
    const isSortActive   = !!(filters.sort_by);

    return (
        <div className="h-full bg-white border-l border-gray-100 flex flex-col">
            {/* Header */}
            <div className="px-3 py-3.5 border-b border-gray-100 flex items-center gap-2 shrink-0 bg-gradient-to-r from-indigo-50/60 to-white">
                {/* Close sidebar */}
                <button
                    onClick={onClose}
                    title="Masquer les filtres"
                    className="p-1.5 rounded-lg hover:bg-white text-gray-400 hover:text-gray-600 transition-colors shrink-0"
                >
                    <PanelRightClose className="w-4 h-4" />
                </button>

                <SlidersHorizontal className="w-3.5 h-3.5 text-sage-600 shrink-0" />
                <span className="text-sm font-bold text-gray-900 flex-1 tracking-tight">Filtres</span>

                {activeCount > 0 && (
                    <span className="px-1.5 py-0.5 bg-sage-500 text-white text-xs rounded-full font-bold leading-none shrink-0">
                        {activeCount}
                    </span>
                )}

                {activeCount > 0 && (
                    <button
                        onClick={onReset}
                        title="Réinitialiser tous les filtres"
                        className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            {/* Sections */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">

                {/* Période */}
                <FilterSection
                    id="period" icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Période" isActive={isPeriodActive}
                    open={open.period} onToggle={() => toggle('period')}
                >
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">Du</span>
                        <input type="date" value={filters.date_from ?? ''}
                            onChange={(e) => onChange({ date_from: e.target.value || undefined })}
                            className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">Au</span>
                        <input type="date" value={filters.date_to ?? ''}
                            onChange={(e) => onChange({ date_to: e.target.value || undefined })}
                            className={inputCls} />
                    </div>
                    {isPeriodActive && (
                        <button
                            onClick={() => onChange({ date_from: undefined, date_to: undefined })}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                            Effacer les dates
                        </button>
                    )}
                </FilterSection>

                {/* Zone / Tournée */}
                <FilterSection
                    id="zone" icon={<MapPin className="w-3.5 h-3.5" />}
                    label="Zone / Tournée" isActive={isZoneActive}
                    open={open.zone} onToggle={() => toggle('zone')}
                >
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">Zone de livraison</span>
                        <input type="text" placeholder="Ex: ZONE-SUD…"
                            value={filters.delivery_zone ?? ''}
                            onChange={(e) => onChange({ delivery_zone: e.target.value || undefined })}
                            className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Navigation className="w-3 h-3" /> Secteur géo (ID)
                        </span>
                        <input type="number" placeholder="Ex: 22"
                            value={filters.geo_area_id ?? ''}
                            onChange={(e) => onChange({ geo_area_id: e.target.value ? Number(e.target.value) : undefined })}
                            className={inputCls} />
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                            <Route className="w-3 h-3" /> Tournée (ID)
                        </span>
                        <input type="number" placeholder="Ex: 1"
                            value={filters.itinerary_id ?? ''}
                            onChange={(e) => onChange({ itinerary_id: e.target.value ? Number(e.target.value) : undefined })}
                            className={inputCls} />
                    </div>
                    {isZoneActive && (
                        <button
                            onClick={() => onChange({ delivery_zone: undefined, geo_area_id: undefined, itinerary_id: undefined })}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                            Effacer zone / tournée
                        </button>
                    )}
                </FilterSection>

                {/* Commercial */}
                <FilterSection
                    id="commercial" icon={<User className="w-3.5 h-3.5" />}
                    label="Commercial" isActive={isCommActive}
                    open={open.commercial} onToggle={() => toggle('commercial')}
                >
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">ID commercial</span>
                        <input type="number" placeholder="Ex: 17"
                            value={filters.salesperson_id ?? ''}
                            onChange={(e) => onChange({ salesperson_id: e.target.value ? Number(e.target.value) : undefined })}
                            className={inputCls} />
                    </div>
                    {isCommActive && (
                        <button
                            onClick={() => onChange({ salesperson_id: undefined })}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                            Effacer commercial
                        </button>
                    )}
                </FilterSection>

                {/* Tri */}
                <FilterSection
                    id="sort" icon={<ArrowUpDown className="w-3.5 h-3.5" />}
                    label="Tri" isActive={isSortActive}
                    open={open.sort} onToggle={() => toggle('sort')}
                >
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">Trier par</span>
                        <select value={filters.sort_by ?? ''}
                            onChange={(e) => onChange({ sort_by: (e.target.value as OrdersPendingFilters['sort_by']) || undefined })}
                            className={inputCls}>
                            <option value="">Par défaut</option>
                            <option value="order_date">Date commande</option>
                            <option value="total_amount">Montant</option>
                            <option value="created_at">Date création</option>
                        </select>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 block mb-1">Direction</span>
                        <div className="grid grid-cols-2 gap-1.5">
                            {(['desc', 'asc'] as const).map((d) => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => onChange({ sort_dir: d })}
                                    className={`py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                                        (filters.sort_dir ?? 'desc') === d
                                            ? 'bg-sage-500 text-white border-sage-500'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                                    }`}
                                >
                                    {d === 'desc' ? '↓ Décroissant' : '↑ Croissant'}
                                </button>
                            ))}
                        </div>
                    </div>
                </FilterSection>
            </div>
        </div>
    );
};

// ─── Order Detail Panel ───────────────────────────────────────────────────────

const InfoRow = ({ label, value }: { label: string; value?: string | number | null }) => (
    <div className="flex justify-between items-start gap-2">
        <span className="text-xs text-gray-500 shrink-0">{label}</span>
        <span className="text-xs font-semibold text-gray-800 text-right">{value ?? '—'}</span>
    </div>
);

const SectionCard = ({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
            <div className={`p-1.5 rounded-lg ${color}`}>{icon}</div>
            <span className="text-sm font-semibold text-gray-900">{title}</span>
        </div>
        <div className="space-y-2">{children}</div>
    </div>
);

const OrderDetailPanel = ({
    order,
    loading,
    onExpand,
}: {
    order: DispatcherOrder | null;
    loading: boolean;
    onExpand?: () => void;
}) => {
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-3 text-gray-400">
                    <Loader2 className="w-7 h-7 animate-spin text-sage-400" />
                    <span className="text-sm">Chargement du bon de commande…</span>
                </div>
            </div>
        );
    }
    if (!order) return null;

    const sp = getSalesperson(order);
    const zone = getZone(order);
    const assigned = isAssigned(order);
    const fm = order.financial_metadata;
    const itin = getItinerary(order);

    return (
        <div className="h-full overflow-y-auto bg-slate-50 p-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                <div className="flex items-start justify-between mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-gray-400">Bon de Commande</span>
                            {order.canal && <CanalBadge canal={order.canal} />}
                        </div>
                        <div className="text-xl font-bold text-gray-900 tracking-tight">{order.order_code}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-1.5">
                            {onExpand && (
                                <button
                                    onClick={onExpand}
                                    title="Agrandir"
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-sage-600 transition-colors"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                onClick={() => openPdf('bc', order.id, { force: true })}
                                title="Imprimer le BC (PDF)"
                                className="p-1.5 rounded-lg hover:bg-sage-50 text-gray-400 hover:text-sage-600 transition-colors"
                            >
                                <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => downloadPdf('bc', order.id)}
                                title="Télécharger le BC (PDF)"
                                className="p-1.5 rounded-lg hover:bg-sage-50 text-gray-400 hover:text-sage-600 transition-colors"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                            <BCStatusBadge status={order.bc_status} />
                        </div>
                        {assigned && <AssignedBadge />}
                    </div>
                </div>

                {/* Amount breakdown */}
                <div className="bg-sage-50 rounded-xl border border-sage-100 p-3 mb-3">
                    {order.sub_total != null && (
                        <div className="flex justify-between text-xs text-sage-700 mb-1">
                            <span>Montant HT</span>
                            <span className="font-semibold">{fmtAmount(order.sub_total)}</span>
                        </div>
                    )}
                    {order.tax_amount != null && Number(order.tax_amount) > 0 && (
                        <div className="flex justify-between text-xs text-sage-600 mb-1">
                            <span>TVA</span>
                            <span className="font-semibold">{fmtAmount(order.tax_amount)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-sm text-indigo-900 font-bold border-t border-indigo-200 pt-1.5 mt-1.5">
                        <span>Total TTC</span>
                        <span>{fmtAmount(order.total_amount)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-xs text-gray-500 font-medium mb-1">Date commande</div>
                        <div className="text-sm font-semibold text-gray-800">{fmtDate(order.order_date ?? order.confirmed_at)}</div>
                    </div>
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                        <div className="text-xs text-gray-500 font-medium mb-1">Échéance</div>
                        <div className="text-sm font-semibold text-gray-800">{fmtDate(order.due_date)}</div>
                    </div>
                </div>

                {order.logistics_details?.delivery_date && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                        <Calendar className="w-3.5 h-3.5 shrink-0" />
                        Livraison prévue le {fmtDate(order.logistics_details.delivery_date)}
                    </div>
                )}
                {assigned && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl border border-amber-100">
                        <Clock className="w-3.5 h-3.5 shrink-0" />
                        Déjà assignée
                    </div>
                )}
            </div>

            {/* Financial */}
            {fm && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${fm.is_credit_sale ? 'bg-orange-100' : 'bg-green-100'}`}>
                            {fm.is_credit_sale
                                ? <CreditCard className="w-4 h-4 text-orange-600" />
                                : <Banknote className="w-4 h-4 text-green-600" />}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Paiement</span>
                        <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${fm.is_credit_sale ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {fm.is_credit_sale ? 'Crédit' : 'Comptant'}
                        </span>
                    </div>
                    <div className="space-y-2">
                        {fm.payment_method && <InfoRow label="Méthode" value={fm.payment_method} />}
                        {fm.stamp_duty != null && Number(fm.stamp_duty) > 0 && (
                            <InfoRow label="Timbre fiscal" value={fmtAmount(fm.stamp_duty)} />
                        )}
                    </div>
                </div>
            )}

            {/* Itinerary / tournée */}
            {itin && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-violet-100 rounded-lg">
                            <Route className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">Tournée</span>
                        {itin.pivot?.rank != null && (
                            <span className="ml-auto text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                                Rang #{itin.pivot.rank}
                            </span>
                        )}
                    </div>
                    <div className="space-y-2">
                        <InfoRow label="Nom" value={itin.name} />
                        <InfoRow label="Code" value={itin.code} />
                        {itin.frequency && <InfoRow label="Fréquence" value={itin.frequency} />}
                        {itin.pivot?.visit_date && (
                            <InfoRow label="Dernière visite" value={fmtDate(itin.pivot.visit_date)} />
                        )}
                    </div>
                </div>
            )}

            {/* Partner */}
            <SectionCard
                icon={<MapPin className="w-4 h-4 text-emerald-600" />}
                title="Client"
                color="bg-emerald-100"
            >
                <InfoRow label="Nom" value={order.partner?.name} />
                <InfoRow label="Code" value={order.partner?.code} />
                <InfoRow label="Ville" value={order.partner?.city} />
                {order.partner?.address && <InfoRow label="Adresse" value={order.partner.address} />}
                <InfoRow label="Zone livraison" value={zone !== '—' ? zone : undefined} />
                {order.partner?.geo_area && (
                    <InfoRow label="Secteur" value={`${order.partner.geo_area.name} (${order.partner.geo_area.code})`} />
                )}
                {order.partner?.geo_lat && order.partner?.geo_lng && (
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">GPS</span>
                        <a
                            href={`https://www.openstreetmap.org/?mlat=${order.partner.geo_lat}&mlon=${order.partner.geo_lng}#map=16`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-800 font-medium"
                        >
                            <ExternalLink className="w-3 h-3" />
                            Voir sur carte
                        </a>
                    </div>
                )}
            </SectionCard>


            {/* Salesperson */}
            {sp && (
                <SectionCard
                    icon={<User className="w-4 h-4 text-sage-600" />}
                    title="Commercial"
                    color="bg-blue-100"
                >
                    <InfoRow label="Nom" value={sp.name} />
                    {sp.code && <InfoRow label="Code" value={sp.code} />}
                    {sp.phone && (
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Téléphone</span>
                            <a href={`tel:${sp.phone}`}
                                className="flex items-center gap-1 text-xs text-sage-600 hover:text-sage-800 font-medium">
                                <Phone className="w-3 h-3" /> {sp.phone}
                            </a>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Products */}
            {order.order_products && order.order_products.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-amber-100 rounded-lg">
                            <Package2 className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-sm font-semibold text-gray-900">
                            Produits ({order.order_products.length})
                        </span>
                    </div>
                    <div className="space-y-2">
                        {order.order_products.map((p, i) => (
                            <div key={p.id ?? i}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                                <div className="min-w-0">
                                    <div className="text-xs font-medium text-gray-800 truncate">
                                        {p.product?.name ?? `Produit #${p.product_id}`}
                                    </div>
                                    {p.product?.sku && (
                                        <div className="text-xs text-gray-400 font-mono">{p.product.sku}</div>
                                    )}
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className="text-xs font-bold text-gray-800">
                                        {p.quantity} × {Number(p.unit_price).toLocaleString('fr-FR')}
                                    </div>
                                    {p.total_price != null && (
                                        <div className="text-xs text-sage-600 font-semibold">
                                            {Number(p.total_price).toLocaleString('fr-FR')} MAD
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type ViewMode = 'list' | 'map';

const DEFAULT_FILTERS: OrdersPendingFilters = { page: 1, per_page: 20 };
const LS_FILTERS      = 'disp_orders_filters';
const LS_SEARCH       = 'disp_orders_search';
const LS_VIEWMODE     = 'disp_orders_viewmode';
const LS_FILTER_OPEN  = 'disp_orders_filter_open';

const loadFilters = (): OrdersPendingFilters => {
    try {
        const raw = localStorage.getItem(LS_FILTERS);
        if (raw) return { ...DEFAULT_FILTERS, ...JSON.parse(raw), page: 1 };
    } catch { /* ignore */ }
    return { ...DEFAULT_FILTERS };
};

const saveFilters = (f: OrdersPendingFilters) => {
    try { localStorage.setItem(LS_FILTERS, JSON.stringify(f)); } catch { /* ignore */ }
};

const loadSearch = (): string => {
    try { return localStorage.getItem(LS_SEARCH) ?? ''; } catch { return ''; }
};

const loadViewMode = (): ViewMode => {
    try { return (localStorage.getItem(LS_VIEWMODE) as ViewMode) ?? 'list'; } catch { return 'list'; }
};

const loadFilterOpen = (): boolean => {
    try { const v = localStorage.getItem(LS_FILTER_OPEN); return v === null ? true : v === 'true'; } catch { return true; }
};

export const DispatcherOrdersPage = () => {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<OrdersPendingFilters>(loadFilters);
    const [search, setSearch] = useState<string>(loadSearch);
    const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);
    const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(loadFilterOpen);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedRows, setSelectedRows] = useState<DispatcherOrder[]>([]);
    const [detailModalOpen, setDetailModalOpen] = useState(false);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Persist all UI preferences
    useEffect(() => { saveFilters(filters); }, [filters]);
    useEffect(() => { try { localStorage.setItem(LS_SEARCH, search); } catch { /* ignore */ } }, [search]);
    useEffect(() => { try { localStorage.setItem(LS_VIEWMODE, viewMode); } catch { /* ignore */ } }, [viewMode]);
    useEffect(() => { try { localStorage.setItem(LS_FILTER_OPEN, String(filterPanelOpen)); } catch { /* ignore */ } }, [filterPanelOpen]);

    const { data, loading, error, refetch } = useDispatcherPendingOrders({
        ...filters,
        search: search || undefined,
    });

    const { data: detail, loading: detailLoading } = useDispatcherOrderDetail(selectedId);

    const rowData = data?.data ?? [];
    const totalCount = data ? getTotal(data) : 0;
    const lastPage   = data ? getLastPage(data) : 1;

    const activeFilterCount = Object.entries(filters).filter(
        ([k, v]) => !['page', 'per_page', 'sort_dir'].includes(k) && v != null && v !== ''
    ).length + (search ? 1 : 0);

    const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setSearch(val);
        if (searchTimer.current) clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => setFilters((f) => ({ ...f, page: 1 })), 400);
    }, []);

    const handleFilterChange = (partial: Partial<OrdersPendingFilters>) => {
        setFilters((f) => ({ ...f, ...partial, page: 1 }));
    };

    const handleReset = () => {
        setFilters(DEFAULT_FILTERS);
        setSearch('');
        try { localStorage.removeItem(LS_FILTERS); localStorage.removeItem(LS_SEARCH); } catch { /* ignore */ }
    };

    const handleBboxChange = useCallback((bbox: MapBbox | null) => {
        if (bbox) {
            setFilters((f) => ({ ...f, page: 1, lat_min: bbox.lat_min, lat_max: bbox.lat_max, lng_min: bbox.lng_min, lng_max: bbox.lng_max }));
        } else {
            setFilters((f) => { const { lat_min, lat_max, lng_min, lng_max, ...rest } = f; return { ...rest, page: 1 }; });
        }
    }, []);

    // Removable chips summarizing every active filter at a glance — visible regardless of whether
    // the filter panel itself is open or collapsed, so the dispatcher never loses track of what's
    // narrowing the list.
    const activeFilterChips = useMemo(() => {
        const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
        if (search) chips.push({ key: 'search', label: `« ${search} »`, onRemove: () => setSearch('') });
        if (filters.date_from || filters.date_to) {
            chips.push({
                key: 'period',
                label: `${filters.date_from ?? '…'} → ${filters.date_to ?? '…'}`,
                onRemove: () => handleFilterChange({ date_from: undefined, date_to: undefined }),
            });
        }
        if (filters.delivery_zone) chips.push({ key: 'zone', label: `Zone: ${filters.delivery_zone}`, onRemove: () => handleFilterChange({ delivery_zone: undefined }) });
        if (filters.geo_area_id) chips.push({ key: 'geo', label: `Secteur #${filters.geo_area_id}`, onRemove: () => handleFilterChange({ geo_area_id: undefined }) });
        if (filters.itinerary_id) chips.push({ key: 'itin', label: `Tournée #${filters.itinerary_id}`, onRemove: () => handleFilterChange({ itinerary_id: undefined }) });
        if (filters.salesperson_id) chips.push({ key: 'sp', label: `Commercial #${filters.salesperson_id}`, onRemove: () => handleFilterChange({ salesperson_id: undefined }) });
        if (filters.sort_by) chips.push({ key: 'sort', label: `Tri: ${filters.sort_by}`, onRemove: () => handleFilterChange({ sort_by: undefined }) });
        if (filters.lat_min != null) chips.push({ key: 'bbox', label: 'Zone carte', onRemove: () => handleBboxChange(null) });
        return chips;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, filters]);

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'order_code',
            headerName: 'N° BC',
            width: 185,
            cellRenderer: (p: { value: string; data: DispatcherOrder }) => (
                <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-sage-700 truncate">{p.value ?? '—'}</span>
                    {p.data?.canal && <CanalBadge canal={p.data.canal} />}
                    {isAssigned(p.data) && <Clock className="w-3 h-3 text-amber-500 shrink-0" />}
                </div>
            ),
        },
        {
            field: 'partner.code',
            headerName: 'Code Client',
            width: 115,
            cellRenderer: (p: { value?: string }) => (
                <span className="font-mono text-xs font-semibold text-sage-700">{p.value ?? '—'}</span>
            ),
        },
        {
            field: 'partner.name',
            headerName: 'Client',
            flex: 1,
            minWidth: 150,
            cellRenderer: (p: { value: string }) => (
                <span className="font-medium text-gray-900 truncate">{p.value ?? '—'}</span>
            ),
        },
        {
            field: 'partner.city',
            headerName: 'Ville',
            width: 100,
            cellRenderer: (p: { value?: string }) => (
                <span className="text-xs text-gray-500">{p.value ?? '—'}</span>
            ),
        },
        {
            headerName: 'Tournée / Zone',
            width: 140,
            valueGetter: (p: { data: DispatcherOrder }) => getZone(p.data),
            cellRenderer: (p: { value: string; data: DispatcherOrder }) => {
                const itin = getItinerary(p.data);
                return (
                    <div className="min-w-0">
                        <div className="text-xs text-violet-700 font-medium truncate">{p.value}</div>
                        {itin?.pivot?.rank != null && (
                            <div className="text-xs text-gray-400">rang {itin.pivot.rank}</div>
                        )}
                    </div>
                );
            },
        },
        {
            headerName: 'Commercial',
            width: 130,
            valueGetter: (p: { data: DispatcherOrder }) => getSalesperson(p.data)?.name ?? '—',
            cellRenderer: (p: { value: string }) => (
                <span className="text-xs text-gray-600 truncate">{p.value}</span>
            ),
        },
        {
            field: 'total_amount',
            headerName: 'Montant',
            width: 125,
            cellRenderer: (p: { value: number | string }) => (
                <span className="font-semibold text-gray-800 text-xs">{fmtAmount(p.value)}</span>
            ),
        },
        {
            field: 'order_date',
            headerName: 'Date',
            width: 100,
            cellRenderer: (p: { value?: string; data: DispatcherOrder }) => (
                <span className="text-xs text-gray-500">{fmtDate(p.value ?? p.data?.confirmed_at)}</span>
            ),
        },
        {
            headerName: '',
            width: 48,
            sortable: false,
            filter: false,
            cellRenderer: (p: { data: DispatcherOrder }) => (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!p.data) return;
                        setSelectedId(p.data.id);
                        setDetailModalOpen(true);
                    }}
                    title="Voir le détail complet"
                    className="p-1 rounded-lg hover:bg-sage-50 text-gray-300 hover:text-sage-600 transition-colors"
                >
                    <Maximize2 className="w-3.5 h-3.5" />
                </button>
            ),
        },
    ], []);

    const handleRowClick = (row: DispatcherOrder) => setSelectedId(row.id);
    // Double-click is a more deliberate "show me everything" gesture than a single click, which
    // already does double duty (select for the right panel + toggle the multi-select checkbox in
    // list mode) — opens the same detail content in a focused modal instead of just the side panel.
    const handleRowDoubleClick = (row: DispatcherOrder) => {
        setSelectedId(row.id);
        setDetailModalOpen(true);
    };
    const handleSelectionChanged = useCallback((rows: DispatcherOrder[]) => setSelectedRows(rows), []);
    // BC → Mission planning now happens in the dedicated workspace (drag&drop + rider/vehicle
    // picker, docs §8.1) — this page hands off the current selection via navigation state so it
    // doesn't have to be rebuilt from scratch over there. State only, not a query param: it's a
    // one-shot handoff, not something that should survive a refresh or be bookmarkable.
    const goToMissionWorkspace = () => {
        navigate('/dispatcher/workspace/missions', {
            state: selectedRows.length > 0 ? { preselectedOrderIds: selectedRows.map((o) => o.id) } : undefined,
        });
    };

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h1 className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-sage-700 tracking-tight">Commandes BC</h1>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {loading ? '…' : `${totalCount} commande${totalCount !== 1 ? 's' : ''} confirmée${totalCount !== 1 ? 's' : ''}`}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {/* View toggle */}
                                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                                        <button
                                            onClick={() => setViewMode('list')}
                                            className={`p-1.5 ${viewMode === 'list' ? 'bg-sage-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
                                            title="Vue liste"
                                        >
                                            <List className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setViewMode('map')}
                                            className={`p-1.5 ${viewMode === 'map' ? 'bg-sage-500 text-white' : 'text-gray-400 hover:bg-gray-50'}`}
                                            title="Vue carte"
                                        >
                                            <Map className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <button onClick={refetch} disabled={loading}
                                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Rafraîchir">
                                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text" value={search} onChange={handleSearchChange}
                                    placeholder="Commande, client, code…"
                                    className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {/* Active filter chips — visible whether or not the filter panel is open */}
                            {activeFilterChips.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-2.5">
                                    {activeFilterChips.map((chip) => (
                                        <button
                                            key={chip.key}
                                            onClick={chip.onRemove}
                                            className="group flex items-center gap-1 pl-2.5 pr-1.5 py-1 bg-sage-50 hover:bg-sage-100 border border-sage-100 text-sage-700 text-xs font-medium rounded-full transition-colors"
                                        >
                                            <span className="truncate max-w-[140px]">{chip.label}</span>
                                            <X className="w-3 h-3 text-sage-400 group-hover:text-sage-700 shrink-0" />
                                        </button>
                                    ))}
                                    <button
                                        onClick={handleReset}
                                        className="text-xs font-semibold text-gray-400 hover:text-red-600 px-1.5 transition-colors"
                                    >
                                        Tout effacer
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Selection bar */}
                        {selectedRows.length > 0 && (
                            <div className="px-3 py-2 bg-sage-500 flex items-center justify-between shrink-0">
                                <span className="text-xs font-semibold text-white">
                                    {selectedRows.length} sélectionnée{selectedRows.length > 1 ? 's' : ''}
                                </span>
                                <button onClick={goToMissionWorkspace}
                                    className="flex items-center gap-1.5 px-3 py-1 bg-white text-sage-700 text-xs font-bold rounded-lg hover:bg-sage-50 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Planifier (Mission)
                                </button>
                            </div>
                        )}

                        {/* Map bbox info bar */}
                        {(filters.lat_min != null) && (
                            <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between shrink-0">
                                <span className="text-xs text-amber-700 font-medium flex items-center gap-1.5">
                                    <Map className="w-3.5 h-3.5" /> Zone dessinée active
                                </span>
                                <button onClick={() => handleBboxChange(null)}
                                    className="text-xs text-amber-700 hover:text-red-600 font-semibold">
                                    Effacer
                                </button>
                            </div>
                        )}

                        {error && (
                            <div className="px-4 py-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 shrink-0">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                            </div>
                        )}

                        {/* Content area */}
                        <div className="flex-1 min-h-0">
                            {viewMode === 'map' ? (
                                <OrdersMapView
                                    orders={rowData}
                                    selectedId={selectedId}
                                    onSelectOrder={handleRowClick}
                                    onBboxChange={handleBboxChange}
                                />
                            ) : loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                    <span className="text-sm">Chargement…</span>
                                </div>
                            ) : rowData.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 p-4">
                                    <Package2 className="w-10 h-10 text-gray-200" />
                                    <div className="text-center">
                                        <div className="text-sm font-medium text-gray-500">Aucune commande</div>
                                        <div className="text-xs mt-1 text-gray-400">Modifiez les filtres</div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full p-2">
                                    <DataGrid
                                        rowData={rowData}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        onRowSelected={handleRowClick}
                                        onRowDoubleClicked={handleRowDoubleClick}
                                        rowSelection="multiple"
                                        onSelectionChanged={handleSelectionChanged}
                                        getRowClass={(p) =>
                                            isAssigned(p.data)
                                                ? 'bg-amber-50 text-gray-500'
                                                : p.data?.id === selectedId
                                                ? 'bg-sage-50'
                                                : ''
                                        }
                                    />
                                </div>
                            )}
                        </div>

                        {/* Pagination (list only) */}
                        {viewMode === 'list' && lastPage > 1 && (
                            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between shrink-0">
                                <button
                                    onClick={() => setFilters((f) => ({ ...f, page: Math.max(1, (f.page ?? 1) - 1) }))}
                                    disabled={(filters.page ?? 1) <= 1}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-medium"
                                >← Préc.</button>
                                <span className="text-xs text-gray-500">Page {filters.page ?? 1} / {lastPage}</span>
                                <button
                                    onClick={() => setFilters((f) => ({ ...f, page: Math.min(lastPage, (f.page ?? 1) + 1) }))}
                                    disabled={(filters.page ?? 1) >= lastPage}
                                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 font-medium"
                                >Suiv. →</button>
                            </div>
                        )}
                    </div>
                }
                mainContent={
                    !selectedId ? (
                        <div className="h-full flex flex-col items-center justify-center bg-slate-50 p-8">
                            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 text-center max-w-xs">
                                <Package2 className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-600">Sélectionnez une commande</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    Cliquez sur une ligne ou un pin pour un aperçu, double-cliquez pour le détail complet
                                </p>
                                {selectedRows.length > 0 && (
                                    <button onClick={goToMissionWorkspace}
                                        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-sage-500 text-white text-sm font-semibold rounded-xl hover:bg-sage-600 transition-colors">
                                        <Plus className="w-4 h-4" />
                                        Planifier une mission ({selectedRows.length})
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <OrderDetailPanel order={detail} loading={detailLoading} onExpand={() => setDetailModalOpen(true)} />
                    )
                }
                rightContent={
                    filterPanelOpen ? (
                        <FilterPanel
                            filters={filters}
                            onChange={handleFilterChange}
                            onReset={handleReset}
                            onClose={() => setFilterPanelOpen(false)}
                            activeCount={activeFilterCount}
                        />
                    ) : (
                        <CollapsedFilterStrip
                            activeCount={activeFilterCount}
                            onOpen={() => setFilterPanelOpen(true)}
                        />
                    )
                }
            />

            <Modal
                isOpen={detailModalOpen}
                onClose={() => setDetailModalOpen(false)}
                title={detail?.order_code ?? 'Détail de la commande'}
                size="xl"
            >
                <OrderDetailPanel order={detail} loading={detailLoading} />
            </Modal>
        </>
    );
};
