import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Eye,
    Calculator,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchSelect, type SearchSelectOption } from '@/components/common/SearchSelect';
import { usePreviewPrice } from '@/hooks/pricing/usePricing';
import { searchProducts, searchPartners } from '@/services/api/pricingApi';
import type { PreviewPriceRequest, PreviewPriceResponse } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

// Libellés lisibles des sources du moteur v5 (fallback: valeur brute)
const SOURCE_LABEL_KEYS: Record<string, string> = {
    standard: 'pricing.preview.sourceStandard',
    partner_override: 'pricing.preview.sourceOverride',
    partner_override_discount: 'pricing.preview.sourceOverrideDiscount',
};

export function PricePreviewPage() {
    const { t } = useTranslation();
    const { execute: previewPrice, loading } = usePreviewPrice();

    const [form, setForm] = useState<Partial<PreviewPriceRequest>>({
        partner_id: undefined,
        product_id: undefined,
    });
    const [result, setResult] = useState<PreviewPriceResponse | null>(null);

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

    const handleSubmit = async () => {
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
    };

    const discount = result ? result.base_price - result.final_price : 0;
    const sourceLabel = result
        ? (SOURCE_LABEL_KEYS[result.source] ? t(SOURCE_LABEL_KEYS[result.source]) : result.source)
        : '';

    return (
        <MasterLayout
            mainContent={
                <PricingPageShell
                    title={t('pricing.preview.title')}
                    subtitle={t('pricing.preview.subtitle')}
                >
                    <div className="h-full overflow-y-auto p-6">
                        <div className="max-w-3xl mx-auto space-y-6">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                    <Calculator className="w-4 h-4 text-sage-600" />
                                    {t('pricing.preview.formTitle')}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500">{t('pricing.overrides.partner')} *</label>
                                        <SearchSelect
                                            value={form.partner_id || null}
                                            onChange={(id) => setForm((prev) => ({ ...prev, partner_id: id || undefined }))}
                                            onSearch={handlePartnerSearch}
                                            placeholder={t('pricing.preview.searchPartner')}
                                            minChars={2}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-gray-500">{t('pricing.overrides.product')} *</label>
                                        <SearchSelect
                                            value={form.product_id || null}
                                            onChange={(id) => setForm((prev) => ({ ...prev, product_id: id || undefined }))}
                                            onSearch={handleProductSearch}
                                            placeholder={t('pricing.preview.searchProduct')}
                                            minChars={2}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <Button onClick={handleSubmit} disabled={loading} className="bg-sage-600 hover:bg-sage-700">
                                        {loading ? (
                                            <span className="animate-pulse">{t('pricing.preview.calculating')}</span>
                                        ) : (
                                            <>
                                                <Eye className="w-4 h-4 mr-1.5" /> {t('pricing.preview.calculate')}
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {result && (
                                <div className="bg-gradient-to-br from-sage-50 to-white rounded-xl border border-sage-200 shadow-sm p-6 space-y-5">
                                    <div className="text-center">
                                        <div className="text-xs font-medium text-sage-600 uppercase tracking-wider mb-1">{t('pricing.preview.effectivePrice')}</div>
                                        <div className="text-4xl font-bold text-sage-800">{result.final_price.toFixed(3)}</div>
                                        <div className="flex items-center justify-center gap-2 mt-2">
                                            <Badge variant="outline" className="text-[10px]">
                                                {t('pricing.preview.source')}: {sourceLabel}
                                            </Badge>
                                            <Badge variant="secondary" className="text-[10px]">
                                                {t('pricing.preview.engineVersion', { version: result.algorithm_version })}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                            )}

                            {!result && !loading && (
                                <div className="text-center py-12 text-gray-400">
                                    <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="text-sm font-medium text-gray-500">{t('pricing.preview.emptyTitle')}</p>
                                    <p className="text-xs mt-1">{t('pricing.preview.emptySubtitle')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </PricingPageShell>
            }
        />
    );
}
