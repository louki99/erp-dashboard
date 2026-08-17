import type { GcomReturnReason } from '@/types/gcom.types';

// `App\Enums\ReturnReason` — 2026-08-18, CAS 1's `reason` moved from free
// text to this fixed enum (breaking change, 422 for anything else). Shared
// by the BL return batch modal; CAS 2/3's credit-note `reason` field is a
// separate free-text note, not covered by this enum.
export interface ReturnReasonDef {
    value: GcomReturnReason;
    label: string;
}

export const RETURN_REASONS: ReturnReasonDef[] = [
    { value: 'DEFECTIVE', label: 'Défectueux' },
    { value: 'DAMAGED', label: 'Endommagé' },
    { value: 'WRONG_ITEM', label: 'Mauvais article' },
    { value: 'CHANGE_MIND', label: "Changement d'avis" },
    { value: 'NOT_AS_DESCRIBED', label: 'Non conforme à la description' },
    { value: 'EXPIRED', label: 'Périmé' },
    { value: 'CUSTOMER_REQUEST', label: 'Demande client' },
    { value: 'DUPLICATE_ORDER', label: 'Commande en double' },
    { value: 'OTHER', label: 'Autre' },
];

export const RETURN_REASON_LABEL: Record<GcomReturnReason, string> = RETURN_REASONS.reduce(
    (acc, r) => ({ ...acc, [r.value]: r.label }),
    {} as Record<GcomReturnReason, string>,
);
