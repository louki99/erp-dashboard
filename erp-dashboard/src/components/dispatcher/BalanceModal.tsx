import { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Modal } from '@/components/common/Modal';

interface ShortageItem {
    product_id: number;
    product_name: string;
    total_requested: string;
    total_prepared: string;
    shortfall: number;
    requesting_bls: {
        bl_id: number;
        bl_number: string;
        partner_name: string;
        partner_code: string;
        requested_qty: string;
        suggested_qty: number;
    }[];
}

interface BalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (allocations: Record<number, Record<number, number>>) => Promise<void>;
    shortageAnalysis: ShortageItem[];
    loading?: boolean;
}

export const BalanceModal = ({ isOpen, onClose, onSave, shortageAnalysis, loading = false }: BalanceModalProps) => {
    const [allocations, setAllocations] = useState<Record<number, Record<number, Record<number, number>>>>({});
    const [errors, setErrors] = useState<Record<number, string>>({});

    useEffect(() => {
        if (isOpen && shortageAnalysis.length > 0) {
            const initialAllocations: Record<number, Record<number, Record<number, number>>> = {};
            
            shortageAnalysis.forEach(item => {
                initialAllocations[item.product_id] = {};
                item.requesting_bls.forEach(bl => {
                    if (!initialAllocations[item.product_id][bl.bl_id]) {
                        initialAllocations[item.product_id][bl.bl_id] = {};
                    }
                    initialAllocations[item.product_id][bl.bl_id][item.product_id] = bl.suggested_qty;
                });
            });
            
            setAllocations(initialAllocations);
            setErrors({});
        }
    }, [isOpen, shortageAnalysis]);

    const validateAllocations = (productId: number, totalPrepared: number): { isValid: boolean; error?: string } => {
        const productAllocations = allocations[productId] || {};
        let sum = 0;
        
        Object.values(productAllocations).forEach(blAllocs => {
            sum += blAllocs[productId] || 0;
        });

        if (sum !== totalPrepared) {
            return {
                isValid: false,
                error: `Total alloué (${sum}) doit être égal à la quantité préparée (${totalPrepared})`
            };
        }

        return { isValid: true };
    };

    const handleAllocationChange = (productId: number, blId: number, value: string) => {
        const numValue = parseFloat(value) || 0;
        
        setAllocations(prev => ({
            ...prev,
            [productId]: {
                ...prev[productId],
                [blId]: {
                    ...prev[productId]?.[blId],
                    [productId]: Math.max(0, numValue)
                }
            }
        }));

        const item = shortageAnalysis.find(s => s.product_id === productId);
        if (item) {
            const validation = validateAllocations(productId, parseFloat(item.total_prepared));
            setErrors(prev => ({
                ...prev,
                [productId]: validation.error || ''
            }));
        }
    };

    const handleAcceptSuggestions = () => {
        const suggestedAllocations: Record<number, Record<number, Record<number, number>>> = {};
        
        shortageAnalysis.forEach(item => {
            suggestedAllocations[item.product_id] = {};
            item.requesting_bls.forEach(bl => {
                if (!suggestedAllocations[item.product_id][bl.bl_id]) {
                    suggestedAllocations[item.product_id][bl.bl_id] = {};
                }
                suggestedAllocations[item.product_id][bl.bl_id][item.product_id] = bl.suggested_qty;
            });
        });
        
        setAllocations(suggestedAllocations);
        setErrors({});
    };

    const handleSave = async () => {
        let hasErrors = false;
        const newErrors: Record<number, string> = {};

        shortageAnalysis.forEach(item => {
            const validation = validateAllocations(item.product_id, parseFloat(item.total_prepared));
            if (!validation.isValid) {
                hasErrors = true;
                newErrors[item.product_id] = validation.error || '';
            }
        });

        setErrors(newErrors);

        if (hasErrors) {
            return;
        }

        const finalAllocations: Record<number, Record<number, number>> = {};
        
        Object.entries(allocations).forEach(([productId, blAllocations]) => {
            Object.entries(blAllocations).forEach(([blId, productAllocations]) => {
                if (!finalAllocations[parseInt(blId)]) {
                    finalAllocations[parseInt(blId)] = {};
                }
                Object.entries(productAllocations).forEach(([prodId, qty]) => {
                    finalAllocations[parseInt(blId)][parseInt(prodId)] = qty;
                });
            });
        });

        await onSave(finalAllocations);
    };

    const isFormValid = useMemo(() => {
        return shortageAnalysis.every(item => {
            const validation = validateAllocations(item.product_id, parseFloat(item.total_prepared));
            return validation.isValid;
        });
    }, [allocations, shortageAnalysis]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Équilibrer les quantités" size="xl">
            <div className="p-6 space-y-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div>
                            <h4 className="font-semibold text-yellow-900">Ruptures détectées</h4>
                            <p className="text-sm text-yellow-800 mt-1">
                                Le magasinier a préparé moins que demandé. Vous devez répartir les quantités disponibles entre les BLs.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    {shortageAnalysis.map((item, idx) => {
                        const productAllocations = allocations[item.product_id] || {};
                        let currentSum = 0;
                        Object.values(productAllocations).forEach(blAllocs => {
                            currentSum += blAllocs[item.product_id] || 0;
                        });
                        const totalPrepared = parseFloat(item.total_prepared);
                        const isBalanced = currentSum === totalPrepared;

                        return (
                            <div key={idx} className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-gray-900">{item.product_name}</h3>
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                <div>
                                                    <span className="text-gray-500">Demandé:</span>
                                                    <span className="font-semibold text-gray-900 ml-1">{item.total_requested}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Préparé:</span>
                                                    <span className="font-semibold text-blue-600 ml-1">{item.total_prepared}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-500">Manque:</span>
                                                    <span className="font-semibold text-red-600 ml-1">{item.shortfall}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            {isBalanced ? (
                                                <div className="flex items-center gap-1 text-green-600 text-sm font-medium">
                                                    <CheckCircle2 className="w-4 h-4" />
                                                    Équilibré
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-red-600 text-sm font-medium">
                                                    <AlertCircle className="w-4 h-4" />
                                                    {currentSum}/{totalPrepared}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <div className="space-y-3">
                                        {item.requesting_bls.map((bl, blIdx) => {
                                            const allocatedQty = allocations[item.product_id]?.[bl.bl_id]?.[item.product_id] || 0;
                                            const requestedQty = parseFloat(bl.requested_qty);
                                            const isOverAllocated = allocatedQty > requestedQty;

                                            return (
                                                <div key={blIdx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-900 text-sm">{bl.bl_number}</div>
                                                        <div className="text-xs text-gray-600 truncate">
                                                            {bl.partner_name} ({bl.partner_code})
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500">Demandé</div>
                                                            <div className="font-semibold text-gray-900">{bl.requested_qty}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500">Suggéré</div>
                                                            <div className="font-semibold text-blue-600">{bl.suggested_qty}</div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-gray-500 mb-1">Allouer</div>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={requestedQty}
                                                                step="0.001"
                                                                value={allocatedQty}
                                                                onChange={(e) => handleAllocationChange(item.product_id, bl.bl_id, e.target.value)}
                                                                className={`w-20 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${
                                                                    isOverAllocated
                                                                        ? 'border-orange-300 focus:ring-orange-500 bg-orange-50'
                                                                        : 'border-gray-300 focus:ring-blue-500'
                                                                }`}
                                                            />
                                                            {isOverAllocated && (
                                                                <div className="text-xs text-orange-600 mt-0.5">Dépasse demandé</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {errors[item.product_id] && (
                                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            {errors[item.product_id]}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <button
                        onClick={handleAcceptSuggestions}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            Accepter les suggestions
                        </div>
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || !isFormValid}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Enregistrement...' : 'Enregistrer la balance'}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
