import { useMemo, useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
    Database,
    Search,
    Plus,
    Edit,
    Trash2,
    RefreshCw,
    CheckCircle2,
    XCircle,
    ToggleRight,
    ToggleLeft,
    Loader2,
    Tag,
    FolderTree,
    Ruler,
    Percent,
    Truck,
    Layers,
    FileText,
    ImagePlus,
    X,
    Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { productsApi } from '@/services/api/productsApi';
import type { ProductPage } from '@/types/product.types';
import type { TabItem } from '@/components/common/SageTabs';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    useBrands,
    useCreateBrand,
    useUpdateBrand,
    useDeleteBrand,
    useToggleBrand,
    useCategories,
    useCreateCategory,
    useUpdateCategory,
    useDeleteCategory,
    useToggleCategory,
    useSubcategories,
    useCreateSubcategory,
    useUpdateSubcategory,
    useDeleteSubcategory,
    useToggleSubcategory,
    useUnits,
    useCreateUnit,
    useUpdateUnit,
    useDeleteUnit,
    useToggleUnit,
    useVatTaxes,
    useCreateVatTax,
    useUpdateVatTax,
    useDeleteVatTax,
    useToggleVatTax,
    useSuppliersList,
    useCreateSupplier,
    useUpdateSupplier,
    useDeleteSupplier,
    useToggleSupplier,
    useProductSalesGroupsList,
    useCreateProductSalesGroup,
    useUpdateProductSalesGroup,
    useDeleteProductSalesGroup,
    useToggleProductSalesGroup,
    useProductPagesList,
    useCreateProductPage,
    useUpdateProductPage,
    useDeleteProductPage,
} from '@/hooks/products/useProductMasterData';

type FieldType = 'text' | 'number' | 'checkbox' | 'select';

interface FormField {
    key: string;
    label: string;
    type: FieldType;
    required?: boolean;
    options?: { value: string | number; label: string }[];
}

interface ResourceConfig {
    key: string;
    label: string;
    icon: LucideIcon;
    idKey: string;
    nameKey: string;
    activeKey?: string;
    useList: () => { data: any[]; loading: boolean; refetch: () => void };
    useCreate: () => { execute: (payload: any) => Promise<any>; loading: boolean };
    useUpdate: () => { execute: (id: any, payload: any) => Promise<any>; loading: boolean };
    useDelete: () => { execute: (id: any) => Promise<any>; loading: boolean };
    useToggle?: () => { execute: (id: any) => Promise<any>; loading: boolean };
    fields: FormField[];
}

const ActiveBadge = ({ active }: { active: boolean }) => {
    const { t } = useTranslation();
    return (
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? 'text-emerald-600' : 'text-gray-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            {active ? t('common.active') : t('common.inactive')}
        </span>
    );
};

const ResourceTab = ({ config }: { config: ResourceConfig }) => {
    const { t } = useTranslation();
    const { data: items, loading, refetch } = config.useList();
    const { execute: create, loading: creating } = config.useCreate();
    const { execute: update, loading: updating } = config.useUpdate();
    const { execute: deleteItem, loading: deleting } = config.useDelete();
    const toggle = config.useToggle ? config.useToggle() : null;

    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<any>(null);
    const [form, setForm] = useState<Record<string, any>>({});

    const filtered = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter((it) => (it[config.nameKey] ?? '').toString().toLowerCase().includes(q));
    }, [items, search, config.nameKey]);

    const resetForm = () => {
        setForm({});
        setEditingId(null);
    };

    const openCreate = () => {
        const initial: Record<string, any> = {};
        config.fields.forEach((f) => {
            if (f.type === 'checkbox') initial[f.key] = true;
            else if (f.type === 'number') initial[f.key] = '';
            else initial[f.key] = '';
        });
        setForm(initial);
        setEditingId(null);
        setShowModal(true);
    };

    const openEdit = (item: any) => {
        const initial: Record<string, any> = {};
        config.fields.forEach((f) => {
            initial[f.key] = item[f.key];
            if (f.type === 'checkbox' && initial[f.key] === undefined) initial[f.key] = false;
        });
        setForm(initial);
        setEditingId(item[config.idKey]);
        setShowModal(true);
    };

    const handleSave = async () => {
        const missing = config.fields.filter((f) => f.required && (form[f.key] === '' || form[f.key] == null));
        if (missing.length > 0) {
            toast.error(`${t('products.masterData.requiredFields')} : ${missing.map((f) => f.label).join(', ')}`);
            return;
        }
        const payload: any = {};
        config.fields.forEach((f) => {
            if (form[f.key] !== '' && form[f.key] !== undefined) {
                payload[f.key] = form[f.key];
            }
        });
        const toastId = toast.loading(editingId ? t('products.masterData.updating') : t('products.masterData.creating'));
        try {
            let res;
            if (editingId) {
                res = await update(editingId, payload);
            } else {
                res = await create(payload);
            }
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || (editingId ? t('products.masterData.updated') : t('products.masterData.created')));
                setShowModal(false);
                resetForm();
                await refetch();
            } else {
                toast.error(res.message || t('errors.generic'));
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || t('errors.generic'));
        }
    };

    const handleDelete = async (id: any) => {
        if (!confirm(t('products.masterData.deleteConfirm'))) return;
        const toastId = toast.loading(t('products.masterData.deleting'));
        try {
            const res = await deleteItem(id);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || t('products.masterData.deleted'));
                await refetch();
            } else {
                toast.error(res.message || t('errors.generic'));
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || t('errors.generic'));
        }
    };

    const handleToggle = async (item: any) => {
        if (!toggle) return;
        const toastId = toast.loading(t('common.saving'));
        try {
            const res = await toggle.execute(item[config.idKey]);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || t('products.masterData.updated'));
                await refetch();
            } else {
                toast.error(res.message || t('errors.generic'));
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || t('errors.generic'));
        }
    };

    const isBusy = creating || updating || deleting || toggle?.loading;

    // Build AG Grid column definitions from config
    const columnDefs = useMemo(() => {
        const Icon = config.icon;
        const cols: any[] = [
            {
                headerName: t('common.code'),
                field: 'code',
                width: 120,
                flex: 0,
                minWidth: 80,
                cellRenderer: (params: any) => {
                    const val = params.value;
                    if (!val || val === params.data?.[config.nameKey]) return <span className="text-gray-300">—</span>;
                    return <span className="text-xs font-mono text-gray-500">{val}</span>;
                },
            },
            {
                headerName: t('common.name'),
                field: config.nameKey,
                flex: 2,
                minWidth: 160,
                cellRenderer: (params: any) => {
                    const item = params.data;
                    if (!item) return null;
                    return (
                        <div className="flex items-center gap-2 h-full">
                            <div className="w-6 h-6 rounded-md bg-sage-50 flex items-center justify-center shrink-0">
                                <Icon className="w-3 h-3 text-sage-500" />
                            </div>
                            <span className="text-sm font-medium text-gray-900 truncate">{item[config.nameKey]}</span>
                        </div>
                    );
                },
            },
            ...config.fields
                .filter((f) => f.key !== config.nameKey && f.key !== 'is_active')
                .map((f) => ({
                    headerName: f.label,
                    field: f.key,
                    flex: 1,
                    minWidth: 110,
                    ...(f.type === 'checkbox' ? {
                        cellRenderer: (params: any) => params.value
                            ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            : <span className="text-gray-300">—</span>,
                    } : {}),
                    ...(f.type === 'select' ? {
                        valueGetter: (params: any) => {
                            const val = params.data?.[f.key];
                            return f.options?.find((o) => String(o.value) === String(val))?.label ?? val ?? '—';
                        },
                    } : {}),
                })),
            ...(config.activeKey ? [{
                headerName: t('common.status'),
                field: config.activeKey,
                width: 110,
                flex: 0,
                sortable: true,
                filter: false,
                cellRenderer: (params: any) => <ActiveBadge active={!!params.value} />,
            }] : []),
            {
                headerName: t('common.actions'),
                field: '__actions',
                width: 120,
                flex: 0,
                sortable: false,
                filter: false,
                cellRenderer: (params: any) => {
                    const item = params.data;
                    if (!item) return null;
                    return (
                        <div className="flex items-center gap-0.5 h-full">
                            {toggle && (
                                <button
                                    onClick={() => handleToggle(item)}
                                    disabled={!!toggle.loading}
                                    className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors disabled:opacity-50"
                                    title={t('common.toggle')}
                                >
                                    {item[config.activeKey!] ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                                </button>
                            )}
                            <button
                                onClick={() => openEdit(item)}
                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                title={t('common.edit')}
                            >
                                <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => handleDelete(item[config.idKey])}
                                disabled={deleting}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                title={t('common.delete')}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                },
            },
        ];
        return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [config]);

    return (
        <div className="h-full flex flex-col gap-3">
            {/* Toolbar */}
            <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder={t('common.search')}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <XCircle className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 transition-colors shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5" /> {t('common.add')}
                </button>
            </div>

            {/* DataGrid */}
            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={filtered}
                    columnDefs={columnDefs}
                    loading={loading}
                    pagination
                    paginationPageSize={25}
                    rowHeight={38}
                />
            </div>

            <Dialog open={showModal} onOpenChange={(v) => !v && setShowModal(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <config.icon className="w-4 h-4 text-sage-500" />
                            {editingId ? t('products.masterData.dialogEdit') : t('products.masterData.dialogCreate')} {config.label}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId ? t('products.masterData.editHint') : t('products.masterData.createHint')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        {config.fields.map((f) => (
                            <div key={f.key}>
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                    {f.label} {f.required && <span className="text-red-500">*</span>}
                                </label>
                                {f.type === 'select' ? (
                                    <select
                                        value={form[f.key] ?? ''}
                                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value ? (isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value)) : '' })}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                                    >
                                        <option value="">—</option>
                                        {f.options?.map((o) => (
                                            <option key={o.value} value={o.value}>{o.label}</option>
                                        ))}
                                    </select>
                                ) : f.type === 'checkbox' ? (
                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!form[f.key]}
                                            onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                        />
                                        <span className="text-gray-700">{f.label}</span>
                                    </label>
                                ) : (
                                    <input
                                        type={f.type === 'number' ? 'number' : 'text'}
                                        value={form[f.key] ?? ''}
                                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                        placeholder={f.label}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-2">
                        <button
                            onClick={() => { setShowModal(false); resetForm(); }}
                            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            {t('common.cancel')}
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isBusy}
                            className="px-5 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                        >
                            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingId ? t('common.update') : t('common.create')}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ── Image Upload Modal for Product Pages ──────────────────────────────────────

interface ImageSlot {
    field: 'logo' | 'photo';
    label: string;
    current?: string | null;
    file: File | null;
    preview: string | null;
}

interface PageImageUploadModalProps {
    page: ProductPage;
    onClose: () => void;
    onUploaded: () => void;
}

const PageImageUploadModal = ({ page, onClose, onUploaded }: PageImageUploadModalProps) => {
    const { t } = useTranslation();
    const [slots, setSlots] = useState<ImageSlot[]>([
        { field: 'logo', label: t('modules.products.logo'), current: page.logo_url, file: null, preview: null },
        { field: 'photo', label: t('modules.products.photo'), current: page.photo_url, file: null, preview: null },
    ]);
    const [uploading, setUploading] = useState(false);
    const logoRef = useRef<HTMLInputElement>(null);
    const photoRef = useRef<HTMLInputElement>(null);

    const refs = { logo: logoRef, photo: photoRef };

    const handleFile = (field: 'logo' | 'photo', file: File | null) => {
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setSlots(prev => prev.map(s => s.field === field ? { ...s, file, preview } : s));
    };

    const clearSlot = (field: 'logo' | 'photo') => {
        setSlots(prev => prev.map(s => {
            if (s.field !== field) return s;
            if (s.preview) URL.revokeObjectURL(s.preview);
            return { ...s, file: null, preview: null };
        }));
        const ref = refs[field];
        if (ref.current) ref.current.value = '';
    };

    const hasChanges = slots.some(s => s.file !== null);

    const handleUpload = async () => {
        if (!hasChanges) { toast.error(t('common.noImage')); return; }
        setUploading(true);
        const toastId = toast.loading(t('products.masterData.sending'));
        try {
            const files: { logo?: File; photo?: File } = {};
            slots.forEach(s => { if (s.file) files[s.field] = s.file; });
            const res = await productsApi.uploadProductPageImages(page.code, files);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || t('products.masterData.updated'));
                onUploaded();
                onClose();
            } else {
                toast.error(res.message || t('errors.uploadFailed'));
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || t('errors.uploadFailed'));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Images — {page.name}</h2>
                        <p className="text-xs text-gray-400 font-mono">{page.code}</p>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Slots */}
                <div className="p-5 grid grid-cols-2 gap-4">
                    {slots.map(slot => {
                        const ref = refs[slot.field];
                        const displaySrc = slot.preview ?? slot.current;
                        return (
                            <div key={slot.field} className="flex flex-col gap-2">
                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{slot.label}</span>

                                {/* Image preview box */}
                                <div
                                    className="relative group w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center cursor-pointer hover:border-sage-400 hover:bg-sage-50/30 transition-colors overflow-hidden"
                                    onClick={() => ref.current?.click()}
                                >
                                    {displaySrc ? (
                                        <>
                                            <img
                                                src={displaySrc}
                                                alt={slot.label}
                                                className="w-full h-full object-cover"
                                            />
                                            {/* Overlay on hover */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <Upload className="w-6 h-6 text-white" />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center gap-1.5 text-gray-400">
                                            <ImagePlus className="w-8 h-8" />
                                            <span className="text-xs">{t('products.masterData.clickToChoose')}</span>
                                        </div>
                                    )}
                                    {/* New file badge */}
                                    {slot.file && (
                                        <div className="absolute top-2 right-2 bg-sage-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                            {t('common.new')}
                                        </div>
                                    )}
                                </div>

                                {/* File name + clear */}
                                {slot.file ? (
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-gray-500 truncate flex-1">{slot.file.name}</span>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); clearSlot(slot.field); }}
                                            className="shrink-0 p-0.5 text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-[10px] text-gray-400 text-center">
                                        {slot.current ? t('products.masterData.currentImage') : t('products.masterData.noImage')}
                                    </span>
                                )}

                                <input
                                    ref={ref}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => handleFile(slot.field, e.target.files?.[0] ?? null)}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleUpload}
                        disabled={uploading || !hasChanges}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-40 transition-colors shadow-sm"
                    >
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        {t('common.send')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── ProductPages tab — wraps ResourceTab and injects image column + modal ──────

const ProductPagesTab = ({ config }: { config: ResourceConfig }) => {
    const { t } = useTranslation();
    const { data: pages, loading, refetch } = config.useList();
    const [imageTarget, setImageTarget] = useState<ProductPage | null>(null);

    const baseConfig: ResourceConfig = {
        ...config,
        // Inject the image column by post-processing columnDefs via a custom useList that returns pages with image URLs
        useList: () => ({ data: pages, loading, refetch }),
    };

    // Inject extra column: Images (thumbnails + upload button)
    // We achieve this by wrapping ResourceTab and then the column is added inside
    // But ResourceTab builds columnDefs internally — so instead we render a passthrough
    // with an extra injected column via a thin wrapper config override.

    const pagesWithImages = pages as ProductPage[];

    // Build columnDefs for the pages grid, including the images column
    const columnDefs = useMemo(() => [
        {
            headerName: t('common.code'),
            field: 'code',
            width: 110,
            flex: 0,
            cellRenderer: (p: any) => (
                <span className="text-xs font-mono text-gray-500">{p.value || '—'}</span>
            ),
        },
        {
            headerName: t('common.name'),
            field: 'name',
            flex: 2,
            minWidth: 160,
            cellRenderer: (p: any) => {
                const item: ProductPage = p.data;
                if (!item) return null;
                return (
                    <div className="flex items-center gap-2 h-full">
                        <div className="w-6 h-6 rounded-md bg-sage-50 flex items-center justify-center shrink-0">
                            <FileText className="w-3 h-3 text-sage-500" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-sm font-medium text-gray-900 truncate block">{item.name}</span>
                            {item.full_path && item.full_path !== item.name && (
                                <span className="text-[10px] text-gray-400 truncate block">{item.full_path}</span>
                            )}
                        </div>
                    </div>
                );
            },
        },
        {
            headerName: 'Rang',
            field: 'rank',
            width: 80,
            flex: 0,
            cellRenderer: (p: any) => <span className="text-xs text-gray-500">{p.value ?? '—'}</span>,
        },
        {
            headerName: t('products.masterData.images'),
            field: 'logo_url',
            width: 120,
            flex: 0,
            sortable: false,
            filter: false,
            cellRenderer: (p: any) => {
                const item: ProductPage = p.data;
                if (!item) return null;
                const hasLogo = !!item.logo_url;
                const hasPhoto = !!item.photo_url;
                return (
                    <div className="flex items-center gap-1.5 h-full">
                        {hasLogo ? (
                            <img src={item.logo_url!} alt="logo" className="w-6 h-6 rounded object-cover border border-gray-200" />
                        ) : (
                            <div className="w-6 h-6 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                <span className="text-[8px] text-gray-300 font-bold">L</span>
                            </div>
                        )}
                        {hasPhoto ? (
                            <img src={item.photo_url!} alt="photo" className="w-6 h-6 rounded object-cover border border-gray-200" />
                        ) : (
                            <div className="w-6 h-6 rounded border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
                                <span className="text-[8px] text-gray-300 font-bold">P</span>
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            headerName: t('common.status'),
            field: 'is_salable',
            width: 100,
            flex: 0,
            cellRenderer: (p: any) => <ActiveBadge active={!!p.value} />,
        },
        {
            headerName: t('common.actions'),
            field: '__actions',
            width: 130,
            flex: 0,
            sortable: false,
            filter: false,
            cellRenderer: (p: any) => {
                const item: ProductPage = p.data;
                if (!item) return null;
                return (
                    <div className="flex items-center gap-0.5 h-full">
                        <button
                            onClick={() => setImageTarget(item)}
                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                            title={t('products.masterData.images')}
                        >
                            <ImagePlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => {/* edit handled by ResourceTab below */}}
                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                            title={t('common.edit')}
                        >
                            <Edit className="w-3.5 h-3.5" />
                        </button>
                    </div>
                );
            },
        },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [pagesWithImages]);

    return (
        <>
            <div className="h-full flex flex-col gap-3">
                {/* Toolbar */}
                <div className="shrink-0 flex items-center gap-3">
                    <span className="text-xs text-gray-400">{pagesWithImages.length} page{pagesWithImages.length !== 1 ? 's' : ''}</span>
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <ImagePlus className="w-3 h-3" /> {t('products.masterData.manageHint')}
                        </span>
                    </div>
                </div>

                {/* DataGrid */}
                <div className="flex-1 overflow-hidden">
                    <DataGrid
                        rowData={pagesWithImages}
                        columnDefs={columnDefs}
                        loading={loading}
                        pagination
                        paginationPageSize={25}
                        rowHeight={44}
                    />
                </div>
            </div>

            {imageTarget && (
                <PageImageUploadModal
                    page={imageTarget}
                    onClose={() => setImageTarget(null)}
                    onUploaded={refetch}
                />
            )}
        </>
    );
};

export const ProductMasterDataPage = () => {
    const { t } = useTranslation();
    const { data: categories, refetch: refetchCategories } = useCategories();
    const { data: pages, refetch: refetchPages } = useProductPagesList();
    const [activeTab, setActiveTab] = useState('brands');

    const categoryOptions = useMemo(
        () => categories.map((c) => ({ value: c.id, label: c.name })),
        [categories]
    );

    const pageOptions = useMemo(
        () => pages.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        [pages]
    );

    const tabs: TabItem[] = useMemo(
        () => [
            { id: 'brands', label: t('modules.products.brands'), icon: Tag },
            { id: 'categories', label: t('modules.products.categories'), icon: FolderTree },
            { id: 'subcategories', label: t('modules.products.subcategories'), icon: FolderTree },
            { id: 'units', label: t('modules.products.units'), icon: Ruler },
            { id: 'vat', label: t('modules.products.vat'), icon: Percent },
            { id: 'suppliers', label: t('modules.products.suppliers'), icon: Truck },
            { id: 'sales_groups', label: t('modules.products.salesGroups'), icon: Layers },
            { id: 'pages', label: t('modules.products.pages'), icon: FileText },
        ],
        [t]
    );

    const configs: Record<string, ResourceConfig> = useMemo(
        () => ({
            brands: {
                key: 'brands',
                label: t('modules.products.brands'),
                icon: Tag,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useBrands,
                useCreate: useCreateBrand,
                useUpdate: useUpdateBrand,
                useDelete: useDeleteBrand,
                useToggle: useToggleBrand,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            categories: {
                key: 'categories',
                label: t('modules.products.categories'),
                icon: FolderTree,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useCategories,
                useCreate: useCreateCategory,
                useUpdate: useUpdateCategory,
                useDelete: useDeleteCategory,
                useToggle: useToggleCategory,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'parent_id', label: t('modules.products.categories'), type: 'select', options: categoryOptions },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            subcategories: {
                key: 'subcategories',
                label: t('modules.products.subcategories'),
                icon: FolderTree,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useSubcategories,
                useCreate: useCreateSubcategory,
                useUpdate: useUpdateSubcategory,
                useDelete: useDeleteSubcategory,
                useToggle: useToggleSubcategory,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'parent_id', label: t('modules.products.categories'), type: 'select', options: categoryOptions },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            units: {
                key: 'units',
                label: t('modules.products.units'),
                icon: Ruler,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useUnits,
                useCreate: useCreateUnit,
                useUpdate: useUpdateUnit,
                useDelete: useDeleteUnit,
                useToggle: useToggleUnit,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'allow_decimal', label: t('products.masterData.decimalsAllowed'), type: 'checkbox' },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            vat: {
                key: 'vat',
                label: t('modules.products.vat'),
                icon: Percent,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useVatTaxes,
                useCreate: useCreateVatTax,
                useUpdate: useUpdateVatTax,
                useDelete: useDeleteVatTax,
                useToggle: useToggleVatTax,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'percentage', label: t('products.masterData.vatRate'), type: 'number', required: true },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            suppliers: {
                key: 'suppliers',
                label: t('modules.products.suppliers'),
                icon: Truck,
                idKey: 'id',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useSuppliersList,
                useCreate: useCreateSupplier,
                useUpdate: useUpdateSupplier,
                useDelete: useDeleteSupplier,
                useToggle: useToggleSupplier,
                fields: [
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'contact_name', label: t('common.contact'), type: 'text' },
                    { key: 'contact_email', label: t('common.email'), type: 'text' },
                    { key: 'phone', label: t('common.phone'), type: 'text' },
                    { key: 'address', label: t('common.address'), type: 'text' },
                ],
            },
            sales_groups: {
                key: 'sales_groups',
                label: t('modules.products.salesGroups'),
                icon: Layers,
                idKey: 'code',
                nameKey: 'name',
                activeKey: 'is_active',
                useList: useProductSalesGroupsList,
                useCreate: useCreateProductSalesGroup,
                useUpdate: useUpdateProductSalesGroup,
                useDelete: useDeleteProductSalesGroup,
                useToggle: useToggleProductSalesGroup,
                fields: [
                    { key: 'code', label: t('common.code'), type: 'text', required: true },
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'is_active', label: t('common.active'), type: 'checkbox' },
                ],
            },
            pages: {
                key: 'pages',
                label: t('modules.products.pages'),
                icon: FileText,
                idKey: 'code',
                nameKey: 'name',
                activeKey: 'is_salable',
                useList: useProductPagesList,
                useCreate: useCreateProductPage,
                useUpdate: useUpdateProductPage,
                useDelete: useDeleteProductPage,
                fields: [
                    { key: 'code', label: t('common.code'), type: 'text', required: true },
                    { key: 'name', label: t('common.name'), type: 'text', required: true },
                    { key: 'rank', label: 'Rang', type: 'number' },
                    { key: 'parent_id', label: t('modules.products.pages'), type: 'select', options: pageOptions },
                    { key: 'is_salable', label: t('common.status'), type: 'checkbox' },
                ],
            },
        }),
        [categoryOptions, pageOptions, t]
    );

    const activeConfig = configs[activeTab];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                        <h1 className="text-sm font-bold text-gray-900">{t('products.masterData.title')}</h1>
                        <p className="text-[11px] text-gray-400 mt-0.5">{t('products.masterData.subtitle')}</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon as any;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${activeTab === tab.id ? 'bg-sage-50 text-sage-700' : 'text-gray-600 hover:bg-gray-50'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
                    <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-sage-100 flex items-center justify-center">
                                <Database className="w-5 h-5 text-sage-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">{tabs.find((t) => t.id === activeTab)?.label}</h2>
                                <p className="text-xs text-gray-400">{t('products.masterData.manageHint')}</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden p-6 flex flex-col">
                        {activeTab === 'pages'
                            ? <ProductPagesTab key="pages" config={activeConfig} />
                            : <ResourceTab key={activeTab} config={activeConfig} />
                        }
                    </div>
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                { icon: RefreshCw, label: t('common.refresh'), variant: 'sage', onClick: () => { refetchCategories(); refetchPages(); } },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
