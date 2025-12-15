import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, CheckCircle2, Send, XCircle, Printer, Package, TrendingUp, Clock, CheckCheck, FileText, Truck, Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmModal } from '@/components/common/Modal';
import { AddBlToBchModal } from '@/components/dispatcher/AddBlToBchModal';
import { BalanceModal } from '@/components/dispatcher/BalanceModal';
import {
    useDispatcherBonChargementsList,
    useDispatcherBonChargementDetail,
    useDispatcherValidateBch,
    useDispatcherBchBalance,
    useDispatcherUpdateBchBalance,
    useDispatcherSubmitBch,
    useDispatcherCancelBch,
    useDispatcherPrintBch,
    useDispatcherAddBlToBch,
    useDispatcherRemoveBlFromBch,
} from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { BonChargement } from '@/types/dispatcher.types';

export const DispatcherBonChargementsPage = () => {
    const [selected, setSelected] = useState<BonChargement | null>(null);
    const [activeTab, setActiveTab] = useState<string>('info');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        bls: true,
        balance: false,
    });
    const [showAddBlModal, setShowAddBlModal] = useState(false);
    const [blToRemove, setBlToRemove] = useState<{ id: number; bl_number: string } | null>(null);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showValidateConfirm, setShowValidateConfirm] = useState(false);
    const [showCancelConfirm, setShowCancelConfirm] = useState(false);
    const [showBalanceModal, setShowBalanceModal] = useState(false);

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useDispatcherBonChargementsList();
    const bonChargements = (data as any)?.bonChargements?.data || [];
    const stats = (data as any)?.stats || { total: 0, pending: 0, in_preparation: 0, prepared: 0, completed: 0 };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useDispatcherBonChargementDetail(selected?.id ?? null);
    const { data: balanceData, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useDispatcherBchBalance(selected?.id ?? null);
    const { validate, loading: validating } = useDispatcherValidateBch();
    const { update: updateBalance, loading: updatingBalance } = useDispatcherUpdateBchBalance();
    const { submit, loading: submitting } = useDispatcherSubmitBch();
    const { cancel, loading: cancelling } = useDispatcherCancelBch();
    const { print, loading: printing } = useDispatcherPrintBch();
    const { addBl, loading: addingBl } = useDispatcherAddBlToBch();
    const { removeBl, loading: removingBl } = useDispatcherRemoveBlFromBch();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'id', headerName: 'ID', width: 70 },
            { field: 'bch_number', headerName: 'BCH', width: 220 },
            { field: 'status', headerName: 'Statut', width: 120 },
            { field: 'livreur.name', headerName: 'Livreur', flex: 1, minWidth: 150 },
            { 
                field: 'bon_livraisons', 
                headerName: 'BLs', 
                width: 70,
                valueGetter: (params: any) => params.data?.bon_livraisons?.length || 0
            },
            { 
                field: 'created_at', 
                headerName: 'Date', 
                width: 100,
                valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-'
            },
        ],
        []
    );

    const [selectedBlForRemoval, setSelectedBlForRemoval] = useState<any>(null);

    const blsColumnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'bl_number', headerName: 'BL', width: 200 },
            { field: 'status', headerName: 'Statut', width: 120 },
            { 
                field: 'total_amount', 
                headerName: 'Montant', 
                width: 130,
                valueFormatter: (params: any) => `${parseFloat(params.value || 0).toLocaleString()} Dh`
            },
            { 
                field: 'created_at', 
                headerName: 'Date', 
                flex: 1,
                valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-'
            },
        ],
        []
    );

    const onSelect = (row: BonChargement) => {
        setSelected(row);
    };

    const handleSubmitClick = () => {
        setShowSubmitConfirm(true);
    };

    const submitSelected = async () => {
        if (!selected?.id) return;
        setShowSubmitConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Soumission du BCH en cours...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await submit(selected.id);
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'BCH soumis au magasinier avec succès'}</span>
                    </div>
                );
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec de la soumission');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de la soumission'}</span>
                </div>
            );
        }
    };

    const handleValidateClick = () => {
        setShowValidateConfirm(true);
    };

    const validateSelected = async () => {
        if (!selected?.id) return;
        setShowValidateConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Validation du BCH en cours...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await validate(selected.id);
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'BCH validé avec succès'}</span>
                    </div>
                );
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec de la validation');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de la validation'}</span>
                </div>
            );
        }
    };

    const handleCancelClick = () => {
        setShowCancelConfirm(true);
    };

    const cancelSelected = async () => {
        if (!selected?.id) return;
        setShowCancelConfirm(false);
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Annulation du BCH en cours...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await cancel(selected.id);
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'BCH annulé avec succès'}</span>
                    </div>
                );
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec de l\'annulation');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(
                <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    <span>{e instanceof Error ? e.message : 'Échec de l\'annulation'}</span>
                </div>
            );
        }
    };

    const printSelected = async () => {
        if (!selected?.id) return;
        try {
            toast.loading('Génération du PDF...');
            const res = await print(selected.id);
            toast.dismiss();
            if (res.success) {
                toast.success('PDF généré');
            } else {
                toast.error(res.message || 'Échec impression');
            }
        } catch (e) {
            toast.dismiss();
            toast.error(e instanceof Error ? e.message : 'Échec impression');
        }
    };

    const handleAddBls = async (blIds: number[]) => {
        if (!selected?.id) return;
        try {
            toast.loading('Ajout des BLs...');
            const res = await addBl(selected.id, blIds);
            toast.dismiss();
            if (res.success) {
                toast.success(res.message || `${blIds.length} BL(s) ajouté(s) avec succès`);
                setShowAddBlModal(false);
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec ajout BLs');
            }
        } catch (e) {
            toast.dismiss();
            toast.error(e instanceof Error ? e.message : 'Échec ajout BLs');
        }
    };

    const handleRemoveBl = async () => {
        if (!selected?.id || !blToRemove) return;
        try {
            toast.loading('Retrait du BL...');
            const res = await removeBl(selected.id, blToRemove.id);
            toast.dismiss();
            if (res.success) {
                toast.success(res.message || 'BL retiré avec succès');
                setBlToRemove(null);
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec retrait BL');
            }
        } catch (e) {
            toast.dismiss();
            toast.error(e instanceof Error ? e.message : 'Échec retrait BL');
        }
    };

    const handleSaveBalance = async (allocations: Record<number, Record<number, number>>) => {
        if (!selected?.id) return;
        
        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enregistrement de la balance...</span>
            </div>,
            { duration: Infinity }
        );
        
        try {
            const res = await updateBalance(selected.id, { allocations });
            toast.dismiss(toastId);
            
            if (res.success) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{res.message || 'Balance enregistrée avec succès'}</span>
                    </div>
                );
                setShowBalanceModal(false);
                await Promise.all([refetch(), refetchDetail(), refetchBalance()]);
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

    const details = detailData?.bch || selected;
    const bls = details?.bon_livraisons || [];

    const tabs: TabItem[] = useMemo(
        () => [
            { id: 'info', label: 'Informations', icon: FileText },
            { id: 'bls', label: `BLs (${bls.length})`, icon: Package },
            { id: 'balance', label: 'Balance', icon: TrendingUp },
        ],
        [bls.length]
    );

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
                    if (activeTab !== tab.id) {
                        setActiveTab(tab.id);
                    }
                    break;
                }
            }
        };

        container.addEventListener('scroll', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
        };
    }, [openSections, tabs, activeTab]);

    const handleTabChange = (id: string) => {
        setActiveTab(id);
        isScrollingRef.current = true;

        if (!openSections[id]) {
            setOpenSections(prev => ({ ...prev, [id]: true }));
        }

        setTimeout(() => {
            const el = sectionRefs.current[id];
            const container = containerRef.current;

            if (el && container) {
                const elementTop = el.offsetTop;
                container.scrollTo({
                    top: elementTop - container.offsetTop,
                    behavior: 'smooth'
                });
            }
            setTimeout(() => { isScrollingRef.current = false; }, 600);
        }, 100);
    };

    const toggleSection = (id: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [id]: isOpen }));
    };

    const handleExpandAll = () => {
        const allOpen = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: true }), {});
        setOpenSections(allOpen);
    };

    const handleCollapseAll = () => {
        const allClosed = tabs.reduce((acc, tab) => ({ ...acc, [tab.id]: false }), {});
        setOpenSections(allClosed);
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { label: string; className: string; icon: any }> = {
            pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
            in_preparation: { label: 'En préparation', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package },
            prepared: { label: 'Préparé', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCheck },
            completed: { label: 'Complété', className: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
            cancelled: { label: 'Annulé', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
        };
        const badge = badges[status] || badges.pending;
        const Icon = badge.icon;
        return (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${badge.className}`}>
                <Icon className="w-3 h-3" />
                {badge.label}
            </span>
        );
    };

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <h1 className="text-sm font-semibold text-gray-900 mb-2">Bons de chargement (BCH)</h1>
                        
                        <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="bg-slate-50 rounded p-2">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="text-lg font-bold text-slate-700">{stats.total}</div>
                            </div>
                            <div className="bg-yellow-50 rounded p-2">
                                <div className="text-xs text-gray-500">En attente</div>
                                <div className="text-lg font-bold text-yellow-700">{stats.pending}</div>
                            </div>
                            <div className="bg-green-50 rounded p-2">
                                <div className="text-xs text-gray-500">Préparés</div>
                                <div className="text-lg font-bold text-green-700">{stats.prepared}</div>
                            </div>
                            <div className="bg-emerald-50 rounded p-2">
                                <div className="text-xs text-gray-500">Complétés</div>
                                <div className="text-lg font-bold text-emerald-700">{stats.completed}</div>
                            </div>
                        </div>
                    </div>

                    {error && <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-100">{error}</div>}

                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid rowData={bonChargements} columnDefs={columnDefs} loading={loading} onRowSelected={onSelect} />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-white overflow-hidden">
                    {!selected ? (
                        <div className="flex-1 flex items-center justify-center bg-slate-50">
                            <div className="text-center">
                                <Package className="w-16 h-16 text-gray-300 mb-4 mx-auto" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun BCH sélectionné</h3>
                                <p className="text-sm text-gray-500">Sélectionnez un bon de chargement dans la liste pour voir les détails</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="bg-white border-b border-gray-200 p-4 shrink-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h1 className="text-xl font-bold text-gray-900">{details?.bch_number}</h1>
                                        <div className="flex items-center gap-3 mt-2">
                                            {getStatusBadge(details?.status || 'pending')}
                                            <span className="text-sm text-gray-500">ID: {details?.id}</span>
                                        </div>
                                    </div>
                                    {(detailLoading || validating || submitting || cancelling || printing) && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Traitement...
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 bg-white border-b border-gray-200">
                                <SageTabs
                                    tabs={tabs}
                                    activeTabId={activeTab}
                                    onTabChange={handleTabChange}
                                    onExpandAll={handleExpandAll}
                                    onCollapseAll={handleCollapseAll}
                                    className="px-4 shadow-none"
                                />
                            </div>

                            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">
                                <div ref={el => { sectionRefs.current['info'] = el; }}>
                                    <SageCollapsible
                                        title="Informations"
                                        isOpen={openSections['info']}
                                        onOpenChange={(open) => toggleSection('info', open)}
                                    >
                                        <div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                        <Truck className="w-3 h-3" />
                                                        Livreur
                                                    </div>
                                                    <div className="font-semibold text-gray-900">{details?.livreur?.name || '-'}</div>
                                                    <div className="text-xs text-gray-500 mt-1">{details?.livreur?.email || '-'}</div>
                                                </div>
                                                <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                        <FileText className="w-3 h-3" />
                                                        Bons de livraison
                                                    </div>
                                                    <div className="font-semibold text-gray-900">{bls.length} BL(s)</div>
                                                </div>
                                                <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                                        <Clock className="w-3 h-3" />
                                                        Date création
                                                    </div>
                                                    <div className="font-semibold text-gray-900">
                                                        {details?.created_at ? new Date(details.created_at).toLocaleDateString('fr-FR') : '-'}
                                                    </div>
                                                    <div className="text-xs text-gray-500 mt-1">
                                                        {details?.created_at ? new Date(details.created_at).toLocaleTimeString('fr-FR') : ''}
                                                    </div>
                                                </div>

                                                {details?.submitted_at && (
                                                    <div className="col-span-full mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <div className="text-xs font-semibold text-blue-900">Soumis le: {new Date(details.submitted_at).toLocaleString('fr-FR')}</div>
                                                    </div>
                                                )}

                                                {details?.notes && (
                                                    <div className="col-span-full mt-2">
                                                        <div className="text-xs font-semibold text-gray-600 mb-2">Notes</div>
                                                        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-sm text-gray-700">
                                                            {details.notes}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <div ref={el => { sectionRefs.current['bls'] = el; }}>
                                    <SageCollapsible
                                        title={`Bons de livraison (${bls.length})`}
                                        isOpen={openSections['bls']}
                                        onOpenChange={(open) => toggleSection('bls', open)}
                                    >
                                        <div className="space-y-3">
                                            {(selected?.status === 'pending' || selected?.status === 'draft') && (
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        {selectedBlForRemoval && (
                                                            <button
                                                                onClick={() => {
                                                                    setBlToRemove({ 
                                                                        id: selectedBlForRemoval.id, 
                                                                        bl_number: selectedBlForRemoval.bl_number 
                                                                    });
                                                                }}
                                                                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                                Retirer le BL sélectionné
                                                            </button>
                                                        )}
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            console.log('Add BL button clicked, opening modal');
                                                            setShowAddBlModal(true);
                                                        }}
                                                        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                        Ajouter des BLs
                                                    </button>
                                                </div>
                                            )}
                                            {bls.length === 0 ? (
                                                <div className="text-sm text-gray-500 py-4">Aucun BL associé</div>
                                            ) : (
                                                <div className="h-64">
                                                    <DataGrid 
                                                        rowData={bls} 
                                                        columnDefs={blsColumnDefs} 
                                                        loading={false}
                                                        onRowSelected={(row) => setSelectedBlForRemoval(row)}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <div ref={el => { sectionRefs.current['balance'] = el; }}>
                                    <SageCollapsible
                                        title="Balance BCH"
                                        isOpen={openSections['balance']}
                                        onOpenChange={(open) => {
                                            toggleSection('balance', open);
                                            if (open && selected) refetchBalance();
                                        }}
                                    >
                                        <div>
                                            {balanceLoading ? (
                                                <div className="flex items-center justify-center py-8 text-gray-400">
                                                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                                                    Chargement de la balance...
                                                </div>
                                            ) : balanceError ? (
                                                <div className="text-sm text-red-600">{balanceError}</div>
                                            ) : balanceData && (balanceData as any).data?.shortageAnalysis ? (
                                                <div className="space-y-4">
                                                    {(balanceData as any).data.shortageAnalysis.length === 0 ? (
                                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                            <div className="flex items-center gap-2 text-green-800">
                                                                <CheckCircle2 className="w-5 h-5" />
                                                                <span className="font-medium">Aucune rupture détectée</span>
                                                            </div>
                                                            <p className="text-sm text-green-700 mt-1">Tous les produits sont disponibles en quantité suffisante.</p>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            {details?.status === 'in_transit' || details?.status === 'completed' || details?.status === 'cancelled' ? (
                                                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                                                    <div className="flex items-start gap-3">
                                                                        <AlertCircle className="w-5 h-5 text-gray-500 mt-0.5" />
                                                                        <div>
                                                                            <div className="flex items-center gap-2 text-gray-800 mb-1">
                                                                                <span className="font-semibold">Ruptures détectées</span>
                                                                            </div>
                                                                            <p className="text-sm text-gray-700 mb-2">{(balanceData as any).data.shortageAnalysis.length} produit(s) en rupture</p>
                                                                            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                                                                                <strong>BCH verrouillé:</strong> Le livreur a accepté ce BCH. Les modifications ne sont plus possibles. 
                                                                                Pour toute modification, le livreur doit créer une décharge.
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <div className="flex items-center gap-2 text-red-800 mb-1">
                                                                                <XCircle className="w-5 h-5" />
                                                                                <span className="font-semibold">Ruptures détectées</span>
                                                                            </div>
                                                                            <p className="text-sm text-red-700">{(balanceData as any).data.shortageAnalysis.length} produit(s) en rupture</p>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setShowBalanceModal(true)}
                                                                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <TrendingUp className="w-4 h-4" />
                                                                                Équilibrer
                                                                            </div>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                            
                                                            <div className="space-y-3">
                                                                {(balanceData as any).data.shortageAnalysis.map((item: any, idx: number) => (
                                                                    <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                                                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                                                            <div className="flex items-start justify-between">
                                                                                <div className="flex-1">
                                                                                    <div className="font-semibold text-gray-900 text-sm">{item.product_name}</div>
                                                                                    <div className="text-xs text-gray-500 mt-0.5">ID: {item.product_id}</div>
                                                                                </div>
                                                                                <div className="ml-3 text-right">
                                                                                    <div className="text-xs text-gray-500">Manque</div>
                                                                                    <div className="text-lg font-bold text-red-600">{item.shortfall}</div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                                                <div className="bg-white px-2 py-1 rounded border border-gray-200">
                                                                                    <div className="text-xs text-gray-500">Demandé</div>
                                                                                    <div className="font-semibold text-gray-900">{item.total_requested}</div>
                                                                                </div>
                                                                                <div className="bg-white px-2 py-1 rounded border border-gray-200">
                                                                                    <div className="text-xs text-gray-500">Préparé</div>
                                                                                    <div className="font-semibold text-gray-900">{item.total_prepared}</div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                        
                                                                        {item.requesting_bls && item.requesting_bls.length > 0 && (
                                                                            <div className="p-3 bg-white">
                                                                                <div className="text-xs font-semibold text-gray-700 mb-2">BLs concernés ({item.requesting_bls.length})</div>
                                                                                <div className="space-y-2">
                                                                                    {item.requesting_bls.map((bl: any, blIdx: number) => (
                                                                                        <div key={blIdx} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <div className="text-sm font-medium text-gray-900 truncate">{bl.bl_number}</div>
                                                                                                <div className="text-xs text-gray-600 truncate">{bl.partner_name} ({bl.partner_code})</div>
                                                                                            </div>
                                                                                            <div className="ml-3 flex items-center gap-3 text-xs">
                                                                                                <div className="text-right">
                                                                                                    <div className="text-gray-500">Demandé</div>
                                                                                                    <div className="font-semibold text-gray-900">{bl.requested_qty}</div>
                                                                                                </div>
                                                                                                <div className="text-right">
                                                                                                    <div className="text-gray-500">Suggéré</div>
                                                                                                    <div className={`font-semibold ${bl.suggested_qty < parseFloat(bl.requested_qty) ? 'text-red-600' : 'text-green-600'}`}>
                                                                                                        {bl.suggested_qty}
                                                                                                    </div>
                                                                                                </div>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </>
                                                    )}
                                                    
                                                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                                                        Dernière mise à jour: {new Date().toLocaleString('fr-FR')}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 py-4">Aucune donnée de balance disponible</div>
                                            )}
                                        </div>
                                    </SageCollapsible>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            }
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
                                        if (selected) {
                                            refetchDetail();
                                            if (openSections.balance) refetchBalance();
                                        }
                                    },
                                },
                            ],
                        },
                        {
                            items: [
                                {
                                    icon: Send,
                                    label: 'Soumettre',
                                    variant: 'primary',
                                    onClick: handleSubmitClick,
                                    disabled: !selected || submitting || selected.status !== 'pending',
                                },
                                {
                                    icon: CheckCircle2,
                                    label: 'Valider',
                                    variant: 'default',
                                    onClick: handleValidateClick,
                                    disabled: !selected || validating || selected.status === 'completed' || selected.status === 'in_transit' || selected.status === 'cancelled',
                                },
                                {
                                    icon: XCircle,
                                    label: 'Annuler',
                                    variant: 'default',
                                    onClick: handleCancelClick,
                                    disabled: !selected || cancelling || selected.status === 'cancelled' || selected.status === 'completed' || selected.status === 'in_transit',
                                },
                                {
                                    icon: Printer,
                                    label: 'Imprimer',
                                    variant: 'default',
                                    onClick: printSelected,
                                    disabled: !selected || printing,
                                },
                            ],
                        },
                    ]}
                />
            }
        />

        <AddBlToBchModal
            isOpen={showAddBlModal}
            onClose={() => setShowAddBlModal(false)}
            onConfirm={handleAddBls}
            loading={addingBl}
            existingBlIds={bls.map((bl: any) => bl.id)}
        />

        <ConfirmModal
            isOpen={!!blToRemove}
            onClose={() => setBlToRemove(null)}
            onConfirm={handleRemoveBl}
            title="Retirer le BL du BCH"
            message={`Êtes-vous sûr de vouloir retirer le BL "${blToRemove?.bl_number}" de ce bon de chargement ?`}
            confirmText="Retirer"
            cancelText="Annuler"
            variant="danger"
            loading={removingBl}
        />

        <ConfirmModal
            isOpen={showSubmitConfirm}
            onClose={() => setShowSubmitConfirm(false)}
            onConfirm={submitSelected}
            title="Soumettre le BCH au magasinier"
            message={`Êtes-vous sûr de vouloir soumettre le BCH "${selected?.bch_number}" au magasinier ? Cette action ne peut pas être annulée facilement.`}
            confirmText="Soumettre"
            cancelText="Annuler"
            variant="warning"
            loading={submitting}
        />

        <ConfirmModal
            isOpen={showValidateConfirm}
            onClose={() => setShowValidateConfirm(false)}
            onConfirm={validateSelected}
            title="Valider le BCH"
            message={`Êtes-vous sûr de vouloir valider le BCH "${selected?.bch_number}" ? Cette action confirmera que le BCH est prêt et correct.`}
            confirmText="Valider"
            cancelText="Annuler"
            variant="info"
            loading={validating}
        />

        <ConfirmModal
            isOpen={showCancelConfirm}
            onClose={() => setShowCancelConfirm(false)}
            onConfirm={cancelSelected}
            title="Annuler le BCH"
            message={`Êtes-vous sûr de vouloir annuler le BCH "${selected?.bch_number}" ? Cette action est définitive et le BCH ne pourra plus être utilisé.`}
            confirmText="Annuler le BCH"
            cancelText="Retour"
            variant="danger"
            loading={cancelling}
        />

        <BalanceModal
            isOpen={showBalanceModal}
            onClose={() => setShowBalanceModal(false)}
            onSave={handleSaveBalance}
            shortageAnalysis={(balanceData as any)?.data?.shortageAnalysis || []}
            loading={updatingBalance}
        />
    </>
    );
};
