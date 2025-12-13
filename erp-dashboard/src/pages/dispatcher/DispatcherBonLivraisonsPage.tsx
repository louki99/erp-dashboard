import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { FileText, Loader2, Package, PackagePlus, RefreshCw, Save, Truck, User, X, CheckSquare, Users } from 'lucide-react';
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
} from '@/hooks/dispatcher/useDispatcherBonLivraisons';
import { useDispatcherCreateBch } from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { BonLivraison, Livreur } from '@/types/dispatcher.types';

export const DispatcherBonLivraisonsPage = () => {
    const [selected, setSelected] = useState<BonLivraison | null>(null);
    const [selectedBls, setSelectedBls] = useState<BonLivraison[]>([]);
    const [selectedLivreurId, setSelectedLivreurId] = useState<number | ''>('');
    const [bulkLivreurId, setBulkLivreurId] = useState<number | ''>('');
    const [deliveryDate, setDeliveryDate] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [activeTab, setActiveTab] = useState<string>('bl');
    const [showDetailPanel, setShowDetailPanel] = useState<boolean>(false);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        bl: true,
        commande: true,
        client: true,
        lignes: true
    });

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useDispatcherDraftBonLivraisons();
    const draftBls = data?.draftBls || [];
    const livreurs = data?.livreurs || [];

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
    const { create: createBch, loading: creatingBch } = useDispatcherCreateBch();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { 
                field: 'id', 
                headerName: '', 
                width: 50,
                checkboxSelection: true,
                headerCheckboxSelection: true,
            },
            { field: 'bl_number', headerName: 'BL', width: 190 },
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
    const tabs: TabItem[] = useMemo(
        () => [
            { id: 'bl', label: 'BL', icon: FileText },
            { id: 'commande', label: 'Bon de commande', icon: Package },
            { id: 'client', label: 'Client', icon: User },
            { id: 'lignes', label: `Lignes (${detailsBl?.items?.length || 0})`, icon: Truck },
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

    const bulkAssignLivreur = async () => {
        if (selectedBls.length === 0) {
            toast.error('Sélectionne au moins un BL');
            return;
        }
        if (bulkLivreurId === '') {
            toast.error('Sélectionne un livreur');
            return;
        }

        try {
            const promises = selectedBls.map(bl => 
                update(bl.id, {
                    livreur_id: Number(bulkLivreurId),
                    delivery_date: deliveryDate || undefined,
                })
            );
            
            await Promise.all(promises);
            toast.success(`${selectedBls.length} BL(s) affecté(s) au livreur`);
            await refetch();
            setSelectedBls([]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec affectation');
        }
    };

    const bulkUnassignLivreur = async () => {
        if (selectedBls.length === 0) {
            toast.error('Sélectionne au moins un BL');
            return;
        }

        try {
            const promises = selectedBls.map(bl => 
                update(bl.id, { livreur_id: undefined })
            );
            
            await Promise.all(promises);
            toast.success(`${selectedBls.length} BL(s) désaffecté(s)`);
            await refetch();
            setSelectedBls([]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec désaffectation');
        }
    };

    const createBchFromMultiple = async () => {
        if (selectedBls.length === 0) {
            toast.error('Sélectionne au moins un BL');
            return;
        }
        if (bulkLivreurId === '') {
            toast.error('Sélectionne un livreur pour le BCH');
            return;
        }

        try {
            const blIds = selectedBls.map(bl => bl.id).join(',');
            const res = await createBch({
                bl_ids: blIds,
                livreur_id: Number(bulkLivreurId),
                notes: notes || undefined,
            });

            if (res.success) {
                toast.success(`BCH créé avec ${selectedBls.length} BL(s)`);
                await refetch();
                setSelectedBls([]);
            } else {
                toast.error(res.message || 'Échec création BCH');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec création BCH');
        }
    };

    return (
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
                                            <h1 className="text-xl font-bold text-gray-900">
                                                {detailsBl?.bl_number || `BL #${selected?.id}`}
                                            </h1>
                                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                                <span className="font-medium">Statut: {detailsBl?.status || '-'}</span>
                                                {detailsBl?.partner && <span>{detailsBl.partner.name}</span>}
                                            </div>
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
                                        <div>
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
                                                    <option value="">-- Sélectionner --</option>
                                                    {livreurs.map((l: Livreur) => (
                                                        <option key={l.id} value={l.id}>
                                                            {l.name}
                                                        </option>
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
                            </div>
                        </div>
                    ) : null}

                    {/* Right Drawer - Selection Panel */}
                    {selectedBls.length > 0 && (
                        <div className={`${showDetailPanel ? 'w-96' : 'flex-1'} bg-white border-l border-gray-200 flex flex-col`}>
                            {/* Drawer Header */}
                            <div className="p-4 border-b border-gray-200 bg-sage-50 shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <CheckSquare className="w-5 h-5 text-sage-600" />
                                        <h2 className="text-sm font-bold text-gray-900">
                                            Sélection ({selectedBls.length} BL{selectedBls.length > 1 ? 's' : ''})
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => setSelectedBls([])}
                                        className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 font-medium"
                                    >
                                        <X className="w-4 h-4" /> Tout effacer
                                    </button>
                                </div>
                                <div className="text-xs text-gray-600">
                                    Total: {selectedBls.reduce((sum, bl) => sum + parseFloat(bl.total_amount || '0'), 0).toLocaleString()} Dh
                                </div>
                            </div>

                            {/* Bulk Actions */}
                            <div className="p-3 border-b border-gray-200 bg-white space-y-2">
                                <div className="text-xs font-semibold text-gray-700 mb-2">Actions groupées</div>
                                <div>
                                    <select
                                        value={bulkLivreurId}
                                        onChange={(e) => setBulkLivreurId(e.target.value === '' ? '' : Number(e.target.value))}
                                        className="w-full text-xs rounded border border-gray-300 px-2 py-1.5 focus:ring-1 focus:ring-sage-500"
                                    >
                                        <option value="">-- Livreur pour tous --</option>
                                        {livreurs.map((l: Livreur) => (
                                            <option key={l.id} value={l.id}>{l.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={bulkAssignLivreur}
                                        disabled={saving || bulkLivreurId === ''}
                                        className="flex-1 text-xs bg-sage-600 text-white px-2 py-1.5 rounded hover:bg-sage-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckSquare className="w-3 h-3" />}
                                        Affecter
                                    </button>
                                    <button
                                        onClick={createBchFromMultiple}
                                        disabled={creatingBch || bulkLivreurId === ''}
                                        className="flex-1 text-xs bg-blue-600 text-white px-2 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1"
                                    >
                                        {creatingBch ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackagePlus className="w-3 h-3" />}
                                        BCH
                                    </button>
                                </div>
                            </div>

                            {/* Selected BLs List */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {selectedBls.map((bl) => (
                                    <div key={bl.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:border-sage-300 transition-colors">
                                        {/* BL Header */}
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="text-sm font-bold text-gray-900">{bl.bl_number}</div>
                                                <div className="text-xs text-gray-600 mt-0.5">{bl.partner?.name}</div>
                                                <div className="text-xs font-semibold text-sage-600 mt-1">
                                                    {parseFloat(bl.total_amount || '0').toLocaleString()} Dh
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => setSelectedBls(prev => prev.filter(b => b.id !== bl.id))}
                                                className="p-1 rounded hover:bg-red-50 text-red-600 hover:text-red-800 transition-colors"
                                                title="Retirer de la sélection"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Livreur Assignment */}
                                        <div className="space-y-1.5">
                                            <label className="block text-xs font-medium text-gray-600">Livreur</label>
                                            <select
                                                value={bl.livreur_id || ''}
                                                onChange={async (e) => {
                                                    const livreurId = e.target.value === '' ? undefined : Number(e.target.value);
                                                    try {
                                                        await update(bl.id, { livreur_id: livreurId });
                                                        toast.success('Livreur affecté');
                                                        await refetch();
                                                    } catch (err) {
                                                        toast.error('Erreur affectation');
                                                    }
                                                }}
                                                className="w-full text-xs rounded border border-gray-300 px-2 py-1 focus:ring-1 focus:ring-sage-500"
                                            >
                                                <option value="">-- Non affecté --</option>
                                                {livreurs.map((l: Livreur) => (
                                                    <option key={l.id} value={l.id}>{l.name}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex gap-1.5 mt-2">
                                            <button
                                                onClick={() => {
                                                    setSelected(bl);
                                                    setShowDetailPanel(true);
                                                }}
                                                className="flex-1 text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                                            >
                                                Détails
                                            </button>
                                        </div>
                                    </div>
                                ))}
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
                                    icon: PackagePlus,
                                    label: 'Créer BCH',
                                    variant: 'default',
                                    onClick: createBchFromSelected,
                                    disabled: !selected || creatingBch,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
