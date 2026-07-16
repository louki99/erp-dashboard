import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Radio, Plus, Edit2, Trash2, RefreshCw, X, Search, Users, DollarSign,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { Button } from '@/components/ui/button';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SearchableSelect from '@/components/common/SearchableSelect';

import {
    useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel,
} from '@/hooks/pricing/usePricing';
import { getPartnerFormMasterData } from '@/services/api/partnerApi';
import type { Channel } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

type FilterTab = 'all' | 'active' | 'inactive';

export function ChannelsPage() {
    const { t } = useTranslation();
    const { data: channels, loading, error, refetch } = useChannels();
    const { createChannel, loading: creating } = useCreateChannel();
    const { updateChannel, loading: updating } = useUpdateChannel();
    const { deleteChannel, loading: deleting } = useDeleteChannel();

    // Detail view selection (separate from modal target)
    const [viewSelected, setViewSelected] = useState<Channel | null>(null);
    // Modal context
    const [selected, setSelected] = useState<Channel | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [priceLists, setPriceLists] = useState<{ id: number; code: string; name: string }[]>([]);
    const [priceListsLoading, setPriceListsLoading] = useState(false);
    const [filterTab, setFilterTab] = useState<FilterTab>('all');
    const [search, setSearch] = useState('');

    const [form, setForm] = useState<{
        code: string; name: string; description: string;
        price_list_id: string; is_active: boolean; sort_order: string;
    }>({ code: '', name: '', description: '', price_list_id: '', is_active: true, sort_order: '0' });

    // Keep viewSelected in sync with fresh channel data after refetch
    useEffect(() => {
        setViewSelected(prev => {
            if (!prev) return prev;
            const fresh = (channels ?? []).find(c => c.id === prev.id);
            return fresh ?? null;
        });
    }, [channels]);

    const loadPriceLists = useCallback(async () => {
        setPriceListsLoading(true);
        try {
            const md = await getPartnerFormMasterData();
            setPriceLists((md as any).priceLists ?? md.price_lists ?? []);
        } catch {
            toast.error(t('pricing.channels.priceListsLoadError'));
        } finally {
            setPriceListsLoading(false);
        }
    }, [t]);

    useEffect(() => { loadPriceLists(); }, [loadPriceLists]);

    const priceListOptions = useMemo(
        () => priceLists.map((pl) => ({ value: pl.id, label: `${pl.code} — ${pl.name}` })),
        [priceLists]
    );

    const resetForm = () => {
        setForm({ code: '', name: '', description: '', price_list_id: '', is_active: true, sort_order: '0' });
        setSelected(null);
    };

    const openCreate = () => { resetForm(); setIsFormOpen(true); };

    const openEdit = (channel: Channel) => {
        setSelected(channel);
        setForm({
            code: channel.code, name: channel.name,
            description: channel.description ?? '',
            price_list_id: channel.price_list_id?.toString() ?? '',
            is_active: channel.is_active,
            sort_order: channel.sort_order?.toString() ?? '0',
        });
        setIsFormOpen(true);
    };

    const confirmDelete = (channel: Channel) => { setSelected(channel); setIsDeleteOpen(true); };

    const handleSubmit = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error(t('pricing.channels.codeAndNameRequired'));
            return;
        }
        const payload = {
            code: form.code.trim(), name: form.name.trim(),
            description: form.description.trim() || null,
            price_list_id: form.price_list_id ? Number(form.price_list_id) : null,
            is_active: form.is_active,
            sort_order: Number(form.sort_order) || 0,
        };
        try {
            if (selected) {
                await updateChannel({ id: selected.id, data: payload });
                toast.success(t('pricing.channels.updateSuccess'));
            } else {
                await createChannel(payload);
                toast.success(t('pricing.channels.createSuccess'));
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
            await deleteChannel(selected.id);
            toast.success(t('pricing.channels.deleteSuccess'));
            setIsDeleteOpen(false);
            setSelected(null);
            refetch(); // useEffect above will clear viewSelected if channel was deleted
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const allChannels = channels ?? [];
    const activeCount  = allChannels.filter((c) => c.is_active).length;
    const inactiveCount = allChannels.length - activeCount;
    const totalPartners = allChannels.reduce((s, c) => s + (c.partners_count ?? 0), 0);

    const filtered = useMemo(() => {
        let list = allChannels;
        if (filterTab === 'active')   list = list.filter((c) => c.is_active);
        if (filterTab === 'inactive') list = list.filter((c) => !c.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((c) =>
                c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }, [allChannels, filterTab, search]);

    const TAB_ITEMS: { key: FilterTab; label: string; count: number }[] = [
        { key: 'all',      label: t('pricing.channels.filterAll'), count: allChannels.length },
        { key: 'active',   label: t('common.active'),              count: activeCount },
        { key: 'inactive', label: t('common.inactive'),            count: inactiveCount },
    ];

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus,      label: t('pricing.channels.create'), variant: 'sage',    onClick: openCreate },
            { icon: RefreshCw, label: t('common.refresh'),           variant: 'default', onClick: refetch, disabled: loading },
        ];
        if (viewSelected) {
            return [
                { items: base },
                { items: [
                    { icon: Edit2,  label: t('common.edit'),   variant: 'default', onClick: () => openEdit(viewSelected) },
                    { icon: Trash2, label: t('common.delete'), variant: 'danger',  onClick: () => confirmDelete(viewSelected) },
                ]},
            ];
        }
        return [{ items: base }];
    }, [viewSelected, loading, t]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* Header */}
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Radio className="w-4 h-4 text-sage-600" />
                                    <h2 className="text-sm font-bold text-gray-900">{t('pricing.channels.title')}</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                        {allChannels.length}
                                    </span>
                                </div>
                                {!loading && allChannels.length > 0 && (
                                    <span className="text-[10px] text-gray-400">
                                        {totalPartners} partenaires
                                    </span>
                                )}
                            </div>

                            {/* Filter tabs */}
                            <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-1 mb-2">
                                {TAB_ITEMS.map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setFilterTab(tab.key)}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 text-[11px] font-medium rounded-md transition-all ${
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

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('pricing.channels.searchPlaceholder')}
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70 transition-all"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Channel list */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {loading ? (
                                <div className="p-3 space-y-2">
                                    {Array.from({ length: 6 }).map((_, i) => (
                                        <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2 p-4">
                                    <Radio className="w-8 h-8 opacity-30" />
                                    <p className="text-xs text-center">{search ? t('common.noResults') : t('pricing.channels.noChannels')}</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {filtered.map((channel) => {
                                        const isActive = viewSelected?.id === channel.id;
                                        return (
                                            <button
                                                key={channel.id}
                                                onClick={() => setViewSelected(channel)}
                                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${
                                                    isActive
                                                        ? 'bg-sage-600 text-white border-sage-600 shadow-sm'
                                                        : 'bg-white hover:bg-gray-50 border-gray-100 hover:border-sage-200'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-1">
                                                    <span className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                                                        isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                        {channel.code}
                                                    </span>
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${
                                                        channel.is_active
                                                            ? (isActive ? 'bg-emerald-300' : 'bg-emerald-400')
                                                            : (isActive ? 'bg-white/30' : 'bg-gray-300')
                                                    }`} />
                                                </div>
                                                <p className={`text-xs font-medium truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>
                                                    {channel.name}
                                                </p>
                                                {(channel.partners_count ?? 0) > 0 && (
                                                    <p className={`text-[10px] mt-0.5 flex items-center gap-1 ${isActive ? 'text-sage-200' : 'text-gray-400'}`}>
                                                        <Users className="w-2.5 h-2.5" />
                                                        {channel.partners_count} partenaire{channel.partners_count !== 1 ? 's' : ''}
                                                    </p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                }
                mainContent={
                    <PricingPageShell
                        title={t('pricing.channels.title')}
                        subtitle={t('pricing.channels.subtitle')}
                        badge={
                            !loading && allChannels.length > 0 ? (
                                <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                    {activeCount} {t('common.active').toLowerCase()}
                                </span>
                            ) : undefined
                        }
                    >
                        {error ? (
                            <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2">
                                <p className="text-sm">{error}</p>
                                <Button variant="outline" size="sm" onClick={refetch}>
                                    <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                </Button>
                            </div>
                        ) : viewSelected ? (
                            <div className="h-full flex flex-col overflow-hidden">
                                {/* Channel detail header */}
                                <div className="px-6 py-5 border-b border-gray-200 bg-white shrink-0">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white text-lg font-bold shadow-sm shrink-0">
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
                                                <span className="font-mono font-semibold text-gray-600">{viewSelected.code}</span>
                                                <span className="text-gray-200">·</span>
                                                <span>{t('pricing.channels.sortOrder')}: {viewSelected.sort_order ?? 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Channel detail content */}
                                <div className="flex-1 overflow-y-auto p-6">
                                    <div className="max-w-2xl space-y-4">
                                        {viewSelected.description && (
                                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('common.description')}
                                                </p>
                                                <p className="text-sm text-gray-700">{viewSelected.description}</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white rounded-xl border border-gray-200 p-5">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('pricing.channels.priceList')}
                                                </p>
                                                {viewSelected.price_list ? (
                                                    <div>
                                                        <div className="flex items-center gap-1.5 mb-0.5">
                                                            <DollarSign className="w-3.5 h-3.5 text-sage-500" />
                                                            <span className="font-mono text-sm font-bold text-sage-700">
                                                                {viewSelected.price_list.code}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-500">{viewSelected.price_list.name}</p>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-300">—</p>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('pricing.channels.partnersCount')}
                                                </p>
                                                <div className="flex items-center justify-center gap-2">
                                                    <Users className="w-4 h-4 text-sage-500" />
                                                    <span className="text-2xl font-bold text-gray-900">
                                                        {viewSelected.partners_count ?? 0}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                    <Radio className="w-10 h-10 text-gray-200" />
                                </div>
                                <div className="text-center">
                                    <h3 className="text-base font-semibold text-gray-800">
                                        {allChannels.length === 0 ? t('pricing.channels.noChannels') : 'Sélectionner un canal'}
                                    </h3>
                                    <p className="text-sm text-gray-400 mt-1 max-w-xs">
                                        {allChannels.length === 0
                                            ? t('pricing.channels.noChannelsHint')
                                            : 'Cliquez sur un canal dans la liste pour voir ses détails.'}
                                    </p>
                                </div>
                                {allChannels.length === 0 && (
                                    <Button size="sm" onClick={openCreate} className="bg-sage-600 hover:bg-sage-700">
                                        <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('pricing.channels.create')}
                                    </Button>
                                )}
                            </div>
                        )}
                    </PricingPageShell>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">
                            {selected ? t('pricing.channels.edit') : t('pricing.channels.create')}
                        </DialogTitle>
                        <DialogDescription className="text-xs">
                            {selected ? t('pricing.channels.editDescription') : t('pricing.channels.createDescription')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">{t('common.code')} *</Label>
                                <Input
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                                    placeholder="GROS"
                                    className="h-9 text-sm font-mono uppercase"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">{t('common.name')} *</Label>
                                <Input
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Grossistes"
                                    className="h-9 text-sm"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('common.description')}</Label>
                            <Input
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder={t('pricing.channels.descriptionPlaceholder')}
                                className="h-9 text-sm"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">{t('pricing.channels.priceList')}</Label>
                                <SearchableSelect
                                    options={priceListOptions}
                                    value={form.price_list_id ? Number(form.price_list_id) : null}
                                    onChange={(val) => setForm({ ...form, price_list_id: val?.toString() ?? '' })}
                                    placeholder={priceListsLoading ? t('common.loading') : t('common.selectPlaceholder')}
                                    clearable
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">{t('pricing.channels.sortOrder')}</Label>
                                <Input
                                    type="number"
                                    value={form.sort_order}
                                    onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                                    className="h-9 text-sm"
                                    min="0"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <Checkbox
                                id="channel-active"
                                checked={form.is_active}
                                onCheckedChange={(checked) => setForm({ ...form, is_active: Boolean(checked) })}
                            />
                            <Label htmlFor="channel-active" className="text-xs font-medium cursor-pointer">
                                {t('common.active')}
                            </Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsFormOpen(false)}>
                            <X className="w-4 h-4 mr-1.5" /> {t('common.cancel')}
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={creating || updating || priceListsLoading}
                            className="bg-sage-600 hover:bg-sage-700"
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
                            {t('pricing.channels.deleteWarning', { name: selected?.name })}
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
