import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    Loader2, Save, X, ArrowLeft, Plus, Eye, EyeOff,
    Phone, Mail, MapPin, CreditCard, DollarSign,
    FileText, Tag, User, Lock, AlertCircle, CheckCircle2,
    Briefcase, Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import SearchableSelect, { FieldError, type SelectOption } from '@/components/common/SearchableSelect';
import DynamicGeoSelector from '@/components/common/DynamicGeoSelector';

import type { GeoSelectionStep } from '@/types/geoHierarchy.types';
import type {
    Partner,
    PartnerStatus,
    CreatePartnerRequest,
    PartnerMasterData,
    AuthFormData,
    CreatePartnerFullPayload,
    PartnerSavePayload,
} from '@/types/partner.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: PartnerStatus; label: string; dot: string }[] = [
    { value: 'ACTIVE', label: 'Actif', dot: 'bg-emerald-500' },
    { value: 'ON_HOLD', label: 'En attente', dot: 'bg-amber-500' },
    { value: 'BLOCKED', label: 'Bloqué', dot: 'bg-red-500' },
    { value: 'CLOSED', label: 'Fermé', dot: 'bg-gray-400' },
];

const STATUS_STYLES: Record<PartnerStatus, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    ON_HOLD: 'bg-amber-50 text-amber-700 border-amber-200',
    BLOCKED: 'bg-red-50 text-red-700 border-red-200',
    CLOSED: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_OPTIONS = [
    { value: 'CUSTOMER', label: 'Client' },
    { value: 'SUPPLIER', label: 'Fournisseur' },
    { value: 'BOTH', label: 'Client & Fournisseur' },
    { value: 'B2B', label: 'B2B' },
    { value: 'CASH', label: 'Cash (Comptoir)' },
];

const CHANNEL_OPTIONS = [
    { value: 'DIRECT', label: 'Direct' },
    { value: 'POS', label: 'Point de vente' },
    { value: 'RETAIL', label: 'Retail' },
    { value: 'B2B', label: 'B2B' },
    { value: 'ECOMMERCE', label: 'E-commerce' },
    { value: 'OTHER', label: 'Autre' },
];

const GENDER_OPTIONS = [
    { value: 'male', label: 'Homme' },
    { value: 'female', label: 'Femme' },
];

const TARGET_APP_OPTIONS = [
    { value: 'B2B', label: 'Application B2B (Partenaire)' },
    { value: 'ERP', label: 'ERP (Backoffice)' },
];

// ─── Geo-area type code constants ─────────────────────────────────────────────
// Used ONLY to map the DynamicGeoSelector selection path back to the partner's
// flat text fields (partner.region, partner.city).  The DynamicGeoSelector
// itself is fully dynamic and does not use these values internally.
const GEO_TYPE_REGION = '200'; // Région  → mapped to partner.region
const GEO_TYPE_VILLE  = '400'; // Ville   → mapped to partner.city

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors bg-white placeholder:text-gray-300';
const inputErrCls = 'w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400 transition-colors bg-red-50/40 placeholder:text-gray-300';
const labelCls = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest';

// ─── Flag helper ─────────────────────────────────────────────────────────────

const flagEmoji = (code: string): string =>
    [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1F1E6)).join('');

// ─── Sub-components ──────────────────────────────────────────────────────────

const FormField: React.FC<{
    label: string; required?: boolean; children: React.ReactNode;
    className?: string; hint?: string; error?: string;
}> = ({ label, required, children, className, hint, error }) => (
    <div className={className}>
        <label className={labelCls}>
            {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        </label>
        {children}
        {hint && !error && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
        <FieldError msg={error} />
    </div>
);

const SectionCard: React.FC<{
    icon: React.ElementType; title: string; subtitle?: string;
    children: React.ReactNode; color?: string;
}> = ({ icon: Icon, title, subtitle, children, color = 'text-gray-500 bg-gray-100' }) => (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div>
                <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">{title}</p>
                {subtitle && <p className="text-[10px] text-gray-400">{subtitle}</p>}
            </div>
        </div>
        <div className="p-4">{children}</div>
    </div>
);

// ─── Props & Exports ─────────────────────────────────────────────────────────

export interface PartnerFormPanelProps {
    mode: 'create' | 'edit';
    partner?: Partner | null;
    masterData: PartnerMasterData | null;
    masterDataLoading: boolean;
    onSave: (payload: PartnerSavePayload) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
}

// ─── Default state ───────────────────────────────────────────────────────────

const initAuth = (): Partial<AuthFormData> => ({
    phone_code: '+212', gender: '', is_active: true, target_app: 'B2B',
});

const initPartner = (): Partial<CreatePartnerFullPayload['partner']> => ({
    partner_type: 'CUSTOMER', channel: 'DIRECT', status: 'ACTIVE',
    credit_limit: 0, default_discount_rate: 0, tax_exempt: false, country: 'MA',
});

// ─── Tab error mapping ────────────────────────────────────────────────────────

const tabForError = (key: string, isCreate: boolean): string => {
    if (key.startsWith('auth.')) return isCreate ? 'account' : 'identity';
    if (['partner.name', 'partner.code', 'partner.status', 'partner.partner_type', 'partner.channel'].some(k => key.startsWith(k))) return 'identity';
    if (['partner.price_list', 'partner.payment_term', 'partner.credit', 'partner.discount'].some(k => key.startsWith(k))) return 'commercial';
    if (['partner.address', 'partner.city', 'partner.region', 'partner.country', 'partner.postal', 'partner.geo_area', 'partner.phone', 'partner.email'].some(k => key.startsWith(k))) return 'address';
    if (['partner.tax'].some(k => key.startsWith(k))) return 'fiscal';
    if (['partner.delivery', 'partner.min_order'].some(k => key.startsWith(k))) return 'delivery';
    if (key.startsWith('custom_fields.')) return 'custom';
    return 'identity';
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PartnerFormPanel: React.FC<PartnerFormPanelProps> = ({
    mode, partner, masterData, masterDataLoading, onSave, onCancel, saving,
}) => {
    const isCreate = mode === 'create';

    const [activeTab, setActiveTab] = useState(isCreate ? 'account' : 'identity');
    const [auth, setAuth] = useState<Partial<AuthFormData>>(initAuth);
    const [pForm, setPForm] = useState<Partial<CreatePartnerFullPayload['partner']>>(initPartner);
    const [cfForm, setCfForm] = useState<Record<string, string>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [touched, setTouched] = useState(false);
    const [showPwd, setShowPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);

    // Reset on mode change
    useEffect(() => {
        setErrors({});
        setTouched(false);
        setActiveTab(mode === 'create' ? 'account' : 'identity');
        if (mode === 'edit' && partner) {
            setPForm({
                name: partner.name,
                code: partner.code,
                email: partner.email || '',
                phone: partner.phone || '',
                status: partner.status,
                partner_type: partner.partner_type,
                channel: partner.channel,
                price_list_id: partner.price_list_id ?? undefined,
                payment_term_id: partner.payment_term_id ?? undefined,
                credit_limit: parseFloat(String(partner.credit_limit)) || 0,
                default_discount_rate: parseFloat(String(partner.default_discount_rate)) || 0,
                address_line1: partner.address_line1 || '',
                address_line2: partner.address_line2 || '',
                city: partner.city || '',
                region: partner.region || '',
                country: partner.country || 'MA',
                postal_code: partner.postal_code || '',
                tax_number_ice: partner.tax_number_ice || '',
                tax_number_if: partner.tax_number_if || '',
                tax_exempt: partner.tax_exempt || false,
                geo_area_code: partner.geo_area_code || '',
                delivery_zone: partner.delivery_zone || '',
                delivery_instructions: partner.delivery_instructions || '',
                min_order_amount: parseFloat(String(partner.min_order_amount)) || undefined,
            });
        } else {
            setAuth(initAuth());
            setPForm(initPartner());
            setCfForm({});
        }
    }, [mode, partner]);

    // ── Options (memoized) ────────────────────────────────────────────────────

    const priceListOptions = useMemo<SelectOption[]>(() =>
        (masterData?.price_lists ?? []).map(p => ({ value: p.id, label: p.name, badge: p.code })),
        [masterData?.price_lists]
    );

    const paymentTermOptions = useMemo<SelectOption[]>(() =>
        (masterData?.payment_terms ?? []).map(pt => ({
            value: pt.id,
            label: pt.name,
            sublabel: pt.is_cash ? 'Espèces' : pt.is_bank_transfer ? 'Virement' : pt.is_credit ? 'Crédit' : '',
            badge: pt.code,
        })),
        [masterData?.payment_terms]
    );

    const branchOptions = useMemo<SelectOption[]>(() =>
        (masterData?.branches ?? []).map(b => ({ value: b.code, label: b.name, badge: b.code })),
        [masterData?.branches]
    );

    // Used in the Account tab (user geo_area_code, not partner geo_area_code)
    const geoAreaOptions = useMemo<SelectOption[]>(() =>
        (masterData?.geo_areas ?? []).map(a => ({
            value: a.code,
            label: a.name,
            sublabel: a.geo_area_type.name,
            badge: a.code,
        })),
        [masterData?.geo_areas]
    );

    const countryOptions = useMemo<SelectOption[]>(() =>
        (masterData?.countries ?? []).map(c => ({
            value: c.code,
            label: `${flagEmoji(c.code)} ${c.name}`,
            sublabel: c.dial_code,
            badge: c.code,
        })),
        [masterData?.countries]
    );

    // ── Field helpers ─────────────────────────────────────────────────────────

    const ua = useCallback((field: keyof AuthFormData, val: any) => {
        setAuth(p => ({ ...p, [field]: val }));
        setErrors(p => { const n = { ...p }; delete n[`auth.${field}`]; return n; });
        if (!touched) setTouched(true);
    }, [touched]);

    const up = useCallback((field: string, val: any) => {
        setPForm(p => ({ ...p, [field]: val }));
        setErrors(p => { const n = { ...p }; delete n[`partner.${field}`]; return n; });
        if (!touched) setTouched(true);
    }, [touched]);

    const ucf = useCallback((field: string, val: string) => {
        setCfForm(p => ({ ...p, [field]: val }));
        setErrors(p => { const n = { ...p }; delete n[`custom_fields.${field}`]; return n; });
        if (!touched) setTouched(true);
    }, [touched]);

    /**
     * handleGeoChange
     * ───────────────
     * Called by DynamicGeoSelector whenever the leaf selection changes.
     *
     * • Updates geo_area_code (the leaf node code, sent to the API).
     * • Auto-populates the partner's readable address fields (region, city)
     *   by finding the matching step in the breadcrumb path.
     *   GEO_TYPE_REGION / GEO_TYPE_VILLE constants map hierarchy levels to
     *   the partner flat-text fields — this mapping is business logic that
     *   belongs here, NOT inside the generic DynamicGeoSelector.
     */
    const handleGeoChange = useCallback((leafCode: string, path: GeoSelectionStep[]) => {
        up('geo_area_code', leafCode || undefined);
        if (leafCode) {
            const regionStep = path.find(s => s.typeCode === GEO_TYPE_REGION);
            const villeStep  = path.find(s => s.typeCode === GEO_TYPE_VILLE);
            if (regionStep) up('region', regionStep.areaName);
            if (villeStep)  up('city',   villeStep.areaName);
        }
    }, [up]);

    // ── Tab config ────────────────────────────────────────────────────────────

    const allTabs = useMemo<TabItem[]>(() => {
        const tabs: TabItem[] = [];
        if (isCreate) tabs.push({ id: 'account', label: 'Compte', icon: User });
        tabs.push(
            { id: 'identity', label: 'Identité', icon: Briefcase },
            { id: 'commercial', label: 'Commercial', icon: DollarSign },
            { id: 'address', label: 'Adresse & Contact', icon: MapPin },
            { id: 'fiscal', label: 'Fiscalité', icon: FileText },
            { id: 'delivery', label: 'Livraison', icon: Truck },
        );
        if ((masterData?.custom_fields ?? []).length > 0) {
            tabs.push({ id: 'custom', label: 'Champs perso.', icon: Tag });
        }
        return tabs;
    }, [isCreate, masterData?.custom_fields]);

    const tabsWithErrors = useMemo(() => {
        const set = new Set<string>();
        Object.keys(errors).forEach(k => set.add(tabForError(k, isCreate)));
        return set;
    }, [errors, isCreate]);

    const handleTabChange = (id: string) => {
        if (id === 'home') setActiveTab(isCreate ? 'account' : 'identity');
        else setActiveTab(id);
    };

    // ── Validation ────────────────────────────────────────────────────────────

    const validate = useCallback((): boolean => {
        const errs: Record<string, string> = {};
        if (isCreate) {
            if (!auth.name?.trim()) errs['auth.name'] = 'Le prénom est obligatoire';
            if (!auth.email?.trim()) errs['auth.email'] = "L'email est obligatoire";
            else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(auth.email)) errs['auth.email'] = 'Format email invalide';
            if (!auth.password?.trim()) errs['auth.password'] = 'Le mot de passe est obligatoire';
            else if (auth.password.length < 8) errs['auth.password'] = 'Minimum 8 caractères requis';
            if (auth.password !== auth.confirm_password) errs['auth.confirm_password'] = 'Les mots de passe ne correspondent pas';
            if (!auth.phone?.trim()) errs['auth.phone'] = 'Le téléphone est obligatoire';
        }
        if (!pForm.name?.trim()) errs['partner.name'] = 'Le nom du partenaire est obligatoire';
        for (const cf of masterData?.custom_fields ?? []) {
            if (cf.is_required && !cfForm[cf.field_name]?.trim()) {
                errs[`custom_fields.${cf.field_name}`] = `${cf.field_label} est obligatoire`;
            }
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    }, [isCreate, auth, pForm, cfForm, masterData?.custom_fields]);

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!validate()) {
            const firstErrKey = Object.keys(errors)[0];
            if (firstErrKey) {
                const tab = tabForError(firstErrKey, isCreate);
                setActiveTab(tab);
            }
            toast.error('Veuillez corriger les erreurs avant de continuer');
            return;
        }
        try {
            if (isCreate) {
                const phoneRaw = auth.phone ?? '';
                const phone = phoneRaw.startsWith('+') ? phoneRaw : `${auth.phone_code ?? '+212'}${phoneRaw}`.replace(/\s/g, '');
                await onSave({
                    mode: 'create',
                    data: {
                        auth: {
                            name: auth.name!,
                            last_name: auth.last_name || undefined,
                            email: auth.email!,
                            password: auth.password!,
                            phone,
                            phone_code: auth.phone_code || '+212',
                            gender: auth.gender || undefined,
                            date_of_birth: auth.date_of_birth || undefined,
                            branch_code: auth.branch_code || undefined,
                            geo_area_code: auth.geo_area_code || undefined,
                            is_active: auth.is_active !== false,
                            target_app: auth.target_app || 'B2B',
                        },
                        partner: {
                            name: pForm.name!,
                            code: pForm.code || undefined,
                            partner_type: pForm.partner_type || 'CUSTOMER',
                            channel: pForm.channel || 'DIRECT',
                            status: (pForm.status as PartnerStatus) || 'ACTIVE',
                            price_list_id: pForm.price_list_id,
                            payment_term_id: pForm.payment_term_id,
                            credit_limit: pForm.credit_limit,
                            default_discount_rate: pForm.default_discount_rate,
                            phone: pForm.phone || undefined,
                            email: pForm.email || undefined,
                            address_line1: pForm.address_line1 || undefined,
                            address_line2: pForm.address_line2 || undefined,
                            city: pForm.city || undefined,
                            region: pForm.region || undefined,
                            country: pForm.country || undefined,
                            postal_code: pForm.postal_code || undefined,
                            tax_number_ice: pForm.tax_number_ice || undefined,
                            tax_number_if: pForm.tax_number_if || undefined,
                            tax_exempt: pForm.tax_exempt,
                            geo_area_code: pForm.geo_area_code || undefined,
                            delivery_zone: pForm.delivery_zone || undefined,
                            delivery_instructions: pForm.delivery_instructions || undefined,
                            min_order_amount: pForm.min_order_amount || undefined,
                        },
                        custom_fields: Object.keys(cfForm).length > 0 ? cfForm : undefined,
                    },
                });
            } else {
                await onSave({
                    mode: 'edit',
                    data: {
                        name: pForm.name,
                        code: pForm.code || undefined,
                        email: pForm.email || undefined,
                        phone: pForm.phone || undefined,
                        status: pForm.status as PartnerStatus,
                        partner_type: pForm.partner_type,
                        channel: pForm.channel,
                        price_list_id: pForm.price_list_id,
                        payment_term_id: pForm.payment_term_id,
                        credit_limit: pForm.credit_limit,
                        default_discount_rate: pForm.default_discount_rate,
                        address_line1: pForm.address_line1 || undefined,
                        address_line2: pForm.address_line2 || undefined,
                        city: pForm.city || undefined,
                        region: pForm.region || undefined,
                        country: pForm.country || undefined,
                        postal_code: pForm.postal_code || undefined,
                        tax_number_ice: pForm.tax_number_ice || undefined,
                        tax_number_if: pForm.tax_number_if || undefined,
                        tax_exempt: pForm.tax_exempt,
                        geo_area_code: pForm.geo_area_code || undefined,
                        delivery_zone: pForm.delivery_zone || undefined,
                        delivery_instructions: pForm.delivery_instructions || undefined,
                        min_order_amount: pForm.min_order_amount,
                        custom_fields: Object.keys(cfForm).length > 0 ? cfForm : undefined,
                    } as Partial<CreatePartnerRequest>,
                });
            }
        } catch (e: any) {
            if (e?.response?.status === 422) {
                const apiErrors: Record<string, string | string[]> = e.response?.data?.errors ?? {};
                const mapped: Record<string, string> = {};
                Object.entries(apiErrors).forEach(([k, v]) => { mapped[k] = Array.isArray(v) ? v[0] : String(v); });
                setErrors(p => ({ ...p, ...mapped }));
                const firstKey = Object.keys(mapped)[0];
                if (firstKey) setActiveTab(tabForError(firstKey, isCreate));
                toast.error('Veuillez corriger les erreurs dans le formulaire');
            }
        }
    };

    // ── Tab content renderers ─────────────────────────────────────────────────

    const renderAccountTab = () => (
        <div className="space-y-4">
            <SectionCard icon={User} title="Identifiants de connexion" subtitle="Accès au compte B2B du partenaire" color="text-indigo-600 bg-indigo-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="Prénom" required error={errors['auth.name']}>
                        <input type="text" value={auth.name || ''} onChange={e => ua('name', e.target.value)}
                            className={errors['auth.name'] ? inputErrCls : inputCls} placeholder="Mohamed" />
                    </FormField>
                    <FormField label="Nom de famille" error={errors['auth.last_name']}>
                        <input type="text" value={auth.last_name || ''} onChange={e => ua('last_name', e.target.value)}
                            className={inputCls} placeholder="Benali" />
                    </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="Email de connexion" required error={errors['auth.email']}>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="email" value={auth.email || ''} onChange={e => ua('email', e.target.value)}
                                className={`${errors['auth.email'] ? inputErrCls : inputCls} pl-9`} placeholder="email@exemple.ma" />
                        </div>
                    </FormField>
                    <FormField label="Téléphone" required error={errors['auth.phone']}>
                        <div className="flex gap-1.5">
                            <SearchableSelect
                                options={(masterData?.countries ?? []).map(c => ({ value: c.dial_code, label: `${flagEmoji(c.code)} ${c.dial_code}`, sublabel: c.name }))}
                                value={auth.phone_code || '+212'}
                                onChange={v => ua('phone_code', v)}
                                placeholder="+212"
                            />
                            <div className="relative flex-1">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input type="tel" value={auth.phone || ''} onChange={e => ua('phone', e.target.value)}
                                    className={`${errors['auth.phone'] ? inputErrCls : inputCls} pl-9`} placeholder="6xx xxx xxx" />
                            </div>
                        </div>
                        <FieldError msg={errors['auth.phone']} />
                    </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="Mot de passe" required error={errors['auth.password']}>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type={showPwd ? 'text' : 'password'} value={auth.password || ''}
                                onChange={e => ua('password', e.target.value)}
                                className={`${errors['auth.password'] ? inputErrCls : inputCls} pl-9 pr-9`} placeholder="Min. 8 caractères" />
                            <button type="button" onClick={() => setShowPwd(!showPwd)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                        {auth.password && auth.password.length >= 8 && !errors['auth.password'] && (
                            <p className="flex items-center gap-1 text-[10px] text-emerald-600 mt-1">
                                <CheckCircle2 className="w-3 h-3" /> Mot de passe valide
                            </p>
                        )}
                    </FormField>
                    <FormField label="Confirmer le mot de passe" required error={errors['auth.confirm_password']}>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type={showConfirmPwd ? 'text' : 'password'} value={auth.confirm_password || ''}
                                onChange={e => ua('confirm_password', e.target.value)}
                                className={`${errors['auth.confirm_password'] ? inputErrCls : inputCls} pl-9 pr-9`} placeholder="Répéter le mot de passe" />
                            <button type="button" onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showConfirmPwd ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                    <FormField label="Genre">
                        <SearchableSelect options={GENDER_OPTIONS} value={auth.gender} onChange={v => ua('gender', v)}
                            placeholder="— Genre —" clearable />
                    </FormField>
                    <FormField label="Date de naissance">
                        <input type="date" value={auth.date_of_birth || ''} onChange={e => ua('date_of_birth', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Application cible">
                        <SearchableSelect options={TARGET_APP_OPTIONS} value={auth.target_app || 'B2B'} onChange={v => ua('target_app', v)} />
                    </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="Agence / Dépôt rattaché">
                        <SearchableSelect options={branchOptions} value={auth.branch_code} onChange={v => ua('branch_code', v)}
                            placeholder="— Sélectionner une agence —" clearable />
                    </FormField>
                    <FormField label="Zone géographique (compte)">
                        <SearchableSelect options={geoAreaOptions} value={auth.geo_area_code} onChange={v => ua('geo_area_code', v)}
                            placeholder="— Sélectionner une zone —" clearable />
                    </FormField>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <label className="relative flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" checked={auth.is_active !== false} onChange={e => ua('is_active', e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Compte actif</p>
                        <p className="text-[10px] text-gray-400">Le partenaire pourra se connecter dès la création</p>
                    </div>
                </div>
            </SectionCard>
        </div>
    );

    const renderIdentityTab = () => (
        <div className="space-y-4">
            <SectionCard icon={Briefcase} title="Profil partenaire" color="text-blue-600 bg-blue-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="Code" hint="Laissez vide pour générer automatiquement">
                        <input type="text" value={pForm.code || ''} onChange={e => up('code', e.target.value)}
                            className={`${inputCls} font-mono`} placeholder="Auto-généré" />
                    </FormField>
                    <FormField label="Raison sociale / Nom" required error={errors['partner.name']}>
                        <input type="text" value={pForm.name || ''} onChange={e => up('name', e.target.value)}
                            className={errors['partner.name'] ? inputErrCls : inputCls} placeholder="Société ou nom du client" />
                    </FormField>
                </div>
                <div className="mb-4">
                    <label className={labelCls}>Statut</label>
                    <div className="flex flex-wrap gap-2">
                        {STATUS_OPTIONS.map(opt => (
                            <button key={opt.value} type="button" onClick={() => up('status', opt.value)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg border transition-all',
                                    pForm.status === opt.value
                                        ? `${STATUS_STYLES[opt.value]} ring-2 ring-offset-1 ring-blue-300 shadow-sm`
                                        : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                )}>
                                <span className={cn('w-2 h-2 rounded-full', opt.dot)} />
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Type de partenaire">
                        <SearchableSelect options={TYPE_OPTIONS} value={pForm.partner_type || 'CUSTOMER'} onChange={v => up('partner_type', v)} />
                    </FormField>
                    <FormField label="Canal de vente">
                        <SearchableSelect options={CHANNEL_OPTIONS} value={pForm.channel || 'DIRECT'} onChange={v => up('channel', v)} />
                    </FormField>
                </div>
            </SectionCard>
        </div>
    );

    const renderCommercialTab = () => (
        <div className="space-y-4">
            <SectionCard icon={DollarSign} title="Tarification" color="text-indigo-600 bg-indigo-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Liste de prix">
                        <SearchableSelect options={priceListOptions} value={pForm.price_list_id}
                            onChange={v => up('price_list_id', v ? Number(v) : undefined)}
                            placeholder="— Aucune liste —" clearable />
                    </FormField>
                    <FormField label="Condition de paiement">
                        <SearchableSelect options={paymentTermOptions} value={pForm.payment_term_id}
                            onChange={v => up('payment_term_id', v ? Number(v) : undefined)}
                            placeholder="— Aucune condition —" clearable />
                    </FormField>
                </div>
            </SectionCard>
            <SectionCard icon={CreditCard} title="Crédit & Remises" color="text-emerald-600 bg-emerald-50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="Limite de crédit (MAD)">
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.credit_limit ?? ''} onChange={e => up('credit_limit', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} placeholder="0" />
                        </div>
                    </FormField>
                    <FormField label="Remise défaut (%)" hint="Appliquée automatiquement aux commandes">
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.default_discount_rate ?? ''} onChange={e => up('default_discount_rate', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} max={100} step={0.01} placeholder="0.00" />
                        </div>
                    </FormField>
                </div>
            </SectionCard>
        </div>
    );

    const renderAddressTab = () => (
        <div className="space-y-4">
            <SectionCard icon={Phone} title="Contact" color="text-green-600 bg-green-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Email professionnel">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="email" value={pForm.email || ''} onChange={e => up('email', e.target.value)}
                                className={`${inputCls} pl-9`} placeholder="contact@société.ma" />
                        </div>
                    </FormField>
                    <FormField label="Téléphone">
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="tel" value={pForm.phone || ''} onChange={e => up('phone', e.target.value)}
                                className={`${inputCls} pl-9`} placeholder="+212 6xx xxx xxx" />
                        </div>
                    </FormField>
                </div>
            </SectionCard>
            <SectionCard icon={MapPin} title="Adresse" color="text-orange-500 bg-orange-50">
                <div className="space-y-3">
                    <FormField label="Adresse ligne 1">
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="text" value={pForm.address_line1 || ''} onChange={e => up('address_line1', e.target.value)}
                                className={`${inputCls} pl-9`} placeholder="123 Rue Mohammed V" />
                        </div>
                    </FormField>
                    <FormField label="Adresse ligne 2">
                        <input type="text" value={pForm.address_line2 || ''} onChange={e => up('address_line2', e.target.value)}
                            className={inputCls} placeholder="Appartement, étage, immeuble..." />
                    </FormField>
                    {/* Dynamic geo hierarchy – cascading dropdowns built from the API tree */}
                    {(masterData?.geo_areas?.length ?? 0) > 0 && (
                        <div>
                            <label className="block text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">
                                Zone géographique
                            </label>
                            <DynamicGeoSelector
                                geoAreas={masterData!.geo_areas}
                                geoAreaTypes={masterData!.geo_area_types}
                                value={pForm.geo_area_code ?? null}
                                onChange={handleGeoChange}
                                showBreadcrumb
                            />
                            <p className="text-[10px] text-gray-400 mt-1">
                                La ville et la région ci-dessous sont mises à jour automatiquement.
                            </p>
                        </div>
                    )}
                    {/* Readable address fields – auto-populated by DynamicGeoSelector but freely editable */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <FormField label="Ville" hint="Auto-rempli depuis la zone, modifiable">
                            <input type="text" value={pForm.city || ''} onChange={e => up('city', e.target.value)}
                                className={inputCls} placeholder="Casablanca" />
                        </FormField>
                        <FormField label="Région" hint="Auto-rempli depuis la zone, modifiable">
                            <input type="text" value={pForm.region || ''} onChange={e => up('region', e.target.value)}
                                className={inputCls} placeholder="Casablanca-Settat" />
                        </FormField>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <FormField label="Code postal">
                            <input type="text" value={pForm.postal_code || ''} onChange={e => up('postal_code', e.target.value)}
                                className={inputCls} placeholder="20000" />
                        </FormField>
                        <FormField label="Pays">
                            <SearchableSelect options={countryOptions} value={pForm.country}
                                onChange={v => up('country', v)}
                                placeholder="— Pays —" clearable />
                        </FormField>
                    </div>
                </div>
            </SectionCard>
        </div>
    );

    const renderFiscalTab = () => (
        <div className="space-y-4">
            <SectionCard icon={FileText} title="Identifiants fiscaux" color="text-purple-600 bg-purple-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <FormField label="ICE" hint="Identifiant Commun de l'Entreprise (15 chiffres)">
                        <input type="text" value={pForm.tax_number_ice || ''} onChange={e => up('tax_number_ice', e.target.value)}
                            className={`${inputCls} font-mono tracking-widest`} placeholder="001234567000089" maxLength={15} />
                    </FormField>
                    <FormField label="IF" hint="Identifiant Fiscal">
                        <input type="text" value={pForm.tax_number_if || ''} onChange={e => up('tax_number_if', e.target.value)}
                            className={`${inputCls} font-mono tracking-widest`} placeholder="12345678" />
                    </FormField>
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <label className="relative flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" checked={pForm.tax_exempt || false} onChange={e => up('tax_exempt', e.target.checked)} className="sr-only peer" />
                        <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-emerald-500 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                    <div>
                        <p className="text-sm font-semibold text-gray-700">Exonéré de TVA</p>
                        <p className="text-[10px] text-gray-400">Aucune taxe appliquée aux factures de ce partenaire</p>
                    </div>
                </div>
            </SectionCard>
        </div>
    );

    const renderDeliveryTab = () => (
        <div className="space-y-4">
            <SectionCard icon={Truck} title="Livraison & Opérations" color="text-teal-600 bg-teal-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <FormField label="Zone de livraison">
                        <input type="text" value={pForm.delivery_zone || ''} onChange={e => up('delivery_zone', e.target.value)}
                            className={inputCls} placeholder="Zone A, Nord..." />
                    </FormField>
                    <FormField label="Commande minimum (MAD)">
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.min_order_amount ?? ''} onChange={e => up('min_order_amount', Number(e.target.value) || undefined)}
                                className={`${inputCls} pl-9`} min={0} placeholder="0.00" />
                        </div>
                    </FormField>
                </div>
                <FormField label="Instructions de livraison">
                    <textarea value={pForm.delivery_instructions || ''} onChange={e => up('delivery_instructions', e.target.value)}
                        className={`${inputCls} min-h-[80px] resize-y`}
                        placeholder="Appeler avant livraison, laisser en réception, code portail..." />
                </FormField>
            </SectionCard>
        </div>
    );

    const renderCustomTab = () => {
        const fields = (masterData?.custom_fields ?? []).sort((a, b) => a.order - b.order);
        if (fields.length === 0) return null;
        return (
            <div className="space-y-4">
                <SectionCard icon={Tag} title="Champs personnalisés" color="text-violet-600 bg-violet-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {fields.map(cf => (
                            <FormField key={cf.field_name} label={cf.field_label} required={cf.is_required}
                                hint={cf.help_text} error={errors[`custom_fields.${cf.field_name}`]}>
                                {cf.field_type === 'select' && Array.isArray(cf.options) ? (
                                    <SearchableSelect
                                        options={cf.options.map((o: any) => ({ value: o.value ?? o, label: o.label ?? o }))}
                                        value={cfForm[cf.field_name] || cf.default_value || ''}
                                        onChange={v => ucf(cf.field_name, String(v ?? ''))}
                                        hasError={!!errors[`custom_fields.${cf.field_name}`]}
                                        clearable
                                    />
                                ) : cf.field_type === 'textarea' ? (
                                    <textarea value={cfForm[cf.field_name] || ''} onChange={e => ucf(cf.field_name, e.target.value)}
                                        className={`${errors[`custom_fields.${cf.field_name}`] ? inputErrCls : inputCls} min-h-[60px] resize-y`}
                                        placeholder={cf.placeholder || ''} />
                                ) : (
                                    <input
                                        type={cf.field_type === 'number' ? 'number' : cf.field_type === 'email' ? 'email' : 'text'}
                                        value={cfForm[cf.field_name] || ''}
                                        onChange={e => ucf(cf.field_name, e.target.value)}
                                        className={errors[`custom_fields.${cf.field_name}`] ? inputErrCls : inputCls}
                                        placeholder={cf.placeholder || cf.default_value || ''} />
                                )}
                            </FormField>
                        ))}
                    </div>
                </SectionCard>
            </div>
        );
    };

    const renderTabContent = () => {
        switch (activeTab) {
            case 'account': return renderAccountTab();
            case 'identity': return renderIdentityTab();
            case 'commercial': return renderCommercialTab();
            case 'address': return renderAddressTab();
            case 'fiscal': return renderFiscalTab();
            case 'delivery': return renderDeliveryTab();
            case 'custom': return renderCustomTab();
            default: return renderIdentityTab();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">

            {/* ── Header ──────────────────────────────────────── */}
            <div className="px-3 sm:px-4 py-3 border-b border-gray-200 shrink-0 bg-white flex items-center gap-3">
                <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0" title="Retour">
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm',
                    isCreate ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
                )}>
                    {isCreate ? <Plus className="w-4 h-4" /> : (partner?.name?.charAt(0)?.toUpperCase() || 'P')}
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-base font-bold text-gray-900 truncate">
                        {isCreate ? 'Nouveau partenaire' : `Modifier — ${partner?.name || ''}`}
                    </h1>
                    <p className="text-[11px] text-gray-400">
                        {isCreate ? 'Création du compte et profil partenaire' : `Code: ${partner?.code}`}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {touched && (
                        <span className="hidden sm:flex items-center gap-1 text-[10px] text-amber-500 font-medium">
                            <AlertCircle className="w-3 h-3" /> Non enregistré
                        </span>
                    )}
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center gap-1.5">
                        <X className="w-4 h-4" /> Annuler
                    </button>
                    <button onClick={handleSubmit} disabled={saving}
                        className="px-4 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {isCreate ? 'Créer' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            {/* ── Loading ─────────────────────────────────────── */}
            {masterDataLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                    <span className="text-sm">Chargement du formulaire...</span>
                </div>
            ) : (
                <>
                    {/* ── SageTabs ────────────────────────────────── */}
                    <SageTabs
                        tabs={allTabs.map(t => ({
                            ...t,
                            // Append dot indicator if tab has errors
                            label: tabsWithErrors.has(t.id)
                                ? `${t.label} ●`
                                : t.label,
                        }))}
                        activeTabId={activeTab}
                        onTabChange={handleTabChange}
                    />

                    {/* ── Tab Content ──────────────────────────────── */}
                    <div className="flex-1 overflow-y-auto p-3 sm:p-4 bg-slate-50/70">
                        {renderTabContent()}
                        {/* Spacer so content isn't hidden behind bottom bar */}
                        <div className="h-20" />
                    </div>

                    {/* ── Sticky bottom bar ────────────────────────── */}
                    <div className="shrink-0 px-4 py-3 bg-white/95 backdrop-blur-sm border-t border-gray-200 flex items-center justify-between shadow-[0_-1px_8px_rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-3 min-w-0">
                            {allTabs.map((t, i) => (
                                <button key={t.id} type="button" onClick={() => setActiveTab(t.id)}
                                    className={cn(
                                        'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
                                        activeTab === t.id ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-400 hover:text-gray-600',
                                        tabsWithErrors.has(t.id) && 'text-red-500'
                                    )}>
                                    <span className={cn('w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0',
                                        activeTab === t.id ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500',
                                        tabsWithErrors.has(t.id) && 'bg-red-100 text-red-500'
                                    )}>{i + 1}</span>
                                    <span className="hidden sm:inline">{t.label}</span>
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                                Annuler
                            </button>
                            <button onClick={handleSubmit} disabled={saving}
                                className="px-5 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isCreate ? 'Créer le partenaire' : 'Enregistrer les modifications'}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
