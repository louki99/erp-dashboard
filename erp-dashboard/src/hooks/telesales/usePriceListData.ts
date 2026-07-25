import { useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { PriceTier, PriceListLine } from '@/types/telesalesAgent.types';

const EMPTY_TIERS: PriceTier[] = [];
const EMPTY_LINES: PriceListLine[] = [];

/**
 * Live-fetches the two price-list-scoped pieces the local resolver needs
 * (quantity tiers + price-list lines, steps 2-4 of the priority order in
 * priceResolver.ts) for the partner's current `price_list_id`. Neither is
 * cached long-term — the "active line" of a price list shifts over time
 * (date window), so both are re-fetched on every price_list_id change
 * (docs §4.4). Derived-not-reset: a `...ForListId` marker lets render decide
 * whether the fetched data still matches the current list instead of an
 * eager clear inside the effect (react-hooks/set-state-in-effect).
 */
export const usePriceListData = (priceListId: number | null) => {
    const [fetchedTiers, setFetchedTiers] = useState<PriceTier[]>([]);
    const [fetchedLines, setFetchedLines] = useState<PriceListLine[]>([]);
    const [dataForListId, setDataForListId] = useState<number | null>(null);

    useEffect(() => {
        if (!priceListId) return;
        let cancelled = false;
        Promise.all([
            telesalesApi.catalog.tiers(priceListId).then((res) => res.tiers).catch(() => []),
            telesalesApi.catalog.priceList(priceListId).then((res) => res.lines).catch(() => []),
        ]).then(([tiers, lines]) => {
            if (cancelled) return;
            setFetchedTiers(tiers);
            setFetchedLines(lines);
            setDataForListId(priceListId);
        });
        return () => { cancelled = true; };
    }, [priceListId]);

    const matches = priceListId != null && dataForListId === priceListId;
    // Derived, not effect-driven state — true while a newly-selected price
    // list's tiers/lines haven't arrived yet.
    const loading = priceListId != null && !matches;
    return {
        tiers: matches ? fetchedTiers : EMPTY_TIERS,
        priceListLines: matches ? fetchedLines : EMPTY_LINES,
        loading,
    };
};
