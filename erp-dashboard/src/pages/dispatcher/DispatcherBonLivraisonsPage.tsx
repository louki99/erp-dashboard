import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { FileText, Loader2, Package, PackagePlus, RefreshCw, Save, Truck, User, X, CheckSquare, Scissors, History } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import {
    useDispatcherDraftBonLivraisons,
    useDispatcherBonLivraisonEdit,
    useDispatcherUpdateBonLivraison,
    useDispatcherSplitBonLivraison,
} from '@/hooks/dispatcher/useDispatcherBonLivraisons';
import { SplitBlModal } from '@/components/dispatcher/SplitBlModal';
import { useDispatcherCreateBch } from '@/hooks/dispatcher/useDispatcherBonChargements';
import { useRiders } from '@/hooks/useRiders';
import { useDispatcherBLWorkflow } from '@/hooks/dispatcher/useDispatcherWorkflow';
import { WorkflowHistory } from '@/components/workflow/WorkflowHistory';
import { BLWorkflowActions } from '@/components/dispatcher/BLWorkflowActions';
import type { BonLivraison } from '@/types/dispatcher.types';
import type { Rider } from '@/services/api/ridersApi';

const BLHistorySection = ({ blId }: { blId?: number }) => {
    const { workflowHistory, isLoadingHistory } = useDispatcherBLWorkflow(blId || 0);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ history: true });

    const toggleSection = (id: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [id]: isOpen }));
    };

    if (!blId) return null;

    return (
        <div ref={el => { sectionRefs.current['history'] = el; }}>
            <SageCollapsible
                title="Historique Workflow"
                isOpen={openSections['history']}
                onOpenChange={(open) => toggleSection('history', open)}
            >
                <div className="p-4">
                    <WorkflowHistory 
                        history={workflowHistory} 
                        isLoading={isLoadingHistory}
                    />
                </div>
            </SageCollapsible>
        </div>
    );
};

export const DispatcherBonLivraisonsPage = () => {
    const [selected, setSelected] = useState<BonLivraison | null>(null);
    const [selectedBls, setSelectedBls] = useState<BonLivraison[]>([]);
    const [selectedLivreurId, setSelectedLivreurId] = useState<number | ''>('');
    const [bulkLivreurId, setBulkLivreurId] = useState<number | ''>('');
    const [deliveryDate, setDeliveryDate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('bl');
    const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
    const [showSplitModal, setShowSplitModal] = useState(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        bl: true,
        commande: true,
        client: true,
        lignes: true,
        history: true
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useDispatcherDraftBonLivraisons();
    const draftBls = data?.draftBls || [];
    
    // Fetch riders/livreurs from dedicated API
    const { riders: livreurs, loading: livreursLoading } = useRiders();

    // Summary stats
    const stats = useMemo(() => {
        const byVille: Record<string, number> = {};
        const byClient: Record<string, number> = {};
        let totalAmount = 0;
        
        draftBls.forEach(bl => {
            const ville = bl.partner?.city || bl.partner?.postal_code || 'Non spécifié';
            const client = bl.partner?.name || 'Inconnu';
            byVille[ville] = (byVille[ville] || 0) + 1;
            byClient[client] = (byClient[client] || 0) + 1;
            totalAmount += parseFloat(bl.total_amount || '0');
        });
        
        return { byVille, byClient, totalAmount, totalBls: draftBls.length };
    }, [draftBls]);

    const { data: editData, loading: editLoading, error: editError, refetch: refetchEdit } = useDispatcherBonLivraisonEdit(selected?.id ?? null);
    const { update, loading: saving } = useDispatcherUpdateBonLivraison();
    const { split, loading: splitting } = useDispatcherSplitBonLivraison();
    const { create: createBch, loading: creatingBch } = useDispatcherCreateBch();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { 
                field: 'bl_number', 
                headerName: 'BL', 
                width: 190,
                cellRenderer: (params: any) => {
                    const bl = params.data;
                    if (!bl) return params.value;
                    
                    let badgeText = '';
                    if (bl.parent_bl_id) {
                        badgeText = ' [Enfant]';
                    } else if (bl.status === 'split') {
                        badgeText = ' [Divisé]';
                    }
                    
                    return (params.value || '') + badgeText;
                }
            },
            { field: 'bon_commande.bc_number', headerName: 'BC', width: 150 },
            { field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 200 },
            { 
                field: 'partner.city', 
                headerName: 'Ville', 
                width: 140,
                valueGetter: (params: any) => params.data?.partner?.city || params.data?.partner?.postal_code || '-'
            },
            { 
                field: 'total_amount', 
                headerName: 'Total', 
                width: 110,
                valueFormatter: (params: any) => `${parseFloat(params.value || 0).toLocaleString()} Dh`
            },
            { field: 'delivery_date', headerName: 'Livraison', width: 120 },
        ],
        []
    );

    const detailsBl = editData?.bl || selected;
    
    // Debug: Log button state
    console.log('Button state check:', {
        selected: !!selected,
        editLoading,
        status: detailsBl?.status,
        itemsLength: detailsBl?.items?.length,
        diviserDisabled: !selected || editLoading || detailsBl?.status !== 'draft' || (detailsBl?.items?.length ?? 0) < 2,
        creerBchDisabled: !selected || editLoading || creatingBch
    });
    const tabs: TabItem[] = useMemo(
        () => [
            { id: 'bl', label: 'BL', icon: FileText },
            { id: 'commande', label: 'Bon de commande', icon: Package },
            { id: 'client', label: 'Client', icon: User },
            { id: 'lignes', label: `Lignes (${detailsBl?.items?.length || 0})`, icon: Truck },
            { id: 'history', label: 'Historique Workflow', icon: History },
        ],
        [detailsBl?.items?.length]
    );

    const onSelect = (row: BonLivraison) => {
        // Only show detail panel on explicit row double-click, not checkbox selection
        setSelected(row);
        setSelectedLivreurId(row.livreur_id ?? '');
        setDeliveryDate(row.delivery_date ?? '');
        setNotes(row.notes ?? '');
        setActiveTab('bl');
        setShowDetailPanel(true);
    };

    const onSelectionChanged = (rows: BonLivraison[]) => {
        setSelectedBls(rows);
        // Don't interfere with multi-selection by showing detail panel
    };

    // Scroll Spy Logic
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
        return () => container.removeEventListener('scroll', handleScroll);
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

    const saveBl = async () => {
        if (!selected?.id) return;
        try {
            const payload = {
                delivery_date: deliveryDate || undefined,
                livreur_id: selectedLivreurId === '' ? undefined : Number(selectedLivreurId),
                notes: notes || undefined,
                items: editData?.bl?.items?.map((it) => ({
                    id: it.id,
                    allocated_quantity: it.allocated_quantity ?? 0,
                    unit_price: it.unit_price,
                })),
            };

            const res = await update(selected.id, payload);
            if (res.success) toast.success(res.message || 'BL mis à jour');
            else toast.error(res.message || 'Échec mise à jour');

            await refetch();
            await refetchEdit();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec mise à jour');
        }
    };

    const createBchFromSelected = async () => {
        if (!selected?.id) return;
        if (selectedLivreurId === '') {
            toast.error('Sélectionne un livreur avant de créer un BCH');
            return;
        }
        try {
            const res = await createBch({
                bl_ids: String(selected.id),
                livreur_id: Number(selectedLivreurId),
                notes: notes || undefined,
            });

            if (res.success) toast.success(res.message || 'BCH créé');
            else toast.error(res.message || 'Échec création BCH');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec création BCH');
        }
    };

    const handleSplitBl = async (splits: Array<{ items: number[]; notes?: string }>) => {
        if (!selected?.id) return;

        const toastId = toast.loading('Division du BL en cours...');

        try {
            const res = await split(selected.id, { splits });
            toast.dismiss(toastId);

            if (res.success && res.data) {
                toast.success(
                    `BL divisé avec succès en ${res.data.child_bls.length} BLs`,
                    { duration: 4000 }
                );
                setShowSplitModal(false);
                setSelected(null);
                await refetch();
            } else {
                toast.error(res.message || 'Échec de la division');
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de la division');
        }
    };

    const bulkAssignLivreur = async () => {
        if (selectedBls.length === 0) {
            toast.error('Sélectionnez au moins un BL');
            return;
        }
        if (bulkLivreurId === '') {
            toast.error('Sélectionnez un livreur');
            return;
        }

        const selectedRider = livreurs.find(l => l.id === Number(bulkLivreurId));
        const riderName = selectedRider?.name || 'livreur';

        try {
            toast.loading(`Affectation de ${selectedBls.length} BL(s) à ${riderName}...`);
            
            const promises = selectedBls.map(bl => 
                update(bl.id, {
                    livreur_id: Number(bulkLivreurId),
                    delivery_date: deliveryDate || undefined,
                })
            );
            
            await Promise.all(promises);
            toast.dismiss();
            toast.success(`✓ ${selectedBls.length} BL(s) affecté(s) à ${riderName}`);
            await refetch();
            setSelectedBls([]);
        } catch (e) {
            toast.dismiss();
            console.error('Bulk assign error:', e);
            toast.error(e instanceof Error ? e.message : 'Échec de l\'affectation');
        }
    };


    const createBchFromMultiple = async () => {
        if (selectedBls.length === 0) {
            toast.error('Sélectionnez au moins un BL');
            return;
        }
        if (bulkLivreurId === '') {
            toast.error('Sélectionnez un livreur pour le BCH');
            return;
        }

        const selectedRider = livreurs.find(l => l.id === Number(bulkLivreurId));
        const riderName = selectedRider?.name || 'livreur';

        try {
            toast.loading(`Création du BCH pour ${riderName} avec ${selectedBls.length} BL(s)...`);
            
            // Use workflow transition for the first BL to create BCH
            const firstBlId = selectedBls[0].id;
            const blIds = selectedBls.map(bl => bl.id.toString());
            
            // Import workflowStateApi to use transition
            const { workflowStateApi } = await import('@/services/api/workflowStateApi');
            
            const transitionResult = await workflowStateApi.bonLivraison.transition(firstBlId, {
                action: 'grouped',
                comment: `BCH créé pour ${riderName} avec ${selectedBls.length} BL(s)`,
                metadata: {
                    bch_id: null,
                    create_new_bch: true,
                    bl_ids: blIds,
                    livreur_id: Number(bulkLivreurId),
                },
            });

            toast.dismiss();
            
            if (transitionResult.success) {
                const bchNumber = transitionResult.metadata?.bch_creation?.bch?.bch_number || 'BCH';
                toast.success(`✓ ${bchNumber} créé avec ${selectedBls.length} BL(s) pour ${riderName}`);
                await refetch();
                setSelectedBls([]);
                setBulkLivreurId('');
                setNotes('');
            } else {
                toast.error(transitionResult.message || 'Échec de la création du BCH');
            }
        } catch (e) {
            toast.dismiss();
            console.error('Create BCH error:', e);
            toast.error(e instanceof Error ? e.message : 'Échec de la création du BCH');
        }
    };

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="p-3 border-b border-gray-100 shrink-0">
                        <h1 className="text-sm font-semibold text-gray-900 mb-2">Gestion BL Dispatcher</h1>
                        
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <div className="bg-sage-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">BLs</div>
                                <div className="text-base font-bold text-sage-700">{stats.totalBls}</div>
                            </div>
                            <div className="bg-blue-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">Villes</div>
                                <div className="text-base font-bold text-blue-700">{Object.keys(stats.byVille).length}</div>
                            </div>
                            <div className="bg-emerald-50 rounded p-1.5">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="text-xs font-bold text-emerald-700">{stats.totalAmount.toLocaleString()} Dh</div>
                            </div>
                        </div>

                    </div>

                    {error && <div className="px-4 py-2 text-sm text-red-600 border-b border-gray-100 bg-red-50">{error}</div>}

                    {/* DataGrid */}
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid 
                                    rowData={draftBls} 
                                    columnDefs={columnDefs} 
                                    loading={loading} 
                                    onRowSelected={undefined}
                                    onSelectionChanged={onSelectionChanged}
                                    rowSelection="multiple"
                                    onRowDoubleClicked={onSelect}
                                />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="flex h-full bg-slate-50 overflow-hidden">
                    {/* Main area - shows when detail panel is open */}
                    {showDetailPanel && selected ? (
                        <div className="flex-1 flex flex-col bg-white overflow-hidden">
                            {/* Header Sticky */}
                            <div className="bg-white border-b border-gray-200 p-4 shrink-0">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setShowDetailPanel(false)}
                                            className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                                            title="Retour"
                                        >
                                            <X className="w-5 h-5 text-gray-600" />
                                        </button>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h1 className="text-xl font-bold text-gray-900">
                                                    {detailsBl?.bl_number || `BL #${selected?.id}`}
                                                </h1>
                                                {detailsBl?.parent_bl_id && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                                                        BL Enfant
                                                    </span>
                                                )}
                                                {detailsBl?.status === 'split' && (
                                                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded">
                                                        BL Divisé
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                <span className="font-medium">Statut: {detailsBl?.status || '-'}</span>
                                                {detailsBl?.partner && <span>{detailsBl.partner.name}</span>}
                                            </div>
                                            {detailsBl?.parent_bl_id && detailsBl?.parent_bl && (
                                                <div className="mt-2 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                                                    <span className="text-purple-700">
                                                        <strong>BL Parent:</strong> {detailsBl.parent_bl.bl_number}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-sage-600">
                                            {parseFloat(detailsBl?.total_amount || '0').toLocaleString()} <span className="text-xs font-normal text-gray-400">Dh</span>
                                        </div>
                                        {(editLoading || saving) && (
                                            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1 justify-end">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Traitement...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Tabs */}
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

                            {editError && <div className="px-4 py-2 text-sm text-red-600 bg-red-50 border-b border-red-200">{editError}</div>}

                            {/* Content Area */}
                            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                <div ref={el => { sectionRefs.current['bl'] = el; }}>
                                    <SageCollapsible
                                        title="BL"
                                        isOpen={openSections['bl']}
                                        onOpenChange={(open) => toggleSection('bl', open)}
                                    >
                                        <div className="p-4 space-y-4">
                                        {/* Workflow Actions */}
                                        <div className="mb-4 pb-4 border-b border-gray-200">
                                            <BLWorkflowActions 
                                                blId={selected?.id || 0} 
                                                onSuccess={() => {
                                                    refetch();
                                                    refetchEdit();
                                                }}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                <div className="text-xs text-gray-500">BL</div>
                                                <div className="font-semibold text-gray-900">{detailsBl?.bl_number || selected?.id}</div>
                                            </div>
                                            <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                <div className="text-xs text-gray-500">Statut</div>
                                                <div className="font-semibold text-gray-900">{detailsBl?.status || '-'}</div>
                                            </div>
                                        </div>

                                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600">Date livraison</label>
                                                <input
                                                    type="date"
                                                    value={deliveryDate}
                                                    onChange={(e) => setDeliveryDate(e.target.value)}
                                                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600">Livreur</label>
                                                <select
                                                    value={selectedLivreurId}
                                                    onChange={(e) => setSelectedLivreurId(e.target.value === '' ? '' : Number(e.target.value))}
                                                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                                >
                                                    <option value="">-- Non affecté --</option>
                                                    {livreurs.map((l: Rider) => (
                                                        <option key={l.id} value={l.id}>{l.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <label className="block text-xs font-semibold text-gray-600">Notes</label>
                                            <textarea
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                rows={3}
                                                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                                            />
                                        </div>
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <div ref={el => { sectionRefs.current['commande'] = el; }}>
                                    <SageCollapsible
                                        title="Bon de commande"
                                        isOpen={openSections['commande']}
                                        onOpenChange={(open) => toggleSection('commande', open)}
                                    >
                                        <div className="space-y-4">
                                        {detailsBl?.bon_commande ? (
                                            <>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">BC</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.bon_commande.bc_number}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Commande</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.bon_commande.order_code}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Statut BC</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.bon_commande.bc_status}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Total</div>
                                                        <div className="font-semibold text-gray-900">{parseFloat(detailsBl.bon_commande.total_amount).toLocaleString()} Dh</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Paiement</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.bon_commande.payment_method}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Date commande</div>
                                                        <div className="font-semibold text-gray-900">{new Date(detailsBl.bon_commande.order_date).toLocaleDateString('fr-FR')}</div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-500">Aucune commande associée</div>
                                        )}
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <div ref={el => { sectionRefs.current['client'] = el; }}>
                                    <SageCollapsible
                                        title="Client"
                                        isOpen={openSections['client']}
                                        onOpenChange={(open) => toggleSection('client', open)}
                                    >
                                        <div className="space-y-4">
                                        {detailsBl?.partner ? (
                                            <>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Code</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.partner.code}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Nom</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.partner.name}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Téléphone</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.partner.phone || '-'}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Email</div>
                                                        <div className="font-semibold text-gray-900 text-xs">{detailsBl.partner.email || '-'}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Adresse</div>
                                                        <div className="font-semibold text-gray-900 text-xs">{detailsBl.partner.address_line1}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Ville</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.partner.city || detailsBl.partner.postal_code || '-'}</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Crédit disponible</div>
                                                        <div className="font-semibold text-gray-900">{parseFloat(detailsBl.partner.credit_available).toLocaleString()} Dh</div>
                                                    </div>
                                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                                        <div className="text-xs text-gray-500">Statut</div>
                                                        <div className="font-semibold text-gray-900">{detailsBl.partner.status}</div>
                                                    </div>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="text-sm text-gray-500">Aucun client associé</div>
                                        )}
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <div ref={el => { sectionRefs.current['lignes'] = el; }}>
                                    <SageCollapsible
                                        title={`Lignes (${detailsBl?.items?.length || 0})`}
                                        isOpen={openSections['lignes']}
                                        onOpenChange={(open) => toggleSection('lignes', open)}
                                    >
                                        <div>
                                        {detailsBl?.items && detailsBl.items.length > 0 ? (
                                            <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Produit</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté commandée</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté allouée</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Prix unitaire</th>
                                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {detailsBl.items.map((item: any) => (
                                                            <tr key={item.id} className="hover:bg-gray-50">
                                                                <td className="px-4 py-3 text-sm text-gray-900">Produit #{item.product_id}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">{parseFloat(item.ordered_quantity).toFixed(0)}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">{parseFloat(item.allocated_quantity).toFixed(0)}</td>
                                                                <td className="px-4 py-3 text-sm text-gray-900 text-right">{parseFloat(item.unit_price).toFixed(2)} Dh</td>
                                                                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                                                                    {(parseFloat(item.allocated_quantity) * parseFloat(item.unit_price)).toFixed(2)} Dh
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="text-sm text-gray-500">Aucune ligne de commande</div>
                                        )}
                                        </div>
                                    </SageCollapsible>
                                </div>

                                <BLHistorySection blId={selected?.id} />
                            </div>
                        </div>
                    ) : null}

                    {/* Right Drawer - Selection Panel */}
                    {selectedBls.length > 0 && (
                        <div className={`${showDetailPanel ? 'w-96' : 'flex-1'} bg-white border-l border-gray-200 flex flex-col`}>
                            {/* Drawer Header */}
                            <div className="bg-gradient-to-br from-green-600 via-green-700 to-emerald-700 p-3 shrink-0 shadow-lg">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white/20 backdrop-blur-sm rounded-lg">
                                            <Package className="w-5 h-5 text-white" />
                                        </div>
                                        <h2 className="text-base font-bold text-white">Dispatcher BCH</h2>
                                    </div>
                                    <button
                                        onClick={() => setSelectedBls([])}
                                        className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-white backdrop-blur-sm"
                                        title="Effacer la sélection"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                
                                {/* Livreur Selection */}
                                <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
                                        <User className="w-4 h-4" />
                                        Livreur assigné
                                    </label>
                                    <select
                                        value={bulkLivreurId}
                                        onChange={(e) => setBulkLivreurId(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full text-sm rounded-lg border-0 bg-white px-3 py-2 font-medium shadow-lg focus:ring-2 focus:ring-white/50 transition-all"
                                        disabled={livreursLoading}
                                    >
                                        <option value="">{livreursLoading ? '⏳ Chargement...' : '👤 Sélectionner un livreur'}</option>
                                        {livreurs.map((l: Rider) => (
                                            <option key={l.id} value={l.id}>
                                                🚚 {l.name} {l.branch ? `• ${l.branch.name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Selection Summary */}
                            <div className="p-3 bg-gradient-to-br from-gray-50 to-white shrink-0 border-b-2 border-gray-100">
                                {/* Summary Card */}
                                <div className="mb-3 p-3 bg-white rounded-xl shadow-lg border-2 border-green-200">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-green-100 rounded-lg">
                                                <CheckSquare className="w-5 h-5 text-green-700" />
                                            </div>
                                            <div>
                                                <div className="text-xl font-bold text-gray-900">
                                                    {selectedBls.length}
                                                </div>
                                                <div className="text-xs font-medium text-gray-600">BL{selectedBls.length > 1 ? 's' : ''} sélectionné{selectedBls.length > 1 ? 's' : ''}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-green-700">
                                                {selectedBls.reduce((sum, bl) => sum + parseFloat(bl.total_amount || '0'), 0).toLocaleString()}
                                            </div>
                                            <div className="text-xs font-medium text-gray-600">Dh Total</div>
                                        </div>
                                    </div>
                                    {bulkLivreurId === '' && (
                                        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                            <span className="text-sm">⚠️</span>
                                            <p className="text-xs text-amber-800 leading-relaxed">
                                                <strong>Astuce:</strong> Sélectionnez le livreur pour activer les actions
                                            </p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Action Buttons - Inline */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={createBchFromMultiple}
                                        disabled={creatingBch || bulkLivreurId === ''}
                                        className="flex-1 text-sm bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale flex items-center justify-center gap-2 font-bold transition-all shadow-lg hover:shadow-xl"
                                    >
                                        {creatingBch ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                <span className="hidden sm:inline">Création...</span>
                                            </>
                                        ) : (
                                            <>
                                                <PackagePlus className="w-4 h-4" />
                                                <span>Créer BCH</span>
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={bulkAssignLivreur}
                                        disabled={saving || bulkLivreurId === ''}
                                        className="flex-1 text-sm bg-white text-green-700 border-2 border-green-600 px-3 py-3 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-semibold transition-all shadow-md hover:shadow-lg"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
                                        <span>Affecter</span>
                                    </button>
                                </div>
                            </div>

                            {/* Selected BLs List */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                                {selectedBls.map((bl, index) => {
                                    const currentLivreur = livreurs.find(l => l.id === bl.livreur_id);
                                    return (
                                        <div key={bl.id} className="bg-white border-2 border-gray-200 rounded-2xl p-4 hover:border-green-400 hover:shadow-xl transition-all group">
                                            <div className="flex items-start gap-3">
                                                {/* Number Badge */}
                                                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 text-white text-base font-bold shrink-0 shadow-md group-hover:scale-110 transition-transform">
                                                    {index + 1}
                                                </div>
                                                
                                                {/* BL Info */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2 mb-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-bold text-gray-900 truncate">{bl.bl_number}</div>
                                                            <div className="text-xs text-gray-600 mt-1 truncate flex items-center gap-1">
                                                                <User className="w-3 h-3" />
                                                                {bl.partner?.name}
                                                            </div>
                                                        </div>
                                                        {/* Action Buttons */}
                                                        <div className="flex gap-1 shrink-0">
                                                            <button
                                                                onClick={() => {
                                                                    setSelected(bl);
                                                                    setShowDetailPanel(true);
                                                                }}
                                                                className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-800 transition-all hover:scale-110"
                                                                title="Voir détails"
                                                            >
                                                                <FileText className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setSelectedBls(prev => prev.filter(b => b.id !== bl.id))}
                                                                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-800 transition-all hover:scale-110"
                                                                title="Retirer"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Badges */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm font-bold shadow-sm">
                                                            💰 {parseFloat(bl.total_amount || '0').toLocaleString()} Dh
                                                        </div>
                                                        {currentLivreur && (
                                                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-700 rounded-lg text-xs font-semibold shadow-sm">
                                                                <Truck className="w-3.5 h-3.5" />
                                                                <span className="truncate max-w-[120px]">{currentLivreur.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty State - when no selection and no detail */}
                    {!showDetailPanel && selectedBls.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Package className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Mode Dispatcher</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Sélectionnez des BLs avec les cases à cocher.
                                <br />Un panneau apparaîtra à droite pour gérer votre sélection.
                            </p>
                            <p className="text-xs text-gray-400 mt-4">
                                Double-cliquez sur une ligne pour voir les détails.
                            </p>
                        </div>
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
                                    onClick: refetch,
                                },
                                {
                                    icon: Save,
                                    label: 'Enregistrer BL',
                                    variant: 'primary',
                                    onClick: saveBl,
                                    disabled: !selected || saving,
                                },
                                {
                                    icon: Scissors,
                                    label: 'Diviser BL',
                                    variant: 'default',
                                    onClick: () => setShowSplitModal(true),
                                    disabled: !selected || editLoading || detailsBl?.status !== 'draft' || (detailsBl?.items?.length ?? 0) < 2,
                                },
                                {
                                    icon: PackagePlus,
                                    label: 'Créer BCH',
                                    variant: 'default',
                                    onClick: createBchFromSelected,
                                    disabled: !selected || editLoading || creatingBch,
                                },
                            ],
                        },
                    ]}
                />
            }
        />

        <SplitBlModal
            isOpen={showSplitModal}
            onClose={() => setShowSplitModal(false)}
            onConfirm={handleSplitBl}
            items={editData?.bl?.items || []}
            loading={splitting}
        />
        </>
    );
};
