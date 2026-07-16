import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Clock, Plus, Edit2, Trash2, RefreshCw, X, Search,
    AlertTriangle, Tag, Users, Megaphone, Save, ArrowLeft,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import {
    useBusinessChronologies, useCreateBusinessChronology,
    useUpdateBusinessChronology, useDeleteBusinessChronology,
} from '@/hooks/pricing/usePricing';
import type { BusinessChronology } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function parseTags(raw: string): string[] {
    return raw.split(/[,\n]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
}

type FilterTab = 'all' | 'active' | 'inactive';
type FormMode  = 'view' | 'create' | 'edit';

export function BusinessChronologiesPage() {
    const { t } = useTranslation();
    const { data: chronologies, loading, error, refetch } = useBusinessChronologies();
    const { createBusinessChronology, loading: creating } = useCreateBusinessChronology();
    const { updateBusinessChronology, loading: updating } = useUpdateBusinessChronology();
    const { deleteBusinessChronology, loading: deleting } = useDeleteBusinessChronology();

    const [viewSelected, setViewSelected] = useState<BusinessChronology | null>(null);
    const [editTarget,   setEditTarget]   = useState<BusinessChronology | null>(null);
    const [formMode,     setFormMode]     = useState<FormMode>('view');
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [search, setSearch]       = useState('');
    const [tagInput, setTagInput]   = useState('');

    const [form, setForm] = useState<{
        code: string; name: string; description: string;
        tags: string[]; is_active: boolean; sort_order: string;
    }>({ code: '', name: '', description: '', tags: [], is_active: true, sort_order: '0' });

    // Sync viewSelected with fresh data after every refetch
    useEffect(() => {
        setViewSelected(prev => {
            if (!prev) return prev;
            const fresh = (chronologies ?? []).find(c => c.id === prev.id);
            return fresh ?? null;
        });
    }, [chronologies]);

    const resetForm = () => {
        setForm({ code: '', name: '', description: '', tags: [], is_active: true, sort_order: '0' });
        setTagInput('');
        setEditTarget(null);
    };

    const openCreate = () => { resetForm(); setFormMode('create'); };

    const openEdit = (c: BusinessChronology) => {
        setEditTarget(c);
        setForm({
            code: c.code, name: c.name,
            description: c.description ?? '',
            tags: c.available_sub_types ?? [],
            is_active: c.is_active,
            sort_order: c.sort_order?.toString() ?? '0',
        });
        setTagInput('');
        setFormMode('edit');
    };

    const cancelForm = () => { resetForm(); setFormMode('view'); };

    const addTag = (raw: string) => {
        const newTags = parseTags(raw).filter((tag) => !form.tags.includes(tag));
        if (newTags.length > 0) setForm((prev) => ({ ...prev, tags: [...prev.tags, ...newTags] }));
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setForm((prev) => ({ ...prev, tags: prev.tags.filter((tg) => tg !== tag) }));
    };

    const handleSubmit = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error(t('pricing.chronologies.codeAndNameRequired'));
            return;
        }
        const payload = {
            code: form.code.trim(), name: form.name.trim(),
            description: form.description.trim() || null,
            available_sub_types: form.tags,
            is_active: form.is_active,
            sort_order: Number(form.sort_order) || 0,
        };
        try {
            if (editTarget) {
                await updateBusinessChronology({ id: editTarget.id, data: payload });
                toast.success(t('pricing.chronologies.updateSuccess'));
            } else {
                await createBusinessChronology(payload);
                toast.success(t('pricing.chronologies.createSuccess'));
            }
            cancelForm();
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleDelete = async () => {
        if (!viewSelected) return;
        try {
            await deleteBusinessChronology(viewSelected.id);
            toast.success(t('pricing.chronologies.deleteSuccess'));
            setIsDeleteOpen(false);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const allChronologies = chronologies ?? [];
    const activeCount     = allChronologies.filter((c) => c.is_active).length;
    const totalPartners   = allChronologies.reduce((s, c) => s + (c.partners_count   ?? 0), 0);
    const totalPromotions = allChronologies.reduce((s, c) => s + (c.promotions_count ?? 0), 0);

    const filtered = useMemo(() => {
        let list = allChronologies;
        if (filterTab === 'active')   list = list.filter((c) => c.is_active);
        if (filterTab === 'inactive') list = list.filter((c) => !c.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((c) =>
                c.code.toLowerCase().includes(q) ||
                c.name.toLowerCase().includes(q) ||
                c.available_sub_types?.some((tag) => tag.includes(q))
            );
        }
        return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }, [allChronologies, filterTab, search]);

    const TAB_ITEMS: { key: FilterTab; label: string; count: number }[] = [
        { key: 'all',      label: t('pricing.chronologies.filterAll'), count: allChronologies.length },
        { key: 'active',   label: t('common.active'),                   count: activeCount },
        { key: 'inactive', label: t('common.inactive'),                 count: allChronologies.length - activeCount },
    ];

    const chronoColumns = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            colId: 'status', headerName: '', width: 32,
            sortable: false, filter: false, resizable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center justify-center h-full">
                    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.data?.is_active ? '#10b981' : '#d1d5db' }} />
                </div>
            ),
        },
        {
            field: 'code', headerName: 'Code', width: 90,
            cellStyle: { fontFamily: 'monospace', fontSize: '11px', fontWeight: '700', color: '#4338ca' },
        },
        {
            field: 'name', headerName: 'Nom', flex: 1, minWidth: 110,
            cellStyle: { fontSize: '12px', fontWeight: '500', color: '#111827' },
        },
        {
            colId: 'tags', headerName: 'Tags', width: 44,
            sortable: false, filter: false,
            cellRenderer: (p: any) => {
                const count = (p.data?.available_sub_types ?? []).length;
                if (!count) return null;
                return (
                    <div className="flex items-center gap-0.5 text-[11px] text-indigo-500 h-full">
                        <Tag className="w-3 h-3" />{count}
                    </div>
                );
            },
        },
        {
            colId: 'counts', headerName: '', width: 64,
            sortable: false, filter: false,
            cellRenderer: (p: any) => {
                const partners   = p.data?.partners_count   ?? 0;
                const promotions = p.data?.promotions_count ?? 0;
                if (!partners && !promotions) return null;
                return (
                    <div className="flex items-center gap-2 h-full">
                        {partners   > 0 && <span className="flex items-center gap-0.5 text-[10px] text-gray-400"><Users className="w-3 h-3" />{partners}</span>}
                        {promotions > 0 && <span className="flex items-center gap-0.5 text-[10px] text-purple-400"><Megaphone className="w-3 h-3" />{promotions}</span>}
                    </div>
                );
            },
        },
    ], []);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode !== 'view') {
            return [{ items: [
                { icon: Save,  label: t('common.save'),   variant: 'primary', onClick: handleSubmit, disabled: creating || updating },
                { icon: X,     label: t('common.cancel'), variant: 'warning', onClick: cancelForm },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: Plus,      label: t('pricing.chronologies.create'), variant: 'sage',    onClick: openCreate },
            { icon: RefreshCw, label: t('common.refresh'),               variant: 'default', onClick: refetch, disabled: loading },
        ];
        if (viewSelected) {
            return [
                { items: base },
                { items: [
                    { icon: Edit2,  label: t('common.edit'),   variant: 'default', onClick: () => openEdit(viewSelected) },
                    { icon: Trash2, label: t('common.delete'), variant: 'danger',  onClick: () => setIsDeleteOpen(true) },
                ]},
            ];
        }
        return [{ items: base }];
    }, [formMode, viewSelected, loading, creating, updating, t]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    <h2 className="text-sm font-bold text-gray-900">{t('pricing.chronologies.title')}</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                                        {allChronologies.length}
                                    </span>
                                </div>
                                {!loading && (totalPartners > 0 || totalPromotions > 0) && (
                                    <div className="flex items-center gap-1">
                                        {totalPartners > 0 && (
                                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                                <Users className="w-3 h-3" /> {totalPartners}
                                            </span>
                                        )}
                                        {totalPromotions > 0 && (
                                            <span className="text-[10px] text-purple-500 flex items-center gap-0.5">
                                                <Megaphone className="w-3 h-3" /> {totalPromotions}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 mb-2">
                                {TAB_ITEMS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setFilterTab(tab.key)}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded-md transition-all ${
                                            filterTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                        <span className={`text-[10px] font-bold ${filterTab === tab.key ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text" value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('pricing.chronologies.searchPlaceholder')}
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-gray-50/70 transition-all"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={filtered}
                                columnDefs={chronoColumns}
                                loading={loading}
                                rowSelection="single"
                                onRowClicked={(e) => { if (e.data) { setViewSelected(e.data); if (formMode !== 'view') cancelForm(); } }}
                                defaultSelectedIds={(row) => row.id === viewSelected?.id}
                            />
                        </div>
                    </div>
                }
                mainContent={
                    <PricingPageShell
                        title={t('pricing.chronologies.title')}
                        subtitle={t('pricing.chronologies.subtitle')}
                        badge={
                            !loading && activeCount > 0 ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    {activeCount} {t('common.active').toLowerCase()}
                                </span>
                            ) : undefined
                        }
                    >
                        {formMode !== 'view' ? (
                            /* ── Inline create / edit form ─────────────────── */
                            <div className="h-full flex flex-col overflow-hidden">
                                {/* Form header */}
                                <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                                    <button
                                        onClick={cancelForm}
                                        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                    </button>
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900">
                                            {formMode === 'create' ? t('pricing.chronologies.create') : t('pricing.chronologies.edit')}
                                        </h2>
                                        <p className="text-[11px] text-gray-400">
                                            {formMode === 'create' ? t('pricing.chronologies.createDescription') : t('pricing.chronologies.editDescription')}
                                        </p>
                                    </div>
                                </div>

                                {/* Form body */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-lg space-y-5">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">{t('common.code')} *</Label>
                                                <Input
                                                    value={form.code}
                                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                                    placeholder="SNACK"
                                                    className="h-9 text-sm font-mono uppercase"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">{t('common.name')} *</Label>
                                                <Input
                                                    value={form.name}
                                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                                    placeholder="Snack"
                                                    className="h-9 text-sm"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">{t('common.description')}</Label>
                                            <Input
                                                value={form.description}
                                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                                placeholder={t('pricing.chronologies.descriptionPlaceholder')}
                                                className="h-9 text-sm"
                                            />
                                        </div>

                                        {/* Tag pills */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-medium flex items-center gap-1.5">
                                                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                                {t('pricing.chronologies.tags')}
                                            </Label>
                                            {form.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-lg border border-gray-200 min-h-[40px]">
                                                    {form.tags.map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full"
                                                        >
                                                            {tag}
                                                            <button
                                                                type="button"
                                                                onClick={() => removeTag(tag)}
                                                                className="text-indigo-400 hover:text-indigo-700 transition-colors"
                                                            >
                                                                <X className="w-2.5 h-2.5" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div className="flex gap-2">
                                                <Input
                                                    value={tagInput}
                                                    onChange={(e) => setTagInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' || e.key === ',') {
                                                            e.preventDefault();
                                                            addTag(tagInput);
                                                        }
                                                    }}
                                                    placeholder={t('pricing.chronologies.tagsPlaceholder')}
                                                    className="h-8 text-xs"
                                                />
                                                <Button
                                                    type="button" variant="outline" size="sm"
                                                    className="h-8 text-xs px-3 shrink-0"
                                                    onClick={() => addTag(tagInput)}
                                                    disabled={!tagInput.trim()}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-gray-400">{t('pricing.chronologies.tagsHint')}</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-medium">{t('pricing.chronologies.sortOrder')}</Label>
                                                <Input
                                                    type="number"
                                                    value={form.sort_order}
                                                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                                                    className="h-9 text-sm"
                                                    min="0"
                                                />
                                            </div>
                                            <div className="flex items-end pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="chronology-active"
                                                        checked={form.is_active}
                                                        onCheckedChange={(checked) => setForm({ ...form, is_active: Boolean(checked) })}
                                                    />
                                                    <Label htmlFor="chronology-active" className="text-xs font-medium cursor-pointer">
                                                        {t('common.active')}
                                                    </Label>
                                                </div>
                                            </div>
                                        </div>

                                        {editTarget && (editTarget.partners_count ?? 0) > 0 && (
                                            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                                <p className="text-xs">
                                                    {t('pricing.chronologies.tagsEditWarning', { count: editTarget.partners_count })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Form footer */}
                                <div className="px-6 py-3 border-t border-gray-200 bg-gray-50/60 shrink-0 flex items-center justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={cancelForm}>
                                        <X className="w-3.5 h-3.5 mr-1.5" /> {t('common.cancel')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSubmit}
                                        disabled={creating || updating}
                                        className="bg-indigo-600 hover:bg-indigo-700"
                                    >
                                        <Save className="w-3.5 h-3.5 mr-1.5" />
                                        {creating || updating ? t('common.saving') : t('common.save')}
                                    </Button>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2">
                                <p className="text-sm">{error}</p>
                                <Button variant="outline" size="sm" onClick={refetch}>
                                    <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                </Button>
                            </div>
                        ) : viewSelected ? (
                            /* ── Chronology detail ─────────────────────────── */
                            <div className="h-full flex flex-col overflow-hidden">
                                <div className="px-6 py-5 border-b border-gray-200 bg-white shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0">
                                            {viewSelected.code.slice(0, 2)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2.5">
                                                <h1 className="text-lg font-bold text-gray-900">{viewSelected.name}</h1>
                                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                                                    viewSelected.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : 'bg-gray-100 text-gray-500 border-gray-200'
                                                }`}>
                                                    {viewSelected.is_active ? t('common.active') : t('common.inactive')}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                                                <span className="font-mono font-semibold text-indigo-600">{viewSelected.code}</span>
                                                <span className="text-gray-200">·</span>
                                                <span>{t('pricing.chronologies.sortOrder')}: {viewSelected.sort_order ?? 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-2xl space-y-4">
                                        {viewSelected.description && (
                                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('common.description')}</p>
                                                <p className="text-sm text-gray-700">{viewSelected.description}</p>
                                            </div>
                                        )}

                                        <div className="bg-white rounded-xl border border-gray-200 p-5">
                                            <div className="flex items-center gap-1.5 mb-3">
                                                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                    {t('pricing.chronologies.tags')}
                                                </p>
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full ml-auto">
                                                    {(viewSelected.available_sub_types ?? []).length}
                                                </span>
                                            </div>
                                            {(viewSelected.available_sub_types ?? []).length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(viewSelected.available_sub_types ?? []).map((tag) => (
                                                        <span
                                                            key={tag}
                                                            className="text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-xs text-gray-400 italic">{t('pricing.chronologies.noTags')}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('pricing.channels.partnersCount')}
                                                </p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Users className="w-4 h-4 text-sage-500" />
                                                    <span className="text-2xl font-bold text-gray-900">{viewSelected.partners_count ?? 0}</span>
                                                </div>
                                            </div>
                                            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Promotions</p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Megaphone className="w-4 h-4 text-purple-500" />
                                                    <span className="text-2xl font-bold text-gray-900">{viewSelected.promotions_count ?? 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {(viewSelected.partners_count ?? 0) > 0 && (
                                            <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                                <p className="text-xs text-amber-700">
                                                    {t('pricing.chronologies.tagsEditWarning', { count: viewSelected.partners_count })}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* ── Empty state ───────────────────────────────── */
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                    <Clock className="w-10 h-10 text-gray-200" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-semibold text-gray-800">
                                        {allChronologies.length === 0 ? t('pricing.chronologies.noChronologies') : 'Sélectionner une chronologie'}
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                                        {allChronologies.length === 0
                                            ? t('pricing.chronologies.noChronologiesHint')
                                            : 'Cliquez sur une chronologie dans la liste pour voir ses détails.'}
                                    </p>
                                </div>
                                {allChronologies.length === 0 && (
                                    <Button size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700">
                                        <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('pricing.chronologies.create')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </PricingPageShell>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Delete confirmation — stays as dialog (destructive action) */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">{t('common.delete')}</DialogTitle>
                        <DialogDescription className="text-xs">
                            {t('pricing.chronologies.deleteWarning', { name: viewSelected?.name })}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
                            {t('common.cancel')}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? t('common.deleting') : t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
