import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    Loader2,
    RefreshCw,
    Plus,
    CheckCircle2,
    BarChart3,
    Box,
    ArrowUpRight,
    ArrowDownLeft,
    History,
    AlertTriangle,
    Search,
    Filter,
    X,
    ClipboardList,
    Truck,
    RotateCcw,
    ArrowLeftRight,
    ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ActionPanel } from '@/components/layout/ActionPanel';

import {
    useStockList,
    useStockMovements,
    useEffectiveStock,
    useCreateProvisional,
    useReconcileX3,
} from '@/hooks/stock/useStockManagement';

import type {
    StockItem,
    StockFilters,
    MovementFilters,
    MovementType,
    MovementStatus,
    CreateProvisionalRequest,
} from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
    purchase: 'Achat',
    sale: 'Vente',
    adjustment: 'Ajustement',
    transfer_in: 'Transfert Entrant',
    transfer_out: 'Transfert Sortant',
    return: 'Retour',
};

const MOVEMENT_TYPE_ICONS: Record<MovementType, typeof ArrowDownLeft> = {
    purchase: ArrowDownLeft,
    sale: ArrowUpRight,
    adjustment: RotateCcw,
    transfer_in: ArrowDownLeft,
    transfer_out: ArrowUpRight,
    return: RotateCcw,
};

const STATUS_COLORS: Record<MovementStatus, { bg: string; text: string; dot: string }> = {
    CONFIRMED: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    PROVISIONAL: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
    REVERSED: { bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' },
};

const STATUS_LABELS: Record<MovementStatus, string> = {
    CONFIRMED: 'Confirmé',
    PROVISIONAL: 'Provisoire',
    REVERSED: 'Inversé',
};

const DEFAULT_BRANCH = 'A0001';

// ─── Component ────────────────────────────────────────────────────────────────

export const StockManagementPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selected, setSelected] = useState<StockItem | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('overview');
    const [showProvisionalModal, setShowProvisionalModal] = useState(false);
    const [showReconcileConfirm, setShowReconcileConfirm] = useState(false);
    const [provisionalForm, setProvisionalForm] = useState<Partial<CreateProvisionalRequest>>({
        branch_code: DEFAULT_BRANCH,
        quantity: 0,
        type: 'purchase',
        notes: '',
    });

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        overview: true,
        effective: true,
        movements: true,
    });

    const [stockFilters, setStockFilters] = useState<StockFilters>({
        branch_code: DEFAULT_BRANCH,
        page: 1,
    });
    const [searchInput, setSearchInput] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);
    const [filterOutOfStock, setFilterOutOfStock] = useState(false);

    const [movementFilters, setMovementFilters] = useState<MovementFilters>({
        branch_code: DEFAULT_BRANCH,
    });
    const [movementStatusFilter, setMovementStatusFilter] = useState<MovementStatus | ''>('');
    const [movementTypeFilter, setMovementTypeFilter] = useState<MovementType | ''>('');

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Data hooks ────────────────────────────────────────────────────────────
    const { data: stockData, loading: stockLoading, error: stockError, refetch: refetchStocks } = useStockList(stockFilters);
    const stocks = stockData?.data?.data || [];
    const paginationInfo = stockData?.data;

    const { data: movementData, loading: movementsLoading, refetch: refetchMovements } = useStockMovements({
        ...movementFilters,
        product_id: selected?.product_id,
    });
    const movements = movementData?.data?.data || [];

    const { data: effectiveData, loading: effectiveLoading, refetch: refetchEffective } = useEffectiveStock(
        selected ? { product_id: selected.product_id, branch_code: selected.branch_code } : null
    );
    const effective = effectiveData?.data;

    const { createProvisional, loading: creatingProvisional } = useCreateProvisional();
    const { reconcile, loading: reconciling } = useReconcileX3();


    // ── Search handler with debounce ──────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearchInput(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setStockFilters(prev => ({ ...prev, search: value || undefined, page: 1 }));
        }, 400);
    };

    // ── Filter toggles ────────────────────────────────────────────────────────
    useEffect(() => {
        setStockFilters(prev => ({
            ...prev,
            low_stock: filterLowStock || undefined,
            out_of_stock: filterOutOfStock || undefined,
            page: 1,
        }));
    }, [filterLowStock, filterOutOfStock]);

    // ── Movement filters ──────────────────────────────────────────────────────
    useEffect(() => {
        setMovementFilters(prev => ({
            ...prev,
            movement_status: movementStatusFilter || undefined,
            type: movementTypeFilter || undefined,
        }));
    }, [movementStatusFilter, movementTypeFilter]);

    // ── Column defs ───────────────────────────────────────────────────────────
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'product.code',
            headerName: 'Code',
            width: 130,
            valueGetter: (params: any) => params.data?.product?.code || '-',
        },
        {
            field: 'product.name',
            headerName: 'Produit',
            flex: 1,
            minWidth: 200,
            valueGetter: (params: any) => params.data?.product?.name || '-',
        },
        {
            field: 'quantity',
            headerName: 'Qté physique',
            width: 110,
            valueFormatter: (params: any) => parseFloat(params.value || '0').toFixed(0),
            cellStyle: () => ({ textAlign: 'right', fontWeight: '600' }),
        },
        {
            field: 'reserved_quantity',
            headerName: 'Réservé',
            width: 100,
            valueFormatter: (params: any) => parseFloat(params.value || '0').toFixed(0),
            cellStyle: (params: any) => ({
                textAlign: 'right',
                color: parseFloat(params.value || '0') > 0 ? '#d97706' : '#9ca3af',
            }),
        },
        {
            field: 'available_quantity',
            headerName: 'Disponible',
            width: 110,
            valueFormatter: (params: any) => parseFloat(params.value || '0').toFixed(0),
            cellStyle: (params: any) => {
                const qty = parseFloat(params.value || '0');
                if (qty <= 0) return { textAlign: 'right', color: '#dc2626', fontWeight: '700' };
                if (qty < 10) return { textAlign: 'right', color: '#f59e0b', fontWeight: '600' };
                return { textAlign: 'right', color: '#059669', fontWeight: '600' };
            },
        },
        {
            field: 'effective_available',
            headerName: 'Effectif',
            width: 100,
            cellStyle: (params: any) => {
                const qty = params.value ?? 0;
                if (qty <= 0) return { textAlign: 'right', color: '#dc2626', fontWeight: '700' };
                if (qty < 10) return { textAlign: 'right', color: '#f59e0b', fontWeight: '600' };
                return { textAlign: 'right', color: '#059669', fontWeight: '700' };
            },
        },
    ], []);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs: TabItem[] = useMemo(() => [
        { id: 'overview', label: 'Vue d\'ensemble', icon: Box },
        { id: 'effective', label: 'Stock Effectif', icon: BarChart3 },
        { id: 'movements', label: 'Mouvements', icon: History },
    ], []);

    // ── Row selection handler ─────────────────────────────────────────────────
    const onSelect = (row: StockItem) => {
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);

        setSelected(row);
        setActiveTab('overview');
        setShowDetailPanel(true);

        // Fetch movements for this product
        setMovementFilters(prev => ({
            ...prev,
            product_id: row.product_id,
        }));

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    };

    // ── Tab / Section navigation ──────────────────────────────────────────────
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };

    const toggleSection = (sectionId: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [sectionId]: isOpen }));
    };

    const handleExpandAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    };

    const handleCollapseAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
    };

    // ── Scroll sync ───────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;
            const containerTop = container.scrollTop;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el || !openSections[tab.id]) continue;
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;
                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [openSections, tabs, activeTab]);

    // ── Provisional Movement handler ──────────────────────────────────────────
    const handleCreateProvisional = async () => {
        if (!provisionalForm.branch_code || !provisionalForm.product_id || !provisionalForm.quantity || !provisionalForm.type) {
            toast.error('Veuillez remplir tous les champs obligatoires');
            return;
        }

        const toastId = toast.loading('Création du mouvement provisoire...');
        try {
            const res = await createProvisional(provisionalForm as CreateProvisionalRequest);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Mouvement provisoire créé avec succès');
                setShowProvisionalModal(false);
                setProvisionalForm({
                    branch_code: DEFAULT_BRANCH,
                    quantity: 0,
                    type: 'purchase',
                    notes: '',
                });
                await refetchStocks();
                if (selected) {
                    await refetchMovements();
                    await refetchEffective();
                }
            } else {
                toast.error(res.message || 'Erreur lors de la création');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur lors de la création');
        }
    };

    // ── Reconcile handler ─────────────────────────────────────────────────────
    const handleReconcile = async () => {
        if (!selected) return;
        setShowReconcileConfirm(false);

        const toastId = toast.loading('Réconciliation X3 en cours...');
        try {
            const res = await reconcile({
                branch_code: selected.branch_code,
                product_id: selected.product_id,
                quantity: parseFloat(selected.quantity),
                type: 'purchase',
                notes: 'Réconciliation manuelle depuis le dashboard',
            });
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Réconciliation effectuée');
                await refetchStocks();
                await refetchMovements();
                await refetchEffective();
            } else {
                toast.error(res.message || 'Erreur de réconciliation');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur de réconciliation');
        }
    };

    // ── Refresh all ───────────────────────────────────────────────────────────
    const handleRefreshAll = async () => {
        const toastId = toast.loading('Actualisation...');
        await refetchStocks();
        if (selected) {
            await refetchMovements();
            await refetchEffective();
        }
        toast.dismiss(toastId);
        toast.success('Données actualisées');
    };

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* ── Header + Stats ─────────────────────────────── */}
                        <div className="p-3 border-b border-gray-100 shrink-0">
                            <h1 className="text-sm font-semibold text-gray-900 mb-2">Gestion des Stocks</h1>

                            {/* Search bar */}
                            <div className="relative mt-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    placeholder="Rechercher un produit..."
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                                />
                                {searchInput && (
                                    <button
                                        onClick={() => handleSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200"
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {/* Branch code selector */}
                            <div className="mt-2 flex items-center gap-2">
                                <label className="text-xs text-gray-500 shrink-0">Dépôt:</label>
                                <input
                                    type="text"
                                    value={stockFilters.branch_code}
                                    onChange={(e) => setStockFilters(prev => ({ ...prev, branch_code: e.target.value, page: 1 }))}
                                    className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 font-mono"
                                    placeholder="A0001"
                                />
                            </div>
                        </div>

                        {/* ── Error banner ────────────────────────────────── */}
                        {stockError && (
                            <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100 bg-red-50 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {stockError}
                            </div>
                        )}

                        {/* ── DataGrid ────────────────────────────────────── */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                {stockLoading ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={stocks}
                                        columnDefs={columnDefs}
                                        loading={stockLoading}
                                        onRowSelected={undefined}
                                        onSelectionChanged={() => { }}
                                        rowSelection="single"
                                        onRowDoubleClicked={onSelect}
                                    />
                                )}
                            </div>
                        </div>

                        {/* ── Pagination ──────────────────────────────────── */}
                        {paginationInfo && paginationInfo.last_page > 1 && (
                            <div className="p-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                                <span>Page {paginationInfo.current_page} / {paginationInfo.last_page}</span>
                                <div className="flex gap-1">
                                    <button
                                        disabled={paginationInfo.current_page <= 1}
                                        onClick={() => setStockFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        ←
                                    </button>
                                    <button
                                        disabled={paginationInfo.current_page >= paginationInfo.last_page}
                                        onClick={() => setStockFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {showDetailPanel && selected ? (
                            <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
                                {/* ── Detail Header ──────────────────────── */}
                                <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex items-start gap-2 min-w-0 flex-1">
                                            <button
                                                onClick={() => setShowDetailPanel(false)}
                                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                                                title="Retour"
                                            >
                                                <X className="w-5 h-5 text-gray-600" />
                                            </button>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                                        {selected.product?.name || `Produit #${selected.product_id}`}
                                                    </h1>
                                                    {parseFloat(selected.available_quantity) <= 0 && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded shrink-0">
                                                            Rupture
                                                        </span>
                                                    )}
                                                    {parseFloat(selected.available_quantity) > 0 && parseFloat(selected.available_quantity) < 10 && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded shrink-0">
                                                            Stock bas
                                                        </span>
                                                    )}
                                                    {parseFloat(selected.available_quantity) >= 10 && (
                                                        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded shrink-0">
                                                            En stock
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                                    <span className="font-medium">Code: {selected.product?.code}</span>
                                                    <span>Dépôt: {selected.branch_code}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xl sm:text-2xl font-bold text-blue-600 whitespace-nowrap">
                                                {selected.effective_available}
                                                <span className="text-xs sm:text-sm font-normal text-gray-400 ml-1">effectif</span>
                                            </div>
                                            {(effectiveLoading || movementsLoading) && (
                                                <div className="mt-1 text-xs text-gray-500 flex items-center gap-1 justify-end">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Tabs ────────────────────────────────── */}
                                <div className="shrink-0 bg-white border-b border-gray-200 overflow-hidden">
                                    <SageTabs
                                        tabs={tabs}
                                        activeTabId={activeTab}
                                        onTabChange={handleTabChange}
                                        onExpandAll={handleExpandAll}
                                        onCollapseAll={handleCollapseAll}
                                        className="shadow-none"
                                    />
                                </div>

                                {/* ── Scrollable Sections ────────────────── */}
                                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Overview Section ───────────────── */}
                                    <div ref={el => { sectionRefs.current['overview'] = el; }}>
                                        <SageCollapsible
                                            title="Vue d'ensemble du stock"
                                            isOpen={openSections['overview']}
                                            onOpenChange={(open) => toggleSection('overview', open)}
                                        >
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                                                    <div className="text-xs text-gray-500 mb-1">Qté physique</div>
                                                    <div className="text-2xl font-bold text-gray-900">{parseFloat(selected.quantity).toFixed(0)}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">Snapshot actuel</div>
                                                </div>
                                                <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                                                    <div className="text-xs text-gray-500 mb-1">Réservé</div>
                                                    <div className="text-2xl font-bold text-amber-600">{parseFloat(selected.reserved_quantity).toFixed(0)}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">En cours de traitement</div>
                                                </div>
                                                <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm">
                                                    <div className="text-xs text-gray-500 mb-1">Disponible</div>
                                                    <div className={`text-2xl font-bold ${parseFloat(selected.available_quantity) <= 0 ? 'text-red-600' : parseFloat(selected.available_quantity) < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                        {parseFloat(selected.available_quantity).toFixed(0)}
                                                    </div>
                                                    <div className="text-xs text-gray-400 mt-0.5">Physique - Réservé</div>
                                                </div>
                                                <div className="p-3 rounded-lg border border-blue-100 bg-blue-50 shadow-sm">
                                                    <div className="text-xs text-blue-600 mb-1 font-medium">Effectif</div>
                                                    <div className="text-2xl font-bold text-blue-700">{selected.effective_available}</div>
                                                    <div className="text-xs text-blue-400 mt-0.5">Avec provisoire</div>
                                                </div>
                                            </div>

                                            {/* Product info */}
                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Code produit</div>
                                                    <div className="font-semibold text-gray-900">{selected.product?.code}</div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Nom</div>
                                                    <div className="font-semibold text-gray-900">{selected.product?.name}</div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Dépôt</div>
                                                    <div className="font-semibold text-gray-900">{selected.branch_code}</div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">ID Stock</div>
                                                    <div className="font-semibold text-gray-900">#{selected.id}</div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Effective Breakdown Section ─────── */}
                                    <div ref={el => { sectionRefs.current['effective'] = el; }}>
                                        <SageCollapsible
                                            title="Décomposition du stock effectif"
                                            isOpen={openSections['effective']}
                                            onOpenChange={(open) => toggleSection('effective', open)}
                                        >
                                            {effectiveLoading ? (
                                                <div className="flex items-center justify-center py-8 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : effective ? (
                                                <div className="space-y-4">
                                                    {/* Visual bar */}
                                                    <div className="relative h-12 bg-gray-100 rounded-xl overflow-hidden flex">
                                                        {effective.confirmed > 0 && (
                                                            <div
                                                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                                                                style={{ width: `${Math.max((effective.confirmed / (effective.effective || 1)) * 100, 10)}%` }}
                                                            >
                                                                {effective.confirmed}
                                                            </div>
                                                        )}
                                                        {effective.provisional > 0 && (
                                                            <div
                                                                className="h-full bg-gradient-to-r from-amber-400 to-amber-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                                                                style={{ width: `${Math.max((effective.provisional / (effective.effective || 1)) * 100, 10)}%` }}
                                                            >
                                                                +{effective.provisional}
                                                            </div>
                                                        )}
                                                        {effective.reserved > 0 && (
                                                            <div
                                                                className="h-full bg-gradient-to-r from-red-400 to-red-500 flex items-center justify-center text-white text-xs font-bold transition-all duration-500"
                                                                style={{ width: `${Math.max((effective.reserved / (effective.effective || 1)) * 100, 10)}%` }}
                                                            >
                                                                −{effective.reserved}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Legend */}
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-100 bg-emerald-50">
                                                            <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                                                            <div>
                                                                <div className="text-xs text-gray-500">Confirmé</div>
                                                                <div className="text-lg font-bold text-emerald-700">{effective.confirmed}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-100 bg-amber-50">
                                                            <div className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                                                            <div>
                                                                <div className="text-xs text-gray-500">Provisoire</div>
                                                                <div className="text-lg font-bold text-amber-700">{effective.provisional}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-100 bg-red-50">
                                                            <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                                                            <div>
                                                                <div className="text-xs text-gray-500">Réservé</div>
                                                                <div className="text-lg font-bold text-red-600">{effective.reserved}</div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-100 bg-blue-50">
                                                            <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                                                            <div>
                                                                <div className="text-xs text-gray-500">Effectif</div>
                                                                <div className="text-lg font-bold text-blue-700">{effective.effective}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Formula */}
                                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 font-mono text-center">
                                                        <span className="text-emerald-600 font-bold">{effective.confirmed}</span>
                                                        <span className="mx-1">+</span>
                                                        <span className="text-amber-600 font-bold">{effective.provisional}</span>
                                                        <span className="mx-1">−</span>
                                                        <span className="text-red-600 font-bold">{effective.reserved}</span>
                                                        <span className="mx-1">=</span>
                                                        <span className="text-blue-700 font-bold text-base">{effective.effective}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-6 text-gray-400 text-sm">
                                                    Aucune donnée de stock effectif disponible.
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Movements Section ──────────────── */}
                                    <div ref={el => { sectionRefs.current['movements'] = el; }}>
                                        <SageCollapsible
                                            title="Historique des mouvements"
                                            isOpen={openSections['movements']}
                                            onOpenChange={(open) => toggleSection('movements', open)}
                                        >
                                            {/* Movement filters */}
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                <select
                                                    value={movementStatusFilter}
                                                    onChange={(e) => setMovementStatusFilter(e.target.value as MovementStatus | '')}
                                                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Tous les statuts</option>
                                                    <option value="CONFIRMED">Confirmé</option>
                                                    <option value="PROVISIONAL">Provisoire</option>
                                                    <option value="REVERSED">Inversé</option>
                                                </select>
                                                <select
                                                    value={movementTypeFilter}
                                                    onChange={(e) => setMovementTypeFilter(e.target.value as MovementType | '')}
                                                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">Tous les types</option>
                                                    <option value="purchase">Achat</option>
                                                    <option value="sale">Vente</option>
                                                    <option value="adjustment">Ajustement</option>
                                                    <option value="transfer_in">Transfert entrant</option>
                                                    <option value="transfer_out">Transfert sortant</option>
                                                    <option value="return">Retour</option>
                                                </select>
                                                <button
                                                    onClick={() => refetchMovements()}
                                                    className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white hover:bg-gray-50 flex items-center gap-1"
                                                >
                                                    <RefreshCw className="w-3 h-3" /> Actualiser
                                                </button>
                                            </div>

                                            {/* Movements list */}
                                            {movementsLoading ? (
                                                <div className="flex items-center justify-center py-8 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : movements.length > 0 ? (
                                                <div className="space-y-2">
                                                    {movements.map((m) => {
                                                        const TypeIcon = MOVEMENT_TYPE_ICONS[m.type] || ArrowLeftRight;
                                                        const statusColor = STATUS_COLORS[m.movement_status] || STATUS_COLORS.CONFIRMED;
                                                        const isIncoming = ['purchase', 'transfer_in', 'return'].includes(m.type);

                                                        return (
                                                            <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-white hover:shadow-sm transition-shadow">
                                                                {/* Icon */}
                                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isIncoming ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                                                    <TypeIcon className="w-4 h-4" />
                                                                </div>

                                                                {/* Info */}
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-medium text-gray-900">
                                                                            {MOVEMENT_TYPE_LABELS[m.type]}
                                                                        </span>
                                                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${statusColor.bg} ${statusColor.text}`}>
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${statusColor.dot}`} />
                                                                            {STATUS_LABELS[m.movement_status]}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                                                        {m.source_system && <span className="font-mono">{m.source_system}</span>}
                                                                        {m.external_reference && (
                                                                            <>
                                                                                <ChevronRight className="w-3 h-3" />
                                                                                <span className="font-mono">{m.external_reference}</span>
                                                                            </>
                                                                        )}
                                                                        {m.created_at && (
                                                                            <span className="ml-auto">{new Date(m.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                                        )}
                                                                    </div>
                                                                    {m.notes && (
                                                                        <div className="text-xs text-gray-400 mt-1 italic truncate">{m.notes}</div>
                                                                    )}
                                                                </div>

                                                                {/* Quantity */}
                                                                <div className={`text-right shrink-0 text-lg font-bold ${isIncoming ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                    {isIncoming ? '+' : ''}{parseFloat(m.quantity).toFixed(0)}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-gray-400">
                                                    <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
                                                    <p className="text-sm">Aucun mouvement trouvé</p>
                                                    <p className="text-xs mt-1">Les mouvements de stock apparaîtront ici</p>
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                </div>
                            </div>
                        ) : (
                            /* ── Empty state ──────────────────────────────── */
                            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-slate-50/50">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center mb-4 shadow-sm">
                                    <Box className="w-10 h-10 text-blue-400" />
                                </div>
                                <p className="text-base font-medium text-gray-500 mb-1">Gestion des Stocks</p>
                                <p className="text-sm text-gray-400 mb-4 max-w-xs text-center">
                                    Double-cliquez sur un produit dans la liste pour voir les détails de stock, l'historique des mouvements et le stock effectif.
                                </p>
                                <div className="flex flex-col gap-2 text-xs text-gray-400">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-emerald-100 flex items-center justify-center">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        </div>
                                        <span>Stock confirmé et disponibilité temps réel</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-amber-100 flex items-center justify-center">
                                            <ClipboardList className="w-3 h-3 text-amber-600" />
                                        </div>
                                        <span>Mouvements provisoires et réceptions locales</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded bg-blue-100 flex items-center justify-center">
                                            <Truck className="w-3 h-3 text-blue-600" />
                                        </div>
                                        <span>Réconciliation automatique avec X3</span>
                                    </div>
                                </div>
                            </div>
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
                                        onClick: handleRefreshAll,
                                    },
                                    {
                                        icon: Plus,
                                        label: 'Mouvement provisoire',
                                        variant: 'primary',
                                        onClick: () => {
                                            if (selected) {
                                                setProvisionalForm(prev => ({
                                                    ...prev,
                                                    product_id: selected.product_id,
                                                    branch_code: selected.branch_code,
                                                }));
                                            }
                                            setShowProvisionalModal(true);
                                        },
                                    },
                                ],
                            },
                            {
                                items: [
                                    {
                                        icon: ArrowLeftRight,
                                        label: 'Réconcilier X3',
                                        variant: 'default',
                                        onClick: () => setShowReconcileConfirm(true),
                                        disabled: !selected || reconciling,
                                    },
                                    {
                                        icon: Filter,
                                        label: filterLowStock ? 'Retirer filtre Stock bas' : 'Filtrer Stock bas',
                                        variant: 'default',
                                        onClick: () => { setFilterLowStock(!filterLowStock); setFilterOutOfStock(false); },
                                    },
                                    {
                                        icon: AlertTriangle,
                                        label: filterOutOfStock ? 'Retirer filtre Rupture' : 'Filtrer Rupture',
                                        variant: filterOutOfStock ? 'danger' : 'default',
                                        onClick: () => { setFilterOutOfStock(!filterOutOfStock); setFilterLowStock(false); },
                                    },
                                    {
                                        icon: BarChart3,
                                        label: 'Stock effectif',
                                        variant: 'default',
                                        onClick: () => {
                                            if (selected) {
                                                handleTabChange('effective');
                                            } else {
                                                toast('Sélectionnez un produit', { icon: 'ℹ️' });
                                            }
                                        },
                                        disabled: !selected,
                                    },
                                ],
                            },
                        ]}
                    />
                }
            />

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Provisional Movement Modal                                        */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {showProvisionalModal && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowProvisionalModal(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal header */}
                        <div className="flex items-center justify-between p-4 border-b border-gray-100">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <Plus className="w-4 h-4 text-blue-600" />
                                </div>
                                <h2 className="text-lg font-semibold text-gray-900">Nouveau mouvement provisoire</h2>
                            </div>
                            <button
                                onClick={() => setShowProvisionalModal(false)}
                                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-4 space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Dépôt *</label>
                                    <input
                                        type="text"
                                        value={provisionalForm.branch_code || ''}
                                        onChange={(e) => setProvisionalForm(prev => ({ ...prev, branch_code: e.target.value }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                                        placeholder="A0001"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">ID Produit *</label>
                                    <input
                                        type="number"
                                        value={provisionalForm.product_id || ''}
                                        onChange={(e) => setProvisionalForm(prev => ({ ...prev, product_id: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="123"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Quantité *</label>
                                    <input
                                        type="number"
                                        value={provisionalForm.quantity || ''}
                                        onChange={(e) => setProvisionalForm(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                        placeholder="10"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1 font-medium">Type *</label>
                                    <select
                                        value={provisionalForm.type || 'purchase'}
                                        onChange={(e) => setProvisionalForm(prev => ({ ...prev, type: e.target.value as any }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                                    >
                                        <option value="purchase">Achat</option>
                                        <option value="adjustment">Ajustement</option>
                                        <option value="transfer_in">Transfert entrant</option>
                                        <option value="transfer_out">Transfert sortant</option>
                                        <option value="return">Retour</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Référence externe</label>
                                <input
                                    type="text"
                                    value={provisionalForm.external_reference || ''}
                                    onChange={(e) => setProvisionalForm(prev => ({ ...prev, external_reference: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    placeholder="POS-REC-0001"
                                />
                            </div>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Notes</label>
                                <textarea
                                    value={provisionalForm.notes || ''}
                                    onChange={(e) => setProvisionalForm(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                    rows={3}
                                    placeholder="Réception locale, ajustement inventaire..."
                                />
                            </div>

                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                <strong>Note:</strong> Ce mouvement sera enregistré comme <strong>PROVISOIRE</strong> et ne modifiera pas le snapshot de stock actuel.
                                Il sera pris en compte dans le calcul du stock effectif.
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
                            <button
                                onClick={() => setShowProvisionalModal(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateProvisional}
                                disabled={creatingProvisional}
                                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {creatingProvisional && <Loader2 className="w-4 h-4 animate-spin" />}
                                Créer le mouvement
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════════ */}
            {/* Reconcile X3 Confirmation Dialog                                  */}
            {/* ═══════════════════════════════════════════════════════════════════ */}
            {showReconcileConfirm && selected && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => setShowReconcileConfirm(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header with icon */}
                        <div className="p-5 pb-3 flex flex-col items-center text-center">
                            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center mb-3 shadow-sm">
                                <ArrowLeftRight className="w-7 h-7 text-amber-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Réconciliation X3</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Confirmer la réconciliation depuis le système X3 pour ce produit ?
                            </p>
                        </div>

                        {/* Product details */}
                        <div className="mx-5 p-3 bg-slate-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold text-gray-900 truncate">{selected.product?.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{selected.product?.code}</div>
                                </div>
                                <div className="text-right shrink-0 ml-3">
                                    <div className="text-xs text-gray-500">Quantité</div>
                                    <div className="text-lg font-bold text-gray-900">{parseFloat(selected.quantity).toFixed(0)}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                                <span>Dépôt: <strong className="text-gray-700">{selected.branch_code}</strong></span>
                                <span>Effectif: <strong className="text-blue-600">{selected.effective_available}</strong></span>
                            </div>
                        </div>

                        {/* Warning */}
                        <div className="mx-5 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-700">
                                Cette action confirmera le mouvement et inversera tout mouvement provisoire antérieur pour ce produit.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 p-5 pt-4">
                            <button
                                onClick={() => setShowReconcileConfirm(false)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleReconcile}
                                disabled={reconciling}
                                className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 shadow-sm"
                            >
                                {reconciling && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirmer la réconciliation
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
