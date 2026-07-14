import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Plus, Edit2, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight,
    Download, CheckCircle2, XCircle, Clock, Minus,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/common/SearchableSelect';

import {
    useOverrides,
    useCreateOverride,
    useUpdateOverride,
    useDeleteOverride,
    useToggleOverride,
} from '@/hooks/pricing/usePricing';
import { ModalOverride } from './PricingModals';
import type { PriceOverride, CreateOverrideRequest, OverrideFilters } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

// Les inputs date attendent yyyy-MM-dd ; le backend renvoie des ISO complets.
function toDateInput(value: string | null | undefined): string | undefined {
    return value ? value.slice(0, 10) : undefined;
}

type ValidityStatus = 'permanent' | 'active' | 'expired' | 'upcoming';

function getValidityStatus(validFrom: string | null, validTo: string | null): ValidityStatus {
    if (!validFrom && !validTo) return 'permanent';
    const today = new Date().toISOString().slice(0, 10);
    if (validTo && validTo.slice(0, 10) < today) return 'expired';
    if (validFrom && validFrom.slice(0, 10) > today) return 'upcoming';
    return 'active';
}

function exportToCsv(overrides: PriceOverride[]) {
    const headers = ['Partner', 'Product', 'Fixed Price', 'Discount Rate', 'Discount Amount', 'Valid From', 'Valid To', 'Priority', 'Active'];
    const rows = overrides.map((o) => [
        o.partner?.name ?? o.partner_id,
        o.product?.name ?? o.product_id,
        o.fixed_price ?? '',
        o.discount_rate ?? '',
        o.discount_amount ?? '',
        toDateInput(o.valid_from) ?? '',
        toDateInput(o.valid_to) ?? '',
        o.priority,
        o.active ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `overrides-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

type CellParams = { value: unknown; data?: PriceOverride };

export function OverridesPage() {
    const { t } = useTranslation();
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<OverrideFilters>({ page: 1, per_page: 20 });
    const { data, partners, loading, error, refetch } = useOverrides(filters);
    const { createOverride, loading: creating } = useCreateOverride();
    const { updateOverride, loading: updating } = useUpdateOverride();
    const { deleteOverride, loading: deleting } = useDeleteOverride();
    const { toggleOverride } = useToggleOverride();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState<PriceOverride | null>(null);
    const [form, setForm] = useState<Partial<CreateOverrideRequest>>({});

    const overrides = data?.data ?? [];
    const currentPage = data?.current_page ?? 1;
    const lastPage = data?.last_page ?? 1;
    const total = data?.total ?? overrides.length;

    const partnerOptions = useMemo(
        () => partners.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        [partners]
    );

    const applySearch = () => {
        setFilters((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
    };

    const handleCreate = () => {
        setEditing(null);
        setForm({ active: true, priority: 0 });
        setIsOpen(true);
    };

    const handleEdit = (ov: PriceOverride) => {
        setEditing(ov);
        setForm({
            partner_id: ov.partner_id,
            product_id: ov.product_id,
            fixed_price: ov.fixed_price ?? undefined,
            discount_rate: ov.discount_rate ?? undefined,
            discount_amount: ov.discount_amount ?? undefined,
            valid_from: toDateInput(ov.valid_from),
            valid_to: toDateInput(ov.valid_to),
            priority: ov.priority,
            active: ov.active,
        });
        setIsOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('pricing.overrides.deleteConfirm'))) return;
        try {
            await deleteOverride(id);
            toast.success(t('pricing.overrides.deleteSuccess'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    // Révocation soft via PATCH toggle : conserve l'historique, purge le mobile au delta sync.
    const handleToggle = async (id: number) => {
        try {
            const res = await toggleOverride(id);
            toast.success(res?.message ?? t('pricing.overrides.toggleSuccess'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleSubmit = async () => {
        if (!form.partner_id || !form.product_id) {
            toast.error(t('pricing.overrides.missingPartnerProduct'));
            return;
        }
        // discount_rate est un pourcentage 0–100 (moteur v5) — l'ancienne borne 0–1 est morte.
        if (form.discount_rate != null && (form.discount_rate < 0 || form.discount_rate > 100)) {
            toast.error(t('pricing.overrides.discountRateInvalid'));
            return;
        }
        const payload: CreateOverrideRequest = {
            partner_id: form.partner_id,
            product_id: form.product_id,
            fixed_price: form.fixed_price ?? null,
            discount_rate: form.discount_rate ?? null,
            discount_amount: form.discount_amount ?? null,
            valid_from: form.valid_from || undefined,
            valid_to: form.valid_to || undefined,
            priority: form.priority ?? 0,
            active: form.active ?? true,
        };
        try {
            if (editing) {
                await updateOverride({ id: editing.id, data: payload });
                toast.success(t('pricing.overrides.updateSuccess'));
            } else {
                await createOverride(payload);
                toast.success(t('pricing.overrides.createSuccess'));
            }
            setIsOpen(false);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const columnDefs = useMemo(
        () => [
            {
                field: 'partner.name',
                headerName: t('pricing.overrides.partner'),
                minWidth: 180,
                cellRenderer: (params: CellParams) => {
                    const ov = params.data as PriceOverride;
                    return (
                        <div>
                            <div className="text-sm font-medium text-gray-900">{ov.partner?.name || `Partner #${ov.partner_id}`}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{ov.partner?.code}</div>
                        </div>
                    );
                },
            },
            {
                field: 'product.name',
                headerName: t('pricing.overrides.product'),
                minWidth: 200,
                cellRenderer: (params: CellParams) => {
                    const ov = params.data as PriceOverride;
                    return (
                        <div>
                            <div className="text-sm font-medium text-gray-900">{ov.product?.name || `Product #${ov.product_id}`}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{ov.product?.code}</div>
                        </div>
                    );
                },
            },
            {
                field: 'fixed_price',
                headerName: t('pricing.overrides.fixedPrice'),
                minWidth: 110,
                cellRenderer: (params: CellParams) => {
                    const value = params.value != null ? Number(params.value) : null;
                    return value != null ? (
                        <span className="text-sm font-semibold text-emerald-700">{value.toFixed(3)}</span>
                    ) : (
                        <span className="text-xs text-gray-400">—</span>
                    );
                },
            },
            {
                field: 'discount_rate',
                headerName: t('pricing.overrides.discountRate'),
                minWidth: 100,
                cellRenderer: (params: CellParams) => {
                    const value = params.value ? Number(params.value) : null;
                    return value ? <span className="text-sm text-amber-600">-{value}%</span> : <span className="text-xs text-gray-400">—</span>;
                },
            },
            {
                field: 'discount_amount',
                headerName: t('pricing.overrides.discountAmount'),
                minWidth: 110,
                cellRenderer: (params: CellParams) => {
                    const value = params.value ? Number(params.value) : null;
                    return value ? <span className="text-sm text-amber-600">-{value.toFixed(2)}</span> : <span className="text-xs text-gray-400">—</span>;
                },
            },
            {
                field: 'valid_from',
                headerName: t('pricing.overrides.validity'),
                minWidth: 220,
                cellRenderer: (params: CellParams) => {
                    const ov = params.data as PriceOverride;
                    const from = toDateInput(ov.valid_from);
                    const to = toDateInput(ov.valid_to);
                    const status = getValidityStatus(ov.valid_from, ov.valid_to);
                    const statusConfig = {
                        permanent: { icon: Minus, cls: 'text-gray-500 bg-gray-100', label: t('pricing.overrides.validityPermanent') },
                        active: { icon: CheckCircle2, cls: 'text-emerald-700 bg-emerald-50', label: t('pricing.overrides.validityActive') },
                        expired: { icon: XCircle, cls: 'text-red-600 bg-red-50', label: t('pricing.overrides.validityExpired') },
                        upcoming: { icon: Clock, cls: 'text-blue-600 bg-blue-50', label: t('pricing.overrides.validityUpcoming') },
                    }[status];
                    const Icon = statusConfig.icon;
                    return (
                        <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusConfig.cls}`}>
                                <Icon className="w-2.5 h-2.5" />
                                {statusConfig.label}
                            </span>
                            {(from || to) && (
                                <span className="text-[11px] text-gray-500 font-mono">
                                    {from ?? '…'} → {to ?? '…'}
                                </span>
                            )}
                        </div>
                    );
                },
            },
            {
                field: 'priority',
                headerName: t('pricing.overrides.priority'),
                minWidth: 90,
                sortable: true,
                cellRenderer: (params: CellParams) => {
                    const v = Number(params.value ?? 0);
                    const cls = v === 0
                        ? 'bg-gray-100 text-gray-500'
                        : v <= 5
                            ? 'bg-blue-50 text-blue-700'
                            : v <= 15
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-red-50 text-red-700';
                    return (
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{v}</span>
                    );
                },
            },
            {
                field: 'active',
                headerName: t('common.status'),
                minWidth: 90,
                cellRenderer: (params: CellParams) => {
                    const ov = params.data as PriceOverride;
                    return (
                        <button
                            type="button"
                            onClick={() => handleToggle(ov.id)}
                            title={ov.active ? t('pricing.overrides.deactivate') : t('pricing.overrides.activate')}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${ov.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${ov.active ? 'translate-x-[18px]' : 'translate-x-1'}`}
                            />
                        </button>
                    );
                },
            },
            {
                headerName: t('common.actions'),
                minWidth: 100,
                sortable: false,
                filter: false,
                cellRenderer: (params: CellParams) => {
                    const ov = params.data as PriceOverride;
                    return (
                        <div className="flex items-center justify-end gap-1">
                            <button
                                onClick={() => handleEdit(ov)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('common.edit')}
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => handleDelete(ov.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('common.delete')}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                },
            },
        ],
        [t]
    );

    const actions: ActionItemProps[] = [
        { icon: Plus, label: t('pricing.overrides.create'), variant: 'sage', onClick: handleCreate },
        { icon: RefreshCw, label: t('common.refresh'), onClick: refetch, disabled: loading },
    ];

    return (
        <>
            <MasterLayout
                mainContent={
                    <PricingPageShell
                        title={t('pricing.overrides.title')}
                        subtitle={t('pricing.overrides.subtitle')}
                    >
                        <div className="h-full flex flex-col">
                            {/* Stats bar */}
                            <div className="px-4 pt-3 pb-2 flex items-center gap-2 flex-wrap border-b border-gray-100">
                                <button
                                    onClick={() => setFilters((prev) => ({ ...prev, active: undefined, page: 1 }))}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        filters.active === undefined
                                            ? 'bg-gray-800 text-white'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                >
                                    {t('pricing.overrides.statsTotal')}
                                    <span className="font-bold">{total}</span>
                                </button>
                                <button
                                    onClick={() => setFilters((prev) => ({ ...prev, active: true, page: 1 }))}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        filters.active === true
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                    }`}
                                >
                                    <CheckCircle2 className="w-3 h-3" />
                                    {t('pricing.overrides.statsActive')}
                                    {filters.active === true && <span className="font-bold">{total}</span>}
                                </button>
                                <button
                                    onClick={() => setFilters((prev) => ({ ...prev, active: false, page: 1 }))}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                        filters.active === false
                                            ? 'bg-gray-600 text-white'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    <XCircle className="w-3 h-3" />
                                    {t('pricing.overrides.statsInactive')}
                                    {filters.active === false && <span className="font-bold">{total}</span>}
                                </button>
                                <div className="ml-auto flex items-center gap-1.5">
                                    {overrides.length > 0 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2.5 text-xs gap-1.5"
                                            onClick={() => exportToCsv(overrides)}
                                            title={t('pricing.overrides.exportCsv')}
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                            {t('pricing.overrides.exportCsv')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Filters */}
                            <div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
                                <div className="relative flex-1 min-w-[200px] max-w-sm">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                                        onBlur={applySearch}
                                        placeholder={t('pricing.overrides.searchPlaceholder')}
                                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-400"
                                    />
                                </div>
                                <div className="w-52">
                                    <SearchableSelect
                                        options={partnerOptions}
                                        value={filters.partner_id ?? null}
                                        onChange={(val) =>
                                            setFilters((prev) => ({ ...prev, partner_id: val ? Number(val) : undefined, page: 1 }))
                                        }
                                        placeholder={t('pricing.overrides.filterPartner')}
                                        clearable
                                    />
                                </div>
                            </div>

                            <div className="flex-1 p-4 overflow-hidden">
                                {error ? (
                                    <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2">
                                        <p className="text-sm">{error}</p>
                                        <Button variant="outline" size="sm" onClick={refetch}>
                                            <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                                        <div className="flex-1 overflow-hidden">
                                            <DataGrid
                                                rowData={overrides}
                                                columnDefs={columnDefs}
                                                loading={loading}
                                                suppressAutoFit
                                            />
                                        </div>
                                        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/60">
                                            <span className="text-xs text-gray-500">
                                                {t('pricing.overrides.results', { count: total })}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2"
                                                    disabled={loading || currentPage <= 1}
                                                    onClick={() => setFilters((prev) => ({ ...prev, page: currentPage - 1 }))}
                                                >
                                                    <ChevronLeft className="w-3.5 h-3.5" />
                                                </Button>
                                                <span className="text-xs text-gray-600 font-medium">
                                                    {currentPage} / {lastPage}
                                                </span>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="h-7 px-2"
                                                    disabled={loading || currentPage >= lastPage}
                                                    onClick={() => setFilters((prev) => ({ ...prev, page: currentPage + 1 }))}
                                                >
                                                    <ChevronRight className="w-3.5 h-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </PricingPageShell>
                }
                rightContent={<ActionPanel groups={[{ items: actions }]} />}
            />
            {isOpen && (
                <ModalOverride
                    editingOverride={editing}
                    form={form}
                    setForm={setForm}
                    onClose={() => setIsOpen(false)}
                    onSubmit={handleSubmit}
                    loading={creating || updating || deleting}
                />
            )}
        </>
    );
}
