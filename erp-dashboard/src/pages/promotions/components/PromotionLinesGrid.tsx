
import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, RowSelectedEvent, CellDoubleClickedEvent } from 'ag-grid-community';
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
import { AssortmentType } from '@/types/promotion.types';
import { Plus, Search } from 'lucide-react';
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

    const { control, register, setValue, watch, getValues } = useFormContext<Promotion>();
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
                paid_based_on_product: true,
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
                paid_based_on_product: false,
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
            cellEditorParams: {
                values: ['true', 'false', 'null']
            },
            valueFormatter: (params) => {
                const val = String(params.value);
                if (val === 'true') return 'Produit Spécifique';
                if (val === 'false') return 'Famille de Produits';
                return 'Panier Entier';
            },
            valueParser: (params) => {
                if (params.newValue === 'Produit Spécifique' || params.newValue === 'true') return true;
                if (params.newValue === 'Famille de Produits' || params.newValue === 'false') return false;
                return null;
            },
            width: 160,
            tooltipValueGetter: () => 'Où la remise s\'applique : Panier Entier, Famille de Produits, ou Produit Spécifique'
        },
        {
            headerName: 'Code Produit',
            field: 'paid_product_code',
            editable: false,
            width: 150,
            cellRenderer: (params: any) => {
                const isEditable = params.data.paid_based_on_product === true;
                return (
                    <div className="flex items-center justify-between w-full h-full group">
                        <span className="truncate font-mono text-xs">{params.value || '-'}</span>
                        {isEditable && (
                            <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-sage-50 rounded focus:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRowIndex(params.node.rowIndex);
                                    setIsProductModalOpen(true);
                                }}
                                title="Sélectionner un Produit"
                            >
                                <Search className="w-3 h-3 text-sage-600" />
                            </button>
                        )}
                    </div>
                );
            },
            tooltipValueGetter: () => 'Cliquez sur l\'icône de recherche pour sélectionner un produit (uniquement lorsque la cible est "Produit Spécifique")'
        },
        {
            headerName: 'Code Famille Produit',
            field: 'paid_product_family_code',
            editable: false,
            width: 180,
            cellRenderer: (params: any) => {
                const isEditable = params.data.paid_based_on_product === false;
                return (
                    <div className="flex items-center justify-between w-full h-full group">
                        <span className="truncate font-mono text-xs">{params.value || '-'}</span>
                        {isEditable && (
                            <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-purple-50 rounded focus:opacity-100 transition-opacity"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveRowIndex(params.node.rowIndex);
                                    setIsFamilyDrawerOpen(true);
                                }}
                                title="Sélectionner une Famille de Produits"
                            >
                                <Search className="w-3 h-3 text-purple-600" />
                            </button>
                        )}
                    </div>
                );
            },
            tooltipValueGetter: () => 'Cliquez sur l\'icône de recherche pour sélectionner une famille de produits (uniquement lorsque la cible est "Famille de Produits")'
        }
    ], [fields, update]); // Added dependencies for cellRenderer closure if needed, though mostly using params

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        headerClass: 'text-xs font-semibold text-gray-700 bg-gray-50'
    }), []);

    const handleCellValueChanged = (event: any) => {
        const { rowIndex, data } = event;
        if (rowIndex !== null && rowIndex !== undefined) {
            // We need to update the form state. 
            // IMPORTANT: fields[rowIndex] might be different from data if sorting happened, 
            // but here we are using ClientSideRowModel.
            // Best is to update the specific field in RHF.
            const fieldName = `lines.${rowIndex}` as const;

            // We can't use 'update' from useFieldArray easily for single field property change 
            // without re-rendering everything or losing focus. 
            // Instead, we use setValue from useFormContext.

            // Mapping back loose types to strict types if needed
            const updatedLine: PromotionLine = {
                ...data,
                // Ensure types are correct
                paid_based_on_product: data.paid_based_on_product
            };

            update(rowIndex, updatedLine);
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
            paid_based_on_product: false,
            assortment_type: AssortmentType.NONE,
            assortments: [],
            details: []
        } as PromotionLine);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center bg-gradient-to-r from-sage-50 to-white px-4 py-3 border-b border-gray-200">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">Règles de Promotion</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Définissez les conditions et cibles de remise. Sélectionnez une règle pour configurer les paliers de remise ci-dessous.</p>
                </div>
                <button
                    type="button"
                    onClick={addNewLine}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-sage-600 text-white rounded-md hover:bg-sage-700 transition-colors shadow-sm"
                >
                    <Plus className="w-3 h-3" /> Ajouter une Règle
                </button>
            </div>
            <div className="flex-1 ag-theme-balham" style={{ minHeight: '300px' }}>
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
        </div>
    );
};
