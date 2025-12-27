
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
import { PromotionType, BreakpointType } from '@/types/promotion.types';
import { Plus, Trash2, Box } from 'lucide-react';

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
    const { control, watch } = useFormContext<Promotion>();
    
    // Watch breakpoint_type to adapt UI labels
    const breakpointType = watch('breakpoint_type');

    // We conditionally call useFieldArray. 
    // Ideally useFieldArray should be called always, but the "name" depends on index.
    // To satisfy hooks rules, we can't switch the name dynamically in a way that breaks rules.
    // However, since we are fetching a specific nested array, we need a stable hook call.
    // A better approach is to pass the control and let this component manage the update via the specific path.
    // BUT, useFieldArray requires a static name usually. 

    // Dynamic useFieldArray: We need to handle the case where lineIndex changes.
    // React Hook Form requires stable field names, so we use a conditional approach.
    const { fields, append, remove, update } = useFieldArray({
        control,
        name: lineIndex !== null ? (`lines.${lineIndex}.details` as any) : 'lines.0.details' as any,
        keyName: 'id' // Use a key to help React track items
    });

    const rowData = useMemo(() => fields.map((f) => ({ ...f })), [fields]);

    const promoTypeOptions = Object.values(PromotionType).filter(v => typeof v === 'number');
    const promoTypeLabels = {
        [PromotionType.PERCENTAGE_DISCOUNT]: 'Remise en Pourcentage',
        [PromotionType.FIXED_AMOUNT_DISCOUNT]: 'Montant Fixe',
        [PromotionType.BEST_PRICE]: 'Meilleur Prix',
        [PromotionType.AMOUNT_PER_UNIT]: 'Montant par Unité',
        [PromotionType.FREE_PROMO_UNIT]: 'Unité Promo Gratuite',
        [PromotionType.FLAT_AMOUNT_DISCOUNT]: 'Montant Forfaitaire',
        [PromotionType.REPLACE_PRICE]: 'Prix de Remplacement'
    };

    const promoTypeDescriptions = {
        [PromotionType.PERCENTAGE_DISCOUNT]: 'Appliquer une remise en pourcentage (ex: 10 = 10%)',
        [PromotionType.FIXED_AMOUNT_DISCOUNT]: 'Soustraire un montant fixe en MAD',
        [PromotionType.BEST_PRICE]: 'Définir le prix maximum par unité',
        [PromotionType.AMOUNT_PER_UNIT]: 'Remise par unité achetée',
        [PromotionType.FREE_PROMO_UNIT]: 'Unités gratuites d\'un produit différent',
        [PromotionType.FLAT_AMOUNT_DISCOUNT]: 'Remise forfaitaire indépendante de la quantité',
        [PromotionType.REPLACE_PRICE]: 'Remplacer le prix unitaire par un prix spécial'
    };

    // Get threshold label based on breakpoint type
    const thresholdHeaderName = useMemo(() => {
        if (breakpointType === BreakpointType.VALUE_BASED) return 'Seuil (MAD)';
        if (breakpointType === BreakpointType.QUANTITY_BASED) return 'Seuil (Quantité)';
        if (breakpointType === BreakpointType.PROMO_UNIT_BASED) return 'Seuil (Unités Promo)';
        return 'Seuil';
    }, [breakpointType]);

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: 'Palier',
            valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
            width: 70,
            pinned: 'left',
            headerClass: 'font-semibold'
        },
        {
            field: 'promo_type',
            headerName: 'Type de Remise',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: (params: any) => {
                return {
                    values: promoTypeOptions,
                    formatValue: (value: any) => {
                        const type = Number(value) as PromotionType;
                        return promoTypeLabels[type] || `Type ${type}`;
                    }
                };
            },
            valueFormatter: (params) => {
                const type = params.value as PromotionType;
                return promoTypeLabels[type] || `Type ${type}`;
            },
            valueParser: (params) => {
                return Number(params.newValue);
            },
            flex: 1,
            minWidth: 180,
            tooltipValueGetter: (params) => {
                const type = params.value as PromotionType;
                return promoTypeDescriptions[type] || '';
            },
            cellRenderer: (params: any) => {
                const type = params.value as PromotionType;
                const label = promoTypeLabels[type] || `Type ${type}`;
                return (
                    <div className="flex flex-col h-full justify-center py-1">
                        <span className="font-medium text-sm">{label}</span>
                        <span className="text-xs text-gray-400 truncate">{promoTypeDescriptions[type] || ''}</span>
                    </div>
                );
            }
        },
        {
            field: 'minimum_value',
            headerName: thresholdHeaderName,
            editable: true,
            cellEditor: 'agNumberCellEditor',
            width: 140,
            cellEditorParams: {
                min: 0,
                precision: breakpointType === BreakpointType.VALUE_BASED ? 2 : 0
            },
            valueFormatter: (params: any) => {
                if (params.value === null || params.value === undefined || params.value === '') return '';
                if (breakpointType === BreakpointType.VALUE_BASED) {
                    return `${Number(params.value).toFixed(2)} MAD`;
                }
                if (breakpointType === BreakpointType.QUANTITY_BASED) {
                    return `${Number(params.value)} unités`;
                }
                if (breakpointType === BreakpointType.PROMO_UNIT_BASED) {
                    return `${Number(params.value)} unités promo`;
                }
                return String(params.value);
            },
            valueParser: (params) => {
                const value = params.newValue;
                if (value === null || value === undefined || value === '') return 0;
                return Number(value);
            },
            tooltipValueGetter: () => {
                if (breakpointType === BreakpointType.VALUE_BASED) {
                    return 'Montant minimum total en MAD requis pour déclencher ce palier de remise';
                }
                if (breakpointType === BreakpointType.QUANTITY_BASED) {
                    return 'Quantité minimum d\'unités requise pour déclencher ce palier de remise';
                }
                if (breakpointType === BreakpointType.PROMO_UNIT_BASED) {
                    return 'Nombre minimum d\'unités promo standardisées requises pour déclencher ce palier';
                }
                return 'Seuil minimum requis pour déclencher ce palier de remise';
            }
        },
        {
            field: 'amount',
            headerName: 'Valeur Remise',
            editable: true,
            cellEditor: 'agNumberCellEditor',
            width: 160,
            cellEditorParams: {
                min: 0,
                precision: 2
            },
            valueFormatter: (params: any) => {
                if (!params.data || params.value === null || params.value === undefined || params.value === '') return '';
                const type = params.data.promo_type;
                const value = Number(params.value);
                
                if (type === PromotionType.PERCENTAGE_DISCOUNT) {
                    return `${value}%`;
                }
                if (type === PromotionType.BEST_PRICE || type === PromotionType.REPLACE_PRICE) {
                    return `${value.toFixed(2)} MAD/unité`;
                }
                if (type === PromotionType.AMOUNT_PER_UNIT) {
                    return `${value.toFixed(2)} MAD/unité`;
                }
                if (type === PromotionType.FIXED_AMOUNT_DISCOUNT || type === PromotionType.FLAT_AMOUNT_DISCOUNT) {
                    return `${value.toFixed(2)} MAD`;
                }
                if (type === PromotionType.FREE_PROMO_UNIT) {
                    return `${value} unité(s) gratuite(s)`;
                }
                return `${value}`;
            },
            valueParser: (params) => {
                const value = params.newValue;
                if (value === null || value === undefined || value === '') return 0;
                return Number(value);
            },
            tooltipValueGetter: (params: any) => {
                if (!params.data) return '';
                const type = params.data.promo_type;
                const descriptions: Record<number, string> = {
                    [PromotionType.PERCENTAGE_DISCOUNT]: 'Valeur en pourcentage (ex: 10 = 10% de remise)',
                    [PromotionType.FIXED_AMOUNT_DISCOUNT]: 'Montant fixe de remise en MAD soustrait du total',
                    [PromotionType.BEST_PRICE]: 'Prix maximum par unité en MAD (le produit ne coûtera pas plus cher)',
                    [PromotionType.AMOUNT_PER_UNIT]: 'Montant de remise par unité achetée en MAD',
                    [PromotionType.FREE_PROMO_UNIT]: 'Nombre d\'unités gratuites d\'un produit différent',
                    [PromotionType.FLAT_AMOUNT_DISCOUNT]: 'Montant forfaitaire de remise en MAD (indépendant de la quantité)',
                    [PromotionType.REPLACE_PRICE]: 'Nouveau prix par unité en MAD (remplace le prix original)'
                };
                return descriptions[type] || 'Valeur de la remise selon le type sélectionné';
            },
        },
        {
            field: 'repeating',
            headerName: 'Répéter',
            editable: true,
            cellRenderer: (params: any) => (
                <div className="flex items-center justify-center h-full">
                    <input 
                        type="checkbox" 
                        checked={params.value || false} 
                        readOnly 
                        className="cursor-pointer"
                    />
                </div>
            ),
            width: 110,
            tooltipValueGetter: () => 'Si activé, la remise s\'applique plusieurs fois selon le nombre de fois que le seuil est atteint'
        },
        {
            headerName: 'Actions',
            cellRenderer: (params: any) => (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        remove(params.node.rowIndex);
                    }}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                    title="Supprimer ce palier de remise"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            ),
            width: 90,
            sortable: false,
            filter: false,
            pinned: 'right'
        }
    ], [promoTypeOptions, promoTypeLabels, promoTypeDescriptions, remove, breakpointType, thresholdHeaderName]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: true,
        resizable: true,
        headerClass: 'text-xs font-semibold text-gray-700 bg-gray-50'
    }), []);

    const handleCellValueChanged = (event: any) => {
        if (lineIndex === null) return;
        const { rowIndex, data } = event;
        
        // Ensure numeric fields are properly converted
        const updatedData = {
            ...data,
            promo_type: Number(data.promo_type),
            minimum_value: Number(data.minimum_value) || 0,
            amount: Number(data.amount) || 0,
            repeating: Boolean(data.repeating)
        };
        
        update(rowIndex, updatedData);
        
        // Force grid refresh to show updated values
        if (event.api) {
            setTimeout(() => {
                event.api.refreshCells({ force: true });
            }, 0);
        }
    };

    const addDetail = () => {
        append({
            promo_type: PromotionType.PERCENTAGE_DISCOUNT,
            minimum_value: 0,
            amount: 0,
            repeating: false
        } as PromotionLineDetail);
    };

    if (lineIndex === null) {
        return (
            <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-white text-gray-400">
                <div className="text-center p-6">
                    <Box className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm font-medium text-gray-500 mb-1">Aucune Règle Sélectionnée</p>
                    <p className="text-xs text-gray-400">Sélectionnez une règle de promotion ci-dessus pour configurer les paliers de remise</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center bg-gradient-to-r from-blue-50 to-white px-4 py-3 border-b border-gray-200">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">Paliers de Remise</h3>
                        {breakpointType === BreakpointType.VALUE_BASED && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">Seuils basés sur valeur (MAD)</span>
                        )}
                        {breakpointType === BreakpointType.QUANTITY_BASED && (
                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">Seuils basés sur quantité</span>
                        )}
                        {breakpointType === BreakpointType.PROMO_UNIT_BASED && (
                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">Seuils basés sur unités promo</span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        {breakpointType === BreakpointType.VALUE_BASED && 
                            'Les seuils sont calculés sur le montant total d\'achat en MAD. La colonne "Seuil" affiche le montant minimum requis.'}
                        {breakpointType === BreakpointType.QUANTITY_BASED && 
                            'Les seuils sont calculés sur le nombre d\'unités achetées. La colonne "Seuil" affiche la quantité minimum requise.'}
                        {breakpointType === BreakpointType.PROMO_UNIT_BASED && 
                            'Les seuils sont calculés sur des unités promo standardisées. La colonne "Seuil" affiche le nombre d\'unités promo minimum requises.'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={addDetail}
                    className="text-xs flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-sm ml-4"
                >
                    <Plus className="w-3 h-3" /> Ajouter un Palier
                </button>
            </div>
            <div className="flex-1 ag-theme-balham" style={{ minHeight: '200px' }}>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onCellValueChanged={handleCellValueChanged}
                    stopEditingWhenCellsLoseFocus={true}
                    rowHeight={60}
                />
            </div>
        </div>
    );
};
