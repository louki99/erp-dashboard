import React, { useEffect, useState, useCallback } from 'react';
import {
    Loader2, Save, X, ArrowLeft, Plus, Edit2,
    Building2, Phone, Mail, MapPin, CreditCard, DollarSign,
    FileText, Globe, Tag, User,
} from 'lucide-react';
import toast from 'react-hot-toast';

import type {
    Partner,
    PartnerStatus,
    CreatePartnerRequest,
    PartnerCreateFormResponse,
} from '@/types/partner.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PartnerStatus; label: string; color: string }[] = [
    { value: 'ACTIVE', label: 'Actif', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { value: 'ON_HOLD', label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { value: 'BLOCKED', label: 'Bloqué', color: 'bg-red-50 text-red-700 border-red-200' },
    { value: 'CLOSED', label: 'Fermé', color: 'bg-gray-100 text-gray-600 border-gray-200' },
];

const TYPE_OPTIONS = [
    { value: 'CUSTOMER', label: 'Client' },
    { value: 'SUPPLIER', label: 'Fournisseur' },
    { value: 'BOTH', label: 'Client & Fournisseur' },
    { value: 'B2B', label: 'B2B' },
    { value: 'CASH', label: 'Cash' },
];

const CHANNEL_OPTIONS = [
    { value: 'DIRECT', label: 'Direct' },
    { value: 'POS', label: 'Point de vente' },
    { value: 'ECOMMERCE', label: 'E-commerce' },
    { value: 'B2B', label: 'B2B' },
    { value: 'RETAIL', label: 'Retail' },
    { value: 'OTHER', label: 'Autre' },
];

// ─── Field Components ────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors bg-white placeholder:text-gray-300';
const selectCls = `${inputCls} bg-white`;
const labelCls = 'block text-[11px] text-gray-500 font-medium mb-1 uppercase tracking-wider';

const FormField: React.FC<{
    label: string;
    required?: boolean;
    children: React.ReactNode;
    className?: string;
    hint?: string;
}> = ({ label, required, children, className, hint }) => (
    <div className={className}>
        <label className={labelCls}>
            {label}
            {required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
);

// ─── Section Card ────────────────────────────────────────────────────────────

const FormSection: React.FC<{
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    iconColor?: string;
}> = ({ icon: Icon, title, children, iconColor = 'text-gray-400 bg-gray-50' }) => (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className="px-4 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center gap-2">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${iconColor}`}>
                <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</span>
        </div>
        <div className="p-4">
            {children}
        </div>
    </div>
);

// ─── Main Component ──────────────────────────────────────────────────────────

export interface PartnerFormPanelProps {
    mode: 'create' | 'edit';
    partner?: Partner | null;
    formMeta: PartnerCreateFormResponse | null;
    formMetaLoading: boolean;
    onSave: (data: Partial<CreatePartnerRequest>) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

export const PartnerFormPanel: React.FC<PartnerFormPanelProps> = ({
    mode,
    partner,
    formMeta,
    formMetaLoading,
    onSave,
    onCancel,
    saving,
}) => {
    const isEditing = mode === 'edit';

    // ── Form State ───────────────────────────────────────────────────────────
    const [form, setForm] = useState<Partial<CreatePartnerRequest>>({});
    const [touched, setTouched] = useState(false);

    // Initialize form with partner data when editing
    useEffect(() => {
        if (isEditing && partner) {
            setForm({
                code: partner.code,
                name: partner.name,
                email: partner.email || '',
                phone: partner.phone || '',
                whatsapp: partner.whatsapp || '',
                status: partner.status,
                partner_type: partner.partner_type,
                channel: partner.channel,
                price_list_id: partner.price_list_id || undefined,
                payment_term_id: partner.payment_term_id || undefined,
                credit_limit: typeof partner.credit_limit === 'string' ? parseFloat(partner.credit_limit) : partner.credit_limit,
                address_line1: partner.address_line1 || '',
                address_line2: partner.address_line2 || '',
                city: partner.city || '',
                region: partner.region || '',
                country: partner.country || '',
                postal_code: partner.postal_code || '',
                tax_number_ice: partner.tax_number_ice || '',
                tax_number_if: partner.tax_number_if || '',
                tax_exempt: partner.tax_exempt || false,
                default_discount_rate: typeof partner.default_discount_rate === 'string' ? parseFloat(partner.default_discount_rate as any) : partner.default_discount_rate,
                default_discount_amount: typeof partner.default_discount_amount === 'string' ? parseFloat(partner.default_discount_amount as any) : partner.default_discount_amount,
                max_discount_rate: typeof partner.max_discount_rate === 'string' ? parseFloat(partner.max_discount_rate as any) : partner.max_discount_rate,
                opening_hours: partner.opening_hours && partner.opening_hours !== '{}' ? partner.opening_hours : '',
                delivery_instructions: partner.delivery_instructions || '',
                min_order_amount: typeof partner.min_order_amount === 'string' ? parseFloat(partner.min_order_amount as any) : (partner.min_order_amount || undefined),
                delivery_zone: partner.delivery_zone || '',
                geo_area_code: partner.geo_area_code || '',
            });
        } else {
            setForm({
                status: 'ACTIVE',
                partner_type: 'CUSTOMER',
                channel: 'DIRECT',
                credit_limit: 0,
                default_discount_rate: 0,
                tax_exempt: false,
            });
        }
        setTouched(false);
    }, [isEditing, partner]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const updateField = useCallback((field: string, value: any) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (!touched) setTouched(true);
    }, [touched]);

    const handleSubmit = async () => {
        if (!form.name?.trim()) {
            toast.error('Le nom du partenaire est obligatoire');
            return;
        }
        await onSave(form);
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
            {/* ── Header ────────────────────────────────────────── */}
            <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0 bg-white">
                <div className="flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                            onClick={onCancel}
                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0"
                            title="Retour"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-600" />
                        </button>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 ${isEditing ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
                            {isEditing
                                ? (partner?.name?.charAt(0)?.toUpperCase() || 'P')
                                : <Plus className="w-5 h-5" />
                            }
                        </div>
                        <div className="min-w-0 flex-1">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                                {isEditing ? `Modifier ${partner?.name || ''}` : 'Nouveau partenaire'}
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {isEditing ? `Code: ${partner?.code}` : 'Remplissez les informations du partenaire'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onCancel}
                            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center gap-1.5"
                        >
                            <X className="w-4 h-4" />
                            Annuler
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={saving || !form.name?.trim()}
                            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            {isEditing ? 'Enregistrer' : 'Créer le partenaire'}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Loading state ──────────────────────────────── */}
            {formMetaLoading ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" />
                    <span className="text-sm">Chargement du formulaire...</span>
                </div>
            ) : (
                /* ── Scrollable Form Content ──────────────────── */
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 scroll-smooth bg-slate-50">

                    {/* ── Identity Section ─────────────────────── */}
                    <FormSection icon={FileText} title="Identité" iconColor="text-blue-500 bg-blue-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <FormField label="Code" hint="Laissez vide pour auto-générer">
                                <input
                                    type="text"
                                    value={form.code || ''}
                                    onChange={e => updateField('code', e.target.value)}
                                    className={`${inputCls} font-mono`}
                                    placeholder="Auto-généré"
                                />
                            </FormField>
                            <FormField label="Nom" required>
                                <input
                                    type="text"
                                    value={form.name || ''}
                                    onChange={e => updateField('name', e.target.value)}
                                    className={inputCls}
                                    placeholder="Nom du partenaire"
                                />
                            </FormField>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FormField label="Statut">
                                <div className="flex flex-wrap gap-1.5">
                                    {STATUS_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => updateField('status', opt.value)}
                                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                                                form.status === opt.value
                                                    ? `${opt.color} ring-2 ring-offset-1 ring-blue-300`
                                                    : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </FormField>
                            <FormField label="Type">
                                <select
                                    value={form.partner_type || 'CUSTOMER'}
                                    onChange={e => updateField('partner_type', e.target.value)}
                                    className={selectCls}
                                >
                                    {TYPE_OPTIONS.map(t => (
                                        <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Canal">
                                <select
                                    value={form.channel || 'DIRECT'}
                                    onChange={e => updateField('channel', e.target.value)}
                                    className={selectCls}
                                >
                                    {CHANNEL_OPTIONS.map(c => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                    </FormSection>

                    {/* ── Contact Section ──────────────────────── */}
                    <FormSection icon={Phone} title="Contact" iconColor="text-green-500 bg-green-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <FormField label="Email">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="email"
                                        value={form.email || ''}
                                        onChange={e => updateField('email', e.target.value)}
                                        className={`${inputCls} pl-10`}
                                        placeholder="email@example.com"
                                    />
                                </div>
                            </FormField>
                            <FormField label="Téléphone">
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={form.phone || ''}
                                        onChange={e => updateField('phone', e.target.value)}
                                        className={`${inputCls} pl-10`}
                                        placeholder="+212 6xx xxx xxx"
                                    />
                                </div>
                            </FormField>
                            <FormField label="WhatsApp">
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={form.whatsapp || ''}
                                        onChange={e => updateField('whatsapp', e.target.value)}
                                        className={`${inputCls} pl-10`}
                                        placeholder="+212 6xx xxx xxx"
                                    />
                                </div>
                            </FormField>
                        </div>
                    </FormSection>

                    {/* ── Address Section ──────────────────────── */}
                    <FormSection icon={MapPin} title="Adresse" iconColor="text-orange-500 bg-orange-50">
                        <div className="space-y-3">
                            <FormField label="Adresse ligne 1">
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="text"
                                        value={form.address_line1 || ''}
                                        onChange={e => updateField('address_line1', e.target.value)}
                                        className={`${inputCls} pl-10`}
                                        placeholder="123 Rue Mohammed V"
                                    />
                                </div>
                            </FormField>
                            <FormField label="Adresse ligne 2">
                                <input
                                    type="text"
                                    value={form.address_line2 || ''}
                                    onChange={e => updateField('address_line2', e.target.value)}
                                    className={inputCls}
                                    placeholder="Appartement, étage, etc."
                                />
                            </FormField>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <FormField label="Ville">
                                    {formMeta?.villes && formMeta.villes.length > 0 ? (
                                        <select
                                            value={form.city || ''}
                                            onChange={e => updateField('city', e.target.value)}
                                            className={selectCls}
                                        >
                                            <option value="">-- Sélectionner --</option>
                                            {formMeta.villes.map(v => (
                                                <option key={v.id} value={v.ville}>{v.ville}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={form.city || ''}
                                            onChange={e => updateField('city', e.target.value)}
                                            className={inputCls}
                                            placeholder="Casablanca"
                                        />
                                    )}
                                </FormField>
                                <FormField label="Région">
                                    {formMeta?.regions && formMeta.regions.length > 0 ? (
                                        <select
                                            value={form.region || ''}
                                            onChange={e => updateField('region', e.target.value)}
                                            className={selectCls}
                                        >
                                            <option value="">-- Sélectionner --</option>
                                            {formMeta.regions.map(r => (
                                                <option key={r.id} value={r.region}>{r.region}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={form.region || ''}
                                            onChange={e => updateField('region', e.target.value)}
                                            className={inputCls}
                                            placeholder="Grand Casablanca"
                                        />
                                    )}
                                </FormField>
                                <FormField label="Code postal">
                                    <input
                                        type="text"
                                        value={form.postal_code || ''}
                                        onChange={e => updateField('postal_code', e.target.value)}
                                        className={inputCls}
                                        placeholder="20000"
                                    />
                                </FormField>
                                <FormField label="Pays">
                                    <input
                                        type="text"
                                        value={form.country || ''}
                                        onChange={e => updateField('country', e.target.value)}
                                        className={inputCls}
                                        placeholder="Maroc"
                                    />
                                </FormField>
                            </div>
                            {formMeta?.geoAreas && formMeta.geoAreas.length > 0 && (
                                <FormField label="Zone géographique">
                                    <select
                                        value={form.geo_area_code || ''}
                                        onChange={e => updateField('geo_area_code', e.target.value)}
                                        className={selectCls}
                                    >
                                        <option value="">-- Aucune --</option>
                                        {formMeta.geoAreas.map(g => (
                                            <option key={g.id} value={g.code}>{g.code} - {g.name}</option>
                                        ))}
                                    </select>
                                </FormField>
                            )}
                        </div>
                    </FormSection>

                    {/* ── Commercial Section ───────────────────── */}
                    <FormSection icon={DollarSign} title="Commercial" iconColor="text-indigo-500 bg-indigo-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <FormField label="Liste de prix">
                                <select
                                    value={form.price_list_id || ''}
                                    onChange={e => updateField('price_list_id', Number(e.target.value) || undefined)}
                                    className={selectCls}
                                >
                                    <option value="">-- Aucune --</option>
                                    {(formMeta?.priceLists || []).map(pl => (
                                        <option key={pl.id} value={pl.id}>{pl.code} - {pl.name}</option>
                                    ))}
                                </select>
                            </FormField>
                            <FormField label="Condition de paiement">
                                <select
                                    value={form.payment_term_id || ''}
                                    onChange={e => updateField('payment_term_id', Number(e.target.value) || undefined)}
                                    className={selectCls}
                                >
                                    <option value="">-- Aucune --</option>
                                    {(formMeta?.paymentTerms || []).map(pt => (
                                        <option key={pt.id} value={pt.id}>{pt.name}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <FormField label="Limite de crédit">
                                <div className="relative">
                                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        value={form.credit_limit ?? ''}
                                        onChange={e => updateField('credit_limit', Number(e.target.value))}
                                        className={`${inputCls} pl-10`}
                                        min={0}
                                        placeholder="0.00"
                                    />
                                </div>
                            </FormField>
                            <FormField label="Remise par défaut (%)">
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        value={form.default_discount_rate ?? ''}
                                        onChange={e => updateField('default_discount_rate', Number(e.target.value))}
                                        className={`${inputCls} pl-10`}
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        placeholder="0"
                                    />
                                </div>
                            </FormField>
                            <FormField label="Remise max (%)">
                                <div className="relative">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        value={form.max_discount_rate ?? ''}
                                        onChange={e => updateField('max_discount_rate', Number(e.target.value))}
                                        className={`${inputCls} pl-10`}
                                        min={0}
                                        max={100}
                                        step={0.01}
                                        placeholder="0"
                                    />
                                </div>
                            </FormField>
                        </div>
                    </FormSection>

                    {/* ── Tax Section ──────────────────────────── */}
                    <FormSection icon={FileText} title="Fiscalité" iconColor="text-purple-500 bg-purple-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <FormField label="ICE" hint="Identifiant Commun de l'Entreprise">
                                <input
                                    type="text"
                                    value={form.tax_number_ice || ''}
                                    onChange={e => updateField('tax_number_ice', e.target.value)}
                                    className={`${inputCls} font-mono`}
                                    placeholder="001234567000089"
                                />
                            </FormField>
                            <FormField label="IF" hint="Identifiant Fiscal">
                                <input
                                    type="text"
                                    value={form.tax_number_if || ''}
                                    onChange={e => updateField('tax_number_if', e.target.value)}
                                    className={`${inputCls} font-mono`}
                                    placeholder="12345678"
                                />
                            </FormField>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="relative flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.tax_exempt || false}
                                    onChange={e => updateField('tax_exempt', e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                            </label>
                            <span className="text-sm text-gray-700">Exonéré de TVA</span>
                        </div>
                    </FormSection>

                    {/* ── Operations Section ───────────────────── */}
                    <FormSection icon={Globe} title="Opérations & Livraison" iconColor="text-teal-500 bg-teal-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <FormField label="Zone de livraison">
                                <input
                                    type="text"
                                    value={form.delivery_zone || ''}
                                    onChange={e => updateField('delivery_zone', e.target.value)}
                                    className={inputCls}
                                    placeholder="Zone A, Zone B..."
                                />
                            </FormField>
                            <FormField label="Commande minimum">
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input
                                        type="number"
                                        value={form.min_order_amount ?? ''}
                                        onChange={e => updateField('min_order_amount', Number(e.target.value))}
                                        className={`${inputCls} pl-10`}
                                        min={0}
                                        placeholder="0.00"
                                    />
                                </div>
                            </FormField>
                        </div>
                        <FormField label="Instructions de livraison">
                            <textarea
                                value={form.delivery_instructions || ''}
                                onChange={e => updateField('delivery_instructions', e.target.value)}
                                className={`${inputCls} min-h-[70px] resize-y`}
                                placeholder="Instructions spéciales pour la livraison..."
                            />
                        </FormField>
                    </FormSection>

                    {/* ── Custom Fields Section ────────────────── */}
                    {formMeta?.custom_fields && formMeta.custom_fields.length > 0 && (
                        <FormSection icon={Tag} title="Champs personnalisés" iconColor="text-violet-500 bg-violet-50">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {formMeta.custom_fields.map((cf: any) => (
                                    <FormField
                                        key={cf.field_name || cf.id}
                                        label={cf.field_label || cf.label || cf.field_name}
                                        required={cf.is_required}
                                        hint={cf.help_text}
                                    >
                                        {cf.field_type === 'select' && cf.options ? (
                                            <select
                                                value={form.custom_fields?.[cf.field_name] || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    custom_fields: { ...(prev.custom_fields || {}), [cf.field_name]: e.target.value },
                                                }))}
                                                className={selectCls}
                                            >
                                                <option value="">-- Sélectionner --</option>
                                                {(Array.isArray(cf.options) ? cf.options : []).map((opt: any) => (
                                                    <option key={opt.value || opt} value={opt.value || opt}>
                                                        {opt.label || opt}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : cf.field_type === 'textarea' ? (
                                            <textarea
                                                value={form.custom_fields?.[cf.field_name] || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    custom_fields: { ...(prev.custom_fields || {}), [cf.field_name]: e.target.value },
                                                }))}
                                                className={`${inputCls} min-h-[60px] resize-y`}
                                                placeholder={cf.placeholder || ''}
                                            />
                                        ) : cf.field_type === 'number' ? (
                                            <input
                                                type="number"
                                                value={form.custom_fields?.[cf.field_name] || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    custom_fields: { ...(prev.custom_fields || {}), [cf.field_name]: e.target.value },
                                                }))}
                                                className={inputCls}
                                                placeholder={cf.placeholder || ''}
                                            />
                                        ) : (
                                            <input
                                                type="text"
                                                value={form.custom_fields?.[cf.field_name] || ''}
                                                onChange={e => setForm(prev => ({
                                                    ...prev,
                                                    custom_fields: { ...(prev.custom_fields || {}), [cf.field_name]: e.target.value },
                                                }))}
                                                className={inputCls}
                                                placeholder={cf.placeholder || ''}
                                            />
                                        )}
                                    </FormField>
                                ))}
                            </div>
                        </FormSection>
                    )}

                    {/* ── Bottom Save Bar ──────────────────────── */}
                    <div className="sticky bottom-0 -mx-3 sm:-mx-4 px-3 sm:px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-gray-200 flex items-center justify-between">
                        <div className="text-xs text-gray-400">
                            {touched && <span className="text-amber-500 font-medium">Modifications non enregistrées</span>}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving || !form.name?.trim()}
                                className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isEditing ? 'Enregistrer les modifications' : 'Créer le partenaire'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
