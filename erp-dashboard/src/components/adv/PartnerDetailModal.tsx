import { useState } from 'react';
import {
    User,
    Building,
    FileText,
    MapPin,
    Mail,
    Phone,
    CreditCard,
    Calendar,
    CheckCircle,
    XCircle,
    Loader2,
    History,
    TrendingUp,
} from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import type {
    Partner,
    CreditHistory,
    PaymentHistory,
    PaymentTerm,
} from '@/types/adv.types';
import { cn } from '@/lib/utils';

interface PartnerDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    partner: Partner | null;
    creditHistory?: CreditHistory[];
    paymentHistory?: PaymentHistory[];
    onValidate?: (data: { credit_limit: number; payment_term_id: number; notes?: string }) => void;
    onReject?: (reason: string) => void;
    paymentTerms?: PaymentTerm[];
    isLoading?: boolean;
    mode?: 'view' | 'validate';
}

/**
 * Partner Detail Modal Component
 * Displays complete partner information with tabs for credit and payment history
 * Supports validation and rejection workflows
 */
export const PartnerDetailModal = ({
    isOpen,
    onClose,
    partner,
    creditHistory = [],
    paymentHistory = [],
    onValidate,
    onReject,
    paymentTerms = [],
    isLoading = false,
    mode = 'view',
}: PartnerDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<'info' | 'credit' | 'payment'>('info');
    const [showValidateForm, setShowValidateForm] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);

    // Validation form state
    const [creditLimit, setCreditLimit] = useState('');
    const [paymentTermId, setPaymentTermId] = useState('');
    const [notes, setNotes] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    const handleValidateSubmit = () => {
        const newErrors: Record<string, string> = {};
        const limitValue = parseFloat(creditLimit);

        if (!creditLimit || isNaN(limitValue) || limitValue < 0) {
            newErrors.creditLimit = 'Plafond de crédit invalide';
        }
        if (!paymentTermId) {
            newErrors.paymentTermId = 'Conditions de paiement requises';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onValidate?.({
            credit_limit: limitValue,
            payment_term_id: parseInt(paymentTermId),
            notes: notes.trim() || undefined,
        });
    };

    const handleRejectSubmit = () => {
        if (!rejectionReason.trim()) {
            setErrors({ rejectionReason: 'Motif de rejet requis' });
            return;
        }
        if (rejectionReason.length > 500) {
            setErrors({ rejectionReason: 'Le motif ne peut pas dépasser 500 caractères' });
            return;
        }

        onReject?.(rejectionReason);
    };

    const resetForms = () => {
        setCreditLimit('');
        setPaymentTermId('');
        setNotes('');
        setRejectionReason('');
        setErrors({});
        setShowValidateForm(false);
        setShowRejectForm(false);
    };

    const handleClose = () => {
        resetForms();
        setActiveTab('info');
        onClose();
    };

    if (!isOpen || !partner) return null;

    const creditHistoryColumns: ColDef[] = [
        {
            headerName: 'Date',
            field: 'created_at',
            width: 150,
            valueFormatter: (params) => new Date(params.value).toLocaleDateString('fr-FR'),
        },
        {
            headerName: 'Ancien Plafond',
            field: 'old_limit',
            width: 140,
            valueFormatter: (params) => `${parseFloat(params.value).toLocaleString()} Dh`,
            cellClass: 'text-gray-500',
        },
        {
            headerName: 'Nouveau Plafond',
            field: 'new_limit',
            width: 150,
            valueFormatter: (params) => `${parseFloat(params.value).toLocaleString()} Dh`,
            cellClass: 'font-bold text-emerald-600',
        },
        {
            headerName: 'Justification',
            field: 'justification',
            flex: 1,
            minWidth: 200,
        },
    ];

    const paymentHistoryColumns: ColDef[] = [
        {
            headerName: 'Date',
            field: 'created_at',
            width: 150,
            valueFormatter: (params) => new Date(params.value).toLocaleDateString('fr-FR'),
        },
        {
            headerName: 'N° BC',
            field: 'order_number',
            width: 140,
        },
        {
            headerName: 'Montant',
            field: 'total_amount',
            width: 130,
            valueFormatter: (params) => `${parseFloat(params.value).toLocaleString()} Dh`,
            cellClass: 'font-bold',
        },
        {
            headerName: 'Statut',
            field: 'bc_status',
            width: 120,
            cellRenderer: (params: any) => {
                const statusColors: Record<string, string> = {
                    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
                    cancelled: 'bg-red-100 text-red-700 border-red-200',
                };
                const colorClass = statusColors[params.value] || 'bg-gray-100 text-gray-700 border-gray-200';
                return (
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
                        {params.value}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700 flex flex-col animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 shrink-0">
                    <div className="flex items-start justify-between text-white">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                                <Building className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{partner.name}</h2>
                                <p className="text-blue-100 mt-1 font-mono text-sm">{partner.code}</p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                            disabled={isLoading}
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0">
                    <div className="flex gap-1 px-6">
                        {[
                            { id: 'info' as const, label: 'Informations', icon: User },
                            { id: 'credit' as const, label: 'Historique Crédit', icon: TrendingUp },
                            { id: 'payment' as const, label: 'Historique Paiements', icon: History },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                                    activeTab === tab.id
                                        ? 'border-blue-600 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-800'
                                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Info Tab */}
                    {activeTab === 'info' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Contact Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide pb-2 border-b">
                                        Contact
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <Mail className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm">{partner.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm">{partner.phone}</span>
                                        </div>
                                        {partner.whatsapp && (
                                            <div className="flex items-center gap-3">
                                                <Phone className="w-4 h-4 text-emerald-500" />
                                                <span className="text-sm">{partner.whatsapp}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Business Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide pb-2 border-b">
                                        Informations Commerciales
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">Type</div>
                                                <div className="font-medium">{partner.partner_type}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Building className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">Canal</div>
                                                <div className="font-medium">{partner.channel}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">Ville</div>
                                                <div className="font-medium">{partner.city || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tax Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide pb-2 border-b">
                                        Fiscalité
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">ICE</div>
                                                <div className="font-mono font-medium">{partner.tax_number_ice || '-'}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">IF</div>
                                                <div className="font-mono font-medium">{partner.tax_number_if || '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Credit Info */}
                                <div className="space-y-4">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide pb-2 border-b">
                                        Crédit
                                    </h3>
                                    <div className="space-y-3">
                                        <div className="flex items-start gap-3">
                                            <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">Plafond</div>
                                                <div className="font-bold text-lg">{parseFloat(String(partner.credit_limit || 0)).toLocaleString()} Dh</div>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                                            <div className="text-sm">
                                                <div className="text-gray-500">Créé le</div>
                                                <div className="font-medium">{new Date(partner.created_at).toLocaleDateString('fr-FR')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Credit History Tab */}
                    {activeTab === 'credit' && (
                        <div className="h-96 ag-theme-alpine dark:ag-theme-alpine-dark">
                            {creditHistory.length > 0 ? (
                                <AgGridReact
                                    rowData={creditHistory}
                                    columnDefs={creditHistoryColumns}
                                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                                    pagination={true}
                                    paginationPageSize={10}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <div className="text-center">
                                        <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>Aucun historique de crédit</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Payment History Tab */}
                    {activeTab === 'payment' && (
                        <div className="h-96 ag-theme-alpine dark:ag-theme-alpine-dark">
                            {paymentHistory.length > 0 ? (
                                <AgGridReact
                                    rowData={paymentHistory}
                                    columnDefs={paymentHistoryColumns}
                                    defaultColDef={{ sortable: true, filter: true, resizable: true }}
                                    pagination={true}
                                    paginationPageSize={10}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <div className="text-center">
                                        <History className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                        <p>Aucun historique de paiement</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Validation Form */}
                    {showValidateForm && mode === 'validate' && (
                        <div className="mt-6 p-6 border-2 border-emerald-200 dark:border-emerald-800 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                            <h3 className="text-lg font-bold text-emerald-900 dark:text-emerald-100 mb-4">
                                Validation du Partenaire
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Plafond de Crédit <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={creditLimit}
                                        onChange={(e) => {
                                            setCreditLimit(e.target.value);
                                            setErrors(prev => ({ ...prev, creditLimit: '' }));
                                        }}
                                        className={cn(
                                            'w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700',
                                            errors.creditLimit ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        )}
                                        placeholder="50000"
                                        min={0}
                                    />
                                    {errors.creditLimit && <p className="text-xs text-red-600 mt-1">{errors.creditLimit}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">
                                        Conditions de Paiement <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={paymentTermId}
                                        onChange={(e) => {
                                            setPaymentTermId(e.target.value);
                                            setErrors(prev => ({ ...prev, paymentTermId: '' }));
                                        }}
                                        className={cn(
                                            'w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700',
                                            errors.paymentTermId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                        )}
                                    >
                                        <option value="">Sélectionner...</option>
                                        {paymentTerms.map(term => (
                                            <option key={term.id} value={term.id}>
                                                {term.name} ({term.days_number} jours)
                                            </option>
                                        ))}
                                    </select>
                                    {errors.paymentTermId && <p className="text-xs text-red-600 mt-1">{errors.paymentTermId}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes (optionnel)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 resize-none"
                                        placeholder="Remarques supplémentaires..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rejection Form */}
                    {showRejectForm && mode === 'validate' && (
                        <div className="mt-6 p-6 border-2 border-red-200 dark:border-red-800 rounded-lg bg-red-50 dark:bg-red-900/20">
                            <h3 className="text-lg font-bold text-red-900 dark:text-red-100 mb-4">
                                Rejet du Partenaire
                            </h3>
                            <div>
                                <label className="block text-sm font-medium mb-1">
                                    Motif du Rejet <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => {
                                        setRejectionReason(e.target.value);
                                        setErrors(prev => ({ ...prev, rejectionReason: '' }));
                                    }}
                                    rows={4}
                                    className={cn(
                                        'w-full px-4 py-2 rounded-lg border bg-white dark:bg-gray-700 resize-none',
                                        errors.rejectionReason ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                    )}
                                    placeholder="Raison du rejet..."
                                    maxLength={500}
                                />
                                {errors.rejectionReason && <p className="text-xs text-red-600 mt-1">{errors.rejectionReason}</p>}
                                <p className="text-xs text-gray-500 mt-1">{rejectionReason.length}/500 caractères</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {mode === 'validate' && (
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-between shrink-0">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                        >
                            Fermer
                        </button>
                        <div className="flex gap-3">
                            {!showValidateForm && !showRejectForm && (
                                <>
                                    <button
                                        onClick={() => setShowRejectForm(true)}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Rejeter
                                    </button>
                                    <button
                                        onClick={() => setShowValidateForm(true)}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <CheckCircle className="w-4 h-4" />
                                        Valider
                                    </button>
                                </>
                            )}
                            {showValidateForm && (
                                <>
                                    <button
                                        onClick={() => setShowValidateForm(false)}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleValidateSubmit}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Confirmer Validation
                                    </button>
                                </>
                            )}
                            {showRejectForm && (
                                <>
                                    <button
                                        onClick={() => setShowRejectForm(false)}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleRejectSubmit}
                                        disabled={isLoading}
                                        className="px-5 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Confirmer Rejet
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
