import { useEffect, useState } from 'react';
import { gcomApi } from '@/services/api/gcomApi';

// 2026-09-02 — thin wrapper around GET /gcom/parameters?module=GCOM, the
// registry backend just built for gcom.max_discount_percent/
// gcom.max_free_standing_credit_note_amount. Fetched once and shared across
// every component instance in the session (module-level cache) rather than
// re-fetched every time a discount/amount modal opens — these thresholds
// change rarely, if ever, during a single session. `current_value` is
// already resolved for the acting user server-side, so it's the exact
// number backend will actually enforce, not a guess.
export interface GcomParametersValues {
    maxDiscountPercent: number | null;
    maxFreeStandingCreditNoteAmount: number | null;
}

const EMPTY: GcomParametersValues = { maxDiscountPercent: null, maxFreeStandingCreditNoteAmount: null };

let cached: GcomParametersValues | null = null;
let inflight: Promise<GcomParametersValues> | null = null;

const fetchParameters = async (): Promise<GcomParametersValues> => {
    const params = await gcomApi.parameters.get('GCOM');
    const find = (key: string) => params.find(p => p.key === key)?.current_value ?? null;
    return {
        maxDiscountPercent: find('gcom.max_discount_percent'),
        maxFreeStandingCreditNoteAmount: find('gcom.max_free_standing_credit_note_amount'),
    };
};

export const useGcomParameters = (): GcomParametersValues => {
    const [values, setValues] = useState<GcomParametersValues>(cached ?? EMPTY);

    useEffect(() => {
        if (cached) return;
        if (!inflight) {
            inflight = fetchParameters().catch(() => EMPTY);
        }
        let cancelled = false;
        inflight.then(result => {
            cached = result;
            if (!cancelled) setValues(result);
        });
        return () => { cancelled = true; };
    }, []);

    return values;
};
