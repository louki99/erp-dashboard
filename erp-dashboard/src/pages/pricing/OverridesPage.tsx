import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Plus, Edit2, Trash2, RefreshCw, Search, ChevronLeft, ChevronRight,
    Download, CheckCircle2, XCircle, Clock, Minus, X,
    Tag, Loader2,
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
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

function toDateInput(value: string | null | undefined): string | undefined {
    return value ? value.slice(0, 10) : undefined;
}

type ValidityStatus = 'permanent' | 'active' | 'expired' | 'upcoming';

function getValidityStatus(validFrom: string | null | undefined, validTo: string | null | undefined): ValidityStatus {
    if (!validFrom && !validTo) return 'permanent';
    const today = new Date().toISOString().slice(0, 10);
    if (validTo && validTo.slice(0, 10) < today) return 'expired';
    if (validFrom && validFrom.slice(0, 10) > today) return 'upcoming';
    return 'active';
}

function exportToCsv(overrides: PriceOverride[]) {
    const headers = ['Partenaire', 'Code client', 'Produit', 'Réf. produit', 'Prix fixe', 'Remise %', 'Remise montant', 'Début', 'Fin', 'Priorité', 'Actif'];
    const rows = overrides.map((o) => [
        o.partner?.name ?? o.partner_id,
        o.partner?.code ?? '',
        o.product?.name ?? o.product_id,
        o.product?.code ?? '',
        o.fixed_price ?? '',
        o.discount_rate ?? '',
        o.discount_amount ?? '',
        toDateInput(o.valid_from) ?? '',
        toDateInput(o.valid_to) ?? '',
        o.priority,
        o.active ? 'Oui' : 'Non',
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `derogations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

const VALIDITY_CONFIG = {
    permanent: { cls: 'bg-gray-100 text-gray-600 border-gray-200',    label: 'Permanent', icon: Minus },
    active:    { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Actif',    icon: CheckCircle2 },
    expired:   { cls: 'bg-red-50 text-red-600 border-red-200',        label: 'Expiré',   icon: XCircle },
    upcoming:  { cls: 'bg-blue-50 text-blue-600 border-blue-200',     label: 'À venir',  icon: Clock },
} as const;

// ─── Main Detail Panel (mainContent) ─────────────────────────────────────────

function OverrideDetail({
    override: ov,
    onEdit,
    onToggle,
    onClose,
}: {
    override: PriceOverride;
    onEdit: (o: PriceOverride) => void;
    onToggle: (id: number) => void;
    onClose: () => void;
}) {
    const validityStatus = getValidityStatus(ov.valid_from, ov.valid_to);
    const vCfg = VALIDITY_CONFIG[validityStatus];
    const ValidityIcon = vCfg.icon;
    const from = toDateInput(ov.valid_from);
    const to = toDateInput(ov.valid_to);

    return (
        <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0 mt-0.5"
                        >
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {ov.partner?.name?.charAt(0)?.toUpperCase() ?? 'D'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-bold text-gray-900 truncate">
                                    {ov.partner?.name ?? `Partenaire #${ov.partner_id}`}
                                </h1>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ov.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${ov.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                                    {ov.active ? 'Active' : 'Inactive'}
                                </span>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${vCfg.cls}`}>
                                    <ValidityIcon className="w-2.5 h-2.5" />
                                    {vCfg.label}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                <span className="font-mono font-medium">{ov.partner?.code}</span>
                                <span>·</span>
                                <span>Priorité <strong className="text-gray-700">{ov.priority}</strong></span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => onEdit(ov)}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors"
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                        Modifier
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* 2-col cards: Produit + Tarification */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                    {/* Produit */}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Produit</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Référence</span>
                                <span className="font-mono text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                                    {ov.product?.code ?? `#${ov.product_id}`}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Désignation</span>
                                <span className="text-xs font-semibold text-gray-900 text-right max-w-[60%] truncate" title={ov.product?.name}>
                                    {ov.product?.name ?? '—'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tarification */}
                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Tarification</span>
                        </div>
                        <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Prix fixe</span>
                                <span className={`text-sm font-bold ${ov.fixed_price != null ? 'text-emerald-700' : 'text-gray-300'}`}>
                                    {ov.fixed_price != null ? Number(ov.fixed_price).toFixed(3) : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Remise %</span>
                                <span className={`text-sm font-bold ${ov.discount_rate ? 'text-amber-600' : 'text-gray-300'}`}>
                                    {ov.discount_rate ? `-${Number(ov.discount_rate).toFixed(1)} %` : '—'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-400">Remise montant</span>
                                <span className={`text-sm font-bold ${ov.discount_amount ? 'text-amber-600' : 'text-gray-300'}`}>
                                    {ov.discount_amount ? `-${Number(ov.discount_amount).toFixed(2)}` : '—'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Validité */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Période de validité</span>
                    </div>
                    <div className="p-4">
                        <div className="flex items-center gap-4">
                            <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${vCfg.cls}`}>
                                <ValidityIcon className="w-3.5 h-3.5" />
                                {vCfg.label}
                            </div>
                            {(from || to) ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <span className="font-mono">{from ?? '…'}</span>
                                    <span className="text-gray-300">→</span>
                                    <span className="font-mono">{to ?? '…'}</span>
                                </div>
                            ) : (
                                <span className="text-xs text-gray-400">Sans limite de date</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Toggle active */}
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Activation</span>
                    </div>
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-gray-800">
                                {ov.active ? 'Dérogation active' : 'Dérogation inactive'}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {ov.active
                                    ? 'Appliquée lors des calculs de prix'
                                    : 'Ignorée lors des calculs de prix'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => onToggle(ov.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${ov.active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                        >
                            <span className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${ov.active ? 'translate-x-[22px]' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Empty state (no selection) ───────────────────────────────────────────────

function OverrideEmptyState() {
    return (
        <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8 bg-slate-50">
            <div className="w-14 h-14 rounded-2xl bg-white border-2 border-dashed border-gray-200 flex items-center justify-center">
                <Tag className="w-6 h-6 text-gray-300" />
            </div>
            <div>
                <p className="text-sm font-semibold text-gray-500">Aucune dérogation sélectionnée</p>
                <p className="text-xs text-gray-400 mt-0.5">Cliquez sur une ligne pour afficher le détail</p>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════

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
    const [selectedOverride, setSelectedOverride] = useState<PriceOverride | null>(null);
    const [showDetail, setShowDetail] = useState(false);
    const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        document.getElementById('loading-cursor-style')?.remove();
    }, []);

    const overrides = data?.data ?? [];
    const currentPage = data?.current_page ?? 1;
    const lastPage = data?.last_page ?? 1;
    const total = data?.total ?? overrides.length;

    const partnerOptions = useMemo(
        () => partners.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        [partners]
    );

    // Keep selectedOverride fresh after refetch
    useEffect(() => {
        if (selectedOverride) {
            const fresh = overrides.find((o) => o.id === selectedOverride.id);
            if (fresh) setSelectedOverride(fresh);
        }
    }, [overrides]); // eslint-disable-line react-hooks/exhaustive-deps

    const applySearch = () => {
        setFilters((prev) => ({ ...prev, q: search.trim() || undefined, page: 1 }));
    };

    const handleCreate = useCallback(() => {
        setEditing(null);
        setForm({ active: true, priority: 0 });
        setIsOpen(true);
    }, []);

    const handleEdit = useCallback((ov: PriceOverride) => {
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
    }, []);

    const handleDelete = useCallback(async (id: number) => {
        if (!window.confirm(t('pricing.overrides.deleteConfirm'))) return;
        try {
            await deleteOverride(id);
            toast.success(t('pricing.overrides.deleteSuccess'));
            setSelectedOverride((prev) => (prev?.id === id ? null : prev));
            setShowDetail((prev) => (selectedOverride?.id === id ? false : prev));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    }, [deleteOverride, refetch, t, selectedOverride?.id]);

    const handleToggle = useCallback(async (id: number) => {
        try {
            const res = await toggleOverride(id);
            toast.success(res?.message ?? t('pricing.overrides.toggleSuccess'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    }, [toggleOverride, refetch, t]);

    const handleSubmit = async () => {
        if (!form.partner_id || !form.product_id) {
            toast.error(t('pricing.overrides.missingPartnerProduct'));
            return;
        }
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

    const handleRowSelect = useCallback((row: PriceOverride) => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        if (!document.getElementById('loading-cursor-style')) {
            const style = document.createElement('style');
            style.id = 'loading-cursor-style';
            style.innerHTML = '* { cursor: wait !important; }';
            document.head.appendChild(style);
        }
        setSelectedOverride(row);
        setShowDetail(true);
        cursorTimeoutRef.current = setTimeout(() => {
            document.getElementById('loading-cursor-style')?.remove();
            cursorTimeoutRef.current = undefined;
        }, 400);
    }, []);

    // ── Left panel column defs (compact) ────────────────────────────────────
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            colId: 'partner_code',
            headerName: 'Code',
            width: 105,
            resizable: false,
            valueGetter: (p: any) => p.data?.partner?.code ?? `#${p.data?.partner_id}`,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-1.5 h-full">
                    <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: p.data?.active ? '#10b981' : '#d1d5db' }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                        {p.data?.partner?.code ?? `#${p.data?.partner_id}`}
                    </span>
                </div>
            ),
        },
        {
            colId: 'partner_name',
            headerName: 'Partenaire',
            flex: 1,
            minWidth: 110,
            valueGetter: (p: any) => p.data?.partner?.name ?? `#${p.data?.partner_id}`,
            cellStyle: { fontWeight: '500', color: '#111827', fontSize: '12px' },
        },
        {
            colId: 'product_name',
            headerName: 'Produit',
            flex: 1,
            minWidth: 100,
            valueGetter: (p: any) => p.data?.product?.name ?? `#${p.data?.product_id}`,
            cellStyle: { color: '#6b7280', fontSize: '11px' },
        },
    ], []);

    // ── ActionPanel (rightContent) — dynamic on selection ──────────────────
    const actionGroups = useMemo(() => {
        type AVariant = 'default' | 'danger' | 'primary' | 'sage';
        const base = [
            { icon: Plus, label: t('pricing.overrides.create'), variant: 'sage' as AVariant, onClick: handleCreate },
            { icon: RefreshCw, label: t('common.refresh'), variant: 'default' as AVariant, onClick: refetch, disabled: loading },
            { icon: Download, label: 'Exporter CSV', variant: 'default' as AVariant, onClick: () => exportToCsv(overrides), disabled: overrides.length === 0 },
        ];
        if (selectedOverride && showDetail) {
            return [
                { items: base },
                {
                    items: [
                        { icon: Edit2, label: 'Modifier', variant: 'primary' as AVariant, onClick: () => handleEdit(selectedOverride) },
                        { icon: selectedOverride.active ? XCircle : CheckCircle2, label: selectedOverride.active ? 'Désactiver' : 'Activer', variant: 'default' as AVariant, onClick: () => handleToggle(selectedOverride.id) },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as AVariant, onClick: () => handleDelete(selectedOverride.id) },
                    ],
                },
            ];
        }
        return [{ items: base }];
    }, [selectedOverride, showDetail, handleCreate, handleEdit, handleToggle, handleDelete, refetch, loading, overrides]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Tag className="w-4 h-4 text-sage-600" />
                                    Dérogations
                                </h1>
                                <span className="px-2 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">
                                    {total}
                                </span>
                            </div>

                            {/* Search */}
                            <div className="relative mb-2">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                                    onBlur={applySearch}
                                    placeholder="Partenaire, produit..."
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-gray-50"
                                />
                                {search && (
                                    <button onClick={() => { setSearch(''); setFilters(p => ({ ...p, q: undefined, page: 1 })); }} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {/* Partner filter */}
                            <SearchableSelect
                                options={partnerOptions}
                                value={filters.partner_id ?? null}
                                onChange={(val) => setFilters((prev) => ({ ...prev, partner_id: val ? Number(val) : undefined, page: 1 }))}
                                placeholder="Filtrer par partenaire"
                                clearable
                            />

                            {/* Status tabs */}
                            <div className="flex gap-1 mt-2">
                                {([
                                    { key: undefined, label: 'Tous' },
                                    { key: true,      label: 'Actifs' },
                                    { key: false,     label: 'Inactifs' },
                                ] as { key: boolean | undefined; label: string }[]).map(({ key, label }) => (
                                    <button
                                        key={label}
                                        onClick={() => setFilters((p) => ({ ...p, active: key, page: 1 }))}
                                        className={`flex-1 text-[10px] font-medium py-1 rounded transition-colors ${
                                            filters.active === key
                                                ? 'bg-sage-600 text-white'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-1.5">
                                <XCircle className="w-3.5 h-3.5 shrink-0" /> {error}
                            </div>
                        )}

                        {/* DataGrid */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                {loading && overrides.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={overrides}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        onRowDoubleClicked={handleRowSelect}
                                        rowSelection="single"
                                    />
                                )}
                            </div>
                        </div>

                        {/* Pagination */}
                        {lastPage > 1 && (
                            <div className="p-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                                <span>Page {currentPage} / {lastPage}</span>
                                <div className="flex gap-1">
                                    <button
                                        disabled={currentPage <= 1}
                                        onClick={() => setFilters((p) => ({ ...p, page: currentPage - 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        <ChevronLeft className="w-3 h-3" />
                                    </button>
                                    <button
                                        disabled={currentPage >= lastPage}
                                        onClick={() => setFilters((p) => ({ ...p, page: currentPage + 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        <ChevronRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                }

                mainContent={
                    <PricingPageShell
                        title={t('pricing.overrides.title')}
                        subtitle={t('pricing.overrides.subtitle')}
                    >
                        <div className="h-full overflow-hidden">
                            {showDetail && selectedOverride ? (
                                <OverrideDetail
                                    override={selectedOverride}
                                    onEdit={handleEdit}
                                    onToggle={handleToggle}
                                    onClose={() => { setShowDetail(false); setSelectedOverride(null); }}
                                />
                            ) : (
                                <OverrideEmptyState />
                            )}
                        </div>
                    </PricingPageShell>
                }

                rightContent={<ActionPanel groups={actionGroups} />}
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
