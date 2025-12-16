
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
            headerName: 'Basé sur Produit',
            field: 'paid_based_on_product',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: ['true', 'false', 'null']
            },
            valueFormatter: (params) => {
                const val = String(params.value);
                if (val === 'true') return 'Produit Spécifique';
                if (val === 'false') return 'Famille Produit';
                return 'Panier Entier';
            },
            valueParser: (params) => {
                if (params.newValue === 'Produit Spécifique' || params.newValue === 'true') return true;
                if (params.newValue === 'Famille Produit' || params.newValue === 'false') return false;
                return null;
            },
            width: 150
        },
        {
            headerName: 'Code Produit',
            field: 'paid_product_code',
            // Disable direct editing to favor double-click modal opening
            editable: false,
            width: 150,
            cellRenderer: (params: any) => {
                const isEditable = params.data.paid_based_on_product === true;
                return (
                    <div className="flex items-center justify-between w-full h-full group">
                        <span className="truncate">{params.value}</span>
                        {isEditable && (
                            <button
                                type="button"
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded focus:opacity-100"
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent grid row selection if needed
                                    setActiveRowIndex(params.node.rowIndex);
                                    setIsProductModalOpen(true);
                                }}
                            >
                                <Search className="w-3 h-3 text-gray-500" />
                            </button>
                        )}
                    </div>
                );
            }
        },
        {
            headerName: 'Code Famille Produit',
            field: 'paid_product_family_code',
            editable: (params) => params.data.paid_based_on_product === false,
            width: 180
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

    const handleSelectionChanged = (event: RowSelectedEvent) => {
        if (event.node.isSelected()) {
            onLineSelected(event.node.rowIndex ?? null);
        }
    };

    const addNewLine = () => {
        append({
            name: `Rule #${fields.length + 1}`,
            paid_based_on_product: null,
            assortment_type: AssortmentType.NONE,
            assortments: [],
            details: []
        } as PromotionLine);
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Promotion Rules</h3>
                <button
                    type="button"
                    onClick={addNewLine}
                    className="text-xs flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                    <Plus className="w-3 h-3" /> Add Line
                </button>
            </div>
            <div className="flex-1 ag-theme-balham" style={{ minHeight: '300px' }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection="single"
                    onCellValueChanged={handleCellValueChanged}
                    onCellDoubleClicked={handleCellDoubleClicked}
                    onRowSelected={handleSelectionChanged}
                    stopEditingWhenCellsLoseFocus={true}
                />
            </div>

            <ProductSelectionModal
                isOpen={isProductModalOpen}
                onClose={() => setIsProductModalOpen(false)}
                onSelect={handleProductSelect}
            />
        </div>
    );
};
