import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Radio,
    Plus,
    Edit2,
    Trash2,
    RefreshCw,
    X,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/common/SearchableSelect';

import {
    useChannels,
    useCreateChannel,
    useUpdateChannel,
    useDeleteChannel,
} from '@/hooks/pricing/usePricing';
import { getPartnerFormMasterData } from '@/services/api/partnerApi';
import type { Channel } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

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

    const [form, setForm] = useState<{
        code: string;
        name: string;
        description: string;
        price_list_id: string;
        is_active: boolean;
        sort_order: string;
    }>({
        code: '',
        name: '',
        description: '',
        price_list_id: '',
        is_active: true,
        sort_order: '0',
    });

    const loadPriceLists = useCallback(async () => {
        setPriceListsLoading(true);
        try {
            const md = await getPartnerFormMasterData();
            // Le doc module 20 annonce la clé `priceLists`, l'ancien contrat exposait `price_lists`.
            setPriceLists((md as any).priceLists ?? md.price_lists ?? []);
        } catch {
            toast.error(t('pricing.channels.priceListsLoadError'));
        } finally {
            setPriceListsLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadPriceLists();
    }, [loadPriceLists]);

    const priceListOptions = useMemo(() =>
        priceLists.map((pl) => ({ value: pl.id, label: `${pl.code} — ${pl.name}` })),
        [priceLists]
    );

    const resetForm = () => {
        setForm({ code: '', name: '', description: '', price_list_id: '', is_active: true, sort_order: '0' });
        setSelected(null);
    };

    const openCreate = () => {
        resetForm();
        setIsFormOpen(true);
    };

    const openEdit = (channel: Channel) => {
        setSelected(channel);
        setForm({
            code: channel.code,
            name: channel.name,
            description: channel.description ?? '',
            price_list_id: channel.price_list_id?.toString() ?? '',
            is_active: channel.is_active,
            sort_order: channel.sort_order?.toString() ?? '0',
        });
        setIsFormOpen(true);
    };

    const confirmDelete = (channel: Channel) => {
        setSelected(channel);
        setIsDeleteOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error(t('pricing.channels.codeAndNameRequired'));
            return;
        }
        const payload = {
            code: form.code.trim(),
            name: form.name.trim(),
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

    type ChannelCellParams = { value: unknown; data?: Channel };
    type ChannelDataParams = { data?: Channel };

    const columnDefs = useMemo(
        () => [
            {
                field: 'code',
                headerName: t('common.code'),
                minWidth: 100,
                cellRenderer: (params: ChannelCellParams) => (
                    <span className="font-mono text-xs font-medium text-gray-700">{String(params.value ?? '')}</span>
                ),
            },
            { field: 'name', headerName: t('common.name'), minWidth: 160 },
            {
                field: 'price_list',
                headerName: t('pricing.channels.priceList'),
                minWidth: 160,
                valueGetter: (params: ChannelDataParams) => {
                    const pl = (params.data as Channel | undefined)?.price_list;
                    return pl ? `${pl.code} — ${pl.name}` : null;
                },
                cellRenderer: (params: ChannelCellParams) =>
                    params.value ? (
                        <Badge variant="outline" className="text-[10px]">{String(params.value)}</Badge>
                    ) : (
                        <span className="text-xs text-gray-400">—</span>
                    ),
            },
            {
                field: 'partners_count',
                headerName: t('pricing.channels.partnersCount'),
                minWidth: 120,
                cellRenderer: (params: ChannelCellParams) => (
                    <span className="text-xs font-medium">{Number(params.value ?? 0)}</span>
                ),
            },
            {
                field: 'is_active',
                headerName: t('common.status'),
                minWidth: 100,
                cellRenderer: (params: ChannelCellParams) =>
                    params.value ? (
                        <Badge variant="success" className="text-[10px]">{t('common.active')}</Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px]">{t('common.inactive')}</Badge>
                    ),
            },
            {
                field: 'sort_order',
                headerName: t('pricing.channels.sortOrder'),
                minWidth: 90,
                cellRenderer: (params: ChannelCellParams) => (
                    <span className="text-xs text-gray-500">{Number(params.value ?? 0)}</span>
                ),
            },
            {
                headerName: t('common.actions'),
                minWidth: 120,
                sortable: false,
                filter: false,
                cellRenderer: (params: ChannelDataParams) => {
                    const channel = params.data as Channel;
                    return (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => openEdit(channel)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('common.edit')}
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => confirmDelete(channel)}
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
        { icon: Plus, label: t('common.create'), variant: 'sage', onClick: openCreate },
        { icon: RefreshCw, label: t('common.refresh'), onClick: refetch, disabled: loading },
    ];

    return (
        <>
            <MasterLayout
                mainContent={
                    <div className="h-full flex flex-col bg-slate-50/60">
                        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                                    <Radio className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900">{t('pricing.channels.title')}</h1>
                                    <p className="text-xs text-gray-500">{t('pricing.channels.subtitle')}</p>
                                </div>
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
                                <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <DataGrid
                                        rowData={channels ?? []}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        pagination
                                        paginationPageSize={20}
                                        suppressAutoFit
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                }
                rightContent={<ActionPanel groups={[{ items: actions }]} />}
            />

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
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="GROS"
                                    className="h-9 text-sm font-mono"
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
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
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
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={deleting}
                        >
                            {deleting ? t('common.deleting') : t('common.delete')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
