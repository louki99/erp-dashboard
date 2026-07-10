import { useMemo, useState } from 'react';
import {
    Warehouse,
    Plus,
    RefreshCw,
    MapPin,
    Layers,
    ShieldAlert,
    Loader2,
    Building2,
    Search,
    X,
    CheckCircle2,
    XCircle,
    ToggleRight,
    ToggleLeft,
    ChevronRight,
    Truck,
    Cpu,
    Activity,
    SlidersHorizontal,
    Package2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { usePermissions } from '@/hooks/usePermissions';
import {
    useWarehouses,
    useCreateWarehouse,
    useUpdateWarehouse,
    useWarehouseLocations,
    useCreateLocation,
    useUpdateLocation,
} from '@/hooks/stock/useWarehouse';
import type {
    Warehouse as WarehouseT,
    StorageLocation,
    WarehouseType,
    StorageLocationType,
    CreateWarehousePayload,
    CreateLocationPayload,
} from '@/types/stock.types';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

// ─── Config maps ──────────────────────────────────────────────────────────────

const WAREHOUSE_TYPE_CFG: Record<WarehouseType, {
    label: string; icon: typeof Building2; color: string; bg: string; border: string; glow: string; accent: string;
}> = {
    central: {
        label: 'Dépôt Central', icon: Building2,
        color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', glow: 'from-blue-50 to-indigo-50', accent: 'bg-blue-500',
    },
    delivery_van: {
        label: 'Fourgon Livraison', icon: Truck,
        color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', glow: 'from-amber-50 to-orange-50', accent: 'bg-amber-500',
    },
    system_virtual: {
        label: 'Virtuel Système', icon: Cpu,
        color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200', glow: 'from-purple-50 to-violet-50', accent: 'bg-purple-500',
    },
};

const LOCATION_TYPE_CFG: Record<StorageLocationType, {
    label: string; color: string; bg: string; border: string; accent: string;
}> = {
    SELLABLE:            { label: 'Vendable',          color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', accent: 'bg-emerald-500' },
    DEPOT:               { label: 'Dépôt Principal',   color: 'text-blue-700',    bg: 'bg-blue-50',     border: 'border-blue-200',    accent: 'bg-blue-500'    },
    DAMAGED:             { label: 'Endommagé',          color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     accent: 'bg-red-500'     },
    EXPIRED:             { label: 'Expiré',             color: 'text-rose-700',    bg: 'bg-rose-50',     border: 'border-rose-200',    accent: 'bg-rose-500'    },
    QUARANTINE:          { label: 'Quarantaine',        color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   accent: 'bg-amber-500'   },
    SCRAP:               { label: 'Rebut',              color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  accent: 'bg-orange-500'  },
    RETURN_TO_SUPPLIER:  { label: 'Retour Fourn.',      color: 'text-violet-700',  bg: 'bg-violet-50',   border: 'border-violet-200',  accent: 'bg-violet-500'  },
    DELIVERY_VAN:        { label: 'Fourgon',            color: 'text-yellow-700',  bg: 'bg-yellow-50',   border: 'border-yellow-200',  accent: 'bg-yellow-500'  },
    VIRTUAL:             { label: 'Virtuel',             color: 'text-gray-600',    bg: 'bg-gray-100',    border: 'border-gray-200',    accent: 'bg-gray-400'    },
};

const SUPERVISOR_TYPES: StorageLocationType[] = ['DAMAGED', 'EXPIRED', 'SCRAP'];
const CREATABLE_LOCATION_TYPES = (Object.keys(LOCATION_TYPE_CFG) as StorageLocationType[]).filter(t => t !== 'DELIVERY_VAN');

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const StatusPill = ({ active, size = 'sm' }: { active: boolean; size?: 'xs' | 'sm' }) => (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium
        ${size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs'}
        ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
        {active
            ? <CheckCircle2 className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            : <XCircle     className={size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
        {active ? 'Actif' : 'Inactif'}
    </span>
);

// ─── Warehouse card for left panel ───────────────────────────────────────────

const WarehouseCard = ({
    warehouse,
    selected,
    onClick,
}: {
    warehouse: WarehouseT;
    selected: boolean;
    onClick: () => void;
}) => {
    const cfg = WAREHOUSE_TYPE_CFG[warehouse.type];
    const Icon = cfg.icon;
    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-all hover:bg-slate-50 group
                ${selected ? 'bg-indigo-50/70 border-l-2 border-l-indigo-500' : 'border-l-2 border-l-transparent'}`}
        >
            <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} ${selected ? 'shadow-sm' : ''}`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <span className={`text-xs font-semibold truncate ${selected ? 'text-indigo-900' : 'text-gray-800'}`}>
                            {warehouse.name}
                        </span>
                        {!warehouse.is_active && (
                            <XCircle className="w-3 h-3 text-gray-300 shrink-0" />
                        )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400 font-mono">{warehouse.branch_code}</span>
                        <span className={`text-[10px] px-1.5 py-0 rounded-full ${cfg.bg} ${cfg.color} font-medium`}>
                            {cfg.label}
                        </span>
                    </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-0.5">
                    <span className="text-sm font-bold text-indigo-600">{warehouse.storage_locations_count ?? 0}</span>
                    <span className="text-[10px] text-gray-400">empl.</span>
                </div>
            </div>
        </button>
    );
};

// ─── Empty state / Dashboard ─────────────────────────────────────────────────

const WarehouseDashboard = ({ warehouses }: { warehouses: WarehouseT[] }) => {
    const total     = warehouses.length;
    const active    = warehouses.filter(w => w.is_active).length;
    const central   = warehouses.filter(w => w.type === 'central').length;
    const totalLoc  = warehouses.reduce((s, w) => s + (w.storage_locations_count ?? 0), 0);

    const kpis = [
        { label: 'Total dépôts',   value: total,    icon: Building2,     color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-100' },
        { label: 'Actifs',         value: active,   icon: CheckCircle2,  color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
        { label: 'Centraux',       value: central,  icon: Warehouse,     color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-100' },
        { label: 'Emplacements',   value: totalLoc, icon: Layers,        color: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100' },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-white">
            {/* ── Top hero strip ───────────────────────────── */}
            <div className="flex items-center gap-5 px-8 pt-8 pb-6 border-b border-gray-100">
                <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-200 flex items-center justify-center shadow-lg shadow-indigo-100">
                        <Warehouse className="w-8 h-8 text-indigo-600" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-3 h-3 text-white" />
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Gestion des Entrepôts</h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Sélectionnez un entrepôt dans la liste pour consulter et gérer ses emplacements de stockage.
                    </p>
                </div>
            </div>

            {/* ── KPI Grid ─────────────────────────────────── */}
            <div className="px-8 pt-6">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vue d'ensemble</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-2xl p-5 shadow-sm`}>
                            <div className={`w-9 h-9 rounded-xl ${k.bg} border ${k.border} flex items-center justify-center mb-4`}>
                                <k.icon className={`w-5 h-5 ${k.color}`} />
                            </div>
                            <div className={`text-4xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1">{k.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Type breakdown ────────────────────────────── */}
            {warehouses.length > 0 && (
                <div className="px-8 pt-6 pb-8">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Répartition par type</p>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {(['central', 'delivery_van', 'system_virtual'] as WarehouseType[]).map(type => {
                            const cnt = warehouses.filter(w => w.type === type).length;
                            if (cnt === 0) return null;
                            const cfg = WAREHOUSE_TYPE_CFG[type];
                            const Icon = cfg.icon;
                            const pct = total > 0 ? (cnt / total) * 100 : 0;
                            return (
                                <div key={type} className={`bg-white border ${cfg.border} rounded-2xl p-4 shadow-sm`}>
                                    <div className="flex items-center justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-xl ${cfg.bg} flex items-center justify-center`}>
                                                <Icon className={`w-4 h-4 ${cfg.color}`} />
                                            </div>
                                            <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                                        </div>
                                        <span className="text-2xl font-bold text-gray-900">{cnt}</span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${cfg.accent ?? 'bg-gray-400'}`}
                                            style={{ width: `${pct}%`, transition: 'width 0.6s ease' }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                                        <span>{Math.round(pct)}% du total</span>
                                        <span>{total} dépôts</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Warehouse Detail ─────────────────────────────────────────────────────────

const WarehouseDetail = ({
    warehouse,
    isAdmin,
    onAddLocation,
}: {
    warehouse: WarehouseT;
    isAdmin: boolean;
    onAddLocation: () => void;
}) => {
    const { data: locData, isLoading } = useWarehouseLocations(warehouse.id);
    const updateLoc = useUpdateLocation();
    const locations = locData?.locations ?? [];
    const isVan = warehouse.type === 'delivery_van';

    const [typeFilter, setTypeFilter] = useState<StorageLocationType | 'ALL'>('ALL');
    const [tempTypeFilter, setTempTypeFilter] = useState<StorageLocationType | 'ALL'>('ALL');
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [locSearch, setLocSearch] = useState('');

    const filtered = (typeFilter === 'ALL' ? locations : locations.filter(l => l.location_type === typeFilter))
        .filter(l => !locSearch ||
            l.location_name.toLowerCase().includes(locSearch.toLowerCase()) ||
            l.location_code.toLowerCase().includes(locSearch.toLowerCase()) ||
            (l.description ?? '').toLowerCase().includes(locSearch.toLowerCase()));

    const activeCount   = locations.filter(l => l.is_active).length;
    const totalCapacity = locations.reduce((s, l) => s + (l.capacity ?? 0), 0);
    const totalUsed     = locations.reduce((s, l) => s + l.current_count, 0);
    const globalOccupancy = totalCapacity > 0 ? Math.min((totalUsed / totalCapacity) * 100, 100) : 0;
    const typeGroups = [...new Set(locations.map(l => l.location_type))];

    const cfg = WAREHOUSE_TYPE_CFG[warehouse.type];
    const WIcon = cfg.icon;

    const handleToggleLoc = async (loc: StorageLocation) => {
        if (!isAdmin) return;
        try {
            await updateLoc.mutateAsync({ locationId: loc.id, warehouseId: warehouse.id, payload: { is_active: !loc.is_active } });
            toast.success(`Emplacement ${loc.is_active ? 'désactivé' : 'activé'}`);
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Erreur');
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            {/* ── Header identity + KPIs ──────────────────── */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    {/* Identity */}
                    <div className="flex items-start gap-4">
                        <div className={`w-14 h-14 rounded-2xl ${cfg.bg} border ${cfg.border} flex items-center justify-center shadow-sm shrink-0`}>
                            <WIcon className={`w-7 h-7 ${cfg.color}`} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                    {cfg.label}
                                </span>
                                <StatusPill active={warehouse.is_active} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 leading-tight truncate">{warehouse.name}</h2>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                <span className="font-mono font-semibold bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{warehouse.code}</span>
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {warehouse.branch_code}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* KPI cards */}
                    <div className="flex items-stretch gap-3 shrink-0">
                        <div className="bg-slate-50 border border-gray-200 rounded-xl px-4 py-3 min-w-[110px]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Layers className="w-3 h-3" /> Emplacements
                            </div>
                            <div className="text-2xl font-bold text-gray-900">{locations.length}</div>
                        </div>
                        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3 min-w-[110px]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1">
                                <CheckCircle2 className="w-3 h-3" /> Actifs
                            </div>
                            <div className="text-2xl font-bold text-emerald-700">{activeCount}</div>
                        </div>
                        <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3 min-w-[140px]">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700 uppercase tracking-wider mb-1">
                                <Package2 className="w-3 h-3" /> Capacité
                            </div>
                            <div className="text-2xl font-bold text-indigo-700">
                                {totalCapacity > 0 ? `${Math.round(globalOccupancy)}%` : isVan ? 'Flotte' : '∞'}
                            </div>
                            <div className="text-[11px] text-indigo-600/70 mt-0.5">
                                {totalCapacity > 0
                                    ? `${totalUsed.toLocaleString('fr-FR')} / ${totalCapacity.toLocaleString('fr-FR')}`
                                    : isVan ? 'Synchronisé' : 'Sans limite'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Van read-only banner ────────────────────── */}
            {isVan && (
                <div className="shrink-0 px-6 py-3 bg-amber-50/80 border-b border-amber-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <Truck className="w-4 h-4 text-amber-700" />
                        </div>
                        <p className="text-sm text-amber-900 leading-snug">
                            Ce dépôt est <span className="font-semibold">synchronisé automatiquement</span> via la flotte de véhicules. Les actions manuelles sont désactivées.
                        </p>
                    </div>
                </div>
            )}

            {/* ── Toolbar ─────────────────────────────────── */}
            <div className="shrink-0 px-6 py-3 bg-white border-b border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Rechercher un emplacement..."
                            value={locSearch}
                            onChange={e => setLocSearch(e.target.value)}
                            className="w-full pl-9 pr-9 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 focus:bg-white transition-all"
                        />
                        {locSearch && (
                            <button
                                onClick={() => setLocSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filters + Add */}
                    <div className="flex items-center gap-2 flex-1 sm:justify-end flex-wrap">
                        {typeGroups.length > 1 && (
                            <>
                                <button
                                    onClick={() => { setTempTypeFilter(typeFilter); setShowFilterModal(true); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all"
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5" />
                                    Filtres
                                    {typeFilter !== 'ALL' && (
                                        <span className="ml-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center">1</span>
                                    )}
                                </button>
                                {typeFilter !== 'ALL' && (
                                    <button
                                        onClick={() => setTypeFilter('ALL')}
                                        className={`inline-flex items-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg border transition-all ${LOCATION_TYPE_CFG[typeFilter].bg} ${LOCATION_TYPE_CFG[typeFilter].color} ${LOCATION_TYPE_CFG[typeFilter].border}`}
                                    >
                                        {LOCATION_TYPE_CFG[typeFilter].label}
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </>
                        )}
                        {isAdmin && (
                            <button
                                onClick={onAddLocation}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" /> Emplacement
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Filter modal ────────────────────────────── */}
            <Dialog open={showFilterModal} onOpenChange={v => !v && setShowFilterModal(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <SlidersHorizontal className="w-4 h-4 text-indigo-500" /> Filtrer par type
                        </DialogTitle>
                        <DialogDescription>
                            Sélectionnez un type d'emplacement à afficher.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="pt-2">
                        <div className="space-y-1">
                            <button
                                onClick={() => setTempTypeFilter('ALL')}
                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${tempTypeFilter === 'ALL' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                            >
                                <span className="font-medium">Tous les emplacements</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${tempTypeFilter === 'ALL' ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                    {locations.length}
                                </span>
                            </button>
                            {typeGroups.map(t => {
                                const c = LOCATION_TYPE_CFG[t];
                                const cnt = locations.filter(l => l.location_type === t).length;
                                const active = tempTypeFilter === t;
                                return (
                                    <button
                                        key={t}
                                        onClick={() => setTempTypeFilter(t)}
                                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${c.accent}`} />
                                            <span className="font-medium">{c.label}</span>
                                        </div>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                            {cnt}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button
                            onClick={() => { setTempTypeFilter('ALL'); setTypeFilter('ALL'); setShowFilterModal(false); }}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Réinitialiser
                        </button>
                        <button
                            onClick={() => { setTypeFilter(tempTypeFilter); setShowFilterModal(false); }}
                            className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Appliquer
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Locations table ─────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement des emplacements...
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                            <Layers className="w-8 h-8 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">Aucun emplacement</p>
                        <p className="text-xs mt-1 mb-5">Ajoutez le premier emplacement à cet entrepôt.</p>
                        {isAdmin && (
                            <button onClick={onAddLocation}
                                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
                                <Plus className="w-4 h-4" /> Ajouter un emplacement
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-200">
                                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-12">
                                        Type
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                                        Emplacement
                                    </th>
                                    <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">
                                        Statut
                                    </th>
                                    <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-32">
                                        Stock
                                    </th>
                                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-44">
                                        Occupation
                                    </th>
                                    {isAdmin && (
                                        <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-20">
                                            Action
                                        </th>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(loc => {
                                    const c = LOCATION_TYPE_CFG[loc.location_type];
                                    const pct = loc.capacity ? Math.min((loc.current_count / loc.capacity) * 100, 100) : 0;
                                    const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                                    const statusText = pct >= 90 ? 'Critique' : pct >= 70 ? 'Élevé' : 'Normal';
                                    const statusColor = pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600';
                                    return (
                                        <tr
                                            key={loc.id}
                                            className={`group transition-colors border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 ${!loc.is_active ? 'opacity-60 bg-gray-50/40' : ''}`}
                                        >
                                            {/* Type icon/dot */}
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${c.accent} ring-2 ring-white shadow-sm shrink-0`} />
                                                    <span className={`text-[11px] font-semibold ${c.color} leading-tight`}>
                                                        {c.label}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Name + meta */}
                                            <td className="px-4 py-3.5">
                                                <div className="font-semibold text-sm text-gray-900 leading-tight">{loc.location_name}</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[11px] text-gray-400 font-mono">{loc.location_code}</span>
                                                    {loc.requires_supervisor && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600 border border-red-100">
                                                            <ShieldAlert className="w-2.5 h-2.5" /> Superviseur
                                                        </span>
                                                    )}
                                                </div>
                                                {loc.description && (
                                                    <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[260px]">{loc.description}</div>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3.5 text-center">
                                                <StatusPill active={loc.is_active} size="xs" />
                                            </td>

                                            {/* Stock */}
                                            <td className="px-4 py-3.5 text-right">
                                                <span className="text-base font-bold text-gray-900">{loc.current_count.toLocaleString('fr-FR')}</span>
                                                {loc.capacity != null && (
                                                    <div className="text-[11px] text-gray-400">sur {loc.capacity.toLocaleString('fr-FR')}</div>
                                                )}
                                            </td>

                                            {/* Occupation */}
                                            <td className="px-4 py-3.5">
                                                {loc.capacity != null ? (
                                                    <div>
                                                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                                                            <span className="font-semibold text-gray-500">{Math.round(pct)}%</span>
                                                            <span className={`font-medium ${statusColor}`}>{statusText}</span>
                                                        </div>
                                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden w-full">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : isVan ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                                                        <Truck className="w-3 h-3" /> Flotte
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-gray-400 italic">Sans limite</span>
                                                )}
                                            </td>

                                            {/* Action */}
                                            {isAdmin && (
                                                <td className="px-4 py-3.5 text-center">
                                                    <button
                                                        onClick={() => !isVan && handleToggleLoc(loc)}
                                                        disabled={isVan}
                                                        title={isVan ? 'Géré automatiquement par la flotte' : loc.is_active ? 'Désactiver' : 'Activer'}
                                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-all
                                                            ${isVan
                                                                ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                                                                : loc.is_active
                                                                    ? 'border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
                                                                    : 'border-gray-200 text-gray-400 hover:border-emerald-300 hover:text-emerald-600 hover:bg-emerald-50'
                                                            }`}
                                                    >
                                                        {isVan
                                                            ? <Truck className="w-3.5 h-3.5" />
                                                            : loc.is_active
                                                                ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                                                                : <ToggleLeft className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Create Warehouse Dialog ──────────────────────────────────────────────────

const CreateWarehouseDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    const create = useCreateWarehouse();
    const [form, setForm] = useState<CreateWarehousePayload>({ branch_id: 0, name: '', type: 'central', code: '', is_active: true });

    const handleSubmit = async () => {
        if (!form.branch_id || !form.name.trim()) { toast.error('Branch ID et Nom sont obligatoires'); return; }
        const tid = toast.loading('Création du dépôt...');
        try {
            await create.mutateAsync({ ...form, code: form.code || undefined });
            toast.dismiss(tid); toast.success('Dépôt créé'); onClose();
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message ?? 'Erreur'); }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-indigo-500" /> Nouveau Dépôt
                    </DialogTitle>
                    <DialogDescription>Créer un nouvel entrepôt ou dépôt central.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Branch ID *</label>
                            <input type="number" value={form.branch_id || ''} onChange={e => setForm(p => ({ ...p, branch_id: parseInt(e.target.value) || 0 }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="3" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Type</label>
                            <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as any }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                <option value="central">Dépôt Central</option>
                                <option value="system_virtual">Virtuel Système</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Nom *</label>
                        <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Dépôt Central Casablanca" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Code (optionnel)</label>
                        <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="CASA-CENTRAL" />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm text-gray-700">Actif dès la création</span>
                    </label>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                    <button onClick={handleSubmit} disabled={create.isPending}
                        className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors">
                        {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Créer
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Add Location Dialog ──────────────────────────────────────────────────────

const AddLocationDialog = ({ open, warehouseId, onClose }: { open: boolean; warehouseId: number | null; onClose: () => void }) => {
    const create = useCreateLocation();
    const [form, setForm] = useState<CreateLocationPayload>({ location_type: 'SELLABLE', location_name: '', location_code: '', description: '', capacity: null, is_active: true });

    const requiresSupervisor = SUPERVISOR_TYPES.includes(form.location_type);

    const handleSubmit = async () => {
        if (!warehouseId || !form.location_name.trim()) { toast.error("Nom de l'emplacement obligatoire"); return; }
        const tid = toast.loading("Création de l'emplacement...");
        try {
            await create.mutateAsync({ warehouseId, payload: { ...form, location_code: form.location_code || undefined, description: form.description || undefined } });
            toast.dismiss(tid); toast.success('Emplacement créé'); onClose();
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message ?? 'Erreur'); }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Nouvel Emplacement</DialogTitle>
                    <DialogDescription>Ajouter un emplacement de stockage à cet entrepôt.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Type *</label>
                        <select value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
                            {CREATABLE_LOCATION_TYPES.map(t => <option key={t} value={t}>{LOCATION_TYPE_CFG[t].label}</option>)}
                        </select>
                        {requiresSupervisor && (
                            <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1 bg-red-50 px-2 py-1 rounded-lg">
                                <ShieldAlert className="w-3 h-3" /> Ce type requiert un superviseur (auto-appliqué)
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Nom *</label>
                        <input type="text" value={form.location_name} onChange={e => setForm(p => ({ ...p, location_name: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="Allée A — Étagère 3" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Code (optionnel)</label>
                            <input type="text" value={form.location_code} onChange={e => setForm(p => ({ ...p, location_code: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="CASA-A3" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Capacité max</label>
                            <input type="number" value={form.capacity ?? ''} onChange={e => setForm(p => ({ ...p, capacity: e.target.value ? parseInt(e.target.value) : null }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" placeholder="200" min="1" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Description</label>
                        <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" rows={2} placeholder="Produits secs et conserves..." />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                        <span className="text-sm text-gray-700">Actif dès la création</span>
                    </label>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                    <button onClick={handleSubmit} disabled={create.isPending}
                        className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors">
                        {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Créer
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WarehousesPage = () => {
    const { isAdminUser } = usePermissions();
    const [selected, setSelected] = useState<WarehouseT | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showAddLoc, setShowAddLoc] = useState(false);
    const [search, setSearch] = useState('');
    const [activeOnly, setActiveOnly] = useState(false);

    const { data, isLoading, refetch } = useWarehouses({ search: search || undefined, active_only: activeOnly || undefined, per_page: 100 });
    const updateWarehouse = useUpdateWarehouse();

    const warehouses: WarehouseT[] = useMemo(() => {
        const d = data as any;
        if (Array.isArray(d?.warehouses?.data)) return d.warehouses.data;
        if (Array.isArray(d?.data)) return d.data;
        if (Array.isArray(d)) return d;
        return [];
    }, [data]);

    const handleToggle = async (w: WarehouseT) => {
        if (!isAdminUser) return;
        const tid = toast.loading(w.is_active ? 'Désactivation...' : 'Activation...');
        try {
            await updateWarehouse.mutateAsync({ id: w.id, payload: { is_active: !w.is_active } });
            toast.dismiss(tid);
            toast.success(w.is_active ? 'Dépôt désactivé' : 'Dépôt activé');
            if (selected?.id === w.id) setSelected({ ...w, is_active: !w.is_active });
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message ?? 'Erreur'); }
    };

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white flex flex-col border-r border-gray-100">
                        {/* ── Header ──────────────────────────────── */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900">Entrepôts</h1>
                                    <p className="text-[11px] text-gray-400 mt-0.5">{warehouses.length} dépôt{warehouses.length !== 1 ? 's' : ''}</p>
                                </div>
                                {isAdminUser && (
                                    <button
                                        onClick={() => setShowCreate(true)}
                                        className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-sm"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-white" />
                                    </button>
                                )}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un dépôt..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-colors"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                            <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                                <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="w-3.5 h-3.5 accent-indigo-600 rounded" />
                                <span className="text-xs text-gray-500">Actifs seulement</span>
                            </label>
                        </div>

                        {/* ── List ────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-16 text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : warehouses.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-4 text-center">
                                    <Warehouse className="w-10 h-10 opacity-20 mb-3" />
                                    <p className="text-xs">Aucun dépôt trouvé</p>
                                </div>
                            ) : (() => {
                                const physical = warehouses.filter(w => w.type === 'central' || w.type === 'system_virtual');
                                const vans     = warehouses.filter(w => w.type === 'delivery_van');
                                return (
                                    <>
                                        {physical.length > 0 && (
                                            <>
                                                <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
                                                    <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Dépôts Physiques</span>
                                                    <span className="ml-auto text-[10px] font-semibold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">{physical.length}</span>
                                                </div>
                                                {physical.map(w => (
                                                    <WarehouseCard key={w.id} warehouse={w} selected={selected?.id === w.id} onClick={() => setSelected(w)} />
                                                ))}
                                            </>
                                        )}
                                        {vans.length > 0 && (
                                            <>
                                                <div className={`flex items-center gap-2 px-3 pb-1.5 ${physical.length > 0 ? 'pt-3 border-t border-gray-100 mt-1' : 'pt-3'}`}>
                                                    <Truck className="w-3 h-3 text-amber-500 shrink-0" />
                                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Vans de Livraison</span>
                                                    <span className="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{vans.length}</span>
                                                </div>
                                                {vans.map(w => (
                                                    <WarehouseCard key={w.id} warehouse={w} selected={selected?.id === w.id} onClick={() => setSelected(w)} />
                                                ))}
                                            </>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {selected ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* Breadcrumb bar */}
                                <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-400">
                                    <button onClick={() => setSelected(null)} className="hover:text-gray-700 transition-colors flex items-center gap-1">
                                        <Warehouse className="w-3 h-3" /> Entrepôts
                                    </button>
                                    <ChevronRight className="w-3 h-3" />
                                    <span className="text-gray-700 font-medium">{selected.name}</span>
                                </div>
                                <div className="flex-1 min-h-0 flex flex-col">
                                    <WarehouseDetail
                                        warehouse={selected}
                                        isAdmin={isAdminUser}
                                        onAddLocation={() => setShowAddLoc(true)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <WarehouseDashboard warehouses={warehouses} />
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        groups={[
                            {
                                items: [
                                    { icon: RefreshCw, label: 'Actualiser', variant: 'sage', onClick: () => refetch() },
                                    ...(isAdminUser ? [{ icon: Plus, label: 'Nouveau dépôt', variant: 'primary' as const, onClick: () => setShowCreate(true) }] : []),
                                ],
                            },
                            ...(selected ? [{
                                items: [
                                    ...(isAdminUser ? [{
                                        icon: Plus,
                                        label: 'Ajouter emplacement',
                                        variant: 'default' as const,
                                        onClick: () => setShowAddLoc(true),
                                    }] : []),
                                    ...(isAdminUser ? [{
                                        icon: selected.is_active ? ToggleRight : ToggleLeft,
                                        label: selected.is_active ? 'Désactiver dépôt' : 'Activer dépôt',
                                        variant: (selected.is_active ? 'danger' : 'default') as 'danger' | 'default',
                                        onClick: () => handleToggle(selected),
                                    }] : []),
                                    {
                                        icon: Activity,
                                        label: 'Voir stock',
                                        variant: 'default' as const,
                                        onClick: () => { window.location.href = `/stock/consultation?warehouse=${selected.code}`; },
                                    },
                                ],
                            }] : []),
                        ]}
                    />
                }
            />
            <CreateWarehouseDialog open={showCreate} onClose={() => setShowCreate(false)} />
            <AddLocationDialog open={showAddLoc} warehouseId={selected?.id ?? null} onClose={() => setShowAddLoc(false)} />
        </>
    );
};
