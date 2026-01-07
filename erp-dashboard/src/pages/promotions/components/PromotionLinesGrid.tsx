
import { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellDoubleClickedEvent } from 'ag-grid-community';
import {
    ClientSideRowModelModule,
    ModuleRegistry,
    ValidationModule,
    RowSelectionModule,
    TextEditorModule,
    SelectEditorModule,
    NumberEditorModule
} from 'ag-grid-community';
import { useFormContext, useFieldArray } from 'react-hook-form';
import type { Promotion, PromotionLine } from '@/types/promotion.types';
import { AssortmentType, PromotionPaidBasedOn } from '@/types/promotion.types';
import { Plus, Search, Trash2, X, Box } from 'lucide-react';
import { ProductSelectionModal } from './ProductSelectionModal';
import { ProductFamilySelectionDrawer } from './ProductFamilySelectionDrawer';

ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    RowSelectionModule,
    TextEditorModule,
    SelectEditorModule,
    NumberEditorModule
]);

interface PromotionLinesGridProps {
    onLineSelected: (index: number | null) => void;
}

export const PromotionLinesGrid = ({ onLineSelected }: PromotionLinesGridProps) => {
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
    const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; index: number | null }>({ show: false, index: null });

    const { control } = useFormContext<Promotion>();
    const { fields, append, remove, update } = useFieldArray({
        control,
        name: 'lines'
    });

    // We keep a local state for the grid data to ensure smooth updates, 
    // but we sync back to RHF on changes.
    const rowData = useMemo(() => fields.map((field, index) => ({ ...field, index })), [fields]);

    const handleProductSelect = (code: string) => {
        if (activeRowIndex !== null) {
            const currentLine = fields[activeRowIndex];
            // Update the form with the new product code AND switch type to product
            const updatedLine: PromotionLine = {
                ...currentLine,
                paid_based_on_product: PromotionPaidBasedOn.SPECIFIC_PRODUCT,
                paid_product_code: code,
                paid_product_family_code: undefined // Optionally clear family code
            };
            update(activeRowIndex, updatedLine);
            setIsProductModalOpen(false);
            setActiveRowIndex(null);
        }
    };

    const handleFamilySelect = (code: string) => {
        if (activeRowIndex !== null) {
            const currentLine = fields[activeRowIndex];
            // Update the form with the new family code AND switch type to family
            const updatedLine: PromotionLine = {
                ...currentLine,
                paid_based_on_product: PromotionPaidBasedOn.PRODUCT_FAMILY,
                paid_product_family_code: code,
                paid_product_code: undefined // Clear product code
            };
            update(activeRowIndex, updatedLine);
            setIsFamilyDrawerOpen(false);
        }
    };

    const handleCellDoubleClicked = (params: CellDoubleClickedEvent) => {
        if (params.colDef.field === 'paid_product_code') {
            setActiveRowIndex(params.node?.rowIndex ?? null);
            setIsProductModalOpen(true);
        }
    };

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: 'Ligne',
            field: 'index',
            valueGetter: (params) => (params.node?.rowIndex ?? 0) * 10 + 10,
            width: 80,
            sortable: true
        },
        {
            field: 'name',
            headerName: 'Nom',
            editable: true,
            flex: 1,
            minWidth: 150
        },
        {
            headerName: 'Cible de Remise',
            field: 'paid_based_on_product',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: () => {
                return {
                    values: [PromotionPaidBasedOn.ENTIRE_CART, PromotionPaidBasedOn.PRODUCT_FAMILY, PromotionPaidBasedOn.SPECIFIC_PRODUCT],
                    formatValue: (value: any) => {
                        if (value === PromotionPaidBasedOn.SPECIFIC_PRODUCT) return 'Produit Spécifique';
                        if (value === PromotionPaidBasedOn.PRODUCT_FAMILY) return 'Famille de Produits';
                        return 'Panier Entier';
                    }
                };
            },
            valueFormatter: (params) => {
                if (params.value === PromotionPaidBasedOn.SPECIFIC_PRODUCT) return 'Produit Spécifique';
                if (params.value === PromotionPaidBasedOn.PRODUCT_FAMILY) return 'Famille de Produits';
                return 'Panier Entier';
            },
            width: 160,
            tooltipValueGetter: () => 'Où la remise s\'applique : Panier Entier, Famille de Produits, ou Produit Spécifique'
        },
        {
            headerName: 'Code Produit',
            field: 'paid_product_code',
            editable: false,
            width: 180,
            cellRenderer: (params: any) => {
                const isEditable = params.data.paid_based_on_product === PromotionPaidBasedOn.SPECIFIC_PRODUCT;
                const hasValue = params.value;
                const isDisabled = params.data.paid_based_on_product !== PromotionPaidBasedOn.SPECIFIC_PRODUCT;

                return (
                    <div className={`flex items-center justify-between w-full h-full group ${isDisabled ? 'opacity-40 bg-gray-50' : ''
                        }`}>
                        <span className={`truncate font-mono text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-900'
                            }`}>
                            {params.value || (isDisabled ? 'Désactivé' : 'Cliquez pour sélectionner')}
                        </span>
                        {isEditable && (
                            <div className="flex items-center gap-1">
                                {hasValue && (
                                    <button
                                        type="button"
                                        className="p-1 hover:bg-red-50 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rowIndex = params.node.rowIndex;
                                            const currentLine = fields[rowIndex];
                                            update(rowIndex, {
                                                ...currentLine,
                                                paid_product_code: undefined
                                            });
                                        }}
                                        title="Effacer la sélection"
                                    >
                                        <X className="w-3 h-3 text-red-600" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="p-1 hover:bg-sage-50 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveRowIndex(params.node.rowIndex);
                                        setIsProductModalOpen(true);
                                    }}
                                    title={hasValue ? "Changer le produit" : "Sélectionner un produit"}
                                >
                                    <Search className="w-3 h-3 text-sage-600" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            },
            cellClass: (params: any) => {
                return params.data.paid_based_on_product !== PromotionPaidBasedOn.SPECIFIC_PRODUCT ? 'ag-cell-disabled' : '';
            },
            tooltipValueGetter: (params: any) => {
                if (params.data.paid_based_on_product !== PromotionPaidBasedOn.SPECIFIC_PRODUCT) {
                    return 'Cette colonne est désactivée. Sélectionnez "Produit Spécifique" dans la colonne "Cible de Remise" pour l\'activer.';
                }
                return 'Cliquez sur l\'icône de recherche pour sélectionner un produit';
            }
        },
        {
            headerName: 'Assortiment',
            field: 'assortment_type',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: [AssortmentType.NONE, AssortmentType.MULTIPLE_AND, AssortmentType.CART_AMOUNT, AssortmentType.BOTH],
                formatValue: (value: number) => {
                    switch (value) {
                        case AssortmentType.NONE: return 'Aucun';
                        case AssortmentType.MULTIPLE_AND: return 'Produits (ET)';
                        case AssortmentType.CART_AMOUNT: return 'Montant Min';
                        case AssortmentType.BOTH: return 'Les Deux';
                        default: return 'Aucun';
                    }
                }
            },
            valueFormatter: (params) => {
                switch (params.value) {
                    case AssortmentType.NONE: return 'Aucun';
                    case AssortmentType.MULTIPLE_AND: return 'Produits (ET)';
                    case AssortmentType.CART_AMOUNT: return 'Montant Min';
                    case AssortmentType.BOTH: return 'Les Deux';
                    default: return 'Aucun';
                }
            },
            width: 140,
            cellRenderer: (params: any) => {
                const icons: Record<number, string> = {
                    [AssortmentType.NONE]: '○',
                    [AssortmentType.MULTIPLE_AND]: '⊕',
                    [AssortmentType.CART_AMOUNT]: '💰',
                    [AssortmentType.BOTH]: '⊕💰'
                };
                const icon = icons[params.value] || '○';
                const label = params.valueFormatted || 'Aucun';
                return (
                    <div className="flex items-center gap-2 h-full">
                        <span className="text-sm">{icon}</span>
                        <span className="text-xs">{label}</span>
                    </div>
                );
            },
            tooltipValueGetter: () => 'Conditions d\'assortiment requises pour cette règle'
        },
        {
            headerName: 'Code Famille Produit',
            field: 'paid_product_family_code',
            editable: false,
            width: 200,
            cellRenderer: (params: any) => {
                const isEditable = params.data.paid_based_on_product === PromotionPaidBasedOn.PRODUCT_FAMILY;
                const hasValue = params.value;
                const isDisabled = params.data.paid_based_on_product !== PromotionPaidBasedOn.PRODUCT_FAMILY;

                return (
                    <div className={`flex items-center justify-between w-full h-full group ${isDisabled ? 'opacity-40 bg-gray-50' : ''
                        }`}>
                        <span className={`truncate font-mono text-xs ${isDisabled ? 'text-gray-400' : 'text-gray-900'
                            }`}>
                            {params.value || (isDisabled ? 'Désactivé' : 'Cliquez pour sélectionner')}
                        </span>
                        {isEditable && (
                            <div className="flex items-center gap-1">
                                {hasValue && (
                                    <button
                                        type="button"
                                        className="p-1 hover:bg-red-50 rounded transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const rowIndex = params.node.rowIndex;
                                            const currentLine = fields[rowIndex];
                                            update(rowIndex, {
                                                ...currentLine,
                                                paid_product_family_code: undefined
                                            });
                                        }}
                                        title="Effacer la sélection"
                                    >
                                        <X className="w-3 h-3 text-red-600" />
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="p-1 hover:bg-purple-50 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveRowIndex(params.node.rowIndex);
                                        setIsFamilyDrawerOpen(true);
                                    }}
                                    title={hasValue ? "Changer la famille" : "Sélectionner une famille de produits"}
                                >
                                    <Search className="w-3 h-3 text-purple-600" />
                                </button>
                            </div>
                        )}
                    </div>
                );
            },
            cellClass: (params: any) => {
                return params.data.paid_based_on_product !== PromotionPaidBasedOn.PRODUCT_FAMILY ? 'ag-cell-disabled' : '';
            },
            tooltipValueGetter: (params: any) => {
                if (params.data.paid_based_on_product !== PromotionPaidBasedOn.PRODUCT_FAMILY) {
                    return 'Cette colonne est désactivée. Sélectionnez "Famille de Produits" dans la colonne "Cible de Remise" pour l\'activer.';
                }
                return 'Cliquez sur l\'icône de recherche pour sélectionner une famille de produits';
            }
        },
        {
            headerName: 'Actions',
            width: 80,
            cellRenderer: (params: any) => {
                return (
                    <div className="flex items-center justify-center h-full">
                        <button
                            type="button"
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                const rowIndex = params.node.rowIndex;
                                if (rowIndex !== null && rowIndex !== undefined) {
                                    setDeleteConfirm({ show: true, index: rowIndex });
                                }
                            }}
                            title="Supprimer la ligne"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
            pinned: 'right'
        }
    ], [fields, update, remove, onLineSelected]); // Added dependencies for cellRenderer closure if needed, though mostly using params

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        headerClass: 'text-xs font-semibold text-gray-700 bg-gray-50'
    }), []);

    const handleCellValueChanged = (event: any) => {
        const { rowIndex, data, colDef } = event;
        if (rowIndex !== null && rowIndex !== undefined) {
            // Mapping back loose types to strict types if needed
            const updatedLine: PromotionLine = {
                ...data,
                // Ensure types are correct
                paid_based_on_product: data.paid_based_on_product
            };

            // If the paid_based_on_product field changed, clear the irrelevant codes
            if (colDef.field === 'paid_based_on_product') {
                if (data.paid_based_on_product === PromotionPaidBasedOn.SPECIFIC_PRODUCT) {
                    // Product specific - clear family code
                    updatedLine.paid_product_family_code = undefined;
                } else if (data.paid_based_on_product === PromotionPaidBasedOn.PRODUCT_FAMILY) {
                    // Family - clear product code
                    updatedLine.paid_product_code = undefined;
                } else {
                    // Entire cart - clear both
                    updatedLine.paid_product_code = undefined;
                    updatedLine.paid_product_family_code = undefined;
                }
            }

            update(rowIndex, updatedLine);

            // Force grid refresh to update cell renderers
            if (event.api) {
                setTimeout(() => {
                    event.api.refreshCells({ force: true });
                }, 0);
            }
        }
    };

    const handleSelectionChanged = (event: any) => {
        const selectedRows = event.api.getSelectedRows();
        if (selectedRows.length > 0) {
            const selectedRow = selectedRows[0];
            const index = rowData.findIndex(row => row.index === selectedRow.index);
            onLineSelected(index >= 0 ? index : null);
        } else {
            onLineSelected(null);
        }
    };

    const handleRowClicked = (event: any) => {
        const index = event.node.rowIndex ?? null;
        if (index !== null) {
            // Select the row and notify parent
            event.node.setSelected(true, true);
            onLineSelected(index);
        }
    };

    const addNewLine = () => {
        append({
            name: `Règle #${fields.length + 1}`,
            paid_based_on_product: PromotionPaidBasedOn.PRODUCT_FAMILY,
            assortment_type: 'none',
            assortments: [],
            details: []
        } as PromotionLine);
    };

    const handleConfirmDelete = useCallback(() => {
        if (deleteConfirm.index !== null) {
            remove(deleteConfirm.index);
            onLineSelected(null);
            setDeleteConfirm({ show: false, index: null });
        }
    }, [deleteConfirm.index, remove, onLineSelected]);

    return (
        <div className="flex flex-col relative min-h-[400px]">
            <div className="flex justify-between items-center bg-gradient-to-r from-purple-50 to-white px-4 py-3 border-b border-gray-200">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">📋 Règles de Promotion</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Définissez les conditions et cibles. Chaque règle peut avoir plusieurs paliers de remise.</p>
                </div>
                <button
                    type="button"
                    onClick={addNewLine}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm font-medium"
                >
                    <Plus className="w-3 h-3" /> Ajouter Règle
                </button>
            </div>
            <div className="ag-theme-balham" style={{ height: '300px' }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection={{ mode: 'singleRow', enableClickSelection: true }}
                    onCellValueChanged={handleCellValueChanged}
                    onCellDoubleClicked={handleCellDoubleClicked}
                    onSelectionChanged={handleSelectionChanged}
                    onRowClicked={handleRowClicked}
                    stopEditingWhenCellsLoseFocus={true}
                />
            </div>

            <ProductSelectionModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSelect={handleProductSelect}
            />
            <ProductFamilySelectionDrawer
                isOpen={isFamilyDrawerOpen}
                onClose={() => setIsFamilyDrawerOpen(false)}
                onSelect={handleFamilySelect}
                currentCode={activeRowIndex !== null ? fields[activeRowIndex]?.paid_product_family_code : undefined}
            />

            {/* Delete Confirmation Dialog */}
            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
                        <div className="p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-red-100 rounded-full">
                                    <Trash2 className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Supprimer la règle ?
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                        Êtes-vous sûr de vouloir supprimer cette règle de promotion ? Tous les paliers de remise associés seront également supprimés. Cette action est irréversible.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 rounded-b-lg">
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm({ show: false, index: null })}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-md transition"
                            >
                                Annuler
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
                            >
                                Supprimer
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {fields.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-90 z-10">
                    <div className="text-center p-8">
                        <Box className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-semibold text-gray-700 mb-2">
                            Aucune règle de promotion
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Commencez par ajouter une règle pour définir les conditions et cibles de remise.
                        </p>
                        <button
                            type="button"
                            onClick={addNewLine}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-sage-600 text-white rounded-md hover:bg-sage-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Ajouter votre première règle
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
