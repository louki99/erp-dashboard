import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Route,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    MapPin,
    Navigation,
    Package2,
    Weight,
    Clock,
    Ruler,
    Check,
    ChevronRight,
    RotateCcw,
    Wifi,
    WifiOff,
    AlertCircle,
    Activity,
    Search,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TourMapView } from '@/components/dispatcher/TourMapView';
import { useDispatcherPendingOrders } from '@/hooks/dispatcher/useDispatcherOrders';
import { useRouteOptimizer, useOptimizerHealth, generateBatchId } from '@/hooks/dispatcher/useRouteOptimizer';
import { useAuth } from '@/context/AuthContext';
import type { DispatcherOrder } from '@/types/dispatcher.types';
import type { OptimizedTour, OptimizationObjective } from '@/types/route-optimizer.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDistance(meters: number): string {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

function fmtDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`;
    return `${m} min`;
}

function getOrderCoords(o: DispatcherOrder): { lat: number; lng: number } | null {
    const lat = Number(o.partner?.geo_lat);
    const lng = Number(o.partner?.geo_lng);
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
}

function getOrderWeight(o: DispatcherOrder): number {
    return Number(o.total_weight_kg) || 0;
}

function getOrderVolume(o: DispatcherOrder): number {
    return Number(o.total_volume_m3) || 0;
}

const TOUR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// ─── HealthBadge ──────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: 'healthy' | 'degraded' | 'unhealthy' | null }) {
    if (!status) return null;
    const cfg = {
        healthy: { icon: Wifi, label: 'Solveur opérationnel', cls: 'text-emerald-700 border-emerald-200 bg-emerald-50' },
        degraded: { icon: Activity, label: 'Solveur dégradé', cls: 'text-amber-700 border-amber-200 bg-amber-50' },
        unhealthy: { icon: WifiOff, label: 'Solveur indisponible', cls: 'text-red-700 border-red-200 bg-red-50' },
    }[status];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.cls}`}>
            <Icon size={11} />
            {cfg.label}
        </span>
    );
}

// ─── OrderRow ─────────────────────────────────────────────────────────────────

function OrderRow({ order, selected, onToggle, hasCoords }: {
    order: DispatcherOrder; selected: boolean; onToggle: () => void; hasCoords: boolean;
}) {
    return (
        <button
            onClick={onToggle}
            disabled={!hasCoords}
            className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg transition-colors text-left border ${
                selected
                    ? 'bg-blue-50 border-blue-200'
                    : hasCoords
                    ? 'border-transparent hover:bg-gray-50'
                    : 'border-transparent opacity-40 cursor-not-allowed'
            }`}
        >
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                selected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
            }`}>
                {selected && <Check size={10} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">{order.order_code}</span>
                    <span className="text-sm text-gray-800 truncate font-medium">{order.partner?.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    {order.partner?.address_line1 && (
                        <span className="text-xs text-gray-400 truncate">{order.partner.address}</span>
                    )}
                    {!hasCoords && (
                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 shrink-0">
                            Pas de GPS
                        </span>
                    )}
                </div>
                {(getOrderWeight(order) > 0 || getOrderVolume(order) > 0) && (
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-gray-400">
                        {getOrderWeight(order) > 0 && <span>{getOrderWeight(order).toFixed(1)} kg</span>}
                        {getOrderVolume(order) > 0 && <span>{getOrderVolume(order).toFixed(2)} m³</span>}
                    </div>
                )}
            </div>
        </button>
    );
}

// ─── TourCard ─────────────────────────────────────────────────────────────────

function TourCard({ tour, selected, onSelect }: { tour: OptimizedTour; selected: boolean; onSelect: () => void }) {
    const color = TOUR_COLORS[(tour.tour_number - 1) % TOUR_COLORS.length];
    return (
        <button
            onClick={onSelect}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors text-left border ${
                selected ? 'bg-blue-50 border-blue-200' : 'border-transparent hover:bg-gray-50'
            }`}
        >
            <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0"
                style={{ backgroundColor: color + '20', color }}
            >
                {tour.tour_number}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-800 truncate">{tour.vehicle_plate}</div>
                <div className="text-xs text-gray-400 truncate">{tour.driver_name}</div>
            </div>
            <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-gray-700">{tour.stop_count} arrêts</div>
                <div className="text-[10px] text-gray-400">{fmtDistance(tour.total_distance_meters)}</div>
            </div>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
        </button>
    );
}

// ─── StopItem ─────────────────────────────────────────────────────────────────

function StopItem({ stop, color, isLast }: { stop: OptimizedTour['stops'][0]; color: string; isLast: boolean }) {
    return (
        <div className="flex items-start gap-3">
            <div className="flex flex-col items-center shrink-0">
                <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: color }}
                >
                    {stop.sequence_order}
                </div>
                {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1 mb-0" style={{ minHeight: 20 }} />}
            </div>
            <div className="flex-1 min-w-0 pb-3">
                <div className="text-sm font-medium text-gray-800">{stop.customer_name}</div>
                {stop.address && (
                    <div className="text-xs text-gray-400 mt-0.5">{stop.address}</div>
                )}
            </div>
        </div>
    );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-center">
            <Icon size={14} className="mx-auto text-gray-400 mb-1" />
            <p className="text-base font-bold text-gray-900">{value}</p>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        </div>
    );
}

// ─── DispatcherRouteOptimizerPage ─────────────────────────────────────────────

type Step = 'select' | 'review' | 'confirmed';

const DEFAULT_DEPOT_LAT = '33.5731';
const DEFAULT_DEPOT_LNG = '-7.5898';

export function DispatcherRouteOptimizerPage() {
    const { user } = useAuth();

    const { data: pendingData, loading: ordersLoading, refetch: refetchOrders } =
        useDispatcherPendingOrders({ per_page: 200 });
    const allOrders = useMemo(() => pendingData?.data ?? [], [pendingData]);

    const [step, setStep] = useState<Step>('select');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [batchName, setBatchName] = useState(() =>
        `Tournée du ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}`
    );
    const [depotLat, setDepotLat] = useState(DEFAULT_DEPOT_LAT);
    const [depotLng, setDepotLng] = useState(DEFAULT_DEPOT_LNG);
    const [objective, setObjective] = useState<OptimizationObjective>('minimize_distance');
    const [selectedTourNumber, setSelectedTourNumber] = useState<number>(1);
    const [search, setSearch] = useState('');

    const { result, loading, error, optimize, confirm, confirming, confirmed, confirmError, reset } = useRouteOptimizer();
    const { health, recheck: recheckHealth } = useOptimizerHealth();

    useEffect(() => { if (confirmed) setStep('confirmed'); }, [confirmed]);
    useEffect(() => {
        if (result && step === 'select') { setStep('review'); setSelectedTourNumber(1); }
    }, [result, step]);

    const ordersWithCoords = useMemo(
        () => allOrders.map(o => ({ order: o, coords: getOrderCoords(o) })),
        [allOrders],
    );

    const filteredOrders = useMemo(() => {
        const q = search.toLowerCase();
        return ordersWithCoords.filter(({ order }) =>
            !q ||
            order.order_code.toLowerCase().includes(q) ||
            (order.partner?.name ?? '').toLowerCase().includes(q) ||
            (order.partner?.address_line1 ?? '').toLowerCase().includes(q),
        );
    }, [ordersWithCoords, search]);

    const selectedOrders = useMemo(
        () => allOrders.filter(o => selectedIds.has(o.id)),
        [allOrders, selectedIds],
    );

    const totalWeight = useMemo(
        () => selectedOrders.reduce((acc, o) => acc + getOrderWeight(o), 0),
        [selectedOrders],
    );
    const totalVolume = useMemo(
        () => selectedOrders.reduce((acc, o) => acc + getOrderVolume(o), 0),
        [selectedOrders],
    );

    const selectedTour = result?.tours.find(t => t.tour_number === selectedTourNumber);
    const depot = { lat: Number(depotLat), lng: Number(depotLng) };

    const canOptimize =
        selectedIds.size > 0 &&
        !!depotLat && !!depotLng &&
        !isNaN(Number(depotLat)) && !isNaN(Number(depotLng));

    const toggleOrder = useCallback((id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleAll = useCallback(() => {
        const validIds = filteredOrders.filter(x => x.coords).map(x => x.order.id);
        setSelectedIds(prev => {
            const allSelected = validIds.every(id => prev.has(id));
            const next = new Set(prev);
            if (allSelected) validIds.forEach(id => next.delete(id));
            else validIds.forEach(id => next.add(id));
            return next;
        });
    }, [filteredOrders]);

    const handleOptimize = useCallback(async () => {
        const orders = selectedOrders
            .map(o => {
                const coords = getOrderCoords(o);
                if (!coords) return null;
                return {
                    order_id: o.id,
                    customer_id: o.partner?.id ?? 0,
                    customer_name: o.partner?.name ?? '',
                    address: o.partner?.address ?? '',
                    latitude: coords.lat,
                    longitude: coords.lng,
                    weight_kg: getOrderWeight(o),
                    volume_m3: getOrderVolume(o),
                    priority: 1,
                };
            })
            .filter(Boolean) as any[];

        await optimize({
            batch_id: generateBatchId(),
            batch_name: batchName,
            depot_latitude: Number(depotLat),
            depot_longitude: Number(depotLng),
            orders,
            optimization_objective: objective,
        });
    }, [selectedOrders, batchName, depotLat, depotLng, objective, optimize]);

    const handleConfirm = useCallback(async () => {
        if (!result) return;
        await confirm(result.batch_id, user?.id ?? 0);
    }, [result, confirm, user]);

    const handleReset = useCallback(() => {
        reset();
        setStep('select');
        setSelectedIds(new Set());
    }, [reset]);

    // ─── Left panel ───────────────────────────────────────────────────────────

    const leftContent = (
        <div className="flex flex-col h-full">
            {step === 'select' && (
                <>
                    {/* Search + refresh */}
                    <div className="px-3 pt-3 pb-2 border-b border-gray-100 space-y-2 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200">
                                <Search size={13} className="text-gray-400 shrink-0" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher…"
                                    className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder:text-gray-400"
                                />
                            </div>
                            <button
                                onClick={() => refetchOrders()}
                                className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <RefreshCw size={13} />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <button onClick={toggleAll} className="text-xs text-blue-600 hover:underline font-medium">
                                {filteredOrders.filter(x => x.coords).every(x => selectedIds.has(x.order.id))
                                    ? 'Tout désélectionner'
                                    : 'Tout sélectionner'}
                            </button>
                            <span className="text-xs text-gray-400">{selectedIds.size} / {allOrders.length}</span>
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {ordersLoading && (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={18} className="animate-spin text-gray-300" />
                            </div>
                        )}
                        {!ordersLoading && filteredOrders.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Package2 size={24} className="text-gray-200 mb-2" />
                                <p className="text-sm text-gray-400">Aucune commande en attente</p>
                            </div>
                        )}
                        {filteredOrders.map(({ order, coords }) => (
                            <OrderRow
                                key={order.id}
                                order={order}
                                selected={selectedIds.has(order.id)}
                                onToggle={() => toggleOrder(order.id)}
                                hasCoords={!!coords}
                            />
                        ))}
                    </div>

                    {/* Footer */}
                    {selectedIds.size > 0 && (
                        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between shrink-0 bg-gray-50">
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                {totalWeight > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Weight size={10} /> {totalWeight.toFixed(1)} kg
                                    </span>
                                )}
                                {totalVolume > 0 && (
                                    <span className="flex items-center gap-1">
                                        <Package2 size={10} /> {totalVolume.toFixed(2)} m³
                                    </span>
                                )}
                            </div>
                            <span className="text-xs font-semibold text-blue-600">{selectedIds.size} cmd</span>
                        </div>
                    )}
                </>
            )}

            {step === 'review' && result && (
                <>
                    <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-gray-800">
                                {result.total_tours} tournée{result.total_tours > 1 ? 's' : ''} optimisées
                            </p>
                            <span className="text-xs text-gray-400">Score {Math.round(result.optimization_score * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{result.total_orders} commandes réparties</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {result.tours.map(tour => (
                            <TourCard
                                key={tour.tour_number}
                                tour={tour}
                                selected={selectedTourNumber === tour.tour_number}
                                onSelect={() => setSelectedTourNumber(tour.tour_number)}
                            />
                        ))}
                    </div>
                </>
            )}

            {step === 'confirmed' && (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <CheckCircle2 size={32} className="text-emerald-500 mb-3" />
                    <p className="text-sm font-bold text-gray-800">Lot confirmé</p>
                    <p className="text-xs text-gray-400 mt-1 font-mono break-all">{result?.batch_id}</p>
                </div>
            )}
        </div>
    );

    // ─── Center panel ─────────────────────────────────────────────────────────

    const centerContent = (
        <div className="h-full overflow-y-auto">
            {step === 'select' && (
                <div className="p-5 space-y-5 max-w-2xl">
                    {/* Title row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-blue-50 rounded-lg">
                                <Route size={16} className="text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-gray-900">Optimisation des tournées</h2>
                                <p className="text-[11px] text-gray-400">VRP solver — distances réelles via OSRM</p>
                            </div>
                        </div>
                        <HealthBadge status={health?.status ?? null} />
                    </div>

                    {/* Solver unavailable alert */}
                    {health?.status === 'unhealthy' && (
                        <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-200">
                            <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-semibold text-red-700">Moteur de routage indisponible</p>
                                <p className="text-xs text-red-500 mt-0.5">
                                    L'optimisation ne peut pas être lancée.{' '}
                                    <button onClick={recheckHealth} className="underline font-medium">Réessayer</button>
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Batch name */}
                    <div>
                        <label className="text-[11px] text-gray-500 mb-1 block font-medium">Nom du lot</label>
                        <input
                            type="text"
                            value={batchName}
                            onChange={e => setBatchName(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-900"
                        />
                    </div>

                    {/* Depot */}
                    <div>
                        <label className="text-[11px] text-gray-500 mb-1.5 flex items-center gap-1 font-medium">
                            <MapPin size={10} /> Position du dépôt
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <input
                                    type="number"
                                    step="any"
                                    value={depotLat}
                                    onChange={e => setDepotLat(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-900"
                                    placeholder="33.5731"
                                />
                                <p className="text-[10px] text-gray-400 mt-0.5 ml-0.5">Latitude</p>
                            </div>
                            <div>
                                <input
                                    type="number"
                                    step="any"
                                    value={depotLng}
                                    onChange={e => setDepotLng(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-gray-900"
                                    placeholder="-7.5898"
                                />
                                <p className="text-[10px] text-gray-400 mt-0.5 ml-0.5">Longitude</p>
                            </div>
                        </div>
                    </div>

                    {/* Objective */}
                    <div>
                        <label className="text-[11px] text-gray-500 mb-1.5 block font-medium">Objectif d'optimisation</label>
                        <div className="flex gap-2">
                            {([
                                { value: 'minimize_distance', label: 'Distance minimale', icon: Ruler },
                                { value: 'minimize_duration', label: 'Durée minimale', icon: Clock },
                            ] as const).map(opt => {
                                const Icon = opt.icon;
                                const active = objective === opt.value;
                                return (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => setObjective(opt.value)}
                                        className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                                            active
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                                        }`}
                                    >
                                        <Icon size={14} />
                                        {opt.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Summary card */}
                    {selectedIds.size > 0 && (
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                            <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-3">
                                Récapitulatif de la sélection
                            </p>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">{selectedIds.size}</p>
                                    <p className="text-xs text-gray-400">commandes</p>
                                </div>
                                <div className="text-center border-x border-gray-100">
                                    <p className="text-2xl font-bold text-gray-900">{totalWeight.toFixed(1)}</p>
                                    <p className="text-xs text-gray-400">kg total</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-2xl font-bold text-gray-900">{totalVolume.toFixed(2)}</p>
                                    <p className="text-xs text-gray-400">m³ total</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Error block */}
                    {error && (
                        <div className={`rounded-xl border p-4 ${
                            error.type === 'validation'
                                ? 'bg-amber-50 border-amber-200'
                                : 'bg-red-50 border-red-200'
                        }`}>
                            <div className="flex items-start gap-2 mb-3">
                                {error.type === 'solver_unavailable'
                                    ? <WifiOff size={15} className="text-red-500 shrink-0 mt-0.5" />
                                    : <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />}
                                <div>
                                    <p className={`text-sm font-semibold ${error.type === 'solver_unavailable' ? 'text-red-700' : 'text-amber-800'}`}>
                                        {error.type === 'validation'
                                            ? 'Optimisation impossible'
                                            : error.type === 'solver_unavailable'
                                            ? 'Solveur temporairement indisponible'
                                            : 'Erreur inattendue'}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${error.type === 'solver_unavailable' ? 'text-red-500' : 'text-amber-600'}`}>
                                        {error.message}
                                    </p>
                                    {error.type === 'validation' && (
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            Ajustez la sélection (moins de commandes ou contraintes allégées) et réessayez.
                                        </p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={handleOptimize}
                                disabled={loading || !canOptimize}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                            >
                                <RotateCcw size={11} /> Réessayer
                            </button>
                        </div>
                    )}

                    {/* Optimize CTA */}
                    <button
                        onClick={handleOptimize}
                        disabled={loading || !canOptimize || health?.status === 'unhealthy'}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <><Loader2 size={15} className="animate-spin" /> Optimisation en cours…</>
                        ) : (
                            <><Navigation size={15} /> Lancer l'optimisation</>
                        )}
                    </button>

                    {!canOptimize && selectedIds.size === 0 && (
                        <p className="text-xs text-center text-gray-400">
                            Sélectionnez au moins une commande dans la liste de gauche
                        </p>
                    )}
                </div>
            )}

            {step === 'review' && result && selectedTour && (
                <div className="p-4 space-y-4">
                    {/* Tour header */}
                    <div className="flex items-center gap-3">
                        <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0"
                            style={{
                                backgroundColor: TOUR_COLORS[(selectedTour.tour_number - 1) % TOUR_COLORS.length] + '20',
                                color: TOUR_COLORS[(selectedTour.tour_number - 1) % TOUR_COLORS.length],
                            }}
                        >
                            {selectedTour.tour_number}
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-gray-900">{selectedTour.vehicle_plate}</h3>
                            <p className="text-xs text-gray-400">{selectedTour.driver_name}</p>
                        </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2">
                        <StatTile icon={MapPin} label="Arrêts" value={String(selectedTour.stop_count)} />
                        <StatTile icon={Ruler} label="Distance" value={fmtDistance(selectedTour.total_distance_meters)} />
                        <StatTile icon={Clock} label="Durée" value={fmtDuration(selectedTour.total_duration_seconds)} />
                    </div>

                    {/* Map */}
                    <TourMapView tour={selectedTour} depot={depot} height="260px" />

                    {/* Stops list */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                        <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-3">
                            Ordre des arrêts
                        </p>

                        {/* Depot start */}
                        <div className="flex items-start gap-3 mb-0">
                            <div className="flex flex-col items-center shrink-0">
                                <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center">
                                    <span className="text-white text-[10px] font-bold">D</span>
                                </div>
                                <div className="w-px flex-1 bg-gray-200 mt-1" style={{ minHeight: 20 }} />
                            </div>
                            <div className="flex-1 pb-3">
                                <p className="text-sm font-semibold text-gray-800">Dépôt — départ</p>
                                <p className="text-xs text-gray-400">{depotLat}, {depotLng}</p>
                            </div>
                        </div>

                        {[...selectedTour.stops]
                            .sort((a, b) => a.sequence_order - b.sequence_order)
                            .map((stop, idx, arr) => (
                                <StopItem
                                    key={stop.sequence_order}
                                    stop={stop}
                                    color={TOUR_COLORS[(selectedTour.tour_number - 1) % TOUR_COLORS.length]}
                                    isLast={idx === arr.length - 1}
                                />
                            ))}

                        {/* Depot return */}
                        <div className="flex items-start gap-3 mt-0">
                            <div className="w-6 h-6 rounded-full bg-amber-200 flex items-center justify-center shrink-0">
                                <span className="text-amber-700 text-[10px] font-bold">D</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-500">Dépôt — retour</p>
                            </div>
                        </div>
                    </div>

                    {/* Confirm error */}
                    {confirmError && (
                        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                            <XCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700">{confirmError}</p>
                        </div>
                    )}
                </div>
            )}

            {step === 'confirmed' && result && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="p-4 bg-emerald-50 rounded-2xl mb-5">
                        <CheckCircle2 size={40} className="text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Tournées confirmées</h2>
                    <p className="text-sm text-gray-500">
                        {result.total_tours} tournée{result.total_tours > 1 ? 's' : ''} · {result.total_orders} commandes
                    </p>
                    <p className="text-xs text-gray-400 font-mono mt-1">{result.batch_id}</p>
                    <button
                        onClick={handleReset}
                        className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors"
                    >
                        <RotateCcw size={14} /> Nouvelle optimisation
                    </button>
                </div>
            )}
        </div>
    );

    // ─── Action panel ─────────────────────────────────────────────────────────

    const actionGroups = [
        ...(step === 'select' ? [{
            items: [
                {
                    label: 'Lancer l\'optimisation',
                    icon: Navigation,
                    onClick: handleOptimize,
                    disabled: loading || !canOptimize || health?.status === 'unhealthy',
                },
                { label: 'Rafraîchir', icon: RefreshCw, onClick: () => refetchOrders() },
            ],
        }] : []),
        ...(step === 'review' ? [{
            items: [
                { label: 'Confirmer les tournées', icon: Check, onClick: handleConfirm, disabled: confirming },
                { label: 'Nouvelle optimisation', icon: RotateCcw, onClick: handleReset },
            ],
        }] : []),
        ...(step === 'confirmed' ? [{
            items: [{ label: 'Nouvelle optimisation', icon: RotateCcw, onClick: handleReset }],
        }] : []),
        { items: [{ label: 'Vérifier le solveur', icon: Activity, onClick: recheckHealth }] },
    ];

    return (
        <MasterLayout
            leftContent={leftContent}
            mainContent={centerContent}
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}

export default DispatcherRouteOptimizerPage;
