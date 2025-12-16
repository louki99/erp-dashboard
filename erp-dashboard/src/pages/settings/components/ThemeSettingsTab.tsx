import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { settingsApi } from '@/services/api/settingsApi';
import { useTheme } from '@/context/ThemeContext';
import { Loader2, Save } from 'lucide-react';

interface ThemeSettingsForm {
    primary_color: string;
    secondary_color: string;
    direction: 'ltr' | 'rtl';
}

export const ThemeSettingsTab = () => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { register, handleSubmit, setValue, watch } = useForm<ThemeSettingsForm>();

    const primaryColor = watch('primary_color');
    const secondaryColor = watch('secondary_color');

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const response = await settingsApi.getThemeSettings();
            if (response.success) {
                setValue('primary_color', response.data.primary_color);
                setValue('secondary_color', response.data.secondary_color);
                setValue('direction', response.data.direction);
            }
        } catch (error) {
            toast.error('Failed to load theme settings');
        } finally {
            setLoading(false);
        }
    };

    const { refreshTheme } = useTheme();

    const onSubmit = async (data: ThemeSettingsForm) => {
        setSaving(true);
        try {
            await settingsApi.updateThemeSettings(data);
            toast.success('Theme settings updated');
            await refreshTheme();
        } catch (error) {
            toast.error('Failed to update theme settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-sage-600" /></div>;

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 animate-in fade-in duration-500 max-w-4xl">
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Color Palette</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Primary Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                {...register('primary_color')}
                                className="h-10 w-20 p-1 rounded border cursor-pointer"
                            />
                            <div className="flex-1 p-2 bg-white border rounded text-sm text-gray-600 font-mono">
                                {primaryColor}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Main brand color used for buttons, links, and headers.</p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Secondary Color</label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                {...register('secondary_color')}
                                className="h-10 w-20 p-1 rounded border cursor-pointer"
                            />
                            <div className="flex-1 p-2 bg-white border rounded text-sm text-gray-600 font-mono">
                                {secondaryColor}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">Accent color used for highlights and secondary actions.</p>
                    </div>
                </div>

                <div className="mt-8 p-4 bg-white rounded border border-gray-100">
                    <h4 className="text-sm font-medium text-gray-500 mb-3 uppercase tracking-wider">Preview</h4>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            style={{ backgroundColor: primaryColor }}
                            className="px-4 py-2 rounded text-white font-medium shadow-sm"
                        >
                            Primary Button
                        </button>
                        <button
                            type="button"
                            style={{ color: primaryColor, borderColor: primaryColor }}
                            className="px-4 py-2 rounded bg-white border font-medium shadow-sm"
                        >
                            Secondary Button
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b pb-2">Layout</h3>
                <div className="space-y-4">
                    <label className="text-sm font-medium text-slate-700">Direction</label>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer p-3 bg-white rounded border border-gray-200 hover:border-sage-400 w-full transition">
                            <input type="radio" value="ltr" {...register('direction')} className="text-sage-600 focus:ring-sage-500" />
                            <span className="font-medium">LTR (Left to Right)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-3 bg-white rounded border border-gray-200 hover:border-sage-400 w-full transition">
                            <input type="radio" value="rtl" {...register('direction')} className="text-sage-600 focus:ring-sage-500" />
                            <span className="font-medium">RTL (Right to Left)</span>
                        </label>
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
