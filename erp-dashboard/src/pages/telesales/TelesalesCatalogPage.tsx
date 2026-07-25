import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Search, Loader2, RefreshCw, PackageSearch, Tag, Box, Layers, WifiOff, SlidersHorizontal, X, Building2, CheckCircle2, XCircle } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { SyncStatusBadge } from '@/components/telesales/SyncStatusBadge';
import { useCatalogProducts, useCatalogPages } from '@/hooks/telesales/useTelesalesCatalog';
import { useCurrentSession } from '@/hooks/telesales/useTelesalesSession';
import { useCachedCatalog, useCachedPartner } from '@/hooks/telesales/useTelesalesSync';
import { usePriceListData } from '@/hooks/telesales/usePriceListData';
import { resolveLocalPrice } from '@/lib/telesales/priceResolver';
import type { ProductBrand, ProductMarketing, ProductFlags, ProductPriceList } from '@/types/telesalesAgent.types';

interface DisplayProduct {
    id: number;
    code: string;
    name: string;
    short_description: string | null;
    barcode: string | null;
    brand: ProductBrand | null;
    product_page_code: string | null;
    unit_name: string;
    price: number;
    price_list: ProductPriceList | null;
    stock_available: number;
    marketing: ProductMarketing;
    flags: ProductFlags;
    packagings: { packaging_id: number; unit_id: number; unit_name: string; quantity: number; is_default: boolean }[];
    priceLabel: string;
    estimated: boolean;
}

export const TelesalesCatalogPage = () => {
    const [partner, setPartner] = useState<PartnerPickerOption | null>(null);
    const [search, setSearch] = useState('');
    const [pageCode, setPageCode] = useState('');
    const [selected, setSelected] = useState<DisplayProduct | null>(null);
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const activeFilterCount = (partner ? 1 : 0) + (pageCode ? 1 : 0);

    const { pages } = useCatalogPages();

    // §4.4 — prefer the offline-first cache once populated; fall back to the
    // live paginated endpoint before the first sync has ever run.
    const { products: cachedProducts, loading: loadingCache } = useCachedCatalog();
    const cachedPartner = useCachedPartner(partner?.id ?? null);
    const usingCache = cachedProducts.length > 0;

    const { tiers, priceListLines } = usePriceListData(cachedPartner?.price_list_id ?? null);

    const { products: liveProducts, loading: loadingLive, refetch: refetchLive } = useCatalogProducts(
        usingCache ? {} : { search: search || undefined, product_page_code: pageCode || undefined, partner_id: partner?.id, per_page: 100 }
    );

    const products: DisplayProduct[] = useMemo(() => {
        if (usingCache) {
            const q = search.trim().toLowerCase();
            return cachedProducts
                .filter((p) => (!pageCode || p.product_page_code === pageCode))
                .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
                .map((p): DisplayProduct => {
                    const resolved = resolveLocalPrice(p, 1, cachedPartner, tiers, priceListLines);
                    return {
                        id: p.id, code: p.code, name: p.name, product_page_code: p.product_page_code,
                        short_description: p.short_description, barcode: p.barcode, brand: p.brand,
                        unit_name: p.unit_name, stock_available: p.stock_available, packagings: p.packagings,
                        price: resolved.unitPriceTtc,
                        price_list: null, // cache is never partner-scoped server-side (docs §4.4)
                        marketing: p.marketing, flags: p.flags,
                        priceLabel: resolved.estimated ? '≈ estimé' : 'Générique',
                        estimated: resolved.estimated,
                    };
                });
        }
        return liveProducts.map((p): DisplayProduct => ({
            id: p.id, code: p.code, name: p.name, product_page_code: p.product_page_code,
            short_description: p.short_description, barcode: p.barcode, brand: p.brand,
            unit_name: p.unit_name, stock_available: p.stock_available, packagings: p.packagings,
            price: p.price,
            price_list: p.price_list,
            marketing: p.marketing, flags: p.flags,
            priceLabel: p.price_source === 'partner' ? 'Prix négocié' : 'Prix générique',
            estimated: false,
        }));
    }, [usingCache, cachedProducts, pageCode, search, cachedPartner, tiers, priceListLines, liveProducts]);

    const loading = usingCache ? loadingCache : loadingLive;

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'code', headerName: 'Code', width: 110, filter: false },
            { field: 'name', headerName: 'Produit', flex: 1, minWidth: 160, filter: false },
            {
                field: 'price', headerName: 'Prix', width: 110, filter: false,
                cellRenderer: (p: any) => (
                    <span className="font-bold">
                        {Number(p.value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        {p.data?.estimated && <span className="ml-1 text-[10px] font-bold text-amber-500" title="Estimation locale — confirmé à la création de la commande">≈</span>}
                    </span>
                ),
            },
            {
                field: 'stock_available', headerName: 'Stock', width: 80, filter: false,
                cellStyle: (p: any): { color: string } => ({ color: (p.value ?? 0) > 0 ? '#059669' : '#dc2626' }),
            },
        ],
        []
    );

    const pageName = (code: string | null) => pages.find((p) => p.code === code)?.name ?? code ?? '-';

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            {!selected ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                        <PackageSearch className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium">Sélectionnez un produit</p>
                        <p className="text-xs text-gray-400 mt-1">Cliquez sur une ligne pour afficher les détails</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 flex items-start justify-center">
                    <div className="max-w-xl w-full space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                                <Box className="w-7 h-7 text-sage-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-lg font-bold text-gray-900 truncate flex items-center gap-1.5">
                                    {selected.name}
                                    {selected.flags.requires_refrigeration && <span title="Nécessite la chaîne du froid">🧊</span>}
                                </div>
                                <div className="text-sm text-gray-400 flex items-center gap-2 flex-wrap">
                                    <span>{selected.code} · {selected.unit_name}</span>
                                    {selected.brand && (
                                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                            <Building2 className="w-3 h-3" /> {selected.brand.name}
                                        </span>
                                    )}
                                </div>
                                {(selected.marketing.is_new || selected.marketing.is_featured || !selected.flags.is_salable) && (
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        {selected.marketing.is_new && <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">Nouveau</span>}
                                        {selected.marketing.is_featured && <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700 rounded-full">Vedette</span>}
                                        {!selected.flags.is_salable && <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-500 rounded-full">Indisponible à la vente</span>}
                                    </div>
                                )}
                            </div>
                        </div>

                        {(selected.short_description || selected.barcode) && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-1">
                                {selected.short_description && <div className="text-sm text-gray-700">{selected.short_description}</div>}
                                {selected.barcode && <div className="text-xs text-gray-400">Code-barres : {selected.barcode}</div>}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                                    <Tag className="w-3.5 h-3.5" /> Prix
                                </div>
                                <div className="text-xl font-black text-sage-700">
                                    {selected.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                                </div>
                                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    selected.estimated ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                }`}>
                                    {selected.priceLabel}
                                </span>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                                    <Layers className="w-3.5 h-3.5" /> Stock disponible
                                </div>
                                <div className={`text-xl font-black ${selected.stock_available > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    {selected.stock_available}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Catégorie</div>
                                <div className="text-sm font-semibold text-gray-800">{pageName(selected.product_page_code)}</div>
                            </div>
                            {selected.price_list && (
                                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                                    <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Liste de prix</div>
                                    <div className="text-sm font-semibold text-gray-800">{selected.price_list.name} ({selected.price_list.code})</div>
                                </div>
                            )}
                        </div>

                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                                Règles produit
                            </div>
                            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                <FlagRow ok={selected.flags.is_returnable} label="Retour autorisé" />
                                <FlagRow ok={selected.flags.is_discountable} label="Remise autorisée" />
                                <FlagRow ok={selected.flags.is_expirable} label="Périssable" />
                                <FlagRow ok={selected.flags.decimal_quantity_allowed} label="Quantité décimale" />
                            </div>
                            {selected.flags.min_quantity_order > 1 && (
                                <div className="px-4 pb-3 text-xs text-gray-500">
                                    Quantité minimale de commande : <strong>{selected.flags.min_quantity_order}</strong>
                                </div>
                            )}
                        </div>

                        {selected.packagings.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase">
                                    Conditionnements
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {selected.packagings.map((pkg) => (
                                        <div key={pkg.packaging_id} className="px-4 py-2.5 flex items-center justify-between text-sm">
                                            <span className="text-gray-700">{pkg.unit_name} × {pkg.quantity}</span>
                                            {pkg.is_default && (
                                                <span className="text-[10px] font-bold text-sage-600 bg-sage-50 px-2 py-0.5 rounded-full">Par défaut</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!partner ? (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                Prix générique affiché — sélectionnez un partenaire dans le panneau de gauche pour voir le prix négocié.
                            </p>
                        ) : selected.estimated && (
                            <p className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                <WifiOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                Prix calculé localement (cache hors-ligne) — les promotions ne sont pas reproduites offline. Montant confirmé uniquement à la création de la commande.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between">
                            <h1 className="text-sm font-semibold text-gray-900">Catalogue produits</h1>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{products.length}</span>
                        </div>

                        {/* Compact toolbar — search stays inline (most-used action), everything
                            else (partner, catégorie, session, sync) lives behind "Filtres" so the
                            DataGrid keeps the vertical space instead of a tall filter stack. */}
                        <div className="p-2 border-b border-gray-100 shrink-0 flex items-center gap-1.5">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher par nom, code..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-gray-50"
                                />
                            </div>
                            <button
                                onClick={() => setShowFiltersModal(true)}
                                className={`relative shrink-0 p-2 rounded-md border transition-colors ${
                                    activeFilterCount > 0 ? 'bg-sage-50 border-sage-200 text-sage-600' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                }`}
                                title="Filtres (partenaire, catégorie)"
                            >
                                <SlidersHorizontal className="w-4 h-4" />
                                {activeFilterCount > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[9px] font-bold text-white bg-sage-600 rounded-full">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>
                        </div>

                        {partner && (
                            <div className="px-2 pt-2 shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-sage-50 border border-sage-100 rounded-full text-[11px] text-sage-700">
                                    {partner.name}
                                    <button onClick={() => setPartner(null)} className="text-sage-400 hover:text-sage-700">
                                        <X className="w-3 h-3" />
                                    </button>
                                </span>
                            </div>
                        )}

                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : products.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-400 text-xs text-center px-4">
                                        Aucun produit trouvé
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={products}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        rowSelection="single"
                                        onRowClicked={(e: any) => setSelected(e.data)}
                                        getRowClass={(p: any) => (selected && p.data?.id === selected.id ? 'bg-sage-50' : '')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                }
                mainContent={mainContent}
                rightContent={
                    <ActionPanel groups={[{ items: [{ icon: RefreshCw, label: 'Rafraîchir', onClick: refetchLive }] }]} />
                }
            />

            <Modal isOpen={showFiltersModal} onClose={() => setShowFiltersModal(false)} title="Filtres" size="sm">
                <div className="p-5 space-y-4">
                    <TelesalesSessionBannerSlim />
                    <SyncStatusBadge />
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire (prix négocié)</label>
                        <PartnerPicker value={partner} onChange={setPartner} placeholder="Prix négocié..." />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Catégorie</label>
                        <select
                            value={pageCode}
                            onChange={(e) => setPageCode(e.target.value)}
                            className="w-full appearance-none text-sm text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sage-500/50 cursor-pointer"
                        >
                            <option value="">Toutes catégories</option>
                            {pages.map((p) => (
                                <option key={p.id} value={p.code}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        {activeFilterCount > 0 && (
                            <button
                                onClick={() => { setPartner(null); setPageCode(''); }}
                                className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
                            >
                                Réinitialiser
                            </button>
                        )}
                        <button
                            onClick={() => setShowFiltersModal(false)}
                            className="px-4 py-2 text-sm font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700"
                        >
                            Appliquer
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

// Compact session status dot — the full banner (with Start/Pause/Terminer) is
// reachable from the dashboard; this list panel is dense enough already.
const TelesalesSessionBannerSlim = () => {
    const { session } = useCurrentSession();
    const isActive = session?.status === 'active';
    const isPaused = session?.status === 'paused';
    return (
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : isPaused ? 'bg-amber-500' : 'bg-gray-300'}`} />
            {isActive ? 'Session active' : isPaused ? 'Session en pause' : 'Aucune session'}
        </div>
    );
};

const FlagRow = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600' : 'text-gray-400'}`}>
        {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
        {label}
    </div>
);

export default TelesalesCatalogPage;
