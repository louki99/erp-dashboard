import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Play, CheckCircle2, XCircle, Package, Clock, AlertCircle, FileText, User, AlertTriangle, Wrench, Save, CheckCheck, Check, Zap, Printer, Download, Search, Calendar } from 'lucide-react';
import { openPdf, downloadPdf } from '@/utils/pdfUtils';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmModal } from '@/components/common/Modal';
import {
    useMagasinierPreparationsAll,
    useMagasinierPreparationDetail,
    useMagasinierPrepare,
    useMagasinierUpdateItems,
    useMagasinierSavePreparation,
    useMagasinierRejectPreparation,
    useMagasinierReportShortage,
    useMagasinierContinuePreparation,
} from '@/hooks/magasinier';
import type { BonPreparation, PreparationsScope } from '@/types/magasinier.types';

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

    const [scope, setScope] = useState<PreparationsScope>('active');
    const [search, setSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const { data, loading, error, refetch } = useMagasinierPreparationsAll({
        scope,
        search: search || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
    });
    const bonPreparations = data?.data ?? [];
    const counts = data?.counts ?? {};

    const scopeCount = (s: PreparationsScope): number => {
        if (s === 'active') return (counts.pending ?? 0) + (counts.in_progress ?? 0);
        if (s === 'rupture_watch') return (counts.awaiting_shortage_review ?? 0) + (counts.partial_rework_requested ?? 0) + (counts.shortage_split_done ?? 0) + (counts.shortage_accepted ?? 0);
        if (s === 'history') return (counts.completed_full ?? 0) + (counts.completed_partial ?? 0) + (counts.rejected ?? 0);
        return Object.values(counts).reduce((a: number, b) => a + (b as number), 0);
    };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useMagasinierPreparationDetail(selected?.id ?? null);
    // GET /preparations/{id} also returns the BP flat, no wrapper (docs §6.2).
    const details = detailData;
    const items = details?.items ?? [];

    // Shared cap: never let a prepared quantity exceed what was both requested and
    // physically available — mirrors the server-side clamp so the UI never proposes
    // a value the backend would reject.
    const maxAcceptable = (item: any) => Math.min(item.requested_quantity ?? 0, item.available_quantity ?? item.requested_quantity ?? 0);

    const isLineAccepted = (item: any) => {
        const max = maxAcceptable(item);
        if (max <= 0) return false;
        const effective = preparedQuantities[item.id] ?? item.prepared_quantity ?? 0;
        return effective >= max;
    };

    const acceptanceProgress = useMemo(() => {
        const acceptable = items.filter((i: any) => maxAcceptable(i) > 0);
        const accepted = acceptable.filter((i: any) => isLineAccepted(i));
        return { accepted: accepted.length, total: acceptable.length };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, preparedQuantities]);

    const { prepare, loading: preparing } = useMagasinierPrepare();
    const { updateItems, loading: savingProgress } = useMagasinierUpdateItems();
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
                width: 140,
                cellRenderer: (params: any) => {
                    const statusMap: Record<string, { label: string; className: string }> = {
                        pending: { label: 'En attente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
                        in_progress: { label: 'En cours', className: 'bg-sage-50 text-sage-700 border-sage-200' },
                        completed_full: { label: 'Terminé', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                        completed_partial: { label: 'Terminé (rupture)', className: 'bg-orange-50 text-orange-700 border-orange-200' },
                        partial_rework_requested: { label: 'Rework demandé', className: 'bg-purple-50 text-purple-700 border-purple-200' },
                        awaiting_shortage_review: { label: 'Attente arbitrage', className: 'bg-red-50 text-red-700 border-red-200' },
                        shortage_split_done: { label: 'Rupture traitée', className: 'bg-teal-50 text-teal-700 border-teal-200' },
                        shortage_accepted: { label: 'Rupture acceptée', className: 'bg-amber-50 text-amber-700 border-amber-200' },
                        rejected: { label: 'Rejeté', className: 'bg-rose-50 text-rose-700 border-rose-200' },
                    };
                    const status = statusMap[params.data?.status] || { label: params.data?.status || '—', className: 'bg-gray-50 text-gray-700 border-gray-200' };
                    return (
                        <div className="flex items-center h-full">
                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold border shadow-sm ${status.className}`}>
                                {status.label}
                            </span>
                        </div>
                    );
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
            {
                field: 'delivery_date',
                headerName: 'Date livraison',
                width: 120,
                valueGetter: (params: any) => params.data?.delivery_mission?.delivery_date || null,
                valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-',
                cellStyle: { color: '#4f46e5', fontWeight: '500' },
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
                editable: details?.status === 'in_progress',
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
                cellStyle: (params: any) => {
                    if (details?.status !== 'in_progress') return null;
                    const accepted = isLineAccepted(params.data);
                    return accepted
                        ? { padding: '4px', backgroundColor: '#ecfdf5', fontWeight: '700', color: '#047857' }
                        : { padding: '4px' };
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
            // Autofill shortcut — one click copies "Demandé" into "Préparé" (capped to available
            // stock, same cap the manual input enforces) instead of forcing the magasinier to
            // retype the full quantity on every fully-stocked line.
            ...(details?.status === 'in_progress' ? [{
                field: 'accept_all',
                headerName: '',
                width: 180,
                sortable: false,
                filter: false,
                cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', backgroundColor: 'transparent' },
                cellRenderer: (params: any) => {
                    const item = params.data;
                    const maxQty = maxAcceptable(item);
                    const accepted = isLineAccepted(item);
                    if (maxQty <= 0) {
                        return (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-red-500 bg-red-50 border border-red-100">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                Stock indisponible
                            </span>
                        );
                    }
                    return (
                        <button
                            type="button"
                            title={accepted ? 'Quantité demandée déjà appliquée' : 'Accepter la quantité demandée'}
                            onClick={() => setPreparedQuantities(prev => ({ ...prev, [item.id]: maxQty }))}
                            disabled={accepted}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
                                accepted
                                    ? 'text-emerald-700 bg-emerald-100 border-emerald-300 cursor-default shadow-inner'
                                    : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 hover:shadow-sm hover:-translate-y-px border-emerald-200 active:translate-y-0'
                            }`}
                        >
                            {accepted ? <Check className="w-3.5 h-3.5 shrink-0" /> : <CheckCheck className="w-3.5 h-3.5 shrink-0" />}
                            {accepted ? 'Quantité acceptée' : 'Accepter même quantité'}
                        </button>
                    );
                },
            }] : []),
            // report_shortage allowed while pending or in_progress (docs §6.7) — declare a
            // shortage on a line before reaching Complete Preparation. Defaults to the live
            // computed shortfall (Demandé - Préparé) so it's never stuck at 0 while picking is in
            // progress — the magasinier can still type over it to declare a different value (e.g.
            // a known shortage before they've even started entering "Préparé").
            ...(details?.status === 'pending' || details?.status === 'in_progress' ? [{
                field: 'shortage_quantity_input',
                headerName: 'Rupture',
                width: 110,
                editable: true,
                valueGetter: (params: any) => {
                    if (params.data.id in shortageQuantities) return shortageQuantities[params.data.id];
                    const requested = params.data.requested_quantity ?? 0;
                    const effectivePrepared = preparedQuantities[params.data.id] ?? params.data.prepared_quantity ?? 0;
                    return Math.max(0, requested - effectivePrepared);
                },
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
            ...(details?.status === 'partial_rework_requested' ? [{
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
        ] as ColDef[],
        [details?.status, preparedQuantities, shortageQuantities, additionalQuantities]
    );

    const onSelect = (row: BonPreparation) => {
        setSelected(row);
        setPreparedQuantities({});
        setShortageQuantities({});
        setAdditionalQuantities({});
    };

    // One-shot bulk accept — fills "Préparé" with the demanded quantity (capped to
    // stock on hand) on every line at once, instead of clicking "Accepter" per row.
    // Only touches lines that aren't already fully accepted, so it's safe to press
    // again after a partial manual edit without clobbering deliberate overrides below max.
    const handleAcceptAllQuantities = () => {
        const acceptable = items.filter((i: any) => maxAcceptable(i) > 0 && !isLineAccepted(i));
        if (acceptable.length === 0) {
            toast.error('Aucune ligne à accepter — tout est déjà à quantité demandée ou en rupture totale');
            return;
        }
        setPreparedQuantities((prev) => {
            const next = { ...prev };
            acceptable.forEach((item: any) => { next[item.id] = maxAcceptable(item); });
            return next;
        });
        toast.success(`${acceptable.length} ligne${acceptable.length > 1 ? 's' : ''} acceptée${acceptable.length > 1 ? 's' : ''} à quantité demandée`);
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

                // Soft stock pre-check (docs §6.3) — non-blocking, but worth surfacing so the
                // magasinier knows up front a line might come up short before they even start
                // picking, instead of discovering it line-by-line.
                const warnings = res.output?.stock_warnings;
                if (warnings?.length) {
                    toast(
                        `${warnings.length} article(s) avec stock insuffisant prévu — ${warnings.map((w) => w.product_name).join(', ')}`,
                        { icon: '⚠️', duration: 7000 }
                    );
                }

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

    // update_preparation (docs §6.4) — saves current prepared_quantities without finalizing the
    // BP, so progress isn't lost if the magasinier has to pause mid-pick. Separate from "Enregistrer"
    // (complete_preparation), which is the terminal action.
    const handleSaveProgress = async () => {
        if (!selected?.id) return;
        const entries = Object.entries(preparedQuantities)
            .map(([itemId, qty]) => {
                const item = items.find((i: any) => String(i.id) === itemId);
                return item?.product_id != null ? { product_id: item.product_id, prepared_quantity: qty } : null;
            })
            .filter((line): line is NonNullable<typeof line> => line !== null);

        if (entries.length === 0) {
            toast.error('Saisissez au moins une quantité préparée');
            return;
        }

        try {
            const res = await updateItems(selected.id, entries);
            if (res.success) {
                const stats = res.output?.statistics;
                toast.success(
                    stats ? `Progrès enregistré — ${stats.progress.toFixed(0)}% (${stats.total_prepared}/${stats.total_requested})` : 'Progrès enregistré'
                );
                await Promise.all([refetch(), refetchDetail()]);
            } else {
                toast.error(res.message || "Échec de l'enregistrement du progrès");
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Échec de l'enregistrement du progrès");
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
                // continue_preparation caps each line to actual available stock server-side and
                // silently skips lines it can't apply (backend-confirmed 2026-06-23) — `updated_items`
                // is always present, even empty, so that's the reliable signal a "success" response
                // didn't actually move anything (stock still insufficient since the rework was requested).
                if (res.output?.updated_items?.length === 0) {
                    toast(
                        "Aucune ligne n'a pu être appliquée — le stock est probablement encore insuffisant pour les quantités saisies.",
                        { icon: '⚠️', duration: 7000 }
                    );
                } else {
                    toast.success(
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{res.message || 'Préparation reprise'}</span>
                        </div>
                    );
                }
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
            pending: { label: 'En attente', className: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border-amber-300 shadow-sm', icon: Clock },
            in_progress: { label: 'En cours', className: 'bg-gradient-to-r from-sage-100 to-sage-200 text-sage-900 border-sage-300 shadow-sm', icon: Play },
            completed_full: { label: 'Terminé', className: 'bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-900 border-emerald-300 shadow-sm', icon: CheckCircle2 },
            completed_partial: { label: 'Terminé (rupture)', className: 'bg-gradient-to-r from-orange-100 to-amber-100 text-orange-900 border-orange-300 shadow-sm', icon: AlertTriangle },
            partial_rework_requested: { label: 'Rework demandé', className: 'bg-gradient-to-r from-purple-100 to-fuchsia-100 text-purple-900 border-purple-300 shadow-sm', icon: Wrench },
            awaiting_shortage_review: { label: 'Attente arbitrage', className: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-900 border-red-300 shadow-sm', icon: AlertTriangle },
            shortage_split_done: { label: 'Rupture traitée', className: 'bg-gradient-to-r from-teal-100 to-emerald-100 text-teal-900 border-teal-300 shadow-sm', icon: CheckCircle2 },
            shortage_accepted: { label: 'Rupture acceptée', className: 'bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-900 border-amber-300 shadow-sm', icon: AlertTriangle },
            rejected: { label: 'Rejeté', className: 'bg-gradient-to-r from-red-100 to-rose-100 text-red-900 border-red-300 shadow-sm', icon: XCircle },
        };
        const badge = (status && badges[status]) || { label: status ?? '—', className: 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-800 border-gray-300 shadow-sm', icon: AlertCircle };
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${badge.className}`}>
                <Icon className="w-3.5 h-3.5" />
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
            <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
        </div>
    ) : (
        <div ref={containerRef} className="h-full overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-6 py-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">{details?.bp_number}</h2>
                        <p className="text-sm font-medium text-gray-500 mt-0.5">
                            {details?.delivery_mission?.mission_number ? `Mission: ${details.delivery_mission.mission_number}` : 'Préparation standalone'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {details?.id && (
                            <>
                                <button
                                    onClick={() => openPdf('bp', details.id, { force: true, watermark: details.status === 'in_progress' ? 'DRAFT' : undefined })}
                                    title="Imprimer le BP (PDF)"
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => downloadPdf('bp', details.id)}
                                    title="Télécharger le BP (PDF)"
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                >
                                    <Download className="w-4 h-4" />
                                </button>
                            </>
                        )}
                        <div>{getStatusBadge(details?.status)}</div>
                    </div>
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
                            <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    <FileText className="w-4 h-4 text-gray-400" />
                                    N° Préparation
                                </div>
                                <div className="font-extrabold text-lg text-gray-900">{details?.bp_number}</div>
                            </div>
                            <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    Statut
                                </div>
                                <div>{getStatusBadge(details?.status)}</div>
                            </div>
                            {details?.delivery_mission && (
                                <>
                                    <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            <FileText className="w-4 h-4 text-gray-400" />
                                            Mission associée
                                        </div>
                                        <div className="font-extrabold text-lg text-gray-900">{details.delivery_mission.mission_number}</div>
                                    </div>
                                    <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            Livreur
                                        </div>
                                        <div className="font-extrabold text-lg text-gray-900">{details.delivery_mission.rider?.name || '-'}</div>
                                        {details.delivery_mission.rider?.phone && (
                                            <div className="text-sm font-medium text-gray-500 mt-1">{details.delivery_mission.rider.phone}</div>
                                        )}
                                    </div>
                                    <div className="p-4 rounded-xl border border-sage-100 bg-gradient-to-br from-sage-50 to-sage-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-200 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative">
                                            <div className="flex items-center gap-2 text-xs font-bold text-sage-600 uppercase tracking-wider mb-2">
                                                <Package className="w-4 h-4" />
                                                Nombre de BLs
                                            </div>
                                            <div className="font-black text-3xl text-sage-700 tracking-tight">
                                                {details.delivery_mission.delivery_notes?.length || 0}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200 rounded-full blur-2xl -mr-10 -mt-10 opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="relative">
                                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                                                <Package className="w-4 h-4" />
                                                Articles à préparer
                                            </div>
                                            <div className="font-black text-3xl text-emerald-700 tracking-tight">
                                                {items.length}
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                            {details?.magasinier && (
                                <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        Magasinier
                                    </div>
                                    <div className="font-extrabold text-lg text-gray-900">{details.magasinier.name}</div>
                                </div>
                            )}
                            <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    Date création
                                </div>
                                <div className="font-extrabold text-lg text-gray-900">
                                    {details?.created_at ? new Date(details.created_at).toLocaleDateString('fr-FR') : '-'}
                                </div>
                            </div>
                            {details?.prepared_at && (
                                <div className="p-4 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                        <CheckCircle2 className="w-4 h-4 text-gray-400" />
                                        Date préparation
                                    </div>
                                    <div className="font-extrabold text-lg text-gray-900">
                                        {new Date(details.prepared_at).toLocaleDateString('fr-FR')}
                                    </div>
                                </div>
                            )}
                            {details?.notes && (
                                <div className="col-span-full p-3 bg-sage-50 border border-sage-200 rounded-lg">
                                    <div className="text-xs font-semibold text-sage-900 mb-1">Notes</div>
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
                        rightContent={
                            details?.status === 'in_progress' && items.length > 0 ? (
                                <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                    {acceptanceProgress.total > 0 && (
                                        <div className="hidden sm:flex items-center gap-2">
                                            <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        acceptanceProgress.accepted >= acceptanceProgress.total ? 'bg-emerald-500' : 'bg-sage-500'
                                                    }`}
                                                    style={{ width: `${(acceptanceProgress.accepted / acceptanceProgress.total) * 100}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-bold text-gray-500 whitespace-nowrap">
                                                {acceptanceProgress.accepted}/{acceptanceProgress.total} prêtes
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleAcceptAllQuantities}
                                        disabled={acceptanceProgress.accepted >= acceptanceProgress.total}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                                    >
                                        <Zap className="w-3.5 h-3.5 shrink-0" />
                                        Tout accepter
                                    </button>
                                </div>
                            ) : undefined
                        }
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
                    {/* Header */}
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <h1 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                            Bons de Préparation
                        </h1>
                        {/* Scope tabs */}
                        <div className="flex gap-1 mb-2">
                            {([
                                { key: 'active', label: 'En cours' },
                                { key: 'rupture_watch', label: 'Ruptures' },
                                { key: 'history', label: 'Historique' },
                                { key: 'all', label: 'Tous' },
                            ] as { key: PreparationsScope; label: string }[]).map(({ key, label }) => {
                                const cnt = scopeCount(key);
                                const active = scope === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => { setScope(key); setSelected(null); }}
                                        className={`flex-1 flex items-center justify-center gap-1 py-1 px-1 rounded text-[10px] font-semibold transition-colors ${
                                            active
                                                ? 'bg-sage-500 text-white shadow-sm'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                        }`}
                                    >
                                        {label}
                                        {cnt > 0 && (
                                            <span className={`text-[9px] font-bold px-1 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'}`}>
                                                {cnt}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        {/* Search */}
                        <div className="relative mb-1.5">
                            <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Rechercher BP, mission..."
                                className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300 focus:border-indigo-300"
                            />
                        </div>
                        {/* Date range */}
                        <div className="flex gap-1 items-center">
                            <Calendar size={10} className="text-gray-400 shrink-0" />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                            <span className="text-[10px] text-gray-400">→</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="flex-1 px-1.5 py-0.5 text-[10px] border border-gray-200 rounded bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-6 h-6 animate-spin text-sage-600" />
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
                                    disabled: !selected || !details || preparing || details.status !== 'pending',
                                },
                                {
                                    icon: Save,
                                    label: 'Sauvegarder le progrès',
                                    variant: 'default',
                                    onClick: handleSaveProgress,
                                    disabled: !selected || !details || savingProgress || details.status !== 'in_progress' || Object.keys(preparedQuantities).length === 0,
                                },
                                {
                                    icon: CheckCircle2,
                                    label: 'Enregistrer',
                                    variant: 'default',
                                    onClick: handleSaveClick,
                                    disabled: !selected || !details || saving || details.status !== 'in_progress',
                                },
                                {
                                    icon: XCircle,
                                    label: 'Rejeter',
                                    variant: 'default',
                                    onClick: handleRejectClick,
                                    disabled: !selected || !details || rejecting || details.status === 'completed_full' || details.status === 'completed_partial' || details.status === 'rejected',
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
                                    disabled: !selected || !details || reportingShortage || (details.status !== 'pending' && details.status !== 'in_progress'),
                                },
                                {
                                    icon: Wrench,
                                    label: 'Continuer (Rework)',
                                    variant: 'default',
                                    onClick: handleContinuePreparationClick,
                                    disabled: !selected || !details || continuing || details.status !== 'partial_rework_requested',
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
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
                        La mission et ses BL repasseront en brouillon. La commande reste liée à la mission
                        (pas de retour en "Commandes en attente") — le dispatcher pourra relancer la
                        confirmation de mission une fois le problème résolu.
                    </p>
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
