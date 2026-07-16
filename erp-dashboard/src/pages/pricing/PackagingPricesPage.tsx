import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import { Package, RefreshCw, Search, Star, X } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
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
        if (mode === 'partner' && partnerId)      return { partner_id: partnerId };
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

    const handleClear = useCallback(() => {
        setProductId(null);
        setProductLabel('');
        setPackagings([]);
    }, []);

    const hasResolution = resolutionParams !== undefined;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const groups: { items: ActionItemProps[] }[] = [
            { items: [
                {
                    icon: RefreshCw,
                    label: t('common.refresh'),
                    onClick: () => { if (productId) loadPackagings(productId, resolutionParams); },
                    disabled: loading || !productId,
                },
            ]},
        ];
        if (productId) {
            groups.push({ items: [
                { icon: X, label: 'Effacer la sélection', variant: 'warning', onClick: handleClear },
            ]});
        }
        return groups;
    }, [productId, loading, t, handleClear]);

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
                if (!p.price.sellable) return <span className="text-xs font-semibold text-red-600">{t('pricing.packagingPrices.notSellable')}</span>;
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
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Package className="w-4 h-4 text-sage-600" />
                            <h2 className="text-sm font-bold text-gray-900">{t('pricing.packagingPrices.title')}</h2>
                        </div>

                        <div className="space-y-3">
                            {/* Product search */}
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                    Produit
                                </p>
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

                            {/* Resolution mode */}
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                    Contexte de résolution
                                </p>
                                <select
                                    value={mode}
                                    onChange={(e) => setMode(e.target.value as ResolutionMode)}
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-400"
                                >
                                    <option value="none">{t('pricing.packagingPrices.modeNone')}</option>
                                    <option value="price_list">{t('pricing.packagingPrices.modePriceList')}</option>
                                    <option value="partner">{t('pricing.packagingPrices.modePartner')}</option>
                                </select>
                            </div>

                            {mode === 'price_list' && (
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                        {t('pricing.channels.priceList')}
                                    </p>
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
                                <div>
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                        {t('pricing.overrides.partner')}
                                    </p>
                                    <SearchSelect
                                        value={partnerId}
                                        onChange={(id) => setPartnerId(id)}
                                        onSearch={handlePartnerSearch}
                                        placeholder={t('pricing.preview.searchPartner')}
                                        minChars={2}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Resolution hint */}
                    <div className="px-4 py-3 text-[11px] text-gray-400 leading-relaxed border-b border-gray-100 shrink-0">
                        {hasResolution
                            ? (mode === 'partner'
                                ? t('pricing.packagingPrices.partnerHint')
                                : t('pricing.packagingPrices.priceListHint'))
                            : t('pricing.packagingPrices.derivedHint')}
                    </div>

                    {/* Selected product summary */}
                    {productId && productLabel && (
                        <div className="mx-3 mt-3 px-3 py-2.5 bg-sage-50 rounded-lg border border-sage-100">
                            <p className="text-[10px] text-sage-500 font-semibold uppercase tracking-wider mb-0.5">
                                Sélectionné
                            </p>
                            <p className="text-xs font-medium text-sage-800 truncate">{productLabel}</p>
                            {packagings.length > 0 && (
                                <p className="text-[10px] text-sage-500 mt-0.5">
                                    {packagings.length} colisage{packagings.length > 1 ? 's' : ''}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            }
            mainContent={
                <PricingPageShell
                    title={t('pricing.packagingPrices.title')}
                    subtitle={t('pricing.packagingPrices.subtitle')}
                >
                    <div className="h-full flex flex-col">
                        <div className="flex-1 overflow-hidden p-4">
                            {!productId ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
                                    <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                        <Search className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-700">{t('pricing.packagingPrices.emptyTitle')}</p>
                                        <p className="text-xs text-gray-400 mt-1">{t('pricing.packagingPrices.emptySubtitle')}</p>
                                    </div>
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
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
