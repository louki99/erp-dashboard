import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { 
    Package, 
    Loader2, 
    RefreshCw, 
    Plus, 
    Edit, 
    Trash2, 
    CheckCircle2, 
    XCircle, 
    BarChart3,
    Image as ImageIcon,
    Box,
    Tag,
    DollarSign,
    X,
    ZoomIn,
    Maximize2
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { FileUpload } from '@/components/common/FileUpload';
import { RichTextEditor } from '@/components/common/RichTextEditor';
import {
    useProductsList,
    useProductDetail,
    useApproveProduct,
    useToggleProductStatus,
    useDeleteProduct,
    useProductStock,
    useProductStatistics,
    useCreateProduct,
    useUpdateProduct,
} from '@/hooks/products/useProducts';
import type { Product, ProductFilters } from '@/types/product.types';
import { ActionPanel } from '@/components/layout/ActionPanel';

export const ProductsPage = () => {
    const [selected, setSelected] = useState<Product | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [filters, setFilters] = useState<ProductFilters>({ page: 1, per_page: 20 });
    const [activeTab, setActiveTab] = useState<string>('info');
    const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showLightbox, setShowLightbox] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        pricing: true,
        price_lists: true,
        stock: true,
        suppliers: true,
        media: true,
        custom_fields: true,
        flags: false,
        categories: true,
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useProductsList(filters);
    const products = data?.data?.data || [];
    const pagination = data?.meta;

    const { data: statsData } = useProductStatistics();
    const stats = statsData?.data || {
        total_products: 0,
        active_products: 0,
        pending_approval: 0,
        out_of_stock: 0,
        low_stock: 0,
    };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useProductDetail(selected?.id ?? null);
    const { data: stockData, loading: stockLoading, refetch: refetchStock } = useProductStock(selected?.id ?? null);
    const { approve, loading: approving } = useApproveProduct();
    const { toggleStatus, loading: toggling } = useToggleProductStatus();
    const { deleteProduct, loading: deleting } = useDeleteProduct();
    const { create, loading: creating } = useCreateProduct();
    const { update, loading: updating } = useUpdateProduct();

    const details = detailData?.data?.product || selected;
    const customFields = detailData?.data?.custom_fields || {};
    const stockSummary = stockData?.data || detailData?.data?.stock_summary;
    const stocksByBranch = (stockSummary as any)?.stocks_by_branch || (stockSummary as any)?.by_branch || details?.stocks || [];

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { 
                field: 'code', 
                headerName: 'Code', 
                width: 140,
                cellRenderer: (params: any) => {
                    const product = params.data;
                    if (!product) return params.value;
                    
                    let badge = '';
                    if (!product.is_approve) {
                        badge = ' [En attente]';
                    } else if (product.is_new) {
                        badge = ' [Nouveau]';
                    }
                    
                    return (params.value || '') + badge;
                }
            },
            { field: 'name', headerName: 'Nom du produit', flex: 1, minWidth: 250 },
            { 
                field: 'brand.name', 
                headerName: 'Marque', 
                width: 140,
                valueGetter: (params: any) => params.data?.brand?.name || '-'
            },
            { 
                field: 'price', 
                headerName: 'Prix', 
                width: 120,
                valueFormatter: (params: any) => `${parseFloat(params.value || 0).toFixed(2)} MAD`
            },
            { 
                field: 'discount_price', 
                headerName: 'Prix promo', 
                width: 120,
                valueFormatter: (params: any) => params.value ? `${parseFloat(params.value).toFixed(2)} MAD` : '-'
            },
            { 
                field: 'quantity', 
                headerName: 'Stock', 
                width: 100,
                cellStyle: (params: any) => {
                    const qty = params.value || 0;
                    if (qty === 0) return { color: '#dc2626' };
                    if (qty < 10) return { color: '#f59e0b' };
                    return { color: '#059669' };
                }
            },
            { 
                field: 'is_active', 
                headerName: 'Statut', 
                width: 100,
                cellRenderer: (params: any) => params.value ? 'Actif' : 'Inactif'
            },
        ],
        []
    );

    const tabs: TabItem[] = useMemo(
        () => [
            { id: 'info', label: 'Informations', icon: Package },
            { id: 'pricing', label: 'Prix', icon: DollarSign },
            { id: 'price_lists', label: 'Listes de prix', icon: DollarSign },
            { id: 'stock', label: 'Stock', icon: Box },
            { id: 'suppliers', label: 'Fournisseurs', icon: Package },
            { id: 'media', label: 'Médias', icon: ImageIcon },
            { id: 'custom_fields', label: 'Champs personnalisés', icon: Tag },
            { id: 'flags', label: 'Options & Marketing', icon: CheckCircle2 },
            { id: 'categories', label: 'Catégories', icon: Tag },
        ],
        []
    );

    const onSelect = (row: Product) => {
        // Set cursor to loading with higher priority
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);
        
        setSelected(row);
        setIsCreateMode(false);
        setIsEditMode(false);
        setActiveTab('info');
        setShowDetailPanel(true);
        
        // Reset cursor after a short delay to allow panel to render
        setTimeout(() => {
            const styleElement = document.getElementById('loading-cursor-style');
            if (styleElement) {
                styleElement.remove();
            }
        }, 800);
    };

    const handleCreateNew = () => {
        setSelected(null);
        setIsCreateMode(true);
        setIsEditMode(true);
        setFormData({
            name: '',
            code: '',
            price: 0,
            discount_price: 0,
            quantity: 0,
            min_order_quantity: 1,
            brand: undefined,
            unit: undefined,
            short_description: '',
            description: '',
            buy_price: 0,
            categories: [],
            vat_taxes: [],
            is_active: true,
            is_salable: true,
            is_returnable: true,
            is_discountable: true,
        });
        setActiveTab('info');
        setShowDetailPanel(true);
    };

    const handleEdit = () => {
        if (!selected) return;
        setIsEditMode(true);
        setIsCreateMode(false);
        
        // Build complete form data matching API requirements
        const editFormData: any = {
            // Basic Information
            name: details?.name || '',
            code: details?.code || '',
            short_description: details?.short_description || '',
            description: details?.description || '',
            
            // Pricing & Inventory
            price: details?.price || 0,
            discount_price: details?.discount_price || 0,
            buy_price: details?.buy_price || 0,
            quantity: details?.quantity || 0,
            min_order_quantity: details?.min_order_quantity || 1,
            has_colisage: details?.has_colisage || false,
            
            // Relationships
            brand: details?.brand_id,
            unit: details?.unit_id,
            categories: details?.categories?.map((c: any) => c.id) || [],
            vat_taxes: details?.vatTaxes?.map((v: any) => v.id) || [],
            units_multi: details?.units?.map((u: any) => u.id) || [],
            suppliers: details?.suppliers?.map((s: any) => s.id) || [],
            
            // Product Flags (Inventory Management)
            decimal_quantity_allowed: details?.flags?.decimal_quantity_allowed ?? false,
            decimal_precision: details?.flags?.decimal_precision ?? 0,
            is_backorder_allowed: details?.flags?.is_backorder_allowed ?? true,
            is_batch_managed: details?.flags?.is_batch_managed ?? false,
            is_discountable: details?.flags?.is_discountable ?? true,
            is_expirable: details?.flags?.is_expirable ?? false,
            is_returnable: details?.flags?.is_returnable ?? true,
            is_salable: details?.flags?.is_salable ?? true,
            is_serialized: details?.flags?.is_serialized ?? false,
            is_weight_managed: details?.flags?.is_weight_managed ?? true,
            
            // Marketing Flags
            is_featured: details?.marketing?.is_featured ?? false,
            is_free_good: details?.marketing?.is_free_good ?? false,
            is_quotation_required: details?.marketing?.is_quotation_required ?? false,
            is_visible_individually: details?.marketing?.is_visible_individually ?? true,
            requires_login_to_view: details?.marketing?.requires_login_to_view ?? false,
            
            // SEO Meta Data
            meta_title: details?.meta_title || '',
            meta_description: details?.meta_description || '',
            meta_keywords: details?.meta_keywords || '',
            
            // Status
            is_active: details?.is_active ?? true,
        };
        
        // Add supplier pivot data if suppliers exist
        if (details?.suppliers && Array.isArray(details.suppliers)) {
            details.suppliers.forEach((supplier: any) => {
                const supplierId = supplier.id;
                editFormData[`supplier_cost_${supplierId}`] = supplier.pivot?.cost_price || 0;
                editFormData[`supplier_min_qty_${supplierId}`] = supplier.pivot?.min_order_qty || 0;
                editFormData[`supplier_lead_time_${supplierId}`] = supplier.pivot?.lead_time_days || 0;
                editFormData[`supplier_preferred_${supplierId}`] = supplier.pivot?.preferred || false;
            });
        }
        
        // Add custom fields if they exist
        if (details?.customFieldValues && Array.isArray(details.customFieldValues)) {
            const customFieldsObj: any = {};
            details.customFieldValues.forEach((cfv: any) => {
                customFieldsObj[cfv.custom_field_id] = cfv.value;
            });
            editFormData.custom_fields = customFieldsObj;
        }
        
        setFormData(editFormData);
    };

    const handleCancelEdit = () => {
        setIsEditMode(false);
        if (isCreateMode) {
            setIsCreateMode(false);
            setShowDetailPanel(false);
            setSelected(null);
        }
        setFormData({});
    };

    const handleSave = async () => {
        // Validation
        if (!formData.name || !formData.code) {
            toast.error('Le nom et le code du produit sont obligatoires');
            return;
        }
        
        if (!formData.price || formData.price <= 0) {
            toast.error('Le prix doit être supérieur à 0');
            return;
        }
        
        if (formData.discount_price && formData.discount_price >= formData.price) {
            toast.error('Le prix promotionnel doit être inférieur au prix normal');
            return;
        }

        const toastId = toast.loading(isCreateMode ? 'Création en cours...' : 'Mise à jour en cours...');

        try {
            // Prepare data for API
            const apiData = { ...formData };
            
            // Convert boolean values to proper format
            Object.keys(apiData).forEach(key => {
                if (typeof apiData[key] === 'boolean') {
                    apiData[key] = apiData[key] ? 1 : 0;
                }
            });
            
            let res;
            if (isCreateMode) {
                res = await create(apiData);
            } else if (selected) {
                res = await update(selected.id, apiData);
            }

            toast.dismiss(toastId);

            if (res?.success) {
                toast.success(res.message || (isCreateMode ? 'Produit créé avec succès' : 'Produit mis à jour avec succès'), {
                    duration: 4000
                });
                setIsEditMode(false);
                setIsCreateMode(false);
                await refetch();
                if (!isCreateMode && selected) {
                    await refetchDetail();
                } else {
                    setShowDetailPanel(false);
                }
            } else {
                // Handle validation errors
                if (res?.errors) {
                    const errorMessages = Object.values(res.errors).flat().join('\n');
                    toast.error(errorMessages || 'Erreur de validation');
                } else {
                    toast.error(res?.message || 'Une erreur est survenue');
                }
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            
            // Handle different error types
            if (e.response?.data?.errors) {
                const errorMessages = Object.values(e.response.data.errors).flat().join('\n');
                toast.error(errorMessages);
            } else if (e.response?.data?.message) {
                toast.error(e.response.data.message);
            } else {
                toast.error(e.message || 'Une erreur est survenue lors de la sauvegarde');
            }
        }
    };

    const onSelectionChanged = (rows: Product[]) => {
        setSelectedProducts(rows);
    };

    const handleApprove = async () => {
        if (!selected?.id) return;

        const toastId = toast.loading('Approbation en cours...');

        try {
            const res = await approve(selected.id);
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(res.message || 'Produit approuvé avec succès');
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec de l\'approbation');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de l\'approbation');
        }
    };

    const handleToggleStatus = async () => {
        if (!selected?.id) return;

        const toastId = toast.loading('Mise à jour du statut...');

        try {
            const res = await toggleStatus(selected.id);
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(res.message || 'Statut mis à jour');
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec de la mise à jour');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de la mise à jour');
        }
    };

    const handleDelete = async () => {
        if (!selected?.id) return;

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce produit ?')) return;

        const toastId = toast.loading('Suppression en cours...');

        try {
            const res = await deleteProduct(selected.id);
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(res.message || 'Produit supprimé avec succès');
                setSelected(null);
                setShowDetailPanel(false);
                await refetch();
            } else {
                toast.error(res.message || 'Échec de la suppression');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de la suppression');
        }
    };

    const toggleSection = (sectionId: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [sectionId]: isOpen }));
    };

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => {
                isScrollingRef.current = false;
            }, 1000);
        }
    };

    const handleExpandAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    };

    const handleCollapseAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;

            const containerTop = container.scrollTop;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el || !openSections[tab.id]) continue;

                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;

                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
                    if (activeTab !== tab.id) {
                        setActiveTab(tab.id);
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [openSections, tabs, activeTab]);

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <h1 className="text-sm font-semibold text-gray-900 mb-2">Gestion des Produits</h1>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-blue-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="text-base font-bold text-blue-700">{stats.total_products}</div>
                            </div>
                            <div className="bg-green-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">Actifs</div>
                                <div className="text-base font-bold text-green-700">{stats.active_products}</div>
                            </div>
                            <div className="bg-orange-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">En attente</div>
                                <div className="text-base font-bold text-orange-700">{stats.pending_approval}</div>
                            </div>
                            <div className="bg-red-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">Rupture</div>
                                <div className="text-base font-bold text-red-700">{stats.out_of_stock}</div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100 bg-red-50">{error}</div>}

                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            {loading ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid 
                                    rowData={products} 
                                    columnDefs={columnDefs} 
                                    loading={loading} 
                                    onRowSelected={undefined}
                                    onSelectionChanged={onSelectionChanged}
                                    rowSelection="multiple"
                                    onRowDoubleClicked={onSelect}
                                />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex overflow-hidden">
                    {showDetailPanel && (selected || isCreateMode) && (
                        <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
                            <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <button
                                            onClick={() => setShowDetailPanel(false)}
                                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                                            title="Retour"
                                        >
                                            <X className="w-5 h-5 text-gray-600" />
                                        </button>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                                    {isCreateMode ? 'Nouveau produit' : (details?.name || selected?.name)}
                                                </h1>
                                                {!isCreateMode && !details?.is_approve && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-orange-100 text-orange-700 rounded shrink-0">
                                                        En attente
                                                    </span>
                                                )}
                                                {!isCreateMode && (details?.is_active ? (
                                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded shrink-0">
                                                        Actif
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded shrink-0">
                                                        Inactif
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                                {isCreateMode ? (
                                                    <span className="font-medium">Remplissez les informations du produit</span>
                                                ) : (
                                                    <>
                                                        <span className="font-medium">Code: {details?.code || selected?.code}</span>
                                                        {details?.brand && <span>{details.brand.name}</span>}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        {!isCreateMode && (
                                            <div className="text-xl sm:text-2xl font-bold text-blue-600 whitespace-nowrap">
                                                {details?.price ? parseFloat(details.price.toString()).toFixed(2) : '0.00'} <span className="text-xs sm:text-sm font-normal text-gray-400">MAD</span>
                                            </div>
                                        )}
                                        {(detailLoading) && (
                                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1 justify-end">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="shrink-0 bg-white border-b border-gray-200 overflow-hidden">
                                <SageTabs
                                    tabs={tabs}
                                    activeTabId={activeTab}
                                    onTabChange={handleTabChange}
                                    onExpandAll={handleExpandAll}
                                    onCollapseAll={handleCollapseAll}
                                    className="shadow-none"
                                />
                            </div>

                            <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">
                                {/* Info Section */}
                                <div ref={el => { sectionRefs.current['info'] = el; }}>
                                    <SageCollapsible
                                        title="Informations générales"
                                        isOpen={openSections['info']}
                                        onOpenChange={(open) => toggleSection('info', open)}
                                    >
                                        {isEditMode ? (
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Code produit *</label>
                                                        <input
                                                            type="text"
                                                            value={formData.code || ''}
                                                            onChange={(e) => setFormData({...formData, code: e.target.value})}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Ex: PROD-001"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                                                        <input
                                                            type="text"
                                                            value={formData.name || ''}
                                                            onChange={(e) => setFormData({...formData, name: e.target.value})}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Nom du produit"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Marque *</label>
                                                        <input
                                                            type="text"
                                                            value={formData.brand || ''}
                                                            onChange={(e) => setFormData({...formData, brand: e.target.value})}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Marque"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Unité *</label>
                                                        <input
                                                            type="text"
                                                            value={formData.unit || ''}
                                                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            placeholder="Unité"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Description courte</label>
                                                    <textarea
                                                        value={formData.short_description || ''}
                                                        onChange={(e) => setFormData({...formData, short_description: e.target.value})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        rows={2}
                                                        placeholder="Brève description"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Description complète *</label>
                                                    <RichTextEditor
                                                        value={formData.description || ''}
                                                        onChange={(value) => setFormData({...formData, description: value})}
                                                        placeholder="Entrez la description détaillée du produit..."
                                                        height={250}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Code produit</div>
                                                        <div className="font-semibold text-gray-900">{details?.code}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Nom</div>
                                                        <div className="font-semibold text-gray-900">{details?.name}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Marque</div>
                                                        <div className="font-semibold text-gray-900">{details?.brand?.name || '-'}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Unité</div>
                                                        <div className="font-semibold text-gray-900">{details?.unit?.name || '-'}</div>
                                                    </div>
                                                </div>
                                                {details?.units && details.units.length > 0 && (
                                                    <div className="mt-3 p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500 mb-2">Unités multiples</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {details.units.map((unit: any) => (
                                                                <span key={unit.id} className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                                                    {unit.name} ({unit.code})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {details?.vat_taxes && details.vat_taxes.length > 0 && (
                                                    <div className="mt-3 p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500 mb-2">Taxes TVA</div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {details.vat_taxes.map((tax: any) => (
                                                                <span key={tax.id} className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                                                                    {tax.name} ({tax.percentage}%)
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {details?.short_description && (
                                                    <div className="mt-3 p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500 mb-1">Description courte</div>
                                                        <div className="text-sm text-gray-700">{details.short_description}</div>
                                                    </div>
                                                )}
                                                {details?.description && (
                                                    <div className="mt-3 p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500 mb-2">Description complète</div>
                                                        <RichTextEditor
                                                            value={details.description}
                                                            onChange={() => {}}
                                                            disabled={true}
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Pricing Section */}
                                <div ref={el => { sectionRefs.current['pricing'] = el; }}>
                                    <SageCollapsible
                                        title="Prix et remises"
                                        isOpen={openSections['pricing']}
                                        onOpenChange={(open) => toggleSection('pricing', open)}
                                    >
                                        {isEditMode ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Prix de vente (MAD) *</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.price || ''}
                                                        onChange={(e) => setFormData({...formData, price: parseFloat(e.target.value) || 0})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Prix promotionnel (MAD)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.discount_price || ''}
                                                        onChange={(e) => setFormData({...formData, discount_price: parseFloat(e.target.value) || 0})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Prix d'achat (MAD)</label>
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={formData.buy_price || ''}
                                                        onChange={(e) => setFormData({...formData, buy_price: parseFloat(e.target.value) || 0})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-500 mb-1">Qté min. commande</label>
                                                    <input
                                                        type="number"
                                                        value={formData.min_order_quantity || 1}
                                                        onChange={(e) => setFormData({...formData, min_order_quantity: parseInt(e.target.value) || 1})}
                                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        placeholder="1"
                                                        min="1"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Prix de vente</div>
                                                    <div className="font-semibold text-gray-900">{parseFloat(details?.price?.toString() || '0').toFixed(2)} MAD</div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Prix promotionnel</div>
                                                    <div className="font-semibold text-gray-900">
                                                        {details?.discount_price ? `${parseFloat(details.discount_price.toString()).toFixed(2)} MAD` : '-'}
                                                    </div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Prix d'achat</div>
                                                    <div className="font-semibold text-gray-900">
                                                        {details?.buy_price ? `${parseFloat(details.buy_price.toString()).toFixed(2)} MAD` : '-'}
                                                    </div>
                                                </div>
                                                <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                    <div className="text-xs text-gray-500">Qté min. commande</div>
                                                    <div className="font-semibold text-gray-900">{details?.min_order_quantity || 1}</div>
                                                </div>
                                            </div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Price Lists Section */}
                                {!isEditMode && detailData?.data?.price_lists && detailData.data.price_lists.length > 0 && (
                                    <div ref={el => { sectionRefs.current['price_lists'] = el; }}>
                                        <SageCollapsible
                                            title="Listes de prix"
                                            isOpen={openSections['price_lists']}
                                            onOpenChange={(open) => toggleSection('price_lists', open)}
                                        >
                                            <div className="space-y-3">
                                                {detailData.data.price_lists.map((priceList: any, index: number) => (
                                                    <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="font-semibold text-gray-900">{priceList.price_list.name}</h4>
                                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                                {priceList.price_list.code}
                                                            </span>
                                                        </div>
                                                        {priceList.pricing_details && priceList.pricing_details.length > 0 && (
                                                            <div className="space-y-2">
                                                                {priceList.pricing_details.map((detail: any, idx: number) => (
                                                                    <div key={idx} className="grid grid-cols-3 gap-2 text-sm bg-white p-2 rounded border border-gray-100">
                                                                        <div>
                                                                            <div className="text-xs text-gray-500">Prix de vente</div>
                                                                            <div className="font-semibold text-green-700">{parseFloat(detail.sales_price).toFixed(2)} MAD</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-gray-500">Prix de retour</div>
                                                                            <div className="font-semibold text-orange-700">{parseFloat(detail.return_price).toFixed(2)} MAD</div>
                                                                        </div>
                                                                        <div>
                                                                            <div className="text-xs text-gray-500">Remise</div>
                                                                            <div className="font-semibold text-blue-700">{parseFloat(detail.discount_rate).toFixed(2)}%</div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </SageCollapsible>
                                    </div>
                                )}

                                {/* Stock Section */}
                                <div ref={el => { sectionRefs.current['stock'] = el; }}>
                                    <SageCollapsible
                                        title="Stock"
                                        isOpen={openSections['stock']}
                                        onOpenChange={(open) => toggleSection('stock', open)}
                                    >
                                        {stockLoading ? (
                                            <div className="flex items-center justify-center py-4 text-gray-500">
                                                <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement du stock...
                                            </div>
                                        ) : stockSummary ? (
                                            <>
                                                <div className="grid grid-cols-3 gap-3 mb-3">
                                                    <div className="p-3 rounded border border-gray-100 bg-green-50">
                                                        <div className="text-xs text-gray-500">Stock total</div>
                                                        <div className="font-semibold text-green-700 text-lg">{stockSummary.total_stock || 0}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-blue-50">
                                                        <div className="text-xs text-gray-500">Disponible</div>
                                                        <div className="font-semibold text-blue-700 text-lg">{stockSummary.available_stock || 0}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-orange-50">
                                                        <div className="text-xs text-gray-500">Réservé</div>
                                                        <div className="font-semibold text-orange-700 text-lg">{stockSummary.reserved_stock || 0}</div>
                                                    </div>
                                                </div>
                                                {stocksByBranch.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-semibold text-gray-700">Par succursale</div>
                                                        {stocksByBranch.map((stock: any) => (
                                                            <div key={stock.id} className="p-2 rounded border border-gray-200 bg-white">
                                                                <div className="flex justify-between items-center">
                                                                    <div className="text-sm font-medium text-gray-900">{stock.branch?.name || stock.branch_code}</div>
                                                                    <div className="text-sm text-gray-600">
                                                                        <span className="font-semibold text-green-600">{stock.available_quantity || 0}</span>
                                                                        <span className="text-gray-400 mx-1">/</span>
                                                                        <span>{stock.quantity || 0}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500 text-sm">Aucune information de stock disponible</div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Suppliers Section */}
                                {!isEditMode && details?.suppliers && details.suppliers.length > 0 && (
                                    <div ref={el => { sectionRefs.current['suppliers'] = el; }}>
                                        <SageCollapsible
                                            title="Fournisseurs"
                                            isOpen={openSections['suppliers']}
                                            onOpenChange={(open) => toggleSection('suppliers', open)}
                                        >
                                            <div className="space-y-2">
                                                {details.suppliers.map((supplierData: any, index: number) => (
                                                    <div key={index} className="p-3 rounded border border-gray-200 bg-gray-50">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h4 className="font-semibold text-gray-900">{supplierData.supplier?.name || 'Fournisseur'}</h4>
                                                            {supplierData.is_preferred && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded font-medium">
                                                                    Préféré
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-2 text-sm">
                                                            {supplierData.cost && (
                                                                <div>
                                                                    <div className="text-xs text-gray-500">Coût</div>
                                                                    <div className="font-semibold text-gray-900">{parseFloat(supplierData.cost).toFixed(2)} MAD</div>
                                                                </div>
                                                            )}
                                                            {supplierData.min_quantity && (
                                                                <div>
                                                                    <div className="text-xs text-gray-500">Qté min.</div>
                                                                    <div className="font-semibold text-gray-900">{supplierData.min_quantity}</div>
                                                                </div>
                                                            )}
                                                            {supplierData.lead_time_days && (
                                                                <div>
                                                                    <div className="text-xs text-gray-500">Délai (jours)</div>
                                                                    <div className="font-semibold text-gray-900">{supplierData.lead_time_days}</div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </SageCollapsible>
                                    </div>
                                )}

                                {/* Media Section */}
                                <div ref={el => { sectionRefs.current['media'] = el; }}>
                                    <SageCollapsible
                                        title="Médias"
                                        isOpen={openSections['media']}
                                        onOpenChange={(open) => toggleSection('media', open)}
                                    >
                                        {isEditMode ? (
                                            <div className="space-y-4">
                                                <FileUpload
                                                    label="Image principale"
                                                    value={formData.thumbnail || null}
                                                    onChange={(file) => setFormData({...formData, thumbnail: file})}
                                                    accept="image/*"
                                                    multiple={false}
                                                    maxSize={2}
                                                    showPreview={true}
                                                    currentImages={detailData?.data?.thumbnail ? [{
                                                        id: detailData.data.thumbnail.id,
                                                        url: detailData.data.thumbnail.url,
                                                        name: 'Image principale'
                                                    }] : []}
                                                    helperText="PNG, JPG, JPEG ou WEBP (max 2MB)"
                                                />
                                                
                                                <FileUpload
                                                    label="Images supplémentaires"
                                                    value={formData.additionThumbnail || null}
                                                    onChange={(files) => setFormData({...formData, additionThumbnail: files})}
                                                    accept="image/*"
                                                    multiple={true}
                                                    maxSize={2}
                                                    maxFiles={10}
                                                    showPreview={true}
                                                    currentImages={detailData?.data?.additional_thumbnails?.map((thumb: any, idx: number) => ({
                                                        id: thumb.id,
                                                        url: thumb.url || thumb.thumbnail,
                                                        name: `Image ${idx + 1}`
                                                    })) || []}
                                                    helperText="Vous pouvez télécharger jusqu'à 10 images supplémentaires"
                                                />
                                            </div>
                                        ) : (detailData?.data?.thumbnail || detailData?.data?.thumbnails?.length > 0 || detailData?.data?.additional_thumbnails?.length > 0) ? (
                                            <div className="space-y-6">
                                                {/* Main Thumbnail */}
                                                {details?.thumbnail && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-sm font-semibold text-gray-900">Image principale</h4>
                                                        </div>
                                                        <div 
                                                            className="relative w-full h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                                                            onClick={() => {
                                                                setSelectedImage(details.thumbnail);
                                                                setShowLightbox(true);
                                                            }}
                                                        >
                                                            <img 
                                                                src={details.thumbnail} 
                                                                alt={details.name}
                                                                className="w-full h-full object-contain p-4 transition-transform duration-200 group-hover:scale-105"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                                                }}
                                                            />
                                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
                                                                    <ZoomIn className="w-6 h-6 text-gray-700" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Gallery Thumbnails */}
                                                {detailData?.data?.thumbnails && detailData.data.thumbnails.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-sm font-semibold text-gray-900">Galerie</h4>
                                                            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{detailData.data.thumbnails.length} {detailData.data.thumbnails.length > 1 ? 'images' : 'image'}</span>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-3">
                                                            {detailData.data.thumbnails.map((thumb: any, index: number) => (
                                                                <div 
                                                                    key={thumb.id || index} 
                                                                    className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer group hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                                                                    onClick={() => {
                                                                        setSelectedImage(thumb.thumbnail || thumb.url);
                                                                        setShowLightbox(true);
                                                                    }}
                                                                >
                                                                    <img 
                                                                        src={thumb.thumbnail || thumb.url} 
                                                                        alt={`Image ${index + 1}`}
                                                                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                                                        onError={(e) => {
                                                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
                                                                        }}
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                            <Maximize2 className="w-5 h-5 text-white drop-shadow-lg" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Additional Images */}
                                                {detailData?.data?.additional_thumbnails && detailData.data.additional_thumbnails.length > 0 && (
                                                    <div>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <h4 className="text-sm font-semibold text-gray-900">Images supplémentaires</h4>
                                                            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{detailData.data.additional_thumbnails.length} {detailData.data.additional_thumbnails.length > 1 ? 'images' : 'image'}</span>
                                                        </div>
                                                        <div className="grid grid-cols-4 gap-3">
                                                            {detailData.data.additional_thumbnails.map((thumb: any, index: number) => (
                                                                <div 
                                                                    key={thumb.id || index} 
                                                                    className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer group hover:border-blue-400 hover:shadow-lg transition-all duration-200"
                                                                    onClick={() => {
                                                                        setSelectedImage(thumb.thumbnail || thumb.url);
                                                                        setShowLightbox(true);
                                                                    }}
                                                                >
                                                                    <img 
                                                                        src={thumb.thumbnail || thumb.url} 
                                                                        alt={`Additional ${index + 1}`}
                                                                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-110"
                                                                    />
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 flex items-center justify-center">
                                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                                            <Maximize2 className="w-5 h-5 text-white drop-shadow-lg" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-8 text-gray-400">
                                                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">Aucune image disponible</p>
                                            </div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Custom Fields Section */}
                                <div ref={el => { sectionRefs.current['custom_fields'] = el; }}>
                                    <SageCollapsible
                                        title="Champs personnalisés"
                                        isOpen={openSections['custom_fields'] ?? true}
                                        onOpenChange={(open) => toggleSection('custom_fields', open)}
                                    >
                                        {isEditMode && Object.keys(customFields).length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(customFields).map(([key, field]: [string, any]) => (
                                                    <div key={key}>
                                                        <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                                                        {field.type === 'checkbox' ? (
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.custom_fields?.[key] === true || formData.custom_fields?.[key] === '1'}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    custom_fields: {
                                                                        ...formData.custom_fields,
                                                                        [key]: e.target.checked
                                                                    }
                                                                })}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                        ) : field.type === 'select' && field.options ? (
                                                            <select
                                                                value={formData.custom_fields?.[key] || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    custom_fields: {
                                                                        ...formData.custom_fields,
                                                                        [key]: e.target.value
                                                                    }
                                                                })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            >
                                                                <option value="">Sélectionner...</option>
                                                                {field.options.map((opt: string) => (
                                                                    <option key={opt} value={opt}>{opt}</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={formData.custom_fields?.[key] || ''}
                                                                onChange={(e) => setFormData({
                                                                    ...formData,
                                                                    custom_fields: {
                                                                        ...formData.custom_fields,
                                                                        [key]: e.target.value
                                                                    }
                                                                })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                            />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : !isEditMode && Object.keys(customFields).length > 0 ? (
                                            <div className="grid grid-cols-2 gap-3">
                                                {Object.entries(customFields).map(([key, field]: [string, any]) => (
                                                    <div key={key} className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">{field.label}</div>
                                                        <div className="font-semibold text-gray-900">
                                                            {field.type === 'checkbox' 
                                                                ? (field.value === '1' || field.value === true ? 'Oui' : 'Non')
                                                                : (field.formatted_value || field.value || '-')
                                                            }
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500 text-sm">Aucun champ personnalisé disponible</div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Flags & Marketing Section */}
                                <div ref={el => { sectionRefs.current['flags'] = el; }}>
                                    <SageCollapsible
                                        title="Options & Marketing"
                                        isOpen={openSections['flags'] ?? false}
                                        onOpenChange={(open) => toggleSection('flags', open)}
                                    >
                                        {isEditMode ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-700 mb-2">Options de gestion</div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_salable ?? true}
                                                                onChange={(e) => setFormData({...formData, is_salable: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Vendable</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_returnable ?? true}
                                                                onChange={(e) => setFormData({...formData, is_returnable: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Retournable</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_discountable ?? true}
                                                                onChange={(e) => setFormData({...formData, is_discountable: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Remisable</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_expirable ?? false}
                                                                onChange={(e) => setFormData({...formData, is_expirable: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Périssable</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_backorder_allowed ?? true}
                                                                onChange={(e) => setFormData({...formData, is_backorder_allowed: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Commande en rupture</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_weight_managed ?? true}
                                                                onChange={(e) => setFormData({...formData, is_weight_managed: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Géré par poids</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-700 mb-2">Options marketing</div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_featured ?? false}
                                                                onChange={(e) => setFormData({...formData, is_featured: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Produit vedette</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_quotation_required ?? false}
                                                                onChange={(e) => setFormData({...formData, is_quotation_required: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Devis requis</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.is_visible_individually ?? true}
                                                                onChange={(e) => setFormData({...formData, is_visible_individually: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Visible individuellement</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 text-sm">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.requires_login_to_view ?? false}
                                                                onChange={(e) => setFormData({...formData, requires_login_to_view: e.target.checked})}
                                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                                            />
                                                            <span>Connexion requise</span>
                                                        </label>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-gray-700 mb-2">SEO & Métadonnées</div>
                                                    <div className="space-y-3">
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Titre SEO</label>
                                                            <input
                                                                type="text"
                                                                value={formData.meta_title || ''}
                                                                onChange={(e) => setFormData({...formData, meta_title: e.target.value})}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="Titre pour les moteurs de recherche"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Description SEO</label>
                                                            <textarea
                                                                value={formData.meta_description || ''}
                                                                onChange={(e) => setFormData({...formData, meta_description: e.target.value})}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                rows={2}
                                                                placeholder="Description pour les moteurs de recherche"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Mots-clés SEO</label>
                                                            <input
                                                                type="text"
                                                                value={formData.meta_keywords || ''}
                                                                onChange={(e) => setFormData({...formData, meta_keywords: e.target.value})}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                                placeholder="mot1, mot2, mot3"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (details?.flags || details?.marketing) ? (
                                            <div className="space-y-4">
                                                {details?.flags && (
                                                    <div>
                                                        <div className="text-xs font-semibold text-gray-700 mb-2">Options de gestion</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {details.flags.is_salable && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Vendable</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_returnable && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Retournable</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_discountable && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Remisable</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_batch_managed && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Gestion par lot</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_serialized && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Sérialisé</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_expirable && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Périssable</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_weight_managed && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Gestion par poids</span>
                                                                </div>
                                                            )}
                                                            {details.flags.is_backorder_allowed && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                                    <span>Commande en rupture</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                {details?.marketing && (
                                                    <div>
                                                        <div className="text-xs font-semibold text-gray-700 mb-2">Marketing</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {details.marketing.is_featured && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                                                    <span>En vedette</span>
                                                                </div>
                                                            )}
                                                            {details.marketing.is_visible_individually && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                                                    <span>Visible individuellement</span>
                                                                </div>
                                                            )}
                                                            {details.marketing.is_free_good && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                                                    <span>Produit gratuit</span>
                                                                </div>
                                                            )}
                                                            {details.marketing.is_quotation_required && (
                                                                <div className="flex items-center gap-2 text-sm">
                                                                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                                                    <span>Devis requis</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500 text-sm">Aucune information disponible</div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* Categories Section */}
                                <div ref={el => { sectionRefs.current['categories'] = el; }}>
                                    <SageCollapsible
                                        title="Catégories"
                                        isOpen={openSections['categories']}
                                        onOpenChange={(open) => toggleSection('categories', open)}
                                    >
                                        {details?.categories && details.categories.length > 0 ? (
                                            <div className="flex flex-wrap gap-2">
                                                {details.categories.map((cat: any) => (
                                                    <span key={cat.id} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                                                        {cat.name}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 text-gray-500 text-sm">Aucune catégorie assignée</div>
                                        )}
                                    </SageCollapsible>
                                </div>
                            </div>
                        </div>
                    )}

                    {!showDetailPanel && selectedProducts.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Package className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Gestion des Produits</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Double-cliquez sur un produit pour voir ses détails.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: RefreshCw,
                                    label: 'Rafraîchir',
                                    variant: 'sage',
                                    onClick: refetch,
                                },
                                {
                                    icon: Plus,
                                    label: 'Nouveau produit',
                                    variant: 'primary',
                                    onClick: handleCreateNew,
                                    disabled: isEditMode,
                                },
                            ],
                        },
                        {
                            items: [
                                ...(isEditMode ? [{
                                    icon: CheckCircle2,
                                    label: 'Enregistrer',
                                    variant: 'primary' as const,
                                    onClick: handleSave,
                                    disabled: creating || updating,
                                }] : []),
                                {
                                    icon: Edit,
                                    label: isEditMode ? 'Annuler' : 'Modifier',
                                    variant: 'default' as const,
                                    onClick: isEditMode ? handleCancelEdit : handleEdit,
                                    disabled: !selected && !isCreateMode,
                                },
                                ...(!isEditMode ? [
                                    {
                                        icon: CheckCircle2,
                                        label: 'Approuver',
                                        variant: 'default' as const,
                                        onClick: handleApprove,
                                        disabled: !selected || detailLoading || details?.is_approve || approving,
                                    },
                                    {
                                        icon: details?.is_active ? XCircle : CheckCircle2,
                                        label: details?.is_active ? 'Désactiver' : 'Activer',
                                        variant: 'default' as const,
                                        onClick: handleToggleStatus,
                                        disabled: !selected || detailLoading || !details?.is_approve || toggling,
                                    },
                                    {
                                        icon: Trash2,
                                        label: 'Supprimer',
                                        variant: 'default' as const,
                                        onClick: handleDelete,
                                        disabled: !selected || deleting,
                                    },
                                    {
                                        icon: BarChart3,
                                        label: 'Statistiques',
                                        variant: 'default' as const,
                                        onClick: () => toast('Fonctionnalité à venir', { icon: 'ℹ️' }),
                                    },
                                ] : []),
                            ],
                        },
                    ]}
                />
            }
        />

        {/* Image Lightbox Modal */}
        {showLightbox && selectedImage && (
            <div 
                className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
                onClick={() => setShowLightbox(false)}
            >
                <button
                    onClick={() => setShowLightbox(false)}
                    className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors duration-200 group"
                    aria-label="Close"
                >
                    <X className="w-6 h-6 text-white" />
                </button>
                <div 
                    className="relative max-w-7xl max-h-[90vh] w-full h-full flex items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img 
                        src={selectedImage} 
                        alt="Preview"
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                </div>
            </div>
        )}
        </>
    );
};
