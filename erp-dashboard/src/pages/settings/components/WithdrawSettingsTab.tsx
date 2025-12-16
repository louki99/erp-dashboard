import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { settingsApi } from '@/services/api/settingsApi';
import { Loader2, Save, Wallet } from 'lucide-react';

interface WithdrawSettingsForm {
    min_withdraw: number;
    max_withdraw: number;
    withdraw_request: number;
}

export const WithdrawSettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { register, handleSubmit, setValue } = useForm<WithdrawSettingsForm>();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await settingsApi.getWithdrawSettings();
            if (response.success) {
                setValue('min_withdraw', response.data.min_withdraw);
                setValue('max_withdraw', response.data.max_withdraw);
                setValue('withdraw_request', response.data.withdraw_request);
            }
        } catch (error) {
            toast.error('Failed to load withdraw settings');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: WithdrawSettingsForm) => {
        setSaving(true);
        try {
            await settingsApi.updateWithdrawSettings(data);
            toast.success('Withdraw settings updated');
        } catch (error) {
            toast.error('Failed to update withdraw settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sage-600" /></div>;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-500 max-w-2xl">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="flex items-center gap-3 border-b mb-6 pb-2">
                    <div className="bg-sage-100 p-2 rounded-full text-sage-600">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-800">Withdrawal Configuration</h3>
                </div>

                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Minimum Withdrawal Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input type="number" step="0.01" {...register('min_withdraw')} className="w-full pl-8 p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                        </div>
                        <p className="text-xs text-gray-500">The minimum amount a partner can request to withdraw.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Maximum Withdrawal Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input type="number" step="0.01" {...register('max_withdraw')} className="w-full pl-8 p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                        </div>
                        <p className="text-xs text-gray-500">The maximum amount a partner can request in a single withdrawal.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Withdrawal Request Limit (Per Day)</label>
                        <input type="number" {...register('withdraw_request')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500" />
                        <p className="text-xs text-gray-500">Maximum number of withdrawal requests allowed per day per partner.</p>
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
