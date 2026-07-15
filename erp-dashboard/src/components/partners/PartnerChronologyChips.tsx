import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import {
    usePartnerChronologies,
    useBusinessChronologies,
    useSyncPartnerChronologies,
} from '@/hooks/pricing/usePricing';
import type { BusinessChronology } from '@/types/pricing.types';

interface PartnerChronologyChipsProps {
    partnerId: number;
}

export const PartnerChronologyChips: React.FC<PartnerChronologyChipsProps> = ({ partnerId }) => {
    const { data, loading, error, refetch } = usePartnerChronologies(partnerId);
    const { data: available, loading: loadingAvailable } = useBusinessChronologies();
    const { syncChronologies, loading: saving } = useSyncPartnerChronologies();
    const [overrides, setOverrides] = useState<Record<number, boolean>>({});

    const selectedByCode = useMemo(() => {
        return new Map((data?.chronologies ?? []).map(c => [c.code, c]));
    }, [data]);

    const chips = useMemo(() => {
        return (available ?? []).map(ch => ({
            ...ch,
            selected: overrides[ch.id] !== undefined ? overrides[ch.id] : selectedByCode.has(ch.code),
        }));
    }, [available, selectedByCode, overrides]);

    const handleToggle = async (chronology: BusinessChronology) => {
        const currentSelected = chips.find(c => c.id === chronology.id)?.selected ?? false;
        const nextOverrides = { ...overrides, [chronology.id]: !currentSelected };
        setOverrides(nextOverrides);

        const nextSelected = (available ?? []).filter(a => {
            const isOverridden = nextOverrides[a.id];
            if (isOverridden !== undefined) return isOverridden;
            return selectedByCode.has(a.code);
        });

        const payload = {
            chronologies: nextSelected.map(c => {
                const existing = selectedByCode.get(c.code);
                return {
                    code: c.code,
                    sub_types: existing?.sub_types ?? [],
                    is_primary: false,
                };
            }),
        };

        try {
            await syncChronologies({ partnerId, data: payload });
            toast.success('Chronologies mises à jour');
            await refetch();
            setOverrides({});
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Erreur lors de la synchronisation');
        }
    };

    if (loading || loadingAvailable) {
        return (
            <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Chargement...
            </div>
        );
    }

    if (error) {
        return <div className="text-xs text-red-600">{error}</div>;
    }

    if (!available?.length) {
        return <div className="text-xs text-gray-400">Aucune chronologie disponible</div>;
    }

    return (
        <div className="flex flex-wrap gap-2">
            {chips.map(ch => (
                <button
                    key={ch.id}
                    type="button"
                    disabled={saving}
                    onClick={() => handleToggle(ch)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        ch.selected
                            ? 'bg-sage-100 text-sage-700 border-sage-300'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                    } ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                    {ch.name}
                </button>
            ))}
        </div>
    );
};
