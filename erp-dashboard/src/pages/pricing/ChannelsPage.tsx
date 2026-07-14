import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Radio, Plus, Edit2, Trash2, RefreshCw, X, Search, Users, DollarSign,
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
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const allChannels = channels ?? [];
    const activeCount = allChannels.filter((c) => c.is_active).length;
    const inactiveCount = allChannels.length - activeCount;
    const totalPartners = allChannels.reduce((s, c) => s + (c.partners_count ?? 0), 0);

    const filtered = useMemo(() => {
        let list = allChannels;
        if (filterTab === 'active') list = list.filter((c) => c.is_active);
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
        { key: 'all', label: t('pricing.channels.filterAll'), count: allChannels.length },
        { key: 'active', label: t('common.active'), count: activeCount },
        { key: 'inactive', label: t('common.inactive'), count: inactiveCount },
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
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-100 text-sage-700 shadow-sm">
                                        <Radio className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h1 className="text-lg font-bold text-gray-900">{t('pricing.channels.title')}</h1>
                                        <p className="text-xs text-gray-500">{t('pricing.channels.subtitle')}</p>
                                    </div>
                                </div>
                                {/* Stats chips */}
                                {!loading && allChannels.length > 0 && (
                                    <div className="hidden sm:flex items-center gap-2">
                                        <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                                            {activeCount} {t('common.active').toLowerCase()}
                                        </span>
                                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                                            {totalPartners} {t('pricing.channels.partnersCount').toLowerCase()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Filters bar */}
                        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3 shrink-0">
                            {/* Tab switcher */}
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
                            {/* Search */}
                            <div className="relative flex-1 max-w-xs">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder={t('pricing.channels.searchPlaceholder')}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-400"
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
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="h-5 w-16 bg-gray-200 rounded" />
                                                <div className="w-2 h-2 rounded-full bg-gray-200" />
                                            </div>
                                            <div className="h-4 w-3/4 bg-gray-200 rounded mb-2" />
                                            <div className="h-3 w-1/2 bg-gray-100 rounded" />
                                        </div>
                                    ))}
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 gap-3 py-20">
                                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
                                        <Radio className="w-7 h-7 text-gray-300" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">
                                            {search ? t('common.noResults') : t('pricing.channels.noChannels')}
                                        </p>
                                        <p className="text-xs mt-1 text-gray-400">{t('pricing.channels.noChannelsHint')}</p>
                                    </div>
                                    {!search && (
                                        <Button size="sm" onClick={openCreate} className="bg-sage-600 hover:bg-sage-700 mt-2">
                                            <Plus className="w-3.5 h-3.5 mr-1.5" /> {t('pricing.channels.create')}
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filtered.map((channel) => (
                                        <ChannelCard
                                            key={channel.id}
                                            channel={channel}
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

// ─── Channel Card Component ───────────────────────────────────────────────────

interface ChannelCardProps {
    channel: Channel;
    onEdit: (c: Channel) => void;
    onDelete: (c: Channel) => void;
    t: (key: string, opts?: any) => string;
}

function ChannelCard({ channel, onEdit, onDelete, t }: ChannelCardProps) {
    return (
        <div className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-sage-200 transition-all flex flex-col">
            <div className="p-4 flex-1">
                {/* Header row */}
                <div className="flex items-start justify-between mb-3">
                    <span className="font-mono text-xs font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">
                        {channel.code}
                    </span>
                    <span className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${channel.is_active ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.5)]' : 'bg-gray-300'}`} />
                </div>

                {/* Name */}
                <h3 className="text-sm font-semibold text-gray-900 mb-1 leading-tight">{channel.name}</h3>

                {/* Description */}
                {channel.description && (
                    <p className="text-xs text-gray-400 mb-3 line-clamp-2">{channel.description}</p>
                )}

                {/* Meta badges */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                    <Badge
                        variant={channel.is_active ? 'success' : 'secondary'}
                        className="text-[10px]"
                    >
                        {channel.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                    {channel.price_list && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                            <DollarSign className="w-2.5 h-2.5" />
                            {channel.price_list.code}
                        </Badge>
                    )}
                    {(channel.partners_count ?? 0) > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                            <Users className="w-2.5 h-2.5" />
                            {channel.partners_count}
                        </Badge>
                    )}
                </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-b-xl">
                <span className="text-[10px] text-gray-400">
                    {t('pricing.channels.sortOrder')}: {channel.sort_order ?? 0}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={() => onEdit(channel)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={t('common.edit')}
                    >
                        <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => onDelete(channel)}
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
