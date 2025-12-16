import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { settingsApi } from '@/services/api/settingsApi';
import { Loader2, Save } from 'lucide-react';

interface BusinessSettingsForm {
    business_based_on: 'commission' | 'subscription';
    commission: number;
    commission_type: 'percentage' | 'fixed';
    commission_charge: 'per_order' | 'per_product';
    shop_type: 'multi' | 'single';
    shop_pos: boolean;
    shop_register: boolean;
    new_product_approval: boolean;
    update_product_approval: boolean;
    cash_on_delivery: boolean;
    online_payment: boolean;
    default_delivery_charge: number;
    return_order_within_days: number;
}

export const BusinessSettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { register, handleSubmit, setValue, watch } = useForm<BusinessSettingsForm>();

    const businessType = watch('business_based_on');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await settingsApi.getBusinessSettings();
            if (response.success) {
                // Bulk set values
                const data = response.data;
                (Object.keys(data) as Array<keyof BusinessSettingsForm>).forEach(key => {
                    setValue(key, data[key]);
                });
            }
        } catch (error) {
            toast.error('Failed to load business settings');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: BusinessSettingsForm) => {
        setSaving(true);
        try {
            await settingsApi.updateBusinessSettings(data);
            toast.success('Business settings updated');
        } catch (error) {
            toast.error('Failed to update business settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sage-600" /></div>;

    const Toggle = ({ label, name }: { label: string, name: keyof BusinessSettingsForm }) => (
        <div className="flex items-center justify-between p-4 bg-white rounded border border-gray-100 hover:border-gray-300 transition">
            <span className="font-medium text-slate-700">{label}</span>
            <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" {...register(name)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sage-600"></div>
            </label>
        </div>
    );

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-500 max-w-5xl">
            {/* Business Model */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Business Model</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="p-4 bg-white rounded border border-slate-200">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Business Based On</label>
                        <select {...register('business_based_on')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500">
                            <option value="commission">Commission</option>
                            <option value="subscription">Subscription</option>
                        </select>
                    </div>
                </div>

                {businessType === 'commission' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Commission Rate</label>
                            <input type="number" step="0.01" {...register('commission')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Type</label>
                            <select {...register('commission_type')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500">
                                <option value="percentage">Percentage (%)</option>
                                <option value="fixed">Fixed Amount</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Charge On</label>
                            <select {...register('commission_charge')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500">
                                <option value="per_order">Per Order</option>
                                <option value="per_product">Per Product</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Shop & Product Settings */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Shop & Product Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Toggle label="Enable POS System" name="shop_pos" />
                    <Toggle label="Direct Registration" name="shop_register" />
                    <Toggle label="New Product Approval Required" name="new_product_approval" />
                    <Toggle label="Product Update Approval Required" name="update_product_approval" />
                </div>
            </div>

            {/* Payment & Delivery */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Payment & Logistics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <Toggle label="Cash On Delivery" name="cash_on_delivery" />
                    <Toggle label="Online Payment" name="online_payment" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Default Delivery Charge</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input type="number" step="0.01" {...register('default_delivery_charge')} className="w-full pl-8 p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Return Window (Days)</label>
                        <input type="number" {...register('return_order_within_days')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-sage-600 text-white px-6 py-2 rounded-lg hover:bg-sage-700 transition disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>
        </form>
    );
};
