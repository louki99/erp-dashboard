import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    Loader2, RefreshCw, Plus, Edit2, Trash2, Search, X,
    Users, Building2, Phone, Mail, MapPin, CreditCard, Shield,
    Ban, Unlock, FileText,
    CheckCircle2, XCircle, AlertTriangle, Clock, DollarSign,
    Star, ArrowUpDown, BookOpen, ChevronRight,
    TrendingUp, ShoppingCart, Route, Link2, Unlink,
    Activity, Zap, Wallet, Package, Truck,
    Upload, Locate, Calculator, CheckCircle, XCircle as XCircleIcon,
    Banknote, FileCheck2, ThumbsUp, ThumbsDown, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

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
    usePartnerBalances,
    useUpsertBalance,
    useDeleteBalance,
    useNearbyPartners,
    useUploadPartnerImage,
    usePaymentMethods,
    usePendingOverrides,
    useCreatePaymentOverride,
    useApproveOverride,
    useRejectOverride,
} from '@/hooks/partners/usePartners';

import type {
    Partner,
    PartnerStatus,
    PartnerFilters,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PartnerSavePayload,
    CreditExposureStatus,
    BalanceType,
    BalanceOperation,
    CreatePaymentOverrideRequest,
} from '@/types/partner.types';

import {
    ModalDelete,
    ModalStatus,
    ModalBlock,
    ModalCredit,
} from './PartnerModals';

import { PartnerFormPanel } from './PartnerFormPanel';
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

// ─── Component ────────────────────────────────────────────────────────────────

export const PartnerManagementPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('general');

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

    // Balance form
    const [showBalanceForm, setShowBalanceForm] = useState(false);
    const [balanceForm, setBalanceForm] = useState<{ balance_type: BalanceType; balance: string; operation: BalanceOperation }>({ balance_type: 'POINTS', balance: '', operation: 'add' });

    // Credit evaluate
    const [evaluateAmount, setEvaluateAmount] = useState('');
    const [showEvaluateForm, setShowEvaluateForm] = useState(false);

    // Nearby partners
    const [showNearby, setShowNearby] = useState(false);

    // Payment override form
    const [showOverrideForm, setShowOverrideForm] = useState(false);
    const [overrideForm, setOverrideForm] = useState<{
        document_type: 'order' | 'invoice';
        document_id: string;
        payment_term_id: string;
        payment_method_id: string;
        reason: string;
    }>({ document_type: 'order', document_id: '', payment_term_id: '', payment_method_id: '', reason: '' });
    const [showPendingOverrides, setShowPendingOverrides] = useState(false);

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

    // Sections
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true, credit: true, contact: true, payments: true, tournees: true, activite: true, soldes: true,
    });

    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

    const { data: balancesData, loading: balancesLoading, refetch: refetchBalances } = usePartnerBalances(
        showDetailPanel && selectedPartner ? selectedPartner.code : null
    );

    const { evaluate: evaluateCreditFn, data: evaluateResult, loading: evaluateLoading, reset: resetEvaluate } = useEvaluateCreditOrder();
    const { data: nearbyPartners, loading: nearbyLoading, findNearby, reset: resetNearby } = useNearbyPartners();
    const { execute: uploadImageFn } = useUploadPartnerImage();
    const { data: paymentMethods, loading: paymentMethodsLoading } = usePaymentMethods();
    const { data: pendingOverrides, loading: pendingOverridesLoading, refetch: refetchPendingOverrides } = usePendingOverrides();
    const { createOverride, loading: creatingOverride } = useCreatePaymentOverride();
    const { approveOverride: approveOverrideFn, loading: approvingOverride } = useApproveOverride();
    const { rejectOverride: rejectOverrideFn, loading: rejectingOverride } = useRejectOverride();

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
    const { upsertBalance, loading: upsertingBalance } = useUpsertBalance();
    const { execute: deleteBalanceFn, loading: deletingBalance } = useDeleteBalance();
    const { attachPaymentTerm } = useAttachPaymentTerm();
    const { detachPaymentTerm } = useDetachPaymentTerm();
    const { setDefaultPaymentTerm } = useSetDefaultPaymentTerm();

    // ── Itinerary §11.1 — auto-fetch enriched view when section is open ──────
    useEffect(() => {
        if (partnerDetail?.id && activeTab === 'general') {
            fetchPartnerItinerary(partnerDetail.id);
        }
    }, [partnerDetail?.id, activeTab, fetchPartnerItinerary]);

    useEffect(() => {
        if (!partnerDetail) resetPartnerItinerary();
    }, [partnerDetail, resetPartnerItinerary]);

    // ── Search with debounce ─────────────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearchInput(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, q: value || undefined, page: 1 }));
        }, 400);
    };

    // ── Status / channel filters ─────────────────────────────────────────────
    useEffect(() => {
        setFilters(prev => ({ ...prev, status: statusFilter || undefined, page: 1 }));
    }, [statusFilter]);

    useEffect(() => {
        setFilters(prev => ({ ...prev, channel: channelFilter || undefined, page: 1 }));
    }, [channelFilter]);

    // ── Column defs ───────────────────────────────────────────────────────────
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 110,
            cellStyle: { fontWeight: '600', fontFamily: 'monospace' } as any,
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            minWidth: 180,
        },
        {
            field: 'city',
            headerName: 'Ville',
            width: 100,
            cellStyle: { color: '#6b7280' } as any,
        },
        {
            field: 'status',
            headerName: 'Statut',
            width: 100,
            cellRenderer: (p: any) => {
                const s = STATUS_COLORS[p.value as PartnerStatus] || STATUS_COLORS.ACTIVE;
                return (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.bg} ${s.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                        {s.label}
                    </span>
                );
            },
            sortable: false,
            filter: false,
        },
        {
            field: 'credit_available',
            headerName: 'Crédit dispo.',
            width: 110,
            valueFormatter: (p: any) => fmtNumber(p.value),
            cellStyle: (p: any) => ({
                textAlign: 'right',
                fontWeight: '600',
                color: toNum(p.value) <= 0 ? '#dc2626' : '#059669',
            }),
        },
    ], []);

    // ── Tabs ──────────────────────────────────────────────────────────────────
    const tabs: TabItem[] = useMemo(() => [
        { id: 'general', label: 'Général', icon: FileText },
        { id: 'tarification', label: 'Tarification', icon: DollarSign },
        { id: 'reglement', label: 'Règlement', icon: Banknote },
        { id: 'finance', label: 'Finance & Crédit', icon: CreditCard },
    ], []);

    // ── Row selection ─────────────────────────────────────────────────────────
    const handleSelectPartner = useCallback((row: Partner) => {
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);

        setSelectedPartner(row);
        setShowDetailPanel(true);
        setFormMode('view');
        setActiveTab('general');

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    }, []);

    // ── Tab navigation ────────────────────────────────────────────────────────
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
    };

    const toggleSection = (sectionId: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [sectionId]: isOpen }));
    };

    const handleExpandAll = () => setOpenSections(Object.keys(openSections).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    const handleCollapseAll = () => setOpenSections(Object.keys(openSections).reduce((acc, k) => ({ ...acc, [k]: false }), {}));


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
            await recalcCreditExposureFn(selectedPartner.id).catch(() => {});
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

    const handleUpsertBalance = async () => {
        if (!partnerDetail || !balanceForm.balance_type || !balanceForm.balance) return;
        try {
            await upsertBalance({
                partner_code: partnerDetail.code,
                balance_type: balanceForm.balance_type,
                balance: parseFloat(balanceForm.balance),
                operation: balanceForm.operation,
            });
            toast.success('Solde mis à jour');
            setShowBalanceForm(false);
            setBalanceForm({ balance_type: 'POINTS', balance: '', operation: 'add' });
            refetchBalances();
        } catch { toast.error('Erreur mise à jour solde'); }
    };

    const handleDeleteBalance = async (id: number) => {
        try {
            await deleteBalanceFn(id);
            toast.success('Solde supprimé');
            refetchBalances();
        } catch { toast.error('Erreur suppression solde'); }
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

    const handleCreateOverride = async () => {
        if (!overrideForm.document_id || !overrideForm.reason) {
            toast.error('Veuillez renseigner le document et la raison');
            return;
        }
        if (!overrideForm.payment_term_id && !overrideForm.payment_method_id) {
            toast.error('Sélectionnez au moins un mode ou une condition de paiement');
            return;
        }
        const toastId = toast.loading('Création de la dérogation...');
        try {
            await createOverride({
                document_type: overrideForm.document_type,
                document_id: parseInt(overrideForm.document_id, 10),
                payment_term_id: overrideForm.payment_term_id ? parseInt(overrideForm.payment_term_id, 10) : null,
                payment_method_id: overrideForm.payment_method_id ? parseInt(overrideForm.payment_method_id, 10) : null,
                reason: overrideForm.reason,
            });
            toast.dismiss(toastId);
            toast.success('Dérogation créée avec succès');
            setShowOverrideForm(false);
            setOverrideForm({ document_type: 'order', document_id: '', payment_term_id: '', payment_method_id: '', reason: '' });
            refetchPendingOverrides();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur lors de la création');
        }
    };

    const handleApproveOverride = async (id: number) => {
        const toastId = toast.loading('Approbation...');
        try {
            await approveOverrideFn({ id });
            toast.dismiss(toastId);
            toast.success('Dérogation approuvée');
            refetchPendingOverrides();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    const handleRejectOverride = async (id: number) => {
        const reason = window.prompt('Raison du rejet :');
        if (!reason) return;
        const toastId = toast.loading('Rejet...');
        try {
            await rejectOverrideFn({ id, reason });
            toast.dismiss(toastId);
            toast.success('Dérogation rejetée');
            refetchPendingOverrides();
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
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
                        <div className="p-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
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

                            {/* KPI bar */}
                            {stats && (
                                <div className="grid grid-cols-4 gap-1.5 mb-2">
                                    {[
                                        { label: 'Actifs', value: stats.active, color: 'text-emerald-600' },
                                        { label: 'En attente', value: stats.on_hold, color: 'text-amber-600' },
                                        { label: 'Bloqués', value: stats.blocked, color: 'text-red-600' },
                                        { label: 'Total', value: stats.total, color: 'text-gray-900' },
                                    ].map(kpi => (
                                        <div key={kpi.label} className="text-center px-1 py-1.5 bg-gray-50 rounded">
                                            <div className={`text-sm font-bold ${kpi.color}`}>{kpi.value}</div>
                                            <div className="text-[9px] text-gray-400">{kpi.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

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
                                initialDraft={activeDraft}
                                onAfterSave={id => deleteDraft(id).catch(() => {})}
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
                                                {/* Nearby */}
                                                <button
                                                    onClick={() => {
                                                        if (!partnerDetail.geo_lat || !partnerDetail.geo_lng) { toast.error('Coordonnées GPS non renseignées pour ce partenaire'); return; }
                                                        setShowNearby(true);
                                                        findNearby(partnerDetail.geo_lat, partnerDetail.geo_lng, 2);
                                                    }}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                                                    title="Partenaires proches (2km)"
                                                >
                                                    <Locate className="w-3 h-3" />
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

                                {/* ── Tab panels (étanches) ──────────── */}
                                <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 bg-slate-50">
                                    {/* ── Général ─────────────────────── */}
                                    {activeTab === 'general' && (
                                    <div className="space-y-3">

                                        {/* Activity band */}
                                        {(toNum(partnerDetail.total_orders_count) > 0 || partnerDetail.last_order_date) && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                                {[
                                                    { icon: ShoppingCart, label: 'Commandes', value: String(toNum(partnerDetail.total_orders_count)), cls: 'text-indigo-700', ic: 'text-indigo-400' },
                                                    { icon: TrendingUp, label: 'Val. totale', value: fmtNumber(partnerDetail.total_orders_value), cls: 'text-sage-700', ic: 'text-sage-400' },
                                                    { icon: Activity, label: 'Panier moyen', value: fmtNumber(partnerDetail.average_order_value), cls: 'text-amber-700', ic: 'text-amber-400' },
                                                    { icon: Clock, label: 'Dern. commande', value: fmtDate(partnerDetail.last_order_date), cls: 'text-gray-700', ic: 'text-gray-400' },
                                                ].map(kpi => (
                                                    <div key={kpi.label} className="p-3 text-center">
                                                        <div className="flex items-center justify-center gap-1 mb-1">
                                                            <kpi.icon className={`w-3 h-3 ${kpi.ic}`} />
                                                            <span className="text-[10px] text-gray-400">{kpi.label}</span>
                                                        </div>
                                                        <div className={`text-sm font-bold ${kpi.cls}`}>{kpi.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

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

                                        {/* 3-col grid: Identité | Contact | Adresse */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                                            {/* Identité */}
                                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Identité</span>
                                                </div>
                                                <div className="p-4 space-y-2.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-400 text-xs">Code</span>
                                                        <span className="font-mono text-xs font-semibold bg-gray-100 px-2 py-0.5 rounded text-gray-800">{partnerDetail.code}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-400 text-xs">Nom</span>
                                                        <span className="text-xs font-semibold text-gray-900 text-right max-w-[60%] truncate" title={partnerDetail.name}>{partnerDetail.name || '—'}</span>
                                                    </div>
                                                    {partnerDetail.partner_type && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-400 text-xs">Type</span>
                                                            <span className="text-xs font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{partnerDetail.partner_type}</span>
                                                        </div>
                                                    )}
                                                    {partnerDetail.channel && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-400 text-xs">Canal</span>
                                                            <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{partnerDetail.channel}</span>
                                                        </div>
                                                    )}
                                                    <div className="pt-2 mt-1 border-t border-gray-100 space-y-1.5">
                                                        {partnerDetail.tax_number_ice && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-400 text-[11px]">ICE</span>
                                                                <span className="font-mono text-[11px] text-gray-700">{partnerDetail.tax_number_ice}</span>
                                                            </div>
                                                        )}
                                                        {partnerDetail.tax_number_if && (
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-400 text-[11px]">IF</span>
                                                                <span className="font-mono text-[11px] text-gray-700">{partnerDetail.tax_number_if}</span>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-400 text-[11px]">Exonéré TVA</span>
                                                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${partnerDetail.tax_exempt ? 'bg-green-50 text-green-700' : 'text-gray-400'}`}>
                                                                {partnerDetail.tax_exempt ? 'Oui' : 'Non'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[10px] text-gray-300 pt-1 border-t border-gray-100">
                                                        Créé {fmtDate(partnerDetail.created_at)} · MàJ {fmtDate(partnerDetail.updated_at)}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Contact */}
                                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {[
                                                        { icon: Mail, label: 'Email', value: partnerDetail.email, href: partnerDetail.email ? `mailto:${partnerDetail.email}` : undefined },
                                                        { icon: Phone, label: 'Téléphone', value: partnerDetail.phone, href: partnerDetail.phone ? `tel:${partnerDetail.phone}` : undefined },
                                                        { icon: Phone, label: 'WhatsApp', value: partnerDetail.whatsapp },
                                                        { icon: Building2, label: 'Site web', value: partnerDetail.website },
                                                    ].map(item => (
                                                        <div key={item.label} className="flex items-center gap-2.5">
                                                            <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                                                <item.icon className="w-3 h-3 text-gray-500" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">{item.label}</div>
                                                                {item.value ? (
                                                                    item.href ? (
                                                                        <a href={item.href} className="text-xs font-medium text-blue-700 hover:underline truncate block">{item.value}</a>
                                                                    ) : (
                                                                        <div className="text-xs font-medium text-gray-900 truncate">{item.value}</div>
                                                                    )
                                                                ) : (
                                                                    <div className="text-xs text-gray-300">—</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {partnerDetail.customer?.user && (
                                                        <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-[9px] shrink-0">
                                                                {partnerDetail.customer.user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-[11px] font-semibold text-gray-900 truncate">{partnerDetail.customer.user.name}</div>
                                                                <div className="text-[10px] text-gray-400 truncate">{partnerDetail.customer.user.email}</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {partnerDetail.last_payment_date && (
                                                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs">
                                                            <span className="text-gray-400">Dern. paiement</span>
                                                            <span className="font-medium text-emerald-700">{fmtDate(partnerDetail.last_payment_date)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Adresse */}
                                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Adresse & Livraison</span>
                                                </div>
                                                <div className="p-4 space-y-2.5">
                                                    {partnerDetail.address_line1 ? (
                                                        <div className="flex items-start gap-2">
                                                            <MapPin className="w-3.5 h-3.5 text-sage-500 mt-0.5 shrink-0" />
                                                            <div className="text-xs space-y-0.5">
                                                                <div className="font-semibold text-gray-900">{partnerDetail.address_line1}</div>
                                                                {partnerDetail.address_line2 && <div className="text-gray-500">{partnerDetail.address_line2}</div>}
                                                                <div className="text-gray-500">
                                                                    {[partnerDetail.city, partnerDetail.region, partnerDetail.postal_code].filter(Boolean).join(', ')}
                                                                </div>
                                                                {partnerDetail.country && <div className="text-gray-500">{partnerDetail.country}</div>}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                                            <span className="text-xs text-gray-300 italic">Adresse non renseignée</span>
                                                        </div>
                                                    )}
                                                    {(toNum(partnerDetail.min_order_amount) > 0 || partnerDetail.delivery_zone || partnerDetail.delivery_instructions) && (
                                                        <div className="pt-2 border-t border-gray-100 space-y-1.5">
                                                            {toNum(partnerDetail.min_order_amount) > 0 && (
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-gray-400">Commande min.</span>
                                                                    <span className="font-medium text-gray-700">{fmtNumber(partnerDetail.min_order_amount)}</span>
                                                                </div>
                                                            )}
                                                            {partnerDetail.delivery_zone && (
                                                                <div className="flex items-center justify-between text-xs">
                                                                    <span className="text-gray-400">Zone livraison</span>
                                                                    <span className="font-medium text-gray-700 truncate max-w-[60%] text-right">{partnerDetail.delivery_zone}</span>
                                                                </div>
                                                            )}
                                                            {partnerDetail.delivery_instructions && (
                                                                <div className="text-[11px] text-gray-500 bg-gray-50 rounded-lg px-2 py-1.5 leading-relaxed">
                                                                    {partnerDetail.delivery_instructions}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                    {partnerDetail.geo_lat && partnerDetail.geo_lng && (
                                                        <div className="flex items-center gap-1 text-[10px] text-gray-400 pt-1 border-t border-gray-100">
                                                            <Locate className="w-3 h-3" />
                                                            <span>{partnerDetail.geo_lat}, {partnerDetail.geo_lng}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                    )}

                                    {/* ── Finance & Crédit ─────────────── */}
                                    {activeTab === 'finance' && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        {[
                                            { label: 'Limite de crédit', value: fmtNumber(partnerDetail.credit_limit), color: 'text-gray-900', border: 'border-gray-100', bg: 'bg-white', icon: CreditCard, iconColor: 'text-gray-400' },
                                            { label: 'Crédit utilisé', value: fmtNumber(partnerDetail.credit_used), color: 'text-amber-600', border: 'border-amber-100', bg: 'bg-amber-50/40', icon: CreditCard, iconColor: 'text-amber-400' },
                                            { label: 'Crédit disponible', value: fmtNumber(partnerDetail.credit_available), color: toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600', border: toNum(partnerDetail.credit_available) <= 0 ? 'border-red-100' : 'border-emerald-100', bg: toNum(partnerDetail.credit_available) <= 0 ? 'bg-red-50/40' : 'bg-emerald-50/40', icon: CreditCard, iconColor: toNum(partnerDetail.credit_available) <= 0 ? 'text-red-400' : 'text-emerald-400' },
                                            { label: 'Remise défaut', value: `${toNum(partnerDetail.default_discount_rate)}%`, color: 'text-sage-700', border: 'border-sage-100', bg: 'bg-sage-50/40', icon: DollarSign, iconColor: 'text-sage-400' },
                                        ].map(kpi => (
                                            <div key={kpi.label} className={`p-3 rounded-xl border ${kpi.border} ${kpi.bg} shadow-sm`}>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="text-[11px] text-gray-500 font-medium">{kpi.label}</span>
                                                    <kpi.icon className={`w-3.5 h-3.5 ${kpi.iconColor}`} />
                                                </div>
                                                <div className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    )}
                                    {activeTab === 'finance' && (
                                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                            <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Crédit & Exposition financière</span>
                                        </div>
                                        <div className="p-3 space-y-4">
                                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                                <div className="flex gap-2 flex-wrap">
                                                    <button onClick={() => { setCreditForm({ credit_limit: toNum(partnerDetail.credit_limit) }); setShowCreditModal(true); }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-sage-50 text-sage-700 rounded-md hover:bg-sage-100 transition-colors">
                                                        <Edit2 className="w-3 h-3" /> Modifier limite
                                                    </button>
                                                    <button onClick={handleRecalcCredit}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                                                        <RefreshCw className="w-3 h-3" /> Recalculer
                                                    </button>
                                                    <button onClick={() => { setShowEvaluateForm(v => !v); resetEvaluate(); setEvaluateAmount(''); }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 transition-colors">
                                                        <Calculator className="w-3 h-3" /> Simuler commande
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Credit evaluate dry-run (§6.5) */}
                                            {showEvaluateForm && (
                                                <div className="mb-4 p-3 rounded-xl border border-indigo-200 bg-indigo-50/30 space-y-2">
                                                    <div className="text-xs font-semibold text-indigo-800">Simuler l'éligibilité d'une commande</div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            type="number"
                                                            value={evaluateAmount}
                                                            onChange={e => setEvaluateAmount(e.target.value)}
                                                            placeholder="Montant (ex: 15000)"
                                                            className="flex-1 text-xs border border-indigo-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                                                        />
                                                        <button
                                                            onClick={handleEvaluateCredit}
                                                            disabled={!evaluateAmount || evaluateLoading}
                                                            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                                        >
                                                            {evaluateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Calculator className="w-3 h-3" />}
                                                            Simuler
                                                        </button>
                                                    </div>
                                                    {evaluateResult && (
                                                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border ${evaluateResult.eligible ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                            {evaluateResult.eligible
                                                                ? <><CheckCircle className="w-3.5 h-3.5 shrink-0" /> Commande autorisée — crédit restant après: {fmtNumber(evaluateResult.available_after)}</>
                                                                : <><XCircleIcon className="w-3.5 h-3.5 shrink-0" /> Commande refusée ({evaluateResult.status}) — manque: {fmtNumber(evaluateResult.shortfall)}{evaluateResult.requires_approval ? ' — dérogation requise' : ''}</>
                                                            }
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Credit Exposure V2 Panel */}
                                            {creditExposureLoading ? (
                                                <div className="flex items-center justify-center py-4 text-gray-400 text-xs">
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement exposition...
                                                </div>
                                            ) : creditExposureData ? (() => {
                                                const exp = creditExposureData;
                                                const colors = CREDIT_EXPOSURE_COLORS[exp.status] ?? CREDIT_EXPOSURE_COLORS.ALLOWED;
                                                const pct = exp.credit_limit > 0 ? Math.min(100, (exp.total_exposure / exp.credit_limit) * 100) : 0;
                                                return (
                                                    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4 mb-4`}>
                                                        {/* Status header */}
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-2">
                                                                <Zap className={`w-4 h-4 ${colors.text}`} />
                                                                <span className={`text-sm font-bold ${colors.text}`}>Exposition temps réel</span>
                                                            </div>
                                                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${colors.border} ${colors.bg} ${colors.text}`}>
                                                                {colors.label}
                                                            </span>
                                                        </div>

                                                        {/* Utilization bar */}
                                                        <div className="mb-3">
                                                            <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                                                                <span>Exposition totale: <strong>{fmtNumber(exp.total_exposure)}</strong></span>
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

                                                        {/* Breakdown grid */}
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

                                                        {/* Footer */}
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/60">
                                                            {exp.overdue_invoice_count > 0 && (
                                                                <span className="text-[10px] text-red-600 font-medium flex items-center gap-1">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    {exp.overdue_invoice_count} facture(s) en retard — {exp.oldest_overdue_days}j max
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400 ml-auto">
                                                                Recalculé {fmtDate(exp.last_recalculated_at)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })() : (
                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
                                                        <div className="text-xs text-gray-500 mb-1">Limite</div>
                                                        <div className="text-lg font-bold text-gray-900">{fmtNumber(partnerDetail.credit_limit)}</div>
                                                    </div>
                                                    <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
                                                        <div className="text-xs text-gray-500 mb-1">Utilisé</div>
                                                        <div className="text-lg font-bold text-amber-600">{fmtNumber(partnerDetail.credit_used)}</div>
                                                    </div>
                                                    <div className="p-3 rounded-lg border border-gray-100 bg-white shadow-sm text-center">
                                                        <div className="text-xs text-gray-500 mb-1">Disponible</div>
                                                        <div className={`text-lg font-bold ${toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {fmtNumber(partnerDetail.credit_available)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Credit history */}
                                            {creditHistLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-400">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : creditHistoryData?.data ? (
                                                <div className="space-y-3">
                                                    {/* Orders */}
                                                    {creditHistoryData.data.orders.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500 mb-2">Bons de commande</div>
                                                            <div className="space-y-1">
                                                                {creditHistoryData.data.orders.slice(0, 10).map(o => (
                                                                    <div key={o.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-100 text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-medium text-sage-700">{o.order_code}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                                o.order_status === 'Delivered' || o.order_status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                                                                                o.order_status === 'Confirm' || o.order_status === 'CONFIRMED' ? 'bg-sage-50 text-sage-700' :
                                                                                'bg-gray-100 text-gray-600'
                                                                            }`}>
                                                                                {o.order_status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-400">{fmtDate(o.created_at)}</span>
                                                                            <span className="font-semibold">{fmtNumber(o.total_amount)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Deliveries */}
                                                    {creditHistoryData.data.deliveries.length > 0 && (
                                                        <div>
                                                            <div className="text-xs font-semibold text-gray-500 mb-2">Bons de livraison</div>
                                                            <div className="space-y-1">
                                                                {creditHistoryData.data.deliveries.slice(0, 10).map(d => (
                                                                    <div key={d.id} className="flex items-center justify-between py-1.5 px-2 bg-white rounded border border-gray-100 text-xs">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-mono font-medium text-sage-700">{d.delivery_code || d.code}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                                (d.delivery_status || d.status) === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                                            }`}>
                                                                                {d.delivery_status || d.status}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-gray-400">{fmtDate(d.created_at)}</span>
                                                                            <span className="font-semibold">{fmtNumber(d.total_amount)}</span>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {creditHistoryData.data.orders.length === 0 && creditHistoryData.data.deliveries.length === 0 && (
                                                        <div className="text-center py-6 text-xs text-gray-400">Aucun historique de crédit</div>
                                                    )}
                                                </div>
                                            ) : null}

                                            {/* Credit Events Audit Trail */}
                                            {creditEventsLoading ? null : creditEventsData.length > 0 && (
                                                <div className="mt-4">
                                                    <div className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-2 pt-1 border-t border-gray-100">
                                                        <Activity className="w-3 h-3 text-indigo-400" />
                                                        <span>Audit Trail</span>
                                                        <span className="text-gray-400 font-normal">— Événements crédit</span>
                                                    </div>
                                                    <div className="relative border-l-2 border-gray-100 ml-3 space-y-1">
                                                        {creditEventsData.slice(0, 15).map(ev => {
                                                            const meta = CREDIT_EVENT_ICONS[ev.event_type] ?? { icon: '•', color: 'text-gray-500' };
                                                            return (
                                                                <div key={ev.id} className="relative pl-4 -ml-px">
                                                                    <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-[8px]" />
                                                                    <div className="bg-white rounded-lg border border-gray-100 px-3 py-2 text-xs flex items-center justify-between">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <span>{meta.icon}</span>
                                                                            <span className="text-gray-600 truncate">{ev.event_type.replace(/_/g, ' ')}</span>
                                                                            {ev.reference_type && ev.reference_id && (
                                                                                <span className="text-gray-300 text-[10px] shrink-0">#{ev.reference_id}</span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-3 shrink-0 ml-2">
                                                                            <span className={`font-semibold ${ev.amount >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
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
                                            )}
                                        </div>
                                    </div>
                                    )}

                                    {/* ── Règlement ────────────────────── */}
                                    {activeTab === 'reglement' && (
                                    <div className="space-y-3">

                                        {/* §6 Conditions de paiement */}
                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                                <DollarSign className="w-3.5 h-3.5 text-sage-500" />
                                                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Conditions de paiement</span>
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

                                        {/* §7 Modes de règlement — checkbox style */}
                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Banknote className="w-3.5 h-3.5 text-gray-500" />
                                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Modes de règlement</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 italic">Référentiel global</span>
                                            </div>
                                            <div className="p-3">
                                                {paymentMethodsLoading ? (
                                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-3 justify-center">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement...
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {paymentMethods.map(pm => (
                                                            <div key={pm.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${pm.is_active ? 'border-gray-200 bg-white' : 'border-dashed border-gray-200 bg-gray-50 opacity-50'}`}>
                                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${pm.is_active ? 'bg-sage-500 border-sage-500' : 'border-gray-300 bg-white'}`}>
                                                                    {pm.is_active && <CheckCircle className="w-2.5 h-2.5 text-white" />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="text-xs font-semibold text-gray-800">{pm.code}</div>
                                                                    <div className="text-[10px] text-gray-400 truncate">{pm.name}</div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* §9 Dérogations de paiement */}
                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <FileCheck2 className="w-3.5 h-3.5 text-violet-500" />
                                                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Dérogations de paiement</span>
                                                </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {pendingOverrides.length > 0 && (
                                                                <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full border border-amber-200">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                                    {pendingOverrides.length} en attente
                                                                </span>
                                                            )}
                                                            <button
                                                                onClick={() => setShowPendingOverrides(v => !v)}
                                                                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-md border transition-colors ${showPendingOverrides ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                                                            >
                                                                <Clock className="w-3 h-3" />
                                                                Historique
                                                            </button>
                                                            <button
                                                                onClick={() => setShowOverrideForm(v => !v)}
                                                                className={`flex items-center gap-1 px-2.5 py-1 text-[10px] rounded-md border transition-colors ${showOverrideForm ? 'bg-violet-100 text-violet-700 border-violet-200' : 'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100'}`}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                Demander
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Override request form */}
                                                    {showOverrideForm && (
                                                        <div className="border-b border-gray-100 bg-violet-50/30">
                                                            <div className="px-4 pt-4 pb-1">
                                                                <div className="flex items-center gap-2 mb-4">
                                                                    <div className="w-6 h-6 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                                                                        <FileCheck2 className="w-3 h-3 text-white" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="text-xs font-semibold text-gray-900">Nouvelle demande de dérogation</div>
                                                                        <div className="text-[10px] text-gray-400">Au moins une condition ou un mode doit être spécifié</div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="px-4 pb-4 space-y-3">
                                                                {/* Document row */}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Type de document</label>
                                                                        <div className="flex gap-1.5">
                                                                            {(['order', 'invoice'] as const).map(dt => (
                                                                                <button
                                                                                    key={dt}
                                                                                    onClick={() => setOverrideForm(f => ({ ...f, document_type: dt }))}
                                                                                    className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg border transition-all ${overrideForm.document_type === dt ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-300'}`}
                                                                                >
                                                                                    {dt === 'order' ? 'Commande' : 'Facture'}
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">N° du document</label>
                                                                        <input
                                                                            type="number"
                                                                            value={overrideForm.document_id}
                                                                            onChange={e => setOverrideForm(f => ({ ...f, document_id: e.target.value }))}
                                                                            placeholder="ID interne (ex: 1042)"
                                                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                                                        />
                                                                    </div>
                                                                </div>

                                                                {/* Payment selects */}
                                                                <div className="grid grid-cols-2 gap-3">
                                                                    <div>
                                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                                                            Condition de paiement
                                                                            <span className="normal-case font-normal text-gray-400 ml-1">(optionnel)</span>
                                                                        </label>
                                                                        <select
                                                                            value={overrideForm.payment_term_id}
                                                                            onChange={e => setOverrideForm(f => ({ ...f, payment_term_id: e.target.value }))}
                                                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                                                        >
                                                                            <option value="">— Inchangée —</option>
                                                                            {[...getAttachedTerms(paymentTermsData), ...getAvailableTerms(paymentTermsData).filter(
                                                                                (a: any) => !getAttachedTerms(paymentTermsData).find((t: any) => t.id === a.id)
                                                                            )].map((t: any) => (
                                                                                <option key={t.id} value={t.id}>{t.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
                                                                            Mode de règlement
                                                                            <span className="normal-case font-normal text-gray-400 ml-1">(optionnel)</span>
                                                                        </label>
                                                                        <select
                                                                            value={overrideForm.payment_method_id}
                                                                            onChange={e => setOverrideForm(f => ({ ...f, payment_method_id: e.target.value }))}
                                                                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                                                                        >
                                                                            <option value="">— Inchangé —</option>
                                                                            {paymentMethods.filter(p => p.is_active).map(pm => (
                                                                                <option key={pm.id} value={pm.id}>{pm.code} — {pm.name}</option>
                                                                            ))}
                                                                        </select>
                                                                    </div>
                                                                </div>

                                                                {/* Reason */}
                                                                <div>
                                                                    <label className="block text-[10px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Justification</label>
                                                                    <textarea
                                                                        value={overrideForm.reason}
                                                                        onChange={e => setOverrideForm(f => ({ ...f, reason: e.target.value }))}
                                                                        rows={3}
                                                                        placeholder="Décrivez la situation exceptionnelle qui justifie cette dérogation…"
                                                                        className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white resize-none leading-relaxed"
                                                                    />
                                                                </div>

                                                                {/* Info note + actions */}
                                                                <div className="flex items-center gap-3 pt-1">
                                                                    <div className="flex-1 text-[10px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                                                        Les rôles <strong className="text-gray-600">root</strong> et <strong className="text-gray-600">admin</strong> bénéficient d'une approbation automatique.
                                                                    </div>
                                                                    <button
                                                                        onClick={() => { setShowOverrideForm(false); setOverrideForm({ document_type: 'order', document_id: '', payment_term_id: '', payment_method_id: '', reason: '' }); }}
                                                                        className="px-3 py-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0"
                                                                    >
                                                                        Annuler
                                                                    </button>
                                                                    <button
                                                                        onClick={handleCreateOverride}
                                                                        disabled={creatingOverride}
                                                                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors shrink-0"
                                                                    >
                                                                        {creatingOverride ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileCheck2 className="w-3 h-3" />}
                                                                        Soumettre
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Override list */}
                                                    {showPendingOverrides && (
                                                        <div className="divide-y divide-gray-50">
                                                            {pendingOverridesLoading ? (
                                                                <div className="flex items-center justify-center py-8 text-gray-400 text-xs gap-2">
                                                                    <Loader2 className="w-4 h-4 animate-spin" /> Chargement...
                                                                </div>
                                                            ) : pendingOverrides.length > 0 ? (
                                                                pendingOverrides.map(ov => {
                                                                    const statusCfg = {
                                                                        pending:  { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 border-amber-200',   label: 'En attente' },
                                                                        approved: { bar: 'bg-emerald-400', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Approuvé'   },
                                                                        rejected: { bar: 'bg-red-400',     badge: 'bg-red-100 text-red-700 border-red-200',           label: 'Rejeté'     },
                                                                    }[ov.approval_status];
                                                                    return (
                                                                        <div key={ov.id} className="flex gap-0 group">
                                                                            {/* Status bar */}
                                                                            <div className={`w-1 shrink-0 rounded-tl-none rounded-bl-none ${statusCfg.bar} first:rounded-tl-xl last:rounded-bl-xl`} />
                                                                            <div className="flex-1 px-4 py-3">
                                                                                {/* Top row */}
                                                                                <div className="flex items-center justify-between mb-2">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="font-mono text-[10px] text-gray-400">#{ov.id}</span>
                                                                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.badge}`}>
                                                                                            {statusCfg.label}
                                                                                        </span>
                                                                                        <span className="text-[10px] text-gray-500">
                                                                                            {ov.document_type === 'order' ? 'Commande' : 'Facture'} <strong>#{ov.document_id}</strong>
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-[10px] text-gray-400">{fmtDate(ov.created_at)}</span>
                                                                                </div>

                                                                                {/* Changes row */}
                                                                                {(ov.payment_term || ov.payment_method) && (
                                                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                                                        {ov.payment_term && (
                                                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-sage-50 rounded-lg border border-sage-100 text-[10px]">
                                                                                                <DollarSign className="w-3 h-3 text-sage-500 shrink-0" />
                                                                                                <span className="text-gray-500">Condition:</span>
                                                                                                <span className="font-semibold text-sage-700">{ov.payment_term.name}</span>
                                                                                            </div>
                                                                                        )}
                                                                                        {ov.payment_method && (
                                                                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 rounded-lg border border-indigo-100 text-[10px]">
                                                                                                <Banknote className="w-3 h-3 text-indigo-500 shrink-0" />
                                                                                                <span className="text-gray-500">Mode:</span>
                                                                                                <span className="font-semibold text-indigo-700">{ov.payment_method.code}</span>
                                                                                                <span className="text-gray-400">— {ov.payment_method.name}</span>
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                                {/* Reason */}
                                                                                <p className="text-[11px] text-gray-600 italic leading-relaxed mb-2 border-l-2 border-gray-200 pl-2">
                                                                                    {ov.reason}
                                                                                </p>

                                                                                {/* Comment (if approved/rejected) */}
                                                                                {ov.comment && (
                                                                                    <div className="flex items-start gap-1.5 text-[10px] text-gray-500 mb-2">
                                                                                        <MessageSquare className="w-3 h-3 text-gray-300 mt-0.5 shrink-0" />
                                                                                        <span>{ov.comment}</span>
                                                                                    </div>
                                                                                )}

                                                                                {/* Actions */}
                                                                                {ov.approval_status === 'pending' && (
                                                                                    <div className="flex gap-2 mt-1">
                                                                                        <button
                                                                                            onClick={() => handleApproveOverride(ov.id)}
                                                                                            disabled={approvingOverride}
                                                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition-colors"
                                                                                        >
                                                                                            {approvingOverride ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsUp className="w-3 h-3" />}
                                                                                            Approuver
                                                                                        </button>
                                                                                        <button
                                                                                            onClick={() => handleRejectOverride(ov.id)}
                                                                                            disabled={rejectingOverride}
                                                                                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40 transition-colors"
                                                                                        >
                                                                                            {rejectingOverride ? <Loader2 className="w-3 h-3 animate-spin" /> : <ThumbsDown className="w-3 h-3" />}
                                                                                            Rejeter
                                                                                        </button>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="py-10 text-center">
                                                                    <div className="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3">
                                                                        <FileCheck2 className="w-5 h-5 text-gray-300" />
                                                                    </div>
                                                                    <p className="text-xs text-gray-400 font-medium">Aucune dérogation</p>
                                                                    <p className="text-[10px] text-gray-300 mt-0.5">L'historique est vide pour l'instant</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Empty state when both panels closed */}
                                                    {!showOverrideForm && !showPendingOverrides && (
                                                        <div className="px-4 py-4 flex items-center justify-between text-xs text-gray-400">
                                                            <span>
                                                                {pendingOverrides.length > 0
                                                                    ? `${pendingOverrides.length} dérogation(s) en attente d'approbation`
                                                                    : 'Aucune dérogation en attente'}
                                                            </span>
                                                            <button
                                                                onClick={() => setShowPendingOverrides(true)}
                                                                className="text-[10px] text-violet-500 hover:text-violet-700 underline"
                                                            >
                                                                Voir l'historique
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                            </div>
                                    )}

                                    {/* contact section absorbed into general 3-col grid above */}
                                    {false && (
                                    <div>
                                        <SageCollapsible title="Adresse & Contact" isOpen={openSections['contact']} onOpenChange={open => toggleSection('contact', open)}>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Contact Card */}
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</span>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        {[
                                                            { icon: Mail, label: 'Email', value: partnerDetail.email, href: partnerDetail.email ? `mailto:${partnerDetail.email}` : undefined },
                                                            { icon: Phone, label: 'Téléphone', value: partnerDetail.phone, href: partnerDetail.phone ? `tel:${partnerDetail.phone}` : undefined },
                                                            { icon: Phone, label: 'WhatsApp', value: partnerDetail.whatsapp },
                                                            { icon: Building2, label: 'Site web', value: partnerDetail.website },
                                                        ].map(item => (
                                                            <div key={item.label} className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                                                    <item.icon className="w-3.5 h-3.5 text-gray-500" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{item.label}</div>
                                                                    {item.value ? (
                                                                        item.href ? (
                                                                            <a href={item.href} className="text-sm font-medium text-blue-700 hover:underline truncate block">{item.value}</a>
                                                                        ) : (
                                                                            <div className="text-sm font-medium text-gray-900 truncate">{item.value}</div>
                                                                        )
                                                                    ) : (
                                                                        <div className="text-sm text-gray-300 italic">Non renseigné</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Address Card */}
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Adresse</span>
                                                    </div>
                                                    <div className="p-4">
                                                        {partnerDetail.address_line1 ? (
                                                            <div className="flex items-start gap-3 mb-3">
                                                                <div className="w-8 h-8 rounded-lg bg-sage-50 border border-sage-100 flex items-center justify-center shrink-0">
                                                                    <MapPin className="w-3.5 h-3.5 text-sage-500" />
                                                                </div>
                                                                <div className="text-sm">
                                                                    <div className="font-medium text-gray-900">{partnerDetail.address_line1}</div>
                                                                    {partnerDetail.address_line2 && <div className="text-gray-500 mt-0.5">{partnerDetail.address_line2}</div>}
                                                                    <div className="text-gray-500 mt-0.5">
                                                                        {[partnerDetail.city, partnerDetail.region, partnerDetail.postal_code].filter(Boolean).join(', ')}
                                                                    </div>
                                                                    {partnerDetail.country && <div className="text-gray-500">{partnerDetail.country}</div>}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-3 mb-3 py-2">
                                                                <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                                                                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                                </div>
                                                                <span className="text-sm text-gray-300 italic">Aucune adresse renseignée</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Tax Card */}
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Fiscalité</span>
                                                    </div>
                                                    <div className="p-4 space-y-2.5">
                                                        {[
                                                            { label: 'ICE', value: partnerDetail.tax_number_ice },
                                                            { label: 'IF', value: partnerDetail.tax_number_if },
                                                        ].map(item => (
                                                            <div key={item.label} className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500 text-xs">{item.label}</span>
                                                                {item.value ? (
                                                                    <span className="font-mono text-xs font-medium text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{item.value}</span>
                                                                ) : (
                                                                    <span className="text-xs text-gray-300 italic">Non renseigné</span>
                                                                )}
                                                            </div>
                                                        ))}
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500 text-xs">Exonéré TVA</span>
                                                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${partnerDetail.tax_exempt ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                {partnerDetail.tax_exempt ? 'Oui' : 'Non'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Operations Card - only show if meaningful data */}
                                                {(() => {
                                                    const hasHours = partnerDetail.opening_hours && partnerDetail.opening_hours !== '{}' && partnerDetail.opening_hours !== 'null';
                                                    const hasInstructions = !!partnerDetail.delivery_instructions;
                                                    const hasMinOrder = toNum(partnerDetail.min_order_amount) > 0;
                                                    const hasDeliveryZone = !!partnerDetail.delivery_zone;
                                                    if (!hasHours && !hasInstructions && !hasMinOrder && !hasDeliveryZone) return null;
                                                    return (
                                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Opérations</span>
                                                            </div>
                                                            <div className="p-4 space-y-2.5">
                                                                {hasHours && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-500 text-xs">Horaires d'ouverture</span>
                                                                        <span className="text-xs font-medium text-gray-900">{partnerDetail.opening_hours}</span>
                                                                    </div>
                                                                )}
                                                                {hasInstructions && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-500 text-xs">Instructions livraison</span>
                                                                        <span className="text-xs font-medium text-gray-900 max-w-[200px] truncate">{partnerDetail.delivery_instructions}</span>
                                                                    </div>
                                                                )}
                                                                {hasMinOrder && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-500 text-xs">Commande min.</span>
                                                                        <span className="text-xs font-medium text-gray-900">{fmtNumber(partnerDetail.min_order_amount)}</span>
                                                                    </div>
                                                                )}
                                                                {hasDeliveryZone && (
                                                                    <div className="flex items-center justify-between text-sm">
                                                                        <span className="text-gray-500 text-xs">Zone de livraison</span>
                                                                        <span className="text-xs font-medium text-gray-900">{partnerDetail.delivery_zone}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </SageCollapsible>
                                    </div>
                                    )}
                                    {activeTab === 'finance' && (
                                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                            <Activity className="w-3.5 h-3.5 text-sage-500" />
                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Activité commerciale récente</span>
                                        </div>
                                        <div className="p-3">
                                            {(() => {
                                                const orders = (partnerDetail as any).orders as any[] | undefined;
                                                const bls = (partnerDetail as any).delivery_notes as any[] | undefined;
                                                return (
                                                    <div className="space-y-4">
                                                        {/* Commandes */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Package className="w-3.5 h-3.5 text-sage-500" />
                                                                <span className="text-xs font-semibold text-gray-600">Bons de commande récents</span>
                                                            </div>
                                                            {orders && orders.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {orders.slice(0, 10).map((o: any, i: number) => (
                                                                        <div key={o.id ?? i} className="flex items-center justify-between py-1.5 px-2.5 bg-white rounded-lg border border-gray-100 text-xs">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className="font-mono font-medium text-sage-700 shrink-0">{o.order_code ?? o.code ?? `#${o.id}`}</span>
                                                                                {(o.status ?? o.order_status) && (
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                                                                        (o.status || o.order_status)?.toLowerCase().includes('deliv') || (o.status || o.order_status)?.toLowerCase() === 'confirmed' ? 'bg-emerald-50 text-emerald-700' :
                                                                                        (o.status || o.order_status)?.toLowerCase().includes('cancel') ? 'bg-red-50 text-red-600' :
                                                                                        'bg-gray-100 text-gray-600'
                                                                                    }`}>{o.status ?? o.order_status}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span className="text-gray-400 text-[10px]">{fmtDate(o.created_at ?? o.order_date)}</span>
                                                                                <span className="font-semibold text-gray-800">{fmtNumber(o.total_amount)}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                                    <Package className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                                                    Aucune commande récente
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Bons de livraison */}
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Truck className="w-3.5 h-3.5 text-indigo-500" />
                                                                <span className="text-xs font-semibold text-gray-600">Bons de livraison récents</span>
                                                            </div>
                                                            {bls && bls.length > 0 ? (
                                                                <div className="space-y-1">
                                                                    {bls.slice(0, 10).map((bl: any, i: number) => (
                                                                        <div key={bl.id ?? i} className="flex items-center justify-between py-1.5 px-2.5 bg-white rounded-lg border border-gray-100 text-xs">
                                                                            <div className="flex items-center gap-2 min-w-0">
                                                                                <span className="font-mono font-medium text-indigo-700 shrink-0">{bl.delivery_number ?? bl.code ?? `#${bl.id}`}</span>
                                                                                {(bl.status ?? bl.delivery_status) && (
                                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${
                                                                                        (bl.status || bl.delivery_status)?.toUpperCase() === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                                                                    }`}>{bl.status ?? bl.delivery_status}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-2 shrink-0">
                                                                                <span className="text-gray-400 text-[10px]">{fmtDate(bl.created_at)}</span>
                                                                                <span className="font-semibold text-gray-800">{fmtNumber(bl.total_amount)}</span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                                                    <Truck className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                                                                    Aucun bon de livraison récent
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Last payment */}
                                                        {partnerDetail.last_payment_date && (
                                                            <div className="flex items-center justify-between text-xs px-3 py-2 bg-emerald-50 rounded-lg border border-emerald-100">
                                                                <span className="text-emerald-700 font-medium">Dernier paiement reçu</span>
                                                                <span className="font-semibold text-emerald-800">{fmtDate(partnerDetail.last_payment_date)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    )}

                                    {/* ── Soldes (Finance) ─────────────── */}
                                    {activeTab === 'finance' && (
                                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                            <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Soldes (Points / Budget / Avoir)</span>
                                        </div>
                                        <div className="p-3">
                                            <div className="space-y-3">
                                                {balancesLoading ? (
                                                    <div className="flex items-center justify-center py-6 text-gray-400 text-xs">
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement soldes...
                                                    </div>
                                                ) : balancesData.length > 0 ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                        {balancesData.map(bal => (
                                                            <div key={bal.id} className="relative p-3 rounded-xl border border-gray-100 bg-white shadow-sm">
                                                                <button
                                                                    onClick={() => handleDeleteBalance(bal.id)}
                                                                    disabled={deletingBalance}
                                                                    className="absolute top-2 right-2 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                                                                    <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{bal.balance_type}</span>
                                                                </div>
                                                                <div className="text-xl font-bold text-gray-900">{bal.balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                                        <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                        <p>Aucun solde enregistré</p>
                                                    </div>
                                                )}

                                                {/* Add / update balance */}
                                                {!showBalanceForm ? (
                                                    <button
                                                        onClick={() => setShowBalanceForm(true)}
                                                        className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        Ajouter / Modifier un solde
                                                    </button>
                                                ) : (
                                                    <div className="p-3 rounded-xl border border-indigo-200 bg-white space-y-3">
                                                        <div className="text-xs font-semibold text-gray-700">Modifier un solde</div>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 mb-1">Type de solde</label>
                                                                <select value={balanceForm.balance_type} onChange={e => setBalanceForm(f => ({ ...f, balance_type: e.target.value as BalanceType }))}
                                                                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50">
                                                                    <option value="POINTS">Points</option>
                                                                    <option value="BUDGET_PROMO">Budget Promo</option>
                                                                    <option value="AVOIR">Avoir</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] text-gray-500 mb-1">Opération</label>
                                                                <select value={balanceForm.operation} onChange={e => setBalanceForm(f => ({ ...f, operation: e.target.value as BalanceOperation }))}
                                                                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50">
                                                                    <option value="add">Ajouter (+)</option>
                                                                    <option value="subtract">Soustraire (−)</option>
                                                                    <option value="set">Définir (=)</option>
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] text-gray-500 mb-1">Montant / Points</label>
                                                            <input type="number" min="0" step="0.01" value={balanceForm.balance} onChange={e => setBalanceForm(f => ({ ...f, balance: e.target.value }))}
                                                                placeholder="0.00" className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50" />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={handleUpsertBalance} disabled={!balanceForm.balance || upsertingBalance}
                                                                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                                                                {upsertingBalance ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                                Valider
                                                            </button>
                                                            <button onClick={() => setShowBalanceForm(false)}
                                                                className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors">
                                                                Annuler
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    )}

                                    {/* ── Nearby Panel (Général) ───────────── */}
                                    {activeTab === 'general' && showNearby && (
                                        <div className="rounded-xl border border-amber-200 bg-amber-50/40">
                                            <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Locate className="w-3.5 h-3.5 text-amber-600" />
                                                    <span className="text-xs font-semibold text-amber-800">Partenaires proches (2 km)</span>
                                                </div>
                                                <button onClick={() => { setShowNearby(false); resetNearby(); }} className="p-0.5 text-amber-400 hover:text-amber-700 rounded transition-colors">
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <div className="p-3">
                                                {nearbyLoading ? (
                                                    <div className="flex items-center justify-center py-4 text-xs text-gray-400"><Loader2 className="w-4 h-4 animate-spin mr-2" /> Recherche...</div>
                                                ) : nearbyPartners.length > 0 ? (
                                                    <div className="space-y-1">
                                                        {nearbyPartners.map((p: any) => (
                                                            <div key={p.id} className="flex items-center justify-between text-xs py-1.5 px-2 bg-white rounded border border-amber-100">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-mono text-[10px] text-gray-500">{p.code}</span>
                                                                    <span className="font-medium text-gray-800">{p.name}</span>
                                                                </div>
                                                                <span className="text-gray-400 shrink-0">{p.distance_km ? `${Number(p.distance_km).toFixed(2)} km` : ''}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-4 text-xs text-gray-400">Aucun partenaire dans un rayon de 2 km</div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* ── Tournées (Général) ───────────── */}
                                    {activeTab === 'general' && (
                                    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                                            <Route className="w-3.5 h-3.5 text-indigo-500" />
                                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Tournées de livraison</span>
                                        </div>
                                        <div className="p-3">
                                        {(() => {
                                                // §11.1 enriched data — falls back to flat itinerary_partners while loading
                                                const enrichedItins = partnerItinerary?.itineraries ?? [];
                                                const flatItins = (partnerDetail as any).itinerary_partners as any[] | undefined ?? [];
                                                const alloc = partnerItinerary?.allocation;

                                                // Resolve pivot id for DELETE (§11.4) by cross-referencing itinerary_id
                                                const pivotId = (itineraryId: number): number | undefined =>
                                                    flatItins.find((ip: any) => ip.itinerary_id === itineraryId)?.id;

                                                const hasItins = enrichedItins.length > 0 || (partnerItineraryLoading && flatItins.length > 0);

                                                return (
                                                    <div className="space-y-3">
                                                        {/* Allocation info pill */}
                                                        {alloc && (
                                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] text-slate-600">
                                                                <Zap className="w-3 h-3 text-slate-400 shrink-0" />
                                                                <span>Priorité alloc: <strong className="text-slate-800 capitalize">{alloc.allocation_priority}</strong></span>
                                                                {alloc.min_allocation_pct > 0 && <span>· Min {alloc.min_allocation_pct}%</span>}
                                                            </div>
                                                        )}

                                                        {partnerItineraryLoading ? (
                                                            <div className="space-y-2">
                                                                {[1, 2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
                                                            </div>
                                                        ) : hasItins ? (
                                                            <div className="space-y-2">
                                                                {enrichedItins.map((it) => {
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
                                                                                        <span className="text-sm font-semibold text-gray-900 truncate">{it.itinerary_name}</span>
                                                                                        {!it.is_active && <span className="text-[9px] px-1.5 py-0.5 bg-gray-200 text-gray-500 rounded-full font-medium">Inactif</span>}
                                                                                    </div>
                                                                                    <div className="flex items-center gap-2 text-[10px] text-gray-500 flex-wrap mt-0.5">
                                                                                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-gray-200">{it.itinerary_code}</span>
                                                                                        <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-100">{it.itinerary_type}</span>
                                                                                        {it.rank > 0 && <span className="flex items-center gap-0.5"><ArrowUpDown className="w-2.5 h-2.5" />Rang {it.rank}</span>}
                                                                                        {it.visit_frequency_days > 0 && <span>/{it.visit_frequency_days}j</span>}
                                                                                        {it.start_time && it.end_time && <span><Clock className="inline w-2.5 h-2.5 mr-0.5" />{it.start_time}–{it.end_time}</span>}
                                                                                        {it.is_stop_point && <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">Arrêt officiel</span>}
                                                                                        {nextVisit && <span className="text-emerald-600 font-medium">Prochain: {nextVisit}</span>}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            {pid !== undefined && (
                                                                                <button
                                                                                    onClick={() => handleRemoveFromItinerary(it.itinerary_id, pid)}
                                                                                    disabled={removingItinerary}
                                                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0 mt-0.5"
                                                                                    title="Retirer de cette tournée"
                                                                                >
                                                                                    <Unlink className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <div className="text-center py-6 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                                                <Route className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                                                                <p>Aucune tournée assignée</p>
                                                            </div>
                                                        )}

                                                        {/* Add to itinerary */}
                                                        {!showItineraryPanel ? (
                                                            <button
                                                                onClick={() => { setShowItineraryPanel(true); fetchItineraries(); }}
                                                                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
                                                            >
                                                                <Link2 className="w-3.5 h-3.5" />
                                                                Affecter à une tournée
                                                            </button>
                                                        ) : (
                                                            <div className="p-3 rounded-xl border border-indigo-200 bg-white space-y-3">
                                                                <div className="text-xs font-semibold text-gray-700">Affecter à une tournée</div>
                                                                {itinerariesLoading ? (
                                                                    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                                                                        <Loader2 className="w-3 h-3 animate-spin" /> Chargement...
                                                                    </div>
                                                                ) : (
                                                                    <select
                                                                        value={selectedItineraryId ?? ''}
                                                                        onChange={e => setSelectedItineraryId(e.target.value ? Number(e.target.value) : null)}
                                                                        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                                                                    >
                                                                        <option value="">Sélectionner une tournée…</option>
                                                                        {availableItineraries.map(it => (
                                                                            <option key={it.id} value={it.id}>{it.name} ({it.code})</option>
                                                                        ))}
                                                                    </select>
                                                                )}
                                                                {/* Optional fields */}
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div>
                                                                        <label className="block text-[10px] text-gray-500 mb-1">Rang dans tournée</label>
                                                                        <input type="number" min="0" value={itineraryForm.rank ?? ''} onChange={e => setItineraryForm(f => ({ ...f, rank: e.target.value ? Number(e.target.value) : undefined }))}
                                                                            placeholder="0" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] text-gray-500 mb-1">Fréquence (jours)</label>
                                                                        <input type="number" min="1" value={itineraryForm.visit_frequency_days ?? ''} onChange={e => setItineraryForm(f => ({ ...f, visit_frequency_days: e.target.value ? Number(e.target.value) : undefined }))}
                                                                            placeholder="7" className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] text-gray-500 mb-1">Heure début</label>
                                                                        <input type="time" value={itineraryForm.start_time ?? ''} onChange={e => setItineraryForm(f => ({ ...f, start_time: e.target.value || undefined }))}
                                                                            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50" />
                                                                    </div>
                                                                    <div>
                                                                        <label className="block text-[10px] text-gray-500 mb-1">Heure fin</label>
                                                                        <input type="time" value={itineraryForm.end_time ?? ''} onChange={e => setItineraryForm(f => ({ ...f, end_time: e.target.value || undefined }))}
                                                                            className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50" />
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] text-gray-500 mb-1">Notes livreur</label>
                                                                    <input type="text" value={itineraryForm.notes ?? ''} onChange={e => setItineraryForm(f => ({ ...f, notes: e.target.value || undefined }))}
                                                                        placeholder="Ex: Livraison avant ouverture magasin"
                                                                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-gray-50" />
                                                                </div>
                                                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                                    <input type="checkbox" checked={itineraryForm.is_stop_point ?? false} onChange={e => setItineraryForm(f => ({ ...f, is_stop_point: e.target.checked }))}
                                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                                                    Point d'arrêt officiel
                                                                </label>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={handleAssignItinerary}
                                                                        disabled={!selectedItineraryId || assigningItinerary}
                                                                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                                                                    >
                                                                        {assigningItinerary ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                                                                        Affecter
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setShowItineraryPanel(false); setSelectedItineraryId(null); setItineraryForm({}); }}
                                                                        className="px-3 py-1.5 text-xs bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                                                                    >
                                                                        Annuler
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    )}

                                    {/* ── Tarification ─────────────────── */}
                                    {activeTab === 'tarification' && (
                                    <>
                                        {/* Canal & Segmentation */}
                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Canal & Segmentation</span>
                                            </div>
                                            <div className="p-4 space-y-2.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 text-xs">Canal</span>
                                                    <span className="text-xs font-medium text-gray-900">{partnerDetail.channel || '—'}</span>
                                                </div>
                                                {partnerDetail.channel_ref && (
                                                    <>
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500 text-xs">Code canal</span>
                                                            <span className="font-mono text-xs text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{partnerDetail.channel_ref.code}</span>
                                                        </div>
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500 text-xs">Libellé canal</span>
                                                            <span className="text-xs font-medium text-gray-900">{partnerDetail.channel_ref.name}</span>
                                                        </div>
                                                        {partnerDetail.channel_ref.price_list_id && (
                                                            <div className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500 text-xs">Liste de prix (canal)</span>
                                                                <span className="text-xs font-medium text-sage-700 bg-sage-50 px-2 py-0.5 rounded">#{partnerDetail.channel_ref.price_list_id}</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                                {partnerDetail.partner_type && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-500 text-xs">Type partenaire</span>
                                                        <span className="text-xs font-medium text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{partnerDetail.partner_type}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Tarif & Remises */}
                                        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Tarif & Remises</span>
                                            </div>
                                            <div className="p-4 space-y-2.5">
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 text-xs">Liste de prix</span>
                                                    {partnerDetail.price_list ? (
                                                        <span className="font-medium text-gray-900 text-xs bg-sage-50 text-sage-700 px-2 py-0.5 rounded">{partnerDetail.price_list.name}</span>
                                                    ) : <span className="text-gray-400 text-xs">—</span>}
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 text-xs">Remise défaut</span>
                                                    <span className="text-xs font-semibold text-sage-700 bg-sage-50 px-2 py-0.5 rounded">{toNum(partnerDetail.default_discount_rate)}%</span>
                                                </div>
                                                {toNum(partnerDetail.default_discount_amount) > 0 && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-500 text-xs">Remise montant fixe</span>
                                                        <span className="text-xs font-semibold text-gray-800">{fmtNumber(partnerDetail.default_discount_amount)}</span>
                                                    </div>
                                                )}
                                                {toNum((partnerDetail as any).max_discount_rate) > 0 && (
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-500 text-xs">Remise max autorisée</span>
                                                        <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{toNum((partnerDetail as any).max_discount_rate)}%</span>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 text-xs">Créé le</span>
                                                    <span className="text-xs text-gray-700">{fmtDate(partnerDetail.created_at)}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-sm">
                                                    <span className="text-gray-500 text-xs">Mis à jour le</span>
                                                    <span className="text-xs text-gray-700">{fmtDate(partnerDetail.updated_at)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Business Chronologies */}
                                        {Array.isArray(partnerDetail.business_chronologies) && partnerDetail.business_chronologies.length > 0 && (
                                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Chronologies business</span>
                                                </div>
                                                <div className="divide-y divide-gray-50">
                                                    {partnerDetail.business_chronologies.map((ch: any, i: number) => (
                                                        <div key={ch.id ?? i} className="px-4 py-2.5 text-xs flex items-center justify-between">
                                                            <span className="font-medium text-gray-800">{ch.name || ch.code || `Chronologie ${i + 1}`}</span>
                                                            {ch.is_active !== undefined && (
                                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${ch.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                                                                    {ch.is_active ? 'Active' : 'Inactive'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Custom Fields */}
                                        {detailData?.customFields && Object.keys(detailData.customFields).length > 0 && (
                                            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Champs personnalisés</span>
                                                </div>
                                                <div className="p-4 space-y-2.5">
                                                    {Object.entries(detailData.customFields).map(([key, cf]) => (
                                                        <div key={key} className="flex items-center justify-between text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                                                                <span className="text-gray-600 text-xs">{cf.label}</span>
                                                            </div>
                                                            <span className="font-medium text-gray-900 text-xs">{cf.formatted_value || cf.value || <span className="text-gray-300 italic">Non renseigné</span>}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Empty state */}
                                        {!partnerDetail.channel && !partnerDetail.price_list && !(Array.isArray(partnerDetail.business_chronologies) && partnerDetail.business_chronologies.length > 0) && !detailData?.customFields && (
                                            <div className="text-center py-16 text-xs text-gray-400">
                                                <DollarSign className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                                <p className="font-medium">Aucune donnée tarifaire</p>
                                                <p className="text-[10px] mt-0.5 text-gray-300">Canal, liste de prix et remises non renseignés</p>
                                            </div>
                                        )}
                                    </>
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
                    </div>
                }

                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* ── Modals ──────────────────────────────────────────────────────── */}
            {showDeleteModal && selectedPartner && (
                <ModalDelete
                    partner={selectedPartner}
                    onClose={() => setShowDeleteModal(false)}
                    onConfirm={handleConfirmDelete}
                    loading={deleting}
                />
            )}

            {showStatusModal && selectedPartner && (
                <ModalStatus
                    partner={selectedPartner}
                    form={statusForm}
                    setForm={setStatusForm}
                    onClose={() => setShowStatusModal(false)}
                    onSubmit={handleSubmitStatus}
                    loading={updatingStatus}
                />
            )}

            {showBlockModal && selectedPartner && (
                <ModalBlock
                    partner={selectedPartner}
                    form={blockForm}
                    setForm={setBlockForm}
                    onClose={() => setShowBlockModal(false)}
                    onSubmit={handleSubmitBlock}
                    loading={blocking}
                />
            )}

            {showCreditModal && selectedPartner && (
                <ModalCredit
                    partner={selectedPartner}
                    form={creditForm}
                    setForm={setCreditForm}
                    onClose={() => setShowCreditModal(false)}
                    onSubmit={handleSubmitCredit}
                    loading={updatingCredit}
                />
            )}
        </>
    );
};
