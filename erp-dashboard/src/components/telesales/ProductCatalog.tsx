import { useState } from 'react';
import { Search, Loader2, PackageSearch, Plus } from 'lucide-react';

import { useCatalogProducts, useCatalogPages } from '@/hooks/telesales/useTelesalesCatalog';
import type { CatalogProduct, ProductFlags } from '@/types/telesalesAgent.types';

interface ProductCatalogProps {
    partnerId?: number | null;
    onAddProduct?: (product: CatalogProduct) => void;
    /** Extra product_flags gate beyond the always-enforced `is_salable`
     * (e.g. `is_returnable` on the Retours screen) — disables "add" and shows
     * why when the flag is false for a given product. */
    requireFlag?: keyof ProductFlags;
    requireFlagMessage?: string;
}

/**
 * Reusable product search/browse (docs §4) — lighter than the SFA mobile
 * catalogue on purpose (no territorial data_rules scoping). Standalone here
 * (§4 screen); also embedded inline in the order-taking screen (§5.1) once built.
 */
export const ProductCatalog = ({ partnerId, onAddProduct, requireFlag, requireFlagMessage }: ProductCatalogProps) => {
    const [search, setSearch] = useState('');
    const [pageCode, setPageCode] = useState<string | undefined>(undefined);

    const { pages } = useCatalogPages();
    const { products, loading } = useCatalogProducts({
        search: search || undefined,
        product_page_code: pageCode,
        partner_id: partnerId ?? undefined,
        per_page: 50,
    });

    return (
        <div className="flex flex-col h-full">
            <div className="space-y-3 pb-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un produit par nom ou code..."
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                    />
                </div>
                {pages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => setPageCode(undefined)}
                            className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${!pageCode ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                        >
                            Toutes
                        </button>
                        {pages.map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setPageCode(p.code)}
                                className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${pageCode === p.code ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                )}
                {!partnerId && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        Prix générique affiché (pas de partenaire sélectionné) — souvent 0 si aucun prix retail n'est configuré. Sélectionnez un partenaire pour voir le prix négocié réel.
                    </p>
                )}
            </div>

            <div className="flex-1 overflow-y-auto -mx-1 px-1">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
                    </div>
                ) : products.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <PackageSearch className="w-8 h-8 mb-2" />
                        <p className="text-sm">Aucun produit trouvé</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {products.map((product) => {
                            const notSalable = !product.flags.is_salable;
                            const missingRequiredFlag = requireFlag ? !product.flags[requireFlag] : false;
                            const blocked = notSalable || missingRequiredFlag;
                            const blockedReason = notSalable
                                ? 'Produit non vendable actuellement'
                                : missingRequiredFlag
                                    ? (requireFlagMessage ?? 'Action non autorisée pour ce produit')
                                    : undefined;
                            return (
                                <div key={product.id} className={`flex items-center justify-between gap-3 p-3 bg-white border rounded-xl shadow-sm transition-colors ${blocked ? 'border-gray-100 opacity-60' : 'border-gray-100 hover:border-sage-200'}`}>
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-gray-800 truncate flex items-center gap-1.5">
                                            {product.name}
                                            {product.flags.requires_refrigeration && <span title="Nécessite la chaîne du froid">🧊</span>}
                                            {product.marketing.is_new && <span className="px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full">Nouveau</span>}
                                        </div>
                                        <div className="text-xs text-gray-400">{product.code} · {product.unit_name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm font-bold text-sage-700">{product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                                            <span className={`text-[11px] font-bold ${product.stock_available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                {product.stock_available > 0 ? `${product.stock_available} en stock` : 'Rupture'}
                                            </span>
                                        </div>
                                        {blockedReason && <div className="text-[11px] text-amber-600 mt-1">{blockedReason}</div>}
                                    </div>
                                    {onAddProduct && (
                                        <button
                                            onClick={() => onAddProduct(product)}
                                            disabled={blocked}
                                            className="shrink-0 p-2 bg-sage-50 text-sage-600 rounded-lg hover:bg-sage-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-sage-50"
                                            title={blockedReason ?? 'Ajouter à la commande'}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
