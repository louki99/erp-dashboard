import { useState, useEffect, useCallback } from 'react';
import { useFormContext } from 'react-hook-form';
import { Clock, Check, X, CheckCircle2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getBusinessChronologies } from '@/services/api/pricingApi';
import type { BusinessChronology } from '@/types/pricing.types';
import type { Promotion } from '@/types/promotion.types';

// Ciblage par chronologies commerciales (natures d'activité + tags) — additif
// avec le ciblage par familles de partenaires : les deux axes coexistent.
export const PromotionChronologiesSelector = () => {
    const { watch, setValue } = useFormContext<Promotion>();
    const selected = watch('business_chronologies') || [];

    const [chronologies, setChronologies] = useState<BusinessChronology[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const list = await getBusinessChronologies();
            setChronologies(list.filter(c => c.is_active));
        } catch (error) {
            console.error('Failed to load business chronologies', error);
            toast.error('Échec du chargement des chronologies commerciales');
            setChronologies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const findSelection = (code: string) => selected.find(s => s.code === code);

    const toggleChronology = (code: string) => {
        const next = findSelection(code)
            ? selected.filter(s => s.code !== code)
            : [...selected, { code, sub_types: [] }];
        setValue('business_chronologies', next, { shouldDirty: true });
    };

    const toggleSubType = (code: string, tag: string) => {
        const next = selected.map(s => {
            if (s.code !== code) return s;
            const tags = s.sub_types ?? [];
            return {
                ...s,
                sub_types: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
            };
        });
        setValue('business_chronologies', next, { shouldDirty: true });
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Ciblage par Chronologies Commerciales
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                    Ciblez les clients par nature d'activité et tags métiers — cumulable avec les familles de partenaires (les deux axes coexistent).
                    Sans tag coché, toute la chronologie est ciblée.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                </div>
            ) : chronologies.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">Aucune chronologie commerciale disponible.</p>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {chronologies.map((chrono) => {
                        const sel = findSelection(chrono.code);
                        return (
                            <div
                                key={chrono.id}
                                className={`rounded-xl border bg-white transition-all ${
                                    sel ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => toggleChronology(chrono.code)}
                                    className="w-full px-4 py-3 flex items-center justify-between text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        {sel ? (
                                            <CheckCircle2 className="w-5 h-5 text-indigo-600 shrink-0" />
                                        ) : (
                                            <div className="w-5 h-5 border-2 border-gray-300 rounded-full shrink-0"></div>
                                        )}
                                        <div>
                                            <span className="text-sm font-semibold text-gray-900">{chrono.name}</span>
                                            <span className="ml-2 font-mono text-[10px] text-gray-400">{chrono.code}</span>
                                        </div>
                                    </div>
                                    {sel && (
                                        <X
                                            className="w-4 h-4 text-gray-300 hover:text-red-400"
                                            onClick={(e) => { e.stopPropagation(); toggleChronology(chrono.code); }}
                                        />
                                    )}
                                </button>

                                {sel && chrono.available_sub_types.length > 0 && (
                                    <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                                        <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                                            Tags ciblés {(sel.sub_types?.length ?? 0) === 0 && <span className="normal-case text-gray-400">(aucun = toute la chronologie)</span>}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {chrono.available_sub_types.map((tag) => {
                                                const checked = (sel.sub_types ?? []).includes(tag);
                                                return (
                                                    <button
                                                        key={tag}
                                                        type="button"
                                                        onClick={() => toggleSubType(chrono.code, tag)}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                                                            checked
                                                                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                        }`}
                                                    >
                                                        {checked && <Check className="w-3 h-3" />}
                                                        {tag}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
