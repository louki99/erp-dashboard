import type { GcomReturnCondition } from '@/types/gcom.types';

// Shared by CAS 1 (BL line return) and CAS 2 (avoir restock) — see
// docs/modules/28-gcom.md §9bis. `sellable` is the default on every backend
// call that accepts this field; omitting it entirely is equivalent.
export interface ReturnConditionDef {
    value: GcomReturnCondition;
    label: string;
    hint: string;
}

export const RETURN_CONDITIONS: ReturnConditionDef[] = [
    { value: 'sellable', label: 'Vendable', hint: 'Remis en stock disponible à la vente immédiatement' },
    { value: 'damaged', label: 'Endommagé', hint: 'Cassé / périmé — mis de côté, jamais compté dans le stock vendable' },
    { value: 'technical', label: 'Technique / SAV', hint: 'Expertise à faire — mis en quarantaine, jamais compté dans le stock vendable' },
];

export const RETURN_CONDITION_LABEL: Record<GcomReturnCondition, string> = RETURN_CONDITIONS.reduce(
    (acc, c) => ({ ...acc, [c.value]: c.label }),
    {} as Record<GcomReturnCondition, string>,
);
