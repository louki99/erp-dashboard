import { Banknote, CreditCard, Landmark, FileCheck, Clock3, ArrowLeftRight, RotateCcw, type LucideIcon } from 'lucide-react';
import type { GcomPaymentMethod } from '@/types/gcom.types';

export interface PaymentMethodDef {
    value: GcomPaymentMethod;
    label: string;
    icon: LucideIcon;
    needsInstrument?: boolean;
    needsTerm?: boolean;
    // 2026-08-20 — NON_CASH_COMPENSATION, requires avoir_allocations summing
    // exactly to the sale total. Only meaningful where a sale is actually
    // settled to an invoice (Comptoir, BC/BL→Facture) — see
    // GcomAvoirAllocation's comment in gcom.types.ts.
    needsAvoirAllocation?: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
    { value: 'cash', label: 'Espèces', icon: Banknote },
    { value: 'card', label: 'Carte', icon: CreditCard },
    { value: 'credit', label: 'Crédit', icon: Landmark, needsTerm: true },
    { value: 'cheque', label: 'Chèque', icon: FileCheck, needsInstrument: true },
    { value: 'effet', label: 'Effet', icon: Clock3, needsInstrument: true },
    { value: 'transfer', label: 'Virement', icon: ArrowLeftRight, needsTerm: true },
    { value: 'avoir', label: 'Avoir', icon: RotateCcw, needsAvoirAllocation: true },
];
