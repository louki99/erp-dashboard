import { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { promotionsApi } from '@/services/api/promotionsApi';
import { masterdataApi, type Product } from '@/services/api/masterdataApi';
import type { ProductFamily } from '@/types/promotion.types';
import type { ColDef } from 'ag-grid-community';
import { 
    Package, 
    Plus, 
    RefreshCw, 
    Edit, 
    Trash2, 
    ArrowLeft,
    Save,
    X,
    Search,
    CheckCircle,
    Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';

export const ProductFamiliesPage = () => {
    const [families, setFamilies] = useState<ProductFamily[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [familyToDelete, setFamilyToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'products'>('info');
    const [formData, setFormData] = useState<Partial<ProductFamily>>({
        code: '',
        name: '',
        description: '',
        sales_group_code: '',
        products: []
    });
    const [isSaving, setIsSaving] = useState(false);
    
    const [showProductModal, setShowProductModal] = useState(false);
    const [allProducts, setAllProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const loadFamilies = async () => {
        try {
            setLoading(true);
            const data = await promotionsApi.getProductFamilies();
            setFamilies(data.productFamilies || []);
        } catch (error) {
            console.error('Failed to load product families:', error);
            toast.error('Échec du chargement des familles produits');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFamilies();
        loadAllProducts();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && showForm) {
                e.preventDefault();
                handleSave();
            }
            if (e.key === 'Escape') {
                if (showProductModal) {
                    setShowProductModal(false);
                } else if (showForm) {
                    handleCancel();
                }
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showForm) {
                e.preventDefault();
                handleCreateNew();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showForm, showProductModal, formData, families]);

    const loadAllProducts = async () => {
        try {
            setLoadingProducts(true);
            const data = await masterdataApi.products.getAll();
            setAllProducts(data.product || []);
        } catch (error) {
            console.error('Failed to load products:', error);
            toast.error('Échec du chargement des produits');
        } finally {
            setLoadingProducts(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setFamilyToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!familyToDelete) return;
        
        try {
            setIsDeleting(true);
            await promotionsApi.deleteProductFamily(familyToDelete);
            toast.success('Famille produit supprimée');
            loadFamilies();
            setShowDeleteModal(false);
            setFamilyToDelete(null);
        } catch (error) {
            console.error('Failed to delete product family:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateNew = () => {
        setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
        setIsEditMode(false);
        setActiveTab('info');
        setShowForm(true);
    };

    const handleEdit = (family: ProductFamily) => {
        // Normalize products data - API returns relationship objects with product_code field
        let productCodes: string[] = [];
        
        if (Array.isArray(family.products)) {
            productCodes = family.products.map(p => {
                if (typeof p === 'string') {
                    return p;
                } else if (p && typeof p === 'object') {
                    // Check for product_code (relationship object) or code (product object)
                    if ('product_code' in p) {
                        return (p as any).product_code;
                    } else if ('code' in p) {
                        return p.code;
                    }
                }
                return '';
            }).filter(code => code !== '');
        }
        
        const normalizedFamily = {
            ...family,
            products: productCodes
        };
        
        console.log('Editing family:', family);
        console.log('Normalized products:', productCodes);
        
        setFormData(normalizedFamily);
        setIsEditMode(true);
        setActiveTab('info');
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
    };

    const handleToggleProduct = (productCode: string) => {
        const currentProducts = (formData.products || []) as string[];
        if (currentProducts.includes(productCode)) {
            setFormData({
                ...formData,
                products: currentProducts.filter(c => c !== productCode)
            });
        } else {
            setFormData({
                ...formData,
                products: [...currentProducts, productCode]
            });
        }
    };

    const handleSelectAllProducts = () => {
        const currentProducts = (formData.products || []) as string[];
        const allCodes = allProducts
            .filter(p => {
                const search = productSearch.toLowerCase();
                const matchesSearch = !productSearch || 
                    p.code.toLowerCase().includes(search) ||
                    p.name.toLowerCase().includes(search);
                
                if (!matchesSearch) return false;
                
                if (activeFilter === 'all') return true;
                if (activeFilter === 'active') return p.is_active;
                if (activeFilter === 'inactive') return !p.is_active;
                return true;
            })
            .map(p => p.code);
        
        setFormData({
            ...formData,
            products: [...new Set([...currentProducts, ...allCodes])] as string[]
        });
    };

    const handleClearAllProducts = () => {
        setFormData({
            ...formData,
            products: []
        });
    };

    const handleExportFamily = () => {
        if (!formData.code) {
            toast.error('Aucune famille à exporter');
            return;
        }
        const dataStr = JSON.stringify(formData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `famille-produit-${formData.code}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Famille exportée');
    };

    const handleSave = async () => {
        if (!formData.code || !formData.name) {
            toast.error('Code et Nom sont obligatoires');
            return;
        }

        if (formData.code.length < 2) {
            toast.error('Le code doit contenir au moins 2 caractères');
            return;
        }

        if (formData.name.length < 3) {
            toast.error('Le nom doit contenir au moins 3 caractères');
            return;
        }

        if (!isEditMode && families.some(f => f.code === formData.code)) {
            toast.error('Ce code existe déjà');
            return;
        }

        try {
            setIsSaving(true);
            if (isEditMode && formData.id) {
                await promotionsApi.updateProductFamily(formData.id, formData);
                toast.success('Famille mise à jour avec succès');
            } else {
                await promotionsApi.createProductFamily(formData);
                toast.success('Famille créée avec succès');
            }
            setShowForm(false);
            setFormData({ code: '', name: '', description: '', sales_group_code: '', products: [] });
            loadFamilies();
        } catch (error: any) {
            const errorMsg = error?.response?.data?.message || 'Échec de l\'opération';
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const columnDefs: ColDef<ProductFamily>[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 140,
            cellRenderer: (params: any) => {
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm font-medium text-gray-900">{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            cellRenderer: (params: any) => {
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm text-gray-900">{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 140,
            cellRenderer: (params: any) => {
                const date = params.value ? new Date(params.value) : new Date();
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm text-gray-600">
                            {date.toLocaleDateString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                            })}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: 'Actions',
            width: 100,
            cellRenderer: (params: any) => {
                const family = params.data as ProductFamily;
                return (
                    <div className="flex items-center justify-center gap-1 h-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(family);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Modifier"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(family.id!);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
        },
    ], []);

    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold text-gray-900">Familles Produits</h2>
                </div>
                <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {families.length}
                </div>
            </div>

            <div className="p-3 border-b border-gray-200 bg-gray-50">
                <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Nouvelle Famille</span>
                </button>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={families}
                    columnDefs={columnDefs}
                    loading={loading}
                />
            </div>
        </div>
    );

    const FormView = (
        <div className="flex flex-col h-full bg-white">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Modifier la Famille' : 'Nouvelle Famille Produit'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isEditMode ? `Code: ${formData.code}` : 'Créer une nouvelle famille produit'}
                        </p>
                        <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Ctrl+S pour sauvegarder
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Échap pour annuler
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <div className="flex gap-4 px-6">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`py-3 px-4 border-b-2 transition ${
                            activeTab === 'info'
                                ? 'border-purple-600 text-purple-600 font-medium'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Informations
                    </button>
                    <button
                        onClick={() => setActiveTab('products')}
                        className={`py-3 px-4 border-b-2 transition ${
                            activeTab === 'products'
                                ? 'border-purple-600 text-purple-600 font-medium'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Produits ({formData.products?.length || 0})
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'info' && (
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code || ''}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                                        placeholder="Ex: ELECTRONICS"
                                        maxLength={20}
                                        disabled={isEditMode}
                                        autoFocus
                                    />
                                    {isEditMode && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Le code ne peut pas être modifié
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Ex: Produits Électroniques"
                                        maxLength={100}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Description de la famille"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code Groupe Vente
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sales_group_code || ''}
                                        onChange={(e) => setFormData({ ...formData, sales_group_code: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                        placeholder="Ex: GRP001"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'products' && (
                    <div className="max-w-4xl">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Produits</h3>
                                <button 
                                    onClick={() => setShowProductModal(true)}
                                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Ajouter Produits
                                </button>
                            </div>
                            
                            {formData.products && formData.products.length > 0 ? (
                                <div>
                                    <div className="mb-3 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                                        <div className="grid grid-cols-2 gap-3 text-center">
                                            <div>
                                                <div className="text-xs text-gray-600">Produits</div>
                                                <div className="text-xl font-bold text-purple-600">{formData.products.length}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">Actifs</div>
                                                <div className="text-xl font-bold text-emerald-600">
                                                    {(formData.products as string[]).filter(code => {
                                                        const p = allProducts.find(product => product.code === code);
                                                        return p?.is_active;
                                                    }).length}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {(formData.products as string[]).map((productCode: string) => {
                                            const product = allProducts.find(p => p.code === productCode);
                                            return (
                                                <div key={productCode} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-200">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-900">{product?.name || productCode}</p>
                                                        <p className="text-xs text-gray-500">{productCode}</p>
                                                        {product && (
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <p className={`text-xs font-medium ${product.is_active ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    {product.is_active ? '✓ Actif' : '✗ Inactif'}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            const currentProducts = formData.products as string[];
                                                            setFormData({
                                                                ...formData,
                                                                products: currentProducts.filter(c => c !== productCode)
                                                            });
                                                        }}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Aucun produit ajouté</p>
                                    <p className="text-sm mt-1">Cliquez sur "Ajouter Produits" pour commencer</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const ActionPanel = (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-purple-500 rounded-full opacity-50"></div>
                </div>
                <button
                    onClick={loadFamilies}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                    title="Actualiser"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {showForm && isEditMode && (
                    <button
                        onClick={handleExportFamily}
                        className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                        title="Exporter"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );

    const filteredProducts = useMemo(() => {
        let filtered = allProducts;
        
        if (productSearch) {
            const search = productSearch.toLowerCase();
            filtered = filtered.filter(p => 
                p.code.toLowerCase().includes(search) ||
                p.name.toLowerCase().includes(search)
            );
        }
        
        if (activeFilter !== 'all') {
            filtered = filtered.filter(p => {
                if (activeFilter === 'active') return p.is_active;
                if (activeFilter === 'inactive') return !p.is_active;
                return true;
            });
        }
        
        return filtered;
    }, [allProducts, productSearch, activeFilter]);

    const ProductSelectionModal = (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${showProductModal ? '' : 'hidden'}`}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowProductModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Sélectionner des Produits</h2>
                        <button
                            onClick={() => setShowProductModal(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            placeholder="Rechercher par code ou nom..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            {formData.products?.length || 0} produit(s) sélectionné(s)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectAllProducts}
                                className="text-xs px-3 py-1 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition"
                            >
                                Tout sélectionner
                            </button>
                            <button
                                onClick={handleClearAllProducts}
                                className="text-xs px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition"
                            >
                                Tout effacer
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={() => setActiveFilter('all')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                activeFilter === 'all'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Tous
                        </button>
                        <button
                            onClick={() => setActiveFilter('active')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                activeFilter === 'active'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Actifs
                        </button>
                        <button
                            onClick={() => setActiveFilter('inactive')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                activeFilter === 'inactive'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Inactifs
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {loadingProducts ? (
                        <div className="text-center py-12">
                            <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                            <p className="text-gray-400">Chargement des produits...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="text-center py-12">
                            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400">Aucun produit trouvé</p>
                            <p className="text-sm text-gray-400 mt-1">Essayez de modifier vos filtres</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredProducts.map((product) => {
                                const isSelected = (formData.products as string[] || []).includes(product.code);
                                return (
                                    <button
                                        key={product.code}
                                        onClick={() => handleToggleProduct(product.code)}
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                                ? 'border-purple-500 bg-purple-50'
                                                : 'border-gray-200 hover:border-purple-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-semibold text-gray-900 truncate">{product.name}</p>
                                                    {isSelected && <CheckCircle className="w-5 h-5 text-purple-600 shrink-0" />}
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">{product.code}</p>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className={`font-medium ${product.is_active ? 'text-emerald-600' : 'text-red-600'}`}>
                                                        {product.is_active ? '✓ Actif' : '✗ Inactif'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {filteredProducts.length} produit(s) affiché(s)
                    </div>
                    <button
                        onClick={() => setShowProductModal(false)}
                        className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {showForm ? FormView : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="font-medium">Sélectionnez une famille</p>
                                    <p className="text-sm mt-2">Cliquez sur "Modifier" ou "Nouvelle Famille" pour commencer</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={ActionPanel}
            />

            {ProductSelectionModal}

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer la famille"
                description="Êtes-vous sûr de vouloir supprimer cette famille produit ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
};
