import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    Loader2, RefreshCw, Plus, Edit2, Trash2, Search, X,
    Users, Building2, Phone, Mail, MapPin, CreditCard, Shield,
    Ban, Unlock, FileText,
    CheckCircle2, XCircle, AlertTriangle, Clock, DollarSign,
    Star, ArrowUpDown,
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
} from '@/hooks/partners/usePartners';

import type {
    Partner,
    PartnerStatus,
    PartnerFilters,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PartnerSavePayload,
} from '@/types/partner.types';

import {
    ModalDelete,
    ModalStatus,
    ModalBlock,
    ModalCredit,
} from './PartnerModals';

import { PartnerFormPanel } from './PartnerFormPanel';

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
    const attached = getAttachedTerms(paymentTermsData);
    const available = getAvailableTerms(paymentTermsData);

    return (
        <div className="space-y-3">
            {/* Attached terms */}
            <div className="text-xs font-semibold text-gray-500 mb-2">Conditions associées</div>
            {attached.length > 0 ? (
                <div className="space-y-1">
                    {attached.map((term: any) => (
                        <div key={term.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-gray-100 text-xs">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                                <span className="font-medium">{term.name}</span>
                                {term.description && <span className="text-gray-400">({term.description})</span>}
                                {(term.pivot?.is_default || term.is_default) && (
                                    <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">Défaut</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {!(term.pivot?.is_default || term.is_default) && (
                                    <button onClick={() => onSetDefault(term.id)}
                                        className="p-1 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors" title="Définir par défaut">
                                        <Star className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button onClick={() => onDetach(term.id)}
                                    className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors" title="Retirer">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-4 text-xs text-gray-400">Aucune condition associée</div>
            )}

            {/* Available terms */}
            {available.length > 0 && (
                <div>
                    <div className="text-xs font-semibold text-gray-500 mb-2 mt-4">Conditions disponibles</div>
                    <div className="space-y-1">
                        {available.map((term: any) => (
                            <div key={term.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium">{term.name}</span>
                                    {term.description && <span className="text-gray-400">({term.description})</span>}
                                    <div className="flex gap-1">
                                        {term.is_credit && <span className="px-1 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px]">Crédit</span>}
                                        {term.is_cash && <span className="px-1 py-0.5 bg-green-50 text-green-600 rounded text-[9px]">Espèces</span>}
                                        {term.is_bank_transfer && <span className="px-1 py-0.5 bg-blue-50 text-blue-600 rounded text-[9px]">Virement</span>}
                                    </div>
                                </div>
                                <button onClick={() => onAttach(term.id)}
                                    className="flex items-center gap-1 px-2 py-1 text-[10px] bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                                    <Plus className="w-3 h-3" /> Ajouter
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Component ────────────────────────────────────────────────────────────────

export const PartnerManagementPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('info');

    // Filters
    const [filters, setFilters] = useState<PartnerFilters>({ page: 1, per_page: 20 });
    const [searchInput, setSearchInput] = useState('');
    const [statusFilter, setStatusFilter] = useState<PartnerStatus | ''>('');

    // Form mode: 'view' | 'create' | 'edit'
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');

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
        info: true, credit: true, contact: true, payments: true, orders: true,
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);
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

    const { data: paymentTermsData, loading: paymentTermsLoading, refetch: refetchPaymentTerms } = usePaymentTerms(
        showDetailPanel && selectedPartner ? selectedPartner.id : null
    );

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
    const { attachPaymentTerm } = useAttachPaymentTerm();
    const { detachPaymentTerm } = useDetachPaymentTerm();
    const { setDefaultPaymentTerm } = useSetDefaultPaymentTerm();

    // ── Search with debounce ─────────────────────────────────────────────────
    const handleSearch = (value: string) => {
        setSearchInput(value);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setFilters(prev => ({ ...prev, q: value || undefined, page: 1 }));
        }, 400);
    };

    // ── Status filter ────────────────────────────────────────────────────────
    useEffect(() => {
        setFilters(prev => ({ ...prev, status: statusFilter || undefined, page: 1 }));
    }, [statusFilter]);

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
        { id: 'info', label: 'Informations', icon: FileText },
        { id: 'credit', label: 'Crédit', icon: CreditCard },
        { id: 'payments', label: 'Paiements', icon: DollarSign },
        { id: 'contact', label: 'Adresse & Contact', icon: MapPin },
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
        setActiveTab('info');

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    }, []);

    // ── Tab / Section navigation ──────────────────────────────────────────────
    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };

    const toggleSection = (sectionId: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [sectionId]: isOpen }));
    };

    const handleExpandAll = () => setOpenSections(Object.keys(openSections).reduce((acc, k) => ({ ...acc, [k]: true }), {}));
    const handleCollapseAll = () => setOpenSections(Object.keys(openSections).reduce((acc, k) => ({ ...acc, [k]: false }), {}));

    // ── Scroll sync ───────────────────────────────────────────────────────────
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const handleScroll = () => {
            if (isScrollingRef.current) return;
            const containerTop = container.scrollTop;
            for (const tab of tabs) {
                const el = sectionRefs.current[tab.id];
                if (!el || !openSections[tab.id]) continue;
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;
                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
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
        setShowDetailPanel(true);
        setFormMode('create');
        fetchMasterData();
    };

    const handleOpenEdit = async () => {
        if (!partnerDetail) return;
        setFormMode('edit');
        fetchMasterData();
    };

    const handleCancelForm = () => {
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
        if (!selectedPartner || !statusForm.new_status || !statusForm.status_change_reason) {
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
            toast.dismiss(toastId);
            toast.success('Crédit recalculé');
            refetchDetail();
            refetchCreditHistory();
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
                                    <Users className="w-4 h-4 text-blue-600" />
                                    Partenaires
                                </h1>
                                {partnersData && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
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

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchInput}
                                    onChange={e => handleSearch(e.target.value)}
                                    placeholder="Rechercher par nom, code, email..."
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
                                />
                                {searchInput && (
                                    <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>

                            {/* Status filter pills */}
                            <div className="flex gap-1 mt-2 flex-wrap">
                                {[
                                    { value: '' as const, label: 'Tous', icon: Users },
                                    { value: 'ACTIVE' as const, label: 'Actifs', icon: CheckCircle2 },
                                    { value: 'ON_HOLD' as const, label: 'Attente', icon: Clock },
                                    { value: 'BLOCKED' as const, label: 'Bloqués', icon: Ban },
                                ].map(pill => (
                                    <button
                                        key={pill.value}
                                        onClick={() => setStatusFilter(pill.value)}
                                        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-full border transition-colors ${statusFilter === pill.value
                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                            : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <pill.icon className="w-3 h-3" />
                                        {pill.label}
                                    </button>
                                ))}
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
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
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
                                        <div className="text-right shrink-0">
                                            <div className={`text-xl sm:text-2xl font-bold whitespace-nowrap ${toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {fmtNumber(partnerDetail.credit_available)}
                                                <span className="text-xs sm:text-sm font-normal text-gray-400 ml-1">dispo.</span>
                                            </div>
                                            {detailLoading && (
                                                <div className="mt-1 text-xs text-gray-500 flex items-center gap-1 justify-end">
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

                                {/* ── Scrollable Sections ────────────── */}
                                <div ref={containerRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 scroll-smooth bg-slate-50">
                                    {/* ── Info Section ───────────────── */}
                                    <div ref={el => { sectionRefs.current['info'] = el; }}>
                                        <SageCollapsible title="Informations générales" isOpen={openSections['info']} onOpenChange={open => toggleSection('info', open)}>
                                            {/* KPI Cards */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                                                {[
                                                    { label: 'Limite de crédit', value: fmtNumber(partnerDetail.credit_limit), color: 'text-gray-900', border: 'border-gray-100', bg: 'bg-white', icon: CreditCard, iconColor: 'text-gray-400' },
                                                    { label: 'Crédit utilisé', value: fmtNumber(partnerDetail.credit_used), color: 'text-amber-600', border: 'border-amber-100', bg: 'bg-amber-50/40', icon: CreditCard, iconColor: 'text-amber-400' },
                                                    { label: 'Crédit disponible', value: fmtNumber(partnerDetail.credit_available), color: toNum(partnerDetail.credit_available) <= 0 ? 'text-red-600' : 'text-emerald-600', border: toNum(partnerDetail.credit_available) <= 0 ? 'border-red-100' : 'border-emerald-100', bg: toNum(partnerDetail.credit_available) <= 0 ? 'bg-red-50/40' : 'bg-emerald-50/40', icon: CreditCard, iconColor: toNum(partnerDetail.credit_available) <= 0 ? 'text-red-400' : 'text-emerald-400' },
                                                    { label: 'Remise défaut', value: `${toNum(partnerDetail.default_discount_rate)}%`, color: 'text-blue-700', border: 'border-blue-100', bg: 'bg-blue-50/40', icon: DollarSign, iconColor: 'text-blue-400' },
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

                                            {/* Blocking alert */}
                                            {partnerDetail.status === 'BLOCKED' && (
                                                <div className="mb-5 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-3">
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

                                            {/* Detail Cards Row */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                                                {/* Identity Card */}
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Identité</span>
                                                    </div>
                                                    <div className="p-4 space-y-2.5">
                                                        {[
                                                            { label: 'Code', value: partnerDetail.code, mono: true },
                                                            { label: 'Nom', value: partnerDetail.name },
                                                            { label: 'Type', value: partnerDetail.partner_type },
                                                            { label: 'Canal', value: partnerDetail.channel },
                                                        ].map(row => (
                                                            <div key={row.label} className="flex items-center justify-between text-sm">
                                                                <span className="text-gray-500 text-xs">{row.label}</span>
                                                                <span className={`font-medium text-gray-900 text-right ${row.mono ? 'font-mono text-xs bg-gray-50 px-2 py-0.5 rounded' : ''}`}>{row.value || '—'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Commercial Card */}
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Commercial</span>
                                                    </div>
                                                    <div className="p-4 space-y-2.5">
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500 text-xs">Liste de prix</span>
                                                            {partnerDetail.price_list ? (
                                                                <span className="font-medium text-gray-900 text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{partnerDetail.price_list.name}</span>
                                                            ) : <span className="text-gray-400 text-xs">—</span>}
                                                        </div>
                                                        <div className="flex items-center justify-between text-sm">
                                                            <span className="text-gray-500 text-xs">Cond. paiement</span>
                                                            {partnerDetail.payment_term ? (
                                                                <span className="font-medium text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{partnerDetail.payment_term.name}</span>
                                                            ) : <span className="text-gray-400 text-xs">—</span>}
                                                        </div>
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
                                            </div>

                                            {/* Customer account card */}
                                            {partnerDetail.customer?.user && (
                                                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-5">
                                                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Compte client associé</span>
                                                    </div>
                                                    <div className="p-4 flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shrink-0">
                                                            {partnerDetail.customer.user.name?.charAt(0)?.toUpperCase() || 'U'}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-semibold text-gray-900">{partnerDetail.customer.user.name}</div>
                                                            <div className="text-xs text-gray-500">{partnerDetail.customer.user.email}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Custom fields card */}
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
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Credit Section ─────────────── */}
                                    <div ref={el => { sectionRefs.current['credit'] = el; }}>
                                        <SageCollapsible title="Crédit & Historique" isOpen={openSections['credit']} onOpenChange={open => toggleSection('credit', open)}>
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setCreditForm({ credit_limit: toNum(partnerDetail.credit_limit) }); setShowCreditModal(true); }}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors">
                                                        <Edit2 className="w-3 h-3" /> Modifier limite
                                                    </button>
                                                    <button onClick={handleRecalcCredit}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-gray-50 text-gray-700 rounded-md hover:bg-gray-100 transition-colors">
                                                        <RefreshCw className="w-3 h-3" /> Recalculer
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Credit KPIs */}
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
                                                                            <span className="font-mono font-medium text-blue-700">{o.order_code}</span>
                                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                                                o.order_status === 'Delivered' || o.order_status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700' :
                                                                                o.order_status === 'Confirm' || o.order_status === 'CONFIRMED' ? 'bg-blue-50 text-blue-700' :
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
                                                                            <span className="font-mono font-medium text-blue-700">{d.delivery_code || d.code}</span>
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
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Payment Terms Section ────────── */}
                                    <div ref={el => { sectionRefs.current['payments'] = el; }}>
                                        <SageCollapsible title="Conditions de paiement" isOpen={openSections['payments']} onOpenChange={open => toggleSection('payments', open)}>
                                            {paymentTermsLoading ? (
                                                <div className="flex items-center justify-center py-6 text-gray-400">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                                </div>
                                            ) : paymentTermsData ? (
                                                <PaymentTermsContent
                                                    paymentTermsData={paymentTermsData}
                                                    onSetDefault={handleSetDefaultTerm}
                                                    onDetach={handleDetachTerm}
                                                    onAttach={handleAttachTerm}
                                                />
                                            ) : null}
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Contact & Address Section ──── */}
                                    <div ref={el => { sectionRefs.current['contact'] = el; }}>
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
                                                                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                                                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
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
