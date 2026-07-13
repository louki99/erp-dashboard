import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Plus, X, AlertTriangle, Copy, Upload, Edit, DollarSign, ArrowRight } from 'lucide-react';
import type {
    PriceList,
    PriceOverride,
    PackagingPrice,
    CreatePriceListRequest,
    CreateLineRequest,
    DuplicateLineRequest,
    CreateOverrideRequest,
    ImportCsvParams,
    PreviewPriceResponse,
    CreatePackagingPriceRequest,
} from '@/types/pricing.types';
import { SearchSelect, type SearchSelectOption } from '@/components/common/SearchSelect';
import { searchProducts, type ProductSearchResult, searchPartners, type PartnerSearchResult, previewPrice } from '@/services/api/pricingApi';

// ─── Shared modal wrapper ─────────────────────────────────────────────────────

const ModalWrapper: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {children}
        </div>
    </div>
);

const ModalHeader: React.FC<{ icon: React.ElementType; title: string; onClose: () => void }> = ({ icon: Icon, title, onClose }) => (
    <div className="flex items-center justify-between p-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sage-50 flex items-center justify-center"><Icon className="w-4 h-4 text-sage-600" /></div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
    </div>
);

const ModalFooter: React.FC<{ onClose: () => void; onSubmit: () => void; loading: boolean; label: string }> = ({ onClose, onSubmit, loading, label }) => (
    <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
        <button onClick={onSubmit} disabled={loading}
            className="px-4 py-2 text-sm bg-sage-500 text-white rounded-lg hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {label}
        </button>
    </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
    <div>
        <label className="block text-xs text-gray-500 mb-1 font-medium">{label}{required && ' *'}</label>
        {children}
    </div>
);

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 text-sm";
const selectCls = `${inputCls} bg-white`;

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

export const ModalCreatePL: React.FC<ModalCreatePLProps> = ({ editingPL, plForm, setPlForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={editingPL ? Edit : Plus} title={editingPL ? 'Modifier le tarif' : 'Nouveau tarif'} onClose={onClose} />
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Code" required>
                    <input type="text" value={plForm.code || ''} onChange={e => setPlForm((prev: any) => ({ ...prev, code: e.target.value }))} className={`${inputCls} font-mono`} placeholder="TARIF01" />
                </Field>
                <Field label="Rang" required>
                    <input type="number" value={plForm.rank || ''} onChange={e => setPlForm((prev: any) => ({ ...prev, rank: parseInt(e.target.value) || 0 }))} className={inputCls} min="1" />
                </Field>
            </div>
            <Field label="Nom" required>
                <input type="text" value={plForm.name || ''} onChange={e => setPlForm((prev: any) => ({ ...prev, name: e.target.value }))} className={inputCls} placeholder="Tarif standard" />
            </Field>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label={editingPL ? 'Enregistrer' : 'Créer'} />
    </ModalWrapper>
);

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

export const ModalCreateLine: React.FC<ModalCreateLineProps> = ({ lineForm, setLineForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={Plus} title="Nouvelle ligne (version)" onClose={onClose} />
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Field label="N° de ligne" required>
                    <input type="number" value={lineForm.line_number || ''} onChange={e => setLineForm((prev: any) => ({ ...prev, line_number: parseInt(e.target.value) || 0 }))} className={inputCls} min="1" />
                </Field>
                <Field label="Statut">
                    <select value={lineForm.closed ? 'closed' : 'open'} onChange={e => setLineForm((prev: any) => ({ ...prev, closed: e.target.value === 'closed' }))} className={selectCls}>
                        <option value="open">Ouverte</option>
                        <option value="closed">Fermée</option>
                    </select>
                </Field>
            </div>
            <Field label="Nom" required>
                <input type="text" value={lineForm.name || ''} onChange={e => setLineForm((prev: any) => ({ ...prev, name: e.target.value }))} className={inputCls} placeholder="Version Février 2026" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Date début" required>
                    <input type="date" value={lineForm.start_date || ''} onChange={e => setLineForm((prev: any) => ({ ...prev, start_date: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Date fin" required>
                    <input type="date" value={lineForm.end_date || ''} onChange={e => setLineForm((prev: any) => ({ ...prev, end_date: e.target.value }))} className={inputCls} />
                </Field>
            </div>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Créer la ligne" />
    </ModalWrapper>
);

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

export const ModalDuplicateLine: React.FC<ModalDuplicateLineProps> = ({ dupForm, setDupForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={Copy} title="Dupliquer une ligne" onClose={onClose} />
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Field label="Ligne source" required>
                    <input type="number" value={dupForm.source_line_number || ''} onChange={e => setDupForm((prev: any) => ({ ...prev, source_line_number: parseInt(e.target.value) || 0 }))} className={inputCls} min="1" />
                </Field>
                <Field label="Ligne cible" required>
                    <input type="number" value={dupForm.new_line_number || ''} onChange={e => setDupForm((prev: any) => ({ ...prev, new_line_number: parseInt(e.target.value) || 0 }))} className={inputCls} min="1" />
                </Field>
            </div>
            <Field label="Nom" required>
                <input type="text" value={dupForm.new_name || ''} onChange={e => setDupForm((prev: any) => ({ ...prev, new_name: e.target.value }))} className={inputCls} placeholder="Copie de Version Février" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Date début" required>
                    <input type="date" value={dupForm.new_start_date || ''} onChange={e => setDupForm((prev: any) => ({ ...prev, new_start_date: e.target.value }))} className={inputCls} />
                </Field>
                <Field label="Date fin" required>
                    <input type="date" value={dupForm.new_end_date || ''} onChange={e => setDupForm((prev: any) => ({ ...prev, new_end_date: e.target.value }))} className={inputCls} />
                </Field>
            </div>
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Dupliquer" />
    </ModalWrapper>
);

// ─── Search helpers ──────────────────────────────────────────────────────────

const useProductSearch = () =>
    useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results: ProductSearchResult[] = await searchProducts(query);
        return results.map(r => ({
            id: r.id,
            label: r.name,
            sublabel: r.code,
            raw: r,
        }));
    }, []);

const usePartnerSearch = () =>
    useCallback(async (query: string): Promise<SearchSelectOption[]> => {
        const results: PartnerSearchResult[] = await searchPartners(query);
        return results.map(r => ({
            id: r.id,
            label: r.name,
            sublabel: `${r.code}${r.status ? ` · ${r.status}` : ''}`,
            raw: r,
        }));
    }, []);

// ═══════════════════════════════════════════════════════════════════════════════
// Override
// ═══════════════════════════════════════════════════════════════════════════════

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

    // Build display labels for currently selected values when editing
    const productLabel = editingOverride?.product
        ? `${editingOverride.product.name}`
        : undefined;
    const partnerLabel = editingOverride?.partner
        ? `${editingOverride.partner.name}`
        : undefined;

    // Prix effectif calculé par le moteur v5 pour le couple (partner, product) sélectionné.
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

    // Prix résultant simulé en direct : reproduit la sélection du moteur
    // (prix fixe court-circuite tout ; sinon remises sur le prix hiérarchie).
    const resultingPrice = useMemo(() => {
        if (!preview) return null;
        if (form.fixed_price != null && !Number.isNaN(form.fixed_price)) return form.fixed_price;
        let price = preview.base_price;
        if (form.discount_rate != null && form.discount_rate > 0) price = price * (1 - form.discount_rate / 100);
        if (form.discount_amount != null && form.discount_amount > 0) price = price - form.discount_amount;
        return Math.max(price, 0);
    }, [preview, form.fixed_price, form.discount_rate, form.discount_amount]);

    const parseNumber = (raw: string): number | undefined =>
        raw === '' ? undefined : Number(raw);

    const hasFixedPrice = form.fixed_price != null && !Number.isNaN(form.fixed_price);
    const rateInvalid = form.discount_rate != null && (form.discount_rate < 0 || form.discount_rate > 100);

    return (
        <ModalWrapper onClose={onClose}>
            <ModalHeader
                icon={editingOverride ? Edit : Plus}
                title={editingOverride ? t('pricing.overrides.edit') : t('pricing.overrides.create')}
                onClose={onClose}
            />
            <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-3 gap-3">
                    <Field label={t('pricing.overrides.fixedPrice')}>
                        <input
                            type="number" step="0.001" min="0"
                            value={form.fixed_price ?? ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, fixed_price: parseNumber(e.target.value) }))}
                            className={inputCls}
                            placeholder="10.500"
                        />
                    </Field>
                    <Field label={t('pricing.overrides.discountRate')}>
                        <input
                            type="number" step="0.01" min="0" max="100"
                            value={form.discount_rate ?? ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, discount_rate: parseNumber(e.target.value) }))}
                            className={`${inputCls} ${rateInvalid ? 'border-red-400 focus:ring-red-400' : ''} ${hasFixedPrice ? 'opacity-50' : ''}`}
                            disabled={hasFixedPrice}
                            placeholder="10"
                        />
                    </Field>
                    <Field label={t('pricing.overrides.discountAmount')}>
                        <input
                            type="number" step="0.01" min="0"
                            value={form.discount_amount ?? ''}
                            onChange={e => setForm((prev: any) => ({ ...prev, discount_amount: parseNumber(e.target.value) }))}
                            className={`${inputCls} ${hasFixedPrice ? 'opacity-50' : ''}`}
                            disabled={hasFixedPrice}
                        />
                    </Field>
                </div>
                <p className={`text-[11px] ${rateInvalid ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    {rateInvalid ? t('pricing.overrides.discountRateInvalid') : t('pricing.overrides.discountRateHint')}
                </p>
                {hasFixedPrice && (
                    <p className="text-[11px] text-amber-600">{t('pricing.overrides.fixedPriceHint')}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('pricing.overrides.validFrom')}>
                        <input type="date" value={form.valid_from || ''} onChange={e => setForm((prev: any) => ({ ...prev, valid_from: e.target.value }))} className={inputCls} />
                    </Field>
                    <Field label={t('pricing.overrides.validTo')}>
                        <input type="date" value={form.valid_to || ''} onChange={e => setForm((prev: any) => ({ ...prev, valid_to: e.target.value }))} className={inputCls} />
                    </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Field label={t('pricing.overrides.priority')}>
                        <input type="number" value={form.priority ?? ''} onChange={e => setForm((prev: any) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))} className={inputCls} min="0" />
                    </Field>
                    <Field label={t('common.status')}>
                        <select value={form.active ? 'active' : 'inactive'} onChange={e => setForm((prev: any) => ({ ...prev, active: e.target.value === 'active' }))} className={selectCls}>
                            <option value="active">{t('common.active')}</option>
                            <option value="inactive">{t('common.inactive')}</option>
                        </select>
                    </Field>
                </div>

                {(preview || previewLoading) && (
                    <div className="p-3 bg-gradient-to-br from-sage-50 to-white rounded-lg border border-sage-200">
                        {previewLoading ? (
                            <div className="flex items-center gap-2 text-xs text-sage-600">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {t('pricing.preview.calculating')}
                            </div>
                        ) : preview && (
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
                                <p className="text-[10px] text-gray-400 text-center mt-1.5">
                                    {t('pricing.overrides.previewHint', { source: preview.source, version: preview.algorithm_version })}
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
            <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label={editingOverride ? t('common.save') : t('common.create')} />
        </ModalWrapper>
    );
};

// ═══════════════════════════════════════════════════════════════════════════════
// Packaging Price
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalPackagingPriceProps {
    editingPackaging: PackagingPrice | null;
    form: Partial<CreatePackagingPriceRequest>;
    setForm: (f: any) => void;
    onClose: () => void;
    onSubmit: () => void;
    loading: boolean;
}

export const ModalPackagingPrice: React.FC<ModalPackagingPriceProps> = ({ editingPackaging, form, setForm, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader
            icon={DollarSign}
            title={editingPackaging ? 'Modifier le prix de conditionnement' : 'Nouveau prix de conditionnement'}
            onClose={onClose}
        />
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <Field label="ID Détail de ligne" required>
                    <input
                        type="number"
                        value={form.line_detail_id || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, line_detail_id: parseInt(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </Field>
                <Field label="ID Conditionnement" required>
                    <input
                        type="number"
                        value={form.packaging_id || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, packaging_id: parseInt(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <Field label="Prix vente" required>
                    <input
                        type="number"
                        step="0.01"
                        value={form.sales_price || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, sales_price: parseFloat(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </Field>
                <Field label="Prix retour" required>
                    <input
                        type="number"
                        step="0.01"
                        value={form.return_price || ''}
                        onChange={e => setForm((prev: any) => ({ ...prev, return_price: parseFloat(e.target.value) || 0 }))}
                        className={inputCls}
                    />
                </Field>
            </div>
        </div>
        <ModalFooter
            onClose={onClose}
            onSubmit={onSubmit}
            loading={loading}
            label={editingPackaging ? 'Enregistrer' : 'Créer'}
        />
    </ModalWrapper>
);

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

export const ModalImport: React.FC<ModalImportProps> = ({ importFile: _unusedImportFile, setImportFile, importParams, setImportParams, onClose, onSubmit, loading }) => (
    <ModalWrapper onClose={onClose}>
        <ModalHeader icon={Upload} title="Import CSV" onClose={onClose} />
        <div className="p-4 space-y-4">
            <Field label="Fichier CSV" required>
                <input type="file" accept=".csv" onChange={e => setImportFile(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sage-50 file:text-sage-700 hover:file:bg-sage-100" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
                <Field label="Mode">
                    <select value={importParams.mode} onChange={e => setImportParams({ ...importParams, mode: e.target.value as any })} className={selectCls}>
                        <option value="merge">Fusionner</option>
                        <option value="replace">Remplacer</option>
                    </select>
                </Field>
                <Field label="En-tête">
                    <select value={importParams.has_header ? 'yes' : 'no'} onChange={e => setImportParams({ ...importParams, has_header: e.target.value === 'yes' })} className={selectCls}>
                        <option value="yes">Oui</option>
                        <option value="no">Non</option>
                    </select>
                </Field>
                <Field label="Identifiant">
                    <select value={importParams.product_identifier} onChange={e => setImportParams({ ...importParams, product_identifier: e.target.value as any })} className={selectCls}>
                        <option value="code">Code</option>
                        <option value="id">ID</option>
                    </select>
                </Field>
            </div>
            {importParams.mode === 'replace' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700"><strong>Attention:</strong> Le mode « Remplacer » supprimera tous les détails existants de cette ligne avant l'import.</p>
                </div>
            )}
        </div>
        <ModalFooter onClose={onClose} onSubmit={onSubmit} loading={loading} label="Importer" />
    </ModalWrapper>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Delete Confirmation
// ═══════════════════════════════════════════════════════════════════════════════

interface ModalDeleteConfirmProps {
    selected: PriceList;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}

export const ModalDeleteConfirm: React.FC<ModalDeleteConfirmProps> = ({ selected, onClose, onConfirm, loading }) => (
    <ModalWrapper onClose={onClose}>
        <div className="p-5 pb-3 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-100 to-red-200 flex items-center justify-center mb-3 shadow-sm">
                <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Supprimer le tarif</h2>
            <p className="text-sm text-gray-500 mt-1">Êtes-vous sûr de vouloir supprimer ce tarif ?</p>
        </div>
        <div className="mx-5 p-3 bg-slate-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-semibold text-gray-900">{selected.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5 font-mono">{selected.code}</div>
                </div>
                <div className="text-right">
                    <div className="text-xs text-gray-500">Rang</div>
                    <div className="text-lg font-bold text-gray-900">{selected.rank}</div>
                </div>
            </div>
        </div>
        <div className="mx-5 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">Cette action est irréversible. Toutes les lignes et détails associés seront également supprimés.</p>
        </div>
        <div className="flex items-center justify-end gap-2 p-5 pt-4">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">Annuler</button>
            <button onClick={onConfirm} disabled={loading}
                className="px-5 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium flex items-center gap-2 shadow-sm">
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
            </button>
        </div>
    </ModalWrapper>
);
