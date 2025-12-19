import { useState } from 'react';
import Split from 'react-split';
import { PromotionLinesGrid } from './PromotionLinesGrid';
import { PromotionLineDetailsGrid } from './PromotionLineDetailsGrid';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

export const PromotionRuleEditor = () => {
    const [selectedLineIndex, setSelectedLineIndex] = useState<number | null>(null);
    const [showHelp, setShowHelp] = useState(false);

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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Règles de Promotion (Section Supérieure)</h4>
                                <ul className="space-y-1 text-xs list-disc list-inside text-gray-600">
                                    <li>Définissez où la remise s'applique (Panier Entier, Famille de Produits, ou Produit Spécifique)</li>
                                    <li>Chaque règle peut avoir plusieurs paliers de remise (configurés ci-dessous)</li>
                                    <li>Cliquez sur une ligne pour la sélectionner et configurer ses paliers de remise</li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-900 mb-2">Paliers de Remise (Section Inférieure)</h4>
                                <ul className="space-y-1 text-xs list-disc list-inside text-gray-600">
                                    <li>Définissez les seuils minimum (valeur/quantité) pour déclencher les remises</li>
                                    <li>Configurez le type et le montant de remise pour chaque palier</li>
                                    <li>Activez "Répéter" pour appliquer la remise plusieurs fois</li>
                                    <li>Plusieurs paliers créent des remises progressives (ex: 5% à 1000 MAD, 10% à 2000 MAD)</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Split Editor */}
            <div className="h-[600px] bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col shadow-sm">
                <Split
                    sizes={[55, 45]}
                    minSize={150}
                    expandToMin={false}
                    gutterSize={4}
                    gutterAlign="center"
                    snapOffset={30}
                    dragInterval={1}
                    direction="vertical"
                    cursor="row-resize"
                    className="flex-1 flex flex-col h-full"
                >
                    <div className="flex flex-col overflow-hidden">
                        <PromotionLinesGrid onLineSelected={setSelectedLineIndex} />
                    </div>

                    <div className="flex flex-col overflow-hidden border-t border-gray-200">
                        <PromotionLineDetailsGrid key={`line-${selectedLineIndex}`} lineIndex={selectedLineIndex} />
                    </div>
                </Split>
            </div>
        </div>
    );
};
