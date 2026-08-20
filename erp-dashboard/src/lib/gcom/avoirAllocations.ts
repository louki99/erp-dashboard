import type { GcomAvoirAllocation, GcomPaymentMethod } from '@/types/gcom.types';

const sumAllocations = (allocations: GcomAvoirAllocation[]) => allocations.reduce((s, a) => s + a.amount, 0);

// payment_method: 'avoir' still requires avoir_allocations to sum EXACTLY to
// the sale total (422 "must exactly match the sale total" otherwise) —
// shared by GcomCatalogEntryScreen (Comptoir), BonCommandePage and
// BonLivraisonPage's convert-to-invoice flows.
export const avoirAllocationsMatchTotal = (allocations: GcomAvoirAllocation[], total: number) =>
    Math.abs(sumAllocations(allocations) - total) < 0.005;

// Mixed avoir + another payment method (2026-08-20) — the avoir only needs to
// cover PART of the total here, the sale's own payment_method (cash/card/
// cheque/effet) settles the remainder. Still 422s if the sum exceeds the
// total (verified live), so this stays a "not over" check, not "anything goes".
export const avoirAllocationsWithinTotal = (allocations: GcomAvoirAllocation[], total: number) =>
    sumAllocations(allocations) - total < 0.005;

export const avoirAllocationsRemainder = (allocations: GcomAvoirAllocation[], total: number) =>
    Math.max(0, total - sumAllocations(allocations));

// Verified live: mixing avoir_allocations with a credit/transfer remainder
// 422s — "the remainder payment_method must be cash, card, cheque, or
// effet." A real scope limit (credit re-checks the partner's exposure on the
// FULL total, not the post-avoir remainder), not an oversight — don't offer
// the avoir picker at all for these two methods.
export const canMixAvoirWith = (method: GcomPaymentMethod | undefined | null): boolean =>
    method === 'cash' || method === 'card' || method === 'cheque' || method === 'effet';
