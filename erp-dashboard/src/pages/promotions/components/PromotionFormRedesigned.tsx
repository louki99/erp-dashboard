import { useEffect, useState } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
    Save,
    X,
    Calendar,
    Tag,
    FileText,
    Settings,
    Users,
    CreditCard,
    Loader2,
    Banknote,
    Clock,
    AlertTriangle,
} from 'lucide-react';
import type { Promotion, PromotionType, PromotionWritePayload } from '@/types/promotion.types';
import { BreakpointType } from '@/types/promotion.types';
import { promotionsApi } from '@/services/api/promotionsApi';
import { PromotionRulesSection } from './PromotionRulesSection';
import { PromotionPartnersSection } from './PromotionPartnersSection';
import { PromotionPaymentSection } from './PromotionPaymentSection';

export const PromotionFormRedesigned = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = Boolean(id);
    
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [activeSection, setActiveSection] = useState<'general' | 'rules' | 'partners' | 'payment'>('general');
    const [formReady, setFormReady] = useState(!isEdit);

    const methods = useForm<Promotion>({
        defaultValues: {
            code: '',
            name: '',
            description: '',
            start_date: '',
            end_date: '',
            sequence: 10,
            breakpoint_type: BreakpointType.QUANTITY_BASED,
            scale_method: 1,
            is_burning_promo: false,
            based_on_burned: '',
            is_closed: false,
            partner_families: [],
            payment_terms: [],
            business_chronologies: [],
            lines: [],
            // New fields (2026-07-11)
            max_budget: null,
            cumulative_basis: 'order',
            active_days: null,
            daily_start_time: null,
            daily_end_time: null,
        }
    });

    const { register, handleSubmit, formState: { errors }, watch, reset, setValue } = methods;
    const isBurningPromo = watch('is_burning_promo');
    const breakpointTypeVal = watch('breakpoint_type');
    const cumulativeBasis = watch('cumulative_basis');
    const activeDays = (watch('active_days') ?? []) as number[];
    const dailyStart = watch('daily_start_time');
    const dailyEnd = watch('daily_end_time');

    const DAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
    const DAY_FULL = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

    const toggleDay = (day: number) => {
        const current = activeDays ?? [];
        const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort();
        setValue('active_days', next.length === 0 ? null : next);
    };

    const hasSchedule = (activeDays && activeDays.length > 0) || dailyStart || dailyEnd;

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

            // Normalize data
            const normalizedPartnerFamilies = Array.isArray(promo.partner_families)
                ? promo.partner_families.map((item: any) => 
                    typeof item === 'string' ? item : (item.code || item.family_code || '')
                  ).filter(Boolean)
                : [];

            const normalizedPaymentTerms = Array.isArray(promo.payment_terms)
                ? promo.payment_terms.map((item: any) =>
                    typeof item === 'string' ? item : (item.code || '')
                  ).filter(Boolean)
                : [];

            // Ciblage chronologies : le backend renvoie des objets (pivot) — on garde {code, sub_types}
            const normalizedChronologies = Array.isArray((promo as any).business_chronologies)
                ? (promo as any).business_chronologies
                      .map((item: any) => ({
                          code: typeof item === 'string' ? item : (item.code ?? ''),
                          sub_types: Array.isArray(item?.sub_types) ? item.sub_types : [],
                      }))
                      .filter((c: any) => c.code)
                : [];

            const normalizedLines = promo.lines?.map((line: any) => {
                let paid_product_code = undefined;
                let paid_product_family_code = undefined;
                
                // API returns boolean: true = product, false = family
                // UI expects string: 'product', 'family', 'cart'
                let paid_based_on_product: string;
                if (typeof line.paid_based_on_product === 'boolean') {
                    paid_based_on_product = line.paid_based_on_product ? 'product' : 'family';
                } else {
                    paid_based_on_product = line.paid_based_on_product || 'product';
                }
                
                // Extract codes based on type
                if (paid_based_on_product === 'product') {
                    paid_product_code = line.paid_product_code || line.paid_code || line.product_code;
                } else if (paid_based_on_product === 'family') {
                    paid_product_family_code = line.paid_product_family_code || line.paid_code || line.family_code;
                }

                return {
                    ...line,
                    paid_based_on_product,
                    paid_product_code,
                    paid_product_family_code,
                    assortment_type: String(line.assortment_type || 0)
                };
            }) || [];

            reset({
                ...promo,
                start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
                end_date: promo.end_date ? promo.end_date.split('T')[0] : '',
                partner_families: normalizedPartnerFamilies,
                payment_terms: normalizedPaymentTerms,
                business_chronologies: normalizedChronologies,
                lines: normalizedLines
            });
            setFormReady(true);
        } catch (error: any) {
            console.error('Failed to load promotion:', error);
            toast.error('Échec du chargement de la promotion');
            navigate('/promotions');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: Promotion) => {
        // Validate required fields
        if (!data.code?.trim()) {
            toast.error('Le code promotion est requis');
            return;
        }
        if (!data.name?.trim()) {
            toast.error('Le nom de la promotion est requis');
            return;
        }
        if (!data.lines || data.lines.length === 0) {
            toast.error('Au moins une règle de promotion est requise');
            return;
        }

        // Validate each line has at least one breakpoint
        for (let i = 0; i < data.lines.length; i++) {
            const line = data.lines[i];
            if (!line.details || line.details.length === 0) {
                toast.error(`La règle "${line.name || `Ligne ${i + 1}`}" doit avoir au moins un palier`);
                return;
            }
        }

        setSaving(true);

        try {
            // Transform data to API format
            const apiData: PromotionWritePayload = {
                ...data,
                code: data.code.trim().toUpperCase(),
                name: data.name.trim(),
                description: data.description?.trim() || '',
                sequence: Number(data.sequence),
                breakpoint_type: Number(data.breakpoint_type) as BreakpointType,
                scale_method: Number(data.scale_method) as 1 | 2,
                // Dérivé : la promo est dépendante du paiement dès qu'une condition est cochée
                payment_term_dependent: (data.payment_terms?.length ?? 0) > 0,
                // Ciblage chronologies (module 20) — additif avec partner_families
                business_chronologies: (data.business_chronologies ?? []).map(c => ({
                    code: c.code,
                    sub_types: c.sub_types ?? [],
                })),
                lines: data.lines.map(line => {
                    // Map paid_code based on paid_based_on_product
                    let paid_code = undefined;
                    if (line.paid_based_on_product === 'product' && line.paid_product_code) {
                        paid_code = line.paid_product_code;
                    } else if (line.paid_based_on_product === 'family' && line.paid_product_family_code) {
                        paid_code = line.paid_product_family_code;
                    }

                    // Convert assortment_type to integer for API
                    const assortment_type = parseInt(String(line.assortment_type || '0'));

                    // Convert back to boolean for API: 'product' = true, 'family'/'cart' = false
                    const paid_based_on_product_api = line.paid_based_on_product === 'product';

                    return {
                        name: line.name.trim(),
                        paid_based_on_product: paid_based_on_product_api,
                        paid_product_code: line.paid_based_on_product === 'product' ? paid_code : undefined,
                        paid_product_family_code: line.paid_based_on_product === 'family' ? paid_code : undefined,
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
                            promo_type: Number(detail.promo_type) as PromotionType,
                            minimum_value: Number(detail.minimum_value),
                            amount: Number(detail.amount),
                            repeating: Boolean(detail.repeating)
                        }))
                    };
                })
            };

            if (isEdit && id) {
                await promotionsApi.updatePromotion(Number(id), apiData);
                toast.success('✓ Promotion mise à jour');
            } else {
                await promotionsApi.createPromotion(apiData);
                toast.success('✓ Promotion créée');
            }
            navigate('/promotions');
        } catch (error: any) {
            console.error('Save error:', error);
            const message = error.response?.data?.message || error.message || 'Erreur lors de l\'enregistrement';
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-sage-600 mx-auto mb-4" />
                    <p className="text-gray-600 font-medium">Chargement...</p>
                </div>
            </div>
        );
    }

    const sections = [
        { id: 'general', label: 'Général', icon: Settings },
        { id: 'rules', label: 'Règles', icon: FileText },
        { id: 'partners', label: 'Partenaires', icon: Users },
        { id: 'payment', label: 'Paiement', icon: CreditCard },
    ];

    return (
        <FormProvider {...methods}>
            <form onSubmit={handleSubmit(onSubmit)} className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                    <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => navigate('/promotions')}
                                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900">
                                        {isEdit ? 'Modifier la Promotion' : 'Nouvelle Promotion'}
                                    </h1>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {isEdit ? 'Mettez à jour les détails de la promotion' : 'Créez une nouvelle promotion pour vos partenaires'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => navigate('/promotions')}
                                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Enregistrement...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Enregistrer
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="flex gap-1">
                            {sections.map((section) => {
                                const Icon = section.icon;
                                const isActive = activeSection === section.id;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => setActiveSection(section.id as any)}
                                        className={`
                                            flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all relative
                                            ${isActive 
                                                ? 'text-sage-600 bg-sage-50' 
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {section.label}
                                        {isActive && (
                                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sage-600" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                        {!formReady ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                            </div>
                        ) : (
                            <>
                        {/* General Section */}
                        <div className={activeSection === 'general' ? 'block' : 'hidden'}>
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Code */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Code Promotion <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                {...register('code', { required: true })}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition uppercase font-mono"
                                                placeholder="PROMO-2024"
                                            />
                                        </div>
                                        {errors.code && <p className="text-xs text-red-500 mt-1">Code requis</p>}
                                    </div>

                                    {/* Name */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Nom <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            {...register('name', { required: true })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition"
                                            placeholder="Vente d'Hiver 2024"
                                        />
                                        {errors.name && <p className="text-xs text-red-500 mt-1">Nom requis</p>}
                                    </div>

                                    {/* Description */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Description
                                        </label>
                                        <textarea
                                            {...register('description')}
                                            rows={3}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition resize-none"
                                            placeholder="Description détaillée de la promotion..."
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Date de Début <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                {...register('start_date', { required: true })}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Date de Fin <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="date"
                                                {...register('end_date', { required: true })}
                                                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition"
                                            />
                                        </div>
                                    </div>

                                    {/* Sequence */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Priorité (Séquence) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            {...register('sequence', { valueAsNumber: true, required: true })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition"
                                            placeholder="10"
                                            min="1"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Plus petit = Plus prioritaire (1-10: VIP, 11-20: Premium, 21-30: Standard, 100+: Toujours actif)</p>
                                    </div>

                                    {/* Skip to Sequence */}
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Sauter à Séquence
                                        </label>
                                        <input
                                            type="number"
                                            {...register('skip_to_sequence', { valueAsNumber: true })}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition"
                                            placeholder="0"
                                            min="0"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            <span className="font-semibold">0 = Aucun saut</span> (permet toutes les promos suivantes)<br/>
                                            <span className="font-semibold">&gt;0 = Bloquer</span> les promos avec séquence &lt; cette valeur<br/>
                                            <span className="font-semibold">999 = Exclusif</span> (bloque toutes les autres promos)
                                        </p>
                                    </div>

                                    {/* ── Breakpoint Type — visual card picker ── */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Comment déclencher la remise ? <span className="text-red-500">*</span>
                                        </label>
                                        <p className="text-xs text-gray-400 mb-3">Choisissez comment le moteur mesure le seuil d'éligibilité.</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {([
                                                { value: 1, emoji: '📦', title: 'Quantité',     sub: 'Nombre d\'unités achetées',    example: 'ex : ≥ 50 unités → remise active',   sel: 'border-blue-500 bg-blue-50',   dot: 'bg-blue-500'   },
                                                { value: 2, emoji: '💰', title: 'Valeur MAD',   sub: 'Montant total d\'achat en MAD', example: 'ex : ≥ 500 MAD → remise active',    sel: 'border-green-500 bg-green-50', dot: 'bg-green-500'  },
                                                { value: 3, emoji: '🎁', title: 'Unités Promo', sub: 'Poids promo pondéré du produit', example: 'ex : ≥ 10 UP → remise active',      sel: 'border-violet-500 bg-violet-50', dot: 'bg-violet-500' },
                                            ] as const).map(opt => {
                                                const isSelected = Number(breakpointTypeVal) === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setValue('breakpoint_type', opt.value as any)}
                                                        className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                                                            ${isSelected ? opt.sel : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'}`}
                                                    >
                                                        <span className="text-2xl mb-2 leading-none">{opt.emoji}</span>
                                                        <span className="font-semibold text-sm text-gray-900 mb-0.5">{opt.title}</span>
                                                        <span className="text-xs text-gray-500 leading-snug mb-2">{opt.sub}</span>
                                                        <span className="text-[10px] text-gray-400 italic">{opt.example}</span>
                                                        {isSelected && (
                                                            <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${opt.dot}`}>
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* ── Scale Method — visual card picker ──── */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                                            Comment les paliers s'appliquent-ils ? <span className="text-red-500">*</span>
                                        </label>
                                        <p className="text-xs text-gray-400 mb-3">Si plusieurs paliers sont atteints, comment sont-ils combinés ?</p>
                                        <div className="grid grid-cols-2 gap-3">
                                            {([
                                                {
                                                    value: 1, emoji: '📊', title: 'Cumulatif',
                                                    sub: 'Tous les paliers atteints s\'accumulent',
                                                    example: 'ex : 5% dès 50 unités + 3% dès 100 → 8% total à 100 unités',
                                                    hint: 'Idéal pour récompenser progressivement les gros volumes.',
                                                    sel: 'border-indigo-500 bg-indigo-50', dot: 'bg-indigo-500',
                                                },
                                                {
                                                    value: 2, emoji: '🎯', title: 'Tranche (Bracket)',
                                                    sub: 'Seul le palier le plus élevé atteint s\'applique',
                                                    example: 'ex : 5% dès 50 unités — mais 10% dès 100 → seul 10% s\'applique',
                                                    hint: 'Idéal pour des remises nettes par seuil.',
                                                    sel: 'border-amber-500 bg-amber-50', dot: 'bg-amber-500',
                                                },
                                            ] as const).map(opt => {
                                                const isSelected = Number(watch('scale_method')) === opt.value;
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => setValue('scale_method', opt.value as any)}
                                                        className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left
                                                            ${isSelected ? opt.sel : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/60'}`}
                                                    >
                                                        <span className="text-2xl mb-2 leading-none">{opt.emoji}</span>
                                                        <span className="font-semibold text-sm text-gray-900 mb-0.5">{opt.title}</span>
                                                        <span className="text-xs text-gray-500 leading-snug mb-2">{opt.sub}</span>
                                                        <span className="text-[10px] text-gray-400 italic leading-snug mb-1">{opt.example}</span>
                                                        <span className="text-[10px] text-gray-500 font-medium">{opt.hint}</span>
                                                        {isSelected && (
                                                            <div className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center ${opt.dot}`}>
                                                                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6 5,9 10,3"/></svg>
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Burning Promo */}
                                    <div className="col-span-2 bg-orange-50 border border-orange-200 rounded-lg p-4">
                                        <div className="flex items-center justify-between mb-3">
                                            <div>
                                                <h3 className="text-sm font-semibold text-orange-900">Promotion de Rachat</h3>
                                                <p className="text-xs text-orange-700 mt-1">Permet aux partenaires d'utiliser leur solde</p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    {...register('is_burning_promo')}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                            </label>
                                        </div>
                                        {isBurningPromo && (
                                            <select
                                                {...register('based_on_burned', { required: isBurningPromo })}
                                                className="w-full px-4 py-2 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                                            >
                                                <option value="">Sélectionner une balance...</option>
                                                <option value="POINTS">Fidélité (POINTS)</option>
                                                <option value="BUDGET">Budget Marketing (BUDGET)</option>
                                                <option value="WALLET">Portefeuille (WALLET)</option>
                                            </select>
                                        )}
                                    </div>

                                    {/* ── Budget Campagne ───────────────────── */}
                                    <div className="col-span-2 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Banknote className="w-4 h-4 text-emerald-700" />
                                            <h3 className="text-sm font-semibold text-emerald-900">Budget Campagne</h3>
                                            <span className="text-xs text-emerald-600 ml-auto">0 ou vide = illimité</span>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            {...register('max_budget', { setValueAs: (v: string) => v === '' ? null : Number(v) })}
                                            className="w-full px-4 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white text-sm"
                                            placeholder="ex: 50000.00 MAD — laissez vide pour illimité"
                                        />
                                        <p className="text-xs text-emerald-700 mt-1.5">
                                            ⚡ Augmenter ce budget au-dessus du consommé réactive automatiquement la promotion (le backend efface <code>budget_exhausted_at</code>).
                                        </p>
                                    </div>

                                    {/* ── Base Cumulative ───────────────────── */}
                                    <div className="col-span-2">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                                            Base Cumulative des Paliers
                                        </label>
                                        <select
                                            {...register('cumulative_basis')}
                                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none transition bg-white"
                                        >
                                            <option value="order">📋 Par Commande (défaut) — seuil évalué sur la commande courante</option>
                                            <option value="monthly_partner" disabled={Number(breakpointTypeVal) !== 2}>
                                                📅 Cumulatif Mensuel Partenaire — CA cumulé depuis le 1er du mois{Number(breakpointTypeVal) !== 2 ? ' (nécessite Seuil = Valeur MAD)' : ''}
                                            </option>
                                        </select>
                                        {cumulativeBasis === 'monthly_partner' && Number(breakpointTypeVal) !== 2 && (
                                            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                Le cumulatif mensuel nécessite <strong>Type de Seuil = Valeur (MAD)</strong>. Changez le type de seuil ci-dessus.
                                            </p>
                                        )}
                                        {cumulativeBasis === 'monthly_partner' && Number(breakpointTypeVal) === 2 && (
                                            <p className="text-xs text-blue-600 mt-1.5">
                                                Exemple : « 5% si le client dépasse 20 000 MAD cumulés ce mois » → palier minimum_value: 20000, amount: 5, promo_type: 1.
                                            </p>
                                        )}
                                    </div>

                                    {/* ── Happy Hours / Flash Sales ─────────── */}
                                    <div className="col-span-2 border border-gray-200 rounded-lg p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Clock className="w-4 h-4 text-blue-600" />
                                            <h3 className="text-sm font-semibold text-gray-900">Happy Hours / Flash Sales</h3>
                                            {hasSchedule && (
                                                <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Fenêtre activée</span>
                                            )}
                                        </div>

                                        {/* Day toggles */}
                                        <div className="mb-3">
                                            <p className="text-xs text-gray-500 mb-2">Jours actifs <span className="text-gray-400">(aucun sélectionné = tous les jours)</span></p>
                                            <div className="flex gap-1.5">
                                                {DAY_LABELS.map((lbl, i) => {
                                                    const dayNum = i + 1;
                                                    const isOn = activeDays?.includes(dayNum) ?? false;
                                                    return (
                                                        <button
                                                            key={dayNum}
                                                            type="button"
                                                            title={DAY_FULL[i]}
                                                            onClick={() => toggleDay(dayNum)}
                                                            className={`w-9 h-9 rounded-lg text-xs font-bold transition-all border
                                                                ${isOn
                                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                                                    : 'bg-white text-gray-400 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                                                                }`}
                                                        >
                                                            {lbl}
                                                        </button>
                                                    );
                                                })}
                                                {activeDays && activeDays.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setValue('active_days', null)}
                                                        className="w-9 h-9 rounded-lg text-xs text-gray-300 hover:text-red-400 border border-dashed border-gray-200 hover:border-red-300 transition-all"
                                                        title="Réinitialiser (tous les jours)"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Time range */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Heure de début <span className="text-gray-400">(vide = toute la journée)</span></label>
                                                <input
                                                    type="time"
                                                    {...register('daily_start_time', { setValueAs: (v: string) => v === '' ? null : v })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 outline-none text-sm bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Heure de fin</label>
                                                <input
                                                    type="time"
                                                    {...register('daily_end_time', { setValueAs: (v: string) => v === '' ? null : v })}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 outline-none text-sm bg-white"
                                                />
                                            </div>
                                        </div>
                                        {dailyStart && dailyEnd && dailyEnd <= dailyStart && (
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" /> L'heure de fin doit être après l'heure de début (validé par le backend).
                                            </p>
                                        )}
                                        {hasSchedule && (
                                            <p className="text-xs text-blue-600 mt-2">
                                                ⚡ La bascule est instantanée à la minute près — pas de délai de cache pour les fenêtres horaires.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rules Section */}
                        <div className={activeSection === 'rules' ? 'block' : 'hidden'}>
                            <PromotionRulesSection />
                        </div>

                        {/* Partners Section */}
                        <div className={activeSection === 'partners' ? 'block' : 'hidden'}>
                            <PromotionPartnersSection />
                        </div>

                        {/* Payment Section */}
                        <div className={activeSection === 'payment' ? 'block' : 'hidden'}>
                            <PromotionPaymentSection />
                        </div>

                        </>
                        )}
                    </div>
                </div>
            </form>
        </FormProvider>
    );
};
