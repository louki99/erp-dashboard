import { useState } from 'react';
import { TrendingUp, AlertCircle, Loader2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Partner {
    id: number;
    code: string;
    name: string;
    credit_limit: string | number;
    credit_used: string | number;
}

interface CreditLimitUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (newCreditLimit: number, justification: string) => void;
    partner: Partner | null;
    isLoading?: boolean;
}

/**
 * Modal component for updating partner credit limit
 * Shows current vs new limit comparison and requires justification
 */
export const CreditLimitUpdateModal = ({
    isOpen,
    onClose,
    onSubmit,
    partner,
    isLoading = false,
}: CreditLimitUpdateModalProps) => {
    const [newCreditLimit, setNewCreditLimit] = useState('');
    const [justification, setJustification] = useState('');
    const [errors, setErrors] = useState<{ limit?: string; justification?: string }>({});

    const currentLimit = partner ? parseFloat(String(partner.credit_limit) || '0') : 0;
    const creditUsed = partner ? parseFloat(String(partner.credit_used) || '0') : 0;
    const limitValue = parseFloat(newCreditLimit) || 0;
    const difference = limitValue - currentLimit;
    const requiresSupervisorApproval = Math.abs(difference) > 50000;

    const handleSubmit = () => {
        const newErrors: typeof errors = {};

        if (!newCreditLimit.trim()) {
            newErrors.limit = 'Le nouveau plafond est requis';
        } else if (isNaN(limitValue) || limitValue < 0) {
            newErrors.limit = 'Veuillez entrer un montant valide (≥ 0)';
        } else if (limitValue < creditUsed) {
            newErrors.limit = `Le nouveau plafond ne peut pas être inférieur au crédit utilisé (${creditUsed.toLocaleString()} Dh)`;
        }

        if (!justification.trim()) {
            newErrors.justification = 'La justification est requise';
        } else if (justification.length > 500) {
            newErrors.justification = 'La justification ne peut pas dépasser 500 caractères';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit(limitValue, justification);
    };

    const handleClose = () => {
        setNewCreditLimit('');
        setJustification('');
        setErrors({});
        onClose();
    };

    if (!isOpen || !partner) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Mise à Jour du Plafond Crédit</h3>
                            <p className="text-sm text-emerald-50 mt-1">
                                {partner.code} - {partner.name}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {/* Current Status */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Plafond Actuel
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                {currentLimit.toLocaleString()} Dh
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                                Crédit Utilisé
                            </div>
                            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                {creditUsed.toLocaleString()} Dh
                            </div>
                        </div>
                    </div>

                    {/* New Limit Input */}
                    <div className="mb-5">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nouveau Plafond de Crédit <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={newCreditLimit}
                                onChange={(e) => {
                                    setNewCreditLimit(e.target.value);
                                    setErrors(prev => ({ ...prev, limit: undefined }));
                                }}
                                className={cn(
                                    'w-full rounded-lg border bg-white dark:bg-gray-700 px-4 py-2.5 text-sm transition-colors pr-12',
                                    'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                                    errors.limit
                                        ? 'border-red-300 dark:border-red-600'
                                        : 'border-gray-300 dark:border-gray-600'
                                )}
                                placeholder="150000"
                                disabled={isLoading}
                                min={0}
                                step={1000}
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                                Dh
                            </span>
                        </div>
                        {errors.limit && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.limit}</p>
                        )}

                        {/* Difference Indicator */}
                        {limitValue > 0 && !errors.limit && (
                            <div className={cn(
                                'mt-3 p-3 rounded-lg border flex items-start gap-3',
                                difference > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                                    : difference < 0
                                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                        : 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700'
                            )}>
                                <AlertCircle className={cn(
                                    'w-5 h-5 shrink-0 mt-0.5',
                                    difference > 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : difference < 0
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : 'text-gray-600 dark:text-gray-400'
                                )} />
                                <div className="flex-1">
                                    <p className={cn(
                                        'text-sm font-medium',
                                        difference > 0
                                            ? 'text-emerald-900 dark:text-emerald-100'
                                            : difference < 0
                                                ? 'text-amber-900 dark:text-amber-100'
                                                : 'text-gray-900 dark:text-gray-100'
                                    )}>
                                        {difference > 0 ? 'Augmentation' : difference < 0 ? 'Réduction' : 'Aucun changement'}: {' '}
                                        <span className="font-bold">
                                            {difference > 0 ? '+' : ''}{difference.toLocaleString()} Dh
                                        </span>
                                    </p>
                                    {requiresSupervisorApproval && (
                                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                                            ⚠️ Changement supérieur à 50 000 Dh - Approbation du superviseur requise
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Justification */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Justification <span className="text-red-500">*</span>
                            <span className="text-xs text-gray-500 ml-2">
                                ({justification.length}/500 caractères)
                            </span>
                        </label>
                        <textarea
                            value={justification}
                            onChange={(e) => {
                                setJustification(e.target.value);
                                setErrors(prev => ({ ...prev, justification: undefined }));
                            }}
                            rows={4}
                            className={cn(
                                'w-full rounded-lg border bg-white dark:bg-gray-700 px-4 py-2.5 text-sm transition-colors resize-none',
                                'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                                errors.justification
                                    ? 'border-red-300 dark:border-red-600'
                                    : 'border-gray-300 dark:border-gray-600'
                            )}
                            placeholder="Exemple: Augmentation en raison d'un historique de paiement constant et d'une croissance de l'activité commerciale..."
                            disabled={isLoading}
                            maxLength={500}
                        />
                        {errors.justification && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.justification}</p>
                        )}
                    </div>

                    {/* Info Notice */}
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-start gap-3">
                        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            Cette modification sera enregistrée dans l'historique des crédits du partenaire.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3">
                        <button
                            onClick={handleClose}
                            disabled={isLoading}
                            className="px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 rounded-lg shadow-sm focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Confirmer la Mise à Jour
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
