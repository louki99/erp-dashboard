// Local price resolver (docs §4.4) — reproduces the server's base-price
// priority, exactly as `PartnerProductPriceResolver` orders it:
//   1. partner price_overrides (fixed_price wins outright if > 0; otherwise
//      discount_rate/discount_amount is applied ON TOP of the base price
//      resolved by steps 2-5 below — it is not a standalone price)
//   2. quantity tier (/catalog/tiers) — usually empty
//   3. price-list "override" line (/catalog/price-list, is_override: true)
//   4. price-list "standard" line (/catalog/price-list, is_override: false)
//      — the most common case, was MISSING before the 2026-08 fix and caused
//      the resolver to silently fall through to the generic catalogue price
//   5. linear fallback (derived from the default packaging's standard line)
//
// Promotions are deliberately NOT applied here: budget-capped and
// monthly-cumulative promotions depend on mutable server state (all
// channels, all agents) that cannot be known offline. Every result from
// this resolver is therefore an ESTIMATE whenever a partner is involved —
// callers must show it as such (e.g. "≈ estimé") and treat POST /orders /
// GET /orders/{id}/summary as the only authoritative amounts.

import type { CatalogSyncProduct, PartnerSyncRecord, PriceTier, PriceListLine } from '@/types/telesalesAgent.types';

export type PriceSource = 'override' | 'tier' | 'list_override' | 'list_standard' | 'linear' | 'generic';

export interface ResolvedPrice {
    unitPriceTtc: number;
    source: PriceSource;
    /** true whenever a partner was involved — promotions aren't reproduced locally. */
    estimated: boolean;
}

const isOverrideActive = (override: PartnerSyncRecord['price_overrides'][number], now: Date): boolean => {
    const from = new Date(override.valid_from);
    const to = new Date(override.valid_to);
    return now >= from && now <= to;
};

const clamp = (price: number, min: number | null, max: number | null): number => {
    let p = price;
    if (min != null) p = Math.max(p, min);
    if (max != null) p = Math.min(p, max);
    return p;
};

/** Steps 2-5: quantity tier > price-list override line > price-list standard line > linear fallback > generic. */
const resolveBasePrice = (
    product: CatalogSyncProduct,
    quantity: number,
    packagingId: number,
    tiers: PriceTier[],
    priceListLines: PriceListLine[]
): { price: number; source: PriceSource } => {
    const tier = tiers.find(
        (t) => t.product_id === product.id && t.packaging_id === packagingId && quantity >= t.min_qty && (t.max_qty == null || quantity <= t.max_qty)
    );
    if (tier) return { price: tier.tier_price, source: 'tier' };

    const linesForPackaging = priceListLines.filter((l) => l.product_id === product.id && l.packaging_id === packagingId);
    const overrideLine = linesForPackaging.find((l) => l.is_override);
    if (overrideLine) return { price: clamp(overrideLine.sales_price, overrideLine.min_sales_price, overrideLine.max_sales_price), source: 'list_override' };

    const standardLine = linesForPackaging.find((l) => !l.is_override);
    if (standardLine) return { price: clamp(standardLine.sales_price, standardLine.min_sales_price, standardLine.max_sales_price), source: 'list_standard' };

    // Linear fallback: derive from the default packaging's line when quoting a
    // different (non-default) packaging that has no price-list line of its own.
    const defaultPackaging = product.packagings.find((p) => p.is_default);
    const targetPackaging = product.packagings.find((p) => p.packaging_id === packagingId);
    if (defaultPackaging && targetPackaging && defaultPackaging.packaging_id !== packagingId && defaultPackaging.quantity > 0) {
        const defaultLines = priceListLines.filter((l) => l.product_id === product.id && l.packaging_id === defaultPackaging.packaging_id);
        const defaultLine = defaultLines.find((l) => l.is_override) ?? defaultLines.find((l) => !l.is_override);
        if (defaultLine) {
            const unitPrice = defaultLine.sales_price / defaultPackaging.quantity;
            return { price: unitPrice * targetPackaging.quantity, source: 'linear' };
        }
    }

    return { price: product.price, source: 'generic' };
};

export const resolveLocalPrice = (
    product: CatalogSyncProduct,
    quantity: number,
    partner?: PartnerSyncRecord | null,
    tiers: PriceTier[] = [],
    priceListLines: PriceListLine[] = [],
    now: Date = new Date()
): ResolvedPrice => {
    if (!partner) {
        return { unitPriceTtc: product.price, source: 'generic', estimated: false };
    }

    const packagingId = (product.packagings.find((p) => p.is_default) ?? product.packagings[0])?.packaging_id;

    const override = partner.price_overrides
        .filter((o) => o.product_id === product.id && isOverrideActive(o, now))
        .sort((a, b) => b.priority - a.priority)[0];

    // Step 1a — fixed_price wins outright over everything else.
    if (override?.fixed_price != null && override.fixed_price > 0) {
        return { unitPriceTtc: override.fixed_price, source: 'override', estimated: true };
    }

    // Steps 2-5.
    const base = packagingId != null
        ? resolveBasePrice(product, quantity, packagingId, tiers, priceListLines)
        : { price: product.price, source: 'generic' as PriceSource };

    // Step 1b — discount_rate/discount_amount apply on top of the base price
    // above, not as a standalone tier (docs §4.4 correctif).
    let price = base.price;
    let source = base.source;
    if (override?.discount_rate != null) {
        price = Math.max(0, price * (1 - override.discount_rate / 100));
        source = 'override';
    } else if (override?.discount_amount != null) {
        price = Math.max(0, price - override.discount_amount);
        source = 'override';
    }

    return { unitPriceTtc: price, source, estimated: true };
};
