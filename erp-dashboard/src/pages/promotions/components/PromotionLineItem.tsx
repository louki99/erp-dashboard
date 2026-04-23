import { useFormContext } from 'react-hook-form';
import { Trash2, ChevronDown, ChevronRight, Search } from 'lucide-react';
import type { Promotion, PromotionLine } from '@/types/promotion.types';
import { PromotionType } from '@/types/promotion.types';

interface PromotionLineItemProps {
    line: PromotionLine;
    lineIndex: number;
    isExpanded: boolean;
    onToggle: () => void;
    onRemove: () => void;
    onOpenProductSearch: (index: number) => void;
    onOpenFamilySearch: (index: number) => void;
    breakpointLabel: { label: string; placeholder: string };
    promoTypeOptions: Array<{ value: number; label: string; example: string }>;
    onAddBreakpoint: (lineIndex: number) => void;
    onRemoveBreakpoint: (lineIndex: number, detailIndex: number) => void;
}

export const PromotionLineItem = ({
    line,
    lineIndex,
    isExpanded,
    onToggle,
    onRemove,
    onOpenProductSearch,
    onOpenFamilySearch,
    breakpointLabel,
    promoTypeOptions,
    onAddBreakpoint,
    onRemoveBreakpoint
}: PromotionLineItemProps) => {
    const { register, watch } = useFormContext<Promotion>();
    
    // Only watch this specific line's paid_based_on_product field
    const paidBasedOn = watch(`lines.${lineIndex}.paid_based_on_product`) || 'product';

    return (
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
            {/* Line Header */}
            <div className="bg-gradient-to-r from-sage-50 to-white p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <button
                            type="button"
                            onClick={onToggle}
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
                                <span>{line.details?.length || 0} palier(s)</span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onRemove}
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
                    {/* Target Configuration */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 mb-3">Cible de la Remise</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-600 mb-2">Type de Cible</label>
                                <select
                                    {...register(`lines.${lineIndex}.paid_based_on_product`)}
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
                                            onClick={() => onOpenProductSearch(lineIndex)}
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
                                            onClick={() => onOpenFamilySearch(lineIndex)}
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

                    {/* Breakpoints */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-gray-700">Paliers de Remise</h3>
                            <button
                                type="button"
                                onClick={() => onAddBreakpoint(lineIndex)}
                                className="px-3 py-1.5 bg-sage-600 text-white text-xs rounded-lg hover:bg-sage-700 transition-colors font-medium"
                            >
                                + Ajouter un Palier
                            </button>
                        </div>

                        <div className="space-y-3">
                            {line.details?.map((detail, detailIndex) => (
                                <div key={detailIndex} className="bg-sage-50 border border-sage-200 rounded-lg p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-xs font-semibold text-sage-700 bg-sage-100 px-2 py-1 rounded">
                                            Palier {detailIndex + 1}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => onRemoveBreakpoint(lineIndex, detailIndex)}
                                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                                        >
                                            Supprimer
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Type de Remise</label>
                                            <select
                                                {...register(`lines.${lineIndex}.details.${detailIndex}.promo_type`, { valueAsNumber: true })}
                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none bg-white text-xs"
                                            >
                                                {promoTypeOptions.map(opt => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">
                                                {breakpointLabel.label}
                                            </label>
                                            <input
                                                {...register(`lines.${lineIndex}.details.${detailIndex}.minimum_value`, { valueAsNumber: true })}
                                                type="number"
                                                step="0.01"
                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none text-xs"
                                                placeholder={breakpointLabel.placeholder}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Montant</label>
                                            <input
                                                {...register(`lines.${lineIndex}.details.${detailIndex}.amount`, { valueAsNumber: true })}
                                                type="number"
                                                step="0.01"
                                                className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sage-500 focus:border-sage-500 outline-none text-xs"
                                                placeholder="Ex: 10"
                                            />
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            {...register(`lines.${lineIndex}.details.${detailIndex}.repeating`)}
                                            className="w-4 h-4 text-sage-600 border-gray-300 rounded focus:ring-sage-500"
                                        />
                                        <label className="text-xs text-gray-700">
                                            Répétable (applique la remise plusieurs fois si le seuil est atteint plusieurs fois)
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
