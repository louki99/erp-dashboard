import { useState, useMemo } from 'react';
import { 
    CreditCard, 
    Ban, 
    CheckCircle,
    Lock,
    Unlock,
    DollarSign,
    AlertTriangle
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { useAdvCredit } from '@/hooks/adv/useAdvCredit';
import { useUpdateCreditLimit, useBlockPartner, useUnblockPartner } from '@/hooks/adv/useAdvActions';
import type { Partner } from '@/types/adv.types';
import { cn } from '@/lib/utils';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

// --- Action Panel Component ---
interface CreditActionPanelProps {
    onUpdateLimit: () => void;
    onBlock: () => void;
    onUnblock: () => void;
    hasSelection: boolean;
    isBlocked: boolean;
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
    variant?: 'default' | 'danger' | 'primary' | 'sage';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
        danger: "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10",
        primary: "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10",
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

const CreditActionPanel = ({ onUpdateLimit, onBlock, onUnblock, hasSelection, isBlocked }: CreditActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem 
                    icon={DollarSign} 
                    label="Modifier Plafond" 
                    variant="primary" 
                    onClick={onUpdateLimit}
                    disabled={!hasSelection}
                />
                {isBlocked ? (
                    <ActionItem 
                        icon={Unlock} 
                        label="Débloquer Partenaire" 
                        variant="sage" 
                        onClick={onUnblock}
                        disabled={!hasSelection}
                    />
                ) : (
                    <ActionItem 
                        icon={Lock} 
                        label="Bloquer Partenaire" 
                        variant="danger" 
                        onClick={onBlock}
                        disabled={!hasSelection}
                    />
                )}
            </ActionGroup>
        </div>
    );
};

// --- Partner Credit Detail View Component ---
interface PartnerCreditDetailViewProps {
    partner: Partner;
}

const PartnerCreditDetailView = ({ partner }: PartnerCreditDetailViewProps) => {
    const creditLimit = Number(partner.credit_limit || 0);
    const creditUsed = Number(partner.credit_used || 0);
    const creditAvailable = Number(partner.credit_available || 0);
    const utilization = creditLimit > 0 ? (creditUsed / creditLimit) * 100 : 0;

    return (
        <div className="h-full flex flex-col bg-white dark:bg-gray-900">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{partner.name}</h2>
                        <p className="text-sm text-gray-500 mt-1">Code: {partner.code}</p>
                    </div>
                    <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                        partner.credit_hold ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                    )}>
                        {partner.credit_hold ? <Lock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                        {partner.credit_hold ? 'Bloqué' : 'Actif'}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                    {/* Credit Overview */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            Aperçu du Crédit
                        </h3>
                        
                        {/* Credit Limit Card */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 mb-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm text-blue-700 dark:text-blue-300">Plafond de Crédit</span>
                                <CreditCard className="w-5 h-5 text-blue-600" />
                            </div>
                            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                {creditLimit.toLocaleString('fr-FR')} Dh
                            </p>
                        </div>

                        {/* Credit Used/Available Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                                <span className="text-xs text-amber-700 dark:text-amber-300 block mb-1">Crédit Utilisé</span>
                                <p className="text-lg font-bold text-amber-900 dark:text-amber-100">
                                    {creditUsed.toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4">
                                <span className="text-xs text-emerald-700 dark:text-emerald-300 block mb-1">Disponible</span>
                                <p className="text-lg font-bold text-emerald-900 dark:text-emerald-100">
                                    {creditAvailable.toLocaleString('fr-FR')} Dh
                                </p>
                            </div>
                        </div>

                        {/* Utilization Bar */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Taux d'Utilisation</span>
                                <span className={cn(
                                    "text-sm font-bold",
                                    utilization > 90 ? "text-red-600" : utilization > 75 ? "text-amber-600" : "text-emerald-600"
                                )}>
                                    {utilization.toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-all",
                                        utilization > 90 ? "bg-red-500" : utilization > 75 ? "bg-amber-500" : "bg-emerald-500"
                                    )}
                                    style={{ width: `${Math.min(utilization, 100)}%` }}
                                />
                            </div>
                        </div>

                        {utilization > 90 && (
                            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                                <div className="text-sm text-red-700 dark:text-red-300">
                                    <p className="font-medium">Alerte: Crédit presque épuisé</p>
                                    <p className="text-xs mt-1">Le partenaire a utilisé plus de 90% de son plafond de crédit.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Partner Info */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Informations Partenaire</h3>
                        <div className="space-y-2">
                            <InfoRow label="Type" value={partner.partner_type || '-'} />
                            <InfoRow label="Canal" value={partner.channel || '-'} />
                            <InfoRow label="Ville" value={partner.city || '-'} />
                            <InfoRow label="ICE" value={partner.tax_number_ice || '-'} />
                        </div>
                    </div>

                    {/* Status Info */}
                    {partner.credit_hold && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <Ban className="w-4 h-4 text-red-600" />
                                <span className="font-medium text-red-900 dark:text-red-100">Partenaire Bloqué</span>
                            </div>
                            <p className="text-sm text-red-700 dark:text-red-300">
                                Ce partenaire ne peut pas passer de nouvelles commandes.
                            </p>
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
const AdvCreditContent = () => {
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showBlockModal, setShowBlockModal] = useState(false);
    const [blockReason, setBlockReason] = useState('');
    const [newCreditLimit, setNewCreditLimit] = useState('');
    const [updateNotes, setUpdateNotes] = useState('');

    // Data fetching
    const { partners, loading, refetch } = useAdvCredit();

    // Action hooks
    const updateCreditLimit = useUpdateCreditLimit({
        onSuccess: () => {
            setShowUpdateModal(false);
            setSelectedPartnerId(null);
            setNewCreditLimit('');
            setUpdateNotes('');
            refetch();
        },
    });

    const blockPartner = useBlockPartner({
        onSuccess: () => {
            setShowBlockModal(false);
            setSelectedPartnerId(null);
            setBlockReason('');
            refetch();
        },
    });

    const unblockPartner = useUnblockPartner({
        onSuccess: () => {
            refetch();
        },
    });

    // Column definitions
    const columnDefs: ColDef[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 120,
            pinned: 'left',
            cellClass: 'font-mono font-bold text-blue-600',
        },
        {
            field: 'name',
            headerName: 'Partenaire',
            flex: 1,
            minWidth: 200,
            cellClass: 'font-medium',
        },
        {
            field: 'credit_limit',
            headerName: 'Plafond',
            width: 130,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'font-bold',
        },
        {
            field: 'credit_used',
            headerName: 'Utilisé',
            width: 130,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'text-amber-600',
        },
        {
            field: 'credit_available',
            headerName: 'Disponible',
            width: 130,
            valueFormatter: (params) => `${Number(params.value || 0).toLocaleString('fr-FR')} Dh`,
            cellClass: 'text-emerald-600 font-bold',
        },
        {
            headerName: 'Utilisation',
            width: 120,
            valueGetter: (params: any) => {
                const limit = Number(params.data.credit_limit || 0);
                const used = Number(params.data.credit_used || 0);
                return limit > 0 ? (used / limit) * 100 : 0;
            },
            valueFormatter: (params) => `${params.value.toFixed(1)}%`,
            cellClass: (params: any) => {
                const utilization = params.value;
                return utilization > 90 ? 'font-bold text-red-600' : utilization > 75 ? 'font-bold text-amber-600' : 'font-bold text-emerald-600';
            },
        },
        {
            headerName: 'Statut',
            field: 'credit_hold',
            width: 100,
            cellRenderer: (params: any) => {
                const span = document.createElement('span');
                span.className = params.value
                    ? 'px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700'
                    : 'px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700';
                span.textContent = params.value ? 'Bloqué' : 'Actif';
                return span;
            },
        },
    ], []);

    const handleUpdateLimit = () => {
        if (!selectedPartnerId) return;
        
        const limitValue = parseFloat(newCreditLimit);
        if (!newCreditLimit || isNaN(limitValue) || limitValue < 0) {
            return;
        }

        updateCreditLimit.mutate({
            partnerId: selectedPartnerId,
            data: {
                new_credit_limit: limitValue,
                justification: updateNotes.trim() || 'Mise à jour du plafond de crédit',
            },
        });
    };

    const handleBlock = () => {
        if (!selectedPartnerId || !blockReason.trim()) return;

        blockPartner.mutate({
            partnerId: selectedPartnerId,
            data: { block_reason: blockReason },
        });
    };

    const handleUnblock = () => {
        if (!selectedPartnerId) return;
        unblockPartner.mutate(selectedPartnerId);
    };

    const partnersList = partners?.data || [];
    const selectedPartner = partnersList.find(p => p.id === selectedPartnerId);

    // Left Sidebar: Partner List
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900 dark:text-white">Gestion Crédit</h2>
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {partnersList.length} partenaires
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={partnersList}
                    columnDefs={columnDefs}
                    loading={loading}
                    onRowSelected={(data) => {
                        setSelectedPartnerId(data.id);
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
                        {selectedPartner ? (
                            <PartnerCreditDetailView partner={selectedPartner} />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sélectionnez un partenaire
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <CreditActionPanel
                        onUpdateLimit={() => setShowUpdateModal(true)}
                        onBlock={() => setShowBlockModal(true)}
                        onUnblock={handleUnblock}
                        hasSelection={!!selectedPartnerId}
                        isBlocked={selectedPartner?.credit_hold || false}
                    />
                }
            />

            {/* Update Credit Limit Modal */}
            <ConfirmationModal
                isOpen={showUpdateModal}
                onClose={() => setShowUpdateModal(false)}
                onConfirm={handleUpdateLimit}
                title="Modifier le Plafond de Crédit"
                description={`Modifier le plafond de crédit pour ${selectedPartner?.name} (${selectedPartner?.code})`}
                variant="info"
                confirmText="Mettre à jour"
                isLoading={updateCreditLimit.isLoading}
            >
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Plafond Actuel
                        </label>
                        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white font-bold">
                            {selectedPartner?.credit_limit ? Number(selectedPartner.credit_limit).toLocaleString('fr-FR') : '0'} Dh
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nouveau Plafond (Dh) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={newCreditLimit}
                            onChange={(e) => setNewCreditLimit(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            placeholder="Ex: 100000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notes (Optionnel)
                        </label>
                        <textarea
                            value={updateNotes}
                            onChange={(e) => setUpdateNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                            placeholder="Raison de la modification..."
                            maxLength={500}
                        />
                    </div>
                </div>
            </ConfirmationModal>

            {/* Block Partner Confirmation */}
            <ConfirmationModal
                isOpen={showBlockModal}
                onClose={() => {
                    setShowBlockModal(false);
                    setSelectedPartnerId(null);
                    setBlockReason('');
                }}
                onConfirm={handleBlock}
                title="Bloquer le Partenaire"
                description={`Êtes-vous sûr de vouloir bloquer le partenaire ${selectedPartner?.name} (${selectedPartner?.code}) ?`}
                confirmText="Bloquer"
                variant="danger"
                isLoading={blockPartner.isLoading}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Motif du blocage <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                        placeholder="Exemple: Paiements en retard dépassant 90 jours..."
                        maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{blockReason.length}/500 caractères</p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export const AdvCreditPage = () => {
    return <AdvCreditContent />;
};
