import { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    CheckCircle,
    Download,
    FileText,
    Settings,
    RefreshCw,
    XCircle,
    Clock,
    Trash2,
    Eye,
    AlertTriangle,
    Loader2,
    RotateCcw
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { BatchOperation, BatchLogsResponse, BatchLogsFilters } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { BatchLogsModal } from './BatchLogsModal';
import type { ColDef } from 'ag-grid-community';

type TabType = 'data' | 'details' | 'actions';

export const BatchHistoryPage = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<BatchOperation[]>([]);
    const [selectedBatch, setSelectedBatch] = useState<BatchOperation | null>(null);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<'all' | 'import' | 'export'>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [batchToDelete, setBatchToDelete] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [logsData, setLogsData] = useState<BatchLogsResponse | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsFilters, setLogsFilters] = useState<BatchLogsFilters>({ per_page: 20, page: 1 });
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [batchToCancel, setBatchToCancel] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCanceling, setIsCanceling] = useState(false);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        loadBatches();
    }, [filterType, filterStatus]);

    const loadBatches = async () => {
        try {
            setLoading(true);
            const data = await importExportApi.batches.getBatches({
                operation_type: filterType === 'all' ? undefined : filterType,
                status: filterStatus === 'all' ? undefined : filterStatus
            });
            setBatches(data.batches.data || data.batches);
        } catch (error) {
            console.error('Failed to load batches:', error);
            toast.error('Échec du chargement de l\'historique');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (batchId: string) => {
        setBatchToDelete(batchId);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!batchToDelete) return;
        
        try {
            setIsDeleting(true);
            await importExportApi.batches.deleteBatch(batchToDelete);
            toast.success('Enregistrement supprimé');
            loadBatches();
            if (selectedBatch?.batch_id === batchToDelete) {
                setSelectedBatch(null);
            }
            setShowDeleteModal(false);
            setBatchToDelete(null);
        } catch (error) {
            console.error('Failed to delete batch:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewLogs = async (batchId: string) => {
        try {
            setLogsLoading(true);
            setShowLogsModal(true);
            const data = await importExportApi.batches.getBatchLogs(batchId, logsFilters);
            setLogsData(data);
        } catch (error) {
            console.error('Failed to load logs:', error);
            toast.error('Échec du chargement des logs');
            setShowLogsModal(false);
        } finally {
            setLogsLoading(false);
        }
    };

    const handleLogsFilterChange = async (filters: BatchLogsFilters) => {
        if (!selectedBatch) return;
        setLogsFilters(filters);
        try {
            setLogsLoading(true);
            const data = await importExportApi.batches.getBatchLogs(selectedBatch.batch_id, filters);
            setLogsData(data);
        } catch (error) {
            console.error('Failed to load logs:', error);
            toast.error('Échec du chargement des logs');
        } finally {
            setLogsLoading(false);
        }
    };

    const handleCancelClick = (batchId: string) => {
        setBatchToCancel(batchId);
        setCancelReason('');
        setShowCancelModal(true);
    };

    const handleCancelConfirm = async () => {
        if (!batchToCancel || !cancelReason.trim()) {
            toast.error('Veuillez fournir une raison pour l\'annulation');
            return;
        }
        
        try {
            setIsCanceling(true);
            await importExportApi.batches.cancelBatch(batchToCancel, { reason: cancelReason });
            toast.success('Opération annulée avec succès');
            loadBatches();
            if (selectedBatch?.batch_id === batchToCancel) {
                const updatedBatch = await importExportApi.batches.getBatch(batchToCancel);
                setSelectedBatch(updatedBatch.batch);
            }
            setShowCancelModal(false);
            setBatchToCancel(null);
            setCancelReason('');
        } catch (error) {
            console.error('Failed to cancel batch:', error);
            toast.error('Échec de l\'annulation');
        } finally {
            setIsCanceling(false);
        }
    };

    const handleRetry = async (batchId: string) => {
        try {
            setIsRetrying(true);
            const response = await importExportApi.batches.retryBatch(batchId);
            toast.success(`Nouvelle opération créée: ${response.new_batch_id}`);
            loadBatches();
            const newBatch = await importExportApi.batches.getBatch(response.new_batch_id);
            setSelectedBatch(newBatch.batch);
        } catch (error) {
            console.error('Failed to retry batch:', error);
            toast.error('Échec de la réessai');
        } finally {
            setIsRetrying(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        Terminé
                    </span>
                );
            case 'processing':
                return (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1 w-fit">
                        <RefreshCw className="w-3 h-3" />
                        En cours
                    </span>
                );
            case 'failed':
                return (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        Échoué
                    </span>
                );
            case 'pending':
                return (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1 w-fit">
                        <Clock className="w-3 h-3" />
                        En attente
                    </span>
                );
            default:
                return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{status}</span>;
        }
    };

    // Column definitions for DataGrid
    const colDefs: ColDef<BatchOperation>[] = useMemo(() => [
        {
            field: 'batch_id',
            headerName: 'ID Batch',
            width: 160,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            )
        },
        {
            field: 'operation_type',
            headerName: 'Type',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                        params.value === 'import'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                    }`}>
                        {params.value}
                    </span>
                </div>
            )
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-500">{new Date(params.value).toLocaleString('fr-FR')}</span>
                </div>
            )
        },
        {
            field: 'status',
            headerName: 'Statut',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {getStatusBadge(params.value)}
                </div>
            )
        },
        {
            field: 'total_records',
            headerName: 'Total',
            width: 80,
            cellClass: 'text-right'
        },
        {
            headerName: 'Actions',
            width: 100,
            cellRenderer: (params: any) => {
                const batch = params.data as BatchOperation;
                const canCancel = batch.status === 'processing' || batch.status === 'pending';
                const canRetry = batch.status === 'failed' || batch.status === 'cancelled';
                
                return (
                    <div className="flex items-center justify-center gap-1 h-full">
                        {canCancel && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleCancelClick(batch.batch_id);
                                }}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors"
                                title="Annuler"
                                disabled={isCanceling}
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                        {canRetry && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleRetry(batch.batch_id);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                title="Réessayer"
                                disabled={isRetrying}
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                );
            },
            sortable: false,
            filter: false,
        },
    ], [isCanceling, isRetrying]);

    // Left Sidebar Content
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900">Historique</h2>
                <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {batches.length} opération(s)
                </div>
            </div>

            {/* Filters */}
            <div className="p-3 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as any)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Tous</option>
                            <option value="import">Import</option>
                            <option value="export">Export</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Statut</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                        >
                            <option value="all">Tous</option>
                            <option value="completed">Terminé</option>
                            <option value="processing">En cours</option>
                            <option value="failed">Échoué</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={batches}
                    columnDefs={colDefs}
                    loading={loading}
                    onRowSelected={(data) => {
                        setSelectedBatch(data);
                    }}
                />
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                                <p>Chargement...</p>
                            </div>
                        ) : selectedBatch ? (
                            <BatchDetailView 
                                batch={selectedBatch} 
                                getStatusBadge={getStatusBadge} 
                                navigate={navigate} 
                                handleDelete={handleDeleteClick} 
                                handleViewLogs={handleViewLogs}
                                handleCancel={handleCancelClick}
                                handleRetry={handleRetry}
                                isRetrying={isRetrying}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="font-medium">Sélectionnez une opération</p>
                                    <p className="text-sm mt-2">Cliquez sur une opération dans la liste pour voir les détails</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        onRefresh={loadBatches}
                        onDelete={() => selectedBatch && handleDeleteClick(selectedBatch.batch_id)}
                        hasSelection={!!selectedBatch}
                        navigate={navigate}
                    />
                }
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer l'opération"
                description="Êtes-vous sûr de vouloir supprimer définitivement cet enregistrement ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />

            <BatchLogsModal
                isOpen={showLogsModal}
                onClose={() => setShowLogsModal(false)}
                logsData={logsData}
                loading={logsLoading}
                filters={logsFilters}
                onFilterChange={handleLogsFilterChange}
            />

            <ConfirmationModal
                isOpen={showCancelModal}
                onClose={() => setShowCancelModal(false)}
                onConfirm={handleCancelConfirm}
                title="Annuler l'opération"
                description="Êtes-vous sûr de vouloir annuler cette opération en cours ?"
                confirmText="Annuler l'opération"
                cancelText="Retour"
                variant="warning"
                isLoading={isCanceling}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Raison de l'annulation *
                    </label>
                    <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Ex: Job stuck for 30 minutes"
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                </div>
            </ConfirmationModal>
        </>
    );
};

// Action Panel Component
const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-200 last:border-0">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 hover:bg-gray-50",
        danger: "text-gray-400 hover:text-red-600 hover:bg-red-50"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto ${
                disabled ? "opacity-30 cursor-not-allowed" : variants[variant]
            }`}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900"></span>
            </span>
        </button>
    );
};

interface ActionPanelProps {
    onRefresh: () => void;
    onDelete: () => void;
    hasSelection: boolean;
    navigate: any;
}

const ActionPanel = ({ onRefresh, onDelete, hasSelection, navigate }: ActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40 transition-all duration-300">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-purple-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem
                    icon={RefreshCw}
                    label="Actualiser"
                    variant="default"
                    onClick={onRefresh}
                />
                <ActionItem
                    icon={Eye}
                    label="Voir détails"
                    variant="default"
                    disabled={!hasSelection}
                />
            </ActionGroup>

            <ActionGroup>
                <ActionItem
                    icon={Trash2}
                    label="Supprimer"
                    variant="danger"
                    onClick={onDelete}
                    disabled={!hasSelection}
                />
            </ActionGroup>

            <div className="mt-auto pb-4">
                <ActionGroup>
                    <ActionItem icon={Settings} label="Paramètres" variant="default" />
                </ActionGroup>
            </div>
        </div>
    );
};

// Batch Detail View Component
const BatchDetailView = ({ batch, getStatusBadge, navigate, handleDelete, handleViewLogs, handleCancel, handleRetry, isRetrying }: any) => {
    const tabs: TabItem[] = [
        { id: 'data', label: 'Données', icon: FileText },
        { id: 'details', label: 'Détails', icon: Settings },
        { id: 'actions', label: 'Actions', icon: CheckCircle },
    ];

    const [activeTab, setActiveTab] = useState('data');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        general: true,
        statistics: true,
        status_dates: true,
        errors: true,
        actions: true,
    });

    const handleExpandAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    };

    const handleCollapseAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
    };

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {batch.batch_id}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {new Date(batch.created_at).toLocaleString('fr-FR')}
                            </span>
                            <span className="uppercase font-medium">{batch.operation_type}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {getStatusBadge(batch.status)}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
                <SageTabs 
                    tabs={tabs} 
                    activeTabId={activeTab} 
                    onTabChange={setActiveTab}
                    onExpandAll={handleExpandAll}
                    onCollapseAll={handleCollapseAll}
                />
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'data' && <DataTab batch={batch} openSections={openSections} toggleSection={toggleSection} />}
                {activeTab === 'details' && <DetailsTab batch={batch} getStatusBadge={getStatusBadge} openSections={openSections} toggleSection={toggleSection} />}
                {activeTab === 'actions' && <ActionsTab batch={batch} navigate={navigate} handleDelete={handleDelete} handleViewLogs={handleViewLogs} handleCancel={handleCancel} handleRetry={handleRetry} isRetrying={isRetrying} openSections={openSections} toggleSection={toggleSection} />}
            </div>
        </div>
    );
};

// Data Tab - Statistics and Summary
const DataTab = ({ batch, openSections, toggleSection }: { batch: BatchOperation; openSections: Record<string, boolean>; toggleSection: (section: string) => void }) => {
    return (
        <div className="space-y-3">
            <SageCollapsible
                title="Informations Générales"
                isOpen={openSections.general}
                onOpenChange={() => toggleSection('general')}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">ID Batch</p>
                        <p className="font-medium text-gray-900">{batch.batch_id}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Type d'opération</p>
                        <p className="font-medium text-gray-900 uppercase">{batch.operation_type}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Template</p>
                        <p className="font-medium text-gray-900">{batch.template?.name || `#${batch.template_id}`}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Fichier</p>
                        <p className="font-medium text-gray-900 truncate">{batch.filename}</p>
                    </div>
                </div>
            </SageCollapsible>

            <SageCollapsible
                title="Statistiques"
                isOpen={openSections.statistics}
                onOpenChange={() => toggleSection('statistics')}
            >
                <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg text-center">
                        <p className="text-xs text-gray-600">Total</p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">{batch.total_records}</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg text-center">
                        <p className="text-xs text-green-600">Réussis</p>
                        <p className="text-2xl font-bold text-green-700 mt-1">{batch.successful_records}</p>
                    </div>
                    <div className="p-4 bg-red-50 rounded-lg text-center">
                        <p className="text-xs text-red-600">Échoués</p>
                        <p className="text-2xl font-bold text-red-700 mt-1">{batch.failed_records}</p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg text-center">
                        <p className="text-xs text-yellow-600">Ignorés</p>
                        <p className="text-2xl font-bold text-yellow-700 mt-1">{batch.skipped_records}</p>
                    </div>
                </div>
            </SageCollapsible>
        </div>
    );
};

// Details Tab - Detailed Information
const DetailsTab = ({ batch, getStatusBadge, openSections, toggleSection }: any) => {
    return (
        <div className="space-y-3">
            <SageCollapsible
                title="Statut et Dates"
                isOpen={openSections.status_dates}
                onOpenChange={() => toggleSection('status_dates')}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-2">Statut</p>
                        {getStatusBadge(batch.status)}
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Taux de réussite</p>
                        <p className="font-medium text-gray-900">{batch.success_rate}%</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Date de création</p>
                        <p className="font-medium text-gray-900">
                            {new Date(batch.created_at).toLocaleString('fr-FR')}
                        </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600 mb-1">Dernière mise à jour</p>
                        <p className="font-medium text-gray-900">
                            {new Date(batch.updated_at).toLocaleString('fr-FR')}
                        </p>
                    </div>
                    {batch.started_at && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Démarré à</p>
                            <p className="font-medium text-gray-900">
                                {new Date(batch.started_at).toLocaleString('fr-FR')}
                            </p>
                        </div>
                    )}
                    {batch.completed_at && (
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-xs text-gray-600 mb-1">Terminé à</p>
                            <p className="font-medium text-gray-900">
                                {new Date(batch.completed_at).toLocaleString('fr-FR')}
                            </p>
                        </div>
                    )}
                    {batch.execution_time && (
                        <div className="p-4 bg-gray-50 rounded-lg col-span-2">
                            <p className="text-xs text-gray-600 mb-1">Temps d'exécution</p>
                            <p className="font-medium text-gray-900">{batch.execution_time} secondes</p>
                        </div>
                    )}
                </div>
            </SageCollapsible>

            {batch.error_summary && (
                <SageCollapsible
                    title="Résumé des Erreurs"
                    isOpen={openSections.errors}
                    onOpenChange={() => toggleSection('errors')}
                    className="border-red-200"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <p className="text-sm text-red-800">{batch.error_summary}</p>
                    </div>
                </SageCollapsible>
            )}
        </div>
    );
};

// Actions Tab - Available Actions
const ActionsTab = ({ batch, navigate, handleDelete, handleViewLogs, handleCancel, handleRetry, isRetrying, openSections, toggleSection }: any) => {
    return (
        <div className="space-y-3">
            <SageCollapsible
                title="Actions Disponibles"
                isOpen={openSections.actions}
                onOpenChange={() => toggleSection('actions')}
            >
                <div className="space-y-3">
                    {batch.operation_type === 'export' && batch.status === 'completed' && batch.download_url && (
                        <button className="w-full p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-left">
                            <div className="flex items-center gap-3">
                                <Download className="w-5 h-5 text-green-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Télécharger le Fichier</h4>
                                    <p className="text-sm text-gray-600">Télécharger le fichier exporté</p>
                                </div>
                            </div>
                        </button>
                    )}

                    <button 
                        onClick={() => navigate(`/import-export/${batch.operation_type}`)}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-left"
                    >
                        <div className="flex items-center gap-3">
                            <RefreshCw className="w-5 h-5 text-purple-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Relancer l'Opération</h4>
                                <p className="text-sm text-gray-600">Créer une nouvelle opération du même type</p>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleDelete(batch.batch_id)}
                        className="w-full p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition text-left"
                    >
                        <div className="flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-red-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Supprimer l'Opération</h4>
                                <p className="text-sm text-gray-600">Supprimer définitivement cet enregistrement</p>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => handleViewLogs(batch.batch_id)}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition text-left"
                    >
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-blue-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Voir les Logs</h4>
                                <p className="text-sm text-gray-600">Consulter les logs détaillés de l'opération</p>
                            </div>
                        </div>
                    </button>

                    {batch.status === 'processing' && (
                        <button 
                            onClick={() => handleCancel(batch.batch_id)}
                            className="w-full p-4 border-2 border-orange-200 rounded-lg hover:border-orange-500 hover:bg-orange-50 transition text-left"
                        >
                            <div className="flex items-center gap-3">
                                <XCircle className="w-5 h-5 text-orange-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Annuler l'Opération</h4>
                                    <p className="text-sm text-gray-600">Annuler l'opération en cours</p>
                                </div>
                            </div>
                        </button>
                    )}

                    {batch.status === 'failed' && (
                        <button 
                            onClick={() => handleRetry(batch.batch_id)}
                            disabled={isRetrying}
                            className="w-full p-4 border-2 border-blue-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="flex items-center gap-3">
                                {isRetrying ? (
                                    <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-5 h-5 text-blue-600" />
                                )}
                                <div>
                                    <h4 className="font-medium text-gray-900">Réessayer l'Opération</h4>
                                    <p className="text-sm text-gray-600">Créer une nouvelle tentative avec les mêmes données</p>
                                </div>
                            </div>
                        </button>
                    )}
                </div>
            </SageCollapsible>
        </div>
    );
};
