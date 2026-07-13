import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Loader2,
    Save,
    Clock,
    Check,
    Star,
    AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import {
    usePartnerChronologies,
    useSyncPartnerChronologies,
} from '@/hooks/pricing/usePricing';
import type { BusinessChronology, PartnerChronologyAssignment } from '@/types/pricing.types';

interface DraftAssignment {
    chronology: BusinessChronology;
    selected: boolean;
    subTypes: string[];
    isPrimary: boolean;
}

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

export interface PartnerChronologiesEditorProps {
    partnerId: number;
}

export function PartnerChronologiesEditor({ partnerId }: PartnerChronologiesEditorProps) {
    const { t } = useTranslation();
    const { data, loading, error, refetch } = usePartnerChronologies(partnerId);
    const { syncChronologies, loading: saving } = useSyncPartnerChronologies();

    const [overrides, setOverrides] = useState<Record<number, Partial<DraftAssignment>>>({});

    const baseDraft = useMemo<DraftAssignment[]>(() => {
        if (!data) return [];
        const selectedByCode = new Map(
            data.chronologies.map((c) => [c.code, c] as [string, PartnerChronologyAssignment])
        );
        return data.availableChronologies.map((chronology) => {
            const selected = selectedByCode.get(chronology.code);
            return {
                chronology,
                selected: !!selected,
                subTypes: selected?.sub_types ?? [],
                isPrimary: selected?.is_primary ?? false,
            };
        });
    }, [data]);

    const draft = useMemo<DraftAssignment[]>(() => {
        return baseDraft.map((item) => ({
            ...item,
            ...overrides[item.chronology.id],
        }));
    }, [baseDraft, overrides]);

    const hasChanges = useMemo(() => {
        if (!data) return false;
        const current = normalizeAssignments(data.chronologies);
        const next = normalizeAssignments(
            draft
                .filter((d) => d.selected)
                .map((d) => ({
                    id: d.chronology.id,
                    code: d.chronology.code,
                    name: d.chronology.name,
                    sub_types: d.subTypes,
                    is_primary: d.isPrimary,
                }))
        );
        return JSON.stringify(current) !== JSON.stringify(next);
    }, [data, draft]);

    const updateOverride = (id: number, patch: Partial<DraftAssignment>) => {
        setOverrides((prev) => ({
            ...prev,
            [id]: { ...prev[id], ...patch },
        }));
    };

    const handleToggleChronology = (index: number) => {
        const item = draft[index];
        const nextSelected = !item.selected;
        updateOverride(item.chronology.id, {
            selected: nextSelected,
            subTypes:
                nextSelected && item.subTypes.length === 0 && item.chronology.available_sub_types.length > 0
                    ? [item.chronology.available_sub_types[0]]
                    : item.subTypes,
        });
    };

    const handleToggleSubType = (index: number, tag: string) => {
        const item = draft[index];
        const nextSubTypes = item.subTypes.includes(tag)
            ? item.subTypes.filter((t) => t !== tag)
            : [...item.subTypes, tag];
        updateOverride(item.chronology.id, { subTypes: nextSubTypes });
    };

    const handleSetPrimary = (index: number) => {
        const target = draft[index];
        if (!target.selected) return;
        setOverrides((prev) => {
            const next: Record<number, Partial<DraftAssignment>> = {};
            draft.forEach((item) => {
                next[item.chronology.id] = { ...prev[item.chronology.id], isPrimary: false };
            });
            next[target.chronology.id] = { ...prev[target.chronology.id], isPrimary: true };
            return next;
        });
    };

    const handleSave = async () => {
        const selected = draft.filter((d) => d.selected);
        const primaryCount = selected.filter((d) => d.isPrimary).length;
        if (primaryCount > 1) {
            toast.error(t('pricing.partnerChronologies.onePrimaryOnly'));
            return;
        }
        const invalid = selected.find((d) =>
            d.subTypes.some((tag) => !d.chronology.available_sub_types.includes(tag))
        );
        if (invalid) {
            toast.error(t('pricing.partnerChronologies.invalidTags', { code: invalid.chronology.code }));
            return;
        }

        const payload = {
            chronologies: selected.map((d) => ({
                code: d.chronology.code,
                sub_types: d.subTypes,
                is_primary: d.isPrimary,
            })),
        };
        try {
            await syncChronologies({ partnerId, data: payload });
            toast.success(t('pricing.partnerChronologies.saveSuccess'));
            setOverrides({});
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-sage-400" />
                <span className="text-sm">{t('common.loading')}</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-red-600 gap-3">
                <AlertCircle className="w-6 h-6" />
                <span className="text-sm">{error}</span>
                <Button variant="outline" size="sm" onClick={refetch}>
                    {t('common.retry')}
                </Button>
            </div>
        );
    }

    if (!data || data.availableChronologies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
                <Clock className="w-6 h-6" />
                <span className="text-sm">{t('pricing.partnerChronologies.noChronologies')}</span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-gray-900">{t('pricing.partnerChronologies.title')}</h3>
                    <p className="text-xs text-gray-500">{t('pricing.partnerChronologies.subtitle')}</p>
                </div>
                <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                    className="bg-sage-600 hover:bg-sage-700"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
                    {t('common.save')}
                </Button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {draft.map((item, index) => (
                    <div
                        key={item.chronology.id}
                        className={cn(
                            'rounded-xl border bg-white shadow-sm transition-all',
                            item.selected ? 'border-sage-300 ring-1 ring-sage-200' : 'border-gray-200'
                        )}
                    >
                        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Checkbox
                                    id={`ch-${item.chronology.id}`}
                                    checked={item.selected}
                                    onCheckedChange={() => handleToggleChronology(index)}
                                />
                                <Label htmlFor={`ch-${item.chronology.id}`} className="text-sm font-semibold cursor-pointer">
                                    {item.chronology.name}
                                    <span className="ml-2 font-mono text-[10px] text-gray-400 font-normal">
                                        {item.chronology.code}
                                    </span>
                                </Label>
                            </div>
                            {item.selected && (
                                <button
                                    type="button"
                                    onClick={() => handleSetPrimary(index)}
                                    className={cn(
                                        'flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors',
                                        item.isPrimary
                                            ? 'text-amber-700 bg-amber-50'
                                            : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                                    )}
                                    title={t('pricing.partnerChronologies.primary')}
                                >
                                    <Star className={cn('w-3.5 h-3.5', item.isPrimary && 'fill-current')} />
                                    {item.isPrimary ? t('pricing.partnerChronologies.primary') : t('pricing.partnerChronologies.setPrimary')}
                                </button>
                            )}
                        </div>

                        {item.selected && (
                            <div className="px-4 py-3">
                                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-2">
                                    {t('pricing.partnerChronologies.tags')}
                                </p>
                                {item.chronology.available_sub_types.length === 0 ? (
                                    <p className="text-xs text-gray-400">{t('pricing.partnerChronologies.noTags')}</p>
                                ) : (
                                    <div className="flex flex-wrap gap-2">
                                        {item.chronology.available_sub_types.map((tag) => {
                                            const checked = item.subTypes.includes(tag);
                                            return (
                                                <button
                                                    key={tag}
                                                    type="button"
                                                    onClick={() => handleToggleSubType(index, tag)}
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border transition-colors',
                                                        checked
                                                            ? 'bg-sage-50 border-sage-300 text-sage-700'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                                                    )}
                                                >
                                                    {checked && <Check className="w-3 h-3" />}
                                                    {tag}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function normalizeAssignments(items: PartnerChronologyAssignment[]) {
    return [...items]
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((item) => ({
            code: item.code,
            sub_types: [...item.sub_types].sort(),
            is_primary: item.is_primary,
        }));
}
