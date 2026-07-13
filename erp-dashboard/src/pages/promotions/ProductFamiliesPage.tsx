import { useState, useEffect, useMemo, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import { productsApi } from '@/services/api/productsApi';
import type { Product } from '@/types/product.types';
import type { ProductFamily } from '@/types/promotion.types';
import {
    Package, Plus, RefreshCw, Edit, Trash2, Save, X,
    Search, Loader2, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { MasterLayout } from '@/components/layout/MasterLayout';

const ACCENT = {
    bg: 'bg-blue-600', hbg: 'hover:bg-blue-700',
    light: 'bg-blue-50', border: 'border-blue-200',
    text: 'text-blue-700', ring: 'focus:ring-blue-500 focus:border-blue-500',
    badge: 'bg-blue-100 text-blue-800',
    dot: 'bg-blue-500',
};

export const ProductFamiliesPage = () => {
    const [families, setFamilies]       = useState<ProductFamily[]>([]);
    const [loading, setLoading]         = useState(true);
    const [listSearch, setListSearch]   = useState('');
    const [selected, setSelected]       = useState<ProductFamily | null>(null);
    const [showForm, setShowForm]       = useState(false);
    const [isEditMode, setIsEditMode]   = useState(false);
    const [activeTab, setActiveTab]     = useState<'info' | 'products'>('info');
    const [formData, setFormData]       = useState<Partial<ProductFamily>>({ code: '', name: '', description: '', sales_group_code: '', products: [] });
    const [isSaving, setIsSaving]       = useState(false);

    const [showDeleteModal, setShowDeleteModal]   = useState(false);
    const [familyToDelete, setFamilyToDelete]     = useState<number | null>(null);
    const [isDeleting, setIsDeleting]             = useState(false);

    const [showProductModal, setShowProductModal] = useState(false);
    const [allProducts, setAllProducts]           = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts]   = useState(false);
    const [productSearch, setProductSearch]       = useState('');
    const [activeFilter, setActiveFilter]         = useState<'all' | 'active' | 'inactive'>('all');

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const data = await promotionsApi.getProductFamilies();
            setFamilies(data.productFamilies || []);
        } catch { toast.error('Échec du chargement des familles produits'); }
        finally { setLoading(false); }
    }, []);

    const loadAllProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            const res = await productsApi.getList({ per_page: 500 });
            const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
            setAllProducts(list);
        } catch (err) {
            console.error('Failed to load products', err);
            toast.error('Échec du chargement des produits');
        } finally { setLoadingProducts(false); }
    }, []);

    useEffect(() => { loadFamilies(); loadAllProducts(); }, [loadFamilies, loadAllProducts]);

    const visibleFamilies = useMemo(() => {
        if (!listSearch.trim()) return families;
        const q = listSearch.toLowerCase();
        return families.filter(f => f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
    }, [families, listSearch]);

    const handleCreateNew = () => {
        setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
        setIsEditMode(false); setActiveTab('info'); setShowForm(true); setSelected(null);
    };

    const handleEdit = (family: ProductFamily) => {
        const productCodes: string[] = Array.isArray(family.products)
            ? family.products.map((p: string | { product_code?: string; code?: string }) => typeof p === 'string' ? p : (p.product_code ?? p.code ?? '')).filter(Boolean)
            : [];
        setFormData({ ...family, products: productCodes });
        setIsEditMode(true); setActiveTab('info'); setShowForm(true);
    };

    const handleCancel = useCallback(() => {
        setShowForm(false);
        setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
    }, []);

    const handleSave = useCallback(async () => {
        if (!formData.code || !formData.name) { toast.error('Code et Nom sont obligatoires'); return; }
        if (formData.code.length < 2)          { toast.error('Le code doit contenir au moins 2 caractères'); return; }
        if (formData.name.length < 3)          { toast.error('Le nom doit contenir au moins 3 caractères'); return; }
        if (!isEditMode && families.some(f => f.code === formData.code)) { toast.error('Ce code existe déjà'); return; }
        setIsSaving(true);
        try {
            if (isEditMode && formData.id) {
                await promotionsApi.updateProductFamily(formData.id, formData);
                toast.success('Famille mise à jour');
            } else {
                await promotionsApi.createProductFamily(formData);
                toast.success('Famille créée');
            }
            setShowForm(false);
            setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
            await loadFamilies();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Échec de l\'opération');
        }
        finally { setIsSaving(false); }
    }, [formData, isEditMode, families, loadFamilies]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && showForm) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') {
                if (showProductModal) setShowProductModal(false);
                else if (showForm) handleCancel();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showForm, showProductModal, formData, handleSave, handleCancel]);

    const handleDeleteClick = (id: number) => { setFamilyToDelete(id); setShowDeleteModal(true); };
    const handleDeleteConfirm = async () => {
        if (!familyToDelete) return;
        setIsDeleting(true);
        try {
            await promotionsApi.deleteProductFamily(familyToDelete);
            toast.success('Famille supprimée');
            if (selected?.id === familyToDelete) setSelected(null);
            setShowDeleteModal(false); setFamilyToDelete(null);
            await loadFamilies();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Échec de la suppression');
        }
        finally { setIsDeleting(false); }
    };

    const handleToggleProduct = useCallback((code: string) => {
        const cur = [...new Set((formData.products || []) as string[])];
        setFormData({ ...formData, products: cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code] });
    }, [formData]);

    const filteredProducts = useMemo(() => {
        let list = allProducts;
        if (productSearch) { const q = productSearch.toLowerCase(); list = list.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)); }
        if (activeFilter === 'active')   list = list.filter(p => p.is_active);
        if (activeFilter === 'inactive') list = list.filter(p => !p.is_active);
        return list;
    }, [allProducts, productSearch, activeFilter]);

    const selectedProducts = useMemo(() => [...new Set((formData.products || []) as string[])], [formData.products]);

    const handleSelectAllVisibleProducts = useCallback(() => {
        setFormData(prev => {
            const current = [...new Set((prev.products || []) as string[])];
            return { ...prev, products: [...new Set([...current, ...filteredProducts.map(p => p.code)])] };
        });
    }, [filteredProducts]);

    const handleClearAllProducts = useCallback(() => {
        setFormData(prev => ({ ...prev, products: [] }));
    }, []);

    // ── Sidebar card ──────────────────────────────────────────────────────────
    const FamilyCard = ({ family }: { family: ProductFamily }) => {
        const isActive = !showForm && selected?.id === family.id;
        const count = Array.isArray(family.products) ? family.products.length : (family.products_count ?? 0);
        return (
            <button
                onClick={() => { setSelected(family); setShowForm(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group
                    ${isActive
                        ? 'bg-blue-50 border-blue-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/40'}`}
            >
                <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isActive ? ACCENT.dot : 'bg-gray-300 group-hover:bg-blue-400'} transition-colors`} />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? ACCENT.badge : 'bg-gray-100 text-gray-600'} font-mono transition-colors`}>
                                {family.code}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate leading-snug">{family.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{count} produit{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </button>
        );
    };

    // ── Detail view (read-only) ───────────────────────────────────────────────
    const DetailView = ({ family }: { family: ProductFamily }) => {
        const productCodes: string[] = Array.isArray(family.products)
            ? family.products.map((p: string | { product_code?: string; code?: string }) => typeof p === 'string' ? p : (p.product_code ?? p.code ?? '')).filter(Boolean)
            : [];
        const count = productCodes.length || (family.products_count ?? 0);
        const activeCount = productCodes.filter(code => allProducts.find(p => p.code === code)?.is_active).length;

        return (
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                                <Package className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md font-mono">{family.code}</span>
                                    {family.sales_group_code && (
                                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                            <Tag className="w-3 h-3 inline mr-1" />{family.sales_group_code}
                                        </span>
                                    )}
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 leading-tight">{family.name}</h2>
                                {family.description && <p className="text-sm text-gray-500 mt-0.5">{family.description}</p>}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleEdit(family)} className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                                <Edit className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button onClick={() => handleDeleteClick(family.id!)} className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Stats chips */}
                    <div className="flex items-center gap-2 mt-4">
                        {[
                            { label: `${count} produit${count !== 1 ? 's' : ''}`, color: 'bg-blue-50 text-blue-700 border-blue-200' },
                            { label: `${activeCount} actif${activeCount !== 1 ? 's' : ''}`, color: 'bg-green-50 text-green-700 border-green-200' },
                            ...(count - activeCount > 0 ? [{ label: `${count - activeCount} inactif${count - activeCount !== 1 ? 's' : ''}`, color: 'bg-orange-50 text-orange-700 border-orange-200' }] : []),
                        ].map(s => (
                            <span key={s.label} className={`text-xs font-medium px-2.5 py-1 rounded-full border ${s.color}`}>{s.label}</span>
                        ))}
                    </div>
                </div>

                {/* Products list */}
                <div className="flex-1 overflow-y-auto p-6">
                    {productCodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Package className="w-10 h-10 text-gray-200 mb-3" />
                            <p className="text-sm text-gray-500 font-medium">Aucun produit dans cette famille</p>
                            <button onClick={() => handleEdit(family)} className={`mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} transition-colors`}>
                                Ajouter des produits
                            </button>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Produits ({count})</h3>
                            <div className="grid grid-cols-1 gap-1.5">
                                {productCodes.map(code => {
                                    const p = allProducts.find(x => x.code === code);
                                    return (
                                        <div key={code} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p?.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <span className="text-xs font-mono text-gray-400 w-24 shrink-0">{code}</span>
                                            <span className="text-sm text-gray-700 truncate">{p?.name ?? '—'}</span>
                                            {p && !p.is_active && (
                                                <span className="ml-auto text-[10px] text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">Inactif</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Form view ─────────────────────────────────────────────────────────────
    const FormView = () => (
        <div className="h-full flex flex-col">
            {/* Form header */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={handleCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{isEditMode ? 'Modifier la famille' : 'Nouvelle Famille Produit'}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{isEditMode ? `Code : ${formData.code}` : 'Créer un groupe de produits pour les promotions'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleCancel} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                    <button
                        onClick={handleSave} disabled={isSaving}
                        className={`h-9 px-4 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 ${ACCENT.bg} ${ACCENT.hbg}`}
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Enregistrer
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="shrink-0 bg-white border-b border-gray-100 px-6">
                <div className="flex gap-0">
                    {(['info', 'products'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`relative py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab ? 'text-blue-700' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {tab === 'info' ? 'Informations' : `Produits (${selectedProducts.length})`}
                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'info' && (
                    <div className="max-w-lg space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
                            <input
                                value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                disabled={isEditMode} autoFocus maxLength={20}
                                placeholder="Ex : SURGELÉS"
                                className={`w-full h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono uppercase outline-none ${ACCENT.ring} focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400 transition-colors`}
                            />
                            {isEditMode && <p className="text-[11px] text-gray-400 mt-1">Le code ne peut pas être modifié après création.</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
                            <input
                                value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                maxLength={100} placeholder="Ex : Produits Surgelés"
                                className={`w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none ${ACCENT.ring} focus:ring-2 transition-colors`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Description</label>
                            <textarea
                                value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })}
                                rows={3} placeholder="Description optionnelle de la famille…"
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none ${ACCENT.ring} focus:ring-2 resize-none transition-colors`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Code Groupe Vente</label>
                            <input
                                value={formData.sales_group_code || ''} onChange={e => setFormData({ ...formData, sales_group_code: e.target.value })}
                                placeholder="Ex : GRP001"
                                className={`w-full h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono outline-none ${ACCENT.ring} focus:ring-2 transition-colors`}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">Optionnel — regroupe les familles pour les statistiques de vente.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="max-w-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">Produits de la famille</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{selectedProducts.length} produit{selectedProducts.length !== 1 ? 's' : ''} sélectionné{selectedProducts.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button onClick={() => setShowProductModal(true)} className={`h-8 px-3 text-xs font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} flex items-center gap-1.5 transition-colors`}>
                                <Plus className="w-3.5 h-3.5" /> Ajouter produits
                            </button>
                        </div>
                        {selectedProducts.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-center">
                                <Package className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">Aucun produit sélectionné</p>
                                <button onClick={() => setShowProductModal(true)} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">+ Parcourir le catalogue</button>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedProducts.map(code => {
                                    const p = allProducts.find(x => x.code === code);
                                    return (
                                        <div key={code} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 group transition-colors">
                                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p?.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                                            <span className="text-xs font-mono text-gray-400 w-24 shrink-0">{code}</span>
                                            <span className="text-sm text-gray-700 flex-1 truncate">{p?.name ?? '—'}</span>
                                            <button
                                                onClick={() => handleToggleProduct(code)}
                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Product selection modal ───────────────────────────────────────────────
    const ProductModal = () => !showProductModal ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-gray-900">Sélectionner des produits</h2>
                        <button onClick={() => setShowProductModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
                    </div>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            autoFocus value={productSearch} onChange={e => setProductSearch(e.target.value)}
                            placeholder="Rechercher par code ou nom…"
                            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {(['all', 'active', 'inactive'] as const).map(f => (
                                <button key={f} onClick={() => setActiveFilter(f)}
                                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium
                                        ${activeFilter === f ? (f === 'all' ? 'bg-gray-800 text-white border-gray-800' : f === 'active' ? 'bg-green-600 text-white border-green-600' : 'bg-orange-600 text-white border-orange-600') : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >
                                    {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : 'Inactifs'}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSelectAllVisibleProducts} className="text-xs text-blue-600 hover:text-blue-700 font-medium">Tout sélectionner</button>
                            <span className="text-gray-300">·</span>
                            <button onClick={handleClearAllProducts} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Tout effacer</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {loadingProducts ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12"><Package className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun produit trouvé</p></div>
                    ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="w-10 px-3 py-2 text-left">
                                            <input
                                                type="checkbox"
                                                checked={filteredProducts.length > 0 && filteredProducts.every(p => selectedProducts.includes(p.code))}
                                                onChange={() => {
                                                    const allCodes = filteredProducts.map(p => p.code);
                                                    const allSelected = allCodes.every(code => selectedProducts.includes(code));
                                                    setFormData({
                                                        ...formData,
                                                        products: allSelected
                                                            ? selectedProducts.filter(code => !allCodes.includes(code))
                                                            : [...new Set([...selectedProducts, ...allCodes])],
                                                    });
                                                }}
                                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Nom</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Statut</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredProducts.map(p => {
                                        const isSel = selectedProducts.includes(p.code);
                                        return (
                                            <tr
                                                key={p.id}
                                                onClick={() => handleToggleProduct(p.code)}
                                                className={`cursor-pointer transition-colors ${isSel ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSel}
                                                        onChange={() => handleToggleProduct(p.code)}
                                                        className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 pointer-events-none"
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.code}</td>
                                                <td className="px-3 py-2.5">
                                                    <p className="font-medium text-gray-900 truncate max-w-[220px]">{p.name}</p>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {p.is_active ? 'Actif' : 'Inactif'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{selectedProducts.length} sélectionné{selectedProducts.length !== 1 ? 's' : ''} · {filteredProducts.length} affiché{filteredProducts.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => setShowProductModal(false)} className={`h-8 px-4 text-sm font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} transition-colors`}>Terminé</button>
                </div>
            </div>
        </div>
    );

    // ── Sidebar content ───────────────────────────────────────────────────────
    const SidebarContent = (
        <div className="h-full flex flex-col bg-white">
            {/* Mini header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                {/* Title row — no buttons here to avoid overlap with MasterLayout controls */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 leading-tight">Familles Produits</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400">{visibleFamilies.length} famille{visibleFamilies.length !== 1 ? 's' : ''}</span>
                            <button onClick={loadFamilies} disabled={loading} title="Actualiser" className="text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40">
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Search + New button on same row */}
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            value={listSearch} onChange={e => setListSearch(e.target.value)}
                            placeholder="Rechercher…"
                            className="w-full h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors"
                        />
                    </div>
                    <button onClick={handleCreateNew} className={`h-8 w-8 shrink-0 flex items-center justify-center text-white rounded-lg transition-colors ${ACCENT.bg} ${ACCENT.hbg}`} title="Nouvelle famille">
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Card list */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div>
                ) : visibleFamilies.length === 0 ? (
                    <div className="text-center py-10">
                        <Package className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">{listSearch ? 'Aucun résultat' : 'Aucune famille'}</p>
                        {!listSearch && (
                            <button onClick={handleCreateNew} className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium">+ Créer la première</button>
                        )}
                    </div>
                ) : visibleFamilies.map(f => <FamilyCard key={f.id} family={f} />)}
            </div>
        </div>
    );

    // ── Main content ──────────────────────────────────────────────────────────
    const MainContent = (
        <div className="h-full overflow-hidden bg-slate-50">
            {showForm ? (
                <FormView />
            ) : selected ? (
                <DetailView family={selected} />
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                        <Package className="w-8 h-8 text-blue-300" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-600 mb-1">Sélectionnez une famille</h3>
                    <p className="text-sm text-gray-400 mb-5">Cliquez sur une famille dans la liste pour voir ses détails</p>
                    <button onClick={handleCreateNew} className={`h-9 px-4 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${ACCENT.bg} ${ACCENT.hbg}`}>
                        <Plus className="w-4 h-4" /> Nouvelle Famille
                    </button>
                </div>
            )}
        </div>
    );

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <>
            <MasterLayout
                leftContent={SidebarContent}
                mainContent={MainContent}
            />

            <ProductModal />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer la famille"
                description="Cette famille sera définitivement supprimée. Si elle est utilisée dans un boost, le backend refusera la suppression."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
};
