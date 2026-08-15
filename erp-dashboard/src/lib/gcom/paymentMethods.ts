import { Banknote, CreditCard, Landmark, FileCheck, Clock3, ArrowLeftRight, type LucideIcon } from 'lucide-react';
import type { GcomPaymentMethod } from '@/types/gcom.types';

export interface PaymentMethodDef {
    value: GcomPaymentMethod;
    label: string;
    icon: LucideIcon;
    needsInstrument?: boolean;
    needsTerm?: boolean;
}

export const PAYMENT_METHODS: PaymentMethodDef[] = [
    { value: 'cash', label: 'Espèces', icon: Banknote },
    { value: 'card', label: 'Carte', icon: CreditCard },
    { value: 'credit', label: 'Crédit', icon: Landmark, needsTerm: true },
    { value: 'cheque', label: 'Chèque', icon: FileCheck, needsInstrument: true },
    { value: 'effet', label: 'Effet', icon: Clock3, needsInstrument: true },
    { value: 'transfer', label: 'Virement', icon: ArrowLeftRight, needsTerm: true },
];
