import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import { Eye, Calculator, Package, Star, X, RefreshCw } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { Badge } from '@/components/ui/badge';
import { SearchSelect, type SearchSelectOption } from '@/components/common/SearchSelect';
import { usePreviewPrice } from '@/hooks/pricing/usePricing';
import { searchProducts, searchPartners, getProductPackagings } from '@/services/api/pricingApi';
import { PriceSourceBadge } from '@/components/pricing/PriceSourceBadge';
import type { PreviewPriceRequest, PreviewPriceResponse, ProductPackaging } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

export function PricePreviewPage() {
    const { t } = useTranslation();
    const { execute: previewPrice, loading } = usePreviewPrice();

    const [form, setForm] = useState<Partial<PreviewPriceRequest>>({
        partner_id: undefined,
        product_id: undefined,
    });
    const [result, setResult] = useState<PreviewPriceResponse | null>(null);
    const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
    const [packagingsLoading, setPackagingsLoading] = useState(false);

    useEffect(() => {
        if (!result || !form.product_id || !form.partner_id) { setPackagings([]); return; }
        setPackagingsLoading(true);
        getProductPackagings(form.product_id, { partner_id: form.partner_id })
            .then(setPackagings)
            .catch(() => setPackagings([]))
            .finally(() => setPackagingsLoading(false));
    }, [result, form.product_id, form.partner_id]);

    const handleProductSearch = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results = await searchProducts(query);
        return results.map((r) => ({ id: r.id, label: r.name, sublabel: r.code, raw: r }));
    }, []);

    const handlePartnerSearch = useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results = await searchPartners(query);
        return results.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: `${r.code}${r.status ? ` · ${r.status}` : ''}`,
            raw: r,
        }));
    }, []);

    const handleCalculate = useCallback(async () => {
        if (!form.partner_id || !form.product_id) {
            toast.error(t('pricing.preview.missingFields'));
            return;
        }
        try {
            const response = await previewPrice(form as PreviewPriceRequest);
            setResult(response);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    }, [form, previewPrice, t]);

    const handleReset = useCallback(() => {
        setResult(null);
        setPackagings([]);
    }, []);

    const canCalculate = !!form.partner_id && !!form.product_id;
    const discount = result ? result.base_price - result.final_price : 0;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const groups: { items: ActionItemProps[] }[] = [
            { items: [
                {
                    icon: loading ? RefreshCw : Eye,
                    label: loading ? t('pricing.preview.calculating') : t('pricing.preview.calculate'),
                    variant: 'primary',
                    onClick: handleCalculate,
                    disabled: loading || !canCalculate,
                },
            ]},
        ];
        if (result) {
            groups.push({ items: [
                { icon: X, label: 'Effacer le résultat', variant: 'warning', onClick: handleReset },
            ]});
        }
        return groups;
    }, [loading, canCalculate, result, t, handleCalculate, handleReset]);

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-4">
                            <Calculator className="w-4 h-4 text-sage-600" />
                            <h2 className="text-sm font-bold text-gray-900">{t('pricing.preview.formTitle')}</h2>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                    {t('pricing.overrides.partner')} *
                                </p>
                                <SearchSelect
                                    value={form.partner_id || null}
                                    onChange={(id) => setForm((prev) => ({ ...prev, partner_id: id || undefined }))}
                                    onSearch={handlePartnerSearch}
                                    placeholder={t('pricing.preview.searchPartner')}
                                    minChars={2}
                                />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                                    {t('pricing.overrides.product')} *
                                </p>
                                <SearchSelect
                                    value={form.product_id || null}
                                    onChange={(id) => setForm((prev) => ({ ...prev, product_id: id || undefined }))}
                                    onSearch={handleProductSearch}
                                    placeholder={t('pricing.preview.searchProduct')}
                                    minChars={2}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Quick result summary (when available) */}
                    {result && (
                        <div className="mx-3 mt-3 px-3 py-3 bg-gradient-to-br from-sage-50 to-white rounded-lg border border-sage-100">
                            <p className="text-[10px] text-sage-500 font-semibold uppercase tracking-wider mb-1">
                                {t('pricing.preview.effectivePrice')}
                            </p>
                            <p className="text-2xl font-bold text-sage-800 leading-none mb-2">
                                {result.final_price.toFixed(3)}
                            </p>
                            <PriceSourceBadge source={result.source} />
                            {discount > 0 && (
                                <p className="text-[11px] text-amber-600 font-medium mt-1.5">
                                    Remise : -{discount.toFixed(3)}
                                </p>
                            )}
                        </div>
                    )}

                    {!canCalculate && (
                        <p className="px-4 pt-3 text-[11px] text-gray-400 leading-relaxed">
                            {t('pricing.preview.emptySubtitle')}
                        </p>
                    )}
                </div>
            }
            mainContent={
                <PricingPageShell
                    title={t('pricing.preview.title')}
                    subtitle={t('pricing.preview.subtitle')}
                >
                    <div className="h-full overflow-y-auto p-6">
                        {result ? (
                            <div className="max-w-2xl mx-auto space-y-5">
                                {/* Main result card */}
                                <div className="bg-gradient-to-br from-sage-50 to-white rounded-xl border border-sage-200 shadow-sm p-6 space-y-5">
                                    <div className="text-center">
                                        <div className="text-xs font-medium text-sage-600 uppercase tracking-wider mb-1">
                                            {t('pricing.preview.effectivePrice')}
                                        </div>
                                        <div className="text-4xl font-bold text-sage-800">{result.final_price.toFixed(3)}</div>
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <PriceSourceBadge source={result.source} />
                                            <Badge variant="secondary" className="text-[10px]">
                                                {t('pricing.preview.engineVersion', { version: result.algorithm_version })}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white rounded-lg border border-sage-100 p-3 text-center">
                                            <div className="text-[11px] text-gray-500 mb-1">{t('pricing.preview.basePrice')}</div>
                                            <div className="text-lg font-bold text-gray-900">{result.base_price.toFixed(3)}</div>
                                        </div>
                                        <div className="bg-white rounded-lg border border-sage-100 p-3 text-center">
                                            <div className="text-[11px] text-gray-500 mb-1">{t('pricing.preview.discount')}</div>
                                            <div className={`text-lg font-bold ${discount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                                                {discount > 0 ? `-${discount.toFixed(3)}` : '0.000'}
                                            </div>
                                        </div>
                                    </div>

                                    {result.detail && (
                                        <div className="space-y-2">
                                            <div className="text-xs font-semibold text-gray-700">{t('pricing.preview.detailTitle')}</div>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-white rounded-lg border border-sage-100 p-3 text-center">
                                                    <div className="text-[11px] text-gray-500 mb-1">{t('pricing.preview.salesPrice')}</div>
                                                    <div className="text-sm font-bold text-gray-900">{Number(result.detail.sales_price ?? 0).toFixed(3)}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-sage-100 p-3 text-center">
                                                    <div className="text-[11px] text-gray-500 mb-1">{t('pricing.preview.minPrice')}</div>
                                                    <div className="text-sm font-bold text-gray-600">{Number(result.detail.min_sales_price ?? 0).toFixed(3)}</div>
                                                </div>
                                                <div className="bg-white rounded-lg border border-sage-100 p-3 text-center">
                                                    <div className="text-[11px] text-gray-500 mb-1">{t('pricing.preview.maxPrice')}</div>
                                                    <div className="text-sm font-bold text-gray-600">{Number(result.detail.max_sales_price ?? 0).toFixed(3)}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Packaging breakdown */}
                                {(packagings.length > 0 || packagingsLoading) && (
                                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                                            <Package className="w-4 h-4 text-emerald-600" />
                                            <span className="text-xs font-semibold text-gray-700">{t('pricing.preview.packagingTitle')}</span>
                                            <span className="text-[10px] text-gray-400 ml-1">{t('pricing.preview.packagingHint')}</span>
                                        </div>
                                        {packagingsLoading ? (
                                            <div className="p-4 space-y-2">
                                                {[1, 2, 3].map((i) => (
                                                    <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100">
                                                {packagings.map((pkg) => (
                                                    <div key={pkg.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/50">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {pkg.is_default && (
                                                                <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />
                                                            )}
                                                            <span className="text-sm font-medium text-gray-800 truncate">{pkg.label}</span>
                                                            <span className="text-[11px] text-gray-400 font-mono shrink-0">
                                                                {pkg.unit?.code} × {pkg.quantity}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {pkg.price ? (
                                                                <>
                                                                    {pkg.price.sellable ? (
                                                                        <span className="text-sm font-bold text-emerald-700">
                                                                            {Number(pkg.price.unit_price).toFixed(3)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-xs text-red-500 font-semibold">{t('pricing.packagingPrices.notSellable')}</span>
                                                                    )}
                                                                    <PriceSourceBadge source={pkg.price.source} />
                                                                </>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">—</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                    <Eye className="w-10 h-10 text-gray-200" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-700">{t('pricing.preview.emptyTitle')}</p>
                                    <p className="text-xs text-gray-400 mt-1">{t('pricing.preview.emptySubtitle')}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </PricingPageShell>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
