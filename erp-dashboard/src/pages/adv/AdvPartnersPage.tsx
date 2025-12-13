import { useState, useMemo } from 'react';
import { 
    Loader2, 
    CheckCircle, 
    XCircle, 
    Building,
    MapPin,
    Mail,
    Phone,
    CreditCard,
    FileText,
    TrendingUp,
    History
} from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { useAdvPartners, useAdvPartnerDetail } from '@/hooks/adv/useAdvPartners';
import { useValidatePartner, useRejectPartner } from '@/hooks/adv/useAdvActions';
import type { Partner, PaymentTerm } from '@/types/adv.types';
import { cn } from '@/lib/utils';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

// Mock payment terms - replace with actual API call
const PAYMENT_TERMS: PaymentTerm[] = [
    { id: 1, name: 'Net 15', code: 'NET15', days_number: 15 },
    { id: 2, name: 'Net 30', code: 'NET30', days_number: 30 },
    { id: 3, name: 'Net 45', code: 'NET45', days_number: 45 },
    { id: 4, name: 'Net 60', code: 'NET60', days_number: 60 },
];

// --- Action Panel Component ---
interface PartnerActionPanelProps {
    onValidate: () => void;
    onReject: () => void;
    hasSelection: boolean;
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

const PartnerActionPanel = ({ onValidate, onReject, hasSelection }: PartnerActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem 
                    icon={CheckCircle} 
                    label="Valider Partenaire" 
                    variant="sage" 
                    onClick={onValidate}
                    disabled={!hasSelection}
                />
                <ActionItem 
                    icon={XCircle} 
                    label="Rejeter Partenaire" 
                    variant="danger" 
                    onClick={onReject}
                    disabled={!hasSelection}
                />
            </ActionGroup>
        </div>
    );
};

// --- Partner Detail View Component ---
interface PartnerDetailViewProps {
    partner: Partner;
    creditHistory?: any[];
    paymentHistory?: any[];
}

const PartnerDetailView = ({ partner, creditHistory = [], paymentHistory = [] }: PartnerDetailViewProps) => {
    const [activeTab, setActiveTab] = useState<'info' | 'credit' | 'payment'>('info');

    const tabs: TabItem[] = [
        { id: 'info', label: 'Informations', icon: FileText },
        { id: 'credit', label: `Historique Crédit (${creditHistory.length})`, icon: CreditCard },
        { id: 'payment', label: `Historique Paiements (${paymentHistory.length})`, icon: TrendingUp },
    ];

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
                        "px-3 py-1 rounded-full text-xs font-medium",
                        partner.status === 'PENDING' && "bg-amber-100 text-amber-700",
                        partner.status === 'ACTIVE' && "bg-emerald-100 text-emerald-700",
                        partner.status === 'BLOCKED' && "bg-red-100 text-red-700"
                    )}>
                        {partner.status}
                    </span>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-800">
                <SageTabs
                    tabs={tabs}
                    activeTabId={activeTab}
                    onTabChange={(id) => setActiveTab(id as any)}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'info' && (
                    <div className="space-y-6">
                        {/* General Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Building className="w-4 h-4" />
                                Informations Générales
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem label="Type" value={partner.partner_type || '-'} />
                                <InfoItem label="Canal" value={partner.channel || '-'} />
                                <InfoItem label="ICE" value={partner.tax_number_ice || '-'} />
                                <InfoItem label="Ville" value={partner.city || '-'} />
                                <InfoItem 
                                    label="Zone Géo" 
                                    value={partner.geoArea?.name || '-'} 
                                />
                                <InfoItem 
                                    label="Date Création" 
                                    value={partner.created_at ? new Date(partner.created_at).toLocaleDateString('fr-FR') : '-'} 
                                />
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                Coordonnées
                            </h3>
                            <div className="space-y-2">
                                <InfoItem label="Email" value={partner.email || '-'} icon={Mail} />
                                <InfoItem label="Téléphone" value={partner.phone || '-'} icon={Phone} />
                            </div>
                        </div>

                        {/* Credit Info */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                Informations Crédit
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <InfoItem 
                                    label="Plafond Crédit" 
                                    value={partner.credit_limit ? `${Number(partner.credit_limit).toLocaleString('fr-FR')} Dh` : '-'} 
                                />
                                <InfoItem 
                                    label="Crédit Utilisé" 
                                    value={partner.credit_used ? `${Number(partner.credit_used).toLocaleString('fr-FR')} Dh` : '-'} 
                                />
                                <InfoItem 
                                    label="Crédit Disponible" 
                                    value={partner.credit_available ? `${Number(partner.credit_available).toLocaleString('fr-FR')} Dh` : '-'} 
                                />
                                <InfoItem 
                                    label="Statut Crédit" 
                                    value={partner.credit_hold ? 'Bloqué' : 'Actif'} 
                                />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'credit' && (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <History className="w-4 h-4" />
                            Historique des Modifications de Crédit
                        </h3>
                        {creditHistory.length > 0 ? (
                            <div className="space-y-2">
                                {creditHistory.map((item: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">{item.action}</p>
                                                <p className="text-gray-500 text-xs mt-1">{item.notes}</p>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {new Date(item.created_at).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Aucun historique disponible</p>
                        )}
                    </div>
                )}

                {activeTab === 'payment' && (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Historique des Paiements
                        </h3>
                        {paymentHistory.length > 0 ? (
                            <div className="space-y-2">
                                {paymentHistory.map((item: any, idx: number) => (
                                    <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-medium text-gray-900 dark:text-white">
                                                    {parseFloat(item.amount).toLocaleString()} Dh
                                                </p>
                                                <p className="text-gray-500 text-xs mt-1">{item.payment_method}</p>
                                            </div>
                                            <span className="text-xs text-gray-400">
                                                {new Date(item.payment_date).toLocaleDateString('fr-FR')}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-400 text-sm">Aucun historique disponible</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Helper component for displaying info items
const InfoItem = ({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) => (
    <div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1">
            {Icon && <Icon className="w-3 h-3" />}
            {label}
        </p>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{value}</p>
    </div>
);

// --- Main Component ---
const AdvPartnersContent = () => {
    const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
    const [showValidateModal, setShowValidateModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);

    // Validation form state
    const [creditLimit, setCreditLimit] = useState('');
    const [paymentTermId, setPaymentTermId] = useState('');
    const [notes, setNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');

    // Data fetching hooks
    const { partners, loading, refetch } = useAdvPartners();
    const { partner: partnerDetail, creditHistory, paymentHistory, loading: detailLoading } =
        useAdvPartnerDetail(selectedPartnerId);

    // Action hooks
    const validatePartner = useValidatePartner({
        onSuccess: () => {
            setShowValidateModal(false);
            setSelectedPartnerId(null);
            setCreditLimit('');
            setPaymentTermId('');
            setNotes('');
            refetch();
        },
    });

    const rejectPartner = useRejectPartner({
        onSuccess: () => {
            setShowRejectModal(false);
            setSelectedPartnerId(null);
            setRejectionReason('');
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
            headerName: 'Raison Sociale',
            flex: 1,
            minWidth: 200,
            cellClass: 'font-medium',
        },
        {
            field: 'partner_type',
            headerName: 'Type',
            width: 100,
        },
        {
            field: 'city',
            headerName: 'Ville',
            width: 130,
            valueFormatter: (params) => params.value || '-',
        },
        {
            field: 'created_at',
            headerName: 'Date Création',
            width: 140,
            valueFormatter: (params) =>
                params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-',
        },
        {
            field: 'status',
            headerName: 'Statut',
            width: 120,
            cellRenderer: (params: any) => {
                const statusColors: Record<string, string> = {
                    PENDING: 'bg-amber-100 text-amber-700',
                    ACTIVE: 'bg-emerald-100 text-emerald-700',
                    BLOCKED: 'bg-red-100 text-red-700',
                };
                const colorClass = statusColors[params.value] || statusColors.PENDING;
                return `<span class="px-2 py-0.5 rounded text-xs font-medium ${colorClass}">${params.value}</span>`;
            },
        },
    ], []);

    const handleValidate = () => {
        if (!selectedPartnerId) return;
        
        const limitValue = parseFloat(creditLimit);
        const termId = parseInt(paymentTermId);

        if (!creditLimit || isNaN(limitValue) || limitValue < 0) {
            return;
        }
        if (!paymentTermId) {
            return;
        }

        validatePartner.mutate({
            partnerId: selectedPartnerId,
            data: {
                credit_limit: limitValue,
                payment_term_id: termId,
                notes: notes.trim() || undefined,
            },
        });
    };

    const handleReject = () => {
        if (!selectedPartnerId || !rejectionReason.trim()) return;

        rejectPartner.mutate({
            partnerId: selectedPartnerId,
            data: { rejection_reason: rejectionReason },
        });
    };

    const partnersList = partners?.data || [];
    const selectedPartner = partnerDetail || partnersList.find(p => p.id === selectedPartnerId);

    // Left Sidebar: Partner List
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 w-full">
            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900 dark:text-white">Partenaires</h2>
                <div className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                    {partnersList.length} en attente
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
                        {detailLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-sage-500" />
                                <p>Chargement du détail...</p>
                            </div>
                        ) : selectedPartner ? (
                            <PartnerDetailView 
                                partner={selectedPartner} 
                                creditHistory={creditHistory}
                                paymentHistory={paymentHistory}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                Sélectionnez un partenaire
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <PartnerActionPanel
                        onValidate={() => setShowValidateModal(true)}
                        onReject={() => setShowRejectModal(true)}
                        hasSelection={!!selectedPartnerId}
                    />
                }
            />

            {/* Validate Modal */}
            <ConfirmationModal
                isOpen={showValidateModal}
                onClose={() => setShowValidateModal(false)}
                onConfirm={handleValidate}
                title="Valider le Partenaire"
                description={`Confirmer la validation du partenaire ${selectedPartner?.name} (${selectedPartner?.code})`}
                variant="sage"
                confirmText="Valider"
                isLoading={validatePartner.isLoading}
            >
                <div className="space-y-4 mt-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Plafond de Crédit (Dh) <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            value={creditLimit}
                            onChange={(e) => setCreditLimit(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                            placeholder="Ex: 50000"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Conditions de Paiement <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={paymentTermId}
                            onChange={(e) => setPaymentTermId(e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700"
                        >
                            <option value="">Sélectionner...</option>
                            {PAYMENT_TERMS.map(term => (
                                <option key={term.id} value={term.id}>
                                    {term.name} ({term.days_number} jours)
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notes (Optionnel)
                        </label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                            placeholder="Commentaires additionnels..."
                            maxLength={500}
                        />
                    </div>
                </div>
            </ConfirmationModal>

            {/* Reject Modal */}
            <ConfirmationModal
                isOpen={showRejectModal}
                onClose={() => setShowRejectModal(false)}
                onConfirm={handleReject}
                title="Rejeter le Partenaire"
                description={`Êtes-vous sûr de vouloir rejeter le partenaire ${selectedPartner?.name} (${selectedPartner?.code}) ?`}
                variant="danger"
                confirmText="Rejeter"
                isLoading={rejectPartner.isLoading}
            >
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Motif du rejet <span className="text-red-500">*</span>
                    </label>
                    <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none text-sm"
                        placeholder="Exemple: Documents incomplets, informations incorrectes..."
                        maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">{rejectionReason.length}/500 caractères</p>
                </div>
            </ConfirmationModal>
        </>
    );
};

export const AdvPartnersPage = () => {
    return <AdvPartnersContent />;
};
