import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Play, CheckCircle2, XCircle, Package, Clock, AlertCircle, FileText, User, AlertTriangle, Wrench } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmModal } from '@/components/common/Modal';
import {
    useMagasinierPreparationsList,
    useMagasinierPreparationDetail,
    useMagasinierPrepare,
    useMagasinierSavePreparation,
    useMagasinierRejectPreparation,
    useMagasinierReportShortage,
    useMagasinierContinuePreparation,
} from '@/hooks/magasinier';
import type { BonPreparation } from '@/types/magasinier.types';

const SHORTAGE_REASONS = [
    { value: 'out_of_stock', label: 'Rupture de stock' },
    { value: 'critical_item', label: 'Article critique' },
    { value: 'perishable', label: 'Périssable' },
    { value: 'frozen', label: 'Surgelé' },
];

export const MagasinierPreparationsPage = () => {
    const [selected, setSelected] = useState<BonPreparation | null>(null);
    const [activeTab, setActiveTab] = useState<string>('info');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        items: true,
    });
    const [showPrepareConfirm, setShowPrepareConfirm] = useState(false);
    const [showSaveConfirm, setShowSaveConfirm] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);
    const [showShortageConfirm, setShowShortageConfirm] = useState(false);
    const [showContinueConfirm, setShowContinueConfirm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [preparedQuantities, setPreparedQuantities] = useState<Record<string, number>>({});
    const [shortageQuantities, setShortageQuantities] = useState<Record<string, number>>({});
    const [shortageReason, setShortageReason] = useState(SHORTAGE_REASONS[0].value);
    const [shortageNotes, setShortageNotes] = useState('');
    const [additionalQuantities, setAdditionalQuantities] = useState<Record<string, number>>({});

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useMagasinierPreparationsList();
    // GET /preparations/pending returns a flat Laravel paginator directly (docs §6.1) — no
    // success/data wrapper, `data` IS the paginator.
    const bonPreparations = data?.data ?? [];
    const stats = {
        total: bonPreparations.length,
        pending: bonPreparations.filter((bp: BonPreparation) => bp.status === 'pending').length,
        in_progress: bonPreparations.filter((bp: BonPreparation) => bp.status === 'in_progress').length,
        completed: bonPreparations.filter((bp: BonPreparation) => bp.status === 'completed_full' || bp.status === 'shortage_split_done').length,
    };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useMagasinierPreparationDetail(selected?.id ?? null);
    // GET /preparations/{id} also returns the BP flat, no wrapper (docs §6.2).
    const details = detailData;
    const items = details?.items ?? [];

    const { prepare, loading: preparing } = useMagasinierPrepare();
    const { save, loading: saving } = useMagasinierSavePreparation();
    const { reject, loading: rejecting } = useMagasinierRejectPreparation();
    const { reportShortage, loading: reportingShortage } = useMagasinierReportShortage();
    const { continuePreparation, loading: continuing } = useMagasinierContinuePreparation();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'bp_number', headerName: 'N° BP', width: 160 },
            { 
                field: 'status', 
                headerName: 'Statut', 
                width: 110,
                valueGetter: (params: any) => {
                    const statusMap: Record<string, string> = {
                        pending: 'En attente',
                        in_progress: 'En cours',
                        completed_full: 'Terminé',
                        completed_partial: 'Terminé (rupture)',
                        partial_rework_requested: 'Rework demandé',
                        awaiting_shortage_review: 'Attente arbitrage',
                        shortage_split_done: 'Rupture traitée',
                        shortage_accepted: 'Rupture acceptée',
                        rejected: 'Rejeté',
                    };
                    return statusMap[params.data?.status] || params.data?.status;
                },
                cellStyle: (params: any) => {
                    const base = { fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' };
                    const styleMap: Record<string, any> = {
                        pending: { ...base, backgroundColor: '#fef3c7', color: '#78350f' },
                        in_progress: { ...base, backgroundColor: '#dbeafe', color: '#1e3a8a' },
                        completed_full: { ...base, backgroundColor: '#d1fae5', color: '#064e3b' },
                        completed_partial: { ...base, backgroundColor: '#fed7aa', color: '#7c2d12' },
                        partial_rework_requested: { ...base, backgroundColor: '#e9d5ff', color: '#581c87' },
                        awaiting_shortage_review: { ...base, backgroundColor: '#fecaca', color: '#7f1d1d' },
                        shortage_split_done: { ...base, backgroundColor: '#bbf7d0', color: '#14532d' },
                        shortage_accepted: { ...base, backgroundColor: '#fde68a', color: '#78350f' },
                        rejected: { ...base, backgroundColor: '#fee2e2', color: '#7f1d1d' },
                    };
                    return styleMap[params.data?.status] || { ...base, backgroundColor: '#f3f4f6', color: '#111827' };
                }
            },
            {
                field: 'mission_number',
                headerName: 'Mission',
                width: 180,
                valueGetter: (params: any) => {
                    const mission = params.data?.delivery_mission?.mission_number;
                    return mission || '-';
                }
            },
            {
                field: 'rider_name',
                headerName: 'Livreur',
                width: 140,
                valueGetter: (params: any) => {
                    const name = params.data?.delivery_mission?.rider?.name;
                    return name || '-';
                }
            },
            {
                field: 'bls_count',
                headerName: 'BLs',
                width: 70,
                valueGetter: (params: any) => {
                    const bls = params.data?.delivery_mission?.delivery_notes;
                    return Array.isArray(bls) ? bls.length : 0;
                },
                cellStyle: { textAlign: 'center', fontWeight: '600', color: '#2563eb' }
            },
            { 
                field: 'items_count', 
                headerName: 'Articles', 
                width: 80,
                valueGetter: (params: any) => params.data?.items?.length || 0,
                cellStyle: { textAlign: 'center', fontWeight: '600', color: '#059669' }
            },
            { 
                field: 'created_at', 
                headerName: 'Date création', 
                width: 110,
                valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-'
            },
        ],
        []
    );

    const itemsColumnDefs = useMemo<ColDef[]>(
        () => [
            { 
                field: 'product.code', 
                headerName: 'Code', 
                width: 120,
                valueGetter: (params: any) => params.data?.product?.code || '-'
            },
            { 
                field: 'product.name', 
                headerName: 'Produit', 
                flex: 1,
                valueGetter: (params: any) => params.data?.product?.name || '-'
            },
            { 
                field: 'requested_quantity', 
                headerName: 'Demandé', 
                width: 100,
                valueFormatter: (params: any) => params.value || 0
            },
            { 
                field: 'available_quantity', 
                headerName: 'Disponible', 
                width: 110,
                valueFormatter: (params: any) => params.value || 0,
                cellStyle: (params: any) => {
                    if (params.value < params.data.requested_quantity) {
                        return { backgroundColor: '#fee', color: '#c00' };
                    }
                    return undefined;
                }
            },
            { 
                field: 'prepared_quantity', 
                headerName: 'Préparé', 
                width: 120,
                editable: selected?.status === 'in_progress',
                valueGetter: (params: any) => {
                    return preparedQuantities[params.data.id] ?? params.data.prepared_quantity ?? 0;
                },
                valueSetter: (params: any) => {
                    const maxQty = Math.min(params.data.requested_quantity, params.data.available_quantity);
                    const newValue = parseFloat(params.newValue) || 0;
                    const clampedValue = Math.min(Math.max(0, newValue), maxQty);
                    setPreparedQuantities(prev => ({ ...prev, [params.data.id]: clampedValue }));
                    return true;
                },
                cellStyle: () => {
                    if (selected?.status === 'in_progress') {
                        return { padding: '4px' };
                    }
                    return null;
                },
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: (params: any) => {
                    const maxQty = Math.min(params.data.requested_quantity, params.data.available_quantity);
                    return {
                        min: 0,
                        max: maxQty,
                        precision: 0,
                    };
                }
            },
            // report_shortage allowed while pending or in_progress (docs §6.7) — declare a
            // shortage on a line before reaching Complete Preparation.
            ...(selected?.status === 'pending' || selected?.status === 'in_progress' ? [{
                field: 'shortage_quantity_input',
                headerName: 'Rupture',
                width: 110,
                editable: true,
                valueGetter: (params: any) => shortageQuantities[params.data.id] ?? 0,
                valueSetter: (params: any) => {
                    const maxQty = params.data.requested_quantity;
                    const newValue = parseFloat(params.newValue) || 0;
                    const clampedValue = Math.min(Math.max(0, newValue), maxQty);
                    setShortageQuantities(prev => ({ ...prev, [params.data.id]: clampedValue }));
                    return true;
                },
                cellStyle: { padding: '4px', backgroundColor: '#fff7ed' },
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: (params: any) => ({ min: 0, max: params.data.requested_quantity, precision: 0 }),
            }] : []),
            // continue_preparation only valid once the dispatcher requested rework (docs §6.8) —
            // capped server-side to available_quantity too, but mirror the cap client-side for
            // immediate feedback.
            ...(selected?.status === 'partial_rework_requested' ? [{
                field: 'additional_quantity_input',
                headerName: 'Qté supplémentaire',
                width: 140,
                editable: true,
                valueGetter: (params: any) => additionalQuantities[params.data.id] ?? 0,
                valueSetter: (params: any) => {
                    const maxQty = params.data.available_quantity;
                    const newValue = parseFloat(params.newValue) || 0;
                    const clampedValue = Math.min(Math.max(0, newValue), maxQty);
                    setAdditionalQuantities(prev => ({ ...prev, [params.data.id]: clampedValue }));
                    return true;
                },
                cellStyle: { padding: '4px', backgroundColor: '#faf5ff' },
                cellEditor: 'agNumberCellEditor',
                cellEditorParams: (params: any) => ({ min: 0, max: params.data.available_quantity, precision: 0 }),
            }] : []),
        ],
        [selected?.status, preparedQuantities, shortageQuantities, additionalQuantities]
    );

    const onSelect = (row: BonPreparation) => {
        setSelected(row);
        setPreparedQuantities({});
        setShortageQuantities({});
        setAdditionalQuantities({});
    };

    const handlePrepareClick = () => {
        setShowPrepareConfirm(true);
    };

    const handlePrepare = async () => {
        if (!selected?.id) return;
        setShowPrepareConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Ouverture de la préparation...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await prepare(selected.id);
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Préparation ouverte avec succès</span>
                    </div>
                );
                
                // Refetch both list and detail
                await Promise.all([refetch(), refetchDetail()]);
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de l\'ouverture'}</span>
                </div>
            );
        }
    };

    const handleSaveClick = () => {
        setShowSaveConfirm(true);
    };

    const handleSave = async () => {
        if (!selected?.id) return;
        setShowSaveConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement de la préparation...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await save(selected.id, {
                prepared_quantities: preparedQuantities,
                notes: 'Préparation terminée',
            });
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'Préparation enregistrée avec succès'}</span>
                    </div>
                );

                // complete_preparation now auto-creates the CENTRAL→VAN warehouse transfer in the
                // same call (docs §6.5) — surface it so the magasinier knows the handover is ready
                // without the dispatcher having to trigger anything separately. null means a
                // shortage blocked it (dispatcher must resolve before a transfer can exist).
                const wt = res.output?.warehouse_transfer;
                if (wt) {
                    toast(`Transfert entrepôt ${wt.transfer_number} créé — prêt pour le livreur.`, { icon: '🚚', duration: 6000 });
                } else if (res.output?.status === 'completed_partial') {
                    toast('Rupture détectée — transfert entrepôt en attente de résolution par le dispatcher.', { icon: '⚠️', duration: 6000 });
                }

                // Refetch both list and detail
                await Promise.all([refetch(), refetchDetail()]);
                setPreparedQuantities({});
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de l\'enregistrement'}</span>
                </div>
            );
        }
    };

    const handleRejectClick = () => {
        setShowRejectConfirm(true);
    };

    const handleReject = async () => {
        if (!selected?.id || !rejectReason.trim()) {
            toast.error('Veuillez saisir une raison de rejet');
            return;
        }
        setShowRejectConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Rejet de la préparation...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await reject(selected.id, { rejection_reason: rejectReason });
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'Préparation rejetée avec succès'}</span>
                    </div>
                );
                
                // Refetch both list and detail
                await Promise.all([refetch(), refetchDetail()]);
                setRejectReason('');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec du rejet'}</span>
                </div>
            );
        }
    };

    const shortageLines = useMemo(
        () => Object.entries(shortageQuantities).filter(([, qty]) => qty > 0),
        [shortageQuantities]
    );

    const handleReportShortageClick = () => {
        if (shortageLines.length === 0) {
            toast.error('Saisissez au moins une quantité en rupture sur la colonne "Rupture"');
            return;
        }
        setShowShortageConfirm(true);
    };

    const handleReportShortage = async () => {
        if (!selected?.id || shortageLines.length === 0) return;
        setShowShortageConfirm(false);

        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Déclaration de la rupture...</span>
            </div>,
            { duration: Infinity }
        );

        try {
            const res = await reportShortage(
                selected.id,
                shortageLines
                    .map(([itemId, quantity]) => {
                        const item = items.find((i: any) => String(i.id) === itemId);
                        return item?.product_id != null
                            ? {
                                product_id: item.product_id,
                                shortage_quantity: quantity,
                                shortage_reason: shortageReason,
                                shortage_notes: shortageNotes || undefined,
                            }
                            : null;
                    })
                    .filter((line): line is NonNullable<typeof line> => line !== null)
            );
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'Rupture déclarée'}</span>
                    </div>
                );
                await Promise.all([refetch(), refetchDetail()]);
                setShortageQuantities({});
                setShortageNotes('');
            } else {
                toast.error(res.message || 'Échec de la déclaration');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de la déclaration'}</span>
                </div>
            );
        }
    };

    const additionalLines = useMemo(
        () => Object.entries(additionalQuantities).filter(([, qty]) => qty > 0),
        [additionalQuantities]
    );

    const handleContinuePreparationClick = () => {
        if (additionalLines.length === 0) {
            toast.error('Saisissez au moins une quantité supplémentaire sur la colonne dédiée');
            return;
        }
        setShowContinueConfirm(true);
    };

    const handleContinuePreparation = async () => {
        if (!selected?.id || additionalLines.length === 0) return;
        setShowContinueConfirm(false);

        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Reprise de la préparation...</span>
            </div>,
            { duration: Infinity }
        );

        try {
            const res = await continuePreparation(
                selected.id,
                additionalLines
                    .map(([itemId, quantity]) => {
                        const item = items.find((i: any) => String(i.id) === itemId);
                        return item?.product_id != null ? { product_id: item.product_id, additional_quantity: quantity } : null;
                    })
                    .filter((line): line is NonNullable<typeof line> => line !== null)
            );
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'Préparation reprise'}</span>
                    </div>
                );
                await Promise.all([refetch(), refetchDetail()]);
                setAdditionalQuantities({});
            } else {
                toast.error(res.message || 'Échec de la reprise');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de la reprise'}</span>
                </div>
            );
        }
    };

    const tabs: TabItem[] = useMemo(() => [
        { id: 'info', label: 'Informations', icon: FileText },
        { id: 'items', label: `Articles (${items.length})`, icon: Package },
    ], [items.length]);

    const toggleSection = (id: string, open: boolean) => {
        setOpenSections(prev => ({ ...prev, [id]: open }));
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleScroll = () => {
            if (isScrollingRef.current) return;

            const containerTop = container.scrollTop;
            const tabIds = ['info', 'items'];
            
            for (const tabId of tabIds) {
                const el = sectionRefs.current[tabId];
                if (!el || !openSections[tabId]) continue;

                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;

                if (elTop <= containerTop + 100 && elBottom > containerTop + 50) {
                    if (activeTab !== tabId) {
                        setActiveTab(tabId);
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [openSections, activeTab]);

    const handleTabChange = (id: string) => {
        setActiveTab(id);
        isScrollingRef.current = true;

        if (!openSections[id]) {
            setOpenSections(prev => ({ ...prev, [id]: true }));
        }

        setTimeout(() => {
            const el = sectionRefs.current[id];
            if (el && containerRef.current) {
                containerRef.current.scrollTo({
                    top: el.offsetTop - 10,
                    behavior: 'smooth',
                });
            }
            setTimeout(() => {
                isScrollingRef.current = false;
            }, 500);
        }, 100);
    };

    const getStatusBadge = (status?: string) => {
        // Real BonPreparationStatus glossary (docs §3) — was previously a generic pending/
        // in_progress/completed/rejected set that had no entry for any shortage/rework status, so
        // those always fell through to the gray "unknown" badge.
        const badges: Record<string, { label: string; className: string; icon: any }> = {
            pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
            in_progress: { label: 'En cours', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Play },
            completed_full: { label: 'Terminé', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
            completed_partial: { label: 'Terminé (rupture)', className: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertTriangle },
            partial_rework_requested: { label: 'Rework demandé', className: 'bg-purple-100 text-purple-800 border-purple-200', icon: Wrench },
            awaiting_shortage_review: { label: 'Attente arbitrage', className: 'bg-red-100 text-red-800 border-red-200', icon: AlertTriangle },
            shortage_split_done: { label: 'Rupture traitée', className: 'bg-teal-100 text-teal-800 border-teal-200', icon: CheckCircle2 },
            shortage_accepted: { label: 'Rupture acceptée', className: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle },
            rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
        };
        const badge = (status && badges[status]) || { label: status ?? '—', className: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle };
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${badge.className}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </span>
        );
    };

    const mainContent = !selected ? (
        <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
                <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Sélectionnez une préparation pour voir les détails</p>
            </div>
        </div>
    ) : detailLoading ? (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
    ) : (
        <div ref={containerRef} className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">{details?.bp_number}</h2>
                        <p className="text-sm text-gray-500">
                            {details?.delivery_mission?.mission_number ? `Mission: ${details.delivery_mission.mission_number}` : 'Préparation standalone'}
                        </p>
                    </div>
                    <div>{getStatusBadge(details?.status)}</div>
                </div>
                <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={handleTabChange} />
            </div>

            <div className="p-4 space-y-4">
                <div ref={el => { sectionRefs.current['info'] = el; }}>
                    <SageCollapsible
                        title="Informations générales"
                        isOpen={openSections['info']}
                        onOpenChange={(open) => toggleSection('info', open)}
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <FileText className="w-3 h-3" />
                                    N° Préparation
                                </div>
                                <div className="font-semibold text-gray-900">{details?.bp_number}</div>
                            </div>
                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <Package className="w-3 h-3" />
                                    Statut
                                </div>
                                <div>{getStatusBadge(details?.status)}</div>
                            </div>
                            {details?.delivery_mission && (
                                <>
                                    <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                            <FileText className="w-3 h-3" />
                                            Mission associée
                                        </div>
                                        <div className="font-semibold text-gray-900">{details.delivery_mission.mission_number}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                            <User className="w-3 h-3" />
                                            Livreur
                                        </div>
                                        <div className="font-semibold text-gray-900">{details.delivery_mission.rider?.name || '-'}</div>
                                        {details.delivery_mission.rider?.phone && (
                                            <div className="text-xs text-gray-600 mt-1">{details.delivery_mission.rider.phone}</div>
                                        )}
                                    </div>
                                    <div className="p-4 rounded-lg border border-blue-100 bg-blue-50">
                                        <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                                            <Package className="w-3 h-3" />
                                            Nombre de BLs
                                        </div>
                                        <div className="font-bold text-xl text-blue-700">
                                            {details.delivery_mission.delivery_notes?.length || 0}
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-green-100 bg-green-50">
                                        <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
                                            <Package className="w-3 h-3" />
                                            Articles à préparer
                                        </div>
                                        <div className="font-bold text-xl text-green-700">
                                            {items.length}
                                        </div>
                                    </div>
                                </>
                            )}
                            {details?.magasinier && (
                                <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                        <User className="w-3 h-3" />
                                        Magasinier
                                    </div>
                                    <div className="font-semibold text-gray-900">{details.magasinier.name}</div>
                                </div>
                            )}
                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <Clock className="w-3 h-3" />
                                    Date création
                                </div>
                                <div className="font-semibold text-gray-900">
                                    {details?.created_at ? new Date(details.created_at).toLocaleDateString('fr-FR') : '-'}
                                </div>
                            </div>
                            {details?.prepared_at && (
                                <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Date préparation
                                    </div>
                                    <div className="font-semibold text-gray-900">
                                        {new Date(details.prepared_at).toLocaleDateString('fr-FR')}
                                    </div>
                                </div>
                            )}
                            {details?.notes && (
                                <div className="col-span-full p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="text-xs font-semibold text-blue-900 mb-1">Notes</div>
                                    <div className="text-sm text-blue-800">{details.notes}</div>
                                </div>
                            )}
                            {details?.rejection_reason && (
                                <div className="col-span-full p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="text-xs font-semibold text-red-900 mb-1">Raison du rejet</div>
                                    <div className="text-sm text-red-800">{details.rejection_reason}</div>
                                </div>
                            )}
                        </div>
                    </SageCollapsible>
                </div>

                <div ref={el => { sectionRefs.current['items'] = el; }}>
                    <SageCollapsible
                        title={`Articles (${items.length})`}
                        isOpen={openSections['items']}
                        onOpenChange={(open) => toggleSection('items', open)}
                    >
                        <div>
                            {items.length === 0 ? (
                                <div className="text-sm text-gray-500 py-4">Aucun article</div>
                            ) : (
                                <div className="h-64">
                                    <DataGrid 
                                        rowData={items} 
                                        columnDefs={itemsColumnDefs} 
                                        loading={false}
                                    />
                                </div>
                            )}
                        </div>
                    </SageCollapsible>
                </div>
            </div>
        </div>
    );

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <h1 className="text-sm font-semibold text-gray-900 mb-2">Préparations (BP)</h1>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="text-lg font-bold text-slate-700">{stats.total}</div>
                            </div>
                            <div className="bg-yellow-50 rounded p-2">
                                <div className="text-xs text-gray-500">En attente</div>
                                <div className="text-lg font-bold text-yellow-700">{stats.pending}</div>
                            </div>
                            <div className="bg-blue-50 rounded p-2">
                                <div className="text-xs text-gray-500">En cours</div>
                                <div className="text-lg font-bold text-blue-700">{stats.in_progress}</div>
                            </div>
                            <div className="bg-green-50 rounded p-2">
                                <div className="text-xs text-gray-500">Terminé</div>
                                <div className="text-lg font-bold text-green-700">{stats.completed}</div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                            </div>
                        ) : error ? (
                            <div className="p-4 text-center text-red-600">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : (
                            <DataGrid
                                rowData={bonPreparations}
                                columnDefs={columnDefs}
                                onRowSelected={onSelect}
                                loading={loading}
                            />
                        )}
                    </div>
                </div>
            }
            mainContent={mainContent}
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: RefreshCw,
                                    label: 'Rafraîchir',
                                    variant: 'sage',
                                    onClick: () => {
                                        refetch();
                                        if (selected) refetchDetail();
                                    },
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    icon: Play,
                                    label: 'Préparer',
                                    variant: 'primary',
                                    onClick: handlePrepareClick,
                                    disabled: !selected || preparing || selected.status !== 'pending',
                                },
                                {
                                    icon: CheckCircle2,
                                    label: 'Enregistrer',
                                    variant: 'default',
                                    onClick: handleSaveClick,
                                    disabled: !selected || saving || selected.status !== 'in_progress',
                                },
                                {
                                    icon: XCircle,
                                    label: 'Rejeter',
                                    variant: 'default',
                                    onClick: handleRejectClick,
                                    disabled: !selected || rejecting || selected.status === 'completed_full' || selected.status === 'completed_partial' || selected.status === 'rejected',
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    icon: AlertTriangle,
                                    label: 'Déclarer rupture',
                                    variant: 'default',
                                    onClick: handleReportShortageClick,
                                    disabled: !selected || reportingShortage || (selected.status !== 'pending' && selected.status !== 'in_progress'),
                                },
                                {
                                    icon: Wrench,
                                    label: 'Continuer (Rework)',
                                    variant: 'default',
                                    onClick: handleContinuePreparationClick,
                                    disabled: !selected || continuing || selected.status !== 'partial_rework_requested',
                                },
                            ],
                        },
                    ]}
                />
            }
        />

        <ConfirmModal
            isOpen={showPrepareConfirm}
            onClose={() => setShowPrepareConfirm(false)}
            onConfirm={handlePrepare}
            title="Commencer la préparation"
            message={`Êtes-vous sûr de vouloir commencer la préparation "${selected?.bp_number}" ? Les quantités disponibles seront actualisées.`}
            confirmText="Commencer"
            cancelText="Annuler"
            variant="info"
            loading={preparing}
        />

        <ConfirmModal
            isOpen={showSaveConfirm}
            onClose={() => setShowSaveConfirm(false)}
            onConfirm={handleSave}
            title="Enregistrer la préparation"
            message={`Êtes-vous sûr de vouloir enregistrer la préparation "${selected?.bp_number}" ? Les stocks seront mis à jour.`}
            confirmText="Enregistrer"
            cancelText="Annuler"
            variant="warning"
            loading={saving}
        />

        <ConfirmModal
            isOpen={showRejectConfirm}
            onClose={() => {
                setShowRejectConfirm(false);
                setRejectReason('');
            }}
            onConfirm={handleReject}
            title="Rejeter la préparation"
            message={
                <div className="space-y-3">
                    <p>Êtes-vous sûr de vouloir rejeter la préparation "{selected?.bp_number}" ?</p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Raison du rejet *
                        </label>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                            rows={3}
                            placeholder="Expliquez pourquoi cette préparation est rejetée..."
                        />
                    </div>
                </div>
            }
            confirmText="Rejeter"
            cancelText="Annuler"
            variant="danger"
            loading={rejecting}
        />

        <ConfirmModal
            isOpen={showShortageConfirm}
            onClose={() => setShowShortageConfirm(false)}
            onConfirm={handleReportShortage}
            title="Déclarer une rupture"
            message={
                <div className="space-y-3">
                    <p>
                        Déclarer une rupture sur {shortageLines.length} article{shortageLines.length > 1 ? 's' : ''} de la
                        préparation "{selected?.bp_number}" ?
                    </p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Raison</label>
                        <select
                            value={shortageReason}
                            onChange={(e) => setShortageReason(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                            {SHORTAGE_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                        <textarea
                            value={shortageNotes}
                            onChange={(e) => setShortageNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                            rows={2}
                            placeholder="Contexte de la rupture..."
                        />
                    </div>
                </div>
            }
            confirmText="Déclarer"
            cancelText="Annuler"
            variant="warning"
            loading={reportingShortage}
        />

        <ConfirmModal
            isOpen={showContinueConfirm}
            onClose={() => setShowContinueConfirm(false)}
            onConfirm={handleContinuePreparation}
            title="Continuer la préparation"
            message={`Reprendre la préparation "${selected?.bp_number}" avec ${additionalLines.length} article${additionalLines.length > 1 ? 's' : ''} supplémentaire${additionalLines.length > 1 ? 's' : ''} ? Les quantités saisies seront ajoutées à ce qui a déjà été préparé.`}
            confirmText="Continuer"
            cancelText="Annuler"
            variant="info"
            loading={continuing}
        />
    </>
    );
};
