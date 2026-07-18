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
    Maximize2,
    Layers,
    Globe,
    Truck,
    Upload,
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
    useProductFormMetadata,
    useProductPackagings,
    useCreatePackaging,
    useUpdatePackaging,
    useDeletePackaging,
    useProductTranslations,
    useCreateTranslation,
    useUpdateTranslation,
    useDeleteTranslation,
    useProductLogistics,
    useUpdateLogistics,
    useProductSuppliers,
    useCreateProductSupplier,
    useUpdateProductSupplier,
    useDeleteProductSupplier,
    useProductRetailPrice,
    useUpdateRetailPrice,
    useProductFlags,
    useUpdateProductFlags,
    useProductMarketing,
    useUpdateProductMarketing,
    useProductSalesGroups,
    useProductPages,
    useCategoriesList,
    useSubcategoriesList,
    useProductCategories,
    useUpdateProductCategories,
    useProductSubcategories,
    useUpdateProductSubcategories,
    useProductVatTaxesFacet,
    useUpdateProductVatTaxes,
    useProductPageFacet,
    useUpdateProductPageFacet,
    useProductSalesGroupFacet,
    useUpdateProductSalesGroupFacet,
    useUpdateProductBrand,
    useUpdateProductUnit,
} from '@/hooks/products/useProducts';
import type { Product, ProductFilters } from '@/types/product.types';
import { productsApi } from '@/services/api/productsApi';
import { ActionPanel } from '@/components/layout/ActionPanel';

export const ProductsPage = () => {
    const [selected, setSelected] = useState<Product | null>(null);
    const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
    const [filters] = useState<ProductFilters>({ page: 1, per_page: 20 });
    const [activeTab, setActiveTab] = useState<string>('info');
    const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isCreateMode, setIsCreateMode] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showLightbox, setShowLightbox] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        classification: true,
        pricing: true,
        price_lists: false,
        stock: true,
        suppliers: true,
        media: true,
        custom_fields: false,
        flags: true,
        marketing: true,
        packagings: true,
        translations: false,
        logistics: true,
    });
    const [packagingForm, setPackagingForm] = useState<any>({
        id: null,
        unit_id: '',
        quantity: '',
        is_default: false,
        packaging_level_id: '',
    });
    const [editingPackagingId, setEditingPackagingId] = useState<number | null>(null);
    const [translationForm, setTranslationForm] = useState<any>({ lang: '', name: '', short_description: '', description: '' });
    const [editingTranslationLang, setEditingTranslationLang] = useState<string | null>(null);
    const [isAddingTranslation, setIsAddingTranslation] = useState(false);
    const [logisticsForm, setLogisticsForm] = useState<any>({
        shipping_level: '',
        stackable: false,
        fragile: false,
        temperature_controlled: false,
        transport_category: '',
    });
    const [isEditingLogistics, setIsEditingLogistics] = useState(false);
    const [supplierForm, setSupplierForm] = useState<any>({
        supplier_id: '',
        cost_price: '',
        min_order_qty: '',
        lead_time_days: '',
        preferred: false,
    });
    const [editingSupplierId, setEditingSupplierId] = useState<number | null>(null);
    const [uploadingMainImage, setUploadingMainImage] = useState(false);
    const [uploadingGalleryImages, setUploadingGalleryImages] = useState(false);
    const [deletingGalleryImage, setDeletingGalleryImage] = useState<number | null>(null);

    // ── Per-facet inline edit states ─────────────────────────────────────────
    const [editingCategoryIds, setEditingCategoryIds] = useState<number[]>([]);
    const [isEditingCategories, setIsEditingCategories] = useState(false);
    const [editingSubcategoryIds, setEditingSubcategoryIds] = useState<number[]>([]);
    const [isEditingSubcategories, setIsEditingSubcategories] = useState(false);
    const [editingVatTaxIds, setEditingVatTaxIds] = useState<number[]>([]);
    const [isEditingVatTaxes, setIsEditingVatTaxes] = useState(false);
    const [editingProductPageCode, setEditingProductPageCode] = useState<string>('');
    const [isEditingProductPage, setIsEditingProductPage] = useState(false);
    const [editingSalesGroupCode, setEditingSalesGroupCode] = useState<string>('');
    const [isEditingSalesGroup, setIsEditingSalesGroup] = useState(false);
    const [editingBrandId, setEditingBrandId] = useState<string>('');
    const [isEditingBrand, setIsEditingBrand] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState<string>('');
    const [isEditingUnit, setIsEditingUnit] = useState(false);
    const [retailPriceForm, setRetailPriceForm] = useState({ price_ht: '', price_ttc: '', discount_price: '', ttc_pricing: false });
    const [isEditingRetailPrice, setIsEditingRetailPrice] = useState(false);
    const [flagsForm, setFlagsForm] = useState<Record<string, any>>({});
    const [isEditingFlags, setIsEditingFlags] = useState(false);
    const [marketingForm, setMarketingForm] = useState<Record<string, any>>({});
    const [isEditingMarketing, setIsEditingMarketing] = useState(false);

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useProductsList(filters);
    const products = data?.data?.data || [];

    const { data: statsData } = useProductStatistics();
    const stats = statsData?.data || {
        total_products: 0,
        active_products: 0,
        pending_approval: 0,
        out_of_stock: 0,
        low_stock: 0,
    };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useProductDetail(selected?.id ?? null);
    const { data: stockData, loading: stockLoading } = useProductStock(selected?.id ?? null);
    const { data: metadata, loading: metadataLoading } = useProductFormMetadata();
    const { data: packagingsData, loading: packagingsLoading, refetch: refetchPackagings } = useProductPackagings(selected?.id ?? null);
    const { data: translationsData, loading: translationsLoading, refetch: refetchTranslations } = useProductTranslations(selected?.id ?? null);
    const { data: logisticsData, loading: logisticsLoading, refetch: refetchLogistics } = useProductLogistics(selected?.id ?? null);
    const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useProductSuppliers(selected?.id ?? null);
    const { approve, loading: approving } = useApproveProduct();
    const { toggleStatus, loading: toggling } = useToggleProductStatus();
    const { deleteProduct, loading: deleting } = useDeleteProduct();
    const { create, loading: creating } = useCreateProduct();
    const { update, loading: updating } = useUpdateProduct();
    const { create: createPackaging, loading: creatingPackaging } = useCreatePackaging();
    const { update: updatePackaging, loading: updatingPackaging } = useUpdatePackaging();
    const { deletePackaging, loading: deletingPackaging } = useDeletePackaging();
    const { create: createTranslation, loading: creatingTranslation } = useCreateTranslation();
    const { update: updateTranslation, loading: updatingTranslation } = useUpdateTranslation();
    const { deleteTranslation, loading: deletingTranslation } = useDeleteTranslation();
    const { update: updateLogistics, loading: updatingLogistics } = useUpdateLogistics();
    const { create: createProductSupplier, loading: creatingSupplier } = useCreateProductSupplier();
    const { update: updateProductSupplier, loading: updatingSupplier } = useUpdateProductSupplier();
    const { deleteSupplier: deleteProductSupplier, loading: deletingSupplier } = useDeleteProductSupplier();

    // ── Facet hooks ───────────────────────────────────────────────────────────
    const { data: retailPriceData, refetch: refetchRetailPrice } = useProductRetailPrice(selected?.id ?? null);
    const { update: updateRetailPrice, loading: updatingRetailPrice } = useUpdateRetailPrice();
    const { data: flagsData, refetch: refetchFlags } = useProductFlags(selected?.id ?? null);
    const { update: updateFlags, loading: updatingFlags } = useUpdateProductFlags();
    const { data: marketingData, refetch: refetchMarketing } = useProductMarketing(selected?.id ?? null);
    const { update: updateMarketing, loading: updatingMarketing } = useUpdateProductMarketing();
    const { data: salesGroupsData } = useProductSalesGroups();
    const { data: productPagesData } = useProductPages();
    const { data: categoriesListData } = useCategoriesList();
    const { data: subcategoriesListData } = useSubcategoriesList();
    const { update: updateCategories, loading: updatingCategories } = useUpdateProductCategories();
    const { data: productCategories, loading: categoriesLoadingFacet, refetch: refetchCategories } = useProductCategories(selected?.id ?? null);
    const { data: productSubcategories, loading: subcategoriesLoading, refetch: refetchSubcategories } = useProductSubcategories(selected?.id ?? null);
    const { update: updateSubcategories, loading: updatingSubcategories } = useUpdateProductSubcategories();
    const { data: productVatTaxesFacet, loading: vatTaxesFacetLoading, refetch: refetchVatTaxesFacet } = useProductVatTaxesFacet(selected?.id ?? null);
    const { update: updateVatTaxesFacet, loading: updatingVatTaxesFacet } = useUpdateProductVatTaxes();
    const { data: productPageFacet, loading: productPageFacetLoading, refetch: refetchProductPage } = useProductPageFacet(selected?.id ?? null);
    const { update: updateProductPage, loading: updatingProductPage } = useUpdateProductPageFacet();
    const { data: salesGroupFacet, loading: salesGroupFacetLoading, refetch: refetchSalesGroup } = useProductSalesGroupFacet(selected?.id ?? null);
    const { update: updateSalesGroup, loading: updatingSalesGroup } = useUpdateProductSalesGroupFacet();
    const { update: updateBrand, loading: updatingBrand } = useUpdateProductBrand();
    const { update: updateUnit, loading: updatingUnit } = useUpdateProductUnit();

    const productSuppliers = suppliersData?.suppliers ?? suppliersData?.data ?? [];

    const details = detailData?.data?.product || selected;
    const customFields = detailData?.data?.custom_fields || {};
    const stockSummary = stockData?.data || detailData?.data?.stock_summary;
    const stocksByBranch = (stockSummary as any)?.stocks_by_branch || (stockSummary as any)?.by_branch || details?.stocks || [];

    // Retail price comes from the dedicated retail_price object (§5 — products.price was dropped)
    const retailPriceObj = (retailPriceData as any)?.data?.retail_price
        ?? (retailPriceData as any)?.retail_price
        ?? details?.retail_price
        ?? null;
    const currentPriceHt = retailPriceObj?.price_ht ?? retailPriceObj?.price_ttc ?? null;
    const currentFlags = (flagsData as any)?.data?.flags ?? (flagsData as any)?.flags ?? details?.flags ?? null;
    const currentMarketing = (marketingData as any)?.data?.marketing ?? (marketingData as any)?.marketing ?? details?.marketing ?? null;

    const allSalesGroups: any[] = (salesGroupsData as any)?.data ?? (salesGroupsData as any)?.product_sales_groups ?? [];
    const allProductPages: any[] = (productPagesData as any)?.data ?? (productPagesData as any)?.product_pages ?? [];

    const meta = metadata as any;
    const brands: any[]    = meta?.data?.brands    || meta?.brands    || [];
    const units: any[]     = meta?.data?.units     || meta?.units     || [];
    const vatTaxes: any[]  = meta?.data?.vat_taxes || meta?.vat_taxes || [];
    const suppliers: any[] = meta?.data?.suppliers || meta?.suppliers || [];

    // Categories picker: dedicated endpoint first, then create-bundle fallback, then metadata direct
    const metaBundleCategories: any[] =
        meta?.data?.categories    ||   // { success, data: { categories } }
        meta?.categories          ||   // { categories } no envelope
        meta?.data?.data?.categories|| // doubly nested
        [];
    // Final fallback: if the list endpoints returned nothing, use the product's own assigned categories
    // so the user can at least see (and deselect) what is currently assigned.
    const allCategories: any[] =
        categoriesListData.length > 0 ? categoriesListData :
        metaBundleCategories.length > 0 ? metaBundleCategories :
        (productCategories.length > 0 ? productCategories : []);
    const allSubcategories: any[] = subcategoriesListData.length > 0 ? subcategoriesListData : [];
    const packagings = packagingsData?.packagings ?? packagingsData?.data ?? [];
    const translations = translationsData?.translations ?? translationsData?.data ?? [];
    const logistics = logisticsData?.logistics ?? logisticsData?.data ?? null;

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
                headerName: 'Prix B2C HT',
                width: 130,
                valueGetter: (params: any) => {
                    const rp = params.data?.retail_price;
                    const val = rp?.price_ht ?? rp?.price_ttc ?? null;
                    return val !== null ? `${parseFloat(val).toFixed(2)} MAD` : '-';
                },
            },
            {
                headerName: 'Stock dispo',
                width: 110,
                valueGetter: (params: any) => {
                    const s = params.data?.stock_summary ?? params.data;
                    const qty = s?.available_stock ?? s?.available_quantity ?? null;
                    return qty !== null ? qty : '-';
                },
                cellStyle: (params: any) => {
                    const s = params.data?.stock_summary ?? params.data;
                    const qty = s?.available_stock ?? s?.available_quantity ?? null;
                    if (qty === null) return null;
                    if (qty === 0) return { color: '#dc2626' };
                    if (qty < 10) return { color: '#f59e0b' };
                    return { color: '#059669' };
                },
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
            { id: 'classification', label: 'Classification', icon: Tag },
            { id: 'pricing', label: 'Prix B2C', icon: DollarSign },
            { id: 'price_lists', label: 'Listes de prix B2B', icon: DollarSign },
            { id: 'stock', label: 'Stock', icon: Box },
            { id: 'suppliers', label: 'Fournisseurs', icon: Package },
            { id: 'packagings', label: 'Colisage', icon: Layers },
            { id: 'logistics', label: 'Logistique', icon: Truck },
            { id: 'flags', label: 'Options inventaire', icon: CheckCircle2 },
            { id: 'marketing', label: 'Marketing', icon: BarChart3 },
            { id: 'translations', label: 'Traductions', icon: Globe },
            { id: 'media', label: 'Médias', icon: ImageIcon },
            { id: 'custom_fields', label: 'Champs personnalisés', icon: Tag },
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
            brand_id: '',
            unit_id: '',
            short_description: '',
            description: '',
            buy_price: 0,
            category_ids: [],
            vat_tax_ids: [],
            supplier_ids: [],
            supplier_pivots: {},
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
        const supplierPivots: any = {};
        if (details?.suppliers && Array.isArray(details.suppliers)) {
            details.suppliers.forEach((supplier: any) => {
                supplierPivots[supplier.id] = {
                    cost_price: supplier.pivot?.cost_price || supplier.cost || 0,
                    min_order_qty: supplier.pivot?.min_order_qty || supplier.min_quantity || 0,
                    lead_time_days: supplier.pivot?.lead_time_days || supplier.lead_time_days || 0,
                    preferred: supplier.pivot?.preferred || supplier.is_preferred || false,
                };
            });
        }

        const editFormData: any = {
            // Basic Information
            name: details?.name || '',
            code: details?.code || '',
            short_description: details?.short_description || '',
            description: details?.description || '',
            barcode: details?.barcode || '',
            productpage_code: details?.productpage_code || '',

            // Pricing — retail_price (products.price/discount_price were dropped, §1)
            price: parseFloat(retailPriceObj?.price_ht ?? '0') || 0,
            discount_price: parseFloat(retailPriceObj?.discount_price ?? '0') || 0,
            ttc_pricing: retailPriceObj?.ttc_pricing ?? false,
            buy_price: details?.buy_price || 0,
            min_order_quantity: details?.min_order_quantity || 1,
            has_colisage: details?.has_colisage || false,

            // Relationships (IDs for API)
            brand_id: details?.brand_id || '',
            unit_id: details?.unit_id || '',
            category_ids: details?.categories?.map((c: any) => c.id) || [],
            vat_tax_ids: details?.vat_taxes?.map((v: any) => v.id) || details?.vatTaxes?.map((v: any) => v.id) || [],
            supplier_ids: details?.suppliers?.map((s: any) => s.id) || [],
            supplier_pivots: supplierPivots,

            // Product Flags (Inventory Management)
            decimal_quantity_allowed: details?.flags?.decimal_quantity_allowed ?? false,
            decimal_precision: details?.flags?.decimal_precision ?? 0,
            decimal_step: details?.flags?.decimal_step || '1.0000',
            is_backorder_allowed: details?.flags?.is_backorder_allowed ?? true,
            is_batch_managed: details?.flags?.is_batch_managed ?? false,
            is_consignment: details?.flags?.is_consignment ?? false,
            is_discountable: details?.flags?.is_discountable ?? true,
            is_expirable: details?.flags?.is_expirable ?? false,
            is_returnable: details?.flags?.is_returnable ?? true,
            is_salable: details?.flags?.is_salable ?? true,
            is_serialized: details?.flags?.is_serialized ?? false,
            is_weight_managed: details?.flags?.is_weight_managed ?? true,
            min_quantity_order: details?.flags?.min_quantity_order || '1.000',
            requires_preparation: details?.flags?.requires_preparation ?? true,
            delivery_unit: details?.flags?.delivery_unit || null,
            allow_partial_delivery: details?.flags?.allow_partial_delivery ?? true,

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

        if (isCreateMode && (!formData.price || formData.price <= 0)) {
            toast.error('Le prix doit être supérieur à 0');
            return;
        }

        if (formData.price > 0 && formData.discount_price && formData.discount_price >= formData.price) {
            toast.error('Le prix promotionnel doit être inférieur au prix normal');
            return;
        }

        const toastId = toast.loading(isCreateMode ? 'Création en cours...' : 'Mise à jour en cours...');

        try {
            // Prepare data for API
            const apiData: any = { ...formData };

            // Ensure relationship arrays are clean arrays of numbers
            ['category_ids', 'vat_tax_ids', 'supplier_ids'].forEach((key) => {
                if (!Array.isArray(apiData[key])) apiData[key] = [];
                apiData[key] = apiData[key].map((v: any) => typeof v === 'string' ? parseInt(v) : v).filter(Boolean);
            });

            // Remove UI-only helper objects not expected by the main product endpoint
            delete apiData.supplier_pivots;

            // Convert boolean values to 1/0 for the PHP backend FormData serialization
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

    const resetPackagingForm = () => {
        setPackagingForm({ id: null, unit_id: '', quantity: '', is_default: false, packaging_level_id: '' });
        setEditingPackagingId(null);
    };

    const handleSavePackaging = async () => {
        if (!selected?.id) return;
        if (!packagingForm.unit_id || !packagingForm.quantity) {
            toast.error('Unité et quantité sont obligatoires');
            return;
        }

        const toastId = toast.loading(editingPackagingId ? 'Mise à jour...' : 'Création...');
        try {
            const payload = {
                product_id: selected.id,
                unit_id: parseInt(packagingForm.unit_id),
                quantity: parseInt(packagingForm.quantity),
                is_default: !!packagingForm.is_default,
                packaging_level_id: packagingForm.packaging_level_id ? parseInt(packagingForm.packaging_level_id) : null,
            };

            let res;
            if (editingPackagingId) {
                res = await updatePackaging(editingPackagingId, payload);
            } else {
                res = await createPackaging(payload);
            }

            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || (editingPackagingId ? 'Colisage mis à jour' : 'Colisage créé'));
                resetPackagingForm();
                await refetchPackagings();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleEditPackaging = (pkg: any) => {
        setEditingPackagingId(pkg.id);
        setPackagingForm({
            id: pkg.id,
            unit_id: pkg.unit_id || '',
            quantity: pkg.quantity || '',
            is_default: pkg.is_default || false,
            packaging_level_id: pkg.packaging_level_id || '',
        });
    };

    const handleDeletePackagingItem = async (id: number) => {
        if (!confirm('Supprimer ce colisage ?')) return;
        const toastId = toast.loading('Suppression...');
        try {
            const res = await deletePackaging(id);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Colisage supprimé');
                await refetchPackagings();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const resetTranslationForm = () => {
        setTranslationForm({ lang: '', name: '', short_description: '', description: '' });
        setEditingTranslationLang(null);
        setIsAddingTranslation(false);
    };

    const handleSaveTranslation = async () => {
        if (!selected?.id || !translationForm.lang || !translationForm.name) {
            toast.error('Langue et nom sont obligatoires');
            return;
        }
        const toastId = toast.loading(editingTranslationLang ? 'Mise à jour...' : 'Création...');
        try {
            const payload = {
                lang: translationForm.lang,
                name: translationForm.name,
                short_description: translationForm.short_description || null,
                description: translationForm.description || null,
            };
            let res;
            if (editingTranslationLang) {
                res = await updateTranslation(selected.id, editingTranslationLang, payload);
            } else {
                res = await createTranslation(selected.id, payload);
            }
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || (editingTranslationLang ? 'Traduction mise à jour' : 'Traduction créée'));
                resetTranslationForm();
                await refetchTranslations();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleEditTranslation = (t: any) => {
        setEditingTranslationLang(t.lang);
        setIsAddingTranslation(true);
        setTranslationForm({
            lang: t.lang,
            name: t.name,
            short_description: t.short_description || '',
            description: t.description || '',
        });
    };

    const handleDeleteTranslationItem = async (lang: string) => {
        if (!selected?.id) return;
        if (!confirm('Supprimer cette traduction ?')) return;
        const toastId = toast.loading('Suppression...');
        try {
            const res = await deleteTranslation(selected.id, lang);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Traduction supprimée');
                await refetchTranslations();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleEditLogistics = () => {
        setIsEditingLogistics(true);
        setLogisticsForm({
            shipping_level: logistics?.shipping_level || '',
            stackable: logistics?.stackable ?? false,
            fragile: logistics?.fragile ?? false,
            temperature_controlled: logistics?.temperature_controlled ?? false,
            transport_category: logistics?.transport_category || '',
        });
    };

    const handleSaveLogistics = async () => {
        if (!selected?.id) return;
        const toastId = toast.loading('Mise à jour...');
        try {
            const VALID_SHIPPING_LEVELS = ['UNIT', 'CARTON', 'PALLET'];
            const payload: any = {
                stackable: !!logisticsForm.stackable,
                fragile: !!logisticsForm.fragile,
                temperature_controlled: !!logisticsForm.temperature_controlled,
            };
            if (logisticsForm.shipping_level && VALID_SHIPPING_LEVELS.includes(logisticsForm.shipping_level)) {
                payload.shipping_level = logisticsForm.shipping_level;
            }
            if (logisticsForm.transport_category?.trim()) {
                payload.transport_category = logisticsForm.transport_category.trim();
            }
            const res = await updateLogistics(selected.id, payload);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Profil logistique mis à jour');
                setIsEditingLogistics(false);
                await refetchLogistics();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const resetSupplierForm = () => {
        setSupplierForm({ supplier_id: '', cost_price: '', min_order_qty: '', lead_time_days: '', preferred: false });
        setEditingSupplierId(null);
    };

    const handleSaveSupplier = async () => {
        if (!selected?.id || !supplierForm.supplier_id) {
            toast.error('Veuillez sélectionner un fournisseur');
            return;
        }
        const toastId = toast.loading(editingSupplierId ? 'Mise à jour...' : 'Création...');
        try {
            const payload: any = {
                supplier_id: parseInt(supplierForm.supplier_id),
                cost_price: supplierForm.cost_price ? parseFloat(supplierForm.cost_price) : 0,
                min_order_qty: supplierForm.min_order_qty ? parseInt(supplierForm.min_order_qty) : 0,
                lead_time_days: supplierForm.lead_time_days ? parseInt(supplierForm.lead_time_days) : null,
                preferred: !!supplierForm.preferred,
            };
            let res;
            if (editingSupplierId) {
                res = await updateProductSupplier(selected.id, editingSupplierId, payload);
            } else {
                res = await createProductSupplier(selected.id, payload);
            }
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || (editingSupplierId ? 'Fournisseur mis à jour' : 'Fournisseur associé'));
                resetSupplierForm();
                await refetchSuppliers();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    const handleEditSupplier = (s: any) => {
        setEditingSupplierId(s.id);
        const pivot = s.pivot || {};
        setSupplierForm({
            supplier_id: s.id,
            cost_price: pivot.cost_price ?? '',
            min_order_qty: pivot.min_order_qty ?? '',
            lead_time_days: pivot.lead_time_days ?? '',
            preferred: pivot.preferred ?? false,
        });
    };

    const handleDeleteSupplierItem = async (supplierId: number) => {
        if (!selected?.id) return;
        if (!confirm('Supprimer ce fournisseur du produit ?')) return;
        const toastId = toast.loading('Suppression...');
        try {
            const res = await deleteProductSupplier(selected.id, supplierId);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Fournisseur dissocié');
                await refetchSuppliers();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        }
    };

    // ── Facet save handlers ───────────────────────────────────────────────────

    const handleSaveCategories = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour des catégories...');
        try {
            const res = await updateCategories(selected.id, editingCategoryIds);
            toast.dismiss(tid);
            if (res.success) { toast.success('Catégories mises à jour'); setIsEditingCategories(false); await refetchCategories(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveSubcategories = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour des sous-catégories...');
        try {
            const res = await updateSubcategories(selected.id, editingSubcategoryIds);
            toast.dismiss(tid);
            if (res.success) { toast.success('Sous-catégories mises à jour'); setIsEditingSubcategories(false); await refetchSubcategories(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveVatTaxes = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour de la TVA...');
        try {
            const res = await updateVatTaxesFacet(selected.id, editingVatTaxIds);
            toast.dismiss(tid);
            if (res.success) { toast.success('TVA mise à jour'); setIsEditingVatTaxes(false); await refetchVatTaxesFacet(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveProductPage = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour de la page produit...');
        try {
            const res = await updateProductPage(selected.id, editingProductPageCode || null);
            toast.dismiss(tid);
            if (res.success) { toast.success('Page produit mise à jour'); setIsEditingProductPage(false); await refetchProductPage(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveSalesGroup = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour du groupe vente...');
        try {
            const res = await updateSalesGroup(selected.id, editingSalesGroupCode || null);
            toast.dismiss(tid);
            if (res.success) { toast.success('Groupe vente mis à jour'); setIsEditingSalesGroup(false); await refetchSalesGroup(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveBrand = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour de la marque...');
        try {
            const res = await updateBrand(selected.id, editingBrandId ? parseInt(editingBrandId) : null);
            toast.dismiss(tid);
            if (res.success) { toast.success('Marque mise à jour'); setIsEditingBrand(false); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveUnit = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour de l\'unité...');
        try {
            const res = await updateUnit(selected.id, editingUnitId ? parseInt(editingUnitId) : null);
            toast.dismiss(tid);
            if (res.success) { toast.success('Unité mise à jour'); setIsEditingUnit(false); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveRetailPrice = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour du prix B2C...');
        try {
            const payload: any = { ttc_pricing: retailPriceForm.ttc_pricing };
            if (retailPriceForm.price_ht) payload.price_ht = parseFloat(retailPriceForm.price_ht);
            if (retailPriceForm.price_ttc) payload.price_ttc = parseFloat(retailPriceForm.price_ttc);
            if (retailPriceForm.discount_price) payload.discount_price = parseFloat(retailPriceForm.discount_price);
            const res = await updateRetailPrice(selected.id, payload);
            toast.dismiss(tid);
            if (res.success) { toast.success('Prix B2C mis à jour'); setIsEditingRetailPrice(false); await refetchRetailPrice(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveFlags = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour des options...');
        try {
            const res = await updateFlags(selected.id, flagsForm);
            toast.dismiss(tid);
            if (res.success) { toast.success('Options mises à jour'); setIsEditingFlags(false); await refetchFlags(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleSaveMarketing = async () => {
        if (!selected?.id) return;
        const tid = toast.loading('Mise à jour marketing...');
        try {
            const res = await updateMarketing(selected.id, marketingForm);
            toast.dismiss(tid);
            if (res.success) { toast.success('Marketing mis à jour'); setIsEditingMarketing(false); await refetchMarketing(); await refetchDetail(); }
            else toast.error(res.message || 'Erreur');
        } catch (e: any) { toast.dismiss(tid); toast.error(e?.response?.data?.message || e.message || 'Erreur'); }
    };

    const handleMainImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selected?.id || !e.target.files?.[0]) return;
        const file = e.target.files[0];
        setUploadingMainImage(true);
        const toastId = toast.loading('Mise à jour de l\'image principale...');
        try {
            const res = await productsApi.setMainImage(selected.id, file);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Image principale mise à jour');
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        } finally {
            setUploadingMainImage(false);
            e.target.value = '';
        }
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selected?.id || !e.target.files?.length) return;
        const files = Array.from(e.target.files);
        setUploadingGalleryImages(true);
        const toastId = toast.loading('Téléversement des images...');
        try {
            const res = await productsApi.uploadImages(selected.id, files);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Images ajoutées à la galerie');
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        } finally {
            setUploadingGalleryImages(false);
            e.target.value = '';
        }
    };

    const handleDeleteGalleryImage = async (mediaId: number) => {
        if (!selected?.id) return;
        if (!confirm('Supprimer cette image de la galerie ?')) return;
        setDeletingGalleryImage(mediaId);
        const toastId = toast.loading('Suppression...');
        try {
            const res = await productsApi.deleteThumbnail(selected.id, mediaId);
            toast.dismiss(toastId);
            if (res.success) {
                toast.success(res.message || 'Image supprimée');
                await refetchDetail();
            } else {
                toast.error(res.message || 'Erreur');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || e.message || 'Erreur');
        } finally {
            setDeletingGalleryImage(null);
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
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                            <h1 className="text-sm font-semibold text-gray-900">Gestion des Produits</h1>
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
                                                <div className="text-xl sm:text-2xl font-bold text-sage-600 whitespace-nowrap">
                                                    {currentPriceHt !== null ? parseFloat(currentPriceHt.toString()).toFixed(2) : '—'} <span className="text-xs sm:text-sm font-normal text-gray-400">MAD HT</span>
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
                                                                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                placeholder="Ex: PROD-001"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Nom *</label>
                                                            <input
                                                                type="text"
                                                                value={formData.name || ''}
                                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                placeholder="Nom du produit"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Marque *</label>
                                                            <select
                                                                value={formData.brand_id || ''}
                                                                onChange={(e) => setFormData({ ...formData, brand_id: e.target.value ? parseInt(e.target.value) : '' })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white"
                                                                disabled={metadataLoading}
                                                            >
                                                                <option value="">Sélectionner une marque...</option>
                                                                {brands.map((brand: any) => (
                                                                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs text-gray-500 mb-1">Unité *</label>
                                                            <select
                                                                value={formData.unit_id || ''}
                                                                onChange={(e) => setFormData({ ...formData, unit_id: e.target.value ? parseInt(e.target.value) : '' })}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white"
                                                                disabled={metadataLoading}
                                                            >
                                                                <option value="">Sélectionner une unité...</option>
                                                                {units.map((unit: any) => (
                                                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    </div>

                                                    {/* Categories */}
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Catégories</label>
                                                        <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto bg-white">
                                                            {allCategories.length === 0 ? (
                                                                <span className="text-xs text-gray-400">Aucune catégorie disponible</span>
                                                            ) : (
                                                                allCategories.map((cat: any) => (
                                                                    <label key={cat.id} className="flex items-center gap-2 text-sm py-1">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(formData.category_ids || []).includes(cat.id)}
                                                                            onChange={(e) => {
                                                                                const ids = new Set(formData.category_ids || []);
                                                                                if (e.target.checked) ids.add(cat.id);
                                                                                else ids.delete(cat.id);
                                                                                setFormData({ ...formData, category_ids: Array.from(ids) });
                                                                            }}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                        />
                                                                        <span>{cat.name}</span>
                                                                    </label>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* VAT Taxes */}
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Taxes TVA</label>
                                                        <div className="border border-gray-300 rounded-md p-2 max-h-32 overflow-y-auto bg-white">
                                                            {vatTaxes.length === 0 ? (
                                                                <span className="text-xs text-gray-400">Aucune taxe disponible</span>
                                                            ) : (
                                                                vatTaxes.map((tax: any) => (
                                                                    <label key={tax.id} className="flex items-center gap-2 text-sm py-1">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(formData.vat_tax_ids || []).includes(tax.id)}
                                                                            onChange={(e) => {
                                                                                const ids = new Set(formData.vat_tax_ids || []);
                                                                                if (e.target.checked) ids.add(tax.id);
                                                                                else ids.delete(tax.id);
                                                                                setFormData({ ...formData, vat_tax_ids: Array.from(ids) });
                                                                            }}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                        />
                                                                        <span>{tax.name} ({tax.percentage}%)</span>
                                                                    </label>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Description courte</label>
                                                        <textarea
                                                            value={formData.short_description || ''}
                                                            onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                            rows={2}
                                                            placeholder="Brève description"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Description complète *</label>
                                                        <RichTextEditor
                                                            value={formData.description || ''}
                                                            onChange={(value) => setFormData({ ...formData, description: value })}
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
                                                                    <span key={unit.id} className="px-2 py-1 bg-sage-100 text-sage-700 rounded text-xs font-medium">
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
                                                                onChange={() => { }}
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
                                                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Prix promotionnel (MAD)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.discount_price || ''}
                                                            onChange={(e) => setFormData({ ...formData, discount_price: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Prix d'achat (MAD)</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            value={formData.buy_price || ''}
                                                            onChange={(e) => setFormData({ ...formData, buy_price: parseFloat(e.target.value) || 0 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-500 mb-1">Qté min. commande</label>
                                                        <input
                                                            type="number"
                                                            value={formData.min_order_quantity || 1}
                                                            onChange={(e) => setFormData({ ...formData, min_order_quantity: parseInt(e.target.value) || 1 })}
                                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                            placeholder="1"
                                                            min="1"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                            <div className="text-xs text-gray-500">Prix HT (B2C)</div>
                                                            <div className="font-semibold text-gray-900">
                                                                {retailPriceObj?.price_ht ? `${parseFloat(retailPriceObj.price_ht).toFixed(2)} MAD` : <span className="text-gray-400 text-sm">—</span>}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                            <div className="text-xs text-gray-500">Prix TTC (B2C)</div>
                                                            <div className="font-semibold text-gray-900">
                                                                {retailPriceObj?.price_ttc ? `${parseFloat(retailPriceObj.price_ttc).toFixed(2)} MAD` : <span className="text-gray-400 text-sm">—</span>}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                            <div className="text-xs text-gray-500">Prix promo</div>
                                                            <div className="font-semibold text-gray-900">
                                                                {retailPriceObj?.discount_price ? `${parseFloat(retailPriceObj.discount_price).toFixed(2)} MAD` : <span className="text-gray-400 text-sm">—</span>}
                                                            </div>
                                                        </div>
                                                        <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                            <div className="text-xs text-gray-500">Référence prix</div>
                                                            <div className="font-semibold text-gray-900">
                                                                {retailPriceObj?.ttc_pricing ? 'TTC' : 'HT'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {!isEditMode && (
                                                        <div className="flex justify-end">
                                                            <button
                                                                onClick={() => {
                                                                    setRetailPriceForm({
                                                                        price_ht: retailPriceObj?.price_ht ?? '',
                                                                        price_ttc: retailPriceObj?.price_ttc ?? '',
                                                                        discount_price: retailPriceObj?.discount_price ?? '',
                                                                        ttc_pricing: retailPriceObj?.ttc_pricing ?? false,
                                                                    });
                                                                    setIsEditingRetailPrice(true);
                                                                }}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors"
                                                            >
                                                                <Edit className="w-3.5 h-3.5" /> Modifier le prix B2C
                                                            </button>
                                                        </div>
                                                    )}
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
                                                                <span className="text-xs bg-sage-100 text-sage-700 px-2 py-1 rounded">
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
                                                                                <div className="font-semibold text-sage-700">{parseFloat(detail.discount_rate).toFixed(2)}%</div>
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
                                                        <div className="p-3 rounded border border-gray-100 bg-sage-50">
                                                            <div className="text-xs text-gray-500">Disponible</div>
                                                            <div className="font-semibold text-sage-700 text-lg">{stockSummary.available_stock || 0}</div>
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
                                    <div ref={el => { sectionRefs.current['suppliers'] = el; }}>
                                        <SageCollapsible
                                            title="Fournisseurs"
                                            isOpen={openSections['suppliers']}
                                            onOpenChange={(open) => toggleSection('suppliers', open)}
                                        >
                                            {suppliersLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {productSuppliers.length === 0 ? (
                                                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                            Aucun fournisseur associé à ce produit.
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr className="bg-gray-50/80 border-b border-gray-200">
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Fournisseur</th>
                                                                        <th className="text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-28">Coût</th>
                                                                        <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Qté min</th>
                                                                        <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Délai</th>
                                                                        <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Préféré</th>
                                                                        {isEditMode && (
                                                                            <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Actions</th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {productSuppliers.map((s: any) => {
                                                                        const pivot = s.pivot || {};
                                                                        const cost = pivot.cost_price ?? s.cost;
                                                                        const minQty = pivot.min_order_qty ?? s.min_quantity;
                                                                        const leadTime = pivot.lead_time_days ?? s.lead_time_days;
                                                                        const preferred = pivot.preferred ?? s.is_preferred;
                                                                        return (
                                                                            <tr key={s.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                                                                                <td className="px-4 py-3">
                                                                                    <div className="flex items-center gap-2.5">
                                                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                                                                            <Package className="w-4 h-4 text-indigo-500" />
                                                                                        </div>
                                                                                        <span className="font-semibold text-sm text-gray-900">{s.supplier?.name || s.name || 'Fournisseur'}</span>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right">
                                                                                    <span className="text-sm font-semibold text-gray-900">{cost ? `${parseFloat(cost).toFixed(2)} MAD` : '-'}</span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className="text-sm text-gray-700">{minQty ?? '—'}</span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <span className="text-sm text-gray-700">{leadTime ?? '—'} <span className="text-xs text-gray-400">j</span></span>
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    {preferred ? (
                                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                                                                            <CheckCircle2 className="w-3 h-3" /> Oui
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-xs text-gray-400">—</span>
                                                                                    )}
                                                                                </td>
                                                                                {isEditMode && (
                                                                                    <td className="px-4 py-3 text-center">
                                                                                        <div className="flex items-center justify-center gap-1">
                                                                                            <button
                                                                                                onClick={() => handleEditSupplier(s)}
                                                                                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                                                                                title="Modifier"
                                                                                            >
                                                                                                <Edit className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() => handleDeleteSupplierItem(s.id)}
                                                                                                disabled={deletingSupplier}
                                                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                                                title="Supprimer"
                                                                                            >
                                                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                                            </button>
                                                                                        </div>
                                                                                    </td>
                                                                                )}
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {isEditMode && (
                                                        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                                                    <Plus className="w-3.5 h-3.5 text-sage-600" />
                                                                </div>
                                                                <div className="text-sm font-semibold text-gray-800">
                                                                    {editingSupplierId ? 'Modifier le fournisseur' : 'Associer un fournisseur'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-3">
                                                                <div className="sm:col-span-2">
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Fournisseur *</label>
                                                                    <select
                                                                        value={supplierForm.supplier_id}
                                                                        onChange={(e) => setSupplierForm({ ...supplierForm, supplier_id: e.target.value })}
                                                                        disabled={!!editingSupplierId}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:bg-gray-100 disabled:text-gray-500"
                                                                    >
                                                                        <option value="">Choisir...</option>
                                                                        {suppliers
                                                                            .filter((s: any) => editingSupplierId === s.id || !productSuppliers.some((ps: any) => ps.id === s.id))
                                                                            .map((s: any) => (
                                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                                            ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Coût (MAD)</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={supplierForm.cost_price}
                                                                        onChange={(e) => setSupplierForm({ ...supplierForm, cost_price: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="0.00"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Qté min</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={supplierForm.min_order_qty}
                                                                        onChange={(e) => setSupplierForm({ ...supplierForm, min_order_qty: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Délai (j)</label>
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        value={supplierForm.lead_time_days}
                                                                        onChange={(e) => setSupplierForm({ ...supplierForm, lead_time_days: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={supplierForm.preferred}
                                                                        onChange={(e) => setSupplierForm({ ...supplierForm, preferred: e.target.checked })}
                                                                        className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                    />
                                                                    <span className="text-sm text-gray-700">Fournisseur préféré</span>
                                                                </label>
                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        onClick={handleSaveSupplier}
                                                                        disabled={creatingSupplier || updatingSupplier}
                                                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors shadow-sm"
                                                                    >
                                                                        {creatingSupplier || updatingSupplier ? (
                                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                                        ) : editingSupplierId ? 'Mettre à jour' : 'Associer'}
                                                                    </button>
                                                                    {editingSupplierId && (
                                                                        <button
                                                                            onClick={resetSupplierForm}
                                                                            className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg transition-colors"
                                                                        >
                                                                            Annuler
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* Packagings Section */}
                                    <div ref={el => { sectionRefs.current['packagings'] = el; }}>
                                        <SageCollapsible
                                            title="Colisage"
                                            isOpen={openSections['packagings']}
                                            onOpenChange={(open) => toggleSection('packagings', open)}
                                        >
                                            {packagingsLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {/* Packagings table */}
                                                    {packagings.length === 0 ? (
                                                        <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                            Aucun colisage défini pour ce produit.
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr className="bg-gray-50/80 border-b border-gray-200">
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Unité</th>
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Quantité</th>
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Niveau</th>
                                                                        <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Défaut</th>
                                                                        {isEditMode && (
                                                                            <th className="text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-24">Actions</th>
                                                                        )}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {packagings.map((pkg: any) => (
                                                                        <tr key={pkg.id} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/60 transition-colors">
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center gap-2.5">
                                                                                    <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center shrink-0">
                                                                                        <Box className="w-4 h-4 text-sage-500" />
                                                                                    </div>
                                                                                    <span className="font-semibold text-sm text-gray-900">{pkg.unit?.name || 'Unité'}</span>
                                                                                </div>
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <span className="text-sm font-semibold text-gray-900">{pkg.quantity}</span>
                                                                                <span className="text-xs text-gray-400 ml-1">unités</span>
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                {pkg.packagingLevel?.packaging_level ? (
                                                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                                                                        {pkg.packagingLevel.packaging_level}
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400 italic">—</span>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-center">
                                                                                {pkg.is_default ? (
                                                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                                                                        <CheckCircle2 className="w-3 h-3" /> Défaut
                                                                                    </span>
                                                                                ) : (
                                                                                    <span className="text-xs text-gray-400">—</span>
                                                                                )}
                                                                            </td>
                                                                            {isEditMode && (
                                                                                <td className="px-4 py-3 text-center">
                                                                                    <div className="flex items-center justify-center gap-1">
                                                                                        <button
                                                                                            onClick={() => handleEditPackaging(pkg)}
                                                                                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                                                                            title="Modifier"
                                                                                        >
                                                                                            <Edit className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleDeletePackagingItem(pkg.id)}
                                                                                            disabled={deletingPackaging}
                                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                                                                            title="Supprimer"
                                                                                        >
                                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    </div>
                                                                                </td>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}

                                                    {/* Form */}
                                                    {isEditMode && (
                                                        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                                                    <Plus className="w-3.5 h-3.5 text-sage-600" />
                                                                </div>
                                                                <div className="text-sm font-semibold text-gray-800">
                                                                    {editingPackagingId ? 'Modifier le colisage' : 'Ajouter un colisage'}
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Unité *</label>
                                                                    <select
                                                                        value={packagingForm.unit_id}
                                                                        onChange={(e) => setPackagingForm({ ...packagingForm, unit_id: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                    >
                                                                        <option value="">Choisir...</option>
                                                                        {units.map((u: any) => (
                                                                            <option key={u.id} value={u.id}>{u.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Qté *</label>
                                                                    <input
                                                                        type="number"
                                                                        min="1"
                                                                        value={packagingForm.quantity}
                                                                        onChange={(e) => setPackagingForm({ ...packagingForm, quantity: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="Ex: 24"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Niveau</label>
                                                                    <select
                                                                        value={packagingForm.packaging_level_id}
                                                                        onChange={(e) => setPackagingForm({ ...packagingForm, packaging_level_id: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                    >
                                                                        <option value="">Auto</option>
                                                                        <option value="1">UNIT</option>
                                                                        <option value="2">CARTON</option>
                                                                        <option value="3">PALLET</option>
                                                                    </select>
                                                                </div>
                                                                <div className="flex items-end pb-2">
                                                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={packagingForm.is_default}
                                                                            onChange={(e) => setPackagingForm({ ...packagingForm, is_default: e.target.checked })}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                        />
                                                                        <span className="text-sm text-gray-700">Par défaut</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={handleSavePackaging}
                                                                    disabled={creatingPackaging || updatingPackaging}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors shadow-sm"
                                                                >
                                                                    {creatingPackaging || updatingPackaging ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : editingPackagingId ? 'Mettre à jour' : 'Ajouter'}
                                                                </button>
                                                                {editingPackagingId && (
                                                                    <button
                                                                        onClick={resetPackagingForm}
                                                                        className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg transition-colors"
                                                                    >
                                                                        Annuler
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* Translations Section */}
                                    <div ref={el => { sectionRefs.current['translations'] = el; }}>
                                        <SageCollapsible
                                            title="Traductions"
                                            isOpen={openSections['translations']}
                                            onOpenChange={(open) => toggleSection('translations', open)}
                                        >
                                            {translationsLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {/* Table of existing translations */}
                                                    {translations.length === 0 && !isAddingTranslation ? (
                                                        <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                            Aucune traduction définie.
                                                        </div>
                                                    ) : translations.length > 0 && (
                                                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full border-collapse">
                                                                <thead>
                                                                    <tr className="bg-gray-50/80 border-b border-gray-200">
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 w-20">Langue</th>
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5">Nom</th>
                                                                        <th className="text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider px-4 py-2.5 hidden sm:table-cell">Description courte</th>
                                                                        <th className="w-20 px-4 py-2.5"></th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {translations.map((t: any) => (
                                                                        <tr key={t.lang} className={`border-b border-gray-100 last:border-b-0 transition-colors ${editingTranslationLang === t.lang ? 'bg-sage-50/60' : 'hover:bg-gray-50/60'}`}>
                                                                            <td className="px-4 py-3">
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                                                                    {t.lang}
                                                                                </span>
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                                                                                {t.description && (
                                                                                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</div>
                                                                                )}
                                                                            </td>
                                                                            <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                                                                                {t.short_description || <span className="text-xs text-gray-400 italic">—</span>}
                                                                            </td>
                                                                            <td className="px-4 py-3">
                                                                                <div className="flex items-center justify-end gap-1">
                                                                                    <button
                                                                                        onClick={() => handleEditTranslation(t)}
                                                                                        className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                                                                                        title="Modifier"
                                                                                    >
                                                                                        <Edit className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                    <button
                                                                                        onClick={() => handleDeleteTranslationItem(t.lang)}
                                                                                        disabled={deletingTranslation}
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

                                                    {/* Add / Edit form */}
                                                    {isAddingTranslation ? (
                                                        <div className="bg-slate-50 border border-sage-200 rounded-xl p-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                                                        <Globe className="w-3.5 h-3.5 text-sage-600" />
                                                                    </div>
                                                                    <span className="text-sm font-semibold text-gray-800">
                                                                        {editingTranslationLang ? `Modifier — ${editingTranslationLang.toUpperCase()}` : 'Nouvelle traduction'}
                                                                    </span>
                                                                </div>
                                                                <button onClick={resetTranslationForm} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-3">
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Langue *</label>
                                                                    <select
                                                                        value={translationForm.lang}
                                                                        onChange={(e) => setTranslationForm({ ...translationForm, lang: e.target.value })}
                                                                        disabled={!!editingTranslationLang}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500 disabled:bg-gray-100 disabled:text-gray-500"
                                                                    >
                                                                        <option value="">Choisir...</option>
                                                                        <option value="fr">🇫🇷 Français</option>
                                                                        <option value="en">🇬🇧 English</option>
                                                                        <option value="ar">🇸🇦 العربية</option>
                                                                        <option value="es">🇪🇸 Español</option>
                                                                        <option value="de">🇩🇪 Deutsch</option>
                                                                        <option value="pt">🇵🇹 Português</option>
                                                                        <option value="it">🇮🇹 Italiano</option>
                                                                    </select>
                                                                </div>
                                                                <div className="sm:col-span-3">
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Nom *</label>
                                                                    <input
                                                                        type="text"
                                                                        value={translationForm.name}
                                                                        onChange={(e) => setTranslationForm({ ...translationForm, name: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="Nom du produit dans cette langue"
                                                                    />
                                                                </div>
                                                                <div className="sm:col-span-2">
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Description courte</label>
                                                                    <input
                                                                        type="text"
                                                                        value={translationForm.short_description}
                                                                        onChange={(e) => setTranslationForm({ ...translationForm, short_description: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="Sous-titre / accroche"
                                                                    />
                                                                </div>
                                                                <div className="sm:col-span-2">
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Description</label>
                                                                    <textarea
                                                                        value={translationForm.description}
                                                                        onChange={(e) => setTranslationForm({ ...translationForm, description: e.target.value })}
                                                                        rows={2}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 resize-none"
                                                                        placeholder="Description complète"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={handleSaveTranslation}
                                                                    disabled={creatingTranslation || updatingTranslation}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                                                                >
                                                                    {(creatingTranslation || updatingTranslation) && <Loader2 className="w-3 h-3 animate-spin" />}
                                                                    {editingTranslationLang ? 'Mettre à jour' : 'Ajouter'}
                                                                </button>
                                                                <button onClick={resetTranslationForm} className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg transition-colors">
                                                                    Annuler
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => { resetTranslationForm(); setIsAddingTranslation(true); }}
                                                            className="w-full py-2.5 border border-dashed border-sage-300 text-sage-600 text-xs font-semibold rounded-xl hover:bg-sage-50 transition-colors flex items-center justify-center gap-1.5"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" /> Ajouter une traduction
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* Logistics Section */}
                                    <div ref={el => { sectionRefs.current['logistics'] = el; }}>
                                        <SageCollapsible
                                            title="Logistique"
                                            isOpen={openSections['logistics']}
                                            onOpenChange={(open) => toggleSection('logistics', open)}
                                        >
                                            {logisticsLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-500">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {isEditingLogistics ? (
                                                        <div className="bg-slate-50 border border-gray-200 rounded-xl p-4">
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Niveau d'expédition</label>
                                                                    <select
                                                                        value={logisticsForm.shipping_level}
                                                                        onChange={(e) => setLogisticsForm({ ...logisticsForm, shipping_level: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                    >
                                                                        <option value="">— auto-inféré —</option>
                                                                        <option value="UNIT">UNIT — Unité</option>
                                                                        <option value="CARTON">CARTON — Carton</option>
                                                                        <option value="PALLET">PALLET — Palette</option>
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[11px] font-medium text-gray-500 mb-1">Catégorie transport <span className="text-gray-400">(libre)</span></label>
                                                                    <input
                                                                        type="text"
                                                                        maxLength={50}
                                                                        value={logisticsForm.transport_category}
                                                                        onChange={(e) => setLogisticsForm({ ...logisticsForm, transport_category: e.target.value })}
                                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                        placeholder="ex: DANGEROUS, PHARMA…"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-4 mb-4">
                                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={logisticsForm.stackable}
                                                                        onChange={(e) => setLogisticsForm({ ...logisticsForm, stackable: e.target.checked })}
                                                                        className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                    />
                                                                    <span className="text-sm text-gray-700">Empilable</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={logisticsForm.fragile}
                                                                        onChange={(e) => setLogisticsForm({ ...logisticsForm, fragile: e.target.checked })}
                                                                        className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                    />
                                                                    <span className="text-sm text-gray-700">Fragile</span>
                                                                </label>
                                                                <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={logisticsForm.temperature_controlled}
                                                                        onChange={(e) => setLogisticsForm({ ...logisticsForm, temperature_controlled: e.target.checked })}
                                                                        className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                    />
                                                                    <span className="text-sm text-gray-700">Température contrôlée</span>
                                                                </label>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={handleSaveLogistics}
                                                                    disabled={updatingLogistics}
                                                                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors shadow-sm"
                                                                >
                                                                    {updatingLogistics ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Enregistrer'}
                                                                </button>
                                                                <button
                                                                    onClick={() => setIsEditingLogistics(false)}
                                                                    className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg transition-colors"
                                                                >
                                                                    Annuler
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                                                            {!logistics ? (
                                                                <div className="text-center py-6 text-gray-500 text-sm">
                                                                    Aucune information logistique renseignée.
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Niveau d'expédition</span>
                                                                        <span className="text-sm font-semibold text-gray-900">
                                                                            {logistics.shipping_level ? (
                                                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100 capitalize">
                                                                                    {logistics.shipping_level}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs text-gray-400 italic">—</span>
                                                                            )}
                                                                        </span>
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                                                                        <div className={`p-3 rounded-lg border ${logistics.stackable ? 'bg-green-50 border-green-100' : 'bg-gray-50 border-gray-100'}`}>
                                                                            <div className="text-[11px] font-medium text-gray-500 mb-1">Empilable</div>
                                                                            <div className={`text-sm font-semibold ${logistics.stackable ? 'text-green-700' : 'text-gray-400'}`}>
                                                                                {logistics.stackable ? 'Oui' : 'Non'}
                                                                            </div>
                                                                        </div>
                                                                        <div className={`p-3 rounded-lg border ${logistics.fragile ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                                                                            <div className="text-[11px] font-medium text-gray-500 mb-1">Fragile</div>
                                                                            <div className={`text-sm font-semibold ${logistics.fragile ? 'text-red-700' : 'text-gray-400'}`}>
                                                                                {logistics.fragile ? 'Oui' : 'Non'}
                                                                            </div>
                                                                        </div>
                                                                        <div className={`p-3 rounded-lg border ${logistics.temperature_controlled ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
                                                                            <div className="text-[11px] font-medium text-gray-500 mb-1">Temp. contrôlée</div>
                                                                            <div className={`text-sm font-semibold ${logistics.temperature_controlled ? 'text-amber-700' : 'text-gray-400'}`}>
                                                                                {logistics.temperature_controlled ? 'Oui' : 'Non'}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {logistics.transport_category && (
                                                                        <div className="pt-3 border-t border-gray-100">
                                                                            <span className="text-xs font-medium text-gray-500">Catégorie transport : </span>
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-50 text-orange-700 border border-orange-100 font-mono">
                                                                                {logistics.transport_category}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {isEditMode && (
                                                                <div className="pt-3 border-t border-gray-100 flex justify-end">
                                                                    <button
                                                                        onClick={handleEditLogistics}
                                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors"
                                                                    >
                                                                        <Edit className="w-3.5 h-3.5" /> Modifier
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* Media Section */}
                                    <div ref={el => { sectionRefs.current['media'] = el; }}>
                                        <SageCollapsible
                                            title="Médias"
                                            isOpen={openSections['media']}
                                            onOpenChange={(open) => toggleSection('media', open)}
                                        >
                                            {(() => {
                                                const mainImage = detailData?.data?.thumbnail || details?.thumbnail;
                                                const galleryImages = detailData?.data?.medias
                                                    ?? detailData?.data?.thumbnails
                                                    ?? detailData?.data?.additional_thumbnails
                                                    ?? [];

                                                const renderImage = (src: string, alt: string, className?: string) => (
                                                    <img
                                                        src={src}
                                                        alt={alt}
                                                        className={className}
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f0f0f0" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                                                        }}
                                                    />
                                                );

                                                if (isCreateMode) {
                                                    return (
                                                        <div className="space-y-4">
                                                            <FileUpload
                                                                label="Image principale"
                                                                value={formData.thumbnail || null}
                                                                onChange={(file) => setFormData({ ...formData, thumbnail: file })}
                                                                accept="image/*"
                                                                multiple={false}
                                                                maxSize={2}
                                                                showPreview={true}
                                                                currentImages={mainImage ? [{ id: (mainImage as any).id ?? 0, url: (mainImage as any).url || mainImage, name: 'Image principale' }] : []}
                                                                helperText="PNG, JPG, JPEG ou WEBP (max 2MB)"
                                                            />
                                                            <FileUpload
                                                                label="Images supplémentaires"
                                                                value={formData.additionThumbnail || null}
                                                                onChange={(files) => setFormData({ ...formData, additionThumbnail: files })}
                                                                accept="image/*"
                                                                multiple={true}
                                                                maxSize={2}
                                                                maxFiles={10}
                                                                showPreview={true}
                                                                currentImages={galleryImages.map((thumb: any, idx: number) => ({ id: thumb.id, url: thumb.url || thumb.thumbnail, name: `Image ${idx + 1}` }))}
                                                                helperText="Vous pouvez télécharger jusqu'à 10 images supplémentaires"
                                                            />
                                                        </div>
                                                    );
                                                }

                                                if (isEditMode) {
                                                    return (
                                                        <div className="space-y-6">
                                                            {/* Main image */}
                                                            <div>
                                                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Image principale</h4>
                                                                {mainImage ? (
                                                                    <div className="relative w-full h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm group">
                                                                        {renderImage((mainImage as any).url || mainImage as string, details?.name || 'Image principale', 'w-full h-full object-contain p-4')}
                                                                        <div className="absolute bottom-4 right-4">
                                                                            <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/90 backdrop-blur-sm text-gray-700 text-xs font-semibold rounded-lg shadow-sm cursor-pointer hover:bg-white transition-colors">
                                                                                <input
                                                                                    type="file"
                                                                                    accept="image/*"
                                                                                    className="hidden"
                                                                                    onChange={handleMainImageChange}
                                                                                    disabled={uploadingMainImage}
                                                                                />
                                                                                {uploadingMainImage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                                                                Remplacer
                                                                            </label>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={handleMainImageChange}
                                                                            disabled={uploadingMainImage}
                                                                        />
                                                                        {uploadingMainImage ? <Loader2 className="w-10 h-10 text-gray-300 mb-2 animate-spin" /> : <ImageIcon className="w-10 h-10 text-gray-300 mb-2" />}
                                                                        <span className="text-sm text-gray-500">{uploadingMainImage ? 'Téléversement...' : 'Ajouter une image principale'}</span>
                                                                    </label>
                                                                )}
                                                            </div>

                                                            {/* Gallery */}
                                                            <div>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-sm font-semibold text-gray-900">Galerie</h4>
                                                                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg cursor-pointer hover:bg-sage-700 transition-colors shadow-sm">
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            multiple
                                                                            className="hidden"
                                                                            onChange={handleGalleryUpload}
                                                                            disabled={uploadingGalleryImages}
                                                                        />
                                                                        {uploadingGalleryImages ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                                        Ajouter des images
                                                                    </label>
                                                                </div>
                                                                {galleryImages.length > 0 ? (
                                                                    <div className="grid grid-cols-4 gap-3">
                                                                        {galleryImages.map((thumb: any, index: number) => (
                                                                            <div
                                                                                key={thumb.id || index}
                                                                                className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden group hover:border-sage-400 hover:shadow-lg transition-all duration-200"
                                                                            >
                                                                                <img
                                                                                    src={thumb.thumbnail || thumb.url}
                                                                                    alt={`Image ${index + 1}`}
                                                                                    className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-110"
                                                                                    onClick={() => {
                                                                                        setSelectedImage(thumb.thumbnail || thumb.url);
                                                                                        setShowLightbox(true);
                                                                                    }}
                                                                                    onError={(e) => {
                                                                                        (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
                                                                                    }}
                                                                                />
                                                                                <button
                                                                                    onClick={() => handleDeleteGalleryImage(thumb.id)}
                                                                                    disabled={deletingGalleryImage === thumb.id}
                                                                                    className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur-sm rounded-full text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors shadow-sm disabled:opacity-50"
                                                                                    title="Supprimer"
                                                                                >
                                                                                    {deletingGalleryImage === thumb.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                                        Aucune image en galerie.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // Read-only view
                                                return (mainImage || galleryImages.length > 0) ? (
                                                    <div className="space-y-6">
                                                        {mainImage && (
                                                            <div>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-sm font-semibold text-gray-900">Image principale</h4>
                                                                </div>
                                                                <div
                                                                    className="relative w-full h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                                                                    onClick={() => {
                                                                        setSelectedImage((mainImage as any).url || mainImage);
                                                                        setShowLightbox(true);
                                                                    }}
                                                                >
                                                                    {renderImage((mainImage as any).url || mainImage as string, details?.name || 'Image principale', 'w-full h-full object-contain p-4 transition-transform duration-200 group-hover:scale-105')}
                                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200 flex items-center justify-center">
                                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
                                                                            <ZoomIn className="w-6 h-6 text-gray-700" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {galleryImages.length > 0 && (
                                                            <div>
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <h4 className="text-sm font-semibold text-gray-900">Galerie</h4>
                                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full font-medium">{galleryImages.length} {galleryImages.length > 1 ? 'images' : 'image'}</span>
                                                                </div>
                                                                <div className="grid grid-cols-4 gap-3">
                                                                    {galleryImages.map((thumb: any, index: number) => (
                                                                        <div
                                                                            key={thumb.id || index}
                                                                            className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-200 overflow-hidden cursor-pointer group hover:border-sage-400 hover:shadow-lg transition-all duration-200"
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
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 text-gray-400">
                                                        <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">Aucune image disponible</p>
                                                    </div>
                                                );
                                            })()}
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
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
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
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
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

                                    {/* [legacy flags+marketing merged section — replaced by dedicated sections below] */}
                                    <div ref={el => { sectionRefs.current['_flags_legacy'] = el; }} style={{ display: 'none' }}>
                                        <SageCollapsible
                                            title="Options & Marketing"
                                            isOpen={false}
                                            onOpenChange={() => {}}
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
                                                                    onChange={(e) => setFormData({ ...formData, is_salable: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Vendable</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_returnable ?? true}
                                                                    onChange={(e) => setFormData({ ...formData, is_returnable: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Retournable</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_discountable ?? true}
                                                                    onChange={(e) => setFormData({ ...formData, is_discountable: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Remisable</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_expirable ?? false}
                                                                    onChange={(e) => setFormData({ ...formData, is_expirable: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Périssable</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_backorder_allowed ?? true}
                                                                    onChange={(e) => setFormData({ ...formData, is_backorder_allowed: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Commande en rupture</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_weight_managed ?? true}
                                                                    onChange={(e) => setFormData({ ...formData, is_weight_managed: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
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
                                                                    onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Produit vedette</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_quotation_required ?? false}
                                                                    onChange={(e) => setFormData({ ...formData, is_quotation_required: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Devis requis</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.is_visible_individually ?? true}
                                                                    onChange={(e) => setFormData({ ...formData, is_visible_individually: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                                                />
                                                                <span>Visible individuellement</span>
                                                            </label>
                                                            <label className="flex items-center gap-2 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={formData.requires_login_to_view ?? false}
                                                                    onChange={(e) => setFormData({ ...formData, requires_login_to_view: e.target.checked })}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
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
                                                                    onChange={(e) => setFormData({ ...formData, meta_title: e.target.value })}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                    placeholder="Titre pour les moteurs de recherche"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Description SEO</label>
                                                                <textarea
                                                                    value={formData.meta_description || ''}
                                                                    onChange={(e) => setFormData({ ...formData, meta_description: e.target.value })}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
                                                                    rows={2}
                                                                    placeholder="Description pour les moteurs de recherche"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs text-gray-500 mb-1">Mots-clés SEO</label>
                                                                <input
                                                                    type="text"
                                                                    value={formData.meta_keywords || ''}
                                                                    onChange={(e) => setFormData({ ...formData, meta_keywords: e.target.value })}
                                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500"
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
                                                                        <CheckCircle2 className="w-4 h-4 text-sage-600" />
                                                                        <span>En vedette</span>
                                                                    </div>
                                                                )}
                                                                {details.marketing.is_visible_individually && (
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <CheckCircle2 className="w-4 h-4 text-sage-600" />
                                                                        <span>Visible individuellement</span>
                                                                    </div>
                                                                )}
                                                                {details.marketing.is_free_good && (
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <CheckCircle2 className="w-4 h-4 text-sage-600" />
                                                                        <span>Produit gratuit</span>
                                                                    </div>
                                                                )}
                                                                {details.marketing.is_quotation_required && (
                                                                    <div className="flex items-center gap-2 text-sm">
                                                                        <CheckCircle2 className="w-4 h-4 text-sage-600" />
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

                                    {/* ── Classification Section (§7.1–7.6) ───────────────────────── */}
                                    <div ref={el => { sectionRefs.current['classification'] = el; }}>
                                        <SageCollapsible
                                            title="Classification"
                                            isOpen={openSections['classification']}
                                            onOpenChange={(open) => toggleSection('classification', open)}
                                        >
                                            <div className="space-y-4">
                                                {/* Brand */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div>
                                                        <div className="text-xs text-gray-500 mb-0.5">Marque</div>
                                                        {isEditingBrand ? (
                                                            <div className="flex items-center gap-2">
                                                                <select value={editingBrandId} onChange={e => setEditingBrandId(e.target.value)}
                                                                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500">
                                                                    <option value="">— aucune —</option>
                                                                    {brands.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                                                                </select>
                                                                <button onClick={handleSaveBrand} disabled={updatingBrand}
                                                                    className="px-2.5 py-1 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingBrand ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                                                </button>
                                                                <button onClick={() => setIsEditingBrand(false)} className="px-2.5 py-1 text-gray-500 text-xs hover:bg-gray-200 rounded-lg">✕</button>
                                                            </div>
                                                        ) : (
                                                            <div className="font-semibold text-gray-900">{details?.brand?.name || <span className="text-gray-400 text-sm italic">—</span>}</div>
                                                        )}
                                                    </div>
                                                    {!isEditingBrand && !isEditMode && (
                                                        <button onClick={() => { setEditingBrandId(String(details?.brand_id ?? '')); setIsEditingBrand(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                    )}
                                                </div>

                                                {/* Unit */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div>
                                                        <div className="text-xs text-gray-500 mb-0.5">Unité de base</div>
                                                        {isEditingUnit ? (
                                                            <div className="flex items-center gap-2">
                                                                <select value={editingUnitId} onChange={e => setEditingUnitId(e.target.value)}
                                                                    className="px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500">
                                                                    <option value="">— aucune —</option>
                                                                    {units.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                                                                </select>
                                                                <button onClick={handleSaveUnit} disabled={updatingUnit}
                                                                    className="px-2.5 py-1 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingUnit ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                                                </button>
                                                                <button onClick={() => setIsEditingUnit(false)} className="px-2.5 py-1 text-gray-500 text-xs hover:bg-gray-200 rounded-lg">✕</button>
                                                            </div>
                                                        ) : (
                                                            <div className="font-semibold text-gray-900">{details?.unit?.name || <span className="text-gray-400 text-sm italic">—</span>}</div>
                                                        )}
                                                    </div>
                                                    {!isEditingUnit && !isEditMode && (
                                                        <button onClick={() => { setEditingUnitId(String(details?.unit_id ?? '')); setIsEditingUnit(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                    )}
                                                </div>

                                                {/* Categories */}
                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs text-gray-500">Catégories</div>
                                                        {!isEditingCategories && !isEditMode && (
                                                            <button onClick={() => { setEditingCategoryIds(productCategories.map((c: any) => c.id)); setIsEditingCategories(true); }}
                                                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                        )}
                                                    </div>
                                                    {isEditingCategories ? (
                                                        <div>
                                                            <div className="border border-gray-300 rounded-lg p-2 max-h-36 overflow-y-auto bg-white mb-2">
                                                                {allCategories.map((cat: any) => (
                                                                    <label key={cat.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                                                        <input type="checkbox" checked={editingCategoryIds.includes(cat.id)}
                                                                            onChange={e => { const s = new Set(editingCategoryIds); e.target.checked ? s.add(cat.id) : s.delete(cat.id); setEditingCategoryIds(Array.from(s)); }}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded" />
                                                                        <span>{cat.name}</span>
                                                                    </label>
                                                                ))}
                                                                {allCategories.length === 0 && <span className="text-xs text-gray-400">Aucune catégorie disponible</span>}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={handleSaveCategories} disabled={updatingCategories}
                                                                    className="px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingCategories ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Enregistrer'}
                                                                </button>
                                                                <button onClick={() => setIsEditingCategories(false)} className="px-3 py-1.5 text-gray-600 text-xs hover:bg-gray-200 rounded-lg">Annuler</button>
                                                            </div>
                                                        </div>
                                                    ) : categoriesLoadingFacet ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {productCategories.length > 0
                                                                ? productCategories.map((c: any) => <span key={c.id} className="px-2 py-0.5 bg-sage-100 text-sage-700 rounded-full text-xs font-medium">{c.name}</span>)
                                                                : <span className="text-xs text-gray-400 italic">Aucune</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Subcategories */}
                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs text-gray-500">Sous-catégories</div>
                                                        {!isEditingSubcategories && !isEditMode && (
                                                            <button onClick={() => { setEditingSubcategoryIds(productSubcategories.map((s: any) => s.id)); setIsEditingSubcategories(true); }}
                                                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                        )}
                                                    </div>
                                                    {isEditingSubcategories ? (
                                                        <div>
                                                            <div className="border border-gray-300 rounded-lg p-2 max-h-36 overflow-y-auto bg-white mb-2">
                                                                {allSubcategories.map((sc: any) => (
                                                                    <label key={sc.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                                                        <input type="checkbox" checked={editingSubcategoryIds.includes(sc.id)}
                                                                            onChange={e => { const s = new Set(editingSubcategoryIds); e.target.checked ? s.add(sc.id) : s.delete(sc.id); setEditingSubcategoryIds(Array.from(s)); }}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded" />
                                                                        <span>{sc.name}</span>
                                                                    </label>
                                                                ))}
                                                                {allSubcategories.length === 0 && <span className="text-xs text-gray-400">Aucune sous-catégorie disponible</span>}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={handleSaveSubcategories} disabled={updatingSubcategories}
                                                                    className="px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingSubcategories ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Enregistrer'}
                                                                </button>
                                                                <button onClick={() => setIsEditingSubcategories(false)} className="px-3 py-1.5 text-gray-600 text-xs hover:bg-gray-200 rounded-lg">Annuler</button>
                                                            </div>
                                                        </div>
                                                    ) : subcategoriesLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {productSubcategories.length > 0
                                                                ? productSubcategories.map((sc: any) => <span key={sc.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">{sc.name}</span>)
                                                                : <span className="text-xs text-gray-400 italic">Aucune</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* VAT Taxes */}
                                                <div className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="text-xs text-gray-500">Taxes TVA <span className="text-gray-400">(seule la 1ère est utilisée pour le calcul des prix)</span></div>
                                                        {!isEditingVatTaxes && !isEditMode && (
                                                            <button onClick={() => { setEditingVatTaxIds(productVatTaxesFacet.map((t: any) => t.id)); setIsEditingVatTaxes(true); }}
                                                                className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                                        )}
                                                    </div>
                                                    {isEditingVatTaxes ? (
                                                        <div>
                                                            <div className="border border-gray-300 rounded-lg p-2 max-h-36 overflow-y-auto bg-white mb-2">
                                                                {vatTaxes.map((t: any) => (
                                                                    <label key={t.id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                                                                        <input type="checkbox" checked={editingVatTaxIds.includes(t.id)}
                                                                            onChange={e => { const s = new Set(editingVatTaxIds); e.target.checked ? s.add(t.id) : s.delete(t.id); setEditingVatTaxIds(Array.from(s)); }}
                                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded" />
                                                                        <span>{t.name} ({t.percentage ?? t.rate}%)</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={handleSaveVatTaxes} disabled={updatingVatTaxesFacet}
                                                                    className="px-3 py-1.5 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingVatTaxesFacet ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'Enregistrer'}
                                                                </button>
                                                                <button onClick={() => setIsEditingVatTaxes(false)} className="px-3 py-1.5 text-gray-600 text-xs hover:bg-gray-200 rounded-lg">Annuler</button>
                                                            </div>
                                                        </div>
                                                    ) : vatTaxesFacetLoading ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                    ) : (
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {productVatTaxesFacet.length > 0
                                                                ? productVatTaxesFacet.map((t: any, i: number) => (
                                                                    <span key={t.id} className={`px-2 py-0.5 rounded-full text-xs font-medium ${i === 0 ? 'bg-purple-100 text-purple-700 ring-1 ring-purple-400' : 'bg-gray-100 text-gray-600'}`}>
                                                                        {t.name} ({t.percentage ?? t.rate}%) {i === 0 ? '✓' : ''}
                                                                    </span>
                                                                ))
                                                                : <span className="text-xs text-gray-400 italic">Aucune TVA</span>}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Product Page */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs text-gray-500 mb-0.5">Page produit (classification X3)</div>
                                                        {isEditingProductPage ? (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <select value={editingProductPageCode} onChange={e => setEditingProductPageCode(e.target.value)}
                                                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500">
                                                                    <option value="">— aucune —</option>
                                                                    {allProductPages.map((p: any) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
                                                                </select>
                                                                <button onClick={handleSaveProductPage} disabled={updatingProductPage}
                                                                    className="px-2.5 py-1 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingProductPage ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                                                </button>
                                                                <button onClick={() => setIsEditingProductPage(false)} className="px-2.5 py-1 text-gray-500 text-xs hover:bg-gray-200 rounded-lg">✕</button>
                                                            </div>
                                                        ) : productPageFacetLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                        ) : productPageFacet ? (
                                                            <div>
                                                                <div className="font-semibold text-gray-900 text-sm">{productPageFacet.name}</div>
                                                                <div className="text-xs text-gray-400 font-mono">{productPageFacet.code}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm italic">—</span>
                                                        )}
                                                    </div>
                                                    {!isEditingProductPage && !isEditMode && (
                                                        <button onClick={() => { setEditingProductPageCode(productPageFacet?.code ?? ''); setIsEditingProductPage(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors shrink-0 ml-2"><Edit className="w-3.5 h-3.5" /></button>
                                                    )}
                                                </div>

                                                {/* Sales Group */}
                                                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs text-gray-500 mb-0.5">Groupe vente</div>
                                                        {isEditingSalesGroup ? (
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <select value={editingSalesGroupCode} onChange={e => setEditingSalesGroupCode(e.target.value)}
                                                                    className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500">
                                                                    <option value="">— aucun —</option>
                                                                    {allSalesGroups.map((sg: any) => <option key={sg.code} value={sg.code}>{sg.code} — {sg.name}</option>)}
                                                                </select>
                                                                <button onClick={handleSaveSalesGroup} disabled={updatingSalesGroup}
                                                                    className="px-2.5 py-1 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50">
                                                                    {updatingSalesGroup ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                                                                </button>
                                                                <button onClick={() => setIsEditingSalesGroup(false)} className="px-2.5 py-1 text-gray-500 text-xs hover:bg-gray-200 rounded-lg">✕</button>
                                                            </div>
                                                        ) : salesGroupFacetLoading ? (
                                                            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                                        ) : salesGroupFacet ? (
                                                            <div>
                                                                <div className="font-semibold text-gray-900 text-sm">{salesGroupFacet.name}</div>
                                                                <div className="text-xs text-gray-400 font-mono">{salesGroupFacet.code}</div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm italic">—</span>
                                                        )}
                                                    </div>
                                                    {!isEditingSalesGroup && !isEditMode && (
                                                        <button onClick={() => { setEditingSalesGroupCode(salesGroupFacet?.code ?? ''); setIsEditingSalesGroup(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors shrink-0 ml-2"><Edit className="w-3.5 h-3.5" /></button>
                                                    )}
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Retail Price Modal ────────────────────────────────────────── */}
                                    {isEditingRetailPrice && (
                                        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsEditingRetailPrice(false)}>
                                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-3 mb-5">
                                                    <div className="w-9 h-9 rounded-xl bg-sage-50 flex items-center justify-center"><DollarSign className="w-5 h-5 text-sage-600" /></div>
                                                    <div>
                                                        <h3 className="text-sm font-bold text-gray-900">Prix B2C / Rayon</h3>
                                                        <p className="text-xs text-gray-400">Pas le prix B2B — géré via les listes de prix</p>
                                                    </div>
                                                    <button onClick={() => setIsEditingRetailPrice(false)} className="ml-auto p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-4 h-4" /></button>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Prix HT (MAD)</label>
                                                            <input type="number" step="0.01" value={retailPriceForm.price_ht}
                                                                onChange={e => setRetailPriceForm(f => ({ ...f, price_ht: e.target.value }))}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500" placeholder="0.00" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-500 mb-1">Prix TTC (MAD)</label>
                                                            <input type="number" step="0.01" value={retailPriceForm.price_ttc}
                                                                onChange={e => setRetailPriceForm(f => ({ ...f, price_ttc: e.target.value }))}
                                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500" placeholder="0.00" />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-500 mb-1">Prix promotionnel HT (MAD)</label>
                                                        <input type="number" step="0.01" value={retailPriceForm.discount_price}
                                                            onChange={e => setRetailPriceForm(f => ({ ...f, discount_price: e.target.value }))}
                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500" placeholder="0.00" />
                                                    </div>
                                                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                                                        <input type="checkbox" checked={retailPriceForm.ttc_pricing}
                                                            onChange={e => setRetailPriceForm(f => ({ ...f, ttc_pricing: e.target.checked }))}
                                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded" />
                                                        <span className="text-gray-700">Référence TTC (le prix TTC fait foi)</span>
                                                    </label>
                                                </div>
                                                <div className="flex gap-2 mt-5">
                                                    <button onClick={handleSaveRetailPrice} disabled={updatingRetailPrice}
                                                        className="flex-1 py-2.5 bg-sage-600 text-white text-sm font-semibold rounded-xl hover:bg-sage-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
                                                        {updatingRetailPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Enregistrer
                                                    </button>
                                                    <button onClick={() => setIsEditingRetailPrice(false)} className="px-4 py-2.5 text-gray-600 text-sm font-medium hover:bg-gray-100 rounded-xl">Annuler</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Flags Section (§7.9) ──────────────────────────────────────── */}
                                    <div ref={el => { sectionRefs.current['flags'] = el; }}>
                                        <SageCollapsible
                                            title="Options d'inventaire"
                                            isOpen={openSections['flags']}
                                            onOpenChange={(open) => toggleSection('flags', open)}
                                        >
                                            {isEditingFlags ? (
                                                <div className="space-y-4">
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                                        {([
                                                            ['is_salable', 'Vendable'],
                                                            ['is_returnable', 'Retournable'],
                                                            ['is_discountable', 'Remisable'],
                                                            ['is_backorder_allowed', 'Commande en rupture'],
                                                            ['is_batch_managed', 'Gestion par lot'],
                                                            ['is_expirable', 'Périssable / DLC'],
                                                            ['is_serialized', 'Sérialisé (N/S)'],
                                                            ['is_weight_managed', 'Géré par poids'],
                                                            ['is_consignment', 'Consignation'],
                                                            ['decimal_quantity_allowed', 'Qté décimale'],
                                                            ['requires_preparation', 'Préparation requise'],
                                                            ['allow_partial_delivery', 'Livraison partielle'],
                                                        ] as [string, string][]).map(([key, label]) => (
                                                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                                                <input type="checkbox" checked={!!flagsForm[key]}
                                                                    onChange={e => setFlagsForm(f => ({ ...f, [key]: e.target.checked }))}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500" />
                                                                <span>{label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                                                        <button onClick={handleSaveFlags} disabled={updatingFlags}
                                                            className="px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                                                            {updatingFlags ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Enregistrer
                                                        </button>
                                                        <button onClick={() => setIsEditingFlags(false)} className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg">Annuler</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {currentFlags ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {([
                                                                ['is_salable', 'Vendable'],
                                                                ['is_returnable', 'Retournable'],
                                                                ['is_discountable', 'Remisable'],
                                                                ['is_backorder_allowed', 'Commande en rupture'],
                                                                ['is_batch_managed', 'Gestion par lot'],
                                                                ['is_expirable', 'Périssable / DLC'],
                                                                ['is_serialized', 'Sérialisé'],
                                                                ['is_weight_managed', 'Par poids'],
                                                                ['is_consignment', 'Consignation'],
                                                                ['decimal_quantity_allowed', 'Qté décimale'],
                                                                ['requires_preparation', 'Préparation'],
                                                                ['allow_partial_delivery', 'Livraison partielle'],
                                                            ] as [string, string][]).map(([key, label]) => (
                                                                <div key={key} className="flex items-center gap-2 text-sm">
                                                                    {currentFlags[key]
                                                                        ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                                                                        : <XCircle className="w-4 h-4 text-gray-200 shrink-0" />}
                                                                    <span className={currentFlags[key] ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <div className="text-center py-4 text-gray-400 text-sm">Aucune option définie</div>}
                                                    <div className="flex justify-end pt-2 border-t border-gray-100">
                                                        <button onClick={() => { setFlagsForm({ ...currentFlags }); setIsEditingFlags(true); }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors">
                                                            <Edit className="w-3.5 h-3.5" /> Modifier
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Marketing Section (§7.10) ─────────────────────────────────── */}
                                    <div ref={el => { sectionRefs.current['marketing'] = el; }}>
                                        <SageCollapsible
                                            title="Marketing & Visibilité"
                                            isOpen={openSections['marketing']}
                                            onOpenChange={(open) => toggleSection('marketing', open)}
                                        >
                                            {isEditingMarketing ? (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                                                        {([
                                                            ['is_featured', 'Produit vedette'],
                                                            ['is_free_good', 'Produit gratuit (offert)'],
                                                            ['is_quotation_required', 'Devis requis'],
                                                            ['is_visible_individually', 'Visible individuellement'],
                                                            ['is_ideal_orderable', 'Commandable en ligne'],
                                                            ['is_slow_moving', 'Rotation lente'],
                                                            ['is_sold_separately', 'Vendu séparément'],
                                                            ['requires_login_to_view', 'Connexion requise pour voir'],
                                                        ] as [string, string][]).map(([key, label]) => (
                                                            <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                                                                <input type="checkbox" checked={!!marketingForm[key]}
                                                                    onChange={e => setMarketingForm(f => ({ ...f, [key]: e.target.checked }))}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500" />
                                                                <span>{label}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                                                        <button onClick={handleSaveMarketing} disabled={updatingMarketing}
                                                            className="px-4 py-2 bg-sage-600 text-white text-xs font-semibold rounded-lg hover:bg-sage-700 disabled:opacity-50 inline-flex items-center gap-1.5">
                                                            {updatingMarketing ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Enregistrer
                                                        </button>
                                                        <button onClick={() => setIsEditingMarketing(false)} className="px-4 py-2 text-gray-600 text-xs font-semibold hover:bg-gray-200/60 rounded-lg">Annuler</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {currentMarketing ? (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {([
                                                                ['is_featured', 'En vedette'],
                                                                ['is_free_good', 'Produit offert'],
                                                                ['is_quotation_required', 'Devis requis'],
                                                                ['is_visible_individually', 'Visible indiv.'],
                                                                ['is_ideal_orderable', 'Commandable'],
                                                                ['is_slow_moving', 'Rotation lente'],
                                                                ['is_sold_separately', 'Vendu séparément'],
                                                                ['requires_login_to_view', 'Login requis'],
                                                            ] as [string, string][]).map(([key, label]) => (
                                                                <div key={key} className="flex items-center gap-2 text-sm">
                                                                    {currentMarketing[key]
                                                                        ? <CheckCircle2 className="w-4 h-4 text-sage-500 shrink-0" />
                                                                        : <XCircle className="w-4 h-4 text-gray-200 shrink-0" />}
                                                                    <span className={currentMarketing[key] ? 'text-gray-800' : 'text-gray-400'}>{label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : <div className="text-center py-4 text-gray-400 text-sm">Aucune option marketing</div>}
                                                    <div className="flex justify-end pt-2 border-t border-gray-100">
                                                        <button onClick={() => { setMarketingForm({ ...currentMarketing }); setIsEditingMarketing(true); }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors">
                                                            <Edit className="w-3.5 h-3.5" /> Modifier
                                                        </button>
                                                    </div>
                                                </div>
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
