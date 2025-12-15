import { useMemo, useState, useRef, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Play, CheckCircle2, XCircle, Package, Clock, AlertCircle, FileText, User } from 'lucide-react';
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
} from '@/hooks/magasinier';
import type { BonPreparation } from '@/types/magasinier.types';

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
    const [rejectReason, setRejectReason] = useState('');
    const [preparedQuantities, setPreparedQuantities] = useState<Record<string, number>>({});

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const { data, loading, error, refetch } = useMagasinierPreparationsList();
    const bonPreparations = (data as any)?.data || [];
    const stats = { 
        total: bonPreparations.length,
        pending: bonPreparations.filter((bp: BonPreparation) => bp.status === 'pending').length,
        in_progress: bonPreparations.filter((bp: BonPreparation) => bp.status === 'in_progress').length,
        completed: bonPreparations.filter((bp: BonPreparation) => bp.status === 'completed').length,
    };

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useMagasinierPreparationDetail(selected?.id ?? null);
    const details = (detailData as any);
    const items = details?.items || [];

    const { prepare, loading: preparing } = useMagasinierPrepare();
    const { save, loading: saving } = useMagasinierSavePreparation();
    const { reject, loading: rejecting } = useMagasinierRejectPreparation();

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
                        completed: 'Terminé',
                        rejected: 'Rejeté',
                    };
                    return statusMap[params.data?.status] || params.data?.status;
                },
                cellStyle: (params: any) => {
                    const styleMap: Record<string, any> = {
                        pending: { backgroundColor: '#fef3c7', color: '#78350f', fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' },
                        in_progress: { backgroundColor: '#dbeafe', color: '#1e3a8a', fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' },
                        completed: { backgroundColor: '#d1fae5', color: '#064e3b', fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' },
                        rejected: { backgroundColor: '#fee2e2', color: '#7f1d1d', fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' },
                    };
                    return styleMap[params.data?.status] || { backgroundColor: '#f3f4f6', color: '#111827', fontWeight: '600', borderRadius: '6px', fontSize: '11px', textAlign: 'center', display: 'inline-block' };
                }
            },
            { 
                field: 'bch_number', 
                headerName: 'N° BCH', 
                width: 180,
                valueGetter: (params: any) => {
                    const bch = params.data?.bon_chargement?.bch_number;
                    return bch || '-';
                }
            },
            { 
                field: 'livreur_name', 
                headerName: 'Livreur', 
                width: 140,
                valueGetter: (params: any) => {
                    const name = params.data?.bon_chargement?.livreur?.name;
                    return name || '-';
                }
            },
            { 
                field: 'bls_count', 
                headerName: 'BLs', 
                width: 70,
                valueGetter: (params: any) => {
                    const bls = params.data?.bon_chargement?.bon_livraisons;
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
        ],
        [selected?.status, preparedQuantities]
    );

    const onSelect = (row: BonPreparation) => {
        setSelected(row);
        setPreparedQuantities({});
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

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { label: string; className: string; icon: any }> = {
            pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
            in_progress: { label: 'En cours', className: 'bg-blue-100 text-blue-800 border-blue-200', icon: Play },
            completed: { label: 'Terminé', className: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
            rejected: { label: 'Rejeté', className: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
        };
        const badge = badges[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle };
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
                            {details?.bonChargement?.bch_number ? `BCH: ${details.bonChargement.bch_number}` : 'Préparation standalone'}
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
                            {details?.bonChargement && (
                                <>
                                    <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                            <FileText className="w-3 h-3" />
                                            BCH associé
                                        </div>
                                        <div className="font-semibold text-gray-900">{details.bonChargement.bch_number}</div>
                                    </div>
                                    <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                            <User className="w-3 h-3" />
                                            Livreur
                                        </div>
                                        <div className="font-semibold text-gray-900">{details.bonChargement.livreur?.name || '-'}</div>
                                        {details.bonChargement.livreur?.phone && (
                                            <div className="text-xs text-gray-600 mt-1">{details.bonChargement.livreur.phone}</div>
                                        )}
                                    </div>
                                    <div className="p-4 rounded-lg border border-blue-100 bg-blue-50">
                                        <div className="flex items-center gap-2 text-xs text-blue-600 mb-1">
                                            <Package className="w-3 h-3" />
                                            Nombre de BLs
                                        </div>
                                        <div className="font-bold text-xl text-blue-700">
                                            {details.bonChargement.bon_livraisons?.length || 0}
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
                                    disabled: !selected || rejecting || selected.status === 'completed' || selected.status === 'rejected',
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
    </>
    );
};
