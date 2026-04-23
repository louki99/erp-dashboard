import { X, Package, ShoppingCart, CheckCircle2, AlertCircle } from 'lucide-react';

interface AssortmentHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AssortmentHelpModal = ({ isOpen, onClose }: AssortmentHelpModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-sage-600 to-sage-700 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Package className="w-6 h-6 text-white" />
                        <h2 className="text-xl font-bold text-white">Guide des Assortiments</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-6 space-y-6">
                    {/* Introduction */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <h3 className="font-semibold text-blue-900 mb-2">Qu'est-ce qu'un Assortiment ?</h3>
                        <p className="text-sm text-blue-800">
                            Les assortiments définissent des <strong>conditions supplémentaires</strong> que le client doit remplir 
                            pour bénéficier de la promotion. Ils permettent de créer des promotions "Mix & Match" ou avec montant minimum.
                        </p>
                    </div>

                    {/* Type 1: None */}
                    <div className="border border-gray-200 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">○</span>
                            <h3 className="text-lg font-semibold text-gray-900">Aucun</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            Pas de condition d'assortiment. La promotion s'applique directement sur le produit/famille cible.
                        </p>
                        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                            <p className="text-xs font-semibold text-gray-700">💡 Exemple :</p>
                            <p className="text-xs text-gray-600">
                                <strong>Promotion :</strong> 10% de remise sur le produit COCA-COLA<br/>
                                <strong>Condition :</strong> Acheter 5 unités de COCA-COLA<br/>
                                <strong>Résultat :</strong> Client achète 5 COCA-COLA → 10% de remise
                            </p>
                        </div>
                    </div>

                    {/* Type 2: Multiple AND */}
                    <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/30">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">⊕</span>
                            <h3 className="text-lg font-semibold text-purple-900">Produits Multiples (ET)</h3>
                        </div>
                        <p className="text-sm text-purple-700 mb-3">
                            Le client doit acheter <strong>TOUS</strong> les produits listés dans l'assortiment (en quantités minimales) 
                            pour que la promotion s'applique sur le produit cible.
                        </p>
                        <div className="bg-white rounded-lg p-4 space-y-3 border border-purple-200">
                            <p className="text-xs font-semibold text-purple-900">💡 Exemple : Mix & Match</p>
                            <div className="text-xs text-gray-700 space-y-1">
                                <p><strong>Promotion :</strong> 20% sur CHIPS si vous achetez :</p>
                                <ul className="ml-4 space-y-1">
                                    <li>✓ 2x COCA-COLA (min)</li>
                                    <li>✓ 1x SANDWICH (min)</li>
                                    <li>✓ 1x produit de la famille DESSERTS (min)</li>
                                </ul>
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <p className="font-semibold text-green-800 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Panier Valide :
                                    </p>
                                    <p className="text-green-700 mt-1">
                                        3 COCA-COLA + 1 SANDWICH + 2 DESSERTS + 5 CHIPS<br/>
                                        → <strong>20% de remise sur les CHIPS</strong>
                                    </p>
                                </div>
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                    <p className="font-semibold text-red-800 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Panier Invalide :
                                    </p>
                                    <p className="text-red-700 mt-1">
                                        3 COCA-COLA + 5 CHIPS (manque SANDWICH et DESSERTS)<br/>
                                        → <strong>Pas de remise</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 bg-purple-100 border border-purple-300 rounded p-3">
                            <p className="text-xs font-semibold text-purple-900">⚠️ Important :</p>
                            <p className="text-xs text-purple-800">
                                Le client doit acheter <strong>TOUS</strong> les produits listés. Si un seul manque, 
                                la promotion ne s'applique pas.
                            </p>
                        </div>
                    </div>

                    {/* Type 3: Cart Amount */}
                    <div className="border border-green-200 rounded-lg p-5 bg-green-50/30">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">💰</span>
                            <h3 className="text-lg font-semibold text-green-900">Montant Minimum Panier</h3>
                        </div>
                        <p className="text-sm text-green-700 mb-3">
                            Le panier total du client doit atteindre un montant minimum pour que la promotion s'applique.
                        </p>
                        <div className="bg-white rounded-lg p-4 space-y-3 border border-green-200">
                            <p className="text-xs font-semibold text-green-900">💡 Exemple : Seuil de Panier</p>
                            <div className="text-xs text-gray-700 space-y-1">
                                <p><strong>Promotion :</strong> 15% sur toute la famille BOISSONS</p>
                                <p><strong>Condition :</strong> Panier total ≥ 1000 MAD</p>
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <p className="font-semibold text-green-800 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Panier Valide :
                                    </p>
                                    <p className="text-green-700 mt-1">
                                        Total panier = 1200 MAD (dont 300 MAD de BOISSONS)<br/>
                                        → <strong>15% de remise sur les 300 MAD de BOISSONS</strong>
                                    </p>
                                </div>
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                    <p className="font-semibold text-red-800 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Panier Invalide :
                                    </p>
                                    <p className="text-red-700 mt-1">
                                        Total panier = 800 MAD (dont 200 MAD de BOISSONS)<br/>
                                        → <strong>Pas de remise (seuil non atteint)</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Type 4: Both */}
                    <div className="border border-orange-200 rounded-lg p-5 bg-orange-50/30">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-2xl">⊕💰</span>
                            <h3 className="text-lg font-semibold text-orange-900">Les Deux (Produits ET Montant)</h3>
                        </div>
                        <p className="text-sm text-orange-700 mb-3">
                            Combine les deux conditions : le client doit acheter <strong>TOUS</strong> les produits listés 
                            <strong> ET </strong> atteindre le montant minimum du panier.
                        </p>
                        <div className="bg-white rounded-lg p-4 space-y-3 border border-orange-200">
                            <p className="text-xs font-semibold text-orange-900">💡 Exemple : VIP Premium</p>
                            <div className="text-xs text-gray-700 space-y-1">
                                <p><strong>Promotion :</strong> 25% sur le panier entier</p>
                                <p><strong>Conditions :</strong></p>
                                <ul className="ml-4 space-y-1">
                                    <li>✓ Acheter au moins 3 produits de la famille PREMIUM</li>
                                    <li>✓ Acheter au moins 2 produits de la famille LUXE</li>
                                    <li>✓ Panier total ≥ 2000 MAD</li>
                                </ul>
                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                                    <p className="font-semibold text-green-800 flex items-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" />
                                        Panier Valide :
                                    </p>
                                    <p className="text-green-700 mt-1">
                                        5 PREMIUM + 3 LUXE + autres produits = 2500 MAD<br/>
                                        → <strong>25% de remise sur tout le panier</strong>
                                    </p>
                                </div>
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                    <p className="font-semibold text-red-800 flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4" />
                                        Panier Invalide :
                                    </p>
                                    <p className="text-red-700 mt-1">
                                        5 PREMIUM + 3 LUXE = 1800 MAD (montant insuffisant)<br/>
                                        → <strong>Pas de remise (seuil non atteint)</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 bg-orange-100 border border-orange-300 rounded p-3">
                            <p className="text-xs font-semibold text-orange-900">⚠️ Important :</p>
                            <p className="text-xs text-orange-800">
                                Les <strong>DEUX</strong> conditions doivent être remplies. Si l'une manque, 
                                la promotion ne s'applique pas.
                            </p>
                        </div>
                    </div>

                    {/* Use Cases */}
                    <div className="bg-gradient-to-r from-sage-50 to-blue-50 border border-sage-200 rounded-lg p-5">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-sage-600" />
                            Cas d'Usage Courants
                        </h3>
                        <div className="space-y-3 text-sm">
                            <div className="bg-white rounded p-3 border border-gray-200">
                                <p className="font-semibold text-gray-800">🎯 Promotion Simple</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    Type: <strong>Aucun</strong> → Remise directe sur un produit/famille
                                </p>
                            </div>
                            <div className="bg-white rounded p-3 border border-gray-200">
                                <p className="font-semibold text-gray-800">🍔 Menu Combo</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    Type: <strong>Produits Multiples</strong> → Burger + Frites + Boisson = Remise
                                </p>
                            </div>
                            <div className="bg-white rounded p-3 border border-gray-200">
                                <p className="font-semibold text-gray-800">💎 Livraison Gratuite</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    Type: <strong>Montant Minimum</strong> → Panier ≥ 500 MAD = Livraison offerte
                                </p>
                            </div>
                            <div className="bg-white rounded p-3 border border-gray-200">
                                <p className="font-semibold text-gray-800">👑 VIP Exclusive</p>
                                <p className="text-xs text-gray-600 mt-1">
                                    Type: <strong>Les Deux</strong> → Produits spécifiques + Panier ≥ 2000 MAD = 30% off
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Tips */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                            💡 Conseils Pratiques
                        </h3>
                        <ul className="text-xs text-yellow-800 space-y-1 ml-4">
                            <li>• Utilisez <strong>"Aucun"</strong> pour les promotions simples et directes</li>
                            <li>• Utilisez <strong>"Produits Multiples"</strong> pour encourager l'achat de plusieurs produits complémentaires</li>
                            <li>• Utilisez <strong>"Montant Minimum"</strong> pour augmenter la valeur moyenne du panier</li>
                            <li>• Utilisez <strong>"Les Deux"</strong> pour les promotions VIP ou événements spéciaux</li>
                            <li>• Les quantités minimales dans "Produits Multiples" permettent de contrôler précisément les conditions</li>
                        </ul>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-sage-600 text-white rounded-lg hover:bg-sage-700 transition-colors font-medium"
                    >
                        J'ai Compris
                    </button>
                </div>
            </div>
        </div>
    );
};
