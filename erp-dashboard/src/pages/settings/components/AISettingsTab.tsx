import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { settingsApi } from '@/services/api/settingsApi';
import { Loader2, Save, Sparkles, AlertTriangle } from 'lucide-react';

interface AISettingsForm {
    product_description: string;
    page_description: string;
    blog_description: string;
}

export const AISettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [configStatus, setConfigStatus] = useState({ api_key_configured: false, organization_configured: false });
    const { register, handleSubmit, setValue } = useForm<AISettingsForm>();

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [promptsRes, configRes] = await Promise.all([
                settingsApi.getAIPrompts(),
                settingsApi.getAIConfigStatus()
            ]);

            if (promptsRes.success) {
                setValue('product_description', promptsRes.data.product_description);
                setValue('page_description', promptsRes.data.page_description);
                setValue('blog_description', promptsRes.data.blog_description);
            }
            if (configRes.success) {
                setConfigStatus(configRes.data);
            }
        } catch (error) {
            toast.error('Failed to load AI settings');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: AISettingsForm) => {
        setSaving(true);
        try {
            await settingsApi.updateAIPrompts(data);
            toast.success('AI prompts updated');
        } catch (error) {
            toast.error('Failed to update AI prompts');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sage-600" /></div>;

    return (
        <div className="animate-in fade-in duration-500 max-w-4xl space-y-8">
            {/* Status Card */}
            <div className={`p-4 rounded-lg border ${configStatus.api_key_configured ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-start gap-4">
                    {configStatus.api_key_configured ? (
                        <div className="bg-green-100 p-2 rounded-full text-green-600"><Sparkles className="w-5 h-5" /></div>
                    ) : (
                        <div className="bg-amber-100 p-2 rounded-full text-amber-600"><AlertTriangle className="w-5 h-5" /></div>
                    )}
                    <div>
                        <h4 className={`font-semibold ${configStatus.api_key_configured ? 'text-green-800' : 'text-amber-800'}`}>
                            {configStatus.api_key_configured ? 'AI Engine Configured' : 'AI Engine Not Configured'}
                        </h4>
                        <p className={`text-sm ${configStatus.api_key_configured ? 'text-green-700' : 'text-amber-700'}`}>
                            {configStatus.api_key_configured
                                ? 'Your OpenAI API key is set and ready to generate content.'
                                : 'Please configure your OpenAI API Key in the environment variables (OPENAI_API_KEY) to enable AI features.'}
                        </p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Generation Prompts</h3>
                    <p className="text-sm text-gray-500 mb-6">Customize the system prompts used by the AI to generate content. Use <code className="bg-gray-100 px-1 rounded text-xs">{'{name}'}</code> placeholders where appropriate.</p>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700 badge badge-neutral">Product Description Prompt</label>
                            <textarea {...register('product_description')} rows={4} className="w-full p-3 border rounded-lg focus:ring-sage-500 focus:border-sage-500 font-mono text-sm bg-white" placeholder="Write a compelling product description for {name}..." />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Page Meta Description Prompt</label>
                            <textarea {...register('page_description')} rows={3} className="w-full p-3 border rounded-lg focus:ring-sage-500 focus:border-sage-500 font-mono text-sm bg-white" />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Blog Post Prompt</label>
                            <textarea {...register('blog_description')} rows={5} className="w-full p-3 border rounded-lg focus:ring-sage-500 focus:border-sage-500 font-mono text-sm bg-white" />
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
        </div>
    );
};
