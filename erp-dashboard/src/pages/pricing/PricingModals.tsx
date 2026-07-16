import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, X, AlertTriangle, Copy, Upload, Edit, ArrowRight } from 'lucide-react';
import type {
    PriceList,
    PriceOverride,
    CreatePriceListRequest,
    CreateLineRequest,
    DuplicateLineRequest,
    CreateOverrideRequest,
    ImportCsvParams,
    PreviewPriceResponse,
} from '@/types/pricing.types';
import { SearchSelect, type SearchSelectOption } from '@/components/common/SearchSelect';
import { searchProducts, type ProductSearchResult, searchPartners, type PartnerSearchResult, previewPrice } from '@/services/api/pricingApi';
import { PriceSourceBadge } from '@/components/pricing/PriceSourceBadge';
import { Button } from '@/components/ui/button';

// ─── Shared modal wrapper ─────────────────────────────────────────────────────

const ModalWrapper: React.FC<{ onClose: () => void; children: React.ReactNode; size?: 'sm' | 'md' | 'lg' }> = ({
    onClose,
    children,
    size = 'md',
}) => {
    const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`bg-white rounded-xl shadow-2xl w-full ${width} max-h-[90vh] overflow-y-auto border border-gray-100`}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
};

const ModalHeader: React.FC<{ icon: React.ElementType; title: string; onClose: () => void }> = ({
    icon: Icon,
    title,
    onClose,
}) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-sage-50 flex items-center justify-center border border-sage-100">
                <Icon className="w-4 h-4 text-sage-600" />
            </div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
        </Button>
    </div>
);

const ModalFooter: React.FC<{ onClose: () => void; onSubmit: () => void; loading: boolean; label: string }> = ({
    onClose,
    onSubmit,
    loading,
    label,
}) => {
    const { t } = useTranslation();
    return (
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50/50">
            <Button variant="outline" onClick={onClose} className="text-gray-600 border-gray-200 hover:bg-gray-100">
                {t('common.cancel')}
            </Button>
            <Button onClick={onSubmit} disabled={loading} className="bg-sage-600 hover:bg-sage-700 text-white">
                {loading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                {label}
            </Button>
        </div>
    );
};

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode; hint?: string }> = ({
    label,
    required,
    children,
    hint,
}) => (
    <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
);

// ─── Unified design tokens ────────────────────────────────────────────────────
// All form controls share the same height, border radius, border color and
// focus ring so they look identical side-by-side.
const inputCls =
    'w-full h-10 px-3.5 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 ' +
    'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sage-400/25 ' +
    'focus:border-sage-400 transition-all';

// Styled select wrapper — hides browser chrome, adds custom chevron
const SelectField: React.FC<{
    value: string;
    onChange: (v: string) => void;
    children: React.ReactNode;
    className?: string;
}> = ({ value, onChange, children, className = '' }) => (
    <div className="relative w-full">
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={
                'w-full h-10 pl-3.5 pr-9 border border-gray-200 rounded-xl bg-white text-sm text-gray-900 ' +
                'appearance-none focus:outline-none focus:ring-2 focus:ring-sage-400/25 focus:border-sage-400 ' +
                'transition-all cursor-pointer ' + className
            }
        >
            {children}
        </select>
        <svg
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
            <polyline points="6 9 12 15 18 9" />
        </svg>
    </div>
);

// Status toggle chips — replaces native select for Open/Closed
const StatusToggle: React.FC<{
    value: boolean; // true = closed
    onChange: (closed: boolean) => void;
}> = ({ value: closed, onChange }) => (
    <div className="flex gap-1.5 h-10">
        <button
            type="button"
            onClick={() => onChange(false)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-all ${
                !closed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
            }`}
        >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
            Ouverte
        </button>
        <button
            type="button"
            onClick={() => onChange(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-medium transition-all ${
                closed
                    ? 'bg-red-50 border-red-300 text-red-700 shadow-sm'
                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
            }`}
        >
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Fermée
        </button>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Create / Edit Price List
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalCreatePLProps {
    editingPL: PriceList | null;
    plForm: Partial<CreatePriceListRequest>;
    setPlForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalCreatePL: React.FC<ModalCreatePLProps> = ({ editingPL, plForm, setPlForm, onClose, onSubmit, loading }) => {
    const { t } = useTranslation();
    return (
        <ModalWrapper onClose={onClose} size="md">
            <ModalHeader
                icon={editingPL ? Edit : Plus}
                title={editingPL ? t('pricing.priceLists.edit') : t('pricing.priceLists.create')}
                onClose={onClose}
            />
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.priceLists.code')} required>
                        <input
                            type="text"
                            value={plForm.code || ''}
                            onChange={(e) => setPlForm((prev: any) => ({ ...prev, code: e.target.value }))}
                            className={`${inputCls} font-mono`}
                            placeholder="TARIF01"
                        />
                    </Field>
                    <Field label={t('pricing.priceLists.rank')} required>
                        <input
                            type="number"
                            value={plForm.rank || ''}
                            onChange={(e) => setPlForm((prev: any) => ({ ...prev, rank: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min="1"
                        />
                    </Field>
                </div>
                <Field label={t('pricing.priceLists.name')} required>
                    <input
                        type="text"
                        value={plForm.name || ''}
                        onChange={(e) => setPlForm((prev: any) => ({ ...prev, name: e.target.value }))}
                        className={inputCls}
                        placeholder={t('pricing.priceLists.name')}
                    />
                </Field>
            </div>
            <ModalFooter
                onClose={onClose}
                onSubmit={onSubmit}
                loading={loading}
                label={editingPL ? t('common.save') : t('common.create')}
            />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Create Line
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalCreateLineProps {
    lineForm: Partial<CreateLineRequest>;
    setLineForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalCreateLine: React.FC<ModalCreateLineProps> = ({ lineForm, setLineForm, onClose, onSubmit, loading }) => {
    const { t } = useTranslation();
    return (
        <ModalWrapper onClose={onClose} size="md">
            <ModalHeader
                icon={Plus}
                title={t('pricing.priceLists.line.create')}
                onClose={onClose}
            />
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.priceLists.line.number')} required hint="Numéro d'ordre de la période">
                        <input
                            type="number"
                            value={lineForm.line_number || ''}
                            onChange={(e) => setLineForm((prev: any) => ({ ...prev, line_number: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            placeholder="1"
                            min="1"
                        />
                    </Field>
                    <Field label={t('common.status')} hint="Détermine si la période est active">
                        <StatusToggle
                            value={lineForm.closed ?? false}
                            onChange={(closed) => setLineForm((prev: any) => ({ ...prev, closed }))}
                        />
                    </Field>
                </div>
                <Field label={t('pricing.priceLists.line.name')} required>
                    <input
                        type="text"
                        value={lineForm.name || ''}
                        onChange={(e) => setLineForm((prev: any) => ({ ...prev, name: e.target.value }))}
                        className={inputCls}
                        placeholder={t('pricing.priceLists.line.defaultName')}
                    />
                </Field>
                <div className="grid grid-cols-2 gap-4 pt-1">
                    <Field label={t('pricing.priceLists.line.startDate')} required>
                        <input
                            type="date"
                            value={lineForm.start_date || ''}
                            onChange={(e) => setLineForm((prev: any) => ({ ...prev, start_date: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                    <Field label={t('pricing.priceLists.line.endDate')} required>
                        <input
                            type="date"
                            value={lineForm.end_date || ''}
                            onChange={(e) => setLineForm((prev: any) => ({ ...prev, end_date: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                </div>
            </div>
            <ModalFooter
                onClose={onClose}
                onSubmit={onSubmit}
                loading={loading}
                label={t('common.create')}
            />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Duplicate Line
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalDuplicateLineProps {
    dupForm: Partial<DuplicateLineRequest>;
    setDupForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalDuplicateLine: React.FC<ModalDuplicateLineProps> = ({
    dupForm,
    setDupForm,
    onClose,
    onSubmit,
    loading,
}) => {
    const { t } = useTranslation();
    return (
        <ModalWrapper onClose={onClose} size="md">
            <ModalHeader
                icon={Copy}
                title={t('pricing.priceLists.line.duplicate')}
                onClose={onClose}
            />
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.priceLists.line.sourceLine')} required>
                        <input
                            type="number"
                            value={dupForm.source_line_number || ''}
                            onChange={(e) => setDupForm((prev: any) => ({ ...prev, source_line_number: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min="1"
                        />
                    </Field>
                    <Field label={t('pricing.priceLists.line.targetLine')} required>
                        <input
                            type="number"
                            value={dupForm.new_line_number || ''}
                            onChange={(e) => setDupForm((prev: any) => ({ ...prev, new_line_number: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min="1"
                        />
                    </Field>
                </div>
                <Field label={t('pricing.priceLists.line.name')} required>
                    <input
                        type="text"
                        value={dupForm.new_name || ''}
                        onChange={(e) => setDupForm((prev: any) => ({ ...prev, new_name: e.target.value }))}
                        className={inputCls}
                        placeholder={t('pricing.priceLists.line.copyOf')}
                    />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.priceLists.line.startDate')} required>
                        <input
                            type="date"
                            value={dupForm.new_start_date || ''}
                            onChange={(e) => setDupForm((prev: any) => ({ ...prev, new_start_date: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                    <Field label={t('pricing.priceLists.line.endDate')} required>
                        <input
                            type="date"
                            value={dupForm.new_end_date || ''}
                            onChange={(e) => setDupForm((prev: any) => ({ ...prev, new_end_date: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                </div>
            </div>
            <ModalFooter
                onClose={onClose}
                onSubmit={onSubmit}
                loading={loading}
                label={t('common.duplicate')}
            />
        </ModalWrapper>
    );
};

// ─── Search helpers ──────────────────────────────────────────────────────────

const useProductSearch = () =>
    useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results: ProductSearchResult[] = await searchProducts(query);
        return results.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: r.code,
            raw: r,
        }));
    }, []);

const usePartnerSearch = () =>
    useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results: PartnerSearchResult[] = await searchPartners(query);
        return results.map((r) => ({
            id: r.id,
            label: r.name,
            sublabel: `${r.code}${r.status ? ` · ${r.status}` : ''}`,
            raw: r,
        }));
    }, []);

// ═══════════════════════════════════════════════════════════════════════════════
// Override
// ═══════════════════════════════════════════════════════════════════════════════

type PriceMode = 'fixed_price' | 'rate' | 'amount';

function initPriceMode(form: Partial<CreateOverrideRequest>): PriceMode {
    if (form.fixed_price != null) return 'fixed_price';
    if (form.discount_amount != null) return 'amount';
    return 'rate';
}

interface ModalOverrideProps {
    editingOverride: PriceOverride | null;
    form: Partial<CreateOverrideRequest>;
    setForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalOverride: React.FC<ModalOverrideProps> = ({ editingOverride, form, setForm, onClose, onSubmit, loading }) => {
    const { t } = useTranslation();
    const handleProductSearch = useProductSearch();
    const handlePartnerSearch = usePartnerSearch();

    const productLabel = editingOverride?.product ? editingOverride.product.name : undefined;
    const partnerLabel = editingOverride?.partner ? editingOverride.partner.name : undefined;

    const [priceMode, setPriceMode] = useState<PriceMode>(() => initPriceMode(form));

    const handleModeChange = (mode: PriceMode) => {
        setPriceMode(mode);
        setForm((prev: any) => ({
            ...prev,
            fixed_price: undefined,
            discount_rate: undefined,
            discount_amount: undefined,
        }));
    };

    const [preview, setPreview] = useState<PreviewPriceResponse | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (!form.partner_id || !form.product_id) {
            setPreview(null);
            return;
        }
        let cancelled = false;
        setPreviewLoading(true);
        const timer = setTimeout(async () => {
            try {
                const res = await previewPrice({ partner_id: form.partner_id!, product_id: form.product_id! });
                if (!cancelled) setPreview(res);
            } catch {
                if (!cancelled) setPreview(null);
            } finally {
                if (!cancelled) setPreviewLoading(false);
            }
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [form.partner_id, form.product_id]);

    const resultingPrice = useMemo(() => {
        if (!preview) return null;
        if (priceMode === 'fixed_price' && form.fixed_price != null) return form.fixed_price;
        let price = preview.base_price;
        if (priceMode === 'rate' && form.discount_rate != null && form.discount_rate > 0)
            price = price * (1 - form.discount_rate / 100);
        if (priceMode === 'amount' && form.discount_amount != null && form.discount_amount > 0)
            price = price - form.discount_amount;
        return Math.max(price, 0);
    }, [preview, priceMode, form.fixed_price, form.discount_rate, form.discount_amount]);

    const parseNumber = (raw: string): number | undefined => (raw === '' ? undefined : Number(raw));

    const rateInvalid = priceMode === 'rate' && form.discount_rate != null && (form.discount_rate < 0 || form.discount_rate > 100);

    const MODES: { value: PriceMode; label: string }[] = [
        { value: 'fixed_price', label: t('pricing.overrides.modePrix') },
        { value: 'rate', label: t('pricing.overrides.modeRate') },
        { value: 'amount', label: t('pricing.overrides.modeAmount') },
    ];

    return (
        <ModalWrapper onClose={onClose} size="lg">
            <ModalHeader
                icon={editingOverride ? Edit : Plus}
                title={editingOverride ? t('pricing.overrides.edit') : t('pricing.overrides.create')}
                onClose={onClose}
            />
            <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.overrides.partner')} required>
                        <SearchSelect
                            value={form.partner_id || null}
                            valueLabel={partnerLabel}
                            onChange={(id) => setForm((prev: any) => ({ ...prev, partner_id: id || undefined }))}
                            onSearch={handlePartnerSearch}
                            placeholder={t('pricing.preview.searchPartner')}
                            minChars={2}
                        />
                    </Field>
                    <Field label={t('pricing.overrides.product')} required>
                        <SearchSelect
                            value={form.product_id || null}
                            valueLabel={productLabel}
                            onChange={(id) => setForm((prev: any) => ({ ...prev, product_id: id || undefined }))}
                            onSearch={handleProductSearch}
                            placeholder={t('pricing.preview.searchProduct')}
                            minChars={2}
                        />
                    </Field>
                </div>

                <Field label={t('pricing.overrides.priceMode')}>
                    <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
                        {MODES.map((m) => (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => handleModeChange(m.value)}
                                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                    priceMode === m.value
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </Field>

                {priceMode === 'fixed_price' && (
                    <Field label={t('pricing.overrides.fixedPrice')}>
                        <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={form.fixed_price ?? ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, fixed_price: parseNumber(e.target.value) }))}
                            className={inputCls}
                            placeholder="10.500"
                        />
                        <p className="text-[11px] text-amber-600 mt-1">{t('pricing.overrides.fixedPriceHint')}</p>
                    </Field>
                )}
                {priceMode === 'rate' && (
                    <Field label={t('pricing.overrides.discountRate')}>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={form.discount_rate ?? ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, discount_rate: parseNumber(e.target.value) }))}
                            className={`${inputCls} ${rateInvalid ? 'border-red-400 focus:ring-red-400' : ''}`}
                            placeholder="10"
                        />
                        <p className={`text-[11px] mt-1 ${rateInvalid ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                            {rateInvalid ? t('pricing.overrides.discountRateInvalid') : t('pricing.overrides.discountRateHint')}
                        </p>
                    </Field>
                )}
                {priceMode === 'amount' && (
                    <Field label={t('pricing.overrides.discountAmount')}>
                        <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={form.discount_amount ?? ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, discount_amount: parseNumber(e.target.value) }))}
                            className={inputCls}
                        />
                    </Field>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.overrides.validFrom')}>
                        <input
                            type="date"
                            value={form.valid_from || ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, valid_from: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                    <Field label={t('pricing.overrides.validTo')}>
                        <input
                            type="date"
                            value={form.valid_to || ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, valid_to: e.target.value }))}
                            className={inputCls}
                        />
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Field label={t('pricing.overrides.priority')}>
                        <input
                            type="number"
                            value={form.priority ?? ''}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                            className={inputCls}
                            min="0"
                        />
                    </Field>
                    <Field label={t('common.status')}>
                        <SelectField
                            value={form.active ? 'active' : 'inactive'}
                            onChange={(v) => setForm((prev: any) => ({ ...prev, active: v === 'active' }))}
                        >
                            <option value="active">{t('common.active')}</option>
                            <option value="inactive">{t('common.inactive')}</option>
                        </SelectField>
                    </Field>
                </div>

                {(preview || previewLoading) && (
                    <div className="p-3 bg-gradient-to-br from-sage-50 to-white rounded-lg border border-sage-200">
                        {previewLoading ? (
                            <div className="flex items-center gap-2 text-xs text-sage-600">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {t('pricing.preview.calculating')}
                            </div>
                        ) : (
                            preview && (
                                <>
                                    <div className="flex items-center justify-center gap-3">
                                        <div className="text-center">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide">{t('pricing.overrides.currentPrice')}</div>
                                            <div className="text-lg font-bold text-gray-700">{preview.final_price.toFixed(3)}</div>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-sage-400 shrink-0" />
                                        <div className="text-center">
                                            <div className="text-[10px] text-sage-600 uppercase tracking-wide">{t('pricing.overrides.resultingPrice')}</div>
                                            <div className="text-lg font-bold text-sage-800">
                                                {resultingPrice != null ? resultingPrice.toFixed(3) : '—'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 mt-1.5">
                                        <PriceSourceBadge source={preview.source} />
                                        <span className="text-[10px] text-gray-400">v{preview.algorithm_version}</span>
                                    </div>
                                </>
                            )
                        )}
                    </div>
                )}
            </div>
            <ModalFooter
                onClose={onClose}
                onSubmit={onSubmit}
                loading={loading}
                label={editingOverride ? t('common.save') : t('common.create')}
            />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Import CSV
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalImportProps {
    importFile: File | null;
    setImportFile: (f: File | null) => void;
    importParams: ImportCsvParams;
    setImportParams: (p: ImportCsvParams) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalImport: React.FC<ModalImportProps> = ({
    importFile: _unusedImportFile,
    setImportFile,
    importParams,
    setImportParams,
    onClose,
    onSubmit,
    loading,
}) => {
    const { t } = useTranslation();
    return (
        <ModalWrapper onClose={onClose} size="md">
            <ModalHeader icon={Upload} title={t('pricing.priceLists.line.importCsv')} onClose={onClose} />
            <div className="p-5 space-y-4">
                <Field label={t('common.file')} required>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sage-50 file:text-sage-700 hover:file:bg-sage-100 border border-gray-200 rounded-lg py-2 px-3"
                    />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                    <Field label={t('common.mode')}>
                        <SelectField
                            value={importParams.mode}
                            onChange={(v) => setImportParams({ ...importParams, mode: v as any })}
                        >
                            <option value="merge">{t('common.merge')}</option>
                            <option value="replace">{t('common.replace')}</option>
                        </SelectField>
                    </Field>
                    <Field label={t('common.header')}>
                        <SelectField
                            value={importParams.has_header ? 'yes' : 'no'}
                            onChange={(v) => setImportParams({ ...importParams, has_header: v === 'yes' })}
                        >
                            <option value="yes">{t('common.yes')}</option>
                            <option value="no">{t('common.no')}</option>
                        </SelectField>
                    </Field>
                    <Field label={t('common.identifier')}>
                        <SelectField
                            value={importParams.product_identifier}
                            onChange={(v) => setImportParams({ ...importParams, product_identifier: v as any })}
                        >
                            <option value="code">{t('common.code')}</option>
                            <option value="id">{t('common.id')}</option>
                        </SelectField>
                    </Field>
                </div>
                {importParams.mode === 'replace' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700">
                            <strong>{t('common.attention')}</strong> {t('pricing.priceLists.import.replaceWarning')}
                        </p>
                    </div>
                )}
            </div>
            <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label={t('common.import')} />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirmation
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalDeleteConfirmProps {
    selected: PriceList;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}

export const ModalDeleteConfirm: React.FC<ModalDeleteConfirmProps> = ({ selected, onClose, onConfirm, loading }) => {
    const { t } = useTranslation();
    return (
        <ModalWrapper onClose={onClose} size="sm">
            <div className="p-5 pb-3 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mb-3 shadow-sm">
                    <AlertTriangle className="w-7 h-7 text-red-600" />
                </div>
                <h2 className="text-lg font-semibold text-gray-900">{t('pricing.priceLists.delete')}</h2>
                <p className="text-sm text-gray-500 mt-1">{t('pricing.priceLists.deleteConfirmMessage')}</p>
            </div>
            <div className="mx-5 p-3 bg-slate-50 rounded-lg border border-gray-200">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-semibold text-gray-900">{selected.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 font-mono">{selected.code}</div>
                    </div>
                    <div className="text-right">
                        <div className="text-xs text-gray-500">{t('pricing.priceLists.rank')}</div>
                        <div className="text-lg font-bold text-gray-900">{selected.rank}</div>
                    </div>
                </div>
            </div>
            <div className="mx-5 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{t('common.irreversible')}</p>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 pt-4">
                <Button variant="outline" onClick={onClose} className="text-gray-600 border-gray-200 hover:bg-gray-100">
                    {t('common.cancel')}
                </Button>
                <Button onClick={onConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700 text-white">
                    {loading && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                    {t('common.delete')}
                </Button>
            </div>
        </ModalWrapper>
    );
};
