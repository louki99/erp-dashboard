import { useState, useEffect, useCallback } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import { BreakpointType, AssortmentType, PromotionPaidBasedOn } from '@/types/promotion.types';
import { ArrowLeft, Save, Loader2, Layers, Users, CreditCard, Box, Calendar, TrendingUp, AlertTriangle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SageTabs } from '@/components/common/SageTabs';
import { PromotionRuleEditor } from './PromotionRuleEditor';
import { PartnerFamilyManager } from './PartnerFamilyManager';
import { BoostManager } from './BoostManager';
import { PaymentTermsManager } from './PaymentTermsManager';

interface PromotionFormProps {
    isEdit?: boolean;
}

export const PromotionForm = ({ isEdit = false }: PromotionFormProps) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    const methods = useForm<Promotion>({
        defaultValues: {
            is_closed: false,
            payment_term_dependent: false,
            breakpoint_type: BreakpointType.QUANTITY_BASED,
            scale_method: 2,
            lines: [],
            partner_families: [],
            payment_terms: [],
            sequence: 10
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors } } = methods;

    // Watch fields for dynamic UI
    const paymentTermDependent = watch('payment_term_dependent');
    const isBurningPromo = watch('is_burning_promo');

    useEffect(() => {
        if (isEdit && id) {
            loadPromotion(Number(id));
        }
    }, [id, isEdit]);

    const loadPromotion = async (promoId: number) => {
        setLoading(true);
        try {
            const data = await promotionsApi.getPromotion(promoId);
            const promo = data.promotion;

            // Normalize partner_families - API might return objects instead of strings
            let normalizedPartnerFamilies: string[] = [];
            if (Array.isArray(promo.partner_families)) {
                normalizedPartnerFamilies = promo.partner_families.map((item: any) => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    // If it's an object, try to extract the code
                    return item.code || item.family_code || item.partner_family_code || '';
                }).filter(Boolean);
            }

            // Normalize payment_terms similarly
            let normalizedPaymentTerms: string[] = [];
            if (Array.isArray(promo.payment_terms)) {
                normalizedPaymentTerms = promo.payment_terms.map((item: any) => {
                    if (typeof item === 'string') {
                        return item;
                    }
                    return item.code || item.payment_term_code || '';
                }).filter(Boolean);
            }

            // Reset form with normalized data
            methods.reset({
                ...promo,
                start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
                end_date: promo.end_date ? promo.end_date.split('T')[0] : '',
                partner_families: normalizedPartnerFamilies,
                payment_terms: normalizedPaymentTerms
            });
        } catch (error: any) {
            console.error('Failed to load promotion:', error);
            if (error.response?.status === 404) {
                toast.error('Promotion introuvable');
            } else if (error.response?.data?.message) {
                toast.error(`Erreur: ${error.response.data.message}`);
            } else {
                toast.error('Échec du chargement des détails de la promotion');
            }
            navigate('/promotions');
        } finally {
            setLoading(false);
        }
    };

    const validatePromotion = useCallback((data: Promotion): string[] => {
        const errors: string[] = [];

        // Required fields validation
        if (!data.code?.trim()) errors.push('Le code promotion est obligatoire');
        if (!data.name?.trim()) errors.push('Le nom de la promotion est obligatoire');
        if (!data.start_date) errors.push('La date de début est obligatoire');
        if (!data.end_date) errors.push('La date de fin est obligatoire');
        if (!data.sequence || data.sequence < 1) errors.push('La séquence doit être un nombre positif');

        // Burning Validation
        if (data.is_burning_promo && !data.based_on_burned?.trim()) {
            errors.push('Le code de balance est requis pour une promotion de rachat');
        }

        // Validate scale_method
        if (!data.scale_method || (data.scale_method !== 1 && data.scale_method !== 2)) {
            errors.push('Méthode de calcul invalide (doit être 1=Cumulatif ou 2=Tranche)');
        }

        // Date validation
        if (data.start_date && data.end_date) {
            const startDate = new Date(data.start_date);
            const endDate = new Date(data.end_date);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (endDate <= startDate) {
                errors.push('La date de fin doit être après la date de début');
            }

            if (!isEdit && startDate < today) {
                errors.push('La date de début ne peut pas être dans le passé');
            }
        }

        // Burning Promotions: Ensure Breakpoint Type Compatibility (Warning or strict check)
        // Usually burning promos use Quantity (items bought) to calculate cost.
        if (data.is_burning_promo && data.breakpoint_type !== BreakpointType.QUANTITY_BASED && data.breakpoint_type !== BreakpointType.VALUE_BASED) {
            // Optional: stricter validation if needed
        }

        // Lines validation
        if (!data.lines || data.lines.length === 0) {
            errors.push('Au moins une règle de promotion est requise');
        } else {
            data.lines.forEach((line, lineIndex) => {
                if (!line.name?.trim()) {
                    errors.push(`Règle ${lineIndex + 1}: Le nom est obligatoire`);
                }

                // Validate target configuration
                if (line.paid_based_on_product === PromotionPaidBasedOn.SPECIFIC_PRODUCT && !line.paid_product_code) {
                    errors.push(`Règle ${lineIndex + 1}: Code produit requis pour cible "Produit Spécifique"`);
                }
                if (line.paid_based_on_product === PromotionPaidBasedOn.PRODUCT_FAMILY && !line.paid_product_family_code) {
                    errors.push(`Règle ${lineIndex + 1}: Code famille requis pour cible "Famille de Produits"`);
                }

                // Assortment validation
                const assortmentType = line.assortment_type ?? AssortmentType.NONE;
                if (assortmentType === AssortmentType.MULTIPLE_AND || assortmentType === AssortmentType.BOTH) {
                    if (!line.assortments || line.assortments.length === 0) {
                        errors.push(`Règle ${lineIndex + 1}: Au moins un produit/famille requis pour le type d'assortiment "Produits (ET)"`);
                    } else {
                        line.assortments.forEach((assortment, assortIdx) => {
                            if (!assortment.product_code?.trim()) {
                                errors.push(`Règle ${lineIndex + 1}, Assortiment ${assortIdx + 1}: Code produit/famille requis`);
                            }
                            if (!assortment.minimum || assortment.minimum < 1) {
                                errors.push(`Règle ${lineIndex + 1}, Assortiment ${assortIdx + 1}: Quantité minimum doit être au moins 1`);
                            }
                        });
                    }
                }
                if (assortmentType === AssortmentType.CART_AMOUNT || assortmentType === AssortmentType.BOTH) {
                    if (!line.minimum_cart_amount || line.minimum_cart_amount <= 0) {
                        errors.push(`Règle ${lineIndex + 1}: Montant minimum du panier requis pour le type d'assortiment "Montant Min"`);
                    }
                }

                // Details validation
                if (!line.details || line.details.length === 0) {
                    errors.push(`Règle ${lineIndex + 1}: Au moins un palier de remise est requis`);
                } else {
                    line.details.forEach((detail, detailIndex) => {
                        if (!detail.promo_type) {
                            errors.push(`Règle ${lineIndex + 1}, Palier ${detailIndex + 1}: Type de remise requis`);
                        }
                        if (detail.minimum_value === null || detail.minimum_value === undefined || detail.minimum_value < 0) {
                            errors.push(`Règle ${lineIndex + 1}, Palier ${detailIndex + 1}: Seuil minimum invalide`);
                        }
                        if (detail.amount === null || detail.amount === undefined || detail.amount <= 0) {
                            errors.push(`Règle ${lineIndex + 1}, Palier ${detailIndex + 1}: Valeur de remise doit être positive`);
                        }
                    });

                    // Check for duplicate thresholds
                    const thresholds = line.details.map(d => d.minimum_value);
                    const duplicates = thresholds.filter((val, idx) => thresholds.indexOf(val) !== idx);
                    if (duplicates.length > 0) {
                        errors.push(`Règle ${lineIndex + 1}: Seuils en double détectés (${duplicates.join(', ')})`);
                    }
                }
            });
        }

        // Partner families validation
        if (data.payment_term_dependent && (!data.payment_terms || data.payment_terms.length === 0)) {
            errors.push('Au moins une condition de paiement doit être sélectionnée quand "Dépendante des Conditions de Paiement" est activé');
        }

        return errors;
    }, [isEdit]);

    const onSubmit = async (data: Promotion) => {
        setSaving(true);
        setValidationErrors([]);

        try {
            // Ensure numeric values
            data.sequence = Number(data.sequence);
            data.breakpoint_type = Number(data.breakpoint_type) as BreakpointType;

            // Comprehensive validation
            const errors = validatePromotion(data);
            if (errors.length > 0) {
                setValidationErrors(errors);
                toast.error(`${errors.length} erreur(s) de validation détectée(s)`);
                setActiveTab('general'); // Switch to general tab to show errors
                setSaving(false);
                return;
            }

            // Transform data to API format
            const cleanedData = {
                ...data,
                code: data.code.trim().toUpperCase(),
                name: data.name.trim(),
                description: data.description?.trim() || '',
                lines: data.lines.map(line => {
                    // Map paid_code based on paid_based_on_product
                    let paid_code = undefined;
                    if (line.paid_based_on_product === 'product') {
                        paid_code = line.paid_product_code;
                    } else if (line.paid_based_on_product === 'family') {
                        paid_code = line.paid_product_family_code;
                    }

                    // Convert assortment_type to string for API
                    let assortment_type = 'none';
                    if (typeof line.assortment_type === 'number') {
                        assortment_type = ['none', 'multiple', 'cart_amount', 'both'][line.assortment_type] || 'none';
                    } else {
                        assortment_type = line.assortment_type || 'none';
                    }

                    return {
                        name: line.name.trim(),
                        paid_based_on_product: line.paid_based_on_product,
                        paid_code,
                        free_based_on_product: line.free_based_on_product,
                        free_code: line.free_code,
                        assortment_type,
                        minimum_cart_amount: line.minimum_cart_amount,
                        assortments: line.assortments?.map(a => ({
                            based_on_product: a.based_on_product,
                            product_code: a.based_on_product === '1' ? a.product_code : undefined,
                            product_family_code: a.based_on_product === '0' ? a.product_family_code : undefined,
                            minimum: Number(a.minimum)
                        })) || [],
                        details: line.details.map(detail => ({
                            promo_type: Number(detail.promo_type),
                            minimum_value: Number(detail.minimum_value),
                            amount: Number(detail.amount),
                            repeating: Boolean(detail.repeating)
                        }))
                    };
                })
            } as Promotion;

            if (isEdit && id) {
                await promotionsApi.updatePromotion(Number(id), cleanedData);
                toast.success('Promotion mise à jour avec succès');
            } else {
                await promotionsApi.createPromotion(cleanedData);
                toast.success('Promotion créée avec succès');
            }
            navigate('/promotions');
        } catch (error: any) {
            console.error('Promotion save error:', error);

            // Enhanced error handling
            if (error.response?.data?.message) {
                toast.error(`Erreur: ${error.response.data.message}`);
            } else if (error.response?.data?.errors) {
                const apiErrors = Object.values(error.response.data.errors).flat();
                setValidationErrors(apiErrors as string[]);
                toast.error(`${apiErrors.length} erreur(s) de validation`);
            } else if (error.message) {
                toast.error(`Erreur: ${error.message}`);
            } else {
                toast.error('Échec de l\'enregistrement de la promotion');
            }
        } finally {
            setSaving(false);
        }
    };

    // Watch partner families and payment terms
    const partnerFamilies = watch('partner_families');
    const paymentTerms = watch('payment_terms');

    // Tabs configuration
    const tabs = [
        { id: 'general', label: 'Informations Générales', icon: Layers, content: null },
        { id: 'rules', label: 'Règles & Remises', icon: Box, content: null },
        { id: 'partners', label: 'Ciblage Partenaires', icon: Users, content: null },
        { id: 'payment', label: 'Conditions de Paiement', icon: CreditCard, content: null },
        { id: 'boosts', label: 'Boosts', icon: TrendingUp, content: null },
    ];

    if (loading) {
        return (
            <MasterLayout
                leftContent={
                    <div className="bg-white h-full p-6 border-r border-gray-200">
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex items-center justify-center bg-slate-50">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                    </div>
                }
            />
        );
    }

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="bg-white h-full p-6 border-r border-gray-200 flex flex-col">
                        <button onClick={() => navigate('/promotions')} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-sage-700 transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Retour à la Liste
                        </button>
                        <div className="mb-6">
                            <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Modifier la Promotion' : 'Nouvelle Promotion'}</h1>
                            <p className="text-sm text-gray-500 mt-1">Configurez les règles de promotion, l'éligibilité et les périodes de validité.</p>
                        </div>

                        <div className="space-y-4 flex-1">
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                                <h3 className="text-sm font-semibold text-yellow-800 mb-1">Statut</h3>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-yellow-700">Fermée</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" {...register('is_closed')} />
                                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sage-600"></div>
                                    </label>
                                </div>
                            </div>

                            {/* Unsaved Changes Warning */}
                            {methods.formState.isDirty && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-2 text-amber-800">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-xs font-medium">Modifications non enregistrées</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Actions */}
                        <div className="border-t pt-4 space-y-3">
                            <button
                                type="submit"
                                form="promotion-form"
                                disabled={saving}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-medium"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Enregistrement...' : 'Enregistrer'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (methods.formState.isDirty) {
                                        setShowCancelConfirm(true);
                                    } else {
                                        navigate('/promotions');
                                    }
                                }}
                                className="w-full px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition font-medium"
                                disabled={saving}
                            >
                                Annuler
                            </button>
                        </div>
                    </div>
                }
                mainContent={
                    <FormProvider {...methods}>
                        <form id="promotion-form" onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col bg-slate-50">
                            <div className="bg-white border-b px-6 py-2">
                                <SageTabs
                                    tabs={tabs}
                                    activeTabId={activeTab}
                                    onTabChange={setActiveTab}
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 pb-6">
                                <div className="max-w-5xl mx-auto space-y-6">

                                    {/* Validation Errors Panel */}
                                    {validationErrors.length > 0 && (
                                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg animate-in fade-in">
                                            <div className="flex items-start gap-3">
                                                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1">
                                                    <h3 className="text-sm font-semibold text-red-900 mb-2">
                                                        {validationErrors.length} Erreur(s) de Validation
                                                    </h3>
                                                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                                                        {validationErrors.map((error, idx) => (
                                                            <li key={idx}>{error}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setValidationErrors([])}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* General Tab */}
                                    {activeTab === 'general' && (
                                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                            <div className="grid grid-cols-2 gap-6">
                                                <div className="col-span-2 md:col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">Nom de la Promotion <span className="text-red-500">*</span></label>
                                                    <input {...register('name', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" placeholder="ex: Vente d'Hiver 2024" />
                                                    {errors.name && <span className="text-xs text-red-500 font-medium">Obligatoire</span>}
                                                </div>
                                                <div className="col-span-2 md:col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">Code Promotion <span className="text-red-500">*</span></label>
                                                    <input {...register('code', { required: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none uppercase font-mono transition" placeholder="PROMO-XXX" />
                                                </div>


                                                <div className="col-span-2 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">Description</label>
                                                    <textarea {...register('description')} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" rows={3} placeholder="Description détaillée de la promotion..." />
                                                </div>

                                                {/* Burning / Redemption Section - New */}
                                                <div className="col-span-2 bg-orange-50 border border-orange-100 rounded-lg p-4 space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-orange-900">Promotion de Rachat (Points / Budget)</h3>
                                                            <p className="text-xs text-orange-700 mt-1">Permet aux partenaires d'utiliser leur solde (Points, Budget, etc.) pour obtenir cette promotion.</p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input type="checkbox" className="sr-only peer" {...register('is_burning_promo')} />
                                                            <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                                                        </label>
                                                    </div>

                                                    {isBurningPromo && (
                                                        <div className="animate-in fade-in slide-in-from-top-2">
                                                            <label className="text-sm font-medium text-gray-700">
                                                                Code de la Balance à Brûler <span className="text-red-500">*</span>
                                                            </label>
                                                            <select
                                                                {...register('based_on_burned', { required: isBurningPromo })}
                                                                className="w-full mt-1 p-2 border rounded focus:ring-orange-500 focus:border-orange-500 outline-none bg-white"
                                                            >
                                                                <option value="">Sélectionner une balance...</option>
                                                                <option value="POINTS">Fidélité (POINTS)</option>
                                                                <option value="BUDGET">Budget Marketing (BUDGET)</option>
                                                                <option value="WALLET">Portefeuille (WALLET)</option>
                                                            </select>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                Sélectionnez le type de solde à débiter pour cette promotion.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">Date de Début <span className="text-red-500">*</span></label>
                                                    <div className="relative">
                                                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input type="date" {...register('start_date')} className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" />
                                                    </div>
                                                </div>
                                                <div className="col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">Date de Fin <span className="text-red-500">*</span></label>
                                                    <div className="relative">
                                                        <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                        <input type="date" {...register('end_date')} className="w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" />
                                                    </div>
                                                </div>

                                                <div className="col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">
                                                        Priorité (Séquence) <span className="text-red-500">*</span>
                                                    </label>
                                                    <input type="number" {...register('sequence', { valueAsNumber: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition" placeholder="10" min="1" />
                                                    <p className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-100">
                                                        <strong className="text-blue-900">Plus petit = Plus prioritaire</strong><br />
                                                        Recommandé: 10, 20, 30... pour flexibilité
                                                    </p>
                                                </div>

                                                <div className="col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">
                                                        Type de Seuil <span className="text-red-500">*</span>
                                                    </label>
                                                    <select {...register('breakpoint_type', { valueAsNumber: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white transition">
                                                        <option value={BreakpointType.QUANTITY_BASED}>📦 Quantité (Unités)</option>
                                                        <option value={BreakpointType.VALUE_BASED}>💰 Valeur (MAD)</option>
                                                        <option value={BreakpointType.PROMO_UNIT_BASED}>🎁 Unités Promo</option>
                                                    </select>
                                                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                                        Définit comment les seuils sont calculés
                                                    </p>
                                                </div>

                                                <div className="col-span-1 space-y-2">
                                                    <label className="text-sm font-semibold text-gray-700">
                                                        Méthode de Calcul <span className="text-red-500">*</span>
                                                    </label>
                                                    <select {...register('scale_method', { valueAsNumber: true })} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white transition">
                                                        <option value={1}>📊 Cumulatif (Progressive)</option>
                                                        <option value={2}>🎯 Tranche (Bracket)</option>
                                                    </select>
                                                    <p className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                                        <strong>Cumulatif:</strong> Accumule les paliers | <strong>Tranche:</strong> Palier le plus élevé uniquement
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Rules Tab */}
                                    {activeTab === 'rules' && (
                                        <div className="animate-in fade-in">
                                            <PromotionRuleEditor />
                                        </div>
                                    )}

                                    {/* Partners Tab */}
                                    {activeTab === 'partners' && (
                                        <div className="space-y-6 animate-in fade-in">
                                            <PartnerFamilyManager
                                                selectedCodes={partnerFamilies || []}
                                                onSelectionChange={(codes) => setValue('partner_families', codes, { shouldDirty: false, shouldValidate: false })}
                                            />
                                            {partnerFamilies && partnerFamilies.length > 0 && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                    <h4 className="text-sm font-semibold text-blue-900 mb-2">
                                                        Familles sélectionnées ({partnerFamilies.length})
                                                    </h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {partnerFamilies.map((code: string) => (
                                                            <span
                                                                key={code}
                                                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
                                                            >
                                                                {code}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'payment' && (
                                        <div className="space-y-6 animate-in fade-in">
                                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                                <div className="items-center mb-4">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input type="checkbox" {...register('payment_term_dependent')} className="rounded text-sage-600 focus:ring-sage-500" />
                                                        <span className="font-medium text-gray-900">Dépendante des Conditions de Paiement</span>
                                                    </label>
                                                    <p className="text-sm text-gray-500 ml-6 mt-1">Si activé, cette promotion ne s'appliquera que pour des conditions de paiement spécifiques.</p>
                                                </div>

                                                {paymentTermDependent && (
                                                    <div className="mt-6">
                                                        <h3 className="text-lg font-medium text-gray-900 mb-4">Conditions de Paiement Autorisées</h3>
                                                        <PaymentTermsManager
                                                            selectedCodes={paymentTerms || []}
                                                            onSelectionChange={(codes) => setValue('payment_terms', codes, { shouldDirty: false, shouldValidate: false })}
                                                        />
                                                        {paymentTerms && paymentTerms.length > 0 && (
                                                            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                                                                <h4 className="text-sm font-semibold text-green-900 mb-2">
                                                                    Conditions sélectionnées ({paymentTerms.length})
                                                                </h4>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {paymentTerms.map((code: string) => (
                                                                        <span
                                                                            key={code}
                                                                            className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                                                                        >
                                                                            {code}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'boosts' && (
                                        <div className="space-y-6 animate-in fade-in">
                                            <BoostManager />
                                        </div>
                                    )}

                                </div>
                            </div>
                        </form>
                    </FormProvider>
                }
            />
            {showCancelConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-in fade-in">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-in zoom-in">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-amber-100 rounded-full">
                                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Modifications non enregistrées
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Vous avez des modifications non enregistrées. Êtes-vous sûr de vouloir quitter sans enregistrer ?
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                            <button
                                type="button"
                                onClick={() => setShowCancelConfirm(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition"
                            >
                                Continuer l'édition
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/promotions')}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                            >
                                Quitter sans enregistrer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

