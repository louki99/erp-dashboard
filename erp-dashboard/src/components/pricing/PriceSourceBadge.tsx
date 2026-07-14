import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';

// Vocabulaire unique des sources du moteur v5 (§6.1b/§6.1c) —
// même libellé partout : preview, formulaire override, grille colisages.
const SOURCE_STYLE: Record<string, string> = {
    partner_override: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    partner_override_discount: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    tier: 'bg-violet-50 text-violet-700 border-violet-200',
    override: 'bg-amber-50 text-amber-700 border-amber-200',
    standard: 'bg-blue-50 text-blue-700 border-blue-200',
    linear: 'bg-slate-100 text-slate-600 border-slate-200',
    colisage_unpriced: 'bg-red-50 text-red-700 border-red-200',
    no_base: 'bg-red-50 text-red-700 border-red-200',
};

export function usePriceSourceLabel() {
    const { t } = useTranslation();
    return (source: string | null | undefined): string => {
        if (!source) return '—';
        const key = `pricing.sources.${source}`;
        const label = t(key);
        // clé absente → i18next renvoie la clé : fallback sur la valeur brute
        return label === key ? source : label;
    };
}

export function PriceSourceBadge({ source }: { source: string | null | undefined }) {
    const getLabel = usePriceSourceLabel();
    if (!source) return null;
    return (
        <Badge
            variant="outline"
            className={`text-[10px] font-medium ${SOURCE_STYLE[source] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}
        >
            {getLabel(source)}
        </Badge>
    );
}
