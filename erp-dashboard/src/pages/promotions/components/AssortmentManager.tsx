import { useState, useMemo } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import {
    ClientSideRowModelModule,
    ModuleRegistry,
    ValidationModule,
    RowSelectionModule,
    TextEditorModule,
    NumberEditorModule
} from 'ag-grid-community';
import type { Promotion, PromotionLineAssortment } from '@/types/promotion.types';
import { AssortmentType } from '@/types/promotion.types';
import { Plus, Trash2, Search, X, Package, AlertCircle } from 'lucide-react';
import { ProductSelectionModal } from './ProductSelectionModal';
import { ProductFamilySelectionDrawer } from './ProductFamilySelectionDrawer';

ModuleRegistry.registerModules([
    ClientSideRowModelModule,
    ValidationModule,
    RowSelectionModule,
    TextEditorModule,
    NumberEditorModule
]);

interface AssortmentManagerProps {
    lineIndex: number | null;
}

export const AssortmentManager = ({ lineIndex }: AssortmentManagerProps) => {
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [isFamilyDrawerOpen, setIsFamilyDrawerOpen] = useState(false);
    const [activeAssortmentIndex, setActiveAssortmentIndex] = useState<number | null>(null);

    const { control, watch, setValue } = useFormContext<Promotion>();
    
    const lines = watch('lines');
    const currentLine = lineIndex !== null ? lines[lineIndex] : null;
    
    // Always call useFieldArray, even if lineIndex is null (use 0 as fallback)
    const { fields, append, remove, update } = useFieldArray({
        control,
        name: `lines.${lineIndex ?? 0}.assortments` as const
    });

    const assortmentType = currentLine?.assortment_type;
    const minimumCartAmount = currentLine?.minimum_cart_amount;
    
    // Early return AFTER all hooks
    if (lineIndex === null || !currentLine) {
        return (
            <div className="h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-center p-8">
                    <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm text-gray-500">
                        Sélectionnez une règle de promotion pour gérer ses conditions d'assortiment
                    </p>
                </div>
            </div>
        );
    }

    const rowData = useMemo(() => 
        fields.map((field, index) => ({ ...field, index })), 
        [fields]
    );

    const handleProductSelect = (code: string) => {
        if (activeAssortmentIndex !== null && lineIndex !== null) {
            const currentAssortment = fields[activeAssortmentIndex];
            update(activeAssortmentIndex, {
                ...currentAssortment,
                based_on_product: true,
                product_code: code
            });
            setIsProductModalOpen(false);
            setActiveAssortmentIndex(null);
        }
    };

    const handleFamilySelect = (code: string) => {
        if (activeAssortmentIndex !== null && lineIndex !== null) {
            const currentAssortment = fields[activeAssortmentIndex];
            update(activeAssortmentIndex, {
                ...currentAssortment,
                based_on_product: false,
                product_code: code
            });
            setIsFamilyDrawerOpen(false);
            setActiveAssortmentIndex(null);
        }
    };

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            headerName: '#',
            valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
            width: 60,
            sortable: false
        },
        {
            headerName: 'Type',
            field: 'based_on_product',
            editable: true,
            cellEditor: 'agSelectCellEditor',
            cellEditorParams: {
                values: [true, false],
                formatValue: (value: boolean) => value ? 'Produit' : 'Famille'
            },
            valueFormatter: (params) => params.value ? 'Produit' : 'Famille',
            width: 120
        },
        {
            headerName: 'Code Produit/Famille',
            field: 'product_code',
            editable: false,
            flex: 1,
            minWidth: 200,
            cellRenderer: (params: any) => {
                const hasValue = params.value;
                const isProduct = params.data.based_on_product;
                
                return (
                    <div className="flex items-center justify-between w-full h-full group">
                        <span className="truncate font-mono text-xs text-gray-900">
                            {params.value || 'Cliquez pour sélectionner'}
                        </span>
                        <div className="flex items-center gap-1">
                            {hasValue && (
                                <button
                                    type="button"
                                    className="p-1 hover:bg-red-50 rounded transition-colors"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const rowIndex = params.node.rowIndex;
                                        const current = fields[rowIndex];
                                        update(rowIndex, {
                                            ...current,
                                            product_code: ''
                                        });
                                    }}
                                    title="Effacer"
                                >
                                    <X className="w-3 h-3 text-red-600" />
                                </button>
                            )}
                            <button
                                type="button"
                                className="p-1 hover:bg-sage-50 rounded transition-colors"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveAssortmentIndex(params.node.rowIndex);
                                    if (isProduct) {
                                        setIsProductModalOpen(true);
                                    } else {
                                        setIsFamilyDrawerOpen(true);
                                    }
                                }}
                                title="Sélectionner"
                            >
                                <Search className="w-3 h-3 text-sage-600" />
                            </button>
                        </div>
                    </div>
                );
            }
        },
        {
            headerName: 'Quantité Minimum',
            field: 'minimum',
            editable: true,
            cellEditor: 'agNumberCellEditor',
            cellEditorParams: {
                min: 1,
                precision: 0
            },
            width: 150,
            valueFormatter: (params) => params.value ? `${params.value}` : '0'
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
                                remove(params.node.rowIndex);
                            }}
                            title="Supprimer"
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
    ], [fields, update, remove]);

    const defaultColDef = useMemo<ColDef>(() => ({
        sortable: true,
        filter: false,
        resizable: true
    }), []);

    const handleCellValueChanged = (event: any) => {
        const { rowIndex, data } = event;
        if (rowIndex !== null && rowIndex !== undefined) {
            const updatedAssortment: PromotionLineAssortment = {
                ...data,
                minimum: Number(data.minimum) || 1
            };
            update(rowIndex, updatedAssortment);
        }
    };

    const addNewAssortment = () => {
        append({
            based_on_product: true,
            product_code: '',
            minimum: 1
        } as PromotionLineAssortment);
    };

    const showAssortmentGrid = assortmentType === AssortmentType.MULTIPLE_AND || assortmentType === AssortmentType.BOTH;
    const showCartAmount = assortmentType === AssortmentType.CART_AMOUNT || assortmentType === AssortmentType.BOTH;

    return (
        <div className="space-y-4">
            {/* Assortment Type Selector */}
            <div className="bg-white p-4 rounded-lg border shadow-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type de Condition d'Assortiment
                </label>
                <select
                    value={assortmentType ?? AssortmentType.NONE}
                    onChange={(e) => {
                        const newType = Number(e.target.value) as AssortmentType;
                        const updatedLine = { ...currentLine, assortment_type: newType };
                        
                        // Clear cart amount if switching away from CART_AMOUNT or BOTH
                        if (newType !== AssortmentType.CART_AMOUNT && newType !== AssortmentType.BOTH) {
                            updatedLine.minimum_cart_amount = undefined;
                        }
                        
                        setValue(`lines.${lineIndex}`, updatedLine, { shouldDirty: true });
                    }}
                    className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none"
                >
                    <option value={AssortmentType.NONE}>Aucune Condition</option>
                    <option value={AssortmentType.MULTIPLE_AND}>Produits Multiples (ET)</option>
                    <option value={AssortmentType.CART_AMOUNT}>Montant Panier Minimum</option>
                    <option value={AssortmentType.BOTH}>Les Deux (Produits ET Montant)</option>
                </select>
                <p className="text-xs text-gray-500 mt-2">
                    {assortmentType === AssortmentType.NONE && "Aucune condition d'assortiment requise"}
                    {assortmentType === AssortmentType.MULTIPLE_AND && "Le client doit avoir X unités du Produit A ET Y unités du Produit B"}
                    {assortmentType === AssortmentType.CART_AMOUNT && "Le panier doit atteindre un montant minimum"}
                    {assortmentType === AssortmentType.BOTH && "Le client doit avoir les produits requis ET le panier doit atteindre le montant minimum"}
                </p>
            </div>

            {/* Minimum Cart Amount */}
            {showCartAmount && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <label className="block text-sm font-medium text-blue-900 mb-2">
                        Montant Minimum du Panier (MAD)
                    </label>
                    <input
                        type="number"
                        value={minimumCartAmount ?? ''}
                        onChange={(e) => {
                            const value = e.target.value ? Number(e.target.value) : undefined;
                            const updatedLine = { ...currentLine, minimum_cart_amount: value };
                            setValue(`lines.${lineIndex}`, updatedLine, { shouldDirty: true });
                        }}
                        className="w-full p-2 border border-blue-300 rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
                        placeholder="ex: 1000"
                        min="0"
                        step="0.01"
                    />
                    <p className="text-xs text-blue-700 mt-1">
                        Le montant total du panier doit être supérieur ou égal à cette valeur
                    </p>
                </div>
            )}

            {/* Assortment Grid */}
            {showAssortmentGrid && (
                <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                    <div className="flex justify-between items-center bg-gradient-to-r from-purple-50 to-white px-4 py-3 border-b">
                        <div>
                            <h4 className="text-sm font-semibold text-gray-900">Produits/Familles Requis</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Définissez les produits ou familles que le client doit acheter (condition ET)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={addNewAssortment}
                            className="text-xs flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors shadow-sm"
                        >
                            <Plus className="w-3 h-3" /> Ajouter
                        </button>
                    </div>
                    
                    <div className="ag-theme-balham" style={{ height: '250px' }}>
                        <AgGridReact
                            rowData={rowData}
                            columnDefs={columnDefs}
                            defaultColDef={defaultColDef}
                            onCellValueChanged={handleCellValueChanged}
                            stopEditingWhenCellsLoseFocus={true}
                        />
                    </div>

                    {fields.length === 0 && (
                        <div className="p-8 text-center bg-gray-50">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                            <p className="text-sm text-gray-500 mb-3">
                                Aucun produit/famille requis défini
                            </p>
                            <button
                                type="button"
                                onClick={addNewAssortment}
                                className="text-xs inline-flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                            >
                                <Plus className="w-3 h-3" /> Ajouter le premier produit
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Info Box */}
            {assortmentType !== AssortmentType.NONE && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-amber-800">
                            <p className="font-semibold mb-1">Important :</p>
                            <ul className="list-disc list-inside space-y-0.5">
                                {showAssortmentGrid && (
                                    <li>Toutes les conditions de produits doivent être satisfaites (logique ET)</li>
                                )}
                                {showCartAmount && (
                                    <li>Le montant minimum du panier doit être atteint</li>
                                )}
                                {assortmentType === AssortmentType.BOTH && (
                                    <li>Les deux conditions (produits ET montant) doivent être remplies simultanément</li>
                                )}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            <ProductSelectionModal
                isOpen={isProductModalOpen}
                onClose={() => {
                    setIsProductModalOpen(false);
                    setActiveAssortmentIndex(null);
                }}
                onSelect={handleProductSelect}
            />
            <ProductFamilySelectionDrawer
                isOpen={isFamilyDrawerOpen}
                onClose={() => {
                    setIsFamilyDrawerOpen(false);
                    setActiveAssortmentIndex(null);
                }}
                onSelect={handleFamilySelect}
                currentCode={activeAssortmentIndex !== null ? fields[activeAssortmentIndex]?.product_code : undefined}
            />
        </div>
    );
};
