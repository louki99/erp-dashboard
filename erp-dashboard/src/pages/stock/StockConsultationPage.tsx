import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    Package,
    BarChart3,
    TrendingDown,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Search,
    X,
    Loader2,
    DollarSign,
    Archive,
    Hash,
    MapPin,
    Filter,
    ChevronRight,
    SlidersHorizontal,
    Box,
    Layers,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    useStockRows,
    useStockSummary,
    useLowStock,
    useStockByProduct,
} from '@/hooks/stock/useWarehouse';
import type { StockRow, StorageLocationType } from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (v: string | number) => parseFloat(String(v || '0')).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtVal = (v: number) => v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const availColor = (qty: number) => {
    if (qty <= 0) return 'text-red-600 font-bold';
    if (qty < 10) return 'text-amber-600 font-semibold';
    return 'text-emerald-600 font-semibold';
};

const LOCATION_TYPE_OPTIONS: { value: StorageLocationType | ''; label: string }[] = [
    { value: '', label: 'Tous les types' },
    { value: 'SELLABLE', label: 'Vendable' },
    { value: 'DEPOT', label: 'Dépôt Principal' },
    { value: 'DAMAGED', label: 'Endommagé' },
    { value: 'EXPIRED', label: 'Expiré' },
    { value: 'QUARANTINE', label: 'Quarantaine' },
    { value: 'SCRAP', label: 'Rebut' },
    { value: 'RETURN_TO_SUPPLIER', label: 'Retour Fournisseur' },
    { value: 'VIRTUAL', label: 'Virtuel' },
];

// ─── KPI Summary Dashboard ────────────────────────────────────────────────────

const StockKPIDashboard = ({ branchId }: { branchId?: number }) => {
    const { data: summaryData, isLoading } = useStockSummary(branchId);
    const { data: lowData } = useLowStock(branchId);
    const summary = (summaryData as any)?.data ?? summaryData;
    const lowCount = (lowData as any)?.data?.data?.length ?? (lowData as any)?.data?.length ?? 0;

    const kpis = [
        {
            label: 'Quantité totale',
            value: isLoading ? '—' : fmtQty(summary?.total_quantity ?? 0),
            icon: Archive,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-100',
        },
        {
            label: 'Disponible',
            value: isLoading ? '—' : fmtQty(summary?.total_available ?? 0),
            icon: CheckCircle2,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
        },
        {
            label: 'Réservé',
            value: isLoading ? '—' : fmtQty(summary?.total_reserved ?? 0),
            icon: Package,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
        },
        {
            label: 'Produits distincts',
            value: isLoading ? '—' : (summary?.distinct_products ?? 0).toLocaleString('fr-FR'),
            icon: Hash,
            color: 'text-indigo-600',
            bg: 'bg-indigo-50',
            border: 'border-indigo-100',
        },
        {
            label: 'Valeur estimée',
            value: isLoading ? '—' : `${fmtVal(summary?.estimated_value ?? 0)} MAD`,
            icon: DollarSign,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
            border: 'border-purple-100',
        },
        {
            label: 'Alertes stock bas',
            value: lowCount > 0 ? lowCount : '0',
            icon: AlertTriangle,
            color: lowCount > 0 ? 'text-red-600' : 'text-gray-500',
            bg: lowCount > 0 ? 'bg-red-50' : 'bg-gray-50',
            border: lowCount > 0 ? 'border-red-100' : 'border-gray-100',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center shadow-sm">
                    <BarChart3 className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Consultation des Stocks</h2>
                    <p className="text-sm text-gray-400">
                        Sélectionnez un produit pour voir sa disponibilité par emplacement et son état détaillé.
                    </p>
                </div>
            </div>

            {/* KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {kpis.map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 shadow-sm flex items-start gap-3`}>
                        <div className={`w-9 h-9 rounded-lg ${k.bg} border ${k.border} flex items-center justify-center shrink-0`}>
                            <k.icon className={`w-4 h-4 ${k.color}`} />
                        </div>
                        <div>
                            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5 font-medium">{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Low stock callout */}
            {lowCount > 0 && (
                <div className="mt-6 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-red-800">{lowCount} produit{lowCount > 1 ? 's' : ''} en stock bas</p>
                        <p className="text-xs text-red-600/80">Ces articles nécessitent une attention immédiate.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Product Detail Panel ─────────────────────────────────────────────────────

const ProductStockDetail = ({ row }: { row: StockRow }) => {
    const { data: byProduct, isLoading } = useStockByProduct(row.product_id);
    const locations = byProduct?.data ?? [];

    const available = parseFloat(row.available_quantity);
    const minQty = parseFloat(row.minimum_quantity);
    const maxQty = parseFloat(row.maximum_quantity);
    const isLowStock = available < minQty;
    const isOutOfStock = available <= 0;
    const stockPct = maxQty > 0 ? Math.min((available / maxQty) * 100, 100) : 0;

    const stockStatus = isOutOfStock
        ? { label: 'Rupture', color: 'text-red-600', bar: 'bg-red-500' }
        : isLowStock
            ? { label: 'Stock bas', color: 'text-amber-600', bar: 'bg-amber-500' }
            : { label: 'OK', color: 'text-emerald-600', bar: 'bg-emerald-500' };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/50">
            {/* Header identity */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-5">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="flex items-start gap-4 min-w-0">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isLowStock ? 'bg-red-50' : 'bg-emerald-50'}`}>
                            <Box className={`w-7 h-7 ${isLowStock ? 'text-red-600' : 'text-emerald-600'}`} />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{row.product?.reference}</span>
                                {row.product?.barcode && (
                                    <span className="text-xs text-gray-400 font-mono">{row.product.barcode}</span>
                                )}
                                {isLowStock && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">
                                        <AlertTriangle className="w-3 h-3" /> Stock bas
                                    </span>
                                )}
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">{row.product?.name ?? `Produit #${row.product_id}`}</h2>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {row.warehouse_code}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Big availability stat */}
                    <div className="shrink-0 bg-slate-50 border border-gray-200 rounded-xl px-5 py-3 min-w-[140px]">
                        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Disponible</div>
                        <div className={`text-3xl font-bold ${availColor(available)}`}>{fmtQty(row.available_quantity)}</div>
                        <div className={`text-xs font-medium mt-0.5 ${stockStatus.color}`}>{stockStatus.label}</div>
                    </div>
                </div>

                {/* KPI stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    {[
                        { label: 'Physique', value: fmtQty(row.quantity), icon: Archive, color: 'text-gray-900', bg: 'bg-gray-50', border: 'border-gray-200' },
                        { label: 'Réservé', value: fmtQty(row.reserved_quantity), icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                        { label: 'Min', value: fmtQty(row.minimum_quantity), icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-100' },
                        { label: 'Max', value: fmtQty(row.maximum_quantity), icon: BarChart3, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-3 flex items-center gap-3`}>
                            <k.icon className={`w-4 h-4 ${k.color}`} />
                            <div>
                                <div className={`text-base font-bold ${k.color}`}>{k.value}</div>
                                <div className="text-[10px] text-gray-500 font-medium">{k.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Stock level bar with markers */}
                {maxQty > 0 && (
                    <div className="mt-5">
                        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                            <span className="font-medium">Niveau de stock</span>
                            <span>{Math.round(stockPct)}% du max</span>
                        </div>
                        <div className="relative h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${stockStatus.bar}`}
                                style={{ width: `${stockPct}%` }}
                            />
                            {minQty > 0 && (
                                <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-red-400"
                                    style={{ left: `${Math.min((minQty / maxQty) * 100, 100)}%` }}
                                    title="Seuil minimum"
                                />
                            )}
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                            <span>Min: {fmtQty(row.minimum_quantity)}</span>
                            <span>Max: {fmtQty(row.maximum_quantity)}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* By-location breakdown */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Répartition par emplacement</p>
                    <span className="text-[11px] text-gray-400 font-medium">{locations.length} emplacement{locations.length !== 1 ? 's' : ''}</span>
                </div>
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                    </div>
                ) : locations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                            <MapPin className="w-7 h-7 opacity-40" />
                        </div>
                        <p className="text-sm font-medium">Aucune donnée par emplacement</p>
                        <p className="text-xs mt-1">Les détails par emplacement ne sont pas disponibles pour ce produit.</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-200">
                                    <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                                        Emplacement
                                    </th>
                                    <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">
                                        Physique
                                    </th>
                                    <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">
                                        Réservé
                                    </th>
                                    <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">
                                        Disponible
                                    </th>
                                    <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">
                                        État
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {locations.map(loc => {
                                    const locAvail = parseFloat(loc.available_quantity);
                                    const locPhys = parseFloat(loc.quantity);
                                    const locRes = parseFloat(loc.reserved_quantity);
                                    const locStatus = locAvail <= 0
                                        ? { label: 'Rupture', class: 'bg-red-50 text-red-700 border-red-100' }
                                        : locAvail < 10
                                            ? { label: 'Bas', class: 'bg-amber-50 text-amber-700 border-amber-100' }
                                            : { label: 'OK', class: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
                                    return (
                                        <tr key={loc.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/80 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                                                        <MapPin className="w-4 h-4 text-teal-500" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-semibold text-gray-900 font-mono">{loc.warehouse_code}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className="text-sm font-semibold text-gray-700">{fmtQty(locPhys)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-sm font-semibold ${locRes > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{fmtQty(locRes)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-sm font-bold ${availColor(locAvail)}`}>{fmtQty(locAvail)}</span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${locStatus.class}`}>
                                                    {locStatus.label}
                                                </span>
                                            </td>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export const StockConsultationPage = () => {
    const [selected, setSelected] = useState<StockRow | null>(null);
    const [search, setSearch] = useState('');
    const [locationType, setLocationType] = useState<StorageLocationType | ''>('');
    const [tempLocationType, setTempLocationType] = useState<StorageLocationType | ''>('');
    const [showFilters, setShowFilters] = useState(false);
    const [page, setPage] = useState(1);

    const { data, isLoading, refetch } = useStockRows({
        location_type: locationType || undefined,
        per_page: 50,
        page,
    });

    const rawRows: StockRow[] = useMemo(() => {
        const d = data as any;
        if (Array.isArray(d)) return d;
        if (Array.isArray(d?.data?.data)) return d.data.data;
        if (Array.isArray(d?.data)) return d.data;
        return [];
    }, [data]);

    const rows = useMemo(() => {
        if (!search.trim()) return rawRows;
        const q = search.toLowerCase();
        return rawRows.filter(r =>
            r.product?.name?.toLowerCase().includes(q) ||
            r.product?.reference?.toLowerCase().includes(q) ||
            r.warehouse_code?.toLowerCase().includes(q)
        );
    }, [rawRows, search]);

    const pagination: any = (data as any)?.data;

    const colDefs = useMemo<ColDef[]>(() => [
        {
            field: 'product.name',
            headerName: 'Produit',
            flex: 1,
            minWidth: 160,
            cellRenderer: (p: any) => {
                const r: StockRow = p.data;
                return (
                    <div className="py-1">
                        <div className="text-xs font-semibold text-gray-900 truncate">{r.product?.name ?? `#${r.product_id}`}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.product?.reference}</div>
                    </div>
                );
            },
        },
        {
            field: 'warehouse_code',
            headerName: 'Emplacement',
            width: 130,
            cellStyle: { fontSize: '11px', fontFamily: 'monospace', color: '#6b7280', textAlign: 'left' } as any,
        },
        {
            field: 'quantity',
            headerName: 'Physique',
            width: 80,
            valueFormatter: (p: any) => fmtQty(p.value),
            cellStyle: { textAlign: 'right', fontWeight: '600', color: '#374151' },
        },
        {
            field: 'reserved_quantity',
            headerName: 'Réservé',
            width: 75,
            valueFormatter: (p: any) => fmtQty(p.value),
            cellStyle: (p: any) => ({
                textAlign: 'right',
                color: parseFloat(p.value) > 0 ? '#d97706' : '#9ca3af',
                fontWeight: 500,
            } as any),
        },
        {
            field: 'available_quantity',
            headerName: 'Disponible',
            width: 85,
            valueFormatter: (p: any) => fmtQty(p.value),
            cellStyle: (p: any) => {
                const qty = parseFloat(p.value);
                if (qty <= 0) return { textAlign: 'right', color: '#dc2626', fontWeight: '700' } as any;
                if (qty < 10) return { textAlign: 'right', color: '#f59e0b', fontWeight: '600' } as any;
                return { textAlign: 'right', color: '#059669', fontWeight: '600' } as any;
            },
        },
    ], []);

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h1 className="text-sm font-bold text-gray-900">Consultation Stock</h1>
                                <p className="text-[11px] text-gray-400 mt-0.5">{rows.length} ligne{rows.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Produit, référence, emplacement..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2 mt-2">
                            <button
                                onClick={() => { setTempLocationType(locationType); setShowFilters(true); }}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all"
                            >
                                <SlidersHorizontal className="w-3 h-3" />
                                Type
                                {locationType && (
                                    <span className="ml-0.5 w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] flex items-center justify-center">1</span>
                                )}
                            </button>
                            {locationType && (
                                <button
                                    onClick={() => { setLocationType(''); setPage(1); }}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 text-[11px] font-semibold rounded-lg border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-all"
                                >
                                    {LOCATION_TYPE_OPTIONS.find(o => o.value === locationType)?.label}
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 min-h-0 p-2">
                        <div className="h-full rounded-xl border border-gray-200 overflow-hidden">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid
                                    rowData={rows}
                                    columnDefs={colDefs}
                                    loading={isLoading}
                                    rowSelection="single"
                                    onRowSelected={(row: StockRow) => setSelected(row)}
                                    onSelectionChanged={() => {}}
                                    rowHeight={46}
                                />
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.last_page > 1 && (
                        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                            <span>Page {pagination.current_page}/{pagination.last_page}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage(p => p - 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                >←</button>
                                <button
                                    disabled={page >= pagination.last_page}
                                    onClick={() => setPage(p => p + 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                                >→</button>
                            </div>
                        </div>
                    )}
                </div>
            }
            mainContent={
                <div className="h-full flex overflow-hidden">
                    {selected ? (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Breadcrumb header */}
                            <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-400">
                                <button onClick={() => setSelected(null)} className="hover:text-gray-700 transition-colors flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> Stock
                                </button>
                                <ChevronRight className="w-3 h-3" />
                                <span className="text-gray-700 font-medium truncate">{selected.product?.name ?? `Produit #${selected.product_id}`}</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ProductStockDetail row={selected} />
                            </div>
                        </div>
                    ) : (
                        <StockKPIDashboard />
                    )}
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: RefreshCw,
                                    label: 'Actualiser',
                                    variant: 'sage',
                                    onClick: () => refetch(),
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    icon: TrendingDown,
                                    label: 'Alertes stock bas',
                                    variant: 'warning',
                                    onClick: () => {
                                        setLocationType('');
                                        setSearch('');
                                    },
                                },
                                {
                                    icon: Filter,
                                    label: locationType ? 'Retirer filtre type' : 'Filtrer par type',
                                    variant: locationType ? 'danger' : 'default',
                                    onClick: () => { setTempLocationType(locationType); setShowFilters(true); },
                                },
                            ],
                        },
                    ]}
                />
            }
        />

        {/* Filter modal */}
        <Dialog open={showFilters} onOpenChange={v => !v && setShowFilters(false)}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <SlidersHorizontal className="w-4 h-4 text-teal-500" /> Filtrer par type
                    </DialogTitle>
                    <DialogDescription>
                        Sélectionnez un type d'emplacement pour affiner la liste.
                    </DialogDescription>
                </DialogHeader>
                <div className="pt-2">
                    <div className="space-y-1">
                        <button
                            onClick={() => setTempLocationType('')}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${tempLocationType === '' ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                        >
                            <span className="font-medium">Tous les types</span>
                        </button>
                        {LOCATION_TYPE_OPTIONS.filter(o => o.value !== '').map(o => {
                            const active = tempLocationType === o.value;
                            return (
                                <button
                                    key={o.value}
                                    onClick={() => setTempLocationType(o.value as StorageLocationType)}
                                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                                >
                                    <span className="font-medium">{o.label}</span>
                                    {active && <CheckCircle2 className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                    <button
                        onClick={() => { setTempLocationType(''); setLocationType(''); setPage(1); setShowFilters(false); }}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Réinitialiser
                    </button>
                    <button
                        onClick={() => { setLocationType(tempLocationType); setPage(1); setShowFilters(false); }}
                        className="px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                    >
                        Appliquer
                    </button>
                </div>
            </DialogContent>
        </Dialog>
        </>
    );
};
