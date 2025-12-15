import { useState, useEffect } from 'react';
import { X, Package, DollarSign, Box, Tag, Image as ImageIcon, AlertCircle, Loader2, Plus } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { useProductFormMetadata, useCreateProduct, useUpdateProduct } from '@/hooks/products/useProducts';
import type { Product, CreateProductRequest } from '@/types/product.types';
import toast from 'react-hot-toast';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    product?: Product | null;
}

export const ProductFormModal = ({ isOpen, onClose, onSuccess, product }: ProductFormModalProps) => {
    const isEditMode = !!product;
    const [activeTab, setActiveTab] = useState<string>('general');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const { data: metadata, loading: metadataLoading } = useProductFormMetadata();
    const { create, loading: creating } = useCreateProduct();
    const { update, loading: updating } = useUpdateProduct();

    const [formData, setFormData] = useState<CreateProductRequest>({
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
        has_colisage: false,
        categories: [],
        vat_taxes: [],
        is_active: true,
        is_salable: true,
        is_returnable: true,
        is_discountable: true,
        is_visible_individually: true,
    });

    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
    const [additionalImages, setAdditionalImages] = useState<File[]>([]);
    const [additionalPreviews, setAdditionalPreviews] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && product) {
            setFormData({
                name: product.name || '',
                code: product.code || '',
                price: product.price || 0,
                discount_price: product.discount_price || 0,
                quantity: product.quantity || 0,
                min_order_quantity: product.min_order_quantity || 1,
                brand: product.brand_id,
                unit: product.unit_id,
                short_description: product.short_description || '',
                description: product.description || '',
                buy_price: product.buy_price || 0,
                has_colisage: product.has_colisage || false,
                categories: product.categories?.map(c => c.id) || [],
                vat_taxes: product.vatTaxes?.map(v => v.id) || [],
                is_active: product.is_active,
                is_salable: product.flags?.is_salable ?? true,
                is_returnable: product.flags?.is_returnable ?? true,
                is_discountable: product.flags?.is_discountable ?? true,
                is_visible_individually: product.flags?.is_visible_individually ?? true,
            });
        } else if (isOpen && !product) {
            resetForm();
        }
    }, [isOpen, product]);

    const resetForm = () => {
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
            has_colisage: false,
            categories: [],
            vat_taxes: [],
            is_active: true,
            is_salable: true,
            is_returnable: true,
            is_discountable: true,
            is_visible_individually: true,
        });
        setThumbnail(null);
        setThumbnailPreview('');
        setAdditionalImages([]);
        setAdditionalPreviews([]);
        setErrors({});
        setActiveTab('general');
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setThumbnail(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setThumbnailPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAdditionalImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        setAdditionalImages(prev => [...prev, ...files]);

        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAdditionalPreviews(prev => [...prev, reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    const removeAdditionalImage = (index: number) => {
        setAdditionalImages(prev => prev.filter((_, i) => i !== index));
        setAdditionalPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!formData.name?.trim()) {
            newErrors.name = 'Le nom du produit est requis';
        }

        if (!formData.code?.trim()) {
            newErrors.code = 'Le code produit est requis';
        }

        if (!formData.price || formData.price <= 0) {
            newErrors.price = 'Le prix doit être supérieur à 0';
        }

        if (!formData.brand) {
            newErrors.brand = 'La marque est requise';
        }

        if (!formData.unit) {
            newErrors.unit = 'L\'unité est requise';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            toast.error('Veuillez corriger les erreurs du formulaire');
            setActiveTab('general');
            return;
        }

        const toastId = toast.loading(isEditMode ? 'Mise à jour en cours...' : 'Création en cours...');

        try {
            const payload: CreateProductRequest = {
                ...formData,
                thumbnail: thumbnail || undefined,
                additionThumbnail: additionalImages.length > 0 ? additionalImages : undefined,
            };

            let res;
            if (isEditMode && product) {
                res = await update(product.id, payload);
            } else {
                res = await create(payload);
            }

            toast.dismiss(toastId);

            if (res.success) {
                toast.success(res.message || (isEditMode ? 'Produit mis à jour avec succès' : 'Produit créé avec succès'));
                onSuccess();
                onClose();
                resetForm();
            } else {
                toast.error(res.message || 'Une erreur est survenue');
            }
        } catch (e: any) {
            toast.dismiss(toastId);
            if (e.response?.data?.errors) {
                setErrors(e.response.data.errors);
                toast.error('Erreurs de validation');
            } else {
                toast.error(e.message || 'Une erreur est survenue');
            }
        }
    };

    const tabs: TabItem[] = [
        { id: 'general', label: 'Informations générales', icon: Package },
        { id: 'pricing', label: 'Prix', icon: DollarSign },
        { id: 'stock', label: 'Stock', icon: Box },
        { id: 'categories', label: 'Catégories & Taxes', icon: Tag },
        { id: 'media', label: 'Médias', icon: ImageIcon },
    ];

    const brands = metadata?.data?.brands || [];
    const units = metadata?.data?.units || [];
    const categories = metadata?.data?.categories || [];
    const vatTaxes = metadata?.data?.vat_taxes || [];

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={isEditMode ? 'Modifier le produit' : 'Nouveau produit'}
            size="xl"
        >
            <div className="flex flex-col h-[80vh]">
                {/* Tabs */}
                <div className="border-b border-gray-200 px-6">
                    <SageTabs
                        tabs={tabs}
                        activeTabId={activeTab}
                        onTabChange={setActiveTab}
                        className="shadow-none"
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {metadataLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <>
                            {/* General Tab */}
                            {activeTab === 'general' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Nom du produit <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => handleInputChange('name', e.target.value)}
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    errors.name ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                                placeholder="Ex: Foie de Poulet Surgelé"
                                            />
                                            {errors.name && (
                                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {errors.name}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Code produit <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.code}
                                                onChange={(e) => handleInputChange('code', e.target.value)}
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    errors.code ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                                placeholder="Ex: FOIE-001"
                                            />
                                            {errors.code && (
                                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {errors.code}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Marque <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.brand || ''}
                                                onChange={(e) => handleInputChange('brand', e.target.value ? Number(e.target.value) : undefined)}
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    errors.brand ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                            >
                                                <option value="">Sélectionner une marque</option>
                                                {brands.map((brand: any) => (
                                                    <option key={brand.id} value={brand.id}>
                                                        {brand.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.brand && (
                                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {errors.brand}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Unité <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.unit || ''}
                                                onChange={(e) => handleInputChange('unit', e.target.value ? Number(e.target.value) : undefined)}
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    errors.unit ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                            >
                                                <option value="">Sélectionner une unité</option>
                                                {units.map((unit: any) => (
                                                    <option key={unit.id} value={unit.id}>
                                                        {unit.name}
                                                    </option>
                                                ))}
                                            </select>
                                            {errors.unit && (
                                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {errors.unit}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description courte
                                        </label>
                                        <textarea
                                            value={formData.short_description}
                                            onChange={(e) => handleInputChange('short_description', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={2}
                                            placeholder="Brève description du produit"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Description détaillée
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => handleInputChange('description', e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            rows={4}
                                            placeholder="Description complète du produit"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Pricing Tab */}
                            {activeTab === 'pricing' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Prix de vente (MAD) <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.price}
                                                onChange={(e) => handleInputChange('price', parseFloat(e.target.value) || 0)}
                                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                                    errors.price ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                                placeholder="0.00"
                                            />
                                            {errors.price && (
                                                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {errors.price}
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Prix promotionnel (MAD)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.discount_price || ''}
                                                onChange={(e) => handleInputChange('discount_price', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Prix d'achat (MAD)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.buy_price || ''}
                                                onChange={(e) => handleInputChange('buy_price', parseFloat(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0.00"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Quantité minimale de commande
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.min_order_quantity}
                                                onChange={(e) => handleInputChange('min_order_quantity', parseInt(e.target.value) || 1)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="1"
                                                min="1"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-900">Options de tarification</h3>
                                        
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_discountable}
                                                onChange={(e) => handleInputChange('is_discountable', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit remisable</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Stock Tab */}
                            {activeTab === 'stock' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Quantité en stock
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.quantity}
                                                onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0"
                                                min="0"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Précision décimale
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.decimal_precision || 0}
                                                onChange={(e) => handleInputChange('decimal_precision', parseInt(e.target.value) || 0)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                placeholder="0"
                                                min="0"
                                                max="4"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-900">Options de gestion du stock</h3>
                                        
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.decimal_quantity_allowed}
                                                onChange={(e) => handleInputChange('decimal_quantity_allowed', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Quantité décimale autorisée</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_backorder_allowed}
                                                onChange={(e) => handleInputChange('is_backorder_allowed', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Commande en rupture autorisée</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_batch_managed}
                                                onChange={(e) => handleInputChange('is_batch_managed', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Gestion par lot</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_serialized}
                                                onChange={(e) => handleInputChange('is_serialized', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit sérialisé</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_expirable}
                                                onChange={(e) => handleInputChange('is_expirable', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit périssable</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_weight_managed}
                                                onChange={(e) => handleInputChange('is_weight_managed', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Gestion par poids</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Categories & Taxes Tab */}
                            {activeTab === 'categories' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Catégories</h3>
                                        <div className="border border-gray-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                                            {categories.length > 0 ? (
                                                <div className="space-y-2">
                                                    {categories.map((category: any) => (
                                                        <label key={category.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.categories?.includes(category.id)}
                                                                onChange={(e) => {
                                                                    const newCategories = e.target.checked
                                                                        ? [...(formData.categories || []), category.id]
                                                                        : (formData.categories || []).filter(id => id !== category.id);
                                                                    handleInputChange('categories', newCategories);
                                                                }}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-gray-700">{category.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">Aucune catégorie disponible</p>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Taxes TVA</h3>
                                        <div className="border border-gray-200 rounded-lg p-4">
                                            {vatTaxes.length > 0 ? (
                                                <div className="space-y-2">
                                                    {vatTaxes.map((tax: any) => (
                                                        <label key={tax.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                                            <input
                                                                type="checkbox"
                                                                checked={formData.vat_taxes?.includes(tax.id)}
                                                                onChange={(e) => {
                                                                    const newTaxes = e.target.checked
                                                                        ? [...(formData.vat_taxes || []), tax.id]
                                                                        : (formData.vat_taxes || []).filter(id => id !== tax.id);
                                                                    handleInputChange('vat_taxes', newTaxes);
                                                                }}
                                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm text-gray-700">{tax.name} ({tax.rate}%)</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 text-center py-4">Aucune taxe disponible</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-3 pt-4 border-t border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-900">Options de vente</h3>
                                        
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_salable}
                                                onChange={(e) => handleInputChange('is_salable', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit vendable</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_returnable}
                                                onChange={(e) => handleInputChange('is_returnable', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit retournable</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_visible_individually}
                                                onChange={(e) => handleInputChange('is_visible_individually', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Visible individuellement</span>
                                        </label>

                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_featured}
                                                onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">Produit en vedette</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Media Tab */}
                            {activeTab === 'media' && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Image principale</h3>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                                            {thumbnailPreview ? (
                                                <div className="relative">
                                                    <img src={thumbnailPreview} alt="Aperçu" className="w-full h-48 object-contain rounded" />
                                                    <button
                                                        onClick={() => {
                                                            setThumbnail(null);
                                                            setThumbnailPreview('');
                                                        }}
                                                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex flex-col items-center cursor-pointer">
                                                    <ImageIcon className="w-12 h-12 text-gray-400 mb-2" />
                                                    <span className="text-sm text-gray-600">Cliquez pour télécharger une image</span>
                                                    <span className="text-xs text-gray-400 mt-1">PNG, JPG, GIF jusqu'à 5MB</span>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleThumbnailChange}
                                                        className="hidden"
                                                    />
                                                </label>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Images supplémentaires</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            {additionalPreviews.map((preview, index) => (
                                                <div key={index} className="relative border border-gray-200 rounded-lg p-2">
                                                    <img src={preview} alt={`Image ${index + 1}`} className="w-full h-32 object-contain rounded" />
                                                    <button
                                                        onClick={() => removeAdditionalImage(index)}
                                                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                            <label className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500">
                                                <Plus className="w-8 h-8 text-gray-400 mb-1" />
                                                <span className="text-xs text-gray-500">Ajouter</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    multiple
                                                    onChange={handleAdditionalImagesChange}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={creating || updating}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={creating || updating || metadataLoading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 flex items-center gap-2"
                    >
                        {(creating || updating) && <Loader2 className="w-4 h-4 animate-spin" />}
                        {isEditMode ? 'Mettre à jour' : 'Créer le produit'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};
