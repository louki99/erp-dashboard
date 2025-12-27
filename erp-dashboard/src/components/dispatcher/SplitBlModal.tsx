import { useState, useEffect, useMemo } from 'react';
import { AlertCircle, CheckCircle2, Scissors, Plus, Trash2, Package, GripVertical, ArrowRight } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { BonLivraisonItem } from '@/types/dispatcher.types';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    closestCorners,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

const DraggableItem = ({ item, splitId }: { item: BonLivraisonItem; splitId: string | null }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `item-${item.id}`, data: { item, splitId } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const itemTotal = item.allocated_quantity && item.unit_price
        ? (Number(item.allocated_quantity) * Number(item.unit_price)).toFixed(2)
        : '0.00';

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`group bg-white border-2 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-blue-400 transition-all ${
                isDragging ? 'shadow-lg border-blue-500 z-50' : 'border-gray-200'
            }`}
        >
            <div className="flex items-start gap-3">
                <div
                    {...attributes}
                    {...listeners}
                    className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                >
                    <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 text-sm">
                        {item.product?.name || item.product_name || 'Produit inconnu'}
                    </div>
                    {item.product?.code && (
                        <div className="text-xs text-gray-500 mt-0.5">{item.product.code}</div>
                    )}
                    <div className="text-xs text-gray-600 mt-1.5 flex items-center gap-2">
                        <span className="bg-gray-100 px-2 py-0.5 rounded">Qté: {item.allocated_quantity}</span>
                        <span className="text-gray-400">×</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded">{item.unit_price} MAD</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-gray-900">{itemTotal} MAD</div>
                </div>
            </div>
        </div>
    );
};

const DropZone = ({
    split,
    index,
    items,
    onRemove,
    onNotesChange,
    canRemove,
    loading,
}: {
    split: Split;
    index: number;
    items: BonLivraisonItem[];
    onRemove: () => void;
    onNotesChange: (notes: string) => void;
    canRemove: boolean;
    loading: boolean;
}) => {
    const { setNodeRef } = useSortable({ id: `split-${split.id}`, data: { type: 'split', splitId: split.id } });

    const splitItems = items.filter(item => split.items.includes(item.id));
    const splitTotal = splitItems.reduce((total, item) => {
        if (item.allocated_quantity && item.unit_price) {
            return total + (Number(item.allocated_quantity) * Number(item.unit_price));
        }
        return total;
    }, 0);

    const colors = [
        { border: 'border-blue-300', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100' },
        { border: 'border-green-300', bg: 'bg-green-50', text: 'text-green-700', badge: 'bg-green-100' },
        { border: 'border-purple-300', bg: 'bg-purple-50', text: 'text-purple-700', badge: 'bg-purple-100' },
        { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-700', badge: 'bg-orange-100' },
        { border: 'border-pink-300', bg: 'bg-pink-50', text: 'text-pink-700', badge: 'bg-pink-100' },
    ];
    const color = colors[index % colors.length];

    return (
        <div className={`border-2 rounded-xl overflow-hidden ${color.border} ${color.bg}`}>
            <div className="bg-white px-4 py-3 border-b-2 border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`font-bold text-lg ${color.text}`}>Division {index + 1}</div>
                        <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${color.badge} ${color.text}`}>
                            {split.items.length} article{split.items.length !== 1 ? 's' : ''}
                        </div>
                        {splitTotal > 0 && (
                            <div className="text-sm font-bold text-gray-900">
                                {splitTotal.toFixed(2)} MAD
                            </div>
                        )}
                    </div>
                    {canRemove && (
                        <button
                            onClick={onRemove}
                            disabled={loading}
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Supprimer cette division"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <div ref={setNodeRef} className="p-4 min-h-[200px] space-y-2">
                {splitItems.length === 0 ? (
                    <div className="h-[180px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                        <Package className="w-10 h-10 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Glissez des articles ici</p>
                        <p className="text-xs mt-1">Division vide</p>
                    </div>
                ) : (
                    <SortableContext items={splitItems.map(item => `item-${item.id}`)} strategy={verticalListSortingStrategy}>
                        {splitItems.map(item => (
                            <DraggableItem key={item.id} item={item} splitId={split.id} />
                        ))}
                    </SortableContext>
                )}
            </div>

            <div className="bg-white px-4 py-3 border-t-2 border-gray-200">
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                    Notes (optionnel)
                </label>
                <textarea
                    value={split.notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    disabled={loading}
                    placeholder="Ex: Produits surgelés - camion réfrigéré requis"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={2}
                    maxLength={500}
                />
            </div>
        </div>
    );
};

export const SplitBlModal = ({ isOpen, onClose, onConfirm, items, loading = false }: SplitBlModalProps) => {
    const [splits, setSplits] = useState<Split[]>([
        { id: '1', items: [], notes: '' },
        { id: '2', items: [], notes: '' },
    ]);
    const [errors, setErrors] = useState<string[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

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

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeItemId = parseInt(active.id.toString().replace('item-', ''));
        const overData = over.data.current;

        if (overData?.type === 'split') {
            const targetSplitId = overData.splitId;
            setSplits(prevSplits => prevSplits.map(split => {
                if (split.id === targetSplitId) {
                    if (!split.items.includes(activeItemId)) {
                        return { ...split, items: [...split.items, activeItemId] };
                    }
                }
                return { ...split, items: split.items.filter(id => id !== activeItemId) };
            }));
        } else if (overData?.splitId) {
            const sourceSplitId = active.data.current?.splitId;
            const targetSplitId = overData.splitId;

            if (sourceSplitId !== targetSplitId) {
                setSplits(prevSplits => prevSplits.map(split => {
                    if (split.id === targetSplitId) {
                        if (!split.items.includes(activeItemId)) {
                            return { ...split, items: [...split.items, activeItemId] };
                        }
                    }
                    return { ...split, items: split.items.filter(id => id !== activeItemId) };
                }));
            }
        }
    };

    const isFormValid = useMemo(() => {
        return validateSplits().length === 0;
    }, [splits, unassignedItems]);

    const activeItem = activeId ? items.find(item => `item-${item.id}` === activeId) : null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Diviser le BL" size="2xl">
            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            >
                <div className="p-6 space-y-6">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                        <div className="flex items-start gap-4">
                            <div className="p-2.5 bg-blue-500 rounded-lg">
                                <Scissors className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h4 className="font-bold text-blue-900 text-lg">Division du BL</h4>
                                <p className="text-sm text-blue-800 mt-1.5 leading-relaxed">
                                    Glissez-déposez les <span className="font-semibold">{items.length} articles</span> entre les divisions.
                                    Chaque division deviendra un BL séparé.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Unassigned Items Pool */}
                        <div className="lg:col-span-2">
                            <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl overflow-hidden">
                                <div className="bg-white px-4 py-3 border-b-2 border-gray-300">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Package className="w-5 h-5 text-gray-600" />
                                            <h3 className="font-bold text-gray-900">Articles à répartir</h3>
                                            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-200 text-gray-700">
                                                {unassignedItems.length} / {items.length}
                                            </span>
                                        </div>
                                        {unassignedItems.length === 0 && (
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 min-h-[150px]">
                                    {unassignedItems.length === 0 ? (
                                        <div className="h-[120px] flex flex-col items-center justify-center text-green-600">
                                            <CheckCircle2 className="w-12 h-12 mb-2" />
                                            <p className="font-semibold">Tous les articles sont assignés</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            <SortableContext items={unassignedItems.map(item => `item-${item.id}`)} strategy={verticalListSortingStrategy}>
                                                {unassignedItems.map(item => (
                                                    <DraggableItem key={item.id} item={item} splitId={null} />
                                                ))}
                                            </SortableContext>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Arrow Indicator */}
                        <div className="lg:col-span-2 flex items-center justify-center py-2">
                            <div className="flex items-center gap-3 text-gray-400">
                                <div className="h-px w-16 bg-gray-300"></div>
                                <ArrowRight className="w-5 h-5" />
                                <span className="text-sm font-medium">Glissez vers les divisions</span>
                                <ArrowRight className="w-5 h-5" />
                                <div className="h-px w-16 bg-gray-300"></div>
                            </div>
                        </div>

                        {/* Splits */}
                        <SortableContext items={splits.map(s => `split-${s.id}`)} strategy={verticalListSortingStrategy}>
                            {splits.map((split, idx) => (
                                <DropZone
                                    key={split.id}
                                    split={split}
                                    index={idx}
                                    items={items}
                                    onRemove={() => handleRemoveSplit(split.id)}
                                    onNotesChange={(notes) => handleNotesChange(split.id, notes)}
                                    canRemove={splits.length > 1}
                                    loading={loading}
                                />
                            ))}
                        </SortableContext>
                    </div>

                    <button
                        onClick={handleAddSplit}
                        disabled={loading}
                        className="w-full px-4 py-3 text-sm font-semibold text-blue-700 bg-blue-50 border-2 border-blue-300 border-dashed rounded-xl hover:bg-blue-100 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <div className="flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5" />
                            Ajouter une division
                        </div>
                    </button>

                    {errors.length > 0 && (
                        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                                <div className="flex-1">
                                    <div className="font-bold text-red-900 mb-2">Erreurs de validation</div>
                                    <ul className="text-sm text-red-800 space-y-1.5">
                                        {errors.map((error, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="text-red-500 mt-0.5">•</span>
                                                <span>{error}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4 border-t-2 border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="text-sm font-semibold text-gray-700">
                                {splits.length} division{splits.length !== 1 ? 's' : ''}
                            </div>
                            <div className="h-4 w-px bg-gray-300"></div>
                            <div className={`text-sm font-semibold ${
                                assignedItems.size === items.length ? 'text-green-600' : 'text-amber-600'
                            }`}>
                                {assignedItems.size}/{items.length} articles assignés
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={loading || !isFormValid}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow transition-all"
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Division en cours...
                                    </div>
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

                <DragOverlay>
                    {activeItem ? (
                        <div className="bg-white border-2 border-blue-500 rounded-lg p-3 shadow-2xl opacity-90">
                            <div className="flex items-start gap-3">
                                <GripVertical className="w-5 h-5 text-blue-500 mt-1" />
                                <div className="flex-1">
                                    <div className="font-semibold text-gray-900 text-sm">
                                        {activeItem.product?.name || activeItem.product_name || 'Produit inconnu'}
                                    </div>
                                    <div className="text-xs text-gray-600 mt-1">
                                        Qté: {activeItem.allocated_quantity}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
        </Modal>
    );
};
