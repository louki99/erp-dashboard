import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import { BreakpointType } from '@/types/promotion.types';
import { ArrowLeft, Save, Loader2, Layers, Users, CreditCard, Box, Calendar, TrendingUp } from 'lucide-react';
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

    const methods = useForm<Promotion>({
        defaultValues: {
            is_closed: false,
            payment_term_dependent: false,
            breakpoint_type: BreakpointType.VALUE_BASED,
            lines: [],
            partner_families: [],
            payment_terms: [],
            sequence: 10
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors } } = methods;

    // Watch fields for dynamic UI
    const paymentTermDependent = watch('payment_term_dependent');

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
            // Reset form with data
            methods.reset({
                ...promo,
                start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
                end_date: promo.end_date ? promo.end_date.split('T')[0] : ''
            });
        } catch (error) {
            toast.error('Échec du chargement des détails de la promotion');
            navigate('/promotions');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: Promotion) => {
        console.log('🔴 FORM SUBMIT TRIGGERED', new Error().stack);
        setSaving(true);
        try {
            // Ensure numeric values
            data.sequence = Number(data.sequence);

            // Validate Dates
            if (new Date(data.end_date) <= new Date(data.start_date)) {
                toast.error('La date de fin doit être après la date de début');
                setSaving(false);
                return;
            }

            if (isEdit && id) {
                console.log('🔴 CALLING UPDATE PROMOTION API');
                await promotionsApi.updatePromotion(Number(id), data);
                toast.success('Promotion mise à jour avec succès');
            } else {
                await promotionsApi.createPromotion(data);
                toast.success('Promotion créée avec succès');
            }
            navigate('/promotions');
        } catch (error) {
            console.error(error);
            toast.error('Échec de l\'enregistrement de la promotion');
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
        <MasterLayout
            leftContent={
                <div className="bg-white h-full p-6 border-r border-gray-200">
                    <button onClick={() => navigate('/promotions')} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-sage-700">
                        <ArrowLeft className="w-4 h-4" /> Retour à la Liste
                    </button>
                    <div className="mb-6">
                        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Modifier la Promotion' : 'Nouvelle Promotion'}</h1>
                        <p className="text-sm text-gray-500 mt-1">Configurez les règles de promotion, l'éligibilité et les périodes de validité.</p>
                    </div>

                    <div className="space-y-4">
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
                    </div>
                </div>
            }
            mainContent={
                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col bg-slate-50">
                        <div className="bg-white border-b px-6 py-2">
                            <SageTabs
                                tabs={tabs}
                                activeTabId={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto space-y-6">

                                {/* General Tab */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="col-span-2 md:col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Nom de la Promotion <span className="text-red-500">*</span></label>
                                                <input {...register('name', { required: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" placeholder="ex: Vente d'Hiver 2024" />
                                                {errors.name && <span className="text-xs text-red-500">Obligatoire</span>}
                                            </div>
                                            <div className="col-span-2 md:col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Code Promotion <span className="text-red-500">*</span></label>
                                                <input {...register('code', { required: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none uppercase font-mono" placeholder="PROMO-XXX" />
                                            </div>

                                            <div className="col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Description</label>
                                                <textarea {...register('description')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" rows={3} placeholder="Description détaillée de la promotion..." />
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Date de Début</label>
                                                <div className="relative">
                                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input type="date" {...register('start_date')} className="w-full pl-9 p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Date de Fin</label>
                                                <div className="relative">
                                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input type="date" {...register('end_date')} className="w-full pl-9 p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" />
                                                </div>
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Priorité (Séquence)
                                                    <span className="ml-2 text-xs font-normal text-gray-500">(Obligatoire)</span>
                                                </label>
                                                <input type="number" {...register('sequence', { valueAsNumber: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" placeholder="10" min="1" />
                                                <p className="text-xs text-gray-500">
                                                    <strong>Nombre plus petit = Priorité plus élevée</strong><br/>
                                                    Lorsque plusieurs promotions s'appliquent, les séquences plus basses sont évaluées en premier.<br/>
                                                    Recommandé : Utilisez des incréments de 10 (10, 20, 30) pour plus de flexibilité.
                                                </p>
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Type de Seuil
                                                    <span className="ml-2 text-xs font-normal text-gray-500">(Obligatoire)</span>
                                                </label>
                                                <select {...register('breakpoint_type', { valueAsNumber: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none">
                                                    <option value={BreakpointType.VALUE_BASED}>Basé sur la Valeur (Montant en MAD)</option>
                                                    <option value={BreakpointType.QUANTITY_BASED}>Basé sur la Quantité (Unités)</option>
                                                    <option value={BreakpointType.PROMO_UNIT_BASED}>Basé sur Unités Promo</option>
                                                </select>
                                                <p className="text-xs text-gray-500">
                                                    <strong>Basé sur la Valeur :</strong> Les seuils sont calculés sur le montant total d'achat en MAD<br/>
                                                    <strong>Basé sur la Quantité :</strong> Les seuils sont calculés sur le nombre d'unités<br/>
                                                    <strong>Basé sur Unités Promo :</strong> Les seuils sont calculés sur des unités promo standardisées
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

                        <div className="bg-white border-t p-4 flex justify-end gap-3 z-10">
                            <button
                                type="button"
                                onClick={() => navigate('/promotions')}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-sage-600 text-white rounded-md hover:bg-sage-700 transition disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Enregistrer la Promotion
                            </button>
                        </div>
                    </form>
                </FormProvider>
            }
        />
    );
};

