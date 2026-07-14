import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Clock, Plus, Edit2, Trash2, RefreshCw, X, Search,
    AlertTriangle, Tag, Users, Megaphone,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function BusinessChronologiesPage() {
    const { t } = useTranslation();
    const { data: chronologies, loading, error, refetch } = useBusinessChronologies();
    const { createBusinessChronology, loading: creating } = useCreateBusinessChronology();
    const { updateBusinessChronology, loading: updating } = useUpdateBusinessChronology();
    const { deleteBusinessChronology, loading: deleting } = useDeleteBusinessChronology();

    const [selected, setSelected] = useState<BusinessChronology | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [search, setSearch] = useState('');
    const [tagInput, setTagInput] = useState('');

    const [form, setForm] = useState<{
        code: string; name: string; description: string;
        tags: string[]; is_active: boolean; sort_order: string;
    }>({ code: '', name: '', description: '', tags: [], is_active: true, sort_order: '0' });

    const resetForm = () => {
        setForm({ code: '', name: '', description: '', tags: [], is_active: true, sort_order: '0' });
        setTagInput('');
        setSelected(null);
    };

    const openCreate = () => { resetForm(); setIsFormOpen(true); };

    const openEdit = (c: BusinessChronology) => {
        setSelected(c);
        setForm({
            code: c.code, name: c.name,
            description: c.description ?? '',
            tags: c.available_sub_types ?? [],
            is_active: c.is_active,
            sort_order: c.sort_order?.toString() ?? '0',
        });
        setTagInput('');
        setIsFormOpen(true);
    };

    const confirmDelete = (c: BusinessChronology) => { setSelected(c); setIsDeleteOpen(true); };

    const addTag = (raw: string) => {
        const newTags = parseTags(raw).filter((tag) => !form.tags.includes(tag));
        if (newTags.length > 0) setForm((prev) => ({ ...prev, tags: [...prev.tags, ...newTags] }));
        setTagInput('');
    };

    const removeTag = (tag: string) => {
        setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }));
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
            if (selected) {
                await updateBusinessChronology({ id: selected.id, data: payload });
                toast.success(t('pricing.chronologies.updateSuccess'));
            } else {
                await createBusinessChronology(payload);
                toast.success(t('pricing.chronologies.createSuccess'));
            }
            setIsFormOpen(false);
            resetForm();
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleDelete = async () => {
        if (!selected) return;
        try {
            await deleteBusinessChronology(selected.id);
            toast.success(t('pricing.chronologies.deleteSuccess'));
            setIsDeleteOpen(false);
            setSelected(null);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const allChronologies = chronologies ?? [];
    const activeCount = allChronologies.filter((c) => c.is_active).length;
    const totalPartners = allChronologies.reduce((s, c) => s + (c.partners_count ?? 0), 0);
    const totalPromotions = allChronologies.reduce((s, c) => s + (c.promotions_count ?? 0), 0);

    const filtered = useMemo(() => {
        let list = allChronologies;
        if (filterTab === 'active') list = list.filter((c) => c.is_active);
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
        { key: 'all', label: t('pricing.chronologies.filterAll'), count: allChronologies.length },
        { key: 'active', label: t('common.active'), count: activeCount },
        { key: 'inactive', label: t('common.inactive'), count: allChronologies.length - activeCount },
    ];

    const actions: ActionItemProps[] = [
        { icon: Plus, label: t('common.create'), variant: 'sage', onClick: openCreate },
        { icon: RefreshCw, label: t('common.refresh'), onClick: refetch, disabled: loading },
    ];

    return (
        <>
            <MasterLayout
                mainContent={
                    <div className="h-full flex flex-col bg-slate-50/60">
                        {/* Page Header */}
                        <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 shadow-sm">
                                        <Clock className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold text-gray-900">{t('pricing.chronologies.title')}</h1>
                                        <p className="text-xs text-gray-500">{t('pricing.chronologies.subtitle')}</p>
                                    </div>
                                </div>
                                {!loading && allChronologies.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-2">
                                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                                            {activeCount} {t('common.active').toLowerCase()}
                                        </span>
                                        {totalPartners > 0 && (
                                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                                {totalPartners} partenaires
                                            </span>
                                        )}
                                        {totalPromotions > 0 && (
                                            <span className="text-xs font-medium text-purple-600 bg-purple-50 border border-purple-100 px-2.5 py-1 rounded-full">
                                                {totalPromotions} promotions
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filters bar */}
                        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                                {TAB_ITEMS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setFilterTab(tab.key)}
                                        className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                                            filterTab === tab.key
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        {tab.label}
                                        <span className={`text-[10px] font-bold ${filterTab === tab.key ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {tab.count}
                                        </span>
                                    </button>
                                ))}
                            </div>
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('pricing.chronologies.searchPlaceholder')}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {error ? (
                                <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2">
                                    <p className="text-sm">{error}</p>
                                    <Button variant="outline" size="sm" onClick={refetch}>
                                        <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                    </Button>
                                </div>
                            ) : loading ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
                                            <div className="h-5 w-20 bg-gray-200 rounded mb-3" />
                                            <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
                                            <div className="flex gap-1">
                                                <div className="h-5 w-14 bg-gray-100 rounded-full" />
                                                <div className="h-5 w-14 bg-gray-100 rounded-full" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-3 py-20">
                                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Clock className="w-7 h-7 text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">
                                            {search ? t('common.noResults') : t('pricing.chronologies.noChronologies')}
                                        </p>
                                        <p className="text-xs mt-1 text-gray-400">{t('pricing.chronologies.noChronologiesHint')}</p>
                                    </div>
                                    {!search && (
                                        <Button size="sm" onClick={openCreate} className="bg-indigo-600 hover:bg-indigo-700 mt-2">
                                            <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('pricing.chronologies.create')}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filtered.map((chrono) => (
                                        <ChronologyCard
                                            key={chrono.id}
                                            chrono={chrono}
                                            onEdit={openEdit}
                                            onDelete={confirmDelete}
                                            t={t}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                }
                rightContent={<ActionPanel groups={[{ items: actions }]} />}
            />

            {/* Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {selected ? t('pricing.chronologies.edit') : t('pricing.chronologies.create')}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selected ? t('pricing.chronologies.editDescription') : t('pricing.chronologies.createDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
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

                        {/* Interactive tag pills */}
                        <div className="space-y-2">
                            <Label className="text-xs font-medium flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5" />
                                {t('pricing.chronologies.tags')}
                            </Label>
                            {form.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 p-2 bg-gray-50 rounded-lg border border-gray-200 min-h-[40px]">
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
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-xs px-3 shrink-0"
                                    onClick={() => addTag(tagInput)}
                                    disabled={!tagInput.trim()}
                                >
                                    <Plus className="w-3 h-3" />
                                </Button>
                            </div>
                            <p className="text-[10px] text-gray-400">{t('pricing.chronologies.tagsHint')}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
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
                            <div className="flex items-end pb-1.5">
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

                        {selected && (selected.partners_count || 0) > 0 && (
                            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p className="text-xs">
                                    {t('pricing.chronologies.tagsEditWarning', { count: selected.partners_count })}
                                </p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                            <X className="w-4 h-4 mr-1.5" /> {t('common.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={creating || updating}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {creating || updating ? t('common.saving') : t('common.save')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-base">{t('common.delete')}</DialogTitle>
                        <DialogDescription className="text-xs">
                            {t('pricing.chronologies.deleteWarning', { name: selected?.name })}
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

// ─── Chronology Card ──────────────────────────────────────────────────────────

interface ChronologyCardProps {
    chrono: BusinessChronology;
    onEdit: (c: BusinessChronology) => void;
    onDelete: (c: BusinessChronology) => void;
    t: (key: string, opts?: any) => string;
}

function ChronologyCard({ chrono, onEdit, onDelete, t }: ChronologyCardProps) {
    const tags = chrono.available_sub_types ?? [];
    const visibleTags = tags.slice(0, 5);
    const overflow = tags.length - visibleTags.length;

    return (
        <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col">
            <div className="p-4 flex-1">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <span className="font-mono text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                        {chrono.code}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${chrono.is_active ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-gray-300'}`} />
                </div>

                {/* Name */}
                <h3 className="text-sm font-semibold text-gray-900 mb-1 leading-tight">{chrono.name}</h3>
                {chrono.description && (
                    <p className="text-xs text-gray-400 mb-2 line-clamp-1">{chrono.description}</p>
                )}

                {/* Tag pills */}
                {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {visibleTags.map((tag) => (
                            <span key={tag} className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full font-medium">
                                {tag}
                            </span>
                        ))}
                        {overflow > 0 && (
                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">+{overflow}</span>
                        )}
                    </div>
                ) : (
                    <p className="text-[11px] text-gray-400 italic mt-2">{t('pricing.chronologies.noTags')}</p>
                )}

                {/* Counts */}
                <div className="flex items-center gap-2 mt-3">
                    {(chrono.partners_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <Users className="w-3 h-3" /> {chrono.partners_count}
                        </span>
                    )}
                    {(chrono.promotions_count ?? 0) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-purple-600">
                            <Megaphone className="w-3 h-3" /> {chrono.promotions_count}
                        </span>
                    )}
                    <Badge variant={chrono.is_active ? 'success' : 'secondary'} className="text-[10px] ml-auto">
                        {chrono.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
                <span className="text-[10px] text-gray-400">
                    {tags.length} {t('pricing.chronologies.tags').toLowerCase()}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(chrono)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.edit')}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(chrono)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={t('common.delete')}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
