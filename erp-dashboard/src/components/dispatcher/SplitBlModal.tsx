import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Scissors, Plus, Trash2, Package } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { BonLivraisonItem } from '@/types/dispatcher.types';

interface Split {
    id: string;
    items: number[];
    notes: string;
}

interface SplitBlModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (splits: Array<{ items: number[]; notes?: string }>) => Promise<void>;
    items: BonLivraisonItem[];
    loading?: boolean;
}

export const SplitBlModal = ({ isOpen, onClose, onConfirm, items, loading = false }: SplitBlModalProps) => {
    const [splits, setSplits] = useState<Split[]>([
        { id: '1', items: [], notes: '' },
        { id: '2', items: [], notes: '' },
    ]);
    const [errors, setErrors] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSplits([
                { id: '1', items: [], notes: '' },
                { id: '2', items: [], notes: '' },
            ]);
            setErrors([]);
        }
    }, [isOpen]);

    const assignedItems = useMemo(() => {
        const assigned = new Set<number>();
        splits.forEach(split => {
            split.items.forEach(itemId => assigned.add(itemId));
        });
        return assigned;
    }, [splits]);

    const unassignedItems = useMemo(() => {
        return items.filter(item => !assignedItems.has(item.id));
    }, [items, assignedItems]);

    const validateSplits = (): string[] => {
        const validationErrors: string[] = [];

        // Check if we have at least 1 split
        if (splits.length < 1) {
            validationErrors.push('Au moins 1 division est requise');
        }

        // Check if all items are assigned
        if (unassignedItems.length > 0) {
            validationErrors.push(`${unassignedItems.length} article(s) non assigné(s)`);
        }

        // Check if each split has at least 1 item
        splits.forEach((split, idx) => {
            if (split.items.length === 0) {
                validationErrors.push(`Division ${idx + 1} doit avoir au moins 1 article`);
            }
        });

        // Check for duplicate items across splits
        const allItems: number[] = [];
        splits.forEach(split => {
            split.items.forEach(itemId => {
                if (allItems.includes(itemId)) {
                    validationErrors.push('Un article ne peut pas apparaître dans plusieurs divisions');
                }
                allItems.push(itemId);
            });
        });

        return validationErrors;
    };

    const handleAddSplit = () => {
        const newId = (Math.max(...splits.map(s => parseInt(s.id))) + 1).toString();
        setSplits([...splits, { id: newId, items: [], notes: '' }]);
    };

    const handleRemoveSplit = (splitId: string) => {
        if (splits.length <= 1) return;
        setSplits(splits.filter(s => s.id !== splitId));
    };

    const handleToggleItem = (splitId: string, itemId: number) => {
        setSplits(splits.map(split => {
            if (split.id === splitId) {
                const hasItem = split.items.includes(itemId);
                return {
                    ...split,
                    items: hasItem
                        ? split.items.filter(id => id !== itemId)
                        : [...split.items, itemId]
                };
            }
            // Remove from other splits if exists
            return {
                ...split,
                items: split.items.filter(id => id !== itemId)
            };
        }));
    };

    const handleNotesChange = (splitId: string, notes: string) => {
        setSplits(splits.map(split =>
            split.id === splitId ? { ...split, notes } : split
        ));
    };

    const handleConfirm = async () => {
        const validationErrors = validateSplits();
        setErrors(validationErrors);

        if (validationErrors.length > 0) {
            return;
        }

        const payload = splits.map(split => ({
            items: split.items,
            notes: split.notes || undefined
        }));

        await onConfirm(payload);
    };

    const getSplitTotal = (split: Split): number => {
        return split.items.reduce((total, itemId) => {
            const item = items.find(i => i.id === itemId);
            if (item && item.allocated_quantity && item.unit_price) {
                return total + (parseFloat(item.allocated_quantity.toString()) * parseFloat(item.unit_price.toString()));
            }
            return total;
        }, 0);
    };

    const isFormValid = useMemo(() => {
        return validateSplits().length === 0;
    }, [splits, unassignedItems]);

    const splitColors = [
        'border-blue-300 bg-blue-50',
        'border-green-300 bg-green-50',
        'border-purple-300 bg-purple-50',
        'border-orange-300 bg-orange-50',
        'border-pink-300 bg-pink-50',
    ];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Diviser le BL" size="xl">
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <Scissors className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-blue-900">Division du BL</h4>
                            <p className="text-sm text-blue-800 mt-1">
                                Répartissez les {items.length} articles entre les divisions. Chaque division deviendra un BL séparé.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Unassigned Items */}
                {unassignedItems.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-3">
                            <Package className="w-4 h-4 text-gray-600" />
                            <h3 className="font-semibold text-gray-900">Articles non assignés ({unassignedItems.length})</h3>
                        </div>
                        <div className="space-y-2">
                            {unassignedItems.map(item => (
                                <div key={item.id} className="p-2 bg-white rounded border border-gray-200 text-sm">
                                    <div className="font-medium text-gray-900">
                                        {item.product?.name || item.product_name || 'Produit inconnu'}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        Qté: {item.allocated_quantity} × {item.unit_price} MAD = {
                                            item.allocated_quantity && item.unit_price
                                                ? (parseFloat(item.allocated_quantity.toString()) * parseFloat(item.unit_price.toString())).toFixed(2)
                                                : '0.00'
                                        } MAD
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Splits */}
                <div className="space-y-4">
                    {splits.map((split, idx) => {
                        const splitTotal = getSplitTotal(split);
                        const colorClass = splitColors[idx % splitColors.length];

                        return (
                            <div key={split.id} className={`border-2 rounded-lg overflow-hidden ${colorClass}`}>
                                <div className="px-4 py-3 border-b border-gray-200 bg-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="font-semibold text-gray-900">Division {idx + 1}</div>
                                            <div className="text-sm text-gray-600">
                                                ({split.items.length} article{split.items.length !== 1 ? 's' : ''})
                                            </div>
                                            <div className="text-sm font-semibold text-blue-600">
                                                {splitTotal.toFixed(2)} MAD
                                            </div>
                                        </div>
                                        {splits.length > 1 && (
                                            <button
                                                onClick={() => handleRemoveSplit(split.id)}
                                                disabled={loading}
                                                className="text-red-600 hover:text-red-800 p-1"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-white">
                                    <div className="mb-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Sélectionner les articles
                                        </label>
                                        <div className="space-y-2 max-h-48 overflow-y-auto">
                                            {items.map(item => {
                                                const isSelected = split.items.includes(item.id);
                                                const isInOtherSplit = assignedItems.has(item.id) && !isSelected;

                                                return (
                                                    <label
                                                        key={item.id}
                                                        className={`flex items-start gap-3 p-2 rounded border cursor-pointer transition-colors ${
                                                            isSelected
                                                                ? 'bg-blue-50 border-blue-300'
                                                                : isInOtherSplit
                                                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed'
                                                                : 'bg-white border-gray-200 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => handleToggleItem(split.id, item.id)}
                                                            disabled={loading || isInOtherSplit}
                                                            className="mt-1"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-gray-900 text-sm">
                                                                {item.product?.name || item.product_name || 'Produit inconnu'}
                                                            </div>
                                                            {item.product?.code && (
                                                                <div className="text-xs text-gray-500">{item.product.code}</div>
                                                            )}
                                                            <div className="text-xs text-gray-600 mt-1">
                                                                Qté: {item.allocated_quantity} × {item.unit_price} MAD
                                                            </div>
                                                        </div>
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {item.allocated_quantity && item.unit_price
                                                                ? (parseFloat(item.allocated_quantity.toString()) * parseFloat(item.unit_price.toString())).toFixed(2)
                                                                : '0.00'} MAD
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Notes (optionnel)
                                        </label>
                                        <textarea
                                            value={split.notes}
                                            onChange={(e) => handleNotesChange(split.id, e.target.value)}
                                            disabled={loading}
                                            placeholder="Ex: Produits surgelés - camion réfrigéré requis"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                            rows={2}
                                            maxLength={500}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button
                    onClick={handleAddSplit}
                    disabled={loading}
                    className="w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <div className="flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        Ajouter une division
                    </div>
                </button>

                {errors.length > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                                <div className="font-semibold text-red-900 mb-1">Erreurs de validation</div>
                                <ul className="text-sm text-red-800 space-y-1">
                                    {errors.map((error, idx) => (
                                        <li key={idx}>• {error}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        {splits.length} division{splits.length !== 1 ? 's' : ''} • {assignedItems.size}/{items.length} articles assignés
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading || !isFormValid}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                'Division en cours...'
                            ) : (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmer la division
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
