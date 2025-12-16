
import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { settingsApi } from '@/services/api/settingsApi';
import type { GeneraleSetting } from '@/types/settings.types';
import { Loader2, Upload, Save, RefreshCw } from 'lucide-react';

export const GeneralSettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [logos, setLogos] = useState<{ [key: string]: string | null }>({});

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<GeneraleSetting>();

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await settingsApi.getGeneralSettings();
            if (response.success) {
                const setting = response.data.setting;
                Object.keys(setting).forEach((key) => {
                    setValue(key as keyof GeneraleSetting, setting[key as keyof GeneraleSetting]);
                });

                // Set initial preview images
                setLogos({
                    logo: setting.logo,
                    favicon: setting.favicon,
                    app_logo: setting.app_logo,
                    footer_logo: setting.footer_logo
                });
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
            toast.error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data: GeneraleSetting) => {
        setSaving(true);
        try {
            const formData = new FormData();

            // Append all text fields
            Object.keys(data).forEach(key => {
                if (!['logo', 'favicon', 'app_logo', 'footer_logo', 'footer_qrcode'].includes(key) && data[key as keyof GeneraleSetting] !== null) {
                    formData.append(key, String(data[key as keyof GeneraleSetting]));
                }
            });

            // Handle file uploads separately (keys would be passed from hidden file inputs if changed)
            // Note: In a real implementation, we'd need to track file objects. 
            // For now, let's assume direct text updates first, and file uploads via separate handler or improved form logic.
            // Simplified for this step: sending data as JSON is easier if no files changed, but API expects FormData for files.

            await settingsApi.updateGeneralSettings(formData);
            toast.success('Settings updated successfully');
            loadSettings(); // Reload to get potential server-side updates
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, key: string) => {
        const file = event.target.files?.[0];
        if (file) {
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setLogos(prev => ({ ...prev, [key]: reader.result as string }));
            };
            reader.readAsDataURL(file);

            // In a complete implementation, we would register this file to be sent with FormData
            // or upload immediately. For this template, we'll placeholder the upload logic.
            uploadFile(key, file);
        }
    };

    const uploadFile = async (key: string, file: File) => {
        const formData = new FormData();
        formData.append(key, file);
        try {
            await settingsApi.updateGeneralSettings(formData);
            toast.success(`${key} updated`);
        } catch (error) {
            toast.error(`Failed to upload ${key}`);
        }
    };

    if (loading) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sage-600" /></div>;
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-500">
            {/* Branding Section */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Branding</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">App Name</label>
                        <input {...register('name')} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">App Title</label>
                        <input {...register('title')} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
                    {['logo', 'favicon', 'app_logo', 'footer_logo'].map((key) => (
                        <div key={key} className="flex flex-col items-center space-y-3 p-4 bg-white rounded border border-dashed border-slate-300">
                            <span className="text-xs font-medium text-slate-500 uppercase">{key.replace('_', ' ')}</span>
                            <div className="h-16 flex items-center justify-center">
                                {logos[key] ? (
                                    <img src={logos[key]!} alt={key} className="max-h-full max-w-full object-contain" />
                                ) : (
                                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-300">
                                        <Upload className="w-6 h-6" />
                                    </div>
                                )}
                            </div>
                            <label className="cursor-pointer text-xs bg-secondary text-secondary-foreground px-3 py-1 rounded hover:opacity-80 transition">
                                Change
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, key)} />
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Contact Info */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Email</label>
                        <input {...register('email')} type="email" className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Phone</label>
                        <input {...register('mobile')} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700">Address</label>
                        <input {...register('address')} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                    </div>
                </div>
            </div>

            {/* Footer Settings */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Footer Settings</h3>
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" {...register('show_footer')} id="show_footer" className="rounded text-primary focus:ring-ring" />
                        <label htmlFor="show_footer" className="text-sm font-medium text-slate-700">Show Footer</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Footer Text</label>
                            <input {...register('footer_text')} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-700">Footer Description</label>
                            <textarea {...register('footer_description')} rows={3} className="w-full p-2 border rounded focus:ring-ring focus:border-primary outline-none transition-all" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save className="w-4 h-4" />}
                    Save Changes
                </button>
            </div>
        </form>
    );
};
