import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    Save,
    RotateCcw,
    RefreshCw,
    DollarSign,
    Calendar,
    Settings2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { Button } from '@/components/ui/button';

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
    useClearLineDetails,
    useUpsertDetails,
} from '@/hooks/pricing/usePricing';

import {
    ModalCreatePL,
    ModalCreateLine,
    ModalDuplicateLine,
    ModalImport,
    ModalDeleteConfirm,
} from './PricingModals';

import type {
    PriceList,
    PriceListFilters,
    CreatePriceListRequest,
    CreateLineRequest,
    DuplicateLineRequest,
    ImportCsvParams,
    PriceListLine,
    LineDetail,
} from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

export function PriceListsPage() {
    const { t } = useTranslation();

    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedPriceList, setSelectedPriceList] = useState<PriceList | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);

    const [filters, setFilters] = useState<PriceListFilters>({ page: 1, per_page: 20 });
    const [searchQuery, setSearchQuery] = useState('');

    // ── Data Hooks ────────────────────────────────────────────────────────────
    const {
        data: priceListsData,
        loading: priceListsLoading,
        error: priceListsError,
        refetch: refetchPriceLists,
    } = usePriceLists(filters);

    const {
        data: priceListDetailData,
        loading: detailLoading,
        refetch: refetchDetail,
    } = usePriceListDetail(selectedPriceList?.id ?? null);

    const priceListDetail = priceListDetailData ?? selectedPriceList;
    const priceLists = priceListsData?.data ?? [];

    const [selectedDetailsLine, setSelectedDetailsLine] = useState<PriceListLine | null>(null);
    const [editedDetails, setEditedDetails] = useState<Map<number, LineDetail>>(new Map());

    useEffect(() => {
        if (!priceListDetailData) {
            setSelectedDetailsLine(null);
            setEditedDetails(new Map());
            return;
        }
        if (selectedDetailsLine) {
            // Keep selection fresh after refetch
            const fresh = priceListDetailData.lines?.find(
                (l: PriceListLine) => l.id === selectedDetailsLine.id
            );
            if (fresh) {
                setSelectedDetailsLine(fresh);
            } else {
                // Period was deleted — auto-select first open period
                const fallback = priceListDetailData.lines?.find((l: PriceListLine) => !l.closed)
                    ?? priceListDetailData.lines?.[0]
                    ?? null;
                setSelectedDetailsLine(fallback);
                setEditedDetails(new Map());
            }
        } else if (priceListDetailData.lines?.length) {
            // New price list selected — auto-select first open period
            const first = priceListDetailData.lines.find((l: PriceListLine) => !l.closed)
                ?? priceListDetailData.lines[0];
            setSelectedDetailsLine(first);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [priceListDetailData]);

    // ── Mutations ─────────────────────────────────────────────────────────────
    const { execute: createPriceList, loading: createPLLoading } = useCreatePriceList();
    const { updatePriceList, loading: updatePLLoading } = useUpdatePriceList();
    const { execute: deletePriceList, loading: deletePLLoading } = useDeletePriceList();

    const { createLine, loading: createLineLoading } = useCreateLine();
    const { updateLine, loading: updateLineLoading } = useUpdateLine();
    const { duplicateLine, loading: duplicateLoading } = useDuplicateLine();
    const { importCsv, loading: importLoading } = useImportCsv();

    const { clearLineDetails } = useClearLineDetails();
    const { upsertDetails, loading: upsertLoading } = useUpsertDetails();

    // ── Price List Handlers ───────────────────────────────────────────────────
    const [isCreatePLOpen, setCreatePLOpen] = useState(false);
    const [editPL, setEditPL] = useState<PriceList | null>(null);
    const [plForm, setPlForm] = useState<Partial<CreatePriceListRequest>>({});

    const [isDeletePLOpen, setDeletePLOpen] = useState(false);

    const handleCreatePL = () => {
        setEditPL(null);
        setPlForm({ rank: 10 });
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
                toast.success(t('pricing.priceLists.updateSuccess'));
            } else {
                await createPriceList(plForm as CreatePriceListRequest);
                toast.success(t('pricing.priceLists.createSuccess'));
            }
            setCreatePLOpen(false);
            refetchPriceLists();
            if (editPL && selectedPriceList?.id === editPL.id) {
                refetchDetail();
            }
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleDeletePLRequest = () => {
        if (!selectedPriceList) return;
        setDeletePLOpen(true);
    };

    const handleConfirmDeletePL = async () => {
        if (!selectedPriceList) return;
        try {
            await deletePriceList(selectedPriceList.id);
            toast.success(t('pricing.priceLists.deleteSuccess'));
            setDeletePLOpen(false);
            setSelectedPriceList(null);
            setShowDetailPanel(false);
            refetchPriceLists();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    // ── Line Handlers ─────────────────────────────────────────────────────────
    const [isLineModalOpen, setLineModalOpen] = useState(false);
    const [editLine, setEditLine] = useState<PriceListLine | null>(null);
    const [lineForm, setLineForm] = useState<Partial<CreateLineRequest>>({});

    const handleCreateLine = () => {
        setEditLine(null);
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
            closed: line.closed,
        });
        setLineModalOpen(true);
    };

    const handleViewLineDetails = (line: PriceListLine) => {
        setSelectedDetailsLine(line);
        setEditedDetails(new Map());
    };

    const handleSubmitLine = async () => {
        if (!selectedPriceList) return;
        try {
            if (editLine) {
                await updateLine({
                    priceListId: selectedPriceList.id,
                    lineId: editLine.line_number,
                    data: lineForm,
                });
                toast.success(t('pricing.priceLists.line.updateSuccess'));
            } else {
                await createLine({
                    priceListId: selectedPriceList.id,
                    data: {
                        ...lineForm,
                        name: lineForm.name || t('pricing.priceLists.line.defaultName'),
                        start_date: lineForm.start_date!,
                        end_date: lineForm.end_date!,
                    } as CreateLineRequest,
                });
                toast.success(t('pricing.priceLists.line.createSuccess'));
            }
            setLineModalOpen(false);
            refetchDetail();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const [isDuplicateOpen, setDuplicateOpen] = useState(false);
    const [dupForm, setDupForm] = useState<Partial<DuplicateLineRequest>>({});

    const handleDuplicateLine = (sourceLine: PriceListLine) => {
        setDupForm({
            source_line_number: sourceLine.line_number,
            new_line_number: (priceListDetail?.lines?.length ?? 0) + 1,
            new_name: `${t('pricing.priceLists.line.copyOf')} ${sourceLine.name}`,
            new_start_date: sourceLine.end_date,
        });
        setDuplicateOpen(true);
    };

    const handleSubmitDuplicate = async () => {
        if (!selectedPriceList) return;
        try {
            await duplicateLine({
                priceListId: selectedPriceList.id,
                data: dupForm as DuplicateLineRequest,
            });
            toast.success(t('pricing.priceLists.line.duplicateSuccess'));
            setDuplicateOpen(false);
            refetchDetail();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleClearLineDetailsClick = async (line: PriceListLine) => {
        if (!selectedPriceList) return;
        if (!window.confirm(t('pricing.priceLists.line.clearDetailsConfirm'))) return;
        try {
            await clearLineDetails({ priceListId: selectedPriceList.id, lineId: line.line_number });
            toast.success(t('pricing.priceLists.line.clearDetailsSuccess'));
            refetchDetail();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    // ── Line Details Handlers ─────────────────────────────────────────────────
    const handleDetailCellChange = useCallback((event: CellValueChangedEvent) => {
        const data = event.data as LineDetail;
        setEditedDetails((prev) => {
            const next = new Map(prev);
            next.set(data.id, { ...data });
            return next;
        });
    }, []);

    const handleSaveDetails = async () => {
        if (!selectedPriceList || !selectedDetailsLine || editedDetails.size === 0) return;
        const allDetails = (selectedDetailsLine.details ?? []).map((d) => {
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
                data: { details: allDetails },
            });
            toast.success(t('pricing.priceLists.details.saveSuccess', { count: editedDetails.size }));
            setEditedDetails(new Map());
            refetchDetail();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleResetDetails = () => {
        setEditedDetails(new Map());
        if (selectedDetailsLine) {
            setSelectedDetailsLine({ ...selectedDetailsLine });
        }
    };

    // ── Import CSV ────────────────────────────────────────────────────────────
    const [isImportOpen, setImportOpen] = useState(false);
    const [importTargetLine, setImportTargetLine] = useState<number | null>(null);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importParams, setImportParams] = useState<ImportCsvParams>({
        file: null as unknown as File,
        mode: 'merge',
        has_header: true,
        product_identifier: 'code',
    });

    const handleImportCsv = (line: PriceListLine) => {
        setImportTargetLine(line.line_number);
        setImportParams({ mode: 'merge', has_header: true, product_identifier: 'code', file: null as unknown as File });
        setImportFile(null);
        setImportOpen(true);
    };

    const handleSubmitImport = async () => {
        if (!selectedPriceList || !importTargetLine || !importFile) return;
        try {
            await importCsv({
                priceListId: selectedPriceList.id,
                lineId: importTargetLine,
                params: { ...importParams, file: importFile },
            });
            toast.success(t('pricing.priceLists.import.success'));
            setImportOpen(false);
            refetchDetail();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    // ── Search & Select ───────────────────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearchQuery(value);
        setTimeout(() => {
            setFilters((prev) => ({ ...prev, search: value, page: 1 }));
        }, 500);
    };

    const handleSelectPriceList = (row: PriceList) => {
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);

        setSelectedPriceList(row);
        setShowDetailPanel(true);
        setActiveTab('info');
        setSelectedDetailsLine(null);
        setEditedDetails(new Map());

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    };

    // ── Columns ───────────────────────────────────────────────────────────────
    const priceListColumns = useMemo<ColDef[]>(
        () => [
            {
                field: 'code',
                headerName: t('pricing.priceLists.code'),
                width: 110,
                cellRenderer: (p: any) => (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-700">
                        {p.value}
                    </span>
                ),
            },
            { field: 'name', headerName: t('pricing.priceLists.name'), flex: 1, minWidth: 160, cellStyle: { fontWeight: '500' } as any },
            {
                field: 'rank',
                headerName: t('pricing.priceLists.rank'),
                width: 80,
                cellRenderer: (p: any) => (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sage-50 text-sage-700 text-[11px] font-bold">
                        {p.value}
                    </span>
                ),
            },
            {
                field: 'lines_count',
                headerName: t('pricing.priceLists.lines'),
                width: 90,
                valueFormatter: (p: any) => p.value || '0',
                cellStyle: { textAlign: 'center', color: '#6b7280' } as any,
            },
        ],
        [t]
    );

    const linesColumns = useMemo<ColDef[]>(
        () => [
            {
                field: 'line_number',
                headerName: t('pricing.priceLists.line.number'),
                width: 70,
                cellStyle: { textAlign: 'center', color: '#6b7280' } as any,
            },
            {
                field: 'name',
                headerName: t('pricing.priceLists.line.name'),
                flex: 1,
                minWidth: 150,
                cellStyle: { fontWeight: '500' } as any,
            },
            {
                field: 'start_date',
                headerName: t('pricing.priceLists.line.startDate'),
                width: 110,
                valueFormatter: (p: any) => (p.value ? new Date(p.value).toLocaleDateString() : '-'),
            },
            {
                field: 'end_date',
                headerName: t('pricing.priceLists.line.endDate'),
                width: 110,
                valueFormatter: (p: any) => (p.value ? new Date(p.value).toLocaleDateString() : '-'),
            },
            {
                field: 'closed',
                headerName: t('common.status'),
                width: 110,
                cellRenderer: (p: any) => (
                    <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.value
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                        }`}
                    >
                        {p.value ? <X className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {p.value ? t('pricing.priceLists.line.closed') : t('pricing.priceLists.line.open')}
                    </span>
                ),
            },
            {
                headerName: t('pricing.priceLists.products'),
                width: 90,
                valueGetter: (p: any) => p.data?.details?.length ?? 0,
                cellStyle: { textAlign: 'center' } as any,
                cellRenderer: (p: any) => (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold min-w-[24px]">
                        {p.value}
                    </span>
                ),
            },
            {
                headerName: t('common.actions'),
                width: 150,
                cellRenderer: (params: any) => (
                    <div className="flex items-center justify-end gap-0.5">
                        <button
                            onClick={() => handleViewLineDetails(params.data)}
                            className="p-1.5 hover:bg-sage-50 rounded-md text-gray-400 hover:text-sage-600 transition-colors"
                            title={t('pricing.priceLists.line.viewDetails')}
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleEditLine(params.data)}
                            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
                            title={t('common.edit')}
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleDuplicateLine(params.data)}
                            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
                            title={t('pricing.priceLists.line.duplicate')}
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleImportCsv(params.data)}
                            className="p-1.5 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
                            title={t('pricing.priceLists.line.importCsv')}
                        >
                            <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleClearLineDetailsClick(params.data)}
                            className="p-1.5 hover:bg-red-50 rounded-md text-gray-400 hover:text-red-600 transition-colors"
                            title={t('pricing.priceLists.line.clearDetails')}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ),
                sortable: false,
                filter: false,
            },
        ],
        [t]
    );

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
            valueFormatter: (p: any) => (p.value != null ? Number(p.value).toFixed(2) : '0.00'),
            cellStyle: () => ({ textAlign: 'right', ...(color ? { color } : {}) }) as any,
        });

        return [
            {
                field: 'product_id',
                headerName: t('pricing.priceLists.details.product'),
                width: 280,
                minWidth: 200,
                flex: 1,
                pinned: 'left',
                cellRenderer: (p: any) => {
                    const product = p.data?.product;
                    return (
                        <div className="flex flex-col justify-center min-w-0 py-1">
                            <span className="font-medium text-gray-900 truncate text-[13px]">
                                {product?.name || `#${p.value}`}
                            </span>
                            {product?.code && (
                                <span className="text-[11px] text-gray-500 font-mono truncate">
                                    {product.code}
                                </span>
                            )}
                        </div>
                    );
                },
            },
            numCol('sales_price', t('pricing.priceLists.details.salesPrice'), '#059669'),
            numCol('return_price', t('pricing.priceLists.details.returnPrice')),
            numCol('min_sales_price', t('pricing.priceLists.details.minPrice')),
            numCol('max_sales_price', t('pricing.priceLists.details.maxPrice')),
            numCol('discount_rate', t('pricing.priceLists.details.discountRate'), '#d97706'),
            numCol('discount_amount', t('pricing.priceLists.details.discountAmount'), '#d97706'),
        ];
    }, [t]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const actionItems: ActionItemProps[] = [
        {
            icon: RefreshCw,
            label: t('common.refresh'),
            onClick: () => {
                refetchPriceLists();
                if (selectedPriceList) refetchDetail();
            },
            disabled: priceListsLoading,
        },
        {
            icon: Plus,
            label: t('pricing.priceLists.create'),
            variant: 'sage',
            onClick: handleCreatePL,
        },
    ];

    if (selectedPriceList) {
        actionItems.push(
            {
                icon: Edit2,
                label: t('common.edit'),
                onClick: () => handleEditPL(selectedPriceList),
            },
            {
                icon: Trash2,
                label: t('common.delete'),
                variant: 'danger',
                onClick: handleDeletePLRequest,
            }
        );
    }

    const fmtDate = (d: string) =>
        new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-bold text-gray-900">{t('pricing.priceLists.title')}</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                        {priceLists.length}
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCreatePL}
                                    className="h-7 px-2 text-xs border-sage-200 text-sage-700 hover:bg-sage-50 hover:text-sage-800"
                                >
                                    <Plus className="w-3.5 h-3.5 mr-1" />
                                    {t('common.new')}
                                </Button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('pricing.priceLists.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70 transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => handleSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200"
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0 p-2">
                            {priceListsError ? (
                                <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2 p-4">
                                    <p className="text-sm text-center">{priceListsError}</p>
                                    <Button variant="outline" size="sm" onClick={refetchPriceLists}>
                                        <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                    </Button>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                    <DataGrid
                                        rowData={priceLists}
                                        columnDefs={priceListColumns}
                                        loading={priceListsLoading}
                                        rowSelection="single"
                                        onRowDoubleClicked={handleSelectPriceList}
                                        defaultSelectedIds={(row) => row.id === selectedPriceList?.id}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                }
                mainContent={
                    <PricingPageShell
                        title={t('pricing.priceLists.title')}
                        subtitle={t('pricing.priceLists.subtitle')}
                    >
                        <div className="h-full flex overflow-hidden">
                            {showDetailPanel && priceListDetail ? (
                                <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

                                    {/* ── Compact header ───────────────────── */}
                                    <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-200 shrink-0 bg-white">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
                                                {priceListDetail.code?.slice(0, 2) || 'PL'}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h1 className="text-sm font-bold text-gray-900 truncate">{priceListDetail.name}</h1>
                                                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-sage-50 text-sage-600 rounded border border-sage-100 shrink-0">
                                                        {priceListDetail.code}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">
                                                    <span>{t('pricing.priceLists.rank')} <strong className="text-gray-600">{priceListDetail.rank}</strong></span>
                                                    <span className="text-gray-200">·</span>
                                                    <span>{priceListDetail.lines_count || 0} {t('pricing.priceLists.lines')}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-0.5 shrink-0">
                                            <button
                                                onClick={() => { refetchDetail(); toast.success(t('common.refreshed')); }}
                                                className="p-1.5 rounded-md text-gray-400 hover:text-sage-600 hover:bg-gray-100 transition-colors"
                                                title={t('common.refresh')}
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleEditPL(priceListDetail)}
                                                className="p-1.5 rounded-md text-gray-400 hover:text-sage-600 hover:bg-gray-100 transition-colors"
                                                title={t('common.edit')}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => setShowDetailPanel(false)}
                                                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* ── Period chips ─────────────────────── */}
                                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60 overflow-x-auto shrink-0">
                                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0 mr-1">
                                            {t('pricing.priceLists.line.title')}
                                        </span>
                                        {(priceListDetail.lines ?? []).map(line => {
                                            const isActive = selectedDetailsLine?.id === line.id;
                                            return (
                                                <button
                                                    key={line.id}
                                                    onClick={() => handleViewLineDetails(line)}
                                                    className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                                                        isActive
                                                            ? 'bg-sage-600 text-white border-sage-600 shadow-sm'
                                                            : 'bg-white text-gray-600 border-gray-200 hover:border-sage-300 hover:text-sage-700 hover:bg-sage-50'
                                                    }`}
                                                >
                                                    <Calendar className={`w-3 h-3 shrink-0 ${isActive ? 'text-sage-200' : 'text-gray-400'}`} />
                                                    <span>{line.name || `L${line.line_number}`}</span>
                                                    <span className={`text-[10px] ${isActive ? 'text-sage-200' : 'text-gray-400'}`}>
                                                        {fmtDate(line.start_date)} → {fmtDate(line.end_date)}
                                                    </span>
                                                    {line.closed ? (
                                                        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                            {t('pricing.priceLists.line.closed')}
                                                        </span>
                                                    ) : (
                                                        <CheckCircle2 className={`w-3 h-3 ${isActive ? 'text-sage-200' : 'text-emerald-500'}`} />
                                                    )}
                                                    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                                                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {(line.details ?? []).length}
                                                    </span>
                                                    {/* Inline period actions */}
                                                    <span className="flex items-center gap-0.5 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span
                                                            onClick={e => { e.stopPropagation(); handleEditLine(line); }}
                                                            className={`p-0.5 rounded hover:bg-black/10 cursor-pointer ${isActive ? 'text-white' : 'text-gray-400'}`}
                                                            title={t('common.edit')}
                                                        >
                                                            <Settings2 className="w-3 h-3" />
                                                        </span>
                                                        <span
                                                            onClick={e => { e.stopPropagation(); handleDuplicateLine(line); }}
                                                            className={`p-0.5 rounded hover:bg-black/10 cursor-pointer ${isActive ? 'text-white' : 'text-gray-400'}`}
                                                            title={t('pricing.priceLists.line.duplicate')}
                                                        >
                                                            <Copy className="w-3 h-3" />
                                                        </span>
                                                        <span
                                                            onClick={e => { e.stopPropagation(); handleImportCsv(line); }}
                                                            className={`p-0.5 rounded hover:bg-black/10 cursor-pointer ${isActive ? 'text-white' : 'text-gray-400'}`}
                                                            title={t('pricing.priceLists.line.importCsv')}
                                                        >
                                                            <Upload className="w-3 h-3" />
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                        <button
                                            onClick={handleCreateLine}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sage-600 border border-dashed border-sage-200 hover:bg-sage-50 hover:border-sage-400 whitespace-nowrap transition-all shrink-0"
                                        >
                                            <Plus className="w-3.5 h-3.5" /> {t('pricing.priceLists.line.create')}
                                        </button>
                                    </div>

                                    {/* ── Active period info strip ──────────── */}
                                    {selectedDetailsLine && (
                                        <div className="flex items-center justify-between px-5 py-2 border-b border-gray-100 bg-white shrink-0">
                                            <div className="flex items-center gap-3 text-[11px] text-gray-500 min-w-0">
                                                <div className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                                    selectedDetailsLine.closed ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                    L{selectedDetailsLine.line_number}
                                                </div>
                                                <span className="font-semibold text-gray-800 truncate">{selectedDetailsLine.name}</span>
                                                <span className="text-gray-300 shrink-0">·</span>
                                                <span className="shrink-0">
                                                    {fmtDate(selectedDetailsLine.start_date)} → {fmtDate(selectedDetailsLine.end_date)}
                                                </span>
                                                <span className="text-gray-300 shrink-0">·</span>
                                                <span className={`font-semibold shrink-0 ${selectedDetailsLine.closed ? 'text-red-600' : 'text-emerald-600'}`}>
                                                    {selectedDetailsLine.closed ? t('pricing.priceLists.line.closed') : t('pricing.priceLists.line.open')}
                                                </span>
                                                <span className="text-gray-300 shrink-0">·</span>
                                                <span className="shrink-0">
                                                    <strong className="text-gray-700">{(selectedDetailsLine.details ?? []).length}</strong> {t('pricing.priceLists.products')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    onClick={() => handleImportCsv(selectedDetailsLine)}
                                                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
                                                    title={t('pricing.priceLists.line.importCsv')}
                                                >
                                                    <Upload className="w-3 h-3" /> CSV
                                                </button>
                                                <button
                                                    onClick={() => handleClearLineDetailsClick(selectedDetailsLine)}
                                                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 border border-red-100 rounded-md hover:bg-red-50 transition-colors"
                                                    title={t('pricing.priceLists.line.clearDetails')}
                                                >
                                                    <Trash2 className="w-3 h-3" /> {t('pricing.priceLists.line.clearDetails')}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Full-height product prices DataGrid ── */}
                                    <div className="flex-1 min-h-0">
                                        {selectedDetailsLine ? (
                                            detailLoading ? (
                                                <div className="h-full flex items-center justify-center text-gray-400 text-sm gap-2">
                                                    <RefreshCw className="w-4 h-4 animate-spin" /> Chargement...
                                                </div>
                                            ) : (selectedDetailsLine.details ?? []).length > 0 ? (
                                                <DataGrid
                                                    rowData={selectedDetailsLine.details ?? []}
                                                    columnDefs={detailsColumns}
                                                    loading={false}
                                                    onCellValueChanged={handleDetailCellChange}
                                                />
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                                    <FileText className="w-10 h-10 opacity-20" />
                                                    <p className="text-sm font-medium">{t('pricing.priceLists.details.empty')}</p>
                                                    <button
                                                        onClick={() => handleImportCsv(selectedDetailsLine)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 transition-colors"
                                                    >
                                                        <Upload className="w-3.5 h-3.5" /> Importer des prix (CSV)
                                                    </button>
                                                </div>
                                            )
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                                <Layers className="w-10 h-10 opacity-20" />
                                                <p className="text-sm font-medium">Aucune période disponible</p>
                                                <button
                                                    onClick={handleCreateLine}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Créer une période de validité
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Sticky save/reset footer (only when pending changes) ── */}
                                    {editedDetails.size > 0 && (
                                        <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50 border-t border-amber-200 shrink-0">
                                            <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
                                                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                                {t('pricing.priceLists.details.modified', { count: editedDetails.size })}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleResetDetails}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> {t('pricing.priceLists.details.reset')}
                                                </button>
                                                <button
                                                    onClick={handleSaveDetails}
                                                    disabled={upsertLoading}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                                                >
                                                    <Save className="w-3 h-3" /> {t('pricing.priceLists.details.save')}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/80 text-gray-400">
                                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
                                        <DollarSign className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-base font-semibold text-gray-800">{t('pricing.priceLists.noSelectionTitle')}</h3>
                                    <p className="text-sm mt-1.5 text-gray-500 max-w-xs text-center leading-relaxed">
                                        {t('pricing.priceLists.noSelectionSubtitle')}
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleCreatePL}
                                        className="mt-5 border-sage-200 text-sage-700 hover:bg-sage-50"
                                    >
                                        <Plus className="w-4 h-4 mr-1.5" />
                                        {t('pricing.priceLists.create')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </PricingPageShell>
                }
                rightContent={<ActionPanel groups={[{ items: actionItems }]} />}
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
                    loading={duplicateLoading}
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
        </>
    );
}
