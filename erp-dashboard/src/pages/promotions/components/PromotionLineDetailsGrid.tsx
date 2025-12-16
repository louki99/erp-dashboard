
import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
    ClientSideRowModelModule,
    ModuleRegistry,
    ValidationModule,
    TextEditorModule,
    NumberEditorModule,
    SelectEditorModule
} from 'ag-grid-community';
import { useFormContext, useFieldArray } from 'react-hook-form';
import type { Promotion, PromotionLineDetail } from '@/types/promotion.types';
import { PromotionType } from '@/types/promotion.types';
import { Plus, Trash2 } from 'lucide-react';

ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    TextEditorModule,
    NumberEditorModule,
    SelectEditorModule
]);

interface PromotionLineDetailsGridProps {
    lineIndex: number | null;
}

export const PromotionLineDetailsGrid = ({ lineIndex }: PromotionLineDetailsGridProps) => {
    const { control } = useFormContext<Promotion>();

    // We conditionally call useFieldArray. 
    // Ideally useFieldArray should be called always, but the "name" depends on index.
    // To satisfy hooks rules, we can't switch the name dynamically in a way that breaks rules.
    // However, since we are fetching a specific nested array, we need a stable hook call.
    // A better approach is to pass the control and let this component manage the update via the specific path.
    // BUT, useFieldArray requires a static name usually. 

    // Workaround: We will use a key on this component in the parent to force re-mounting 
    // when lineIndex changes, OR we use the generic `lines.${index}.details` name.

    const name = lineIndex !== null ? `lines.${lineIndex}.details` : 'lines.0.details'; // Fallback to avoid crash, but handled by early return UI

    const { fields, append, remove, update } = useFieldArray({
        control,
        name: name as any
    });

    const rowData = useMemo(() => fields.map((f) => ({ ...f })), [fields]);

    const promoTypeOptions = Object.values(PromotionType).filter(v => typeof v === 'number');
    const promoTypeLabels = {
        [PromotionType.PERCENTAGE_DISCOUNT]: 'Remise %',
        [PromotionType.FIXED_AMOUNT_DISCOUNT]: 'Montant Fixe',
        [PromotionType.BEST_PRICE]: 'Meilleur Prix',
        [PromotionType.AMOUNT_PER_UNIT]: 'Montant par Unité',
        [PromotionType.FREE_PROMO_UNIT]: 'Unité Gratuite',
        [PromotionType.FLAT_AMOUNT_DISCOUNT]: 'Montant Forfaitaire',
        [PromotionType.REPLACE_PRICE]: 'Prix de Remplacement'
    };

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: 'Ligne',
            valueGetter: (params) => (params.node?.rowIndex ?? 0) * 10 + 10,
            width: 80
        },
        {
            field: 'promo_type',
            headerName: 'Type',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: promoTypeOptions
            },
            valueFormatter: (params) => promoTypeLabels[params.value as PromotionType] || params.value,
            flex: 1
        },
        {
            field: 'repeating',
            headerName: 'Répéter',
            editable: true,
            cellRenderer: (params: any) => <input type="checkbox" checked={params.value} readOnly />,
            width: 100
        },
        {
            field: 'minimum_value',
            headerName: 'Minimum',
            editable: true,
            cellEditor: 'agNumberCellEditor',
            width: 120
        },
        {
            field: 'amount',
            headerName: 'Montant',
            editable: true,
            cellEditor: 'agNumberCellEditor',
            width: 120
        },
        {
            headerName: 'Actions',
            cellRenderer: (params: any) => (
                <button
                    onClick={() => remove(params.node.rowIndex)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
            width: 80,
            sortable: false,
            filter: false
        }
    ], [promoTypeOptions, remove]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        headerClass: 'text-xs font-semibold text-gray-700 bg-gray-50'
    }), []);

    const handleCellValueChanged = (event: any) => {
        if (lineIndex === null) return;
        const { rowIndex, data } = event;
        update(rowIndex, data);
    };

    const addDetail = () => {
        append({
            promo_type: PromotionType.REPLACE_PRICE,
            minimum_value: 1,
            amount: 0,
            repeating: false
        } as PromotionLineDetail);
    };

    if (lineIndex === null) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 text-gray-400">
                <p>Select a rule above to view details</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center bg-gray-50 px-4 py-2 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700">Detail Promo</h3>
                <button
                    type="button"
                    onClick={addDetail}
                    className="text-xs flex items-center gap-1 px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
                >
                    <Plus className="w-3 h-3" /> Add Detail
                </button>
            </div>
            <div className="flex-1 ag-theme-balham" style={{ minHeight: '200px' }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onCellValueChanged={handleCellValueChanged}
                    stopEditingWhenCellsLoseFocus={true}
                />
            </div>
        </div>
    );
};
