import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import { Package, RefreshCw, Search, Star } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { PriceSourceBadge } from '@/components/pricing/PriceSourceBadge';
import { DataGrid } from '@/components/common/DataGrid';
import SearchableSelect from '@/components/common/SearchableSelect';
import { SearchSelect, type SearchSelectOption } from '@/components/common/SearchSelect';
import { searchProducts, searchPartners, getProductPackagings } from '@/services/api/pricingApi';
import { getPartnerFormMasterData } from '@/services/api/partnerApi';
import type { ProductPackaging, PackagingResolutionParams } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

type CellParams = { value: unknown; data?: ProductPackaging };
type ResolutionMode = 'none' | 'price_list' | 'partner';

// Grille de consultation des colisages avec prix résolus par le moteur v5 (§6.1c).
// Sans contexte → structure seule (price: null) ; avec price_list_id ou partner_id
// → prix résolus (liste effective du client + overrides N1 pour partner_id).
export function PackagingPricesPage() {
    const { t } = useTranslation();
    const [productId, setProductId] = useState<number | null>(null);
    const [productLabel, setProductLabel] = useState<string>('');
    const [mode, setMode] = useState<ResolutionMode>('none');
    const [priceListId, setPriceListId] = useState<number | null>(null);
    const [partnerId, setPartnerId] = useState<number | null>(null);
    const [priceLists, setPriceLists] = useState<{ id: number; code: string; name: string }[]>([]);
    const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        getPartnerFormMasterData()
            .then(md => setPriceLists((md as any).priceLists ?? md.price_lists ?? []))
            .catch(() => setPriceLists([]));
    }, []);

    const priceListOptions = useMemo(
        () => priceLists.map(pl => ({ value: pl.id, label: `${pl.code} — ${pl.name}` })),
        [priceLists]
    );

    const resolutionParams = useMemo<PackagingResolutionParams | undefined>(() => {
        if (mode === 'price_list' && priceListId) return { price_list_id: priceListId };
        if (mode === 'partner' && partnerId) return { partner_id: partnerId };
        return undefined;
    }, [mode, priceListId, partnerId]);

    const loadPackagings = useCallback(async (id: number, params?: PackagingResolutionParams) => {
        setLoading(true);
        try {
            setPackagings(await getProductPackagings(id, params));
        } catch (err) {
            toast.error(getErrorMessage(err));
            setPackagings([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (productId) loadPackagings(productId, resolutionParams);
        else setPackagings([]);
    }, [productId, resolutionParams, loadPackagings]);

    const handleProductSearch = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results = await searchProducts(query);
        return results.map((r) => ({ id: r.id, label: r.name, sublabel: r.code, raw: r }));
    }, []);

    const handlePartnerSearch = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results = await searchPartners(query);
        return results.map((r) => ({ id: r.id, label: r.name, sublabel: r.code, raw: r }));
    }, []);

    const hasResolution = resolutionParams !== undefined;

    const columnDefs = useMemo(() => [
        {
            field: 'label',
            headerName: t('pricing.packagingPrices.packaging'),
            minWidth: 220,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                return (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{p.label}</span>
                        {p.is_default && (
                            <span title={t('pricing.packagingPrices.defaultPackaging')}>
                                <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                            </span>
                        )}
                    </div>
                );
            },
        },
        {
            field: 'unit',
            headerName: t('pricing.packagingPrices.unit'),
            minWidth: 120,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                return (
                    <span className="text-xs text-gray-600">
                        <span className="font-mono text-gray-400">{p.unit?.code}</span> {p.unit?.name}
                    </span>
                );
            },
        },
        {
            field: 'quantity',
            headerName: t('common.quantity'),
            minWidth: 90,
            cellRenderer: (params: CellParams) => (
                <span className="text-sm font-semibold text-gray-800">× {Number(params.value ?? 1)}</span>
            ),
        },
        {
            field: 'price.unit_price',
            headerName: t('pricing.packagingPrices.resolvedPrice'),
            minWidth: 140,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                if (!p.price) return <span className="text-xs text-gray-400">—</span>;
                if (!p.price.sellable) {
                    return <span className="text-xs font-semibold text-red-600">{t('pricing.packagingPrices.notSellable')}</span>;
                }
                return <span className="text-sm font-semibold text-emerald-700">{Number(p.price.unit_price).toFixed(2)}</span>;
            },
        },
        {
            field: 'price.min_price',
            headerName: t('pricing.priceLists.details.minPrice'),
            minWidth: 100,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                return p.price?.min_price != null
                    ? <span className="text-xs text-gray-500">{Number(p.price.min_price).toFixed(2)}</span>
                    : <span className="text-xs text-gray-400">—</span>;
            },
        },
        {
            field: 'price.max_price',
            headerName: t('pricing.priceLists.details.maxPrice'),
            minWidth: 100,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                return p.price?.max_price != null
                    ? <span className="text-xs text-gray-500">{Number(p.price.max_price).toFixed(2)}</span>
                    : <span className="text-xs text-gray-400">—</span>;
            },
        },
        {
            field: 'price.source',
            headerName: t('pricing.preview.source'),
            minWidth: 150,
            cellRenderer: (params: CellParams) => {
                const p = params.data as ProductPackaging;
                return p.price ? <PriceSourceBadge source={p.price.source} /> : <span className="text-xs text-gray-400">—</span>;
            },
        },
    ], [t]);

    return (
        <MasterLayout
            mainContent={
                <PricingPageShell
                    title={t('pricing.packagingPrices.title')}
                    subtitle={t('pricing.packagingPrices.subtitle')}
                >
                    <div className="h-full flex flex-col">
                        <div className="px-4 pt-4 flex flex-wrap items-center gap-2">
                            <div className="w-80 max-w-full">
                                <SearchSelect
                                    value={productId}
                                    valueLabel={productLabel || undefined}
                                    onChange={(id, option) => {
                                        setProductId(id);
                                        setProductLabel(option?.label ?? '');
                                    }}
                                    onSearch={handleProductSearch}
                                    placeholder={t('pricing.preview.searchProduct')}
                                    minChars={2}
                                />
                            </div>

                            {/* Contexte de résolution des prix */}
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value as ResolutionMode)}
                                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20"
                            >
                                <option value="none">{t('pricing.packagingPrices.modeNone')}</option>
                                <option value="price_list">{t('pricing.packagingPrices.modePriceList')}</option>
                                <option value="partner">{t('pricing.packagingPrices.modePartner')}</option>
                            </select>

                            {mode === 'price_list' && (
                                <div className="w-64">
                                    <SearchableSelect
                                        options={priceListOptions}
                                        value={priceListId}
                                        onChange={(v) => setPriceListId(v ? Number(v) : null)}
                                        placeholder={t('common.selectPlaceholder')}
                                        clearable
                                    />
                                </div>
                            )}
                            {mode === 'partner' && (
                                <div className="w-64">
                                    <SearchSelect
                                        value={partnerId}
                                        onChange={(id) => setPartnerId(id)}
                                        onSearch={handlePartnerSearch}
                                        placeholder={t('pricing.preview.searchPartner')}
                                        minChars={2}
                                    />
                                </div>
                            )}

                            {productId && (
                                <button
                                    type="button"
                                    onClick={() => loadPackagings(productId, resolutionParams)}
                                    disabled={loading}
                                    className="p-2 text-gray-500 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors disabled:opacity-50"
                                    title={t('common.refresh')}
                                >
                                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            )}
                        </div>
                        <p className="px-4 pt-2 text-xs text-gray-400">
                            {hasResolution
                                ? (mode === 'partner'
                                    ? t('pricing.packagingPrices.partnerHint')
                                    : t('pricing.packagingPrices.priceListHint'))
                                : t('pricing.packagingPrices.derivedHint')}
                        </p>

                        <div className="flex-1 p-4 overflow-hidden">
                            {!productId ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <Search className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-medium text-gray-500">{t('pricing.packagingPrices.emptyTitle')}</p>
                                    <p className="text-xs">{t('pricing.packagingPrices.emptySubtitle')}</p>
                                </div>
                            ) : packagings.length === 0 && !loading ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                                    <Package className="w-10 h-10 opacity-30" />
                                    <p className="text-sm font-medium text-gray-500">{t('pricing.packagingPrices.noPackagings')}</p>
                                </div>
                            ) : (
                                <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                    <DataGrid
                                        rowData={packagings}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        suppressAutoFit
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </PricingPageShell>
            }
        />
    );
}
