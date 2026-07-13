import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Clock,
    Plus,
    Edit2,
    Trash2,
    RefreshCw,
    X,
    AlertTriangle,
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

import {
    useBusinessChronologies,
    useCreateBusinessChronology,
    useUpdateBusinessChronology,
    useDeleteBusinessChronology,
} from '@/hooks/pricing/usePricing';
import type { BusinessChronology } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function parseTags(raw: string): string[] {
    return raw
        .split(/[,\n]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
}

export function BusinessChronologiesPage() {
    const { t } = useTranslation();
    const { data: chronologies, loading, error, refetch } = useBusinessChronologies();
    const { createBusinessChronology, loading: creating } = useCreateBusinessChronology();
    const { updateBusinessChronology, loading: updating } = useUpdateBusinessChronology();
    const { deleteBusinessChronology, loading: deleting } = useDeleteBusinessChronology();

    const [selected, setSelected] = useState<BusinessChronology | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    const [form, setForm] = useState<{
        code: string;
        name: string;
        description: string;
        tags: string;
        is_active: boolean;
        sort_order: string;
    }>({
        code: '',
        name: '',
        description: '',
        tags: '',
        is_active: true,
        sort_order: '0',
    });

    const resetForm = () => {
        setForm({ code: '', name: '', description: '', tags: '', is_active: true, sort_order: '0' });
        setSelected(null);
    };

    const openCreate = () => {
        resetForm();
        setIsFormOpen(true);
    };

    const openEdit = (chronology: BusinessChronology) => {
        setSelected(chronology);
        setForm({
            code: chronology.code,
            name: chronology.name,
            description: chronology.description ?? '',
            tags: (chronology.available_sub_types || []).join(', '),
            is_active: chronology.is_active,
            sort_order: chronology.sort_order?.toString() ?? '0',
        });
        setIsFormOpen(true);
    };

    const confirmDelete = (chronology: BusinessChronology) => {
        setSelected(chronology);
        setIsDeleteOpen(true);
    };

    const handleSubmit = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error(t('pricing.chronologies.codeAndNameRequired'));
            return;
        }
        const payload = {
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description.trim() || null,
            available_sub_types: parseTags(form.tags),
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

    type ChronoCellParams = { value: unknown; data?: BusinessChronology };

    const columnDefs = useMemo(
        () => [
            {
                field: 'code',
                headerName: t('common.code'),
                minWidth: 110,
                cellRenderer: (params: ChronoCellParams) => (
                    <span className="font-mono text-xs font-medium text-gray-700">{String(params.value ?? '')}</span>
                ),
            },
            { field: 'name', headerName: t('common.name'), minWidth: 160 },
            {
                field: 'available_sub_types',
                headerName: t('pricing.chronologies.tags'),
                minWidth: 260,
                cellRenderer: (params: ChronoCellParams) => {
                    const tags: string[] = Array.isArray(params.value) ? params.value : [];
                    if (tags.length === 0) return <span className="text-xs text-gray-400">—</span>;
                    return (
                        <div className="flex flex-wrap gap-1 py-1">
                            {tags.slice(0, 6).map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                                    {tag}
                                </Badge>
                            ))}
                            {tags.length > 6 && (
                                <Badge variant="outline" className="text-[10px]">+{tags.length - 6}</Badge>
                            )}
                        </div>
                    );
                },
            },
            {
                field: 'partners_count',
                headerName: t('pricing.chronologies.partnersCount'),
                minWidth: 120,
                cellRenderer: (params: ChronoCellParams) => (
                    <span className="text-xs font-medium">{Number(params.value ?? 0)}</span>
                ),
            },
            {
                field: 'promotions_count',
                headerName: t('pricing.chronologies.promotionsCount'),
                minWidth: 120,
                cellRenderer: (params: ChronoCellParams) => (
                    <span className="text-xs font-medium">{Number(params.value ?? 0)}</span>
                ),
            },
            {
                field: 'is_active',
                headerName: t('common.status'),
                minWidth: 100,
                cellRenderer: (params: ChronoCellParams) =>
                    params.value ? (
                        <Badge variant="success" className="text-[10px]">{t('common.active')}</Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px]">{t('common.inactive')}</Badge>
                    ),
            },
            {
                field: 'sort_order',
                headerName: t('pricing.chronologies.sortOrder'),
                minWidth: 90,
                cellRenderer: (params: ChronoCellParams) => (
                    <span className="text-xs text-gray-500">{Number(params.value ?? 0)}</span>
                ),
            },
            {
                headerName: t('common.actions'),
                minWidth: 120,
                sortable: false,
                filter: false,
                cellRenderer: (params: ChronoCellParams) => {
                    const chronology = params.data as BusinessChronology;
                    return (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => openEdit(chronology)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('common.edit')}
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => confirmDelete(chronology)}
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
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                                    <Clock className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold text-gray-900">{t('pricing.chronologies.title')}</h1>
                                    <p className="text-xs text-gray-500">{t('pricing.chronologies.subtitle')}</p>
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
                                        rowData={chronologies ?? []}
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
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="SNACK"
                                    className="h-9 text-sm font-mono"
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
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium">{t('pricing.chronologies.tags')} *</Label>
                            <textarea
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                                placeholder={t('pricing.chronologies.tagsPlaceholder')}
                                className="w-full min-h-[80px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-400 resize-y"
                            />
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
                                />
                            </div>
                        </div>
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
                        {selected && (selected.partners_count || 0) > 0 && (
                            <div className="flex items-start gap-2 text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                <p className="text-xs">{t('pricing.chronologies.tagsEditWarning', { count: selected.partners_count })}</p>
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
                            {t('pricing.chronologies.deleteWarning', { name: selected?.name })}
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
