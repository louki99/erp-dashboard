import { useFieldArray, useFormContext } from 'react-hook-form';
import type { Promotion } from '@/types/promotion.types';
import { PromotionType } from '@/types/promotion.types';
import { Plus, Trash2, Gift, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    index: number; // Line index
    control: any;
    register: any;
}

export const PromotionDetailsEditor = ({ index, control, register }: Props) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `lines.${index}.details`
    });

    const { watch } = useFormContext();
    const breakpointType = watch('breakpoint_type'); // Need to know if Value or Qty based

    const addDetail = () => {
        append({
            promo_type: PromotionType.PERCENTAGE_DISCOUNT,
            minimum_value: 0,
            amount: 0,
            repeating: false
        });
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Gift className="w-4 h-4 text-sage-600" />
                    Tiers & Rewards
                </label>
                <button
                    type="button"
                    onClick={addDetail}
                    className="text-xs flex items-center gap-1 text-sage-600 hover:text-sage-700 font-medium"
                >
                    <Plus className="w-3 h-3" />
                    Add Tier
                </button>
            </div>

            <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium border-b">
                        <tr>
                            <th className="px-3 py-2 w-32">Min. {breakpointType === 2 ? 'Qty' : 'Value'}</th>
                            <th className="px-3 py-2">Reward Type</th>
                            <th className="px-3 py-2 w-32">Amount</th>
                            <th className="px-3 py-2 w-24 text-center">Repeat</th>
                            <th className="px-3 py-2 w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {fields.map((field, detailIndex) => (
                            <tr key={field.id} className="group hover:bg-gray-50">
                                <td className="p-2">
                                    <input
                                        type="number"
                                        {...register(`lines.${index}.details.${detailIndex}.minimum_value`, { required: true, valueAsNumber: true })}
                                        className="w-full p-1 border rounded focus:ring-sage-500 outline-none text-right"
                                        placeholder="0"
                                    />
                                </td>
                                <td className="p-2">
                                    <select
                                        {...register(`lines.${index}.details.${detailIndex}.promo_type`, { valueAsNumber: true })}
                                        className="w-full p-1 border rounded focus:ring-sage-500 outline-none"
                                    >
                                        <option value={PromotionType.PERCENTAGE_DISCOUNT}>Percentage Discount (%)</option>
                                        <option value={PromotionType.FIXED_AMOUNT_DISCOUNT}>Fixed Amount Discount (MAD)</option>
                                        <option value={PromotionType.BEST_PRICE}>Best Price (Max Unit Price)</option>
                                        <option value={PromotionType.AMOUNT_PER_UNIT}>Discount Per Unit</option>
                                        <option value={PromotionType.FREE_PROMO_UNIT}>Free Promo Units</option>
                                        <option value={PromotionType.FLAT_AMOUNT_DISCOUNT}>Flat Amount (One-time)</option>
                                        <option value={PromotionType.REPLACE_PRICE}>Replace Unit Price</option>
                                    </select>
                                </td>
                                <td className="p-2">
                                    <input
                                        type="number"
                                        step="0.01"
                                        {...register(`lines.${index}.details.${detailIndex}.amount`, { required: true, valueAsNumber: true })}
                                        className="w-full p-1 border rounded focus:ring-sage-500 outline-none text-right"
                                        placeholder="0"
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <input
                                        type="checkbox"
                                        {...register(`lines.${index}.details.${detailIndex}.repeating`)}
                                        className="rounded text-sage-600 focus:ring-sage-500"
                                    />
                                </td>
                                <td className="p-2 text-center">
                                    <button
                                        type="button"
                                        onClick={() => remove(detailIndex)}
                                        className="text-gray-300 hover:text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {fields.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-4 text-center text-gray-400 text-xs italic">
                                    No tiers defined. Click "Add Tier" to set rewards.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <p className="text-xs text-gray-400">
                * Defines the threshold to trigger a reward. Tiers should be ordered by value.
            </p>
        </div>
    );
};
