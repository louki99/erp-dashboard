import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    AlertTriangle,
    Archive,
    CheckCircle2,
    Layers,
    Loader2,
    MapPin,
    Package,
    RefreshCw,
    Search,
    ToggleLeft,
    ToggleRight,
    Warehouse,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useWmsStockLevels } from '@/hooks/stock/useWms';
import type { StockLevelRow } from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (v: string | number | null | undefined) =>
    parseFloat(String(v || '0')).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const availStyle = (qty: number): React.CSSProperties => {
    if (qty <= 0) return { color: '#dc2626', fontWeight: '700', textAlign: 'right' };
    if (qty < 10) return { color: '#d97706', fontWeight: '600', textAlign: 'right' };
    return { color: '#059669', fontWeight: '600', textAlign: 'right' };
};

// ─── Detail Panel ─────────────────────────────────────────────────────────────

const StockLevelDetail = ({ row }: { row: StockLevelRow }) => {
    const qty = parseFloat(row.quantity);
    const reserved = parseFloat(row.reserved_quantity);
    const available = parseFloat(row.available_quantity);
    const minQty = parseFloat(row.minimum_quantity);
    const maxQty = parseFloat(row.maximum_quantity ?? '0');
    const isLow = row.minimum_quantity ? available < minQty : false;
    const stockPct = maxQty > 0 ? Math.min((available / maxQty) * 100, 100) : 0;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${isLow ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    <Package className={`w-7 h-7 ${isLow ? 'text-red-600' : 'text-emerald-600'}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{row.product.code}</span>
                        {row.product.barcode && (
                            <span className="text-xs text-gray-400 font-mono">{row.product.barcode}</span>
                        )}
                        {isLow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle className="w-3 h-3" /> Stock bas
                            </span>
                        )}
                    </div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">{row.product.name}</h2>
                </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Physique', value: fmtQty(qty), icon: Archive, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
                    { label: 'Réservé', value: fmtQty(reserved), icon: Package, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
                    { label: 'Disponible', value: fmtQty(available), icon: CheckCircle2, color: available <= 0 ? 'text-red-600' : available < minQty ? 'text-amber-600' : 'text-emerald-600', bg: available <= 0 ? 'bg-red-50' : available < minQty ? 'bg-amber-50' : 'bg-emerald-50', border: available <= 0 ? 'border-red-100' : available < minQty ? 'border-amber-100' : 'border-emerald-100' },
                    { label: 'Seuil min', value: fmtQty(minQty), icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-4 flex items-center gap-3 shadow-sm`}>
                        <div className={`w-9 h-9 rounded-lg ${k.bg} border ${k.border} flex items-center justify-center shrink-0`}>
                            <k.icon className={`w-4 h-4 ${k.color}`} />
                        </div>
                        <div>
                            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 font-medium">{k.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Stock level bar */}
            {maxQty > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                        <span className="font-semibold">Niveau de stock</span>
                        <span>{Math.round(stockPct)}% du maximum ({fmtQty(maxQty)})</span>
                    </div>
                    <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${available <= 0 ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${stockPct}%` }}
                        />
                        {minQty > 0 && maxQty > 0 && (
                            <div
                                className="absolute top-0 bottom-0 w-0.5 bg-rose-400"
                                style={{ left: `${Math.min((minQty / maxQty) * 100, 100)}%` }}
                                title={`Seuil minimum : ${fmtQty(minQty)}`}
                            />
                        )}
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1.5">
                        <span>Min : {fmtQty(minQty)}</span>
                        <span>Max : {fmtQty(maxQty)}</span>
                    </div>
                </div>
            )}

            {/* Location info */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Emplacement physique</p>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center shrink-0">
                            <Warehouse className="w-4 h-4 text-teal-500" />
                        </div>
                        <div>
                            <div className="text-xs text-gray-500">Entrepôt</div>
                            <div className="text-sm font-semibold text-gray-900 font-mono">{row.warehouse.code} — {row.warehouse.name}</div>
                        </div>
                    </div>
                    {row.storage_location ? (
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                <MapPin className="w-4 h-4 text-indigo-500" />
                            </div>
                            <div>
                                <div className="text-xs text-gray-500">Emplacement</div>
                                <div className="text-sm font-semibold text-gray-900 font-mono">{row.storage_location.location_code}</div>
                                <div className="text-xs text-gray-400">{row.storage_location.location_name} · {row.storage_location.location_type}</div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-xs text-gray-400 pl-1">
                            <Layers className="w-3 h-3" />
                            <span>Ligne agrégat entrepôt (Tier 1 — pas d'emplacement précis)</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Summary Banner ───────────────────────────────────────────────────────────

const SummaryBanner = ({ rows }: { rows: StockLevelRow[] }) => {
    const lowCount = rows.filter(r => {
        const avail = parseFloat(r.available_quantity);
        const min = parseFloat(r.minimum_quantity);
        return min > 0 && avail < min;
    }).length;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center shadow-sm">
                    <Warehouse className="w-6 h-6 text-teal-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Matrice des Stocks Physiques</h2>
                    <p className="text-sm text-gray-400">{rows.length} ligne{rows.length !== 1 ? 's' : ''} · Sélectionnez une ligne pour voir le détail</p>
                </div>
            </div>
            {lowCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl mb-4">
                    <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-red-800">{lowCount} article{lowCount > 1 ? 's' : ''} en stock bas</p>
                        <p className="text-xs text-red-600/80">Activez le filtre "Stock bas uniquement" pour les isoler.</p>
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                    { label: 'Lignes totales', value: rows.length, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
                    { label: 'Alertes stock bas', value: lowCount, color: lowCount > 0 ? 'text-red-600' : 'text-gray-400', bg: lowCount > 0 ? 'bg-red-50' : 'bg-gray-50', border: lowCount > 0 ? 'border-red-100' : 'border-gray-200' },
                    { label: 'Lignes OK', value: rows.length - lowCount, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                        <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                        <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsStockMatrixPage = () => {
    const [selected, setSelected] = useState<StockLevelRow | null>(null);
    const [search, setSearch] = useState('');
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [page, setPage] = useState(1);

    const { data, isLoading, refetch } = useWmsStockLevels({
        low_stock_only: lowStockOnly || undefined,
        per_page: 50,
        page,
    });

    const rawRows: StockLevelRow[] = useMemo(() => {
        const d = data as any;
        if (Array.isArray(d?.data?.data)) return d.data.data;
        return [];
    }, [data]);

    const rows = useMemo(() => {
        if (!search.trim()) return rawRows;
        const q = search.toLowerCase();
        return rawRows.filter(r =>
            r.product?.name?.toLowerCase().includes(q) ||
            r.product?.code?.toLowerCase().includes(q) ||
            r.warehouse?.code?.toLowerCase().includes(q) ||
            r.storage_location?.location_code?.toLowerCase().includes(q)
        );
    }, [rawRows, search]);

    const pagination: any = (data as any)?.data;

    const colDefs = useMemo<ColDef[]>(() => [
        {
            field: 'product.name',
            headerName: 'Produit',
            flex: 1,
            minWidth: 200,
            cellRenderer: (p: any) => {
                const r: StockLevelRow = p.data;
                return (
                    <div className="py-1">
                        <div className="text-xs font-semibold text-gray-900 truncate">{r.product?.name ?? `#${r.product_id}`}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.product?.code}</div>
                    </div>
                );
            },
        },
        {
            field: 'warehouse.code',
            headerName: 'Entrepôt',
            width: 130,
            cellRenderer: (p: any) => {
                const r: StockLevelRow = p.data;
                return (
                    <div className="py-1">
                        <div className="text-[11px] font-mono font-semibold text-gray-700">{r.warehouse?.code}</div>
                        <div className="text-[10px] text-gray-400 truncate">{r.warehouse?.name}</div>
                    </div>
                );
            },
        },
        {
            field: 'storage_location.location_code',
            headerName: 'Emplacement',
            width: 170,
            cellRenderer: (p: any) => {
                const r: StockLevelRow = p.data;
                if (!r.storage_location) {
                    return <span className="text-[10px] text-gray-400 italic">Agrégat entrepôt</span>;
                }
                return (
                    <div className="py-1">
                        <div className="text-[11px] font-mono font-semibold text-indigo-700">{r.storage_location.location_code}</div>
                        <div className="text-[10px] text-gray-400">{r.storage_location.location_type}</div>
                    </div>
                );
            },
        },
        {
            field: 'quantity',
            headerName: 'Physique',
            width: 90,
            valueFormatter: (p: any) => fmtQty(p.value),
            cellStyle: { textAlign: 'right', fontWeight: '600', color: '#374151' },
        },
        {
            field: 'reserved_quantity',
            headerName: 'Réservé',
            width: 85,
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
            width: 95,
            cellRenderer: (p: any) => {
                const r: StockLevelRow = p.data;
                const avail = parseFloat(r.available_quantity);
                const min = parseFloat(r.minimum_quantity);
                const isLow = min > 0 && avail < min;
                return (
                    <div className="flex items-center justify-end gap-1.5 h-full">
                        {isLow && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                        <span style={availStyle(avail)}>{fmtQty(avail)}</span>
                    </div>
                );
            },
        },
    ], []);

    const handleToggleLowStock = () => {
        setLowStockOnly(v => !v);
        setPage(1);
        setSelected(null);
        if (!lowStockOnly) toast('Affichage filtré : stock bas uniquement', { icon: '🔻' });
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h1 className="text-sm font-bold text-gray-900">Matrice des Stocks</h1>
                                <p className="text-[11px] text-gray-400 mt-0.5">{rows.length} ligne{rows.length !== 1 ? 's' : ''}</p>
                            </div>
                            {lowStockOnly && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
                                    <AlertTriangle className="w-2.5 h-2.5" /> Bas
                                </span>
                            )}
                        </div>

                        {/* Search */}
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Produit, code, entrepôt, emplacement..."
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

                        {/* Low stock toggle */}
                        <button
                            onClick={handleToggleLowStock}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${lowStockOnly ? 'bg-red-50 border-red-200 text-red-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                        >
                            <span className="flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Stock bas uniquement
                            </span>
                            {lowStockOnly
                                ? <ToggleRight className="w-5 h-5 text-red-500" />
                                : <ToggleLeft className="w-5 h-5 text-gray-400" />
                            }
                        </button>
                    </div>

                    {/* Grid */}
                    <div className="flex-1 min-h-0 p-2">
                        <div className="h-full rounded-xl border border-gray-200 overflow-hidden">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : rows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                                    <Package className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-medium">{lowStockOnly ? 'Aucun produit en stock bas' : 'Aucune donnée'}</p>
                                </div>
                            ) : (
                                <DataGrid
                                    rowData={rows}
                                    columnDefs={colDefs}
                                    loading={isLoading}
                                    rowSelection="single"
                                    onRowSelected={(row: StockLevelRow) => setSelected(row)}
                                    onSelectionChanged={() => {}}
                                    rowHeight={50}
                                />
                            )}
                        </div>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.last_page > 1 && (
                        <div className="px-3 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                            <span>Page {pagination.current_page}/{pagination.last_page} · {pagination.total} total</span>
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
                            <div className="shrink-0 flex items-center gap-2 px-5 py-2.5 bg-white border-b border-gray-100 text-xs text-gray-400">
                                <button onClick={() => setSelected(null)} className="hover:text-gray-700 transition-colors flex items-center gap-1">
                                    <Warehouse className="w-3 h-3" /> Matrice
                                </button>
                                <span>›</span>
                                <span className="text-gray-700 font-medium truncate">{selected.product?.name}</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <StockLevelDetail row={selected} />
                            </div>
                        </div>
                    ) : (
                        <SummaryBanner rows={rows} />
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
                                    onClick: () => { refetch(); },
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    icon: lowStockOnly ? ToggleRight : ToggleLeft,
                                    label: lowStockOnly ? 'Voir tout le stock' : 'Stock bas uniquement',
                                    variant: lowStockOnly ? 'danger' : 'warning',
                                    onClick: handleToggleLowStock,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
