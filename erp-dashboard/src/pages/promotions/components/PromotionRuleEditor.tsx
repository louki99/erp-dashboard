import { useState } from 'react';
import { PromotionLinesGrid } from './PromotionLinesGrid';
import { PromotionLineDetailsGrid } from './PromotionLineDetailsGrid';
import { AssortmentManager } from './AssortmentManager';
import { Info, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';

export const PromotionRuleEditor = () => {
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const [showAssortment, setShowAssortment] = useState(true);
    const [showDetails, setShowDetails] = useState(true);

    return (
        <div className="space-y-4">
            {/* Help Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
                <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-blue-100 transition-colors"
                >
                    <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-900">Comment Fonctionnent les Règles de Promotion</span>
                    </div>
                    {showHelp ? (
                        <ChevronUp className="w-4 h-4 text-blue-600" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-blue-600" />
                    )}
                </button>
                {showHelp && (
                    <div className="p-4 pt-0 border-t border-blue-200 bg-white">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-700">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Règles de Promotion</h4>
                                <ul className="space-y-1 text-xs list-disc list-inside text-gray-600">
                                    <li>Définissez où la remise s'applique (Panier Entier, Famille de Produits, ou Produit Spécifique)</li>
                                    <li>Configurez les conditions d'assortiment (produits requis, montant minimum)</li>
                                    <li>Cliquez sur une ligne pour la sélectionner</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Paliers de Remise</h4>
                                <ul className="space-y-1 text-xs list-disc list-inside text-gray-600">
                                    <li>Définissez les seuils minimum (valeur/quantité) pour déclencher les remises</li>
                                    <li>Configurez le type et le montant de remise pour chaque palier</li>
                                    <li>Activez "Répéter" pour appliquer la remise plusieurs fois</li>
                                    <li><em>La méthode de calcul (Cumulatif/Tranche) est définie dans l'onglet "Informations Générales"</em></li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Conditions d'Assortiment</h4>
                                <ul className="space-y-1 text-xs list-disc list-inside text-gray-600">
                                    <li><strong>Aucun:</strong> Pas de condition spéciale</li>
                                    <li><strong>Produits (ET):</strong> Doit avoir X de A ET Y de B</li>
                                    <li><strong>Montant Min:</strong> Panier minimum requis</li>
                                    <li><strong>Les Deux:</strong> Produits ET montant requis</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Promotion Rules Grid */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                <PromotionLinesGrid onLineSelected={setSelectedLineIndex} />
            </div>

            {/* Collapsible Details Section */}
            {selectedLineIndex !== null && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-sage-50 to-white hover:from-sage-100 hover:to-white transition-colors border-b"
                    >
                        <div className="flex items-center gap-2">
                            {showDetails ? (
                                <ChevronDown className="w-4 h-4 text-sage-600" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-sage-600" />
                            )}
                            <h3 className="text-sm font-semibold text-gray-900">Paliers de Remise</h3>
                            <span className="text-xs text-gray-500">
                                Configurez les seuils et montants de remise
                            </span>
                        </div>
                        <span className="text-xs text-sage-600 font-medium">
                            {showDetails ? 'Réduire' : 'Développer'}
                        </span>
                    </button>
                    {showDetails && (
                        <div className="h-[300px]">
                            <PromotionLineDetailsGrid key={`line-${selectedLineIndex}`} lineIndex={selectedLineIndex} />
                        </div>
                    )}
                </div>
            )}

            {/* Collapsible Assortment Section */}
            {selectedLineIndex !== null && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowAssortment(!showAssortment)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-white hover:from-purple-100 hover:to-white transition-colors border-b"
                    >
                        <div className="flex items-center gap-2">
                            {showAssortment ? (
                                <ChevronDown className="w-4 h-4 text-purple-600" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-purple-600" />
                            )}
                            <h3 className="text-sm font-semibold text-gray-900">Conditions d'Assortiment</h3>
                            <span className="text-xs text-gray-500">
                                Produits requis et montant minimum du panier
                            </span>
                        </div>
                        <span className="text-xs text-purple-600 font-medium">
                            {showAssortment ? 'Réduire' : 'Développer'}
                        </span>
                    </button>
                    {showAssortment && (
                        <div className="p-4 bg-slate-50">
                            <AssortmentManager lineIndex={selectedLineIndex} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
