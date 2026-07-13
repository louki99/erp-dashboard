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
    Hash,
    DollarSign,
    Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
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
    const [activeTab, setActiveTab] = useState('info');

    const [filters, setFilters] = useState<PriceListFilters>({ page: 1, per_page: 20 });
    const [searchQuery, setSearchQuery] = useState('');

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        lines: true,
    });

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
            const fresh = priceListDetailData.lines?.find(
                (l: PriceListLine) => l.id === selectedDetailsLine.id
            );
            if (fresh) {
                setSelectedDetailsLine(fresh);
            } else {
                setSelectedDetailsLine(null);
                setEditedDetails(new Map());
            }
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

    const toggleSection = (section: string, isOpen: boolean) => {
        setOpenSections((prev) => ({ ...prev, [section]: isOpen }));
    };

    // ── Columns ───────────────────────────────────────────────────────────────
    const priceListColumns = useMemo<ColDef[]>(
        () => [
            { field: 'code', headerName: t('pricing.priceLists.code'), width: 100, cellStyle: { fontWeight: '600' } as any },
            { field: 'name', headerName: t('pricing.priceLists.name'), flex: 1, minWidth: 150 },
            { field: 'rank', headerName: t('pricing.priceLists.rank'), width: 80, cellStyle: { textAlign: 'center' } as any },
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
                width: 100,
                cellRenderer: (p: any) => (
                    <div className={`flex items-center gap-1.5 ${p.value ? 'text-gray-500' : 'text-emerald-600'}`}>
                        {p.value ? (
                            <>
                                <X className="w-3.5 h-3.5" /> {t('pricing.priceLists.line.closed')}
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5" /> {t('pricing.priceLists.line.open')}
                            </>
                        )}
                    </div>
                ),
            },
            {
                headerName: '',
                width: 150,
                cellRenderer: (params: any) => (
                    <div className="flex items-center justify-end gap-1">
                        <button
                            onClick={() => handleEditLine(params.data)}
                            className="p-1 hover:bg-gray-100 rounded text-sage-600"
                            title={t('common.edit')}
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleDuplicateLine(params.data)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500"
                            title={t('pricing.priceLists.line.duplicate')}
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleImportCsv(params.data)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500"
                            title={t('pricing.priceLists.line.importCsv')}
                        >
                            <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleViewLineDetails(params.data)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500"
                            title={t('pricing.priceLists.line.viewDetails')}
                        >
                            <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleClearLineDetailsClick(params.data)}
                            className="p-1 hover:bg-gray-100 rounded text-red-500"
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
                width: 130,
                pinned: 'left',
                cellRenderer: (p: any) => (
                    <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="font-medium text-gray-800">{p.data?.product?.name || p.value}</span>
                    </div>
                ),
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
                icon: Layers,
                label: t('pricing.priceLists.line.create'),
                onClick: handleCreateLine,
            },
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

    const tabs: TabItem[] = [
        { id: 'info', label: t('pricing.priceLists.tabInfo'), icon: FileText },
        { id: 'lines', label: t('pricing.priceLists.tabLines'), icon: Layers },
    ];

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-3 pt-3 pb-2.5 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h2 className="text-sm font-bold text-gray-900 tracking-tight">{t('pricing.priceLists.title')}</h2>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600">
                                    {priceLists.length}
                                </span>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={t('pricing.priceLists.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 bg-gray-50"
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
                                <div className="flex-1 flex flex-col bg-slate-50 min-w-0 overflow-hidden">
                                    {/* Detail Header */}
                                    <div className="bg-white px-5 py-3.5 border-b border-gray-200 shrink-0">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                                    {priceListDetail.code?.slice(0, 2) || 'PL'}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h1 className="text-lg font-bold text-gray-900 tracking-tight">{priceListDetail.name}</h1>
                                                        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-sage-50 text-sage-600 rounded-md border border-sage-100">
                                                            {priceListDetail.code}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                                                        <span className="flex items-center gap-1">
                                                            {t('pricing.priceLists.rank')} <strong className="text-gray-600">{priceListDetail.rank}</strong>
                                                        </span>
                                                        <span>·</span>
                                                        <span>{priceListDetail.lines_count || 0} {t('pricing.priceLists.lines')}</span>
                                                        <span>·</span>
                                                        <span>
                                                            {priceListDetail.created_at
                                                                ? new Date(priceListDetail.created_at).toLocaleDateString()
                                                                : '-'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        refetchDetail();
                                                        toast.success(t('common.refreshed'));
                                                    }}
                                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                                    title={t('common.refresh')}
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleEditPL(priceListDetail)}
                                                    className="p-1.5 rounded-lg hover:bg-sage-50 text-sage-600 transition-colors"
                                                    title={t('common.edit')}
                                                >
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
                                        <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} />
                                    </div>

                                    {/* Tab Content */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                        {activeTab === 'info' && (
                                            <SageCollapsible
                                                title={t('pricing.priceLists.sectionGeneralInfo')}
                                                isOpen={openSections.info}
                                                onOpenChange={(open) => toggleSection('info', open)}
                                            >
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-4 gap-3">
                                                        {[
                                                            { label: t('pricing.priceLists.code'), value: priceListDetail.code, color: 'blue' },
                                                            { label: t('pricing.priceLists.rank'), value: priceListDetail.rank, color: 'purple' },
                                                            { label: t('pricing.priceLists.lines'), value: priceListDetail.lines_count || 0, color: 'emerald' },
                                                            {
                                                                label: t('pricing.priceLists.products'),
                                                                value: (priceListDetail.lines ?? []).reduce(
                                                                    (a: number, l: PriceListLine) => a + (l.details?.length ?? 0),
                                                                    0
                                                                ),
                                                                color: 'amber',
                                                            },
                                                        ].map((kpi) => (
                                                            <div key={kpi.label} className={`bg-${kpi.color}-50 rounded-lg p-3 border border-${kpi.color}-100`}>
                                                                <div className="text-[11px] uppercase font-medium text-gray-500 mb-1">{kpi.label}</div>
                                                                <div className={`text-xl font-bold text-${kpi.color}-700`}>{kpi.value}</div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                                                    {t('pricing.priceLists.fullName')}
                                                                </label>
                                                                <div className="text-sm font-semibold text-gray-900">{priceListDetail.name}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                                                    {t('pricing.priceLists.code')}
                                                                </label>
                                                                <div className="text-sm font-mono font-semibold text-gray-900">{priceListDetail.code}</div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                                                    {t('pricing.priceLists.createdAt')}
                                                                </label>
                                                                <div className="text-sm text-gray-700">
                                                                    {priceListDetail.created_at
                                                                        ? new Date(priceListDetail.created_at).toLocaleDateString('fr-FR', {
                                                                              year: 'numeric',
                                                                              month: 'long',
                                                                              day: 'numeric',
                                                                          })
                                                                        : '-'}
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
                                                                    {t('pricing.priceLists.updatedAt')}
                                                                </label>
                                                                <div className="text-sm text-gray-700">
                                                                    {priceListDetail.updated_at
                                                                        ? new Date(priceListDetail.updated_at).toLocaleDateString('fr-FR', {
                                                                              year: 'numeric',
                                                                              month: 'long',
                                                                              day: 'numeric',
                                                                          })
                                                                        : '-'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </SageCollapsible>
                                        )}

                                        {activeTab === 'lines' && (
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-gray-500" />
                                                        {t('pricing.priceLists.line.title')}
                                                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-gray-100 text-gray-500">
                                                            {priceListDetail.lines?.length ?? 0}
                                                        </span>
                                                    </h3>
                                                    <button
                                                        onClick={handleCreateLine}
                                                        className="text-xs flex items-center gap-1.5 text-white bg-sage-500 hover:bg-sage-600 px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                                                    >
                                                        <Plus className="w-3 h-3" /> {t('pricing.priceLists.line.create')}
                                                    </button>
                                                </div>

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
                                                        {t('pricing.priceLists.line.empty')}
                                                    </div>
                                                )}

                                                {/* Line Details Editor */}
                                                {selectedDetailsLine && (
                                                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                                        <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-50 to-white border-b border-gray-200">
                                                            <div className="flex items-center gap-3">
                                                                <div
                                                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                                                        selectedDetailsLine.closed ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'
                                                                    }`}
                                                                >
                                                                    L{selectedDetailsLine.line_number}
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm font-semibold text-gray-900">{selectedDetailsLine.name}</div>
                                                                    <div className="text-[11px] text-gray-400 flex items-center gap-2">
                                                                        <span>{(selectedDetailsLine.details ?? []).length} {t('pricing.priceLists.products')}</span>
                                                                        <span>·</span>
                                                                        <span className={selectedDetailsLine.closed ? 'text-red-500' : 'text-emerald-500'}>
                                                                            {selectedDetailsLine.closed
                                                                                ? t('pricing.priceLists.line.closed')
                                                                                : t('pricing.priceLists.line.open')}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5">
                                                                {editedDetails.size > 0 && (
                                                                    <>
                                                                        <span className="text-[11px] text-amber-600 font-medium mr-1">
                                                                            {t('pricing.priceLists.details.modified', { count: editedDetails.size })}
                                                                        </span>
                                                                        <button
                                                                            onClick={handleResetDetails}
                                                                            className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-600 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                                                                        >
                                                                            <RotateCcw className="w-3 h-3" /> {t('pricing.priceLists.details.reset')}
                                                                        </button>
                                                                        <button
                                                                            onClick={handleSaveDetails}
                                                                            disabled={upsertLoading}
                                                                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md shadow-sm transition-colors"
                                                                        >
                                                                            <Save className="w-3 h-3" /> {t('pricing.priceLists.details.save')}
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleImportCsv(selectedDetailsLine)}
                                                                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
                                                                    title={t('pricing.priceLists.line.importCsv')}
                                                                >
                                                                    <Upload className="w-3 h-3" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleClearLineDetailsClick(selectedDetailsLine)}
                                                                    className="flex items-center gap-1 px-2 py-1 text-[11px] text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                                                                    title={t('pricing.priceLists.line.clearDetails')}
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
                                                                {t('pricing.priceLists.details.empty')}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {!selectedDetailsLine && (priceListDetail.lines?.length ?? 0) > 0 && (
                                                    <div className="flex items-center justify-center py-4 text-xs text-gray-400 bg-white rounded-lg border border-dashed border-gray-200">
                                                        <Eye className="w-4 h-4 mr-1.5 opacity-40" />
                                                        {t('pricing.priceLists.details.hint')}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 text-gray-400">
                                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
                                        <DollarSign className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-700">{t('pricing.priceLists.noSelectionTitle')}</h3>
                                    <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
                                        {t('pricing.priceLists.noSelectionSubtitle')}
                                    </p>
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
