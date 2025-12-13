import { useState, useMemo } from 'react';
import { ShieldAlert, CheckCircle, XCircle, AlertTriangle, FileText, User, Calendar } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { useAdvDerogations } from '@/hooks/adv/useAdvDerogations';
import { useApproveDerogation, useRejectDerogation } from '@/hooks/adv/useAdvActions';
import type { CreditDerogation, DerogationStatus } from '@/types/adv.types';
import { cn } from '@/lib/utils';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/lib/rbac/permissions';
import { Can } from '@/components/rbac';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

// --- Action Panel Component ---
interface DerogationActionPanelProps {
    onApprove: () => void;
    onReject: () => void;
    hasSelection: boolean;
    isPending: boolean;
}

const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger' | 'sage';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
        danger: "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10",
        sage: "text-sage-500 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-200 hover:bg-sage-50 dark:hover:bg-sage-900/20"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto",
                disabled ? "opacity-30 cursor-not-allowed" : variants[variant]
            )}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900"></span>
            </span>
        </button>
    );
};

const DerogationActionPanel = ({ onApprove, onReject, hasSelection, isPending }: DerogationActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem 
                    icon={CheckCircle} 
                    label="Approuver" 
                    variant="sage" 
                    onClick={onApprove}
                    disabled={!hasSelection || !isPending}
                />
                <ActionItem 
                    icon={XCircle} 
                    label="Rejeter" 
                    variant="danger" 
                    onClick={onReject}
                    disabled={!hasSelection || !isPending}
                />
            </ActionGroup>
        </div>
    );
};

// --- Derogation Detail View Component ---
interface DerogationDetailViewProps {
    derogation: CreditDerogation;
}

const DerogationDetailView = ({ derogation }: DerogationDetailViewProps) => {
    const statusConfig = {
        pending: { label: 'En Attente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: ShieldAlert },
        approved: { label: 'Approuvé', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle },
        rejected: { label: 'Rejeté', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
    };

    const config = statusConfig[derogation.status as keyof typeof statusConfig] || statusConfig.pending;
    const StatusIcon = config.icon;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Dérogation #{derogation.id}</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            BC: {derogation.order?.order_number || '-'}
                        </p>
                    </div>
                    <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 border",
                        config.color
                    )}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                    {/* Credit Overview */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Analyse de Crédit
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Plafond Partenaire</span>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {Number(derogation.partner_credit_limit || 0).toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Crédit Utilisé</span>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">
                                    {Number(derogation.partner_credit_used || 0).toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                                <span className="text-xs text-blue-700 dark:text-blue-300 block mb-1">Montant BC</span>
                                <p className="text-lg font-bold text-blue-900 dark:text-blue-100">
                                    {Number(derogation.order_amount || 0).toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
                                <span className="text-xs text-red-700 dark:text-red-300 block mb-1">Dépassement</span>
                                <p className="text-lg font-bold text-red-900 dark:text-red-100">
                                    {Number(derogation.excess_amount || 0).toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Partner Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Partenaire</h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <p className="font-medium text-gray-900 dark:text-white">
                                {derogation.partner?.name || derogation.order?.partner?.name || '-'}
                            </p>
                        </div>
                    </div>

                    {/* Justification */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Justification
                        </h3>
                        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                {derogation.justification}
                            </p>
                        </div>
                    </div>

                    {/* Request Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Demandé par
                        </h3>
                        <div className="space-y-2">
                            <InfoRow label="Nom" value={derogation.requestedBy?.name || '-'} />
                            <InfoRow 
                                label="Date" 
                                value={new Date(derogation.created_at).toLocaleString('fr-FR')} 
                            />
                        </div>
                    </div>

                    {/* Review Info */}
                    {derogation.reviewed_at && (
                        <div className={cn(
                            "p-4 rounded-lg border",
                            derogation.status === 'approved' 
                                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                                : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                        )}>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                Décision
                            </h3>
                            <div className="space-y-2 text-sm">
                                <InfoRow label="Révisé par" value={derogation.reviewedBy?.name || '-'} />
                                <InfoRow 
                                    label="Date" 
                                    value={new Date(derogation.reviewed_at).toLocaleString('fr-FR')} 
                                />
                                {derogation.review_comment && (
                                    <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                                        <span className="text-gray-500 dark:text-gray-400 text-xs">Commentaire:</span>
                                        <p className="mt-1 text-gray-700 dark:text-gray-300">{derogation.review_comment}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper component
const InfoRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-sm font-medium text-gray-900 dark:text-white">{value}</span>
    </div>
);

// --- Main Component ---
const AdvDerogationsContent = () => {
    const [statusFilter, setStatusFilter] = useState<DerogationStatus>('pending');
    const [selectedDerogationId, setSelectedDerogationId] = useState<number | null>(null);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [approvalComment, setApprovalComment] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    // Data fetching
    const { derogations, stats, loading, refetch } = useAdvDerogations({ status: statusFilter });

    // Action hooks
    const approveDerogation = useApproveDerogation({
        onSuccess: () => {
            setShowApproveModal(false);
            setSelectedDerogationId(null);
            setApprovalComment('');
            refetch();
        },
    });

    const rejectDerogation = useRejectDerogation({
        onSuccess: () => {
            setShowRejectModal(false);
            setSelectedDerogationId(null);
            setRejectionReason('');
            refetch();
        },
    });

    // Column definitions
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'id',
            headerName: 'ID',
            width: 80,
            cellClass: 'font-mono text-xs text-gray-500',
            valueFormatter: (params) => `#${params.value}`,
        },
        {
            headerName: 'N° BC',
            width: 130,
            valueGetter: (params) => params.data?.order?.order_number || '-',
            cellClass: 'font-mono font-bold text-blue-600',
        },
        {
            headerName: 'Partenaire',
            width: 200,
            valueGetter: (params) => params.data?.partner?.name || params.data?.order?.partner?.name || '-',
            cellClass: 'font-medium',
        },
        {
            headerName: 'Plafond',
            field: 'partner_credit_limit',
            width: 120,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'text-gray-600',
        },
        {
            headerName: 'Montant BC',
            field: 'order_amount',
            width: 130,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'font-bold',
        },
        {
            headerName: 'Dépassement',
            field: 'excess_amount',
            width: 130,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'font-bold text-red-600',
        },
        {
            headerName: 'Justification',
            field: 'justification',
            flex: 1,
            minWidth: 200,
            cellClass: 'text-sm truncate',
        },
        {
            headerName: 'Demandeur',
            width: 140,
            valueGetter: (params) => params.data?.requestedBy?.name || '-',
            cellClass: 'text-sm',
        },
        {
            headerName: 'Date',
            field: 'created_at',
            width: 110,
            valueFormatter: (params) =>
                params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-',
            cellClass: 'text-sm',
        },
        {
            headerName: 'Statut',
            field: 'status',
            width: 110,
            cellRenderer: (params: any) => {
                const statusConfig: Record<string, { label: string; class: string }> = {
                    pending: { label: 'En Attente', class: 'bg-amber-100 text-amber-700' },
                    approved: { label: 'Approuvé', class: 'bg-emerald-100 text-emerald-700' },
                    rejected: { label: 'Rejeté', class: 'bg-red-100 text-red-700' },
                };
                const config = statusConfig[params.value] || statusConfig.pending;
                const span = document.createElement('span');
                span.className = `px-2 py-0.5 rounded text-xs font-medium ${config.class}`;
                span.textContent = config.label;
                return span;
            },
        },
    ], []);

    const handleApprove = () => {
        if (!selectedDerogationId) return;
        approveDerogation.mutate({
            derogationId: selectedDerogationId,
            data: approvalComment.trim() ? { comment: approvalComment } : undefined,
        });
    };

    const handleReject = () => {
        if (!selectedDerogationId || !rejectionReason.trim()) return;
        rejectDerogation.mutate({
            derogationId: selectedDerogationId,
            data: { reason: rejectionReason },
        });
    };

    const derogationsList = derogations?.data || [];
    const selectedDerogation = derogationsList.find(d => d.id === selectedDerogationId);
    const isPending = selectedDerogation?.status === 'pending';

    // Left Sidebar: Derogation List with filter tabs
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50">
                <h2 className="font-bold text-gray-900 dark:text-white mb-3">Dérogations</h2>
                
                {/* Status Filter Tabs */}
                <div className="flex gap-2 mb-3">
                    {[
                        { id: 'pending' as const, label: 'En Attente', count: stats?.pending || 0 },
                        { id: 'approved' as const, label: 'Approuvées' },
                        { id: 'rejected' as const, label: 'Rejetées' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => {
                                setStatusFilter(tab.id);
                                setSelectedDerogationId(null);
                            }}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                                statusFilter === tab.id
                                    ? 'bg-sage-600 text-white shadow-sm'
                                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && statusFilter === tab.id && (
                                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded-full text-[10px]">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium inline-block">
                    {derogationsList.length} dérogation{derogationsList.length > 1 ? 's' : ''}
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={derogationsList}
                    columnDefs={columnDefs}
                    loading={loading}
                    onRowSelected={(data) => {
                        setSelectedDerogationId(data.id);
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
                        {selectedDerogation ? (
                            <DerogationDetailView derogation={selectedDerogation} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sélectionnez une dérogation
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <DerogationActionPanel
                        onApprove={() => setShowApproveModal(true)}
                        onReject={() => setShowRejectModal(true)}
                        hasSelection={!!selectedDerogationId}
                        isPending={isPending || false}
                    />
                }
            />

            {/* Approve Modal */}
            <ConfirmationModal
                isOpen={showApproveModal}
                onClose={() => {
                    setShowApproveModal(false);
                    setApprovalComment('');
                }}
                onConfirm={handleApprove}
                title="Approuver la Dérogation"
                description={`Approuver la dérogation #{selectedDerogation?.id} et valider automatiquement le BC ?`}
                confirmText="Approuver"
                variant="sage"
                isLoading={approveDerogation.isLoading}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Commentaire (optionnel)
                    </label>
                    <textarea
                        value={approvalComment}
                        onChange={(e) => setApprovalComment(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                        placeholder="Commentaire d'approbation..."
                        maxLength={500}
                    />
                </div>
            </ConfirmationModal>

            {/* Reject Modal */}
            <ConfirmationModal
                isOpen={showRejectModal}
                onClose={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                }}
                onConfirm={handleReject}
                title="Rejeter la Dérogation"
                description={`Rejeter la dérogation #{selectedDerogation?.id} et rejeter automatiquement le BC ?`}
                confirmText="Rejeter"
                variant="danger"
                isLoading={rejectDerogation.isLoading}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Motif du Rejet <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                        placeholder="Exemple: Risque crédit trop élevé, historique de paiements insuffisant..."
                        maxLength={500}
                        required
                    />
                    <p className="text-xs text-gray-500 mt-1">{rejectionReason.length}/500 caractères</p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export const AdvDerogationsPage = () => {
    return <AdvDerogationsContent />;
};
