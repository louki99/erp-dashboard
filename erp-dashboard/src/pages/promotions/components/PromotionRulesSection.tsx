import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, ChevronDown, ChevronRight, Search, HelpCircle } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import type { Promotion, PromotionLine } from '@/types/promotion.types';
import { PromotionType, BreakpointType } from '@/types/promotion.types';
import { ProductSelectionModal } from './ProductSelectionModal';
import { ProductFamilySelectionDrawer } from './ProductFamilySelectionDrawer';
import { AssortmentHelpModal } from './AssortmentHelpModal';

export const PromotionRulesSection = () => {
    const { control, watch, register } = useFormContext<Promotion>();
    const { fields, append, remove, update } = useFieldArray({
        control,
        name: 'lines'
    });

    const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
    const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
    const [isAssortmentHelpOpen, setIsAssortmentHelpOpen] = useState(false);

    const breakpointType = watch('breakpoint_type');
    // Watch all lines for reactive updates
    const watchedLines = watch('lines');

    // Expand all lines on mount
    useEffect(() => {
        if (fields.length > 0) {
            const allIndices = new Set(fields.map((_, index) => index));
            setExpandedLines(allIndices);
        }
    }, [fields.length]);

    const breakpointLabel = useMemo(() => {
        switch (breakpointType) {
            case BreakpointType.QUANTITY_BASED:
                return { label: 'Seuil Minimum (Unités)', placeholder: 'Ex: 5 unités' };
            case BreakpointType.VALUE_BASED:
                return { label: 'Seuil Minimum (MAD)', placeholder: 'Ex: 500 MAD' };
            case BreakpointType.PROMO_UNIT_BASED:
                return { label: 'Seuil Minimum (Unités Promo)', placeholder: 'Ex: 10 unités promo' };
            default:
                return { label: 'Seuil Minimum', placeholder: 'Ex: 5' };
        }
    }, [breakpointType]);

    const toggleLine = (index: number) => {
        const newExpanded = new Set(expandedLines);
        if (newExpanded.has(index)) {
            newExpanded.delete(index);
        } else {
            newExpanded.add(index);
        }
        setExpandedLines(newExpanded);
    };

    const addNewLine = () => {
        const newIndex = fields.length;
        append({
            name: `Règle #${newIndex + 1}`,
            paid_based_on_product: 'product',
            paid_product_code: '',
            paid_product_family_code: '',
            assortment_type: '0',
            assortments: [],
            details: []
        } as PromotionLine);
        setExpandedLines(new Set([...expandedLines, newIndex]));
    };

    const addBreakpoint = (lineIndex: number) => {
        const line = fields[lineIndex];
        const newDetails = [...(line.details || []), {
            promo_type: PromotionType.PERCENTAGE_DISCOUNT,
            minimum_value: 0,
            amount: 0,
            repeating: false
        }];
        update(lineIndex, { ...line, details: newDetails });
    };

    const removeBreakpoint = (lineIndex: number, detailIndex: number) => {
        const line = fields[lineIndex];
        const newDetails = line.details.filter((_, i) => i !== detailIndex);
        update(lineIndex, { ...line, details: newDetails });
    };

    const updateLine = (lineIndex: number, field: string, value: any) => {
        const line = fields[lineIndex];
        const updates: any = { [field]: value };
        
        // Clear irrelevant codes when changing paid_based_on_product
        if (field === 'paid_based_on_product') {
            if (value === 'product') {
                updates.paid_product_family_code = '';
            } else if (value === 'family') {
                updates.paid_product_code = '';
            } else {
                updates.paid_product_code = '';
                updates.paid_product_family_code = '';
            }
        }
        
        update(lineIndex, { ...line, ...updates });
    };

    const handleProductSelect = (code: string) => {
        if (activeLineIndex !== null) {
            updateLine(activeLineIndex, 'paid_product_code', code);
            setIsProductModalOpen(false);
            setActiveLineIndex(null);
        }
    };

    const handleFamilySelect = (code: string) => {
        if (activeLineIndex !== null) {
            updateLine(activeLineIndex, 'paid_product_family_code', code);
            setIsFamilyDrawerOpen(false);
            setActiveLineIndex(null);
        }
    };

    const openProductSearch = (lineIndex: number) => {
        setActiveLineIndex(lineIndex);
        setIsProductModalOpen(true);
    };

    const openFamilySearch = (lineIndex: number) => {
        setActiveLineIndex(lineIndex);
        setIsFamilyDrawerOpen(true);
    };

    const promoTypeOptions = [
        { value: PromotionType.PERCENTAGE_DISCOUNT, label: '% Remise Pourcentage', example: '-10 = 10% de remise', amountLabel: 'Pourcentage (%)', amountPlaceholder: '-10 (pour 10% de remise)' },
        { value: PromotionType.AMOUNT_PER_UNIT, label: 'MAD par Unité', example: '-5 = 5 MAD de remise/unité', amountLabel: 'Montant (MAD/unité)', amountPlaceholder: '-5 (pour 5 MAD de remise)' },
        { value: PromotionType.BEST_PRICE, label: 'Prix Maximum', example: '50 = prix max 50 MAD', amountLabel: 'Prix Maximum (MAD)', amountPlaceholder: '50 (prix max)' },
        { value: PromotionType.FREE_UNIT, label: 'Unités Gratuites', example: '-2 = 2 unités gratuites', amountLabel: 'Unités Gratuites', amountPlaceholder: '-2 (pour 2 unités gratuites)' },
        { value: PromotionType.FREE_PROMO_UNIT, label: 'Unités Promo Gratuites', example: '-10 = 10 promo gratuites', amountLabel: 'Unités Promo Gratuites', amountPlaceholder: '-10 (pour 10 promo gratuites)' },
        { value: PromotionType.FLAT_AMOUNT_DISCOUNT, label: 'Remise Forfaitaire', example: '-100 = 100 MAD de remise', amountLabel: 'Montant Forfaitaire (MAD)', amountPlaceholder: '-100 (pour 100 MAD de remise)' },
        { value: PromotionType.REPLACE_PRICE, label: 'Remplacer Prix', example: '76 = nouveau prix 76 MAD', amountLabel: 'Nouveau Prix (MAD)', amountPlaceholder: '76 (nouveau prix)' }
    ];

    const getPromoTypeConfig = (promoType: number) => {
        return promoTypeOptions.find(opt => opt.value === promoType) || promoTypeOptions[0];
    };

    if (fields.length === 0) {
        return (
            <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-sage-100 rounded-full mb-4">
                    <Plus className="w-8 h-8 text-sage-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune règle définie</h3>
                <p className="text-gray-500 mb-6">Commencez par ajouter une règle de promotion</p>
                <button
                    type="button"
                    onClick={addNewLine}
                    className="px-6 py-3 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium inline-flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Ajouter une Règle
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Règles de Promotion</h2>
                    <p className="text-sm text-gray-500 mt-1">Définissez les conditions et les paliers de remise</p>
                </div>
                <button
                    type="button"
                    onClick={addNewLine}
                    className="px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium inline-flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Ajouter une Règle
                </button>
            </div>

            {fields.map((line, lineIndex) => {
                const isExpanded = expandedLines.has(lineIndex);
                // Use watched values for reactive updates
                const currentLine = watchedLines?.[lineIndex] || line;
                const paidBasedOn = currentLine.paid_based_on_product || 'product';
                const assortmentType = String(currentLine.assortment_type ?? '0');

                return (
                    <div key={`${line.id}-${lineIndex}`} className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                        {/* Line Header */}
                        <div className="bg-gradient-to-r from-sage-50 to-white p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <button
                                        type="button"
                                        onClick={() => toggleLine(lineIndex)}
                                        className="p-1 hover:bg-sage-100 rounded transition-colors"
                                    >
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-sage-600" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-sage-600" />
                                        )}
                                    </button>
                                    <div className="flex-1">
                                        <input
                                            {...register(`lines.${lineIndex}.name`)}
                                            type="text"
                                            className="text-base font-semibold text-gray-900 bg-transparent border-none outline-none focus:bg-white focus:px-2 focus:py-1 focus:rounded transition-all w-full"
                                            placeholder="Nom de la règle"
                                        />
                                        <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                            <span className="font-mono bg-sage-100 text-sage-700 px-2 py-0.5 rounded">
                                                Ligne {lineIndex + 1}
                                            </span>
                                            <span>{currentLine.details?.length || 0} palier(s)</span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => remove(lineIndex)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Supprimer la règle"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Line Content */}
                        {isExpanded && (
                            <div className="p-6 space-y-6">
                                {/* Promotion Flow Indicator */}
                                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4">
                                    <h4 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                        <span className="text-base">🔄</span>
                                        Flux de la Promotion
                                    </h4>
                                    <div className="flex items-center gap-2 text-xs">
                                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded border border-gray-200">
                                            <span className="font-semibold text-sage-700">1. Cible</span>
                                            <span className="text-gray-600">{paidBasedOn === 'product' ? '🎯 Produit' : paidBasedOn === 'family' ? '📦 Famille' : '🛒 Panier'}</span>
                                        </div>
                                        <span className="text-gray-400">→</span>
                                        {(assortmentType !== '0' && assortmentType !== 'none') && (
                                            <>
                                                <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded border border-amber-300">
                                                    <span className="font-semibold text-amber-700">2. Assortiment</span>
                                                    <span className="text-amber-600">
                                                        {assortmentType === '1' ? '📦 Quantité' : 
                                                         assortmentType === '2' ? '📊 Qty %' : 
                                                         assortmentType === '3' ? '💵 Amt %' : 
                                                         assortmentType === '4' ? '💰 Montant' : '⊕ Mix'}
                                                    </span>
                                                </div>
                                                <span className="text-gray-400">→</span>
                                            </>
                                        )}
                                        <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded border border-green-300">
                                            <span className="font-semibold text-green-700">{(assortmentType !== '0' && assortmentType !== 'none') ? '3' : '2'}. Paliers</span>
                                            <span className="text-green-600">💵 Remise</span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-600 mt-2">
                                        {(assortmentType === '0' || assortmentType === 'none')
                                            ? '✓ La remise s\'applique directement selon les paliers définis'
                                            : '⚠️ Les conditions d\'assortiment doivent être validées AVANT d\'appliquer les paliers'
                                        }
                                    </p>
                                </div>

                                {/* Target Configuration */}
                                <div>
                                    <div className="mb-3">
                                        <h3 className="text-sm font-semibold text-gray-700">Cible de la Remise</h3>
                                        <p className="text-xs text-gray-500 mt-0.5">Sur quel produit/famille la remise sera appliquée</p>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-2">Type de Cible</label>
                                            <select
                                                value={paidBasedOn}
                                                onChange={(e) => {
                                                    const newValue = e.target.value as 'product' | 'family' | 'cart';
                                                    update(lineIndex, { 
                                                        ...currentLine, 
                                                        paid_based_on_product: newValue,
                                                        paid_product_code: newValue === 'product' ? currentLine.paid_product_code : undefined,
                                                        paid_product_family_code: newValue === 'family' ? currentLine.paid_product_family_code : undefined
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none bg-white text-sm"
                                            >
                                                <option value="product">🎯 Produit Spécifique</option>
                                                <option value="family">📦 Famille de Produits</option>
                                                <option value="cart">🛒 Panier Entier</option>
                                            </select>
                                        </div>

                                        {paidBasedOn === 'product' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-2">Code Produit</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        {...register(`lines.${lineIndex}.paid_product_code`)}
                                                        type="text"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none font-mono text-sm"
                                                        placeholder="Ex: PROD001"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => openProductSearch(lineIndex)}
                                                        className="px-3 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors flex items-center gap-2"
                                                        title="Rechercher un produit"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {paidBasedOn === 'family' && (
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-gray-600 mb-2">Code Famille</label>
                                                <div className="flex gap-2">
                                                    <input
                                                        {...register(`lines.${lineIndex}.paid_product_family_code`)}
                                                        type="text"
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none font-mono text-sm"
                                                        placeholder="Ex: FAM001"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => openFamilySearch(lineIndex)}
                                                        className="px-3 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors flex items-center gap-2"
                                                        title="Rechercher une famille"
                                                    >
                                                        <Search className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Assortment Configuration */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700">Conditions d'Assortiment</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">Conditions supplémentaires pour activer la promotion</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setIsAssortmentHelpOpen(true)}
                                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors inline-flex items-center gap-1"
                                            title="Guide des assortiments"
                                        >
                                            <HelpCircle className="w-3 h-3" />
                                            Aide
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-2">Type d'Assortiment</label>
                                            <select
                                                value={assortmentType}
                                                onChange={(e) => {
                                                    const newValue = e.target.value;
                                                    update(lineIndex, {
                                                        ...currentLine,
                                                        assortment_type: newValue,
                                                        assortments: (newValue !== '0' && newValue !== 'none') ? currentLine.assortments : []
                                                    });
                                                }}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none bg-white text-sm"
                                            >
                                                <option value="0">○ Aucun - Pas de condition</option>
                                                <option value="1">📦 Quantité - Min X unités de chaque</option>
                                                <option value="2">📊 Quantité % - Min X% du total</option>
                                                <option value="3">💵 Montant % - Min X% du panier</option>
                                                <option value="4">💰 Montant - Min X MAD de chaque</option>
                                            </select>
                                            {(assortmentType === '0' || assortmentType === 'none') && (
                                                <p className="text-xs text-gray-500 mt-1">Aucune condition - Remise directe</p>
                                            )}
                                            {assortmentType === '1' && (
                                                <p className="text-xs text-blue-600 mt-1">📦 Chaque produit doit avoir la quantité minimum absolue</p>
                                            )}
                                            {assortmentType === '2' && (
                                                <p className="text-xs text-purple-600 mt-1">📊 Chaque produit doit représenter X% de la quantité totale</p>
                                            )}
                                            {assortmentType === '3' && (
                                                <p className="text-xs text-green-600 mt-1">💵 Chaque produit doit représenter X% du montant total</p>
                                            )}
                                            {assortmentType === '4' && (
                                                <p className="text-xs text-orange-600 mt-1">💰 Chaque produit doit atteindre le montant minimum en MAD</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-2">
                                                {assortmentType === '2' ? 'Pourcentage Minimum (%)' : 
                                                 assortmentType === '3' ? 'Pourcentage Minimum (%)' : 
                                                 assortmentType === '4' ? 'Montant Minimum (MAD)' : 'Info'}
                                            </label>
                                            {(assortmentType === '0' || assortmentType === 'none') && (
                                                <div className="px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600">
                                                    Aucun paramètre requis
                                                </div>
                                            )}
                                            {assortmentType === '1' && (
                                                <div className="px-3 py-2 bg-blue-50 rounded-lg text-xs text-blue-700">
                                                    Définir minimum pour chaque produit ci-dessous
                                                </div>
                                            )}
                                            {(assortmentType === '2' || assortmentType === '3') && (
                                                <div className="px-3 py-2 bg-purple-50 rounded-lg text-xs text-purple-700">
                                                    Définir pourcentage minimum pour chaque produit
                                                </div>
                                            )}
                                            {assortmentType === '4' && (
                                                <div className="px-3 py-2 bg-orange-50 rounded-lg text-xs text-orange-700">
                                                    Définir montant minimum (MAD) pour chaque produit
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {(assortmentType === '1' || assortmentType === '2' || assortmentType === '3' || assortmentType === '4') && (
                                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                            <div className="flex items-center justify-between mb-3">
                                                <div>
                                                    <h4 className="text-xs font-semibold text-gray-700">Produits Requis (ET)</h4>
                                                    <p className="text-xs text-blue-600 mt-0.5">
                                                        {assortmentType === '1' && 'Quantité minimum absolue pour chaque produit'}
                                                        {assortmentType === '2' && 'Pourcentage minimum de la quantité totale'}
                                                        {assortmentType === '3' && 'Pourcentage minimum du montant total'}
                                                        {assortmentType === '4' && 'Montant minimum (MAD) pour chaque produit'}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const existingAssortments = currentLine.assortments || [];
                                                        update(lineIndex, {
                                                            ...currentLine,
                                                            assortments: [...existingAssortments, {
                                                                based_on_product: '1',
                                                                product_code: '',
                                                                minimum: 1
                                                            }]
                                                        });
                                                    }}
                                                    className="text-xs px-2 py-1 bg-sage-600 text-white rounded hover:bg-sage-700 transition-colors inline-flex items-center gap-1"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Ajouter
                                                </button>
                                            </div>
                                            {(!currentLine.assortments || currentLine.assortments.length === 0) ? (
                                                <div className="text-center py-3">
                                                    <p className="text-xs text-gray-500">Aucun produit requis</p>
                                                    <p className="text-xs text-blue-600 mt-1">Cliquez sur "Ajouter" pour définir les produits</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {currentLine.assortments?.map((assort: any, assortIdx: number) => (
                                                        <div key={assortIdx} className="flex items-center gap-2 bg-white p-2 rounded border border-gray-200">
                                                            <select
                                                                {...register(`lines.${lineIndex}.assortments.${assortIdx}.based_on_product`)}
                                                                className="px-2 py-1 border border-gray-300 rounded text-xs"
                                                            >
                                                                <option value="1">🎯 Produit</option>
                                                                <option value="0">📦 Famille</option>
                                                            </select>
                                                            <div className="flex-1 flex gap-1">
                                                                <input
                                                                    {...register(`lines.${lineIndex}.assortments.${assortIdx}.product_code`)}
                                                                    type="text"
                                                                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-xs font-mono"
                                                                    placeholder={assort.based_on_product === '1' ? 'Code produit' : 'Code famille'}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        // TODO: Open search modal for assortment
                                                                        console.log('Search for assortment', lineIndex, assortIdx);
                                                                    }}
                                                                    className="px-2 py-1 bg-sage-100 text-sage-700 rounded hover:bg-sage-200 transition-colors"
                                                                    title="Rechercher"
                                                                >
                                                                    <Search className="w-3 h-3" />
                                                                </button>
                                                            </div>
                                                            <input
                                                                {...register(`lines.${lineIndex}.assortments.${assortIdx}.minimum`, { valueAsNumber: true })}
                                                                type="number"
                                                                className="w-16 px-2 py-1 border border-gray-300 rounded text-xs"
                                                                placeholder="Min"
                                                                min="1"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const newAssortments = (currentLine.assortments || []).filter((_: any, i: number) => i !== assortIdx);
                                                                    update(lineIndex, { ...currentLine, assortments: newAssortments });
                                                                }}
                                                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Breakpoints */}
                                <div>
                                    <div className="flex items-center justify-between mb-3">
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-700">Paliers de Remise</h3>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {(assortmentType === '0' || assortmentType === 'none')
                                                    ? 'Définissez les seuils et montants de remise'
                                                    : 'Remise appliquée SI les conditions d\'assortiment sont remplies'
                                                }
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => addBreakpoint(lineIndex)}
                                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium inline-flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Ajouter un Palier
                                        </button>
                                    </div>
                                    
                                    {(assortmentType !== '0' && assortmentType !== 'none') && (
                                        <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                            <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                                                <span className="text-base">⚠️</span>
                                                <span>
                                                    Les paliers s'appliquent <strong>APRÈS</strong> validation des conditions d'assortiment.
                                                    {assortmentType === '1' && ' Chaque produit doit atteindre sa quantité minimum.'}
                                                    {assortmentType === '2' && ' Chaque produit doit représenter le pourcentage minimum de la quantité totale.'}
                                                    {assortmentType === '3' && ' Chaque produit doit représenter le pourcentage minimum du montant total.'}
                                                    {assortmentType === '4' && ' Chaque produit doit atteindre le montant minimum en MAD.'}
                                                </span>
                                            </p>
                                        </div>
                                    )}

                                    {(!currentLine.details || currentLine.details.length === 0) ? (
                                        <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                                            <p className="text-sm text-gray-500">Aucun palier défini</p>
                                            <button
                                                type="button"
                                                onClick={() => addBreakpoint(lineIndex)}
                                                className="mt-2 text-sm text-sage-600 hover:text-sage-700 font-medium"
                                            >
                                                + Ajouter le premier palier
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {currentLine.details?.map((detail: any, detailIndex: number) => (
                                                <div key={detailIndex} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                                    <div className="flex items-start gap-4">
                                                        <div className="flex-shrink-0 w-8 h-8 bg-sage-100 text-sage-700 rounded-full flex items-center justify-center font-semibold text-sm">
                                                            {detailIndex + 1}
                                                        </div>
                                                        <div className="flex-1 space-y-3">
                                                            <div className="grid grid-cols-3 gap-4">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">Type de Remise</label>
                                                                    <select
                                                                        {...register(`lines.${lineIndex}.details.${detailIndex}.promo_type`, {
                                                                            valueAsNumber: true
                                                                        })}
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 outline-none bg-white text-sm"
                                                                    >
                                                                        {promoTypeOptions.map(opt => (
                                                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        {breakpointLabel.label}
                                                                    </label>
                                                                    <input
                                                                        {...register(`lines.${lineIndex}.details.${detailIndex}.minimum_value`, {
                                                                            valueAsNumber: true
                                                                        })}
                                                                        type="number"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 outline-none text-sm"
                                                                        placeholder={breakpointLabel.placeholder}
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-gray-600 mb-1">
                                                                        {getPromoTypeConfig(detail.promo_type).amountLabel}
                                                                    </label>
                                                                    <input
                                                                        {...register(`lines.${lineIndex}.details.${detailIndex}.amount`, {
                                                                            valueAsNumber: true
                                                                        })}
                                                                        type="number"
                                                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 outline-none text-sm"
                                                                        placeholder={getPromoTypeConfig(detail.promo_type).amountPlaceholder}
                                                                        step="0.01"
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                                                                <input
                                                                    {...register(`lines.${lineIndex}.details.${detailIndex}.repeating`)}
                                                                    type="checkbox"
                                                                    id={`repeating-${lineIndex}-${detailIndex}`}
                                                                    className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-2 focus:ring-sage-500"
                                                                />
                                                                <label 
                                                                    htmlFor={`repeating-${lineIndex}-${detailIndex}`}
                                                                    className="text-xs font-medium text-gray-700 cursor-pointer select-none"
                                                                >
                                                                    🔄 Répétable (applique la remise plusieurs fois si le seuil est atteint plusieurs fois)
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeBreakpoint(lineIndex, detailIndex)}
                                                            className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                    <div className="mt-2 ml-12">
                                                        <p className="text-xs text-gray-500">
                                                            {promoTypeOptions.find(opt => opt.value === detail.promo_type)?.example}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Modals */}
            <ProductSelectionModal
                isOpen={isProductModalOpen}
                onClose={() => {
                    setIsProductModalOpen(false);
                    setActiveLineIndex(null);
                }}
                onSelect={handleProductSelect}
            />

            <ProductFamilySelectionDrawer
                isOpen={isFamilyDrawerOpen}
                onClose={() => {
                    setIsFamilyDrawerOpen(false);
                    setActiveLineIndex(null);
                }}
                onSelect={handleFamilySelect}
                currentCode={activeLineIndex !== null ? watch(`lines.${activeLineIndex}.paid_product_family_code`) : undefined}
            />

            <AssortmentHelpModal
                isOpen={isAssortmentHelpOpen}
                onClose={() => setIsAssortmentHelpOpen(false)}
            />
        </div>
    );
};
