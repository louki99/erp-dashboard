import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { ColDef } from 'ag-grid-community';
import {
    Loader2, RefreshCw, Plus, Edit2, Trash2, Search, X,
    Users, Building2, Phone, Mail, MapPin, CreditCard, Shield,
    Ban, Unlock, FileText,
    CheckCircle2, XCircle, AlertTriangle, Clock, DollarSign,
    Star, ArrowUpDown, BookOpen, ChevronRight,
    Route, Link2, Unlink,
    Activity, Zap,
    Upload, Locate, Calculator, CheckCircle, XCircle as XCircleIcon,
    Banknote, Tag, Calendar, Truck, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { getGeoAreas } from '@/services/api/routingApi';
import { getCountries } from '@/services/api/partnerApi';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ActionPanel } from '@/components/layout/ActionPanel';

import {
    usePartnersList,
    usePartnerDetail,
    usePartnerStatistics,
    usePartnerFormMasterData,
    useCreditHistory,
    useCreditExposure,
    useCreditEvents,
    useRecalcCreditExposure,
    useEvaluateCreditOrder,
    usePaymentTerms,
    useCreatePartner,
    useUpdatePartner,
    useDeletePartner,
    useToggleStatus,
    useUpdateStatus,
    useBlockPartner,
    useUnblockPartner,
    useUpdateCredit,
    useRecalcCredit,
    useAttachPaymentTerm,
    useDetachPaymentTerm,
    useSetDefaultPaymentTerm,
    useAvailableItineraries,
    useAssignItinerary,
    useRemoveFromItinerary,
    usePartnerItinerary,
    useUploadPartnerImage,
    usePaymentMethods,
    usePartnerAddresses,
    useCreatePartnerAddress,
    useUpdatePartnerAddress,
    useDeletePartnerAddress,
    useSetDefaultPartnerAddress,
    usePartnerContacts,
    useCreatePartnerContact,
    useUpdatePartnerContact,
    useDeletePartnerContact,
    useSetDefaultPartnerContact,
    usePartnerPayer,
    useUpdatePartnerPayer,
} from '@/hooks/partners/usePartners';

import { useChannels } from '@/hooks/pricing/usePricing';

import type {
    Partner,
    PartnerStatus,
    PartnerFilters,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PartnerSavePayload,
    CreditExposureStatus,
    PartnerAddress,
    PartnerAddressPayload,
    PartnerContact,
    PartnerContactPayload,
} from '@/types/partner.types';

import {
    ModalDelete,
    ModalStatus,
    ModalBlock,
    ModalCredit,
} from './PartnerModals';

import { PartnerFormPanel } from './PartnerFormPanel';
import { PartnerChronologyChips } from '@/components/partners/PartnerChronologyChips';
import { usePartnerDraft, draftRelativeTime, type PartnerDraft } from '@/hooks/usePartnerDraft';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<PartnerStatus, { bg: string; text: string; dot: string; label: string }> = {
    ACTIVE: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Actif' },
    ON_HOLD: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500', label: 'En attente' },
    BLOCKED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', label: 'Bloqué' },
    CLOSED: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: 'Fermé' },
};

const STATUS_ICONS: Record<PartnerStatus, React.ElementType> = {
    ACTIVE: CheckCircle2,
    ON_HOLD: Clock,
    BLOCKED: Ban,
    CLOSED: XCircle,
};

const CREDIT_EXPOSURE_COLORS: Record<CreditExposureStatus, { bg: string; text: string; border: string; label: string; bar: string }> = {
    ALLOWED: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Autorisé', bar: 'bg-emerald-500' },
    WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'Avertissement', bar: 'bg-amber-500' },
    SOFT_BLOCK: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', label: 'Blocage partiel', bar: 'bg-red-500' },
    HARD_BLOCK: { bg: 'bg-red-100', text: 'text-red-900', border: 'border-red-400', label: 'Blocage total', bar: 'bg-red-700' },
};

const CREDIT_EVENT_ICONS: Record<string, { icon: string; color: string }> = {
    INVOICE_VALIDATED: { icon: '📄', color: 'text-blue-600' },
    PAYMENT_RECEIVED: { icon: '💳', color: 'text-emerald-600' },
    CHEQUE_CLEARED: { icon: '✅', color: 'text-emerald-600' },
    CHEQUE_BOUNCED: { icon: '❌', color: 'text-red-600' },
    EFFET_DEPOSITED: { icon: '📋', color: 'text-indigo-600' },
    ORDER_CONFIRMED: { icon: '📦', color: 'text-sage-600' },
    ORDER_CANCELLED: { icon: '🚫', color: 'text-red-500' },
    CREDIT_NOTE_ISSUED: { icon: '📝', color: 'text-purple-600' },
    CREDIT_LIMIT_CHANGED: { icon: '⚙️', color: 'text-gray-600' },
};

const CHANNEL_LABELS: Record<string, string> = {
    GMS: 'GMS', GROS: 'Gros', DETAIL: 'Détail', CHR: 'CHR', SOM_GROS: 'Semi-Gros', OTHER: 'Autre',
};

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const toNum = (v: any): number => { if (v == null) return 0; const n = typeof v === 'number' ? v : parseFloat(String(v)); return Number.isNaN(n) ? 0 : n; };
const fmtNumber = (n?: number | string | null) => n != null ? toNum(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

// ─── Helper: extract attached terms from API response (handles snake_case / camelCase) ──

const getAttachedTerms = (data: any): any[] => {
    if (!data?.partner) return [];
    const p = data.partner;
    return p.paymentTerms || p.payment_terms || p.paymentterms || [];
};

const getAvailableTerms = (data: any): any[] => {
    return data?.availableTerms || data?.available_terms || [];
};

// ─── Payment Terms Sub-component ──────────────────────────────────────────────

const PaymentTermsContent: React.FC<{
    paymentTermsData: any;
    onSetDefault: (id: number) => void;
    onDetach: (id: number) => void;
    onAttach: (id: number) => void;
}> = ({ paymentTermsData, onSetDefault, onDetach, onAttach }) => {
    const [showModal, setShowModal] = useState(false);
    const [search, setSearch] = useState('');
    const [justAdded, setJustAdded] = useState<Set<number>>(new Set());
    const searchRef = useRef<HTMLInputElement>(null);

    const attached = getAttachedTerms(paymentTermsData);
    const available = getAvailableTerms(paymentTermsData);

    const filtered = available.filter((t: any) => {
        const q = search.toLowerCase();
        return (
            t.name?.toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            (t.code || '').toLowerCase().includes(q)
        );
    });

    useEffect(() => {
        if (showModal) {
            setTimeout(() => searchRef.current?.focus(), 60);
        } else {
            setSearch('');
            setJustAdded(new Set());
        }
    }, [showModal]);

    const handleAttach = (id: number) => {
        onAttach(id);
        setJustAdded(prev => new Set(prev).add(id));
    };

    return (
        <>
            <div className="space-y-2">
                {/* Attached terms list */}
                {attached.length > 0 ? (
                    <div className="space-y-1.5">
                        {attached.map((term: any) => {
                            const isDefault = term.pivot?.is_default || term.is_default;
                            return (
                                <div
                                    key={term.id}
                                    className={`group flex items-center justify-between py-2.5 px-3 rounded-xl border text-xs transition-colors ${isDefault ? 'bg-sage-50 border-sage-200' : 'bg-white border-gray-100 hover:border-gray-200'}`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div className={`w-2 h-2 rounded-full shrink-0 ${isDefault ? 'bg-sage-500' : 'bg-gray-200'}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-gray-800">{term.name}</span>
                                                {isDefault && (
                                                    <span className="px-1.5 py-0.5 bg-sage-100 text-sage-700 rounded-full text-[10px] font-semibold">Défaut</span>
                                                )}
                                                <div className="flex gap-1">
                                                    {term.is_credit && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] border border-purple-100">Crédit</span>}
                                                    {term.is_cash && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] border border-emerald-100">Espèces</span>}
                                                    {term.is_bank_transfer && <span className="px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded text-[9px] border border-sky-100">Virement</span>}
                                                </div>
                                            </div>
                                            {term.description && (
                                                <div className="text-[10px] text-gray-400 mt-0.5 truncate">{term.description}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 shrink-0 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isDefault && (
                                            <button
                                                onClick={() => onSetDefault(term.id)}
                                                title="Définir par défaut"
                                                className="p-1.5 rounded-lg hover:bg-sage-100 text-gray-400 hover:text-sage-600 transition-colors"
                                            >
                                                <Star className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDetach(term.id)}
                                            title="Retirer"
                                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-6 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50">
                        <DollarSign className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                        <p className="text-xs text-gray-400 font-medium">Aucune condition associée</p>
                        <p className="text-[10px] text-gray-300 mt-0.5">Ajoutez une condition via le bouton ci-dessous</p>
                    </div>
                )}

                {/* Open modal button */}
                {available.length > 0 && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center justify-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-xl border border-dashed border-sage-300 transition-colors group"
                    >
                        <div className="w-5 h-5 rounded-full bg-sage-100 group-hover:bg-sage-200 flex items-center justify-center transition-colors">
                            <Plus className="w-3 h-3 text-sage-600" />
                        </div>
                        Ajouter une condition
                        <span className="ml-auto text-[10px] text-sage-500 bg-sage-100 px-1.5 py-0.5 rounded-full">{available.length}</span>
                    </button>
                )}
            </div>

            {/* ── Searchable Modal ─────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={() => setShowModal(false)}
                    />

                    {/* Panel */}
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '72vh' }}>

                        {/* Header */}
                        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Conditions de paiement</h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {available.length} disponible{available.length > 1 ? 's' : ''}
                                    {attached.length > 0 && ` · ${attached.length} déjà associée${attached.length > 1 ? 's' : ''}`}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors -mt-1 -mr-1"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <input
                                    ref={searchRef}
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Rechercher par nom, code, description…"
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-white shadow-sm"
                                />
                                {search && (
                                    <button
                                        onClick={() => setSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                            {search && (
                                <p className="text-[10px] text-gray-400 mt-1.5 pl-1">
                                    {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
                                </p>
                            )}
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                            {filtered.length > 0 ? (
                                filtered.map((term: any) => {
                                    const added = justAdded.has(term.id);
                                    return (
                                        <div key={term.id} className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${added ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}>
                                            {/* Icon */}
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${added ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                                                <DollarSign className={`w-3.5 h-3.5 ${added ? 'text-emerald-600' : 'text-gray-400'}`} />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-semibold text-gray-900">{term.name}</span>
                                                    {term.is_credit && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] border border-purple-100 font-medium">Crédit</span>}
                                                    {term.is_cash && <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[9px] border border-emerald-100 font-medium">Espèces</span>}
                                                    {term.is_bank_transfer && <span className="px-1.5 py-0.5 bg-sky-50 text-sky-600 rounded text-[9px] border border-sky-100 font-medium">Virement</span>}
                                                </div>
                                                {term.description && (
                                                    <p className="text-[10px] text-gray-400 mt-0.5 truncate">{term.description}</p>
                                                )}
                                            </div>

                                            {/* Action */}
                                            {added ? (
                                                <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium shrink-0">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Ajoutée
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => handleAttach(term.id)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700 active:scale-95 transition-all shrink-0"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    Ajouter
                                                </button>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-12 text-center">
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                                        <Search className="w-5 h-5 text-gray-300" />
                                    </div>
                                    <p className="text-xs text-gray-400 font-medium">Aucun résultat</p>
                                    <p className="text-[10px] text-gray-300 mt-0.5">Essayez un autre terme de recherche</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/80 flex items-center justify-between">
                            <span className="text-[10px] text-gray-400">
                                {justAdded.size > 0 ? `${justAdded.size} condition${justAdded.size > 1 ? 's' : ''} ajoutée${justAdded.size > 1 ? 's' : ''}` : 'Cliquez sur Ajouter pour associer'}
                            </span>
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// ─── Partner Addresses Section (§21) ─────────────────────────────────────────

const inputCls =
    'w-full h-9 px-3 border border-gray-200 rounded-lg bg-white text-xs text-gray-900 ' +
    'placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-sage-500 ' +
    'focus:border-sage-500 transition-all';

const selectCls =
    'w-full h-9 pl-3 pr-8 border border-gray-200 rounded-lg bg-white text-xs text-gray-900 ' +
    'appearance-none focus:outline-none focus:ring-2 focus:ring-sage-500 ' +
    'focus:border-sage-500 transition-all cursor-pointer';

const AddrSelect: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string; children: React.ReactNode }> =
    ({ value, onChange, placeholder, children }) => (
        <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
                <option value="">{placeholder}</option>
                {children}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
            </svg>
        </div>
    );

interface AddressFormState {
    label: string;
    address_line1: string;
    address_line2: string;
    city: string;
    region: string;
    country: string;
    postal_code: string;
    geo_lat: string;
    geo_lng: string;
    is_default: boolean;
}

const emptyForm = (): AddressFormState => ({
    label: '', address_line1: '', address_line2: '',
    city: '', region: '', country: '', postal_code: '',
    geo_lat: '', geo_lng: '', is_default: false,
});

const AddressFormModal: React.FC<{
    title: string;
    initial: AddressFormState;
    saving: boolean;
    regions: { code: string; name: string }[];
    villes: { code: string; name: string }[];
    countries: { name: string }[];
    onSave: (data: AddressFormState) => void;
    onClose: () => void;
}> = ({ title, initial, saving, regions, villes, countries, onSave, onClose }) => {
    const [form, setForm] = useState<AddressFormState>(initial);
    const [extracting, setExtracting] = useState(false);
    const set = (k: keyof AddressFormState, v: string | boolean) =>
        setForm(prev => ({ ...prev, [k]: v }));

    const handleExtract = async () => {
        const lat = form.geo_lat.trim();
        const lng = form.geo_lng.trim();
        if (!lat || !lng) return;
        setExtracting(true);
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=fr`,
                { headers: { 'Accept': 'application/json' } }
            );
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const a = data.address ?? {};
            const line1Parts = [a.house_number, a.road || a.pedestrian || a.footway].filter(Boolean);
            const line1 = line1Parts.join(', ');
            const line2 = a.suburb || a.neighbourhood || a.quarter || '';
            const city = a.city || a.town || a.village || a.municipality || '';
            const postal = a.postcode || '';
            const country = a.country || '';
            setForm(prev => ({
                ...prev,
                address_line1: line1 || prev.address_line1,
                address_line2: line2 || prev.address_line2,
                city: city || prev.city,
                postal_code: postal || prev.postal_code,
                country: country || prev.country,
            }));
            toast.success('Adresse extraite avec succès');
        } catch {
            toast.error('Extraction échouée — renseignez l\'adresse manuellement');
        } finally {
            setExtracting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <span className="text-sm font-semibold text-gray-900">{title}</span>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="p-5 space-y-3 overflow-y-auto max-h-[70vh]">
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Libellé (optionnel)</label>
                        <input className={inputCls} placeholder="ex: Siège social, Entrepôt…" value={form.label} onChange={e => set('label', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Adresse ligne 1 <span className="text-red-400">*</span></label>
                        <input className={inputCls} placeholder="Rue, N° voie…" value={form.address_line1} onChange={e => set('address_line1', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Adresse ligne 2</label>
                        <input className={inputCls} placeholder="Bâtiment, Étage…" value={form.address_line2} onChange={e => set('address_line2', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Ville <span className="text-red-400">*</span></label>
                            <AddrSelect value={form.city} onChange={v => set('city', v)} placeholder="Sélectionner…">
                                {villes.map(v => (
                                    <option key={v.code} value={v.name}>{v.name}</option>
                                ))}
                            </AddrSelect>
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Code postal</label>
                            <input className={inputCls} placeholder="00000" value={form.postal_code} onChange={e => set('postal_code', e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Région</label>
                            <AddrSelect value={form.region} onChange={v => set('region', v)} placeholder="Sélectionner…">
                                {regions.map(r => (
                                    <option key={r.code} value={r.name}>{r.name}</option>
                                ))}
                            </AddrSelect>
                        </div>
                        <div>
                            <label className="block text-[11px] font-medium text-gray-500 mb-1">Pays</label>
                            <AddrSelect value={form.country} onChange={v => set('country', v)} placeholder="Sélectionner…">
                                {countries.map(c => (
                                    <option key={c.name} value={c.name}>{c.name}</option>
                                ))}
                            </AddrSelect>
                        </div>
                    </div>
                    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium text-gray-500 flex items-center gap-1">
                                <Locate className="w-3 h-3" /> Coordonnées GPS <span className="text-gray-300 font-normal">(optionnel)</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleExtract}
                                disabled={extracting || !form.geo_lat.trim() || !form.geo_lng.trim()}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-lg border border-sage-500 text-sage-600 hover:bg-sage-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                            >
                                {extracting
                                    ? <><Loader2 className="w-3 h-3 animate-spin" /> Extraction…</>
                                    : <><MapPin className="w-3 h-3" /> Extraire l'adresse</>
                                }
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Latitude</label>
                                <input className={inputCls} placeholder="33.5731" value={form.geo_lat} onChange={e => set('geo_lat', e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] text-gray-400 mb-1">Longitude</label>
                                <input className={inputCls} placeholder="-7.5898" value={form.geo_lng} onChange={e => set('geo_lng', e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)}
                            className="rounded border-gray-300 text-sage-500 focus:ring-sage-500" />
                        <span className="text-xs text-gray-600">Définir comme adresse par défaut</span>
                    </label>
                </div>
                <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-3.5 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        Annuler
                    </button>
                    <button
                        onClick={() => onSave(form)}
                        disabled={saving || !(form.address_line1 ?? '').trim() || !(form.city ?? '').trim()}
                        className="px-3.5 py-1.5 text-xs rounded-lg bg-sage-500 text-white font-medium hover:bg-sage-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PartnerAddressesSection: React.FC<{ partnerId: number }> = ({ partnerId }) => {
    const { addresses, defaultAddressId, loading, refetch, setAddresses, setDefaultAddressId } =
        usePartnerAddresses(partnerId);
    const { createAddress, loading: creating } = useCreatePartnerAddress();
    const { updateAddress, loading: updating } = useUpdatePartnerAddress();
    const { deleteAddress, loading: deleting } = useDeletePartnerAddress();
    const { setDefaultAddress, loading: settingDefault } = useSetDefaultPartnerAddress();

    const [regions, setRegions] = useState<{ code: string; name: string }[]>([]);
    const [villes, setVilles] = useState<{ code: string; name: string }[]>([]);
    const [countries, setCountries] = useState<{ name: string }[]>([]);

    useEffect(() => {
        getGeoAreas({ type_id: 2, per_page: 50 }).then(res => {
            setRegions((res.geoAreas?.data ?? []).map(g => ({ code: g.code, name: g.name })));
        }).catch(() => {});
        getGeoAreas({ type_id: 4, per_page: 200 }).then(res => {
            setVilles((res.geoAreas?.data ?? []).map(g => ({ code: g.code, name: g.name })));
        }).catch(() => {});
        getCountries().then(list => {
            setCountries(list.map(c => ({ name: c.name })));
        }).catch(() => {});
    }, []);

    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState<PartnerAddress | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

    const handleCreate = async (data: AddressFormState) => {
        const payload: PartnerAddressPayload = {
            label: data.label || undefined,
            address_line1: data.address_line1,
            address_line2: data.address_line2 || undefined,
            city: data.city,
            region: data.region || undefined,
            country: data.country || undefined,
            postal_code: data.postal_code || undefined,
            geo_lat: data.geo_lat || undefined,
            geo_lng: data.geo_lng || undefined,
            is_default: data.is_default,
        };
        const res = await createAddress({ partnerId, data: payload });
        if (res) {
            toast.success('Adresse ajoutée');
            setShowAdd(false);
            refetch();
        }
    };

    const handleUpdate = async (data: AddressFormState) => {
        if (!editing) return;
        const payload: Partial<PartnerAddressPayload> = {
            label: data.label || undefined,
            address_line1: data.address_line1,
            address_line2: data.address_line2 || undefined,
            city: data.city,
            region: data.region || undefined,
            country: data.country || undefined,
            postal_code: data.postal_code || undefined,
            geo_lat: data.geo_lat || undefined,
            geo_lng: data.geo_lng || undefined,
            is_default: data.is_default,
        };
        const res = await updateAddress({ partnerId, addressId: editing.id, data: payload });
        if (res) {
            toast.success('Adresse mise à jour');
            setEditing(null);
            refetch();
        }
    };

    const handleDelete = async (id: number) => {
        const res = await deleteAddress({ partnerId, addressId: id });
        if (res) {
            toast.success('Adresse supprimée');
            setConfirmDeleteId(null);
            setAddresses(prev => prev.filter(a => a.id !== id));
            setDefaultAddressId(res.default_address_id);
        }
    };

    const handleSetDefault = async (id: number) => {
        const res = await setDefaultAddress({ partnerId, addressId: id });
        if (res) {
            toast.success('Adresse par défaut mise à jour');
            setDefaultAddressId(res.default_address_id);
        }
    };

    return (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Adresses</span>
                {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
            </div>

            {addresses.length === 0 && !loading ? (
                <div className="p-4 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    <span className="text-xs text-gray-300 italic">Aucune adresse enregistrée</span>
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {addresses.map(addr => {
                        const isDefault = addr.id === defaultAddressId;
                        return (
                            <div key={addr.id} className="px-4 py-3 group flex items-start gap-3 hover:bg-gray-50/60 transition-colors">
                                <MapPin className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isDefault ? 'text-sage-500' : 'text-gray-300'}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        {addr.label && (
                                            <span className="text-[11px] font-semibold text-gray-700">{addr.label}</span>
                                        )}
                                        {isDefault && (
                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-sage-700 bg-sage-50 border border-sage-200 rounded-full px-1.5 py-0">
                                                <Star className="w-2.5 h-2.5" /> Défaut
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-900 font-medium leading-snug">{addr.address_line1}</div>
                                    {addr.address_line2 && <div className="text-xs text-gray-500">{addr.address_line2}</div>}
                                    <div className="text-xs text-gray-500">
                                        {[addr.city, addr.region, addr.postal_code].filter(Boolean).join(', ')}
                                        {addr.country ? ` — ${addr.country}` : ''}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {!isDefault && (
                                        <button
                                            onClick={() => handleSetDefault(addr.id)}
                                            disabled={settingDefault}
                                            title="Définir par défaut"
                                            className="p-1 rounded-md text-gray-400 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                        >
                                            <Star className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setEditing(addr)}
                                        title="Modifier"
                                        className="p-1 rounded-md text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => addresses.length === 1
                                            ? toast.error('Impossible de supprimer la seule adresse du partenaire')
                                            : setConfirmDeleteId(addr.id)
                                        }
                                        title="Supprimer"
                                        className="p-1 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <div className="px-4 pb-3 pt-2">
                <button
                    onClick={() => setShowAdd(true)}
                    className="w-full flex items-center justify-center gap-1.5 h-8 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:border-sage-400 hover:text-sage-600 hover:bg-sage-50/30 transition-all"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Ajouter une adresse
                </button>
            </div>

            {/* Confirm delete */}
            {confirmDeleteId !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </div>
                            <div>
                                <div className="text-sm font-semibold text-gray-900">Supprimer cette adresse ?</div>
                                <div className="text-xs text-gray-500">Cette action est irréversible.</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setConfirmDeleteId(null)} className="flex-1 py-2 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                                Annuler
                            </button>
                            <button
                                onClick={() => handleDelete(confirmDeleteId)}
                                disabled={deleting}
                                className="flex-1 py-2 text-xs rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                            >
                                {deleting ? 'Suppression…' : 'Supprimer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add modal */}
            {showAdd && (
                <AddressFormModal
                    title="Ajouter une adresse"
                    initial={emptyForm()}
                    saving={creating}
                    regions={regions}
                    villes={villes}
                    countries={countries}
                    onSave={handleCreate}
                    onClose={() => setShowAdd(false)}
                />
            )}

            {/* Edit modal */}
            {editing && (
                <AddressFormModal
                    title="Modifier l'adresse"
                    initial={{
                        label: editing.label ?? '',
                        address_line1: editing.address_line1 ?? '',
                        address_line2: editing.address_line2 ?? '',
                        city: editing.city ?? '',
                        region: editing.region ?? '',
                        country: editing.country ?? '',
                        postal_code: editing.postal_code ?? '',
                        geo_lat: editing.geo_lat ?? '',
                        geo_lng: editing.geo_lng ?? '',
                        is_default: editing.id === defaultAddressId,
                    }}
                    saving={updating}
                    regions={regions}
                    villes={villes}
                    countries={countries}
                    onSave={handleUpdate}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
};

// ─── SearchableSelect ─────────────────────────────────────────────────────────

interface SSOption { id: number | string; label: string; }
interface SearchableSelectProps {
    options: SSOption[];
    value: number | string | null | undefined;
    onChange: (id: number | string | null) => void;
    placeholder?: string;
    loading?: boolean;
    className?: string;
}

const SearchableSelect = ({ options, value, onChange, placeholder = 'Sélectionner…', loading, className }: SearchableSelectProps) => {
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

    const selected = options.find(o => String(o.id) === String(value ?? ''));
    const filtered = options.filter(o => !search || o.label.toLowerCase().includes(search.toLowerCase()));

    const openDrop = () => {
        if (triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
        }
        setOpen(true);
    };

    return (
        <>
            <div ref={triggerRef}
                className={`flex items-center gap-1.5 border border-gray-200 rounded-md px-2.5 py-2 bg-white cursor-pointer ${className ?? ''}`}
                onClick={() => open ? setOpen(false) : openDrop()}>
                {open
                    ? <input autoFocus
                        className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400 min-w-0"
                        placeholder={selected?.label ?? placeholder}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onBlur={() => setTimeout(() => { setOpen(false); setSearch(''); }, 150)}
                        onClick={e => e.stopPropagation()} />
                    : <span className={`flex-1 text-xs truncate ${selected ? 'text-gray-800' : 'text-gray-400'}`}>
                        {selected?.label ?? placeholder}
                    </span>
                }
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
            {open && ReactDOM.createPortal(
                <div style={{ position: 'absolute', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
                    className="bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {loading
                        ? <div className="px-3 py-2.5 text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Chargement...</div>
                        : filtered.length === 0
                            ? <div className="px-3 py-2.5 text-xs text-gray-400 italic">Aucun résultat</div>
                            : filtered.map(o => (
                                <div key={o.id}
                                    onMouseDown={() => { onChange(o.id); setSearch(''); setOpen(false); }}
                                    className={`px-3 py-2 text-xs cursor-pointer hover:bg-indigo-50 ${String(o.id) === String(value ?? '') ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}>
                                    {o.label}
                                </div>
                            ))
                    }
                </div>,
                document.body
            )}
        </>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PartnerManagementPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('general');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        identite: true, adresses: true, contacts: true, commercial: true, credit: true, info: true,
    });
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    // Filters
    const [filters, setFilters] = useState<PartnerFilters>({ page: 1, per_page: 20 });
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<PartnerStatus | ''>('');
    const [channelFilter, setChannelFilter] = useState<string>('');

    // Itinerary assignment panel (expanded fields)
    const [showItineraryPanel, setShowItineraryPanel] = useState(false);
    const [selectedItineraryId, setSelectedItineraryId] = useState<number | null>(null);
    const [itineraryForm, setItineraryForm] = useState<{
        rank?: number; visit_frequency_days?: number;
        start_time?: string; end_time?: string;
        is_stop_point?: boolean; notes?: string;
    }>({});

    // Credit evaluate
    const [evaluateAmount, setEvaluateAmount] = useState('');
    const [showEvaluateForm, setShowEvaluateForm] = useState(false);

    // Contacts
    const [showContactForm, setShowContactForm] = useState(false);
    const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
    const [contactForm, setContactForm] = useState<PartnerContactPayload>({ name: '' });

    // Payer
    const [payerSearch, setPayerSearch] = useState('');
    const [showPayerPicker, setShowPayerPicker] = useState(false);

    // Price list override panel
    const [showPriceListOverride, setShowPriceListOverride] = useState(false);


    // Image upload ref
    const imageInputRef = React.useRef<HTMLInputElement>(null);

    // Form mode: 'view' | 'create' | 'edit'
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');

    // Draft management
    const { drafts, hasDrafts, deleteDraft, refresh: refreshDrafts } = usePartnerDraft();
    const [activeDraft, setActiveDraft] = useState<PartnerDraft | null>(null);
    const [dismissedDraftBanner, setDismissedDraftBanner] = useState(false);

    // Refresh draft list whenever form closes
    useEffect(() => { if (formMode === 'view') refreshDrafts(); }, [formMode, refreshDrafts]);

    // Modals (kept for quick-action dialogs)
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);

    // Forms
    const [statusForm, setStatusForm] = useState<Partial<UpdateStatusRequest>>({});
    const [blockForm, setBlockForm] = useState<Partial<BlockPartnerRequest>>({});
    const [creditForm, setCreditForm] = useState<Partial<UpdateCreditRequest>>({});

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    // Tracks the "wait cursor" style tag + its pending removal timeout, so rapid
    // row clicks don't leave a stray <style> tag or race against each other.
    const cursorStyleTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // ── Data hooks ────────────────────────────────────────────────────────────
    const { data: partnersData, loading: partnersLoading, error: partnersError, refetch: refetchPartners } = usePartnersList(filters);
    const partners = partnersData?.data || [];

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = usePartnerDetail(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );
    const partnerDetail = detailData?.partner || selectedPartner;

    const { data: statsData, refetch: refetchStats } = usePartnerStatistics();
    const stats = statsData?.statistics;

    const { data: masterData, loading: masterDataLoading, fetch: fetchMasterData } = usePartnerFormMasterData();

    const { data: creditHistoryData, loading: creditHistLoading, refetch: refetchCreditHistory } = useCreditHistory(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );

    const { data: creditExposureData, loading: creditExposureLoading, refetch: refetchCreditExposure } = useCreditExposure(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );

    const { data: creditEventsData, loading: creditEventsLoading, refetch: refetchCreditEvents } = useCreditEvents(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );

    const { data: paymentTermsData, loading: paymentTermsLoading, refetch: refetchPaymentTerms } = usePaymentTerms(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );

    const { data: availableItineraries, loading: itinerariesLoading, fetch: fetchItineraries } = useAvailableItineraries();
    const { data: partnerItinerary, loading: partnerItineraryLoading, fetch: fetchPartnerItinerary, reset: resetPartnerItinerary } = usePartnerItinerary();

    const { evaluate: evaluateCreditFn, data: evaluateResult, loading: evaluateLoading, reset: resetEvaluate } = useEvaluateCreditOrder();
    const { execute: uploadImageFn } = useUploadPartnerImage();
    const { data: paymentMethods, loading: paymentMethodsLoading } = usePaymentMethods();
    const { data: channelsData, loading: channelsLoading } = useChannels();

    const { data: partnerContacts, loading: contactsLoading, refetch: refetchContacts } = usePartnerContacts(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );
    const { execute: createContactFn, loading: creatingContact } = useCreatePartnerContact();
    const { execute: updateContactFn, loading: updatingContact } = useUpdatePartnerContact();
    const { execute: deleteContactFn, loading: deletingContact } = useDeletePartnerContact();
    const { execute: setDefaultContactFn, loading: settingDefaultContact } = useSetDefaultPartnerContact();

    const { data: payerData, loading: payerLoading, refetch: refetchPayer } = usePartnerPayer(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );
    const { execute: updatePayerFn, loading: updatingPayer } = useUpdatePartnerPayer();

    // Mutations
    const { execute: createPartner, loading: creating } = useCreatePartner();
    const { updatePartner, loading: updating } = useUpdatePartner();
    const { execute: deletePartner, loading: deleting } = useDeletePartner();
    const { execute: toggleStatusFn } = useToggleStatus();
    const { updateStatus, loading: updatingStatus } = useUpdateStatus();
    const { blockPartner, loading: blocking } = useBlockPartner();
    const { execute: unblockPartnerFn } = useUnblockPartner();
    const { updateCredit, loading: updatingCredit } = useUpdateCredit();
    const { execute: recalcCreditFn } = useRecalcCredit();
    const { execute: recalcCreditExposureFn } = useRecalcCreditExposure();
    const { assignItinerary, loading: assigningItinerary } = useAssignItinerary();
    const { removeFromItinerary, loading: removingItinerary } = useRemoveFromItinerary();
    const { attachPaymentTerm } = useAttachPaymentTerm();
    const { detachPaymentTerm } = useDetachPaymentTerm();
    const { setDefaultPaymentTerm } = useSetDefaultPaymentTerm();

    // Master data needed for view-mode dropdowns (channel, price list override, etc.)
    useEffect(() => { fetchMasterData(); }, [fetchMasterData]);

    // ── Itinerary §11.1 — auto-fetch enriched view when section is open ──────
    useEffect(() => {
        if (partnerDetail?.id && activeTab === 'general') {
            fetchPartnerItinerary(partnerDetail.id);
        }
    }, [partnerDetail?.id, activeTab, fetchPartnerItinerary]);

    useEffect(() => {
        if (!partnerDetail) resetPartnerItinerary();
    }, [partnerDetail, resetPartnerItinerary]);

    // ── Cleanup any pending "wait cursor" style tag / timeout on unmount ─────
    useEffect(() => {
        return () => {
            if (cursorStyleTimeoutRef.current) clearTimeout(cursorStyleTimeoutRef.current);
            document.getElementById('loading-cursor-style')?.remove();
        };
    }, []);

    // ── Search with debounce ─────────────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearchInput(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, q: value || undefined, page: 1 }));
        }, 400);
    };

    // ── Status / channel filters ─────────────────────────────────────────────
    // Combined into a single effect (was two separate effects) so that
    // changing status + channel together only triggers one filters update,
    // and a ref guard skips the redundant fetch that would otherwise fire
    // on mount (both filters start empty, same as initial `filters` state).
    const filtersMountedRef = useRef(false);
    useEffect(() => {
        if (!filtersMountedRef.current) {
            filtersMountedRef.current = true;
            return;
        }
        setFilters(prev => ({
            ...prev,
            status: statusFilter || undefined,
            channel: channelFilter || undefined,
            page: 1,
        }));
    }, [statusFilter, channelFilter]);

    // ── Column defs ───────────────────────────────────────────────────────────
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 110,
            pinned: 'left',
            cellStyle: { fontWeight: '600', fontFamily: 'monospace', fontSize: '11px' } as any,
        },
        {
            field: 'name',
            headerName: 'Raison sociale',
            flex: 1,
            minWidth: 180,
            cellStyle: { fontWeight: '500' } as any,
        },
        {
            field: 'partner_type',
            headerName: 'Type',
            width: 110,
            cellRenderer: (p: any) => p.value
                ? <span className="text-xs font-medium text-gray-700">{p.value}</span>
                : <span className="text-gray-300">—</span>,
            sortable: false,
            filter: false,
        },
        {
            field: 'city',
            headerName: 'Ville',
            width: 120,
            cellStyle: { color: '#6b7280', fontSize: '12px' } as any,
        },
        {
            field: 'salesperson',
            headerName: 'Représentant',
            width: 150,
            valueGetter: (p: any) => p.data?.salesperson?.name ?? null,
            cellRenderer: (p: any) => p.value
                ? (
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[9px] shrink-0">
                            {String(p.value).charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs truncate">{p.value}</span>
                    </div>
                )
                : <span className="text-gray-300 text-xs">—</span>,
            sortable: false,
            filter: false,
        },
        {
            field: 'channel_ref',
            headerName: 'Canal',
            width: 110,
            valueGetter: (p: any) => p.data?.channel_ref?.name ?? p.data?.channel ?? null,
            cellRenderer: (p: any) => p.value
                ? <span className="text-xs font-medium text-gray-700">{p.value}</span>
                : <span className="text-gray-300">—</span>,
            sortable: false,
            filter: false,
        },
        {
            field: 'payer',
            headerName: 'Client payeur',
            width: 150,
            valueGetter: (p: any) => p.data?.payer?.name ?? null,
            cellRenderer: (p: any) => p.value
                ? <span className="text-xs text-indigo-700 font-medium truncate">{p.value}</span>
                : <span className="text-gray-300">—</span>,
            sortable: false,
            filter: false,
        },
        {
            field: 'payment_term',
            headerName: 'Paiement',
            width: 140,
            valueGetter: (p: any) => p.data?.payment_term?.name ?? null,
            cellRenderer: (p: any) => p.value
                ? <span className="text-xs text-gray-700">{p.value}</span>
                : <span className="text-gray-300 text-xs">—</span>,
            sortable: false,
            filter: false,
        },
        {
            field: 'status',
            headerName: 'Statut',
            width: 100,
            cellRenderer: (p: any) => {
                const s = STATUS_COLORS[p.value as PartnerStatus] || STATUS_COLORS.ACTIVE;
                return (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
                        {s.label}
                    </span>
                );
            },
            sortable: false,
            filter: false,
        },
    ], []);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs: TabItem[] = useMemo(() => [
        { id: 'identite',  label: 'Identité',         icon: FileText   },
        { id: 'adresses',  label: 'Adresses',         icon: MapPin     },
        { id: 'contacts',  label: 'Contacts',         icon: Users      },
        { id: 'commercial',label: 'Commercial',       icon: Tag        },
        { id: 'credit',    label: 'Paiement & Crédit',icon: CreditCard },
        { id: 'info',      label: 'Info. suppl.',     icon: BookOpen   },
    ], []);

    // ── Row selection ─────────────────────────────────────────────────────────
    const handleSelectPartner = useCallback((row: Partner) => {
        // Clear any pending removal from a previous rapid click, and avoid
        // stacking duplicate <style> tags if one is already present.
        if (cursorStyleTimeoutRef.current) clearTimeout(cursorStyleTimeoutRef.current);
        if (!document.getElementById('loading-cursor-style')) {
            const style = document.createElement('style');
            style.id = 'loading-cursor-style';
            style.innerHTML = '* { cursor: wait !important; }';
            document.head.appendChild(style);
        }

        setSelectedPartner(row);
        setShowDetailPanel(true);
        setFormMode('view');
        setActiveTab('identite');
        setShowPriceListOverride(false);

        cursorStyleTimeoutRef.current = setTimeout(() => {
            document.getElementById('loading-cursor-style')?.remove();
            cursorStyleTimeoutRef.current = undefined;
        }, 800);
    }, []);

    // ── Tab navigation + scroll-spy ───────────────────────────────────────────
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };

    const toggleSection = (id: string, isOpen: boolean) => setOpenSections(prev => ({ ...prev, [id]: isOpen }));
    const handleExpandAll  = () => setOpenSections({ identite: true, adresses: true, contacts: true, commercial: true, credit: true, info: true });
    const handleCollapseAll = () => setOpenSections({ identite: false, adresses: false, contacts: false, commercial: false, credit: false, info: false });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (isScrollingRef.current) return;
            const top = container.scrollTop;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el) continue;
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;
                if (elTop <= top + 100 && elBottom > top + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, [openSections, tabs, activeTab]);

    // ── Inline Form Handlers ─────────────────────────────────────────────────
    const handleOpenCreate = async () => {
        setSelectedPartner(null);
        setActiveDraft(null);
        setShowDetailPanel(true);
        setFormMode('create');
        fetchMasterData();
    };

    const handleResumeDraft = async (draft: PartnerDraft) => {
        setActiveDraft(draft);
        setSelectedPartner(null);
        setShowDetailPanel(true);
        setFormMode('create');
        setDismissedDraftBanner(false);
        fetchMasterData();
    };

    const handleOpenEdit = async () => {
        if (!partnerDetail) return;
        setFormMode('edit');
        fetchMasterData();
    };

    const handleCancelForm = () => {
        setActiveDraft(null);
        if (formMode === 'create') {
            setFormMode('view');
            setShowDetailPanel(false);
            setSelectedPartner(null);
        } else {
            setFormMode('view');
        }
    };

    const handleSavePartner = async (payload: PartnerSavePayload) => {
        const toastId = toast.loading(payload.mode === 'edit' ? 'Mise à jour...' : 'Création...');
        try {
            if (payload.mode === 'edit' && selectedPartner) {
                await updatePartner({ id: selectedPartner.id, data: payload.data });
                toast.dismiss(toastId);
                toast.success('Partenaire mis à jour');
                setFormMode('view');
                refetchDetail();
            } else if (payload.mode === 'create') {
                const result = await createPartner(payload.data);
                toast.dismiss(toastId);
                toast.success('Partenaire créé avec succès');
                if (result?.partner) {
                    setSelectedPartner(result.partner);
                }
                setFormMode('view');
            }
            refetchPartners();
            refetchStats();
        } catch (e: any) {
            toast.dismiss(toastId);
            if (e?.response?.status === 422) {
                // Re-throw so PartnerFormPanel can map field-level errors
                throw e;
            }
            toast.error(e?.response?.data?.message || 'Une erreur est survenue');
        }
    };

    const handleConfirmDelete = async () => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Suppression...');
        try {
            await deletePartner(selectedPartner.id);
            toast.dismiss(toastId);
            toast.success('Partenaire supprimé');
            setShowDeleteModal(false);
            setShowDetailPanel(false);
            setSelectedPartner(null);
            refetchPartners();
            refetchStats();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleToggleStatus = async () => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Basculement du statut...');
        try {
            await toggleStatusFn(selectedPartner.id);
            toast.dismiss(toastId);
            toast.success('Statut modifié');
            refetchPartners();
            refetchDetail();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleSubmitStatus = async () => {
        if (!selectedPartner || !statusForm.status) {
            toast.error('Veuillez remplir tous les champs obligatoires');
            return;
        }
        const toastId = toast.loading('Mise à jour du statut...');
        try {
            await updateStatus({ id: selectedPartner.id, data: statusForm as UpdateStatusRequest });
            toast.dismiss(toastId);
            toast.success('Statut mis à jour');
            setShowStatusModal(false);
            refetchPartners();
            refetchDetail();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleSubmitBlock = async () => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Blocage...');
        try {
            await blockPartner({ id: selectedPartner.id, data: blockForm as BlockPartnerRequest });
            toast.dismiss(toastId);
            toast.success('Partenaire bloqué');
            setShowBlockModal(false);
            refetchPartners();
            refetchDetail();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleUnblock = async () => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Déblocage...');
        try {
            await unblockPartnerFn(selectedPartner.id);
            toast.dismiss(toastId);
            toast.success('Partenaire débloqué');
            refetchPartners();
            refetchDetail();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleSubmitCredit = async () => {
        if (!selectedPartner || creditForm.credit_limit == null) {
            toast.error('La limite de crédit est obligatoire');
            return;
        }
        const toastId = toast.loading('Mise à jour du crédit...');
        try {
            await updateCredit({ id: selectedPartner.id, data: creditForm as UpdateCreditRequest });
            toast.dismiss(toastId);
            toast.success('Crédit mis à jour');
            setShowCreditModal(false);
            refetchPartners();
            refetchDetail();
            refetchCreditHistory();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleRecalcCredit = async () => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Recalcul...');
        try {
            await recalcCreditFn(selectedPartner.id);
            await recalcCreditExposureFn(selectedPartner.id).catch(() => { });
            toast.dismiss(toastId);
            toast.success('Crédit recalculé');
            refetchDetail();
            refetchCreditHistory();
            refetchCreditExposure();
            refetchCreditEvents();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    // ── Inline channel / price list updates ──────────────────────────────────
    // PUT /partners/{id} does a full replace — name + price_list_id are always required.
    const withRequired = (partial: Record<string, unknown>) => ({
        name: partnerDetail?.name ?? selectedPartner?.name ?? '',
        price_list_id: partnerDetail?.price_list_id ?? null,
        ...partial,
    });

    const handleUpdateChannel = async (channelId: number | string) => {
        if (!selectedPartner) return;
        const numericId = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
        if (Number.isNaN(numericId)) return;
        // PUT ignores channel_id — backend only writes channel via the string code field
        const channelCode = (channelsData ?? []).find(c => c.id === numericId)?.code;
        if (!channelCode) return;
        const toastId = toast.loading('Mise à jour du canal...');
        try {
            await updatePartner({ id: selectedPartner.id, data: withRequired({ channel: channelCode }) });
            toast.dismiss(toastId);
            toast.success('Canal mis à jour');
            refetchDetail();
            refetchPartners();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleUpdatePriceList = async (priceListId: number | string) => {
        if (!selectedPartner) return;
        const numericId = typeof priceListId === 'string' ? parseInt(priceListId, 10) : priceListId;
        if (Number.isNaN(numericId)) return;
        const toastId = toast.loading('Mise à jour de la liste de prix...');
        try {
            await updatePartner({ id: selectedPartner.id, data: withRequired({ price_list_id: numericId }) });
            toast.dismiss(toastId);
            toast.success('Liste de prix mise à jour');
            refetchDetail();
            refetchPartners();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleClearPriceListOverride = async () => {
        if (!selectedPartner || !partnerDetail) return;
        // Backend cannot set price_list_id to null via PUT — align to channel's default instead
        const channelEntry = (channelsData ?? []).find(
            c => c.id === (partnerDetail.channel_ref?.id ?? partnerDetail.channel_id)
        );
        const channelPriceListId = channelEntry?.price_list_id ?? partnerDetail.channel_ref?.price_list_id;
        if (!channelPriceListId) {
            toast.error('Ce canal n\'a pas de liste de prix par défaut. L\'override ne peut pas être retiré via cette interface — contactez l\'équipe backend.');
            return;
        }
        const toastId = toast.loading('Alignement sur le canal...');
        try {
            await updatePartner({ id: selectedPartner.id, data: withRequired({ price_list_id: channelPriceListId }) });
            toast.dismiss(toastId);
            toast.success('Liste de prix alignée sur le canal');
            setShowPriceListOverride(false);
            refetchDetail();
            refetchPartners();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    // Payment terms handlers
    const handleDetachTerm = async (termId: number) => {
        if (!selectedPartner) return;
        try {
            await detachPaymentTerm({ partnerId: selectedPartner.id, termId });
            toast.success('Condition de paiement retirée');
            refetchPaymentTerms();
        } catch { toast.error('Erreur'); }
    };

    const handleSetDefaultTerm = async (termId: number) => {
        if (!selectedPartner) return;
        try {
            await setDefaultPaymentTerm({ partnerId: selectedPartner.id, termId });
            toast.success('Condition par défaut mise à jour');
            refetchPaymentTerms();
        } catch { toast.error('Erreur'); }
    };

    const handleAttachTerm = async (termId: number) => {
        if (!selectedPartner) return;
        try {
            await attachPaymentTerm({ partnerId: selectedPartner.id, data: { payment_term_id: termId } });
            toast.success('Condition de paiement ajoutée');
            refetchPaymentTerms();
        } catch { toast.error('Erreur'); }
    };

    const handleAssignItinerary = async () => {
        if (!selectedItineraryId || !partnerDetail) return;
        try {
            await assignItinerary({
                itineraryId: selectedItineraryId,
                data: {
                    partner_code: partnerDetail.code,
                    ...itineraryForm,
                    rank: itineraryForm.rank ? Number(itineraryForm.rank) : undefined,
                    visit_frequency_days: itineraryForm.visit_frequency_days ? Number(itineraryForm.visit_frequency_days) : undefined,
                },
            });
            toast.success('Partenaire affecté à la tournée');
            setShowItineraryPanel(false);
            setSelectedItineraryId(null);
            setItineraryForm({});
            refetchDetail();
            if (partnerDetail) fetchPartnerItinerary(partnerDetail.id);
        } catch { toast.error('Erreur lors de l\'affectation'); }
    };

    const handleEvaluateCredit = async () => {
        if (!selectedPartner || !evaluateAmount) return;
        await evaluateCreditFn(selectedPartner.id, parseFloat(evaluateAmount));
    };

    const handleImageUpload = async (file: File) => {
        if (!selectedPartner) return;
        const toastId = toast.loading('Téléchargement...');
        try {
            await uploadImageFn({ id: selectedPartner.id, file });
            toast.dismiss(toastId);
            toast.success('Image uploadée');
            refetchDetail();
        } catch {
            toast.dismiss(toastId);
            toast.error('Erreur upload image');
        }
    };

    const handleRemoveFromItinerary = async (itineraryId: number, itineraryPartnerId: number) => {
        try {
            await removeFromItinerary({ itineraryId, itineraryPartnerId });
            toast.success('Partenaire retiré de la tournée');
            refetchDetail();
            if (partnerDetail) fetchPartnerItinerary(partnerDetail.id);
        } catch { toast.error('Erreur lors de la suppression'); }
    };

    // ── Contact handlers ──────────────────────────────────────────────────────
    const handleSaveContact = async () => {
        if (!partnerDetail || !contactForm.name.trim()) return;
        try {
            if (editingContact) {
                await updateContactFn({ partnerId: partnerDetail.id, contactId: editingContact.id, data: contactForm });
                toast.success('Contact mis à jour');
            } else {
                await createContactFn({ partnerId: partnerDetail.id, data: contactForm });
                toast.success('Contact ajouté');
            }
            setShowContactForm(false);
            setEditingContact(null);
            setContactForm({ name: '' });
            refetchContacts();
        } catch { toast.error('Erreur lors de la sauvegarde du contact'); }
    };

    const handleDeleteContact = async (contactId: number) => {
        if (!partnerDetail) return;
        try {
            await deleteContactFn({ partnerId: partnerDetail.id, contactId });
            toast.success('Contact supprimé');
            refetchContacts();
        } catch { toast.error('Erreur lors de la suppression'); }
    };

    const handleSetDefaultContact = async (contactId: number) => {
        if (!partnerDetail) return;
        try {
            await setDefaultContactFn({ partnerId: partnerDetail.id, contactId });
            toast.success('Contact principal défini');
            refetchContacts();
        } catch { toast.error('Erreur'); }
    };

    // ── Payer handler ─────────────────────────────────────────────────────────
    const handleSetPayer = async (payerPartnerId: number | null) => {
        if (!partnerDetail) return;
        try {
            await updatePayerFn({ partnerId: partnerDetail.id, payerPartnerId });
            toast.success(payerPartnerId ? 'Payeur défini' : 'Payeur retiré');
            refetchPayer();
            setShowPayerPicker(false);
            setPayerSearch('');
        } catch { toast.error('Erreur lors de la mise à jour du payeur'); }
    };

    // Refresh all
    const handleRefreshAll = async () => {
        const toastId = toast.loading('Actualisation...');
        await refetchPartners();
        refetchStats();
        if (selectedPartner) refetchDetail();
        toast.dismiss(toastId);
        toast.success('Données actualisées');
    };

    // ── Action panel ──────────────────────────────────────────────────────────
    type AVariant = 'default' | 'danger' | 'primary' | 'sage';
    type AItem = { icon: React.ElementType; label: string; variant: AVariant; onClick?: () => void; disabled?: boolean };
    const actionGroups = useMemo(() => {
        const groups: { items: AItem[] }[] = [
            {
                items: [
                    { icon: Plus, label: 'Nouveau partenaire', variant: 'sage', onClick: handleOpenCreate },
                    { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: handleRefreshAll },
                ],
            },
        ];
        if (selectedPartner && showDetailPanel && formMode === 'view') {
            groups.push({
                items: [
                    { icon: Edit2, label: 'Modifier', variant: 'primary', onClick: handleOpenEdit },
                    { icon: ArrowUpDown, label: 'Basculer statut', variant: 'default', onClick: handleToggleStatus },
                    { icon: Shield, label: 'Changer statut', variant: 'default', onClick: () => { setStatusForm({}); setShowStatusModal(true); } },
                    ...(partnerDetail?.status !== 'BLOCKED' ? [
                        { icon: Ban, label: 'Bloquer', variant: 'danger' as AVariant, onClick: () => { setBlockForm({}); setShowBlockModal(true); } },
                    ] : [
                        { icon: Unlock, label: 'Débloquer', variant: 'primary' as AVariant, onClick: handleUnblock },
                    ]),
                    { icon: CreditCard, label: 'Modifier crédit', variant: 'default', onClick: () => { setCreditForm({ credit_limit: toNum(partnerDetail?.credit_limit) }); setShowCreditModal(true); } },
                ],
            });
            groups.push({
                items: [
                    { icon: Trash2, label: 'Supprimer', variant: 'danger', onClick: () => setShowDeleteModal(true) },
                ],
            });
        }
        return groups;
    }, [selectedPartner, showDetailPanel, formMode, partnerDetail]);

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* ── Header ─────────────────────────────────────── */}
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between">
                                <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                                    <Users className="w-4 h-4 text-sage-600" />
                                    Partenaires
                                </h1>
                                {partnersData && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">
                                        {partnersData.total}
                                    </span>
                                )}
                            </div>

                            {/* ── Draft notification banner ─────────────── */}
                            {hasDrafts && !dismissedDraftBanner && formMode === 'view' && (
                                <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                                    <div className="px-3 py-2 flex items-center gap-2">
                                        <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                        <span className="text-xs font-semibold text-amber-700 flex-1">
                                            {drafts.length === 1
                                                ? '1 brouillon non terminé'
                                                : `${drafts.length} brouillons non terminés`
                                            }
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setDismissedDraftBanner(true)}
                                            className="p-0.5 text-amber-400 hover:text-amber-700 rounded transition-colors"
                                            title="Masquer"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="px-3 pb-2 space-y-1">
                                        {drafts.map(draft => (
                                            <div key={draft.id} className="flex items-center gap-2 group">
                                                <button
                                                    type="button"
                                                    onClick={() => handleResumeDraft(draft)}
                                                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left rounded-lg bg-white border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-all shadow-sm"
                                                >
                                                    <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                                                        <BookOpen className="w-3 h-3 text-amber-600" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-semibold text-gray-800 truncate">
                                                            {draft.partnerName || 'Nouveau partenaire'}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {draftRelativeTime(draft.savedAt)}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => deleteDraft(draft.id)}
                                                    className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Supprimer ce brouillon"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Rechercher par nom, code, email..."
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-gray-50"
                                />
                                {searchInput && (
                                    <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {/* Filters row */}
                            <div className="flex gap-2 mt-2">
                                <div className="flex-1 relative">
                                    <select
                                        value={statusFilter}
                                        onChange={e => setStatusFilter(e.target.value as PartnerStatus | '')}
                                        className="w-full appearance-none text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-sage-400 focus:border-sage-300 cursor-pointer"
                                    >
                                        <option value="">Tous statuts</option>
                                        <option value="ACTIVE">Actifs</option>
                                        <option value="ON_HOLD">En attente</option>
                                        <option value="BLOCKED">Bloqués</option>
                                        <option value="CLOSED">Fermés</option>
                                    </select>
                                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
                                </div>
                                <div className="flex-1 relative">
                                    <select
                                        value={channelFilter}
                                        onChange={e => setChannelFilter(e.target.value)}
                                        className="w-full appearance-none text-[11px] text-gray-600 bg-white border border-gray-200 rounded-md pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-300 cursor-pointer"
                                    >
                                        <option value="">Tous canaux</option>
                                        <option value="GMS">GMS</option>
                                        <option value="GROS">Gros</option>
                                        <option value="DETAIL">Détail</option>
                                        <option value="CHR">CHR</option>
                                        <option value="SOM_GROS">Semi-Gros</option>
                                        <option value="OTHER">Autre</option>
                                    </select>
                                    <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]">▾</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Error banner ──────────────────────────────── */}
                        {partnersError && (
                            <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100 bg-red-50 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {partnersError}
                            </div>
                        )}

                        {/* ── DataGrid ──────────────────────────────────── */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                {partnersLoading ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={partners}
                                        columnDefs={columnDefs}
                                        loading={partnersLoading}
                                        onRowDoubleClicked={handleSelectPartner}
                                        rowSelection="single"
                                    />
                                )}
                            </div>
                        </div>

                        {/* ── Pagination ────────────────────────────────── */}
                        {partnersData && (partnersData.last_page ?? 1) > 1 && (
                            <div className="p-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
                                <span>Page {partnersData.current_page} / {partnersData.last_page}</span>
                                <div className="flex gap-1">
                                    <button
                                        disabled={partnersData.current_page <= 1}
                                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) - 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        &larr;
                                    </button>
                                    <button
                                        disabled={partnersData.current_page >= (partnersData.last_page ?? 1)}
                                        onClick={() => setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }))}
                                        className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        &rarr;
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                }

                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {/* ── Inline Form Panel (Create / Edit) ── */}
                        {showDetailPanel && (formMode === 'create' || formMode === 'edit') ? (
                            <PartnerFormPanel
                                mode={formMode}
                                partner={formMode === 'edit' ? partnerDetail : null}
                                masterData={masterData}
                                masterDataLoading={masterDataLoading}
                                onSave={handleSavePartner}
                                onCancel={handleCancelForm}
                                saving={creating || updating}
                                initialCustomFields={formMode === 'edit' ? (detailData?.customFields ?? null) : null}
                                initialDraft={activeDraft}
                                onAfterSave={id => deleteDraft(id).catch(() => { })}
                            />
                        ) : showDetailPanel && partnerDetail ? (
                            <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
                                {/* ── Detail Header ────────────────────── */}
                                <div className="p-3 sm:p-4 border-b border-gray-200 shrink-0">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="flex items-start gap-3 min-w-0 flex-1">
                                            <button onClick={() => setShowDetailPanel(false)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors shrink-0" title="Retour">
                                                <X className="w-5 h-5 text-gray-600" />
                                            </button>
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                                {partnerDetail.name?.charAt(0)?.toUpperCase() || 'P'}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{partnerDetail.name}</h1>
                                                    {(() => {
                                                        const s = STATUS_COLORS[partnerDetail.status];
                                                        const Icon = STATUS_ICONS[partnerDetail.status];
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${s.bg} ${s.text}`}>
                                                                <Icon className="w-3 h-3" /> {s.label}
                                                            </span>
                                                        );
                                                    })()}
                                                </div>
                                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                                    <span className="font-mono font-medium">{partnerDetail.code}</span>
                                                    {partnerDetail.partner_type && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{partnerDetail.partner_type}</span>}
                                                    {partnerDetail.channel && <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">{partnerDetail.channel}</span>}
                                                    {partnerDetail.price_list && <span>Tarif: {partnerDetail.price_list.name}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <div className={`text-xl sm:text-2xl font-bold whitespace-nowrap ${toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {fmtNumber(partnerDetail.credit_available)}
                                                <span className="text-xs sm:text-sm font-normal text-gray-400 ml-1">dispo.</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                                {/* Image upload */}
                                                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                                                    onChange={e => e.target.files?.[0] && handleImageUpload(e.target.files[0])} />
                                                <button
                                                    onClick={() => imageInputRef.current?.click()}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                                                    title="Uploader une image"
                                                >
                                                    <Upload className="w-3 h-3" />
                                                </button>
                                            </div>
                                            {detailLoading && (
                                                <div className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* ── Tabs ────────────────────────────── */}
                                <div className="shrink-0 bg-white border-b border-gray-200 overflow-hidden">
                                    <SageTabs
                                        tabs={tabs}
                                        activeTabId={activeTab}
                                        onTabChange={handleTabChange}
                                        onExpandAll={handleExpandAll}
                                        onCollapseAll={handleCollapseAll}
                                        className="shadow-none"
                                    />
                                </div>

                                {/* ── Scrollable sections (scroll-spy) ── */}
                                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Identité ─────────────────────── */}
                                    <div ref={el => { sectionRefs.current['identite'] = el; }}>
                                        <SageCollapsible
                                            title="Identité"
                                            isOpen={openSections['identite']}
                                            onOpenChange={open => toggleSection('identite', open)}
                                        >
                                            <div className="space-y-3">
                                                {/* Blocking alert */}
                                                {partnerDetail.status === 'BLOCKED' && (
                                                    <div className="p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3">
                                                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                                                            <Ban className="w-4 h-4 text-red-600" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-semibold text-red-800">Partenaire bloqué</div>
                                                            {partnerDetail.blocked_until && <div className="text-xs text-red-600 mt-0.5">Jusqu'au {fmtDate(partnerDetail.blocked_until)}</div>}
                                                            {partnerDetail.block_reason && <div className="text-xs text-red-600 mt-0.5">{partnerDetail.block_reason}</div>}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Status strip */}
                                                <div className="grid grid-cols-4 divide-x divide-gray-100 bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    {[
                                                        { label: 'Statut', value: STATUS_COLORS[partnerDetail.status]?.label ?? partnerDetail.status, cls: STATUS_COLORS[partnerDetail.status]?.text ?? 'text-gray-700' },
                                                        { label: 'Type', value: partnerDetail.partner_type || '—', cls: 'text-gray-800' },
                                                        { label: 'Canal', value: partnerDetail.channel || '—', cls: 'text-indigo-700' },
                                                        { label: 'Crédit dispo', value: fmtNumber(partnerDetail.credit_available), cls: toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600' },
                                                    ].map(kpi => (
                                                        <div key={kpi.label} className="px-3 py-3 text-center">
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</div>
                                                            <div className={`text-sm font-bold ${kpi.cls}`}>{kpi.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* 2-col: Identification + Contact */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {/* Identification */}
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Identification</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {[
                                                                { label: 'Code',       value: partnerDetail.code,              mono: true  },
                                                                { label: 'Raison soc.',value: partnerDetail.name,              mono: false },
                                                                { label: 'Type',       value: partnerDetail.partner_type,      mono: false },
                                                                { label: 'ICE',        value: partnerDetail.tax_number_ice,    mono: true  },
                                                                { label: 'IF',         value: partnerDetail.tax_number_if,     mono: true  },
                                                            ].map(row => row.value ? (
                                                                <div key={row.label} className="flex items-center justify-between px-4 py-2.5 gap-3">
                                                                    <span className="text-xs text-gray-400 shrink-0 w-20">{row.label}</span>
                                                                    <span className={`text-xs font-medium text-gray-900 truncate text-right ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
                                                                </div>
                                                            ) : null)}
                                                            <div className="flex items-center justify-between px-4 py-2.5 gap-3">
                                                                <span className="text-xs text-gray-400 shrink-0 w-20">Exo. TVA</span>
                                                                <span className={`text-xs font-medium ${partnerDetail.tax_exempt ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                                    {partnerDetail.tax_exempt ? 'Oui' : 'Non'}
                                                                </span>
                                                            </div>
                                                            <div className="px-4 py-2 text-[10px] text-gray-300">
                                                                Créé {fmtDate(partnerDetail.created_at)} · MàJ {fmtDate(partnerDetail.updated_at)}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Contact */}
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Phone className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Contact</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {[
                                                                { icon: Mail,     label: 'Email',     value: partnerDetail.email,    href: partnerDetail.email    ? `mailto:${partnerDetail.email}` : undefined },
                                                                { icon: Phone,    label: 'Tél.',      value: partnerDetail.phone,    href: partnerDetail.phone    ? `tel:${partnerDetail.phone}`   : undefined },
                                                                { icon: Phone,    label: 'WhatsApp',  value: partnerDetail.whatsapp, href: undefined },
                                                                { icon: Building2,label: 'Site web',  value: partnerDetail.website,  href: undefined },
                                                            ].map(item => (
                                                                <div key={item.label} className="flex items-center gap-3 px-4 py-2.5">
                                                                    <item.icon className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                                                    <span className="text-xs text-gray-400 w-14 shrink-0">{item.label}</span>
                                                                    {item.value
                                                                        ? item.href
                                                                            ? <a href={item.href} className="text-xs font-medium text-blue-600 hover:underline truncate">{item.value}</a>
                                                                            : <span className="text-xs font-medium text-gray-900 truncate">{item.value}</span>
                                                                        : <span className="text-xs text-gray-300">—</span>}
                                                                </div>
                                                            ))}
                                                            {partnerDetail.customer?.user && (
                                                                <div className="px-4 py-2.5 flex items-center gap-2">
                                                                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-[9px] shrink-0">
                                                                        {partnerDetail.customer.user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-xs font-semibold text-gray-900 truncate">{partnerDetail.customer.user.name}</div>
                                                                        <div className="text-[10px] text-gray-400 truncate">{partnerDetail.customer.user.email}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Rattachements */}
                                                {(partnerDetail.salesperson || partnerDetail.geo_area) && (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Users className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Rattachements</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {partnerDetail.salesperson && (
                                                                <div className="flex items-center gap-3 px-4 py-2.5">
                                                                    <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-[10px] shrink-0">
                                                                        {partnerDetail.salesperson.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-[10px] text-gray-400">Représentant</div>
                                                                        <div className="text-xs font-semibold text-gray-900">{partnerDetail.salesperson.name}</div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {partnerDetail.geo_area && (
                                                                <div className="flex items-center justify-between px-4 py-2.5">
                                                                    <span className="text-xs text-gray-400">Zone géo.</span>
                                                                    <span className="text-xs font-semibold text-gray-800">{partnerDetail.geo_area.name} <span className="text-gray-400 font-mono text-[10px]">({partnerDetail.geo_area.code})</span></span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Payeur */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Client payeur</span>
                                                        <button onClick={() => setShowPayerPicker(v => !v)} className="ml-auto text-[10px] text-indigo-600 hover:underline">
                                                            {showPayerPicker ? 'Fermer' : 'Modifier'}
                                                        </button>
                                                    </div>
                                                    <div className="p-3 space-y-2">
                                                        {payerLoading ? (
                                                            <div className="flex items-center gap-2 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" /> Chargement...</div>
                                                        ) : payerData?.payer ? (
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <div className="text-xs font-semibold text-indigo-700">{payerData.payer.name}</div>
                                                                    <div className="text-[10px] text-gray-400 font-mono">{payerData.payer.code}</div>
                                                                </div>
                                                                <button onClick={() => handleSetPayer(null)} disabled={updatingPayer}
                                                                    className="text-[10px] text-red-500 hover:text-red-700">Retirer</button>
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-400">Aucun payeur défini</p>
                                                        )}
                                                        {showPayerPicker && (
                                                            <div className="space-y-1.5 pt-1 border-t border-gray-100">
                                                                <input
                                                                    value={payerSearch}
                                                                    onChange={e => setPayerSearch(e.target.value)}
                                                                    placeholder="Rechercher un partenaire…"
                                                                    className="w-full text-xs border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
                                                                />
                                                                <div className="max-h-32 overflow-y-auto divide-y divide-gray-50 rounded-lg border border-gray-100">
                                                                    {(payerData?.candidates ?? [])
                                                                        .filter(c => !payerSearch || c.name.toLowerCase().includes(payerSearch.toLowerCase()) || c.code.toLowerCase().includes(payerSearch.toLowerCase()))
                                                                        .map(c => (
                                                                            <button key={c.id} onClick={() => handleSetPayer(c.id)} disabled={updatingPayer}
                                                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-indigo-50 text-left transition-colors">
                                                                                <span className="text-xs font-medium text-gray-900">{c.name}</span>
                                                                                <span className="text-[10px] font-mono text-gray-400">{c.code}</span>
                                                                            </button>
                                                                        ))
                                                                    }
                                                                    {(payerData?.candidates ?? []).length === 0 && (
                                                                        <div className="px-3 py-2 text-xs text-gray-400">Aucun candidat disponible</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Hiérarchie */}
                                                {(partnerDetail.parent || (partnerDetail.children && partnerDetail.children.length > 0)) && (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Building2 className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Hiérarchie</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {partnerDetail.parent && (
                                                                <div className="flex items-center justify-between px-4 py-2.5">
                                                                    <span className="text-xs text-gray-400">Parent</span>
                                                                    <span className="text-xs font-semibold text-gray-800">{partnerDetail.parent.name} <span className="text-gray-400 font-mono text-[10px]">({partnerDetail.parent.code})</span></span>
                                                                </div>
                                                            )}
                                                            {(partnerDetail.children ?? []).map(child => (
                                                                <div key={child.id} className="flex items-center justify-between px-4 py-2.5">
                                                                    <span className="text-xs text-gray-400">Enfant</span>
                                                                    <span className="text-xs font-medium text-gray-700">{child.name} <span className="text-gray-400 font-mono text-[10px]">({child.code})</span></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Adresses ─────────────────────── */}
                                    <div ref={el => { sectionRefs.current['adresses'] = el; }}>
                                        <SageCollapsible
                                            title="Adresses"
                                            isOpen={openSections['adresses']}
                                            onOpenChange={open => toggleSection('adresses', open)}
                                        >
                                            <div className="space-y-3">
                                                <PartnerAddressesSection partnerId={partnerDetail.id} />
                                                {(toNum(partnerDetail.min_order_amount) > 0 || partnerDetail.delivery_zone || partnerDetail.delivery_instructions) && (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Truck className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Livraison</span>
                                                        </div>
                                                        <div className="divide-y divide-gray-50">
                                                            {toNum(partnerDetail.min_order_amount) > 0 && (
                                                                <div className="flex items-center justify-between px-4 py-2.5">
                                                                    <span className="text-xs text-gray-400">Commande min.</span>
                                                                    <span className="text-xs font-semibold text-gray-800">{fmtNumber(partnerDetail.min_order_amount)}</span>
                                                                </div>
                                                            )}
                                                            {partnerDetail.delivery_zone && (
                                                                <div className="flex items-center justify-between px-4 py-2.5">
                                                                    <span className="text-xs text-gray-400">Zone livraison</span>
                                                                    <span className="text-xs font-semibold text-gray-800">{partnerDetail.delivery_zone}</span>
                                                                </div>
                                                            )}
                                                            {partnerDetail.delivery_instructions && (
                                                                <div className="px-4 py-2.5">
                                                                    <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 leading-relaxed">
                                                                        {partnerDetail.delivery_instructions}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Contacts ─────────────────────── */}
                                    <div ref={el => { sectionRefs.current['contacts'] = el; }}>
                                        <SageCollapsible
                                            title="Contacts"
                                            isOpen={openSections['contacts']}
                                            onOpenChange={open => toggleSection('contacts', open)}
                                        >
                                            <div className="space-y-3">
                                                {/* Contact list */}
                                                {contactsLoading ? (
                                                    <div className="flex items-center justify-center py-6 text-gray-400 text-xs"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...</div>
                                                ) : (partnerContacts ?? []).length > 0 ? (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-50">
                                                        {(partnerContacts ?? []).map(contact => (
                                                            <div key={contact.id} className="flex items-start gap-3 px-4 py-3">
                                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-[11px] shrink-0">
                                                                    {contact.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-xs font-semibold text-gray-900">{contact.name}</span>
                                                                        {contact.is_primary && (
                                                                            <span className="text-[9px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-semibold border border-indigo-100">Principal</span>
                                                                        )}
                                                                    </div>
                                                                    {contact.job_title && <div className="text-[10px] text-gray-400 mt-0.5">{contact.job_title}</div>}
                                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                        {contact.phone && <a href={`tel:${contact.phone}`} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"><Phone className="w-2.5 h-2.5" />{contact.phone}</a>}
                                                                        {contact.email && <a href={`mailto:${contact.email}`} className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5"><Mail className="w-2.5 h-2.5" />{contact.email}</a>}
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {!contact.is_primary && (
                                                                        <button onClick={() => handleSetDefaultContact(contact.id)} disabled={settingDefaultContact}
                                                                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors" title="Définir comme principal">
                                                                            <Star className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                    <button onClick={() => { setEditingContact(contact); setContactForm({ name: contact.name, job_title: contact.job_title ?? undefined, phone: contact.phone ?? undefined, email: contact.email ?? undefined, notes: contact.notes ?? undefined, is_primary: contact.is_primary }); setShowContactForm(true); }}
                                                                        className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => handleDeleteContact(contact.id)} disabled={deletingContact}
                                                                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl">
                                                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                        <p className="text-xs text-gray-400">Aucun contact enregistré</p>
                                                    </div>
                                                )}

                                                {/* Add / Edit form */}
                                                {!showContactForm ? (
                                                    <button onClick={() => { setShowContactForm(true); setEditingContact(null); setContactForm({ name: '' }); }}
                                                        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors">
                                                        <Plus className="w-3.5 h-3.5" /> Ajouter un contact
                                                    </button>
                                                ) : (
                                                    <div className="p-3 rounded-xl border border-indigo-200 bg-white space-y-2">
                                                        <div className="text-xs font-semibold text-gray-700">{editingContact ? 'Modifier le contact' : 'Nouveau contact'}</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="col-span-2">
                                                                <label className="block text-[10px] text-gray-500 mb-1">Nom *</label>
                                                                <input value={contactForm.name} onChange={e => setContactForm(f => ({ ...f, name: e.target.value }))}
                                                                    placeholder="Prénom Nom" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 mb-1">Fonction</label>
                                                                <input value={contactForm.job_title ?? ''} onChange={e => setContactForm(f => ({ ...f, job_title: e.target.value || undefined }))}
                                                                    placeholder="Directeur…" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 mb-1">Téléphone</label>
                                                                <input value={contactForm.phone ?? ''} onChange={e => setContactForm(f => ({ ...f, phone: e.target.value || undefined }))}
                                                                    placeholder="+212 6…" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                            </div>
                                                            <div className="col-span-2">
                                                                <label className="block text-[10px] text-gray-500 mb-1">Email</label>
                                                                <input type="email" value={contactForm.email ?? ''} onChange={e => setContactForm(f => ({ ...f, email: e.target.value || undefined }))}
                                                                    placeholder="contact@exemple.com" className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-400" />
                                                            </div>
                                                        </div>
                                                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                            <input type="checkbox" checked={contactForm.is_primary ?? false} onChange={e => setContactForm(f => ({ ...f, is_primary: e.target.checked }))}
                                                                className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600" />
                                                            Contact principal
                                                        </label>
                                                        <div className="flex gap-2">
                                                            <button onClick={handleSaveContact} disabled={!contactForm.name.trim() || creatingContact || updatingContact}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40">
                                                                {(creatingContact || updatingContact) ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                                Enregistrer
                                                            </button>
                                                            <button onClick={() => { setShowContactForm(false); setEditingContact(null); setContactForm({ name: '' }); }}
                                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">
                                                                Annuler
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Commercial ───────────────────── */}
                                    <div ref={el => { sectionRefs.current['commercial'] = el; }}>
                                        <SageCollapsible
                                            title="Commercial"
                                            isOpen={openSections['commercial']}
                                            onOpenChange={open => toggleSection('commercial', open)}
                                        >
                                            <div className="space-y-3">
                                                {/* KPI strip */}
                                                <div className="grid grid-cols-3 divide-x divide-gray-100 bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="px-3 py-3 text-center">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Canal</div>
                                                        <div className="text-sm font-bold text-indigo-700">{partnerDetail.channel || '—'}</div>
                                                    </div>
                                                    <div className="px-3 py-3 text-center">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Tarif</div>
                                                        <div className="text-sm font-bold text-sage-700 truncate">{partnerDetail.price_list?.name || '—'}</div>
                                                    </div>
                                                    <div className="px-3 py-3 text-center">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Remise défaut</div>
                                                        <div className="text-sm font-bold text-gray-800">{partnerDetail.default_discount_rate ?? 0}%</div>
                                                    </div>
                                                </div>

                                                {/* Canal de vente */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                                                        <span className="text-xs font-semibold text-gray-700">Canal de vente</span>
                                                    </div>
                                                    <div className="p-3">
                                                        <SearchableSelect
                                                            options={(channelsData ?? []).map(ch => ({ id: ch.id, label: `${ch.code} — ${ch.name}` }))}
                                                            value={partnerDetail.channel_ref?.id ?? partnerDetail.channel_id ?? null}
                                                            onChange={v => handleUpdateChannel(v ?? '')}
                                                            placeholder="— Sélectionner —"
                                                            loading={channelsLoading}
                                                            className="w-full"
                                                        />
                                                    </div>
                                                </div>

                                                {/* Liste de prix — résolue via canal, override optionnel */}
                                                {(() => {
                                                    const channelDefaultPlId = (channelsData ?? []).find(
                                                        c => c.id === (partnerDetail.channel_ref?.id ?? partnerDetail.channel_id)
                                                    )?.price_list_id ?? partnerDetail.channel_ref?.price_list_id;
                                                    const hasOverride = !!partnerDetail.price_list_id && partnerDetail.price_list_id !== channelDefaultPlId;
                                                    const resolvedViaChannel = partnerDetail.channel_ref
                                                        ? (channelsData ?? []).find(c => c.id === (partnerDetail.channel_ref?.id ?? partnerDetail.channel_id))?.price_list
                                                        : null;
                                                    const isOpen = hasOverride || showPriceListOverride;
                                                    return (
                                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                                                <div className="flex items-center gap-2">
                                                                    <DollarSign className="w-3.5 h-3.5 text-sage-500" />
                                                                    <span className="text-xs font-semibold text-gray-700">Liste de prix</span>
                                                                    {hasOverride && (
                                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 bg-amber-50 text-amber-600 border border-amber-200 rounded">Override</span>
                                                                    )}
                                                                </div>
                                                                {!hasOverride && (
                                                                    <button
                                                                        onClick={() => setShowPriceListOverride(v => !v)}
                                                                        className="text-[11px] text-indigo-500 hover:text-indigo-700 font-medium"
                                                                    >
                                                                        {showPriceListOverride ? 'Annuler' : '+ Override'}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="p-3 space-y-2">
                                                                {/* Resolved value info */}
                                                                {!isOpen && (
                                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                                        <span className="text-gray-400">Auto via canal :</span>
                                                                        {resolvedViaChannel
                                                                            ? <span className="font-medium text-gray-700">{resolvedViaChannel.name}</span>
                                                                            : <span className="italic text-gray-400">{partnerDetail.channel_ref ? 'Canal sans liste de prix' : 'Aucun canal assigné'}</span>
                                                                        }
                                                                    </div>
                                                                )}
                                                                {/* Override picker */}
                                                                {isOpen && (
                                                                    <div className="space-y-2">
                                                                        {resolvedViaChannel && !hasOverride && (
                                                                            <div className="text-[11px] text-gray-400">
                                                                                Auto : <span className="text-gray-600">{resolvedViaChannel.name}</span>
                                                                            </div>
                                                                        )}
                                                                        <SearchableSelect
                                                                            options={(masterData?.price_lists ?? []).map(pl => ({ id: pl.id, label: `${pl.code} — ${pl.name}` }))}
                                                                            value={partnerDetail.price_list_id ?? null}
                                                                            onChange={v => handleUpdatePriceList(v ?? '')}
                                                                            placeholder="— Choisir un override —"
                                                                            loading={masterDataLoading}
                                                                            className="w-full border-amber-300 bg-amber-50"
                                                                        />
                                                                        {hasOverride && (
                                                                            <button
                                                                                onClick={handleClearPriceListOverride}
                                                                                className="text-[11px] text-red-500 hover:text-red-700 font-medium"
                                                                            >
                                                                                × Retirer l'override
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}

                                                {/* Chronologies */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Chronologies commerciales</span>
                                                    </div>
                                                    <div className="p-3">
                                                        {partnerDetail.id && <PartnerChronologyChips partnerId={partnerDetail.id} />}
                                                    </div>
                                                </div>

                                                {/* Tournées */}
                                                {(() => {
                                                    const enrichedItins = partnerItinerary?.itineraries ?? [];
                                                    const flatItins = (partnerDetail as any).itinerary_partners as any[] | undefined ?? [];
                                                    const alloc = partnerItinerary?.allocation;
                                                    const pivotId = (itineraryId: number): number | undefined =>
                                                        flatItins.find((ip: any) => ip.itinerary_id === itineraryId)?.id;
                                                    return (
                                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                                <Route className="w-3.5 h-3.5 text-indigo-500" />
                                                                <span className="text-xs font-semibold text-gray-700">Tournées assignées</span>
                                                                {alloc && <span className="ml-1 text-[10px] text-gray-400">· priorité {alloc.allocation_priority} · min {alloc.min_allocation_pct}%</span>}
                                                                <span className="ml-auto text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{enrichedItins.length}</span>
                                                            </div>
                                                            <div className="p-3 space-y-2">
                                                                {partnerItineraryLoading ? (
                                                                    <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
                                                                ) : enrichedItins.length > 0 ? (
                                                                    enrichedItins.map(it => {
                                                                        const pid = pivotId(it.itinerary_id);
                                                                        return (
                                                                            <div key={it.itinerary_id} className="flex items-center justify-between p-2.5 rounded-lg border border-indigo-100 bg-indigo-50/30 gap-3">
                                                                                <div className="min-w-0">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <span className="text-xs font-semibold text-gray-900">{it.itinerary_name}</span>
                                                                                        <span className="font-mono text-[10px] text-gray-400 bg-white px-1 rounded border border-gray-200">{it.itinerary_code}</span>
                                                                                        {it.rank > 0 && <span className="text-[10px] text-gray-400">Rang {it.rank}</span>}
                                                                                        {it.visit_frequency_days > 0 && <span className="text-[10px] text-gray-400">/{it.visit_frequency_days}j</span>}
                                                                                        {!it.is_active && <span className="text-[9px] px-1 py-0.5 bg-gray-200 text-gray-500 rounded-full">Inactif</span>}
                                                                                    </div>
                                                                                </div>
                                                                                {pid !== undefined && (
                                                                                    <button onClick={() => handleRemoveFromItinerary(it.itinerary_id, pid)} disabled={removingItinerary}
                                                                                        className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 shrink-0">
                                                                                        <Unlink className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <p className="text-center text-xs text-gray-400 py-4">Aucune tournée assignée</p>
                                                                )}
                                                                {!showItineraryPanel ? (
                                                                    <button onClick={() => { setShowItineraryPanel(true); if (!masterData?.itineraries?.length) fetchItineraries(); }}
                                                                        className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition-colors">
                                                                        <Link2 className="w-3.5 h-3.5" /> Affecter à une tournée
                                                                    </button>
                                                                ) : (
                                                                    <div className="p-3 rounded-xl border border-indigo-200 bg-white space-y-2">
                                                                        <div className="text-xs font-semibold text-gray-700">Affecter à une tournée</div>
                                                                        <SearchableSelect
                                                                            options={(masterData?.itineraries?.length ? masterData.itineraries : (availableItineraries ?? [])).map(it => ({ id: it.id, label: `${it.name} (${it.code})` }))}
                                                                            value={selectedItineraryId ?? null}
                                                                            onChange={v => setSelectedItineraryId(v ? Number(v) : null)}
                                                                            placeholder="Rechercher une tournée…"
                                                                            loading={masterDataLoading || itinerariesLoading}
                                                                            className="w-full"
                                                                        />
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Rang</label>
                                                                                <input type="number" min="0" value={itineraryForm.rank ?? ''} onChange={e => setItineraryForm(f => ({ ...f, rank: e.target.value ? Number(e.target.value) : undefined }))} placeholder="0" className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Fréquence (j)</label>
                                                                                <input type="number" min="1" value={itineraryForm.visit_frequency_days ?? ''} onChange={e => setItineraryForm(f => ({ ...f, visit_frequency_days: e.target.value ? Number(e.target.value) : undefined }))} placeholder="7" className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                        </div>
                                                                        <div className="flex gap-2">
                                                                            <button onClick={handleAssignItinerary} disabled={!selectedItineraryId || assigningItinerary}
                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40">
                                                                                {assigningItinerary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />} Affecter
                                                                            </button>
                                                                            <button onClick={() => { setShowItineraryPanel(false); setSelectedItineraryId(null); setItineraryForm({}); }}
                                                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">Annuler</button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Paiement & Crédit ────────────── */}
                                    <div ref={el => { sectionRefs.current['credit'] = el; }}>
                                        <SageCollapsible
                                            title="Paiement & Crédit"
                                            isOpen={openSections['credit']}
                                            onOpenChange={open => toggleSection('credit', open)}
                                        >

                                            <div className="space-y-3">
                                                {/* KPI strip */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="grid grid-cols-3 divide-x divide-gray-100">
                                                        <div className="px-4 py-3 text-center">
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Limite crédit</div>
                                                            <div className="text-base font-bold text-gray-900 tabular-nums">{fmtNumber(partnerDetail.credit_limit)}</div>
                                                        </div>
                                                        <div className="px-4 py-3 text-center">
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Utilisé</div>
                                                            <div className="text-base font-bold text-amber-600 tabular-nums">{fmtNumber(partnerDetail.credit_used)}</div>
                                                        </div>
                                                        <div className="px-4 py-3 text-center">
                                                            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Disponible</div>
                                                            <div className={`text-base font-bold tabular-nums ${toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                {fmtNumber(partnerDetail.credit_available)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Credit management */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                                                        <span className="text-xs font-semibold text-gray-700">Crédit & Exposition</span>
                                                        <div className="ml-auto flex gap-1.5">
                                                            <button onClick={() => { setCreditForm({ credit_limit: toNum(partnerDetail.credit_limit) }); setShowCreditModal(true); }}
                                                                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-sage-50 text-sage-700 rounded-md hover:bg-sage-100 transition-colors">
                                                                <Edit2 className="w-2.5 h-2.5" /> Modifier limite
                                                            </button>
                                                            <button onClick={handleRecalcCredit}
                                                                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                                                                <RefreshCw className="w-2.5 h-2.5" /> Recalculer
                                                            </button>
                                                            <button onClick={() => { setShowEvaluateForm(v => !v); resetEvaluate(); setEvaluateAmount(''); }}
                                                                className="flex items-center gap-1 px-2 py-1 text-[10px] bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors">
                                                                <Calculator className="w-2.5 h-2.5" /> Simuler
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="p-3 space-y-3">
                                                        {showEvaluateForm && (
                                                            <div className="p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2">
                                                                <div className="text-xs font-semibold text-indigo-800">Simuler l'éligibilité d'une commande</div>
                                                                <div className="flex gap-2">
                                                                    <input type="number" value={evaluateAmount} onChange={e => setEvaluateAmount(e.target.value)}
                                                                        placeholder="Montant (ex: 15000)"
                                                                        className="flex-1 text-xs border border-indigo-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                                                                    <button onClick={handleEvaluateCredit} disabled={!evaluateAmount || evaluateLoading}
                                                                        className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                                                                        {evaluateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
                                                                        Simuler
                                                                    </button>
                                                                </div>
                                                                {evaluateResult && (
                                                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${evaluateResult.eligible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                                        {evaluateResult.eligible
                                                                            ? <><CheckCircle className="w-3.5 h-3.5 shrink-0" /> Commande autorisée — crédit restant: {fmtNumber(evaluateResult.available_after)}</>
                                                                            : <><XCircleIcon className="w-3.5 h-3.5 shrink-0" /> Refusée ({evaluateResult.status}) — manque: {fmtNumber(evaluateResult.shortfall)}{evaluateResult.requires_approval ? ' — dérogation requise' : ''}</>
                                                                        }
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Credit Exposure */}
                                                        {creditExposureLoading ? (
                                                            <div className="flex items-center justify-center py-4 text-gray-400 text-xs">
                                                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement exposition...
                                                            </div>
                                                        ) : creditExposureData ? (() => {
                                                            const exp = creditExposureData;
                                                            const colors = CREDIT_EXPOSURE_COLORS[exp.status] ?? CREDIT_EXPOSURE_COLORS.ALLOWED;
                                                            const pct = exp.credit_limit > 0 ? Math.min(100, (exp.total_exposure / exp.credit_limit) * 100) : 0;
                                                            return (
                                                                <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
                                                                    <div className="flex items-center justify-between mb-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <Zap className={`w-4 h-4 ${colors.text}`} />
                                                                            <span className={`text-sm font-bold ${colors.text}`}>Exposition temps réel</span>
                                                                        </div>
                                                                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${colors.border} ${colors.bg} ${colors.text}`}>{colors.label}</span>
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                                            <span>Total: <strong>{fmtNumber(exp.total_exposure)}</strong></span>
                                                                            <span>Limite: <strong>{fmtNumber(exp.credit_limit)}</strong></span>
                                                                        </div>
                                                                        <div className="h-2 bg-white rounded-full overflow-hidden border border-gray-200">
                                                                            <div className={`h-full rounded-full transition-all ${colors.bar}`} style={{ width: `${pct}%` }} />
                                                                        </div>
                                                                        <div className="flex justify-between text-[10px] mt-0.5">
                                                                            <span className={`font-semibold ${colors.text}`}>{pct.toFixed(1)}% utilisé</span>
                                                                            <span className="text-gray-500">Dispo: {fmtNumber(exp.available_credit)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        {[
                                                                            { label: 'Factures ouvertes', value: exp.open_invoices_amount, show: exp.open_invoices_amount > 0 },
                                                                            { label: 'Chèques en attente', value: exp.pending_cheques_amount, show: exp.pending_cheques_amount > 0 },
                                                                            { label: 'Effets en attente', value: exp.pending_effets_amount, show: exp.pending_effets_amount > 0 },
                                                                            { label: 'Commandes confirmées', value: exp.confirmed_orders_amount, show: exp.confirmed_orders_amount > 0 },
                                                                            { label: 'Livré non facturé', value: exp.delivered_not_invoiced_amount, show: exp.delivered_not_invoiced_amount > 0 },
                                                                            { label: 'Avoirs', value: -exp.credit_notes_amount, show: exp.credit_notes_amount > 0 },
                                                                        ].filter(r => r.show).map(row => (
                                                                            <div key={row.label} className="flex justify-between bg-white/60 rounded-lg px-2.5 py-1.5 border border-white/80 text-xs">
                                                                                <span className="text-gray-500 truncate mr-1">{row.label}</span>
                                                                                <span className={`font-semibold shrink-0 ${row.value < 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                                                                                    {row.value < 0 ? '−' : ''}{fmtNumber(Math.abs(row.value))}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/60">
                                                                        {exp.overdue_invoice_count > 0 && (
                                                                            <span className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                                                                                <AlertTriangle className="w-3 h-3" />
                                                                                {exp.overdue_invoice_count} facture(s) en retard — {exp.oldest_overdue_days}j max
                                                                            </span>
                                                                        )}
                                                                        <span className="text-[10px] text-gray-400 ml-auto">Recalculé {fmtDate(exp.last_recalculated_at)}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })() : null}
                                                    </div>
                                                </div>

                                                {/* Credit history */}
                                                {(creditHistLoading || (creditHistoryData?.data && (creditHistoryData.data.orders.length > 0 || creditHistoryData.data.deliveries.length > 0))) && (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Activity className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Historique de crédit</span>
                                                        </div>
                                                        <div className="p-3 space-y-3">
                                                            {creditHistLoading ? (
                                                                <div className="flex items-center justify-center py-6 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...</div>
                                                            ) : creditHistoryData?.data ? (
                                                                <>
                                                                    {creditHistoryData.data.orders.length > 0 && (
                                                                        <div>
                                                                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Bons de commande</div>
                                                                            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                                                                {creditHistoryData.data.orders.slice(0, 10).map(o => (
                                                                                    <div key={o.id} className="flex items-center justify-between py-2 px-3 bg-white hover:bg-gray-50 text-xs">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-mono font-semibold text-sage-700">{o.order_code}</span>
                                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${o.order_status === 'Delivered' || o.order_status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : o.order_status === 'Confirm' || o.order_status === 'CONFIRMED' ? 'bg-sage-50 text-sage-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                                {o.order_status}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="text-gray-400">{fmtDate(o.created_at)}</span>
                                                                                            <span className="font-semibold tabular-nums">{fmtNumber(o.total_amount)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {creditHistoryData.data.deliveries.length > 0 && (
                                                                        <div>
                                                                            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Bons de livraison</div>
                                                                            <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                                                                {creditHistoryData.data.deliveries.slice(0, 10).map(d => (
                                                                                    <div key={d.id} className="flex items-center justify-between py-2 px-3 bg-white hover:bg-gray-50 text-xs">
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-mono font-semibold text-sage-700">{d.delivery_code || d.code}</span>
                                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${(d.delivery_status || d.status) === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                                                {d.delivery_status || d.status}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-3">
                                                                                            <span className="text-gray-400">{fmtDate(d.created_at)}</span>
                                                                                            <span className="font-semibold tabular-nums">{fmtNumber(d.total_amount)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Credit events audit trail */}
                                                {!creditEventsLoading && (creditEventsData?.length ?? 0) > 0 && (
                                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                            <Activity className="w-3.5 h-3.5 text-indigo-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Audit Trail — Événements crédit</span>
                                                        </div>
                                                        <div className="p-3">
                                                            <div className="relative border-l-2 border-gray-100 ml-3 space-y-1">
                                                                {(creditEventsData ?? []).slice(0, 15).map(ev => {
                                                                    const evMeta = CREDIT_EVENT_ICONS[ev.event_type] ?? { icon: '•', color: 'text-gray-500' };
                                                                    return (
                                                                        <div key={ev.id} className="relative pl-4 -ml-px">
                                                                            <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-gray-300" />
                                                                            <div className="bg-gray-50 rounded-lg border border-gray-100 px-3 py-2 text-xs flex items-center justify-between hover:bg-white transition-colors">
                                                                                <div className="flex items-center gap-2 min-w-0">
                                                                                    <span>{evMeta.icon}</span>
                                                                                    <span className="text-gray-600 truncate">{ev.event_type.replace(/_/g, ' ')}</span>
                                                                                    {ev.reference_id && <span className="text-gray-300 text-[10px] shrink-0">#{ev.reference_id}</span>}
                                                                                </div>
                                                                                <div className="flex items-center gap-3 shrink-0 ml-2">
                                                                                    <span className={`font-semibold tabular-nums ${ev.amount >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                                                        {ev.amount >= 0 ? '+' : ''}{fmtNumber(ev.amount)}
                                                                                    </span>
                                                                                    <span className="text-gray-400 text-[10px]">{fmtDate(ev.created_at)}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* ── Conditions de paiement ── */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <DollarSign className="w-3.5 h-3.5 text-sage-500" />
                                                        <span className="text-xs font-semibold text-gray-700">Conditions de paiement</span>
                                                    </div>
                                                    <div className="p-3">
                                                        {paymentTermsLoading ? (
                                                            <div className="flex items-center justify-center py-6 text-gray-400 text-xs">
                                                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...
                                                            </div>
                                                        ) : paymentTermsData ? (
                                                            <PaymentTermsContent
                                                                paymentTermsData={paymentTermsData}
                                                                onSetDefault={handleSetDefaultTerm}
                                                                onDetach={handleDetachTerm}
                                                                onAttach={handleAttachTerm}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </div>

                                                {/* ── Modes de règlement ── */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                            <Banknote className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Modes de règlement</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 italic">Référentiel global</span>
                                                    </div>
                                                    <div className="p-3">
                                                        {paymentMethodsLoading ? (
                                                            <div className="flex items-center gap-2 text-xs text-gray-400 py-3 justify-center">
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...
                                                            </div>
                                                        ) : (
                                                            <div className="divide-y divide-gray-50">
                                                                {(paymentMethods ?? []).map(pm => (
                                                                    <div key={pm.id} className="flex items-center gap-3 px-1 py-2.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pm.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                                        <span className="text-xs font-semibold text-gray-800 w-16 shrink-0">{pm.code}</span>
                                                                        <span className="text-xs text-gray-500 truncate">{pm.name}</span>
                                                                        {!pm.is_active && <span className="ml-auto text-[10px] text-gray-400">Inactif</span>}
                                                                    </div>
                                                                ))}
                                                                {(paymentMethods ?? []).length === 0 && (
                                                                    <div className="text-center py-4 text-xs text-gray-400">Aucun mode de règlement configuré</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                            {/* [orphaned tournees IIFE removed — content now inside commercial tab] */}
                                            {(() => { return null; })()}
                                            {(false && (() => {
                                                const enrichedItins = partnerItinerary?.itineraries ?? [];
                                                const flatItins = (partnerDetail as any).itinerary_partners as any[] | undefined ?? [];
                                                const alloc = partnerItinerary?.allocation;
                                                const pivotId = (itineraryId: number): number | undefined =>
                                                    flatItins.find((ip: any) => ip.itinerary_id === itineraryId)?.id;
                                                const hasItins = enrichedItins.length > 0 || (partnerItineraryLoading && flatItins.length > 0);
                                                return (
                                                    <div className="space-y-3">
                                                        {alloc && (
                                                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                                <div className="grid grid-cols-3 divide-x divide-gray-100">
                                                                    <div className="px-4 py-3 text-center">
                                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Priorité alloc</div>
                                                                        <div className="text-sm font-bold text-slate-700 capitalize">{alloc.allocation_priority}</div>
                                                                    </div>
                                                                    <div className="px-4 py-3 text-center">
                                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Min alloc</div>
                                                                        <div className="text-sm font-bold text-slate-700">{alloc.min_allocation_pct}%</div>
                                                                    </div>
                                                                    <div className="px-4 py-3 text-center">
                                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Tournées</div>
                                                                        <div className="text-sm font-bold text-indigo-700">{enrichedItins.length}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                                <Route className="w-3.5 h-3.5 text-indigo-500" />
                                                                <span className="text-xs font-semibold text-gray-700">Tournées assignées</span>
                                                                <span className="ml-auto text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{enrichedItins.length}</span>
                                                            </div>
                                                            <div className="p-3 space-y-2">
                                                                {partnerItineraryLoading ? (
                                                                    <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
                                                                ) : hasItins ? (
                                                                    enrichedItins.map((it) => {
                                                                        const pid = pivotId(it.itinerary_id);
                                                                        const nextVisit = it.visit_date
                                                                            ? new Date(it.visit_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                                                                            : null;
                                                                        return (
                                                                            <div key={it.itinerary_id} className="flex items-start justify-between p-3 rounded-xl border border-indigo-100 bg-indigo-50/30 gap-3">
                                                                                <div className="flex items-start gap-3 min-w-0">
                                                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${it.is_active ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                                                                                        <Route className={`w-4 h-4 ${it.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
                                                                                    </div>
                                                                                    <div className="min-w-0">
                                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                                            <span className="text-sm font-semibold text-gray-900">{it.itinerary_name}</span>
                                                                                            {!it.is_active && <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full font-medium">Inactif</span>}
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap mt-0.5">
                                                                                            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">{it.itinerary_code}</span>
                                                                                            <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{it.itinerary_type}</span>
                                                                                            {it.rank > 0 && <span>Rang {it.rank}</span>}
                                                                                            {it.visit_frequency_days > 0 && <span>/{it.visit_frequency_days}j</span>}
                                                                                            {it.start_time && it.end_time && <span><Clock className="inline w-2.5 h-2.5 mr-0.5" />{it.start_time}–{it.end_time}</span>}
                                                                                            {it.is_stop_point && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">Arrêt officiel</span>}
                                                                                            {nextVisit && <span className="text-emerald-600 font-medium">Prochain: {nextVisit}</span>}
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                {pid !== undefined && (
                                                                                    <button onClick={() => handleRemoveFromItinerary(it.itinerary_id, pid)} disabled={removingItinerary}
                                                                                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                                                                                        title="Retirer de cette tournée">
                                                                                        <Unlink className="w-3.5 h-3.5" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })
                                                                ) : (
                                                                    <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                                                        <Route className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                                        <p>Aucune tournée assignée</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="px-3 pb-3">
                                                                {!showItineraryPanel ? (
                                                                    <button onClick={() => { setShowItineraryPanel(true); if (!masterData?.itineraries?.length) fetchItineraries(); }}
                                                                        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors">
                                                                        <Link2 className="w-3.5 h-3.5" /> Affecter à une tournée
                                                                    </button>
                                                                ) : (
                                                                    <div className="p-3 rounded-xl border border-indigo-200 bg-white space-y-3">
                                                                        <div className="text-xs font-semibold text-gray-700">Affecter à une tournée</div>
                                                                        {(masterDataLoading || itinerariesLoading) ? (
                                                                            <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="w-3 h-3 animate-spin" /> Chargement...</div>
                                                                        ) : (
                                                                            <select value={selectedItineraryId ?? ''} onChange={e => setSelectedItineraryId(e.target.value ? Number(e.target.value) : null)}
                                                                                className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50">
                                                                                <option value="">Sélectionner une tournée…</option>
                                                                                {(masterData?.itineraries?.length ? masterData.itineraries : (availableItineraries ?? [])).map(it => (
                                                                                    <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                                                                                ))}
                                                                            </select>
                                                                        )}
                                                                        <div className="grid grid-cols-2 gap-2">
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Rang</label>
                                                                                <input type="number" min="0" value={itineraryForm.rank ?? ''} onChange={e => setItineraryForm(f => ({ ...f, rank: e.target.value ? Number(e.target.value) : undefined }))}
                                                                                    placeholder="0" className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Fréquence (j)</label>
                                                                                <input type="number" min="1" value={itineraryForm.visit_frequency_days ?? ''} onChange={e => setItineraryForm(f => ({ ...f, visit_frequency_days: e.target.value ? Number(e.target.value) : undefined }))}
                                                                                    placeholder="7" className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Heure début</label>
                                                                                <input type="time" value={itineraryForm.start_time ?? ''} onChange={e => setItineraryForm(f => ({ ...f, start_time: e.target.value || undefined }))}
                                                                                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                            <div><label className="block text-[10px] text-gray-500 mb-1">Heure fin</label>
                                                                                <input type="time" value={itineraryForm.end_time ?? ''} onChange={e => setItineraryForm(f => ({ ...f, end_time: e.target.value || undefined }))}
                                                                                    className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                        </div>
                                                                        <div><label className="block text-[10px] text-gray-500 mb-1">Notes livreur</label>
                                                                            <input type="text" value={itineraryForm.notes ?? ''} onChange={e => setItineraryForm(f => ({ ...f, notes: e.target.value || undefined }))}
                                                                                placeholder="Livraison avant ouverture" className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-gray-50" /></div>
                                                                        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                                            <input type="checkbox" checked={itineraryForm.is_stop_point ?? false} onChange={e => setItineraryForm(f => ({ ...f, is_stop_point: e.target.checked }))}
                                                                                className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600" />
                                                                            Point d'arrêt officiel
                                                                        </label>
                                                                        <div className="flex gap-2">
                                                                            <button onClick={handleAssignItinerary} disabled={!selectedItineraryId || assigningItinerary}
                                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40">
                                                                                {assigningItinerary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                                                                                Affecter
                                                                            </button>
                                                                            <button onClick={() => { setShowItineraryPanel(false); setSelectedItineraryId(null); setItineraryForm({}); }}
                                                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200">
                                                                                Annuler
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })())}

                                    {/* ── [Règlement merged into Paiement & Crédit above] ── */}
                                    {(false && <div ref={el => { sectionRefs.current['reglement'] = el; }}>
                                        <SageCollapsible
                                            title="Règlement"
                                            isOpen={openSections['reglement'] ?? false}
                                            onOpenChange={open => toggleSection('reglement', open)}
                                        >
                                            <div className="space-y-3">
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <DollarSign className="w-3.5 h-3.5 text-sage-500" />
                                                        <span className="text-xs font-semibold text-gray-700">Conditions de paiement</span>
                                                    </div>
                                                    <div className="p-3">
                                                        {paymentTermsLoading ? (
                                                            <div className="flex items-center justify-center py-6 text-gray-400 text-xs">
                                                                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...
                                                            </div>
                                                        ) : paymentTermsData ? (
                                                            <PaymentTermsContent
                                                                paymentTermsData={paymentTermsData}
                                                                onSetDefault={handleSetDefaultTerm}
                                                                onDetach={handleDetachTerm}
                                                                onAttach={handleAttachTerm}
                                                            />
                                                        ) : null}
                                                    </div>
                                                </div>

                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2">
                                                            <Banknote className="w-3.5 h-3.5 text-gray-400" />
                                                            <span className="text-xs font-semibold text-gray-700">Modes de règlement</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 italic">Référentiel global</span>
                                                    </div>
                                                    <div className="p-3">
                                                        {paymentMethodsLoading ? (
                                                            <div className="flex items-center gap-2 text-xs text-gray-400 py-3 justify-center">
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...
                                                            </div>
                                                        ) : (
                                                            <div className="divide-y divide-gray-50">
                                                                {(paymentMethods ?? []).map(pm => (
                                                                    <div key={pm.id} className="flex items-center gap-3 px-1 py-2.5">
                                                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${pm.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                                                                        <span className="text-xs font-semibold text-gray-800 w-16 shrink-0">{pm.code}</span>
                                                                        <span className="text-xs text-gray-500 truncate">{pm.name}</span>
                                                                        {!pm.is_active && <span className="ml-auto text-[10px] text-gray-400">Inactif</span>}
                                                                    </div>
                                                                ))}
                                                                {(paymentMethods ?? []).length === 0 && (
                                                                    <div className="text-center py-4 text-xs text-gray-400">Aucun mode de règlement configuré</div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>)}

                                    {/* ── Info. suppl. ─────────────────── */}
                                    <div ref={el => { sectionRefs.current['info'] = el; }}>
                                        <SageCollapsible
                                            title="Info. suppl."
                                            isOpen={openSections['info']}
                                            onOpenChange={open => toggleSection('info', open)}
                                        >
                                            <div className="space-y-3">
                                                {/* Activité stats */}
                                                <div className="grid grid-cols-2 divide-x divide-gray-100 bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="px-3 py-3 text-center">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Nb. commandes</div>
                                                        <div className="text-sm font-bold text-gray-900">{partnerDetail.total_orders_count ?? '—'}</div>
                                                    </div>
                                                    <div className="px-3 py-3 text-center">
                                                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">CA total</div>
                                                        <div className="text-sm font-bold text-emerald-700">{toNum(partnerDetail.total_orders_value) > 0 ? fmtNumber(partnerDetail.total_orders_value) : '—'}</div>
                                                    </div>
                                                </div>

                                                {/* Risque & scoring */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <Shield className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Risque & Scoring</span>
                                                    </div>
                                                    <div className="divide-y divide-gray-50">
                                                        <div className="flex items-center justify-between px-4 py-2.5">
                                                            <span className="text-xs text-gray-400">Score de risque</span>
                                                            <span className={`text-xs font-semibold tabular-nums ${(partnerDetail.risk_score ?? 0) >= 70 ? 'text-red-600' : (partnerDetail.risk_score ?? 0) >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                {partnerDetail.risk_score ?? 0} / 100
                                                            </span>
                                                        </div>
                                                        <div className="px-4 py-2.5">
                                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                                <div
                                                                    className={`h-full rounded-full transition-all ${(partnerDetail.risk_score ?? 0) >= 70 ? 'bg-red-500' : (partnerDetail.risk_score ?? 0) >= 40 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                                                    style={{ width: `${partnerDetail.risk_score ?? 0}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                        {partnerDetail.credit_state && (
                                                            <div className="flex items-center justify-between px-4 py-2.5">
                                                                <span className="text-xs text-gray-400">État crédit</span>
                                                                <span className="text-xs font-semibold text-gray-800">{String(partnerDetail.credit_state)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Remises */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <Star className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Remises</span>
                                                    </div>
                                                    <div className="divide-y divide-gray-50">
                                                        {[
                                                            { label: 'Remise défaut (%)',  value: `${partnerDetail.default_discount_rate ?? 0}%` },
                                                            { label: 'Montant remise déf.', value: toNum(partnerDetail.default_discount_amount) > 0 ? fmtNumber(partnerDetail.default_discount_amount) : '0' },
                                                            { label: 'Remise max.',        value: `${partnerDetail.max_discount_rate ?? 0}%` },
                                                        ].map(row => (
                                                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                                                <span className="text-xs text-gray-400">{row.label}</span>
                                                                <span className="text-xs font-semibold text-gray-800">{row.value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Historique activité */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                                                        <Activity className="w-3.5 h-3.5 text-gray-400" />
                                                        <span className="text-xs font-semibold text-gray-700">Historique d'activité</span>
                                                    </div>
                                                    <div className="divide-y divide-gray-50">
                                                        {[
                                                            { label: 'Panier moyen',       value: toNum(partnerDetail.average_order_value) > 0 ? fmtNumber(partnerDetail.average_order_value) : null },
                                                            { label: 'Dernière commande',  value: partnerDetail.last_order_date ? fmtDate(partnerDetail.last_order_date) : null },
                                                            { label: 'Dernier paiement',   value: partnerDetail.last_payment_date ? fmtDate(partnerDetail.last_payment_date) : null },
                                                        ].map(row => (
                                                            <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                                                <span className="text-xs text-gray-400">{row.label}</span>
                                                                <span className="text-xs font-semibold text-gray-800">{row.value ?? '—'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Champs personnalisés ─────────────── */}
                                    {detailData?.customFields && Object.keys(detailData.customFields).length > 0 && (
                                        <div ref={el => { sectionRefs.current['champs'] = el; }}>
                                            <SageCollapsible
                                                title="Champs personnalisés"
                                                isOpen={openSections['champs'] !== false}
                                                onOpenChange={open => toggleSection('champs', open)}
                                            >
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <div className="divide-y divide-gray-50">
                                                        {Object.entries(detailData.customFields).map(([key, entry]) => (
                                                            <div key={key} className="flex items-center justify-between px-4 py-2.5 gap-3">
                                                                <span className="text-xs text-gray-400 shrink-0">{entry.label}</span>
                                                                <span className="text-xs font-semibold text-gray-900 text-right break-all">
                                                                    {entry.formatted_value || String(entry.value ?? '') || '—'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </SageCollapsible>
                                        </div>
                                    )}

                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 bg-slate-50">
                                <div className="text-center">
                                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                    <p className="text-sm font-medium">Sélectionnez un partenaire</p>
                                    <p className="text-xs text-gray-400 mt-1">Double-cliquez sur une ligne pour afficher les détails</p>
                                </div>
                            </div>
                        )}
                    </div >
                }

                rightContent={< ActionPanel groups={actionGroups} />}
            />

            {/* ── Modals ──────────────────────────────────────────────────────── */}
            {
                showDeleteModal && selectedPartner && (
                    <ModalDelete
                        partner={selectedPartner}
                        onClose={() => setShowDeleteModal(false)}
                        onConfirm={handleConfirmDelete}
                        loading={deleting}
                    />
                )
            }

            {
                showStatusModal && selectedPartner && (
                    <ModalStatus
                        partner={selectedPartner}
                        form={statusForm}
                        setForm={setStatusForm}
                        onClose={() => setShowStatusModal(false)}
                        onSubmit={handleSubmitStatus}
                        loading={updatingStatus}
                    />
                )
            }

            {
                showBlockModal && selectedPartner && (
                    <ModalBlock
                        partner={selectedPartner}
                        form={blockForm}
                        setForm={setBlockForm}
                        onClose={() => setShowBlockModal(false)}
                        onSubmit={handleSubmitBlock}
                        loading={blocking}
                    />
                )
            }

            {
                showCreditModal && selectedPartner && (
                    <ModalCredit
                        partner={selectedPartner}
                        form={creditForm}
                        setForm={setCreditForm}
                        onClose={() => setShowCreditModal(false)}
                        onSubmit={handleSubmitCredit}
                        loading={updatingCredit}
                    />
                )
            }
        </>
    );
};