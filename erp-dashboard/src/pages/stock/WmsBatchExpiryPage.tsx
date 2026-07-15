import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    FlaskConical,
    Loader2,
    Lock,
    LockOpen,
    RefreshCw,
    Search,
    ShieldAlert,
    ToggleLeft,
    ToggleRight,
    X,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
import { useWmsBatchesExpiry, useBulkBlockBatches, useBulkUnblockBatches } from '@/hooks/stock/useWms';
import type { StockBatchExpiryRow, BatchAlertStatus } from '@/types/stock.types';

// ─── Alert status config ──────────────────────────────────────────────────────

const ALERT_CONFIG: Record<BatchAlertStatus, {
    label: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    dotClass: string;
    rowBg: string;
}> = {
    QUARANTINE: {
        label: 'Quarantaine',
        textClass: 'text-red-700',
        bgClass: 'bg-red-100',
        borderClass: 'border-red-200',
        dotClass: 'bg-red-500',
        rowBg: 'rgba(254,242,242,0.6)',
    },
    EXPIRED: {
        label: 'Périmé',
        textClass: 'text-red-700',
        bgClass: 'bg-red-100',
        borderClass: 'border-red-200',
        dotClass: 'bg-red-500',
        rowBg: 'rgba(254,242,242,0.6)',
    },
    WARNING: {
        label: 'Alerte',
        textClass: 'text-amber-700',
        bgClass: 'bg-amber-100',
        borderClass: 'border-amber-200',
        dotClass: 'bg-amber-500',
        rowBg: 'rgba(255,251,235,0.6)',
    },
    OK: {
        label: 'OK',
        textClass: 'text-emerald-700',
        bgClass: 'bg-emerald-100',
        borderClass: 'border-emerald-200',
        dotClass: 'bg-emerald-500',
        rowBg: 'rgba(240,253,244,0)',
    },
};

const fmtQty = (v: string | number | null | undefined) =>
    parseFloat(String(v || '0')).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (iso: string) => {
    try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return iso; }
};

// ─── Bulk Block Modal ─────────────────────────────────────────────────────────

interface BulkBlockModalProps {
    ids: number[];
    onClose: () => void;
    onClearSelection: () => void;
}

const BulkBlockModal = ({ ids, onClose, onClearSelection }: BulkBlockModalProps) => {
    const [reason, setReason] = useState('');
    const { mutate: blockBatches, isPending } = useBulkBlockBatches();

    const handleSubmit = () => {
        if (!reason.trim()) {
            toast.error('Le motif de mise en quarantaine est obligatoire.');
            return;
        }
        blockBatches(
            { stock_batch_ids: ids, reason: reason.trim() },
            {
                onSuccess: (data: any) => {
                    toast.success(data?.message ?? `${ids.length} lot(s) mis en quarantaine`);
                    onClearSelection();
                    onClose();
                },
                onError: (err: any) => {
                    toast.error(err?.response?.data?.message ?? 'Erreur lors de la mise en quarantaine.');
                },
            }
        );
    };

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base text-red-700">
                        <ShieldAlert className="w-5 h-5" />
                        Mettre en quarantaine — {ids.length} lot{ids.length !== 1 ? 's' : ''}
                    </DialogTitle>
                    <DialogDescription>
                        Cette action bloque les lots sélectionnés et empêche tout mouvement de sortie.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                    <AlertOctagon className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 font-medium">
                        {ids.length} lot{ids.length !== 1 ? 's' : ''} seront bloqués (statut → <code className="bg-red-100 px-1 rounded">quarantine</code>).
                        Ils ne pourront plus être sortis du stock tant qu'ils ne sont pas débloqués.
                    </p>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Motif <span className="text-red-500">*</span>
                        <span className="ml-1 text-[10px] font-normal text-gray-400">(obligatoire — requis par l'API)</span>
                    </label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="ex. Péremption dépassée — retrait vente, contamination suspectée..."
                        rows={3}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                    />
                    {!reason.trim() && (
                        <p className="text-[10px] text-red-500 mt-1">Ce champ est requis (422 si vide).</p>
                    )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !reason.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                        Mettre en quarantaine
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Bulk Unblock Modal ───────────────────────────────────────────────────────

interface BulkUnblockModalProps {
    ids: number[];
    onClose: () => void;
    onClearSelection: () => void;
}

const BulkUnblockModal = ({ ids, onClose, onClearSelection }: BulkUnblockModalProps) => {
    const { mutate: unblockBatches, isPending } = useBulkUnblockBatches();

    const handleSubmit = () => {
        unblockBatches(
            { stock_batch_ids: ids },
            {
                onSuccess: (data: any) => {
                    toast.success(data?.message ?? `${ids.length} lot(s) débloqué(s)`);
                    onClearSelection();
                    onClose();
                },
                onError: (err: any) => {
                    toast.error(err?.response?.data?.message ?? 'Erreur lors du déblocage.');
                },
            }
        );
    };

    return (
        <Dialog open onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base text-emerald-700">
                        <LockOpen className="w-5 h-5" />
                        Débloquer — {ids.length} lot{ids.length !== 1 ? 's' : ''}
                    </DialogTitle>
                    <DialogDescription>
                        Seuls les lots en statut <code className="bg-gray-100 px-1 rounded text-xs">quarantine</code> seront réactivés.
                        Les lots réellement périmés (status=expired) ne sont pas modifiés.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LockOpen className="w-3.5 h-3.5" />}
                        Confirmer le déblocage
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsBatchExpiryPage = () => {
    const [search, setSearch] = useState('');
    const [warehouseCode, setWarehouseCode] = useState('');
    const [includeAll, setIncludeAll] = useState(true);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showUnblockModal, setShowUnblockModal] = useState(false);

    const { data, isLoading, refetch } = useWmsBatchesExpiry({
        warehouse_code: warehouseCode || undefined,
        include_all: includeAll,
        per_page: 100,
    });

    const rawRows: StockBatchExpiryRow[] = useMemo(() => {
        const d = data as any;
        if (Array.isArray(d?.data?.data)) return d.data.data;
        return [];
    }, [data]);

    const rows = useMemo(() => {
        if (!search.trim()) return rawRows;
        const q = search.toLowerCase();
        return rawRows.filter(r =>
            r.batch_number?.toLowerCase().includes(q) ||
            r.product?.name?.toLowerCase().includes(q) ||
            r.product?.code?.toLowerCase().includes(q)
        );
    }, [rawRows, search]);

    const alertDays = (data as any)?.lot_expiry_alert_days ?? 30;

    // Stats
    const stats = useMemo(() => ({
        quarantine: rows.filter(r => r.alert_status === 'QUARANTINE').length,
        expired: rows.filter(r => r.alert_status === 'EXPIRED').length,
        warning: rows.filter(r => r.alert_status === 'WARNING').length,
        ok: rows.filter(r => r.alert_status === 'OK').length,
    }), [rows]);

    const toggleRow = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (selectedIds.size === rows.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(rows.map(r => r.id)));
        }
    };

    const clearSelection = () => setSelectedIds(new Set());

    const colDefs = useMemo<ColDef[]>(() => [
        {
            headerName: '',
            width: 48,
            pinned: 'left' as const,
            sortable: false,
            resizable: false,
            headerCheckboxSelection: false,
            headerComponent: () => (
                <input
                    type="checkbox"
                    checked={rows.length > 0 && selectedIds.size === rows.length}
                    onChange={toggleAll}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
                />
            ),
            cellRenderer: (p: any) => {
                const r: StockBatchExpiryRow = p.data;
                return (
                    <div className="flex items-center justify-center h-full">
                        <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={() => toggleRow(r.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-teal-600 focus:ring-teal-400"
                        />
                    </div>
                );
            },
        },
        {
            field: 'alert_status',
            headerName: 'Statut',
            width: 110,
            cellRenderer: (p: any) => {
                const r: StockBatchExpiryRow = p.data;
                const cfg = ALERT_CONFIG[r.alert_status] ?? ALERT_CONFIG.OK;
                return (
                    <div className="flex items-center gap-1.5 h-full">
                        <span className={`w-2 h-2 rounded-full ${cfg.dotClass} shrink-0`} />
                        <span className={`text-[11px] font-semibold ${cfg.textClass}`}>{cfg.label}</span>
                    </div>
                );
            },
        },
        {
            field: 'batch_number',
            headerName: 'N° de lot',
            width: 150,
            cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: '600', color: '#374151' },
        },
        {
            field: 'product.name',
            headerName: 'Produit',
            flex: 1,
            minWidth: 200,
            cellRenderer: (p: any) => {
                const r: StockBatchExpiryRow = p.data;
                return (
                    <div className="py-1">
                        <div className="text-xs font-semibold text-gray-900 truncate">{r.product?.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{r.product?.code}</div>
                    </div>
                );
            },
        },
        {
            field: 'expiry_date',
            headerName: 'Péremption',
            width: 120,
            cellRenderer: (p: any) => {
                const r: StockBatchExpiryRow = p.data;
                const isRed = r.alert_status === 'EXPIRED' || r.alert_status === 'QUARANTINE';
                const isAmber = r.alert_status === 'WARNING';
                return (
                    <div className={`text-xs font-semibold ${isRed ? 'text-red-600' : isAmber ? 'text-amber-600' : 'text-gray-700'}`}>
                        {fmtDate(r.expiry_date)}
                    </div>
                );
            },
        },
        {
            field: 'days_until_expiry',
            headerName: 'J restants',
            width: 100,
            cellRenderer: (p: any) => {
                const r: StockBatchExpiryRow = p.data;
                const d = r.days_until_expiry;
                const isNeg = d < 0;
                return (
                    <div className={`text-xs font-bold text-right ${isNeg ? 'text-red-600' : d <= alertDays ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {isNeg ? `J+${Math.abs(d)}` : `J-${d}`}
                    </div>
                );
            },
        },
        {
            field: 'quantity',
            headerName: 'Qté',
            width: 80,
            valueFormatter: (p: any) => fmtQty(p.value),
            cellStyle: { textAlign: 'right', fontWeight: '600', color: '#374151' },
        },
        {
            field: 'status',
            headerName: 'Statut DB',
            width: 100,
            cellStyle: (p: any) => ({
                fontSize: '10px',
                fontFamily: 'monospace',
                color: p.value === 'quarantine' ? '#dc2626' : p.value === 'expired' ? '#b91c1c' : '#059669',
            } as any),
        },
    ], [rows, selectedIds, toggleAll, toggleRow]);

    const getRowStyle = (p: any) => {
        const r: StockBatchExpiryRow = p?.data;
        if (!r) return {};
        return { background: ALERT_CONFIG[r.alert_status]?.rowBg ?? 'transparent' };
    };

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                                    <FlaskConical className="w-4.5 h-4.5 text-purple-600" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900">Lots & Péremption</h1>
                                    <p className="text-[10px] text-gray-400">{rows.length} lot{rows.length !== 1 ? 's' : ''} · fenêtre {alertDays}j</p>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative mb-3">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="N° lot, produit, code..."
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

                            {/* Warehouse filter */}
                            <div className="mb-3">
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Code entrepôt</label>
                                <input
                                    type="text"
                                    value={warehouseCode}
                                    onChange={e => setWarehouseCode(e.target.value.toUpperCase())}
                                    placeholder="ex. A0001"
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all font-mono"
                                />
                            </div>

                            {/* Include all toggle */}
                            <button
                                onClick={() => setIncludeAll(v => !v)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${includeAll ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Inclure lots sains (OK)
                                </span>
                                {includeAll
                                    ? <ToggleRight className="w-5 h-5 text-indigo-500" />
                                    : <ToggleLeft className="w-5 h-5 text-gray-400" />
                                }
                            </button>
                        </div>

                        {/* Selection bar */}
                        {selectedIds.size > 0 && (
                            <div className="px-4 py-2.5 border-b border-gray-100 bg-teal-50 shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-teal-800">{selectedIds.size} lot{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}</span>
                                    <button onClick={clearSelection} className="text-[10px] text-teal-600 hover:text-teal-800 flex items-center gap-0.5">
                                        <X className="w-3 h-3" /> Effacer
                                    </button>
                                </div>
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={() => setShowBlockModal(true)}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        <Lock className="w-3 h-3" /> Quarantaine
                                    </button>
                                    <button
                                        onClick={() => setShowUnblockModal(true)}
                                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[11px] font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                    >
                                        <LockOpen className="w-3 h-3" /> Débloquer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Alert counts */}
                        <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { label: 'Quarantaine', count: stats.quarantine, dot: 'bg-red-500', text: 'text-red-700' },
                                    { label: 'Périmés', count: stats.expired, dot: 'bg-red-400', text: 'text-red-600' },
                                    { label: 'Alertes', count: stats.warning, dot: 'bg-amber-500', text: 'text-amber-700' },
                                    { label: 'Sains', count: stats.ok, dot: 'bg-emerald-500', text: 'text-emerald-700' },
                                ].map(s => (
                                    <div key={s.label} className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                                        <span className={`text-[11px] font-semibold ${s.text}`}>{s.count}</span>
                                        <span className="text-[10px] text-gray-500 truncate">{s.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <p className="px-4 py-2 text-[10px] text-gray-400 shrink-0">
                            Sélectionnez des lots via les cases à cocher puis utilisez les actions en haut de cette colonne.
                        </p>
                    </div>
                }
                mainContent={
                    <div className="h-full flex flex-col overflow-hidden">
                        {/* Bulk actions top bar */}
                        {selectedIds.size > 0 && (
                            <div className="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-teal-50 border-b border-teal-100">
                                <span className="text-xs font-semibold text-teal-800">{selectedIds.size} lot{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}</span>
                                <div className="flex gap-2 ml-auto">
                                    <button
                                        onClick={() => setShowBlockModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
                                    >
                                        <Lock className="w-3.5 h-3.5" /> Mettre en quarantaine
                                    </button>
                                    <button
                                        onClick={() => setShowUnblockModal(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
                                    >
                                        <LockOpen className="w-3.5 h-3.5" /> Débloquer
                                    </button>
                                    <button
                                        onClick={clearSelection}
                                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Color legend */}
                        <div className="shrink-0 flex items-center gap-4 px-5 py-2 bg-white border-b border-gray-100 text-[10px] font-medium">
                            <span className="text-gray-400 font-semibold uppercase tracking-wider">Code couleur :</span>
                            {Object.entries(ALERT_CONFIG).map(([key, cfg]) => (
                                <span key={key} className="flex items-center gap-1">
                                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                                    <span className={cfg.textClass}>{cfg.label}</span>
                                </span>
                            ))}
                        </div>

                        {/* Grid */}
                        <div className="flex-1 min-h-0 p-3">
                            <div className="h-full rounded-xl border border-gray-200 overflow-hidden">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : rows.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
                                        <FlaskConical className="w-12 h-12 opacity-25" />
                                        <p className="text-sm font-medium">Aucun lot trouvé</p>
                                        <p className="text-xs">Ajustez les filtres ou activez "Inclure lots sains".</p>
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={rows}
                                        columnDefs={colDefs}
                                        loading={isLoading}
                                        rowSelection="multiple"
                                        onRowSelected={() => {}}
                                        onSelectionChanged={() => {}}
                                        rowHeight={50}
                                        getRowStyle={getRowStyle}
                                    />
                                )}
                            </div>
                        </div>
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
                                        icon: Lock,
                                        label: `Quarantaine (${selectedIds.size})`,
                                        variant: 'danger',
                                        onClick: () => {
                                            if (selectedIds.size === 0) { toast('Sélectionnez au moins un lot.'); return; }
                                            setShowBlockModal(true);
                                        },
                                    },
                                    {
                                        icon: LockOpen,
                                        label: `Débloquer (${selectedIds.size})`,
                                        variant: 'default',
                                        onClick: () => {
                                            if (selectedIds.size === 0) { toast('Sélectionnez au moins un lot.'); return; }
                                            setShowUnblockModal(true);
                                        },
                                    },
                                ],
                            },
                            {
                                items: [
                                    {
                                        icon: AlertTriangle,
                                        label: 'Actionnables seulement',
                                        variant: 'warning',
                                        onClick: () => setIncludeAll(false),
                                    },
                                ],
                            },
                        ]}
                    />
                }
            />

            {showBlockModal && (
                <BulkBlockModal
                    ids={Array.from(selectedIds)}
                    onClose={() => setShowBlockModal(false)}
                    onClearSelection={clearSelection}
                />
            )}

            {showUnblockModal && (
                <BulkUnblockModal
                    ids={Array.from(selectedIds)}
                    onClose={() => setShowUnblockModal(false)}
                    onClearSelection={clearSelection}
                />
            )}
        </>
    );
};
