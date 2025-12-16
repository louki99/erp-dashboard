import { useState, useEffect } from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import { BreakpointType } from '@/types/promotion.types';
import { ArrowLeft, Save, Loader2, Layers, Users, CreditCard, Box, Calendar } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { SageTabs } from '@/components/common/SageTabs';
import { PromotionRuleEditor } from './PromotionRuleEditor';

interface PromotionFormProps {
    isEdit?: boolean;
}

export const PromotionForm = ({ isEdit = false }: PromotionFormProps) => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(isEdit);
    const [saving, setSaving] = useState(false);

    const methods = useForm<Promotion>({
        defaultValues: {
            is_closed: false,
            payment_term_dependent: false,
            breakpoint_type: BreakpointType.VALUE_BASED,
            lines: [],
            partner_families: [],
            payment_terms: [],
            sequence: 10
        }
    });

    const { register, handleSubmit, setValue, watch, formState: { errors } } = methods;

    // Watch fields for dynamic UI
    const paymentTermDependent = watch('payment_term_dependent');

    useEffect(() => {
        if (isEdit && id) {
            loadPromotion(Number(id));
        }
    }, [id, isEdit]);

    const loadPromotion = async (promoId: number) => {
        setLoading(true);
        try {
            const data = await promotionsApi.getPromotion(promoId);
            const promo = data.promotion;
            // Reset form with data
            methods.reset({
                ...promo,
                start_date: promo.start_date ? promo.start_date.split('T')[0] : '',
                end_date: promo.end_date ? promo.end_date.split('T')[0] : ''
            });
        } catch (error) {
            toast.error('Failed to load promotion details');
            navigate('/promotions');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: Promotion) => {
        setSaving(true);
        try {
            // Ensure numeric values
            data.sequence = Number(data.sequence);

            // Validate Dates
            if (new Date(data.end_date) <= new Date(data.start_date)) {
                toast.error('End date must be after start date');
                setSaving(false);
                return;
            }

            if (isEdit && id) {
                await promotionsApi.updatePromotion(Number(id), data);
                toast.success('Promotion updated successfully');
            } else {
                await promotionsApi.createPromotion(data);
                toast.success('Promotion created successfully');
            }
            navigate('/promotions');
        } catch (error) {
            console.error(error);
            toast.error('Failed to save promotion');
        } finally {
            setSaving(false);
        }
    };

    // Tabs configuration
    const tabs = [
        { id: 'general', label: 'General Info', icon: Layers, content: null },
        { id: 'rules', label: 'Rules & Discounts', icon: Box, content: null },
        { id: 'partners', label: 'Targeting', icon: Users, content: null },
        { id: 'payment', label: 'Payment Terms', icon: CreditCard, content: null },
    ];

    if (loading) {
        return (
            <MasterLayout
                leftContent={
                    <div className="bg-white h-full p-6 border-r border-gray-200">
                        <div className="animate-pulse space-y-4">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex items-center justify-center bg-slate-50">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                    </div>
                }
            />
        );
    }

    return (
        <MasterLayout
            leftContent={
                <div className="bg-white h-full p-6 border-r border-gray-200">
                    <button onClick={() => navigate('/promotions')} className="flex items-center gap-2 text-gray-500 mb-6 hover:text-sage-700">
                        <ArrowLeft className="w-4 h-4" /> Back to List
                    </button>
                    <div className="mb-6">
                        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Promotion' : 'New Promotion'}</h1>
                        <p className="text-sm text-gray-500 mt-1">Configure promotion rules, eligibility, and validity periods.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                            <h3 className="text-sm font-semibold text-yellow-800 mb-1">Status</h3>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-yellow-700">Is Closed</span>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" {...register('is_closed')} />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-sage-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sage-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <FormProvider {...methods}>
                    <form onSubmit={handleSubmit(onSubmit)} className="h-full flex flex-col bg-slate-50">
                        <div className="bg-white border-b px-6 py-2">
                            <SageTabs
                                tabs={tabs}
                                activeTabId={activeTab}
                                onTabChange={setActiveTab}
                            />
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-5xl mx-auto space-y-6">

                                {/* General Tab */}
                                {activeTab === 'general' && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="col-span-2 md:col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Promotion Name <span className="text-red-500">*</span></label>
                                                <input {...register('name', { required: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" placeholder="e.g. Winter Sale 2024" />
                                                {errors.name && <span className="text-xs text-red-500">Required</span>}
                                            </div>
                                            <div className="col-span-2 md:col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Promotion Code <span className="text-red-500">*</span></label>
                                                <input {...register('code', { required: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none uppercase font-mono" placeholder="PROMO-XXX" />
                                            </div>

                                            <div className="col-span-2 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Description</label>
                                                <textarea {...register('description')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" rows={3} />
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Start Date</label>
                                                <div className="relative">
                                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input type="date" {...register('start_date')} className="w-full pl-9 p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" />
                                                </div>
                                            </div>
                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">End Date</label>
                                                <div className="relative">
                                                    <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                                    <input type="date" {...register('end_date')} className="w-full pl-9 p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" />
                                                </div>
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Priority (Sequence)</label>
                                                <input type="number" {...register('sequence')} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none" placeholder="10" />
                                                <p className="text-xs text-gray-400">Lower number = Higher priority</p>
                                            </div>

                                            <div className="col-span-1 space-y-2">
                                                <label className="text-sm font-medium text-gray-700">Breakpoint Type</label>
                                                <select {...register('breakpoint_type', { valueAsNumber: true })} className="w-full p-2 border rounded focus:ring-sage-500 focus:border-sage-500 outline-none">
                                                    <option value={BreakpointType.VALUE_BASED}>Value Based (Amount in MAD)</option>
                                                    <option value={BreakpointType.QUANTITY_BASED}>Quantity Based (Units)</option>
                                                    <option value={BreakpointType.PROMO_UNIT_BASED}>Unique Promo Unit</option>
                                                </select>
                                                <p className="text-xs text-gray-400">Determines how thresholds (min value/qty) are calculated</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Rules Tab */}
                                {activeTab === 'rules' && (
                                    <div className="animate-in fade-in">
                                        <PromotionRuleEditor />
                                    </div>
                                )}

                                {/* Partners Tab */}
                                {activeTab === 'partners' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <div className="bg-white p-6 rounded-lg border shadow-sm">
                                            <h3 className="text-lg font-medium text-gray-900 mb-4">Partner Eligibility</h3>
                                            <p className="text-sm text-gray-500 mb-4">Select which partner families this promotion applies to. Leave empty for "All Partners".</p>
                                            <div className="p-4 bg-gray-50 rounded text-center text-gray-400 border border-dashed text-sm">
                                                (Partner Families Selection would go here - Requiring PartnerFamily API)
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Tab */}
                                {activeTab === 'payment' && (
                                    <div className="space-y-6 animate-in fade-in">
                                        <div className="items-center mb-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" {...register('payment_term_dependent')} className="rounded text-sage-600 focus:ring-sage-500" />
                                                <span className="font-medium text-gray-900">Payment Term Dependent</span>
                                            </label>
                                            <p className="text-sm text-gray-500 ml-6 mt-1">If enabled, this promotion will only trigger for specific payment terms.</p>
                                        </div>

                                        {paymentTermDependent && (
                                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                                <h3 className="text-lg font-medium text-gray-900 mb-4">Allowed Payment Terms</h3>
                                                <div className="p-4 bg-gray-50 rounded text-center text-gray-400 border border-dashed text-sm">
                                                    (Payment Terms Selection would go here)
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>
                        </div>

                        <div className="bg-white border-t p-4 flex justify-end gap-3 z-10">
                            <button
                                type="button"
                                onClick={() => navigate('/promotions')}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-sage-600 text-white rounded-md hover:bg-sage-700 transition disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Save Promotion
                            </button>
                        </div>
                    </form>
                </FormProvider>
            }
        />
    );
};

