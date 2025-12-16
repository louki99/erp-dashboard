import { useFieldArray, useFormContext } from 'react-hook-form';
import { AssortmentType } from '@/types/promotion.types';
import { Plus, Trash2, Package } from 'lucide-react';

interface Props {
    index: number; // Line index
    control: any;
    register: any;
}

export const PromotionAssortmentEditor = ({ index, control, register }: Props) => {
    const { watch } = useFormContext();
    const assortmentType = watch(`lines.${index}.assortment_type`); // Watch this line's assortment type

    const { fields, append, remove } = useFieldArray({
        control,
        name: `lines.${index}.assortments`
    });

    const addAssortment = () => {
        append({
            based_on_product: true,
            product_code: '',
            minimum: 1
        });
    };

    if (assortmentType == AssortmentType.NONE || assortmentType == 0) {
        return null;
    }

    return (
        <div className="bg-orange-50 p-4 rounded-md border border-orange-100 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-orange-800 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Assortment Requirements
                </label>
                {(assortmentType == AssortmentType.MULTIPLE_AND || assortmentType == AssortmentType.BOTH) && (
                    <button
                        type="button"
                        onClick={addAssortment}
                        className="text-xs flex items-center gap-1 text-orange-700 hover:text-orange-800 font-medium"
                    >
                        <Plus className="w-3 h-3" />
                        Add Product Rule
                    </button>
                )}
            </div>

            {/* Minimum Cart Amount Input (For Type 2 or 3) */}
            {(assortmentType == AssortmentType.CART_AMOUNT || assortmentType == AssortmentType.BOTH) && (
                <div className="flex items-center gap-4 bg-white p-3 rounded border border-orange-200">
                    <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Minimum Cart Total (MAD):</label>
                    <input
                        type="number"
                        {...register(`lines.${index}.minimum_cart_amount`, { valueAsNumber: true })}
                        className="w-40 p-1 border rounded focus:ring-sage-500 outline-none"
                    />
                </div>
            )}

            {/* Product Mix List (For Type 1 or 3) */}
            {(assortmentType == AssortmentType.MULTIPLE_AND || assortmentType == AssortmentType.BOTH) && (
                <div className="space-y-2">
                    {fields.map((field, aIndex) => (
                        <div key={field.id} className="flex items-center gap-2 bg-white p-2 rounded border border-orange-200">
                            <select
                                {...register(`lines.${index}.assortments.${aIndex}.based_on_product`, {
                                    setValueAs: (v: string) => v === 'true'
                                })}
                                className="w-32 p-1 text-sm border rounded focus:ring-sage-500 outline-none"
                            >
                                <option value="true">Product</option>
                                <option value="false">Family</option>
                            </select>

                            <input
                                {...register(`lines.${index}.assortments.${aIndex}.product_code`, { required: true })}
                                className="flex-1 p-1 text-sm border rounded focus:ring-sage-500 outline-none"
                                placeholder="Code"
                            />

                            <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-500">Min:</span>
                                <input
                                    type="number"
                                    {...register(`lines.${index}.assortments.${aIndex}.minimum`, { required: true, valueAsNumber: true })}
                                    className="w-20 p-1 text-sm border rounded focus:ring-sage-500 outline-none text-right"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => remove(aIndex)}
                                className="text-gray-400 hover:text-red-500"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {fields.length === 0 && (
                        <div className="text-xs text-orange-600 italic text-center p-2">
                            Add products that MUST be in the cart for this promotion to apply.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
