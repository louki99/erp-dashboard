import { useMemo, useState } from 'react';
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
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
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

const ActiveBadge = ({ active }: { active: boolean }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
        {active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {active ? 'Actif' : 'Inactif'}
    </span>
);

const ResourceTab = ({ config }: { config: ResourceConfig }) => {
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
            toast.error(`Champs obligatoires : ${missing.map((f) => f.label).join(', ')}`);
            return;
        }
        const payload: any = {};
        config.fields.forEach((f) => {
            if (form[f.key] !== '' && form[f.key] !== undefined) {
                payload[f.key] = form[f.key];
            }
        });
        const toastId = toast.loading(editingId ? 'Mise à jour...' : 'Création...');
        try {
            let res;
            if (editingId) {
                res = await update(editingId, payload);
            } else {
                res = await create(payload);
            }
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || (editingId ? 'Modifié' : 'Créé'));
                setShowModal(false);
                resetForm();
                await refetch();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleDelete = async (id: any) => {
        if (!confirm('Supprimer cet élément ?')) return;
        const toastId = toast.loading('Suppression...');
        try {
            const res = await deleteItem(id);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Supprimé');
                await refetch();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleToggle = async (item: any) => {
        if (!toggle) return;
        const toastId = toast.loading('Changement de statut...');
        try {
            const res = await toggle.execute(item[config.idKey]);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Statut mis à jour');
                await refetch();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const isBusy = creating || updating || deleting || toggle?.loading;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <button
                    onClick={openCreate}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 transition-colors shadow-sm"
                >
                    <Plus className="w-3.5 h-3.5" /> Ajouter
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    Aucun élément trouvé.
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-200">
                                <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nom / Code</th>
                                {config.fields
                                    .filter((f) => f.key !== config.nameKey && f.key !== 'is_active')
                                    .map((f) => (
                                        <th key={f.key} className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">
                                            {f.label}
                                        </th>
                                    ))}
                                {config.activeKey && (
                                    <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-24">Statut</th>
                                )}
                                <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-3 w-28">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((item) => (
                                <tr key={item[config.idKey]} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center shrink-0">
                                                <config.icon className="w-4 h-4 text-sage-500" />
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{item[config.nameKey]}</div>
                                                {item.code && item[config.nameKey] !== item.code && (
                                                    <div className="text-[11px] text-gray-400 font-mono">{item.code}</div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    {config.fields
                                        .filter((f) => f.key !== config.nameKey && f.key !== 'is_active')
                                        .map((f) => (
                                            <td key={f.key} className="px-4 py-3 text-sm text-gray-700">
                                                {f.type === 'checkbox' ? (
                                                    item[f.key] ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <span className="text-gray-300">—</span>
                                                ) : f.type === 'select' ? (
                                                    f.options?.find((o) => String(o.value) === String(item[f.key]))?.label ?? item[f.key] ?? '—'
                                                ) : (
                                                    item[f.key] ?? '—'
                                                )}
                                            </td>
                                        ))}
                                    {config.activeKey && (
                                        <td className="px-4 py-3 text-center">
                                            <ActiveBadge active={!!item[config.activeKey]} />
                                        </td>
                                    )}
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            {toggle && (
                                                <button
                                                    onClick={() => handleToggle(item)}
                                                    disabled={toggle.loading}
                                                    className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                                    title="Activer / Désactiver"
                                                >
                                                    {item[config.activeKey!] ? <ToggleRight className="w-4 h-4 text-emerald-500" /> : <ToggleLeft className="w-4 h-4" />}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                                title="Modifier"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item[config.idKey])}
                                                disabled={deleting}
                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                title="Supprimer"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Dialog open={showModal} onOpenChange={(v) => !v && setShowModal(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <config.icon className="w-4 h-4 text-sage-500" />
                            {editingId ? 'Modifier' : 'Ajouter'} {config.label}
                        </DialogTitle>
                        <DialogDescription>
                            {editingId ? 'Modifiez les informations ci-dessous.' : 'Remplissez les informations pour créer un nouvel élément.'}
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
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isBusy}
                            className="px-5 py-2 text-sm bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                        >
                            {isBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                            {editingId ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const ProductMasterDataPage = () => {
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
            { id: 'brands', label: 'Marques', icon: Tag },
            { id: 'categories', label: 'Catégories', icon: FolderTree },
            { id: 'subcategories', label: 'Sous-catégories', icon: FolderTree },
            { id: 'units', label: 'Unités', icon: Ruler },
            { id: 'vat', label: 'TVA', icon: Percent },
            { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
            { id: 'sales_groups', label: 'Groupes de vente', icon: Layers },
            { id: 'pages', label: 'Pages produit', icon: FileText },
        ],
        []
    );

    const configs: Record<string, ResourceConfig> = useMemo(
        () => ({
            brands: {
                key: 'brands',
                label: 'Marque',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            categories: {
                key: 'categories',
                label: 'Catégorie',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'parent_id', label: 'Catégorie parente', type: 'select', options: categoryOptions },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            subcategories: {
                key: 'subcategories',
                label: 'Sous-catégorie',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'parent_id', label: 'Catégorie parente', type: 'select', options: categoryOptions },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            units: {
                key: 'units',
                label: 'Unité',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'allow_decimal', label: 'Décimales autorisées', type: 'checkbox' },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            vat: {
                key: 'vat',
                label: 'TVA',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'percentage', label: 'Taux (%)', type: 'number', required: true },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            suppliers: {
                key: 'suppliers',
                label: 'Fournisseur',
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
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'contact_name', label: 'Contact', type: 'text' },
                    { key: 'contact_email', label: 'Email', type: 'text' },
                    { key: 'phone', label: 'Téléphone', type: 'text' },
                    { key: 'address', label: 'Adresse', type: 'text' },
                ],
            },
            sales_groups: {
                key: 'sales_groups',
                label: 'Groupe de vente',
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
                    { key: 'code', label: 'Code', type: 'text', required: true },
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'is_active', label: 'Actif', type: 'checkbox' },
                ],
            },
            pages: {
                key: 'pages',
                label: 'Page produit',
                icon: FileText,
                idKey: 'code',
                nameKey: 'name',
                activeKey: 'is_salable',
                useList: useProductPagesList,
                useCreate: useCreateProductPage,
                useUpdate: useUpdateProductPage,
                useDelete: useDeleteProductPage,
                fields: [
                    { key: 'code', label: 'Code', type: 'text', required: true },
                    { key: 'name', label: 'Nom', type: 'text', required: true },
                    { key: 'rank', label: 'Rang', type: 'number' },
                    { key: 'parent_id', label: 'Page parente', type: 'select', options: pageOptions },
                    { key: 'is_salable', label: 'Vendable', type: 'checkbox' },
                ],
            },
        }),
        [categoryOptions, pageOptions]
    );

    const activeConfig = configs[activeTab];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                        <h1 className="text-sm font-bold text-gray-900">Données de base</h1>
                        <p className="text-[11px] text-gray-400 mt-0.5">Gestion des référentiels produits</p>
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
                                <p className="text-xs text-gray-400">Gérez les {activeConfig.label.toLowerCase()}s du référentiel produit.</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6">
                        <ResourceTab key={activeTab} config={activeConfig} />
                    </div>
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                { icon: RefreshCw, label: 'Actualiser', variant: 'sage', onClick: () => { refetchCategories(); refetchPages(); } },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
