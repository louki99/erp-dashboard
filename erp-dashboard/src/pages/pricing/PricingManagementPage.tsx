import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ColDef, CellValueChangedEvent } from 'ag-grid-community';
import {
    Search,
    X,
    Plus,
    Edit2,
    Trash2,
    Copy,
    Upload,
    CheckCircle2,
    Layers,
    FileText,
    Settings,
    Eye,
    DollarSign,
    Save,
    RotateCcw,
    RefreshCw,
    Hash,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';

import {
    usePriceLists,
    usePriceListDetail,
    useCreatePriceList,
    useUpdatePriceList,
    useDeletePriceList,
    useCreateLine,
    useUpdateLine,
    useDuplicateLine,
    useImportCsv,
    useOverrides,
    useCreateOverride,
    useUpdateOverride,
    useDeleteOverride,
    useToggleOverride,
    usePreviewPrice,
    usePackagingPrices,
    useCreatePackagingPrice,
    useUpdatePackagingPrice,
    useDeletePackagingPrice,
    useClearLineDetails,
    useUpsertDetails,
} from '@/hooks/pricing/usePricing';

import type {
    PriceList,
    PriceListFilters,
    OverrideFilters,
    CreatePriceListRequest,
    CreateLineRequest,
    DuplicateLineRequest,
    ImportCsvParams,
    CreateOverrideRequest,
    PriceListLine,
    PriceOverride,
    PreviewPriceRequest,
    PreviewPriceResponse,
    PackagingPrice,
    CreatePackagingPriceRequest,
    LineDetail,
} from '@/types/pricing.types';

import {
    ModalCreatePL,
    ModalCreateLine,
    ModalDuplicateLine,
    ModalOverride,
    ModalImport,
    ModalDeleteConfirm,
    ModalPreview,
    ModalPackagingPrice,
} from './PricingModals';

// ─── Component ────────────────────────────────────────────────────────────────

export const PricingManagementPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('info');

    // Filters
    const [priceListFilters, setPriceListFilters] = useState<PriceListFilters>({
        page: 1,
        per_page: 20,
    });
    const [overrideFilters, setOverrideFilters] = useState<OverrideFilters>({
        page: 1,
        per_page: 20,
    });

    // Packaging filters (by price list)
    const [packagingFilters] = useState<{ price_list_id?: number; page?: number; per_page?: number }>({
        page: 1,
        per_page: 20,
    });

    // Search input for debouncing
    const [searchQuery, setSearchQuery] = useState('');

    // Open sections state
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        lines: true,
        overrides: true,
    });

    // ── Data Hooks ────────────────────────────────────────────────────────────
    const {
        data: priceListsData,
        loading: priceListsLoading,
        refetch: refetchPriceLists
    } = usePriceLists(priceListFilters);

    const {
        data: priceListDetailData,
        loading: detailLoading,
        refetch: refetchDetail
    } = usePriceListDetail(selectedPriceList?.id || null);

    // Use detailed data if available, otherwise fallback to list data
    const priceListDetail = priceListDetailData || selectedPriceList;
    const priceLists = priceListsData?.data || [];

    // Keep selectedDetailsLine in sync when detail data refreshes
    useEffect(() => {
        if (!priceListDetailData) {
            // Detail was cleared (e.g. switching price list) — clear line too
            setSelectedDetailsLine(null);
            setEditedDetails(new Map());
            return;
        }
        if (selectedDetailsLine) {
            // Find the same line in the fresh data and update
            const fresh = priceListDetailData.lines?.find(
                (l: PriceListLine) => l.id === selectedDetailsLine.id
            );
            if (fresh) {
                setSelectedDetailsLine(fresh);
            } else {
                // Line no longer exists in the new data (different price list)
                setSelectedDetailsLine(null);
                setEditedDetails(new Map());
            }
        }
    // Only trigger when the detail data object reference changes (refetch / new PL)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceListDetailData]);

    // Overrides Hook
    const {
        data: overridesData,
        loading: overridesLoading,
        refetch: refetchOverrides
    } = useOverrides(overrideFilters);
    const overrides = overridesData?.data || [];

    // Packaging prices hook (filtered by selected price list)
    const {
        data: packagingData,
        loading: packagingLoading,
        refetch: refetchPackaging,
    } = usePackagingPrices({
        ...packagingFilters,
        price_list_id: selectedPriceList?.id || undefined,
    });
    const packagingPrices = packagingData?.data || [];

    // Mutations
    // Mutations
    const { execute: createPriceList, loading: createPLLoading } = useCreatePriceList();
    const { updatePriceList, loading: updatePLLoading } = useUpdatePriceList();
    const { execute: deletePriceList, loading: deletePLLoading } = useDeletePriceList();

    const { createLine, loading: createLineLoading } = useCreateLine();
    const { updateLine, loading: updateLineLoading } = useUpdateLine();
    const { duplicateLine, loading: dupLoading } = useDuplicateLine();
    const { importCsv, loading: importLoading } = useImportCsv();

    const { execute: createOverride, loading: createOvLoading } = useCreateOverride();
    const { updateOverride, loading: updateOvLoading } = useUpdateOverride();
    const { execute: deleteOverride } = useDeleteOverride();
    const { execute: toggleOverride } = useToggleOverride();

    // Preview price
    const { execute: previewPrice, loading: previewLoading } = usePreviewPrice();

    // Packaging prices mutations
    const { execute: createPackagingPrice, loading: createPkgLoading } = useCreatePackagingPrice();
    const { updatePackagingPrice, loading: updatePkgLoading } = useUpdatePackagingPrice();
    const { execute: deletePackagingPrice } = useDeletePackagingPrice();

    // Clear line details
    const { clearLineDetails } = useClearLineDetails();

    // Upsert details
    const { upsertDetails, loading: upsertLoading } = useUpsertDetails();

    // Editable details state
    const [editedDetails, setEditedDetails] = useState<Map<number, LineDetail>>(new Map());
    // no ref needed — we reset the grid by clearing selectedDetailsLine

    // ── Columns ───────────────────────────────────────────────────────────────
    // Moved below handlers to access them

    // ── Handlers ──────────────────────────────────────────────────────────────

    // --- Price Lists ---
    const [isCreatePLOpen, setCreatePLOpen] = useState(false);
    const [editPL, setEditPL] = useState<PriceList | null>(null);
    const [plForm, setPlForm] = useState<Partial<CreatePriceListRequest>>({});

    const handleCreatePL = () => {
        setEditPL(null);
        setPlForm({ active: true, rank: 10 } as any);
        setCreatePLOpen(true);
    };

    const handleEditPL = (pl: PriceList) => {
        setEditPL(pl);
        setPlForm({ code: pl.code, name: pl.name, rank: pl.rank });
        setCreatePLOpen(true);
    };

    const handleSubmitPL = async () => {
        try {
            if (editPL) {
                await updatePriceList({ id: editPL.id, data: plForm });
                toast.success('Tarif mis à jour');
            } else {
                await createPriceList(plForm as any);
                toast.success('Tarif créé');
            }
            setCreatePLOpen(false);
            refetchPriceLists();
            if (editPL && selectedPriceList?.id === editPL.id) {
                refetchDetail();
            }
        } catch (e) {
            toast.error('Erreur lors de l\'enregistrement');
        }
    };

    const [isDeletePLOpen, setDeletePLOpen] = useState(false);
    const handleDeletePLRequest = () => {
        if (!selectedPriceList) return;
        setDeletePLOpen(true);
    };

    const handleConfirmDeletePL = async () => {
        if (!selectedPriceList) return;
        try {
            await deletePriceList(selectedPriceList.id);
            toast.success('Tarif supprimé');
            setDeletePLOpen(false);
            setSelectedPriceList(null);
            setShowDetailPanel(false);
            refetchPriceLists();
        } catch (e) {
            toast.error('Erreur suppression');
        }
    };

    // --- Lines ---
    const [isLineModalOpen, setLineModalOpen] = useState(false);
    const [editLine, setEditLine] = useState<PriceListLine | null>(null);
    const [lineForm, setLineForm] = useState<Partial<CreateLineRequest>>({});
    const [selectedDetailsLine, setSelectedDetailsLine] = useState<PriceListLine | null>(null);

    const handleCreateLine = () => {
        setEditLine(null);
        // Default dates: next month start/end
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().split('T')[0];
        const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().split('T')[0];
        setLineForm({ start_date: start, end_date: end, closed: false });
        setLineModalOpen(true);
    };

    const handleEditLine = (line: PriceListLine) => {
        setEditLine(line);
        setLineForm({
            name: line.name,
            start_date: line.start_date,
            end_date: line.end_date,
            closed: line.closed
        });
        setLineModalOpen(true);
    };

    const handleViewLineDetails = (line: PriceListLine) => {
        setSelectedDetailsLine(line);
        setEditedDetails(new Map());
    };

    const handleDetailCellChange = useCallback((event: CellValueChangedEvent) => {
        const data = event.data as LineDetail;
        setEditedDetails(prev => {
            const next = new Map(prev);
            next.set(data.id, { ...data });
            return next;
        });
    }, []);

    const handleSaveDetails = async () => {
        if (!selectedPriceList || !selectedDetailsLine || editedDetails.size === 0) return;
        const allDetails = (selectedDetailsLine.details ?? []).map(d => {
            const edited = editedDetails.get(d.id);
            const src = edited ?? d;
            return {
                product_id: src.product_id,
                sales_price: src.sales_price,
                return_price: src.return_price,
                min_sales_price: src.min_sales_price,
                max_sales_price: src.max_sales_price,
                discount_amount: src.discount_amount,
                discount_rate: src.discount_rate,
            };
        });
        try {
            await upsertDetails({
                priceListId: selectedPriceList.id,
                lineId: selectedDetailsLine.line_number,
                data: { action: 'upsert_details', details: allDetails } as any,
            });
            toast.success(`${editedDetails.size} prix mis à jour`);
            setEditedDetails(new Map());
            refetchDetail();
        } catch {
            toast.error('Erreur lors de la sauvegarde');
        }
    };

    const handleResetDetails = () => {
        setEditedDetails(new Map());
        // Re-set the line to force AG Grid to re-render with original data
        if (selectedDetailsLine) {
            setSelectedDetailsLine({ ...selectedDetailsLine });
        }
    };

    const handleSubmitLine = async () => {
        if (!selectedPriceList) return;
        try {
            if (editLine) {
                await updateLine({
                    priceListId: selectedPriceList.id,
                    lineId: editLine.line_number, // API uses line_number as ID often, or internal ID. Providing line_number based on context
                    data: lineForm
                });
                toast.success('Ligne mise à jour');
            } else {
                await createLine({
                    priceListId: selectedPriceList.id,
                    data: { ...lineForm, name: lineForm.name || 'Nouvelle version', start_date: lineForm.start_date!, end_date: lineForm.end_date! }
                });
                toast.success('Ligne créée');
            }
            setLineModalOpen(false);
            refetchDetail();
        } catch (e) {
            toast.error('Erreur enregistrement ligne');
        }
    };

    // --- Duplicate Line ---
    const [isDuplicateOpen, setDuplicateOpen] = useState(false);
    const [dupForm, setDupForm] = useState<Partial<DuplicateLineRequest>>({});

    const handleDuplicateLine = (sourceLine: PriceListLine) => {
        setDupForm({
            source_line_number: sourceLine.line_number,
            new_line_number: (priceListDetail?.lines?.length || 0) + 1,
            new_name: `Copie de ${sourceLine.name}`,
            new_start_date: sourceLine.end_date, // Suggest starting after
        });
        setDuplicateOpen(true);
    };

    const handleSubmitDuplicate = async () => {
        if (!selectedPriceList) return;
        try {
            await duplicateLine({
                priceListId: selectedPriceList.id,
                data: dupForm as DuplicateLineRequest
            });
            toast.success('Ligne dupliquée');
            setDuplicateOpen(false);
            refetchDetail();
        } catch (e) {
            toast.error('Erreur duplication');
        }
    };

    const handleClearLineDetailsClick = async (line: PriceListLine) => {
        if (!selectedPriceList) return;
        if (!confirm('Vider tous les détails de prix pour cette ligne ?')) return;
        try {
            await clearLineDetails({ priceListId: selectedPriceList.id, lineId: line.line_number });
            toast.success('Détails de ligne effacés');
            refetchDetail();
        } catch (e) {
            toast.error('Erreur lors de la suppression des détails');
        }
    };

    // --- Import CSV ---
    const [isImportOpen, setImportOpen] = useState(false);
    const [importTargetLine, setImportTargetLine] = useState<number | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importParams, setImportParams] = useState<ImportCsvParams>({
        file: null as any,
        mode: 'merge',
        has_header: true,
        product_identifier: 'code'
    });

    const handleImportCsv = (line: PriceListLine) => {
        setImportTargetLine(line.line_number);
        setImportParams({ mode: 'merge', has_header: true, product_identifier: 'code', file: null as any });
        setImportFile(null);
        setImportOpen(true);
    };

    const handleSubmitImport = async () => {
        if (!selectedPriceList || !importTargetLine || !importFile) return;
        try {
            await importCsv({
                priceListId: selectedPriceList.id,
                lineId: importTargetLine,
                params: { ...importParams, file: importFile }
            });
            toast.success('Import réussi');
            setImportOpen(false);
            refetchDetail();
        } catch (e) {
            toast.error('Erreur import');
        }
    };

    // --- Overrides ---
    const [isOverrideOpen, setOverrideOpen] = useState(false);
    const [editOverride, setEditOverride] = useState<PriceOverride | null>(null);
    const [overrideForm, setOverrideForm] = useState<Partial<CreateOverrideRequest>>({});

    // Preview price modal state
    const [isPreviewOpen, setPreviewOpen] = useState(false);
    const [previewForm, setPreviewForm] = useState<Partial<PreviewPriceRequest>>({});
    const [previewData, setPreviewData] = useState<PreviewPriceResponse | null>(null);

    // Packaging price modal state
    const [isPackagingOpen, setPackagingOpen] = useState(false);
    const [editPackaging, setEditPackaging] = useState<PackagingPrice | null>(null);
    const [packagingForm, setPackagingForm] = useState<Partial<CreatePackagingPriceRequest>>({});

    const handleCreateOverride = () => {
        setEditOverride(null);
        setOverrideForm({
            active: true,
            priority: 0,
            price_list_id: selectedPriceList?.id
        });
        setOverrideOpen(true);
    };

    const handleEditOverride = (ov: PriceOverride) => {
        setEditOverride(ov);
        setOverrideForm({
            partner_id: ov.partner_id,
            product_id: ov.product_id,
            fixed_price: ov.fixed_price || undefined,
            discount_rate: ov.discount_rate || undefined,
            discount_amount: ov.discount_amount || undefined,
            valid_from: ov.valid_from || undefined,
            valid_to: ov.valid_to || undefined,
            priority: ov.priority,
            active: ov.active
        });
        setOverrideOpen(true);
    };

    const handleDeleteOverride = async (id: number) => {
        if (!confirm('Supprimer cette dérogation ?')) return;
        try {
            await deleteOverride(id);
            toast.success('Dérogation supprimée');
            refetchOverrides();
        } catch (e) {
            toast.error('Erreur suppression');
        }
    };

    const handleToggleOverride = async (id: number) => {
        try {
            await toggleOverride(id);
            toast.success('Statut de la dérogation mis à jour');
            refetchOverrides();
        } catch (e) {
            toast.error('Erreur lors du changement de statut');
        }
    };

    const handleSubmitOverride = async () => {
        try {
            if (editOverride) {
                await updateOverride({ id: editOverride.id, data: overrideForm });
                toast.success('Dérogation mise à jour');
            } else {
                await createOverride(overrideForm as any);
                toast.success('Dérogation créée');
            }
            setOverrideOpen(false);
            refetchOverrides();
        } catch (e) {
            toast.error('Erreur enregistrement dérogation');
        }
    };

    const handleOpenPreview = () => {
        setPreviewData(null);
        setPreviewForm({
            partner_id: undefined,
            product_id: undefined,
        });
        setPreviewOpen(true);
    };

    const handleSubmitPreview = async () => {
        if (!previewForm.partner_id || !previewForm.product_id) {
            toast.error('Veuillez renseigner partenaire et produit');
            return;
        }
        try {
            const result: any = await previewPrice(previewForm as any);
            setPreviewData(result.data);
        } catch (e) {
            toast.error('Erreur lors du calcul du prix');
        }
    };

    // ── Search & Select Handlers ──────────────────────────────────────────────

    const handleSearch = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => {
            setPriceListFilters(prev => ({ ...prev, search: value, page: 1 }));
        }, 500);
    };

    const handleSelectPriceList = (row: PriceList) => {
        // Show loading cursor while detail panel loads
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);

        setSelectedPriceList(row);
        setShowDetailPanel(true);
        setActiveTab('info');
        // Clear stale state from previous selection
        setSelectedDetailsLine(null);
        setEditedDetails(new Map());
        setOverrideFilters(prev => ({ ...prev, price_list_id: row.id, page: 1 }));

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    };

    const toggleSection = (section: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [section]: isOpen }));
    };

    // ── Columns Re-definition ─────────────────────────────────────────────────

    // 1. Price Lists
    const priceListColumns = useMemo<ColDef[]>(() => [
        { field: 'code', headerName: 'Code', width: 100, cellStyle: { fontWeight: '600' } as any },
        { field: 'name', headerName: 'Nom', flex: 1, minWidth: 150 },
        { field: 'rank', headerName: 'Rang', width: 80, cellStyle: { textAlign: 'center' } as any },
        { field: 'lines_count', headerName: 'Ligne(s)', width: 90, valueFormatter: (p: any) => p.value || '0', cellStyle: { textAlign: 'center', color: '#6b7280' } as any },
    ], []);

    // 2. Lines
    const linesColumns = useMemo<ColDef[]>(() => [
        { field: 'line_number', headerName: 'N°', width: 70, cellStyle: { textAlign: 'center', color: '#6b7280' } as any },
        { field: 'name', headerName: 'Version / Nom', flex: 1, minWidth: 150, cellStyle: { fontWeight: '500' } as any },
        { field: 'start_date', headerName: 'Début', width: 110, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '-' },
        { field: 'end_date', headerName: 'Fin', width: 110, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '-' },
        {
            field: 'closed', headerName: 'Statut', width: 100, cellRenderer: (p: any) => (
                <div className={`flex items-center gap-1.5 ${p.value ? 'text-gray-500' : 'text-emerald-600'}`}>
                    {p.value ? <><X className="w-3.5 h-3.5" /> Fermé</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Actif</>}
                </div>
            )
        },
        {
            headerName: '', width: 150, cellRenderer: (params: any) => (
                <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEditLine(params.data)} className="p-1 hover:bg-gray-100 rounded text-blue-600" title="Éditer">
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDuplicateLine(params.data)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Dupliquer">
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleImportCsv(params.data)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Import CSV">
                        <Upload className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleViewLineDetails(params.data)} className="p-1 hover:bg-gray-100 rounded text-gray-500" title="Voir détails">
                        <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleClearLineDetailsClick(params.data)} className="p-1 hover:bg-gray-100 rounded text-red-500" title="Vider les détails">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            ), sortable: false, filter: false
        }
    ], [selectedPriceList]); // Re-create if selected list changes (though handlers don't depend on it directly via closure, safer)

    // 3. Line Details (editable)
    const detailsColumns = useMemo<ColDef[]>(() => {
        const numCol = (field: string, headerName: string, color?: string): ColDef => ({
            field,
            headerName,
            width: 110,
            editable: true,
            type: 'numericColumn',
            valueParser: (p: any) => {
                const n = parseFloat(p.newValue);
                return Number.isNaN(n) ? p.oldValue : n;
            },
            valueFormatter: (p: any) => p.value != null ? Number(p.value).toFixed(2) : '0.00',
            cellStyle: () => ({ textAlign: 'right', ...(color ? { color } : {}) }) as any,
        });

        return [
            {
                field: 'product_id',
                headerName: 'Produit',
                width: 130,
                pinned: 'left',
                cellRenderer: (p: any) => (
                    <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800">{p.data?.product?.name || p.value}</span>
                    </div>
                ),
            },
            numCol('sales_price', 'Prix vente', '#059669'),
            numCol('return_price', 'Prix retour'),
            numCol('min_sales_price', 'Min'),
            numCol('max_sales_price', 'Max'),
            numCol('discount_rate', 'Remise %', '#d97706'),
            numCol('discount_amount', 'Remise €', '#d97706'),
        ];
    }, []);

    // 4. Overrides
    const overridesColumns = useMemo<ColDef[]>(() => [
        {
            field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 150, cellRenderer: (p: any) => (
                <div><div className="font-medium text-gray-900">{p.data?.partner?.name || '-'}</div><div className="text-xs text-gray-500">{p.data?.partner?.code}</div></div>
            )
        },
        {
            field: 'product.name', headerName: 'Produit', flex: 1, minWidth: 150, cellRenderer: (p: any) => (
                <div><div className="font-medium text-gray-900">{p.data?.product?.name || '-'}</div><div className="text-xs text-gray-500">{p.data?.product?.code}</div></div>
            )
        },
        { field: 'fixed_price', headerName: 'Prix Fixe', width: 100, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value).toFixed(2)} €` : '-', cellStyle: { textAlign: 'right', fontWeight: '600' } as any },
        { field: 'discount_rate', headerName: 'Remise', width: 90, valueFormatter: (p: any) => p.value ? `${parseFloat(p.value).toFixed(2)} %` : '-', cellStyle: { textAlign: 'right', color: '#d97706' } as any },
        {
            field: 'active',
            headerName: 'Actif',
            width: 80,
            cellRenderer: (p: any) => (
                <button
                    type="button"
                    onClick={() => handleToggleOverride(p.data.id)}
                    className={`flex justify-center items-center w-full ${p.value ? 'text-emerald-600' : 'text-gray-400 hover:text-emerald-600'}`}
                    title={p.value ? 'Désactiver la dérogation' : 'Activer la dérogation'}
                >
                    <CheckCircle2 className={`w-4 h-4 ${!p.value && 'opacity-30'}`} />
                </button>
            )
        },
        {
            headerName: '', width: 80, cellRenderer: (params: any) => (
                <div className="flex items-center justify-end gap-1">
                    <button onClick={() => handleEditOverride(params.data)} className="p-1 hover:bg-gray-100 rounded text-blue-600"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteOverride(params.data.id)} className="p-1 hover:bg-gray-100 rounded text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
            ), sortable: false, filter: false
        }
    ], []);

    // ── Action Panel ──────────────────────────────────────────────────────────

    // Define items properly for ActionPanel
    // We need to map our custom structure to what ActionPanel expects for groups
    const actionItems: ActionItemProps[] = [
        {
            label: 'Actualiser',
            icon: RefreshCw,
            onClick: () => {
                refetchPriceLists();
                if (selectedPriceList) {
                    refetchDetail();
                    refetchOverrides();
                }
            },
            variant: 'default'
        },
        {
            label: 'Nouvelle Liste',
            icon: Plus,
            onClick: handleCreatePL,
            variant: 'primary',
        },
    ];

    if (selectedPriceList) {
        actionItems.push({
            label: 'Nouvelle Ligne',
            icon: Layers,
            onClick: handleCreateLine,
            variant: 'default'
        });
        actionItems.push({
            label: 'Nouvelle Dérogation',
            icon: Settings,
            onClick: handleCreateOverride,
            variant: 'default'
        });
        actionItems.push({
            label: 'Modifier Liste',
            icon: Edit2,
            onClick: () => handleEditPL(selectedPriceList),
            variant: 'default'
        });
        actionItems.push({
            label: 'Supprimer',
            icon: Trash2,
            onClick: handleDeletePLRequest,
            variant: 'danger',
        });
    }

    const actionGroups = [
        { items: actionItems }
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    const tabs: TabItem[] = [
        { id: 'info', label: 'Informations', icon: FileText },
        { id: 'lines', label: 'Versions (Lignes)', icon: Layers },
        { id: 'overrides', label: 'Dérogations', icon: Settings },
        { id: 'packaging', label: 'Conditionnements', icon: DollarSign },
    ];

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* Header */}
                        <div className="px-3 pt-3 pb-2.5 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-sm font-bold text-gray-900 tracking-tight">Listes de Prix</h1>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 text-blue-600">
                                    {priceLists.length}
                                </span>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearch('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200"
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                <DataGrid
                                    rowData={priceLists}
                                    columnDefs={priceListColumns}
                                    loading={priceListsLoading}
                                    rowSelection="single"
                                    onRowDoubleClicked={handleSelectPriceList}
                                />
                            </div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {showDetailPanel && priceListDetail ? (
                            <div className="flex-1 flex flex-col bg-slate-50 min-w-0 overflow-hidden">
                                {/* Detail Header */}
                                <div className="bg-white px-5 py-3.5 border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                {priceListDetail.code?.slice(0, 2) || 'PL'}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">{priceListDetail.name}</h1>
                                                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-blue-50 text-blue-600 rounded-md border border-blue-100">
                                                        {priceListDetail.code}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                                                    <span className="flex items-center gap-1">
                                                        Rang <strong className="text-gray-600">{priceListDetail.rank}</strong>
                                                    </span>
                                                    <span>·</span>
                                                    <span>{priceListDetail.lines_count || 0} ligne(s)</span>
                                                    <span>·</span>
                                                    <span>{priceListDetail.created_at ? new Date(priceListDetail.created_at).toLocaleDateString() : '-'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { refetchDetail(); toast.success('Actualisé'); }}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                title="Actualiser"
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleEditPL(priceListDetail)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Modifier">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setShowDetailPanel(false)}
                                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="bg-white border-b border-gray-200">
                                    <SageTabs
                                        tabs={tabs}
                                        activeTabId={activeTab}
                                        onTabChange={setActiveTab}
                                    />
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {activeTab === 'info' && (
                                        <SageCollapsible
                                            title="Informations Générales"
                                            isOpen={openSections.info}
                                            onOpenChange={(open) => toggleSection('info', open)}
                                        >
                                            <div className="space-y-4">
                                                {/* KPI cards */}
                                                <div className="grid grid-cols-4 gap-3">
                                                    {[
                                                        { label: 'Code', value: priceListDetail.code, color: 'blue' },
                                                        { label: 'Rang', value: priceListDetail.rank, color: 'purple' },
                                                        { label: 'Lignes', value: priceListDetail.lines_count || 0, color: 'emerald' },
                                                        { label: 'Produits', value: (priceListDetail.lines ?? []).reduce((a: number, l: PriceListLine) => a + (l.details?.length ?? 0), 0), color: 'amber' },
                                                    ].map((kpi) => (
                                                        <div key={kpi.label} className={`bg-${kpi.color}-50 rounded-lg p-3 border border-${kpi.color}-100`}>
                                                            <div className="text-[11px] uppercase font-medium text-gray-500 mb-1">{kpi.label}</div>
                                                            <div className={`text-xl font-bold text-${kpi.color}-700`}>{kpi.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Detail fields */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Nom complet</label>
                                                            <div className="text-sm font-semibold text-gray-900">{priceListDetail.name}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Code</label>
                                                            <div className="text-sm font-mono font-semibold text-gray-900">{priceListDetail.code}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Date de création</label>
                                                            <div className="text-sm text-gray-700">{priceListDetail.created_at ? new Date(priceListDetail.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Dernière modification</label>
                                                            <div className="text-sm text-gray-700">{priceListDetail.updated_at ? new Date(priceListDetail.updated_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    )}

                                    {activeTab === 'lines' && (
                                        <div className="space-y-3">
                                            {/* Lines header */}
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                                    <Layers className="w-4 h-4 text-gray-500" />
                                                    Versions / Lignes de prix
                                                    <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                                                        {priceListDetail.lines?.length ?? 0}
                                                    </span>
                                                </h3>
                                                <button onClick={handleCreateLine} className="text-xs flex items-center gap-1.5 text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-colors">
                                                    <Plus className="w-3 h-3" /> Nouvelle Ligne
                                                </button>
                                            </div>

                                            {/* Lines grid */}
                                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-[220px]">
                                                <DataGrid
                                                    rowData={priceListDetail.lines || []}
                                                    columnDefs={linesColumns}
                                                    loading={detailLoading}
                                                    rowSelection="single"
                                                    onRowClicked={(e: any) => handleViewLineDetails(e.data)}
                                                />
                                            </div>

                                            {!priceListDetail.lines?.length && !detailLoading && (
                                                <div className="text-center text-xs text-gray-400 py-2">
                                                    Aucune ligne configurée pour cette liste de prix.
                                                </div>
                                            )}

                                            {/* ── Line Details (AG Grid, editable) ───── */}
                                            {selectedDetailsLine && (
                                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                    {/* Details toolbar */}
                                                    <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-gray-200">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${selectedDetailsLine.closed ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                L{selectedDetailsLine.line_number}
                                                            </div>
                                                            <div>
                                                                <div className="text-sm font-semibold text-gray-900">
                                                                    {selectedDetailsLine.name}
                                                                </div>
                                                                <div className="text-[11px] text-gray-400 flex items-center gap-2">
                                                                    <span>{(selectedDetailsLine.details ?? []).length} produit(s)</span>
                                                                    <span>·</span>
                                                                    <span className={selectedDetailsLine.closed ? 'text-red-500' : 'text-emerald-500'}>
                                                                        {selectedDetailsLine.closed ? 'Fermée' : 'Ouverte'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            {editedDetails.size > 0 && (
                                                                <>
                                                                    <span className="text-[11px] text-amber-600 font-medium mr-1">
                                                                        {editedDetails.size} modifié(s)
                                                                    </span>
                                                                    <button
                                                                        onClick={handleResetDetails}
                                                                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                                                        title="Annuler les modifications"
                                                                    >
                                                                        <RotateCcw className="w-3 h-3" /> Annuler
                                                                    </button>
                                                                    <button
                                                                        onClick={handleSaveDetails}
                                                                        disabled={upsertLoading}
                                                                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md shadow-sm transition-colors"
                                                                    >
                                                                        <Save className="w-3 h-3" /> Sauvegarder
                                                                    </button>
                                                                </>
                                                            )}
                                                            <button
                                                                onClick={() => handleImportCsv(selectedDetailsLine)}
                                                                className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                                                                title="Import CSV"
                                                            >
                                                                <Upload className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleClearLineDetailsClick(selectedDetailsLine)}
                                                                className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                                                title="Vider les détails"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedDetailsLine(null)}
                                                                className="p-1 rounded hover:bg-gray-100 text-gray-400 ml-1"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Editable AG Grid */}
                                                    <div className="h-[350px]">
                                                        <DataGrid
                                                            rowData={selectedDetailsLine.details ?? []}
                                                            columnDefs={detailsColumns}
                                                            loading={false}
                                                            onCellValueChanged={handleDetailCellChange}
                                                        />
                                                    </div>

                                                    {!(selectedDetailsLine.details ?? []).length && (
                                                        <div className="py-4 text-center text-xs text-gray-400 border-t border-gray-100">
                                                            Aucun détail de prix. Importez un CSV ou ajoutez des produits.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {!selectedDetailsLine && (priceListDetail.lines?.length ?? 0) > 0 && (
                                                <div className="flex items-center justify-center py-4 text-xs text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                                                    <Eye className="w-4 h-4 mr-1.5 opacity-40" />
                                                    Cliquez sur une ligne ci-dessus pour afficher et modifier ses détails de prix
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'overrides' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                                    <Settings className="w-4 h-4 text-gray-500" />
                                                    Dérogations Partenaires
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <button onClick={handleOpenPreview} className="text-xs flex items-center gap-1 text-gray-600 hover:text-gray-800 bg-gray-50 px-2 py-1 rounded-md">
                                                        <Eye className="w-3 h-3" /> Prévisualiser un prix
                                                    </button>
                                                    <button onClick={handleCreateOverride} className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md">
                                                        <Plus className="w-3 h-3" /> Nouvelle Dérogation
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-[400px]">
                                                <DataGrid
                                                    rowData={overrides}
                                                    columnDefs={overridesColumns}
                                                    loading={overridesLoading}
                                                />
                                            </div>
                                            {!overrides.length && !overridesLoading && (
                                                <div className="text-center text-xs text-gray-400 py-2">
                                                    Aucune dérogation trouvée.
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'packaging' && (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                                    <DollarSign className="w-4 h-4 text-gray-500" />
                                                    Prix de conditionnement
                                                </h3>
                                                <button
                                                    onClick={() => {
                                                        setEditPackaging(null);
                                                        setPackagingForm({
                                                            line_detail_id: undefined,
                                                            packaging_id: undefined,
                                                            sales_price: undefined,
                                                            return_price: undefined,
                                                        });
                                                        setPackagingOpen(true);
                                                    }}
                                                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-md"
                                                >
                                                    <Plus className="w-3 h-3" /> Nouveau prix
                                                </button>
                                            </div>

                                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                                                {packagingLoading ? (
                                                    <div className="py-6 text-center text-xs text-gray-500">
                                                        Chargement des prix de conditionnement...
                                                    </div>
                                                ) : packagingPrices.length === 0 ? (
                                                    <div className="py-6 text-center text-xs text-gray-400">
                                                        Aucun prix de conditionnement pour cette liste de prix.
                                                    </div>
                                                ) : (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-xs">
                                                            <thead className="bg-gray-50">
                                                                <tr className="text-gray-500 border-b border-gray-200">
                                                                    <th className="text-left py-2 px-2 font-medium">ID détail</th>
                                                                    <th className="text-left py-2 px-2 font-medium">Conditionnement</th>
                                                                    <th className="text-right py-2 px-2 font-medium">Prix vente</th>
                                                                    <th className="text-right py-2 px-2 font-medium">Prix retour</th>
                                                                    <th className="text-right py-2 px-2 font-medium">Qté</th>
                                                                    <th className="text-right py-2 px-2 font-medium">Actions</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {packagingPrices.map((p) => (
                                                                    <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                                        <td className="py-2 px-2 text-gray-600 font-mono">#{p.line_detail_id}</td>
                                                                        <td className="py-2 px-2">
                                                                            <div className="text-gray-900 text-xs font-medium">
                                                                                {p.packaging?.name || `#${p.packaging_id}`}
                                                                            </div>
                                                                            {p.packaging?.code && (
                                                                                <div className="text-[11px] text-gray-400 font-mono">
                                                                                    {p.packaging.code}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right text-emerald-700 font-semibold">
                                                                            {p.sales_price.toFixed(2)}
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right text-gray-600">
                                                                            {p.return_price.toFixed(2)}
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right text-gray-500">
                                                                            {p.packaging?.quantity ?? '-'}
                                                                        </td>
                                                                        <td className="py-2 px-2 text-right">
                                                                            <div className="flex items-center justify-end gap-1">
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setEditPackaging(p);
                                                                                        setPackagingForm({
                                                                                            line_detail_id: p.line_detail_id,
                                                                                            packaging_id: p.packaging_id,
                                                                                            sales_price: p.sales_price,
                                                                                            return_price: p.return_price,
                                                                                        });
                                                                                        setPackagingOpen(true);
                                                                                    }}
                                                                                    className="p-1 hover:bg-gray-100 rounded text-blue-600"
                                                                                    title="Modifier"
                                                                                >
                                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                                <button
                                                                                    onClick={async () => {
                                                                                        if (!confirm('Supprimer ce prix de conditionnement ?')) return;
                                                                                        try {
                                                                                            await deletePackagingPrice(p.id);
                                                                                            toast.success('Prix de conditionnement supprimé');
                                                                                            refetchPackaging();
                                                                                        } catch (e) {
                                                                                            toast.error('Erreur suppression prix conditionnement');
                                                                                        }
                                                                                    }}
                                                                                    className="p-1 hover:bg-gray-100 rounded text-red-600"
                                                                                    title="Supprimer"
                                                                                >
                                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 text-gray-400">
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
                                    <DollarSign className="w-10 h-10 text-gray-200" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700">Aucune liste sélectionnée</h3>
                                <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
                                    Double-cliquez sur une liste de prix à gauche pour afficher et gérer ses versions, tarifs et dérogations.
                                </p>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        groups={actionGroups}
                    />
                }
            />

            {/* Modals */}
            {isCreatePLOpen && (
                <ModalCreatePL
                    editingPL={editPL}
                    plForm={plForm}
                    setPlForm={setPlForm}
                    onClose={() => setCreatePLOpen(false)}
                    onSubmit={handleSubmitPL}
                    loading={createPLLoading || updatePLLoading}
                />
            )}

            {isDeletePLOpen && selectedPriceList && (
                <ModalDeleteConfirm
                    selected={selectedPriceList}
                    onClose={() => setDeletePLOpen(false)}
                    onConfirm={handleConfirmDeletePL}
                    loading={deletePLLoading}
                />
            )}

            {isLineModalOpen && (
                <ModalCreateLine
                    lineForm={lineForm}
                    setLineForm={setLineForm}
                    onClose={() => setLineModalOpen(false)}
                    onSubmit={handleSubmitLine}
                    loading={createLineLoading || updateLineLoading}
                />
            )}

            {isDuplicateOpen && (
                <ModalDuplicateLine
                    dupForm={dupForm}
                    setDupForm={setDupForm}
                    onClose={() => setDuplicateOpen(false)}
                    onSubmit={handleSubmitDuplicate}
                    loading={dupLoading}
                />
            )}

            {isImportOpen && (
                <ModalImport
                    importFile={importFile}
                    setImportFile={setImportFile}
                    importParams={importParams}
                    setImportParams={setImportParams}
                    onClose={() => setImportOpen(false)}
                    onSubmit={handleSubmitImport}
                    loading={importLoading}
                />
            )}

            {isOverrideOpen && (
                <ModalOverride
                    editingOverride={editOverride}
                    form={overrideForm}
                    setForm={setOverrideForm}
                    onClose={() => setOverrideOpen(false)}
                    onSubmit={handleSubmitOverride}
                    loading={createOvLoading || updateOvLoading}
                />
            )}

            {isPreviewOpen && (
                <ModalPreview
                    form={previewForm}
                    setForm={setPreviewForm}
                    onClose={() => setPreviewOpen(false)}
                    onSubmit={handleSubmitPreview}
                    loading={previewLoading}
                    previewData={previewData}
                />
            )}

            {isPackagingOpen && (
                <ModalPackagingPrice
                    editingPackaging={editPackaging}
                    form={packagingForm}
                    setForm={setPackagingForm}
                    onClose={() => setPackagingOpen(false)}
                    onSubmit={async () => {
                        try {
                            if (editPackaging) {
                                await updatePackagingPrice({
                                    id: editPackaging.id,
                                    data: packagingForm,
                                });
                                toast.success('Prix de conditionnement mis à jour');
                            } else {
                                await createPackagingPrice(packagingForm as any);
                                toast.success('Prix de conditionnement créé');
                            }
                            setPackagingOpen(false);
                            refetchPackaging();
                        } catch (e) {
                            toast.error('Erreur enregistrement prix conditionnement');
                        }
                    }}
                    loading={createPkgLoading || updatePkgLoading}
                />
            )}
        </>
    );
};
