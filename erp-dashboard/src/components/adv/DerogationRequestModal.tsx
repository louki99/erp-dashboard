import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface User {
    id: number;
    name: string;
    email: string;
}

interface DerogationRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (responsableId: number, justification: string) => void;
    responsables: User[];
    isLoading?: boolean;
    bcNumber?: string;
    excessAmount?: number;
}

/**
 * Modal component for requesting credit derogation
 * Allows selection of supervisor and entry of justification
 */
export const DerogationRequestModal = ({
    isOpen,
    onClose,
    onSubmit,
    responsables,
    isLoading = false,
    bcNumber,
    excessAmount,
}: DerogationRequestModalProps) => {
    const [selectedResponsable, setSelectedResponsable] = useState<string>('');
    const [justification, setJustification] = useState('');
    const [errors, setErrors] = useState<{ responsable?: string; justification?: string }>({});

    const handleSubmit = () => {
        const newErrors: typeof errors = {};

        if (!selectedResponsable) {
            newErrors.responsable = 'Veuillez sélectionner un responsable';
        }

        if (!justification.trim()) {
            newErrors.justification = 'La justification est requise';
        } else if (justification.trim().length < 20) {
            newErrors.justification = 'La justification doit contenir au moins 20 caractères';
        } else if (justification.length > 1000) {
            newErrors.justification = 'La justification ne peut pas dépasser 1000 caractères';
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        onSubmit(parseInt(selectedResponsable), justification);
    };

    const handleClose = () => {
        setSelectedResponsable('');
        setJustification('');
        setErrors({});
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
                    <div className="flex items-center gap-3 text-white">
                        <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">Demande de Dérogation Crédit</h3>
                            {bcNumber && (
                                <p className="text-sm text-amber-50 mt-1">BC: {bcNumber}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {excessAmount !== undefined && (
                        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-1">
                                        Dépassement du plafond de crédit
                                    </p>
                                    <p className="text-sm text-amber-700 dark:text-amber-300">
                                        Montant excédentaire: <span className="font-bold">{excessAmount.toLocaleString()} Dh</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                        Le plafond de crédit du partenaire est dépassé. Veuillez sélectionner un responsable et fournir une justification détaillée pour la demande de dérogation.
                    </p>

                    <div className="space-y-5">
                        {/* Responsable Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Responsable <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={selectedResponsable}
                                onChange={(e) => {
                                    setSelectedResponsable(e.target.value);
                                    setErrors(prev => ({ ...prev, responsable: undefined }));
                                }}
                                className={cn(
                                    'w-full rounded-lg border bg-white dark:bg-gray-700 px-4 py-2.5 text-sm transition-colors',
                                    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
                                    errors.responsable
                                        ? 'border-red-300 dark:border-red-600'
                                        : 'border-gray-300 dark:border-gray-600'
                                )}
                                disabled={isLoading}
                            >
                                <option value="">Sélectionner un responsable</option>
                                {responsables.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} {user.email && `(${user.email})`}
                                    </option>
                                ))}
                            </select>
                            {errors.responsable && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.responsable}</p>
                            )}
                        </div>

                        {/* Justification */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Justification <span className="text-red-500">*</span>
                                <span className="text-xs text-gray-500 ml-2">
                                    ({justification.length}/1000 caractères, min. 20)
                                </span>
                            </label>
                            <textarea
                                value={justification}
                                onChange={(e) => {
                                    setJustification(e.target.value);
                                    setErrors(prev => ({ ...prev, justification: undefined }));
                                }}
                                rows={5}
                                className={cn(
                                    'w-full rounded-lg border bg-white dark:bg-gray-700 px-4 py-2.5 text-sm transition-colors resize-none',
                                    'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent',
                                    errors.justification
                                        ? 'border-red-300 dark:border-red-600'
                                        : 'border-gray-300 dark:border-gray-600'
                                )}
                                placeholder="Exemple: Le partenaire a un excellent historique de paiement sur 2 ans sans aucun retard. Cette commande saisonnière est pour la période du Ramadan avec un chiffre d'affaires attendu élevé. L'activité du partenaire a connu une croissance de 30% cette année..."
                                disabled={isLoading}
                                maxLength={1000}
                            />
                            {errors.justification && (
                                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.justification}</p>
                            )}
                            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                💡 Conseil: Mentionnez l'historique de paiement, la croissance de l'activité, la saisonnalité, ou tout autre élément justifiant l'exception.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-8 flex justify-end gap-3">
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
                            className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-lg shadow-sm focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                            Envoyer la Demande
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
