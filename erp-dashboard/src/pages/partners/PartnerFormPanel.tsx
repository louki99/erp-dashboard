import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
    Loader2, Save, X, ArrowLeft, Plus, Eye, EyeOff,
    Phone, Mail, MapPin, CreditCard, DollarSign,
    FileText, Tag, User, Lock, AlertCircle, CheckCircle2,
    Briefcase, Truck, BookOpen, LogOut,
    Upload, Download, Settings, Globe, UserCheck, Clock,
    ToggleLeft, ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { cn } from '@/lib/utils';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import SearchableSelect, { FieldError, type SelectOption } from '@/components/common/SearchableSelect';
import DynamicGeoSelector from '@/components/common/DynamicGeoSelector';
import AddressMapPicker from '@/components/partners/AddressMapPicker';
import type { AddressValue } from '@/components/partners/AddressMapPicker';
import { usePartnerDraft, type PartnerDraft } from '@/hooks/usePartnerDraft';
import { PartnerFileImportDialog } from '@/components/partners/PartnerFileImportDialog';
import {
    serializeToPartnerFile,
    downloadPartnerFile,
    isPartnerFile,
    readFileAsText,
    type AppliedResult,
} from '@/utils/partnerFile';

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

// ─── CancelConfirmDialog ──────────────────────────────────────────────────────

interface CancelConfirmDialogProps {
    open:         boolean;
    partnerName:  string;
    savingDraft:  boolean;
    onStay:       () => void;
    onLeave:      () => void;
    onSaveDraft:  () => Promise<void>;
}

const CancelConfirmDialog: React.FC<CancelConfirmDialogProps> = ({
    open, partnerName, savingDraft, onStay, onLeave, onSaveDraft,
}) => {
    if (!open) return null;

    const modal = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                style={{ animation: 'modalIn 160ms cubic-bezier(.16,1,.3,1)' }}
            >
                {/* Header */}
                <div className="px-6 pt-6 pb-4">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-base font-bold text-gray-900">
                                Quitter sans enregistrer ?
                            </h2>
                            <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                                {partnerName
                                    ? <>Le formulaire <span className="font-medium text-gray-700">«&nbsp;{partnerName}&nbsp;»</span> contient des modifications non sauvegardées.</>
                                    : 'Le formulaire contient des modifications non sauvegardées.'
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Save-as-draft card */}
                <div className="mx-6 mb-4">
                    <button
                        type="button"
                        onClick={onSaveDraft}
                        disabled={savingDraft}
                        className={cn(
                            'w-full flex items-start gap-4 px-4 py-3.5 rounded-xl border-2 transition-all text-left',
                            'border-blue-200 bg-blue-50 hover:bg-blue-100 hover:border-blue-300',
                            savingDraft && 'opacity-60 cursor-not-allowed',
                        )}
                    >
                        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                            {savingDraft
                                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                                : <BookOpen className="w-4 h-4 text-white" />
                            }
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-blue-900">Enregistrer comme brouillon</p>
                            <p className="text-xs text-blue-600 mt-0.5">
                                Vos données seront sauvegardées localement. Vous pourrez reprendre plus tard.
                            </p>
                        </div>
                    </button>
                </div>

                {/* Divider */}
                <div className="mx-6 mb-4 flex items-center gap-3">
                    <hr className="flex-1 border-gray-100" />
                    <span className="text-[11px] text-gray-400 font-medium">ou</span>
                    <hr className="flex-1 border-gray-100" />
                </div>

                {/* Footer buttons */}
                <div className="px-6 pb-6 flex flex-col sm:flex-row gap-2">
                    <button
                        type="button"
                        onClick={onLeave}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all"
                    >
                        <LogOut className="w-4 h-4" />
                        Quitter sans sauvegarder
                    </button>
                    <button
                        type="button"
                        onClick={onStay}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-sm text-white hover:bg-gray-800 transition-colors shadow-sm"
                    >
                        Continuer l'édition
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(.96) translateY(8px); }
                    to   { opacity: 1; transform: scale(1)  translateY(0);    }
                }
            `}</style>
        </div>
    );

    return typeof document !== 'undefined'
        ? ReactDOM.createPortal(modal, document.body)
        : null;
};

// ─── Props & Exports ─────────────────────────────────────────────────────────

export interface PartnerFormPanelProps {
    mode: 'create' | 'edit';
    partner?: Partner | null;
    masterData: PartnerMasterData | null;
    masterDataLoading: boolean;
    onSave: (payload: PartnerSavePayload) => Promise<void>;
    onCancel: () => void;
    saving: boolean;
    /** Pre-fill the form from a saved draft (create mode only) */
    initialDraft?: PartnerDraft | null;
    /** Called after a successful save so the parent can delete the draft */
    onAfterSave?: (draftId: string) => void;
}

// ─── Default state ───────────────────────────────────────────────────────────

const initAuth = (): Partial<AuthFormData> => ({
    phone_code: '+212', gender: '', is_active: true, target_app: 'B2B',
});

const initPartner = (): Partial<CreatePartnerFullPayload['partner']> => ({
    partner_type: 'CUSTOMER', channel: 'DIRECT', status: 'ACTIVE',
    currency: 'MAD', credit_limit: 0,
    default_discount_rate: 0, default_discount_amount: 0, max_discount_rate: 0,
    tax_exempt: false, country: 'MA', allow_show_on_pos: false,
    risk_score: 0,
});

// ─── Tab error mapping ────────────────────────────────────────────────────────

const tabForError = (key: string, isCreate: boolean): string => {
    if (key.startsWith('auth.')) return isCreate ? 'account' : 'identity';
    if (['partner.name', 'partner.code', 'partner.status', 'partner.partner_type',
         'partner.channel', 'partner.risk_score', 'partner.salesperson',
         'partner.parent_partner', 'partner.allow_show_on_pos',
         'partner.blocked_until', 'partner.block_reason'].some(k => key.startsWith(k))) return 'identity';
    if (['partner.price_list', 'partner.payment_term', 'partner.credit',
         'partner.discount', 'partner.currency', 'partner.max_discount',
         'partner.default_discount'].some(k => key.startsWith(k))) return 'commercial';
    if (['partner.address', 'partner.city', 'partner.region', 'partner.country',
         'partner.postal', 'partner.geo_area', 'partner.phone', 'partner.email',
         'partner.whatsapp', 'partner.website', 'partner.geo_lat',
         'partner.geo_lng'].some(k => key.startsWith(k))) return 'address';
    if (['partner.tax', 'partner.vat'].some(k => key.startsWith(k))) return 'fiscal';
    if (['partner.delivery', 'partner.min_order', 'partner.opening'].some(k => key.startsWith(k))) return 'delivery';
    if (key.startsWith('custom_fields.')) return 'custom';
    return 'identity';
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const PartnerFormPanel: React.FC<PartnerFormPanelProps> = ({
    mode, partner, masterData, masterDataLoading, onSave, onCancel, saving,
    initialDraft, onAfterSave,
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
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [savingDraft, setSavingDraft] = useState(false);
    // In create mode: whether to also create a B2B user account
    const [withAccount, setWithAccount] = useState(true);

    // .partner file import
    const [showImportDialog, setShowImportDialog] = useState(false);
    const [dragOver,         setDragOver]         = useState(false);
    const [preloadedFile,    setPreloadedFile]     = useState<File | null>(null);

    // Stable draft ID for this form session
    const draftId = useRef<string>(
        mode === 'edit' && partner?.id
            ? `draft-edit-${partner.id}`
            : `draft-create-${Date.now()}`
    ).current;

    const { saveDraft, deleteDraft } = usePartnerDraft();

    // Reset on mode change
    useEffect(() => {
        setErrors({});
        setTouched(false);
        setActiveTab(mode === 'create' ? 'account' : 'identity');
        if (mode === 'edit' && partner) {
            // Parse opening_hours — may arrive as JSON string or object
            let openingHours: Record<string, string> | undefined;
            if (partner.opening_hours) {
                try {
                    const parsed = typeof partner.opening_hours === 'string'
                        ? JSON.parse(partner.opening_hours) : partner.opening_hours;
                    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                        openingHours = parsed as Record<string, string>;
                    }
                } catch { /* leave undefined */ }
            }
            setPForm({
                // Identity
                name: partner.name,
                code: partner.code,
                partner_type: partner.partner_type,
                channel: partner.channel,
                status: partner.status,
                risk_score: partner.risk_score ?? 0,
                salesperson_id: partner.salesperson_id ?? undefined,
                parent_partner_id: partner.parent_partner_id ?? undefined,
                allow_show_on_pos: partner.allow_show_on_pos ?? false,
                blocked_until: partner.blocked_until ?? '',
                block_reason: partner.block_reason ?? '',
                // Commercial
                price_list_id: partner.price_list_id ?? undefined,
                payment_term_id: partner.payment_term_id ?? undefined,
                currency: (partner as any).currency || 'MAD',
                credit_limit: parseFloat(String(partner.credit_limit)) || 0,
                default_discount_rate: parseFloat(String(partner.default_discount_rate)) || 0,
                default_discount_amount: parseFloat(String(partner.default_discount_amount)) || 0,
                max_discount_rate: parseFloat(String(partner.max_discount_rate)) || 0,
                // Tax
                tax_number_ice: partner.tax_number_ice || '',
                tax_number_if: partner.tax_number_if || '',
                tax_exempt: partner.tax_exempt || false,
                vat_group_code: partner.vat_group_code || '',
                // Contact
                email: partner.email || '',
                phone: partner.phone || '',
                whatsapp: partner.whatsapp || '',
                website: partner.website || '',
                // Address
                address_line1: partner.address_line1 || '',
                address_line2: partner.address_line2 || '',
                city: partner.city || '',
                region: partner.region || '',
                country: partner.country || 'MA',
                postal_code: partner.postal_code || '',
                geo_area_code: partner.geo_area_code || '',
                geo_lat: partner.geo_lat ?? undefined,
                geo_lng: partner.geo_lng ?? undefined,
                // Delivery
                delivery_zone: partner.delivery_zone || '',
                delivery_instructions: partner.delivery_instructions || '',
                min_order_amount: parseFloat(String(partner.min_order_amount)) || undefined,
                opening_hours: openingHours,
            });
        } else if (initialDraft) {
            // Restore from a saved draft
            setAuth(initialDraft.auth as Partial<AuthFormData>);
            setPForm(initialDraft.pForm as Partial<CreatePartnerFullPayload['partner']>);
            setCfForm(initialDraft.cfForm);
            setTouched(true); // Mark dirty so unsaved warning shows
        } else {
            setAuth(initAuth());
            setPForm(initPartner());
            setCfForm({});
        }
    }, [mode, partner, initialDraft]);

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

    const salespersonOptions = useMemo<SelectOption[]>(() =>
        (masterData?.salespersons ?? []).map((s: any) => ({
            value: s.id,
            label: [s.name, s.last_name].filter(Boolean).join(' ') || s.email || `#${s.id}`,
            sublabel: s.email,
        })),
        [masterData?.salespersons]
    );

    const vatGroupOptions = useMemo<SelectOption[]>(() =>
        (masterData?.vat_taxes ?? []).map(v => ({
            value: v.type,
            label: v.name,
            badge: `${v.percentage}%`,
        })),
        [masterData?.vat_taxes]
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

    // Country options are passed directly to AddressMapPicker to avoid a redundant memo

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
        if (isCreate && withAccount) tabs.push({ id: 'account', label: 'Compte', icon: User });
        tabs.push(
            { id: 'identity',   label: 'Identité',          icon: Briefcase  },
            { id: 'commercial', label: 'Commercial',         icon: DollarSign },
            { id: 'address',    label: 'Adresse & Contact',  icon: MapPin     },
            { id: 'fiscal',     label: 'Fiscalité',          icon: FileText   },
            { id: 'delivery',   label: 'Livraison',          icon: Truck      },
            { id: 'options',    label: 'Options',            icon: Settings   },
        );
        if ((masterData?.custom_fields ?? []).length > 0) {
            tabs.push({ id: 'custom', label: 'Champs perso.', icon: Tag });
        }
        return tabs;
    }, [isCreate, withAccount, masterData?.custom_fields]);

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
        if (isCreate && withAccount) {
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
    }, [isCreate, withAccount, auth, pForm, cfForm, masterData?.custom_fields]);

    // ── Cancel with confirmation ──────────────────────────────────────────────

    const handleCancelClick = useCallback(() => {
        if (touched) {
            setShowCancelConfirm(true);
        } else {
            onCancel();
        }
    }, [touched, onCancel]);

    const handleSaveDraft = useCallback(async () => {
        setSavingDraft(true);
        try {
            await saveDraft({
                id:          draftId,
                mode,
                partnerId:   partner?.id,
                partnerName: (pForm.name as string | undefined) || partner?.name || 'Nouveau partenaire',
                auth:        auth  as Record<string, unknown>,
                pForm:       pForm as Record<string, unknown>,
                cfForm,
            });
            toast.success('Brouillon enregistré — vous pourrez reprendre plus tard.');
            setShowCancelConfirm(false);
            onCancel();
        } catch {
            toast.error('Impossible d\'enregistrer le brouillon.');
        } finally {
            setSavingDraft(false);
        }
    }, [saveDraft, draftId, mode, partner, pForm, auth, cfForm, onCancel]);

    // ── .partner import ───────────────────────────────────────────────────────

    const handleImportApply = useCallback((result: AppliedResult) => {
        // Merge partner fields
        if (Object.keys(result.partner).length > 0) {
            setPForm(p => ({ ...p, ...result.partner }));
        }
        // Merge auth fields
        if (Object.keys(result.auth).length > 0) {
            setAuth(p => ({ ...p, ...result.auth }));
        }
        // Merge custom fields
        if (Object.keys(result.customFields).length > 0) {
            setCfForm(p => ({ ...p, ...result.customFields }));
        }
        setTouched(true);
        toast.success('Données importées depuis le fichier .partner');
    }, []);

    const handleExport = useCallback(() => {
        const content  = serializeToPartnerFile(
            pForm as Record<string, unknown>,
            auth  as Record<string, unknown>,
            cfForm,
        );
        const name = (pForm.name as string | undefined) || partner?.name || 'partenaire';
        downloadPartnerFile(content, name.replace(/\s+/g, '-').toLowerCase());
        toast.success('Fichier .partner exporté');
    }, [pForm, auth, cfForm, partner]);

    // Drag-and-drop a .partner file onto the form panel
    const handleFormDragOver = useCallback((e: React.DragEvent) => {
        if ([...e.dataTransfer.items].some(i => i.kind === 'file')) {
            e.preventDefault();
            setDragOver(true);
        }
    }, []);

    const handleFormDragLeave = useCallback((e: React.DragEvent) => {
        // Only clear if leaving the panel entirely (not a child)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setDragOver(false);
        }
    }, []);

    const handleFormDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (!file) return;
        if (!isPartnerFile(file)) {
            toast.error(`"${file.name}" n'est pas un fichier .partner`);
            return;
        }
        // Validate it can be read before opening dialog
        await readFileAsText(file).catch(() => {
            toast.error('Impossible de lire le fichier');
            return;
        });
        setPreloadedFile(file);
        setShowImportDialog(true);
    }, []);

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
        // Shared partner payload (used by both create and edit)
        const partnerPayload: CreatePartnerFullPayload['partner'] = {
            // Identity
            name:              pForm.name!,
            code:              pForm.code              || undefined,
            partner_type:      pForm.partner_type      || 'CUSTOMER',
            channel:           pForm.channel           || 'DIRECT',
            status:            (pForm.status as PartnerStatus) || 'ACTIVE',
            risk_score:        pForm.risk_score        ?? undefined,
            salesperson_id:    pForm.salesperson_id    ?? undefined,
            parent_partner_id: pForm.parent_partner_id ?? undefined,
            allow_show_on_pos: pForm.allow_show_on_pos ?? false,
            blocked_until:     (pForm.blocked_until as string | undefined) || undefined,
            block_reason:      (pForm.block_reason  as string | undefined) || undefined,
            // Commercial
            price_list_id:          pForm.price_list_id,
            payment_term_id:        pForm.payment_term_id,
            currency:               pForm.currency           || 'MAD',
            credit_limit:           pForm.credit_limit,
            default_discount_rate:  pForm.default_discount_rate,
            default_discount_amount: pForm.default_discount_amount,
            max_discount_rate:      pForm.max_discount_rate,
            // Tax
            tax_number_ice: pForm.tax_number_ice || undefined,
            tax_number_if:  pForm.tax_number_if  || undefined,
            tax_exempt:     pForm.tax_exempt,
            vat_group_code: (pForm as any).vat_group_code || undefined,
            // Contact
            phone:    pForm.phone    || undefined,
            whatsapp: pForm.whatsapp || undefined,
            email:    pForm.email    || undefined,
            website:  pForm.website  || undefined,
            // Address
            address_line1: pForm.address_line1 || undefined,
            address_line2: pForm.address_line2 || undefined,
            city:          pForm.city          || undefined,
            region:        pForm.region        || undefined,
            country:       pForm.country       || undefined,
            postal_code:   pForm.postal_code   || undefined,
            geo_area_code: pForm.geo_area_code || undefined,
            geo_lat:       pForm.geo_lat       ?? undefined,
            geo_lng:       pForm.geo_lng       ?? undefined,
            // Delivery
            delivery_zone:         pForm.delivery_zone         || undefined,
            delivery_instructions: pForm.delivery_instructions || undefined,
            min_order_amount:      pForm.min_order_amount      ?? undefined,
            opening_hours:         pForm.opening_hours         ?? undefined,
        };

        try {
            if (isCreate) {
                const authPayload: CreatePartnerFullPayload['auth'] = withAccount ? (() => {
                    const phoneRaw = auth.phone ?? '';
                    const phone = phoneRaw.startsWith('+') ? phoneRaw : `${auth.phone_code ?? '+212'}${phoneRaw}`.replace(/\s/g, '');
                    return {
                        name:          auth.name!,
                        last_name:     auth.last_name     || undefined,
                        email:         auth.email!,
                        password:      auth.password!,
                        phone,
                        phone_code:    auth.phone_code    || '+212',
                        gender:        auth.gender        || undefined,
                        date_of_birth: auth.date_of_birth || undefined,
                        branch_code:   auth.branch_code   || undefined,
                        geo_area_code: auth.geo_area_code || undefined,
                        is_active:     auth.is_active !== false,
                        target_app:    auth.target_app    || 'B2B',
                    };
                })() : undefined;

                await onSave({
                    mode: 'create',
                    data: {
                        ...(authPayload ? { auth: authPayload } : {}),
                        partner: partnerPayload,
                        custom_fields: Object.keys(cfForm).length > 0 ? cfForm : undefined,
                    },
                });
            } else {
                await onSave({
                    mode: 'edit',
                    data: {
                        ...partnerPayload,
                        custom_fields: Object.keys(cfForm).length > 0 ? cfForm : undefined,
                    } as Partial<CreatePartnerRequest>,
                });
            }
            // Successful save — silently remove any draft for this session
            await deleteDraft(draftId).catch(() => {/* ignore */});
            onAfterSave?.(draftId);
        } catch (e: any) {
            handleApiError(e);
        }
    };

    /**
     * Centralised API error handler.
     *
     * Covers:
     *  • 422  — Laravel field-level validation errors  { errors: { field: [...] } }
     *  • 400 / any status with { success:false, message, error_type }
     *  • Network / timeout / unexpected errors
     */
    const handleApiError = useCallback((e: any) => {
        const status  = e?.response?.status;
        const data    = e?.response?.data;

        // ── 422: field-level validation errors ──────────────────────────────
        if (status === 422) {
            const apiErrors: Record<string, string | string[]> = data?.errors ?? {};
            const mapped: Record<string, string> = {};
            Object.entries(apiErrors).forEach(([k, v]) => {
                mapped[k] = Array.isArray(v) ? v[0] : String(v);
            });

            // Also expose a top-level message if no field errors were returned
            if (Object.keys(mapped).length === 0 && data?.message) {
                mapped['_form'] = data.message;
            }

            setErrors(p => ({ ...p, ...mapped }));
            const firstKey = Object.keys(mapped).find(k => k !== '_form');
            if (firstKey) setActiveTab(tabForError(firstKey, isCreate));
            toast.error('Veuillez corriger les erreurs dans le formulaire');
            return;
        }

        // ── Backend business error: { success: false, message, error_type } ─
        if (data && data.success === false && data.message) {
            const errorType: string = data.error_type ?? '';

            // Map known error_type / message patterns to specific form fields
            // so the user sees the error inline next to the field
            const message: string = data.message;
            const lc = message.toLowerCase();

            const fieldError: Record<string, string> = {};

            if (errorType === 'validation' || errorType === 'conflict') {
                if (lc.includes('phone') || lc.includes('téléphone')) {
                    const target = lc.includes('auth') || isCreate ? 'auth.phone' : 'partner.phone';
                    fieldError[target] = message;
                    setActiveTab(tabForError(target, isCreate));
                } else if (lc.includes('email')) {
                    const target = lc.includes('auth') || isCreate ? 'auth.email' : 'partner.email';
                    fieldError[target] = message;
                    setActiveTab(tabForError(target, isCreate));
                } else if (lc.includes('ice') || lc.includes('tax')) {
                    fieldError['partner.tax_number_ice'] = message;
                    setActiveTab('fiscal');
                } else if (lc.includes('name') || lc.includes('nom')) {
                    fieldError['partner.name'] = message;
                    setActiveTab('identity');
                } else {
                    // Generic validation — show as form-level banner
                    fieldError['_form'] = message;
                }
                setErrors(p => ({ ...p, ...fieldError }));
            }

            toast.error(message, { duration: 6000 });
            return;
        }

        // ── HTTP error without a structured body ─────────────────────────────
        if (status) {
            const fallback: Record<number, string> = {
                401: 'Session expirée — veuillez vous reconnecter.',
                403: 'Vous n\'avez pas les droits pour effectuer cette action.',
                404: 'Ressource introuvable.',
                409: 'Conflit de données — cet enregistrement existe déjà.',
                500: 'Erreur serveur interne — veuillez réessayer plus tard.',
                503: 'Service temporairement indisponible.',
            };
            toast.error(fallback[status] ?? `Erreur inattendue (HTTP ${status})`, { duration: 6000 });
            return;
        }

        // ── Network / timeout ────────────────────────────────────────────────
        if (e?.code === 'ERR_NETWORK' || e?.message?.toLowerCase().includes('network')) {
            toast.error('Impossible de joindre le serveur — vérifiez votre connexion.', { duration: 7000 });
            return;
        }

        // ── Fallback ─────────────────────────────────────────────────────────
        console.error('[PartnerFormPanel] Unhandled error:', e);
        toast.error('Une erreur inattendue est survenue. Veuillez réessayer.', { duration: 6000 });
    }, [isCreate, setActiveTab]);

    // ── Tab content renderers ─────────────────────────────────────────────────

    const renderAccountTab = () => (
        <div className="space-y-4">
            {/* B2B account toggle */}
            <div
                className={cn(
                    'flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer',
                    withAccount ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-gray-50 hover:border-gray-300',
                )}
                onClick={() => setWithAccount(v => !v)}
            >
                <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                        withAccount ? 'bg-indigo-600' : 'bg-gray-300')}>
                        <User className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-800">Créer un compte B2B</p>
                        <p className="text-[11px] text-gray-500">
                            {withAccount
                                ? 'Le partenaire recevra des identifiants pour accéder à l\'application B2B.'
                                : 'Partenaire sans accès B2B — aucun compte utilisateur ne sera créé.'}
                        </p>
                    </div>
                </div>
                {withAccount
                    ? <ToggleRight className="w-7 h-7 text-indigo-600 shrink-0" />
                    : <ToggleLeft  className="w-7 h-7 text-gray-400 shrink-0" />
                }
            </div>

            {withAccount && (
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
                            <div className="w-28 shrink-0">
                                <SearchableSelect
                                    options={(masterData?.countries ?? []).map(c => ({ value: c.dial_code, label: `${flagEmoji(c.code)} ${c.dial_code}`, sublabel: c.name }))}
                                    value={auth.phone_code || '+212'}
                                    onChange={v => ua('phone_code', v)}
                                    placeholder="+212"
                                />
                            </div>
                            <div className="relative flex-1 min-w-0">
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
            )}
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

            <SectionCard icon={UserCheck} title="Organisation & Responsable" color="text-violet-600 bg-violet-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Commercial responsable" hint="Vendeur assigné à ce partenaire">
                        <SearchableSelect
                            options={salespersonOptions}
                            value={pForm.salesperson_id}
                            onChange={v => up('salesperson_id', v ? Number(v) : undefined)}
                            placeholder="— Aucun commercial —"
                            clearable
                        />
                    </FormField>
                    <FormField label="Score de risque" hint="0 (aucun risque) → 100 (risque maximal)">
                        <div className="space-y-1.5">
                            <input
                                type="range" min={0} max={100} step={1}
                                value={pForm.risk_score ?? 0}
                                onChange={e => up('risk_score', Number(e.target.value))}
                                className="w-full accent-blue-600"
                            />
                            <div className="flex justify-between text-[10px] text-gray-400">
                                <span>0 — Aucun risque</span>
                                <span className={cn(
                                    'font-bold text-xs',
                                    (pForm.risk_score ?? 0) >= 70 ? 'text-red-500' :
                                    (pForm.risk_score ?? 0) >= 40 ? 'text-amber-500' : 'text-emerald-600'
                                )}>{pForm.risk_score ?? 0}</span>
                                <span>100 — Critique</span>
                            </div>
                        </div>
                    </FormField>
                </div>
            </SectionCard>
        </div>
    );

    const renderCommercialTab = () => (
        <div className="space-y-4">
            <SectionCard icon={DollarSign} title="Tarification" color="text-indigo-600 bg-indigo-50">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <FormField label="Devise">
                        <input type="text" value={(pForm as any).currency || 'MAD'} onChange={e => up('currency', e.target.value.toUpperCase())}
                            className={`${inputCls} font-mono uppercase`} placeholder="MAD" maxLength={3} />
                    </FormField>
                </div>
            </SectionCard>
            <SectionCard icon={CreditCard} title="Crédit & Remises" color="text-emerald-600 bg-emerald-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <FormField label="Limite de crédit">
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.credit_limit ?? ''} onChange={e => up('credit_limit', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} placeholder="0" />
                        </div>
                    </FormField>
                    <FormField label="Remise fixe (montant)" hint="Montant fixe déduit sur chaque commande">
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.default_discount_amount ?? ''} onChange={e => up('default_discount_amount', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} step={0.01} placeholder="0.00" />
                        </div>
                    </FormField>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="Remise défaut (%)" hint="Appliquée automatiquement aux commandes">
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.default_discount_rate ?? ''} onChange={e => up('default_discount_rate', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} max={100} step={0.01} placeholder="0.00" />
                        </div>
                    </FormField>
                    <FormField label="Remise maximale (%)" hint="Plafond autorisé pour les remises manuelles">
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="number" value={pForm.max_discount_rate ?? ''} onChange={e => up('max_discount_rate', Number(e.target.value))}
                                className={`${inputCls} pl-9`} min={0} max={100} step={0.01} placeholder="0.00" />
                        </div>
                    </FormField>
                </div>
            </SectionCard>
        </div>
    );

    const handleAddressChange = useCallback((fields: Partial<AddressValue>) => {
        Object.entries(fields).forEach(([k, v]) => up(k, v));
    }, [up]);

    const renderAddressTab = () => (
        <div className="space-y-4">
            {/* ── Contact ──────────────────────────────────────────────────── */}
            <SectionCard icon={Phone} title="Contact" color="text-green-600 bg-green-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField label="WhatsApp">
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="tel" value={pForm.whatsapp || ''} onChange={e => up('whatsapp', e.target.value)}
                                className={`${inputCls} pl-9`} placeholder="+212 6xx xxx xxx" />
                        </div>
                    </FormField>
                    <FormField label="Site web">
                        <div className="relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input type="url" value={pForm.website || ''} onChange={e => up('website', e.target.value)}
                                className={`${inputCls} pl-9`} placeholder="https://exemple.ma" />
                        </div>
                    </FormField>
                </div>
            </SectionCard>

            {/* ── Geo zone selector (business hierarchy) ───────────────────── */}
            {(masterData?.geo_areas?.length ?? 0) > 0 && (
                <SectionCard icon={MapPin} title="Zone commerciale" subtitle="Sélectionnez la zone de découpage métier" color="text-indigo-500 bg-indigo-50">
                    <DynamicGeoSelector
                        geoAreas={masterData!.geo_areas}
                        geoAreaTypes={masterData!.geo_area_types}
                        value={pForm.geo_area_code ?? null}
                        onChange={handleGeoChange}
                        showBreadcrumb
                    />
                    <p className="text-[10px] text-gray-400 mt-2">
                        La ville et la région ci-dessous sont synchronisées automatiquement depuis cette sélection.
                    </p>
                </SectionCard>
            )}

            {/* ── Address + map picker ──────────────────────────────────────── */}
            <SectionCard icon={MapPin} title="Adresse & Localisation GPS" subtitle="Tapez l'adresse ou cliquez sur la carte" color="text-orange-500 bg-orange-50">
                <AddressMapPicker
                    value={{
                        address_line1: pForm.address_line1 || '',
                        address_line2: pForm.address_line2 || '',
                        city:          pForm.city          || '',
                        region:        pForm.region        || '',
                        country:       pForm.country       || 'MA',
                        postal_code:   pForm.postal_code   || '',
                        geo_lat:       pForm.geo_lat       as number | undefined,
                        geo_lng:       pForm.geo_lng       as number | undefined,
                    }}
                    onChange={handleAddressChange}
                    countryOptions={(masterData?.countries ?? []).map(c => ({
                        value: c.code,
                        label: `${flagEmoji(c.code)} ${c.name}`,
                    }))}
                />
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
                <div className="mb-4">
                    <FormField label="Groupe TVA" hint="Règle de TVA par défaut appliquée aux factures">
                        <SearchableSelect
                            options={vatGroupOptions}
                            value={(pForm as any).vat_group_code}
                            onChange={v => up('vat_group_code', v)}
                            placeholder="— Aucun groupe TVA —"
                            clearable
                        />
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

    const WEEK_DAYS = [
        { key: 'mon', label: 'Lun' }, { key: 'tue', label: 'Mar' },
        { key: 'wed', label: 'Mer' }, { key: 'thu', label: 'Jeu' },
        { key: 'fri', label: 'Ven' }, { key: 'sat', label: 'Sam' },
        { key: 'sun', label: 'Dim' },
    ] as const;

    const renderDeliveryTab = () => {
        const hours = (pForm.opening_hours as Record<string, string> | undefined) ?? {};
        const setHour = (day: string, val: string) => {
            up('opening_hours', { ...hours, [day]: val });
        };
        return (
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

                <SectionCard icon={Clock} title="Horaires d'ouverture" subtitle="Format: 08:00-12:00, 14:00-18:00  •  Fermé pour les jours off" color="text-sky-600 bg-sky-50">
                    <div className="space-y-2">
                        {WEEK_DAYS.map(({ key, label }) => (
                            <div key={key} className="flex items-center gap-3">
                                <span className="w-9 text-xs font-bold text-gray-500 uppercase shrink-0">{label}</span>
                                <input
                                    type="text"
                                    value={hours[key] ?? ''}
                                    onChange={e => setHour(key, e.target.value)}
                                    className={`${inputCls} flex-1 font-mono text-xs`}
                                    placeholder="08:00-12:00, 14:00-18:00"
                                />
                                {hours[key] && (
                                    <button type="button" onClick={() => {
                                        const next = { ...hours };
                                        delete next[key];
                                        up('opening_hours', next);
                                    }} className="p-1 text-gray-300 hover:text-red-400 transition-colors shrink-0">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>
        );
    };

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

    const renderOptionsTab = () => (
        <div className="space-y-4">
            <SectionCard icon={Settings} title="Options POS & Visibilité" color="text-gray-600 bg-gray-100">
                <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                            <Tag className="w-4 h-4 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">Visible sur le point de vente (POS)</p>
                            <p className="text-[10px] text-gray-400">Ce partenaire apparaîtra dans la liste clients du POS</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => up('allow_show_on_pos', !(pForm.allow_show_on_pos))}
                        className="transition-colors"
                    >
                        {pForm.allow_show_on_pos
                            ? <ToggleRight className="w-8 h-8 text-emerald-500" />
                            : <ToggleLeft  className="w-8 h-8 text-gray-300" />
                        }
                    </button>
                </div>
            </SectionCard>

            <SectionCard icon={Lock} title="Blocage temporaire" color="text-red-500 bg-red-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <FormField label="Bloqué jusqu'au" hint="Laisser vide si pas de blocage planifié">
                        <input
                            type="date"
                            value={(pForm.blocked_until as string | undefined) ?? ''}
                            onChange={e => up('blocked_until', e.target.value || undefined)}
                            className={inputCls}
                        />
                    </FormField>
                    <FormField label="Motif du blocage">
                        <input
                            type="text"
                            value={(pForm.block_reason as string | undefined) ?? ''}
                            onChange={e => up('block_reason', e.target.value || undefined)}
                            className={inputCls}
                            placeholder="Impayés, litige..."
                        />
                    </FormField>
                </div>
                {(pForm.blocked_until || pForm.block_reason) && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                        <p className="text-xs text-red-600">
                            Ce partenaire sera marqué <strong>bloqué</strong> dans le système.
                        </p>
                    </div>
                )}
            </SectionCard>
        </div>
    );

    const renderTabContent = () => {
        switch (activeTab) {
            case 'account': return renderAccountTab();
            case 'identity': return renderIdentityTab();
            case 'commercial': return renderCommercialTab();
            case 'address': return renderAddressTab();
            case 'fiscal': return renderFiscalTab();
            case 'delivery': return renderDeliveryTab();
            case 'options': return renderOptionsTab();
            case 'custom': return renderCustomTab();
            default: return renderIdentityTab();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div
            className={cn(
                'flex-1 flex flex-col bg-white min-w-0 overflow-hidden relative',
                dragOver && 'ring-2 ring-inset ring-indigo-400',
            )}
            onDragOver={handleFormDragOver}
            onDragLeave={handleFormDragLeave}
            onDrop={handleFormDrop}
        >
            {/* ── Drag-over overlay ───────────────────────────── */}
            {dragOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 pointer-events-none"
                    style={{ background: 'rgba(99,102,241,0.10)', backdropFilter: 'blur(2px)' }}>
                    <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl">
                        <Upload className="w-9 h-9 text-white" />
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-indigo-700">Déposez le fichier .partner</p>
                        <p className="text-sm text-indigo-500 mt-1">Les champs seront pré-remplis automatiquement</p>
                    </div>
                </div>
            )}

            {/* ── Header ──────────────────────────────────────── */}
            <div className="px-3 sm:px-4 py-3 border-b border-gray-200 shrink-0 bg-white flex items-center gap-3">
                <button onClick={handleCancelClick} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0" title="Retour">
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
                    {/* Import .partner */}
                    <button
                        type="button"
                        onClick={() => { setPreloadedFile(null); setShowImportDialog(true); }}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
                        title="Importer depuis un fichier .partner"
                    >
                        <Upload className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">Importer</span>
                    </button>
                    {/* Export .partner */}
                    <button
                        type="button"
                        onClick={handleExport}
                        className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Exporter en fichier .partner"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={handleCancelClick} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors hidden sm:flex items-center gap-1.5">
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
                        {/* Form-level error banner (non-field errors from API) */}
                        {errors['_form'] && (
                            <div className="mb-3 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                                <div className="flex-1 min-w-0">
                                    <p className="font-semibold">Erreur</p>
                                    <p className="text-xs mt-0.5 text-red-600">{errors['_form']}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setErrors(p => { const n = { ...p }; delete n['_form']; return n; })}
                                    className="p-0.5 text-red-400 hover:text-red-600 rounded transition-colors shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
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
                            <button onClick={handleCancelClick} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
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

            {/* ── Cancel confirmation dialog ───────────────────── */}
            <CancelConfirmDialog
                open={showCancelConfirm}
                partnerName={(pForm.name as string | undefined) || partner?.name || ''}
                savingDraft={savingDraft}
                onStay={() => setShowCancelConfirm(false)}
                onLeave={() => { setShowCancelConfirm(false); onCancel(); }}
                onSaveDraft={handleSaveDraft}
            />

            {/* ── .partner file import dialog ──────────────────── */}
            <PartnerFileImportDialog
                open={showImportDialog}
                currentPartner={pForm as Record<string, unknown>}
                currentAuth={auth as Record<string, unknown>}
                currentCf={cfForm}
                preloadedFile={preloadedFile}
                onApply={handleImportApply}
                onClose={() => { setShowImportDialog(false); setPreloadedFile(null); }}
            />
        </div>
    );
};
