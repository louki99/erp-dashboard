import type { TokenSerieScope } from '@/types/tokenSeries.types';

export const SCOPE_LABELS: Record<TokenSerieScope, string> = {
    global: 'Global',
    branch: 'Branche',
    device: 'Device',
};

export interface NumberingField {
    key: string;
    prefixKey: string;
    counterKey: string;
    label: string;
    shortLabel: string;
}

export const NUMBERING_FIELDS: NumberingField[] = [
    { key: 'invoice', prefixKey: 'invoice_prefix', counterKey: 'invoice_next_number', label: 'Facture', shortLabel: 'Fact.' },
    { key: 'order', prefixKey: 'order_prefix', counterKey: 'order_next_number', label: 'Bon de commande', shortLabel: 'BC' },
    { key: 'payment', prefixKey: 'payment_prefix', counterKey: 'payment_next_number', label: 'Paiement générique', shortLabel: 'Pay.' },
    { key: 'cash_payment', prefixKey: 'cash_payment_prefix', counterKey: 'cash_payment_next_number', label: 'Paiement espèces', shortLabel: 'Cash' },
    { key: 'check_payment', prefixKey: 'check_payment_prefix', counterKey: 'check_payment_next_number', label: 'Paiement chèque/effet', shortLabel: 'Chq.' },
    { key: 'credit_note', prefixKey: 'credit_note_prefix', counterKey: 'credit_note_next_number', label: 'Avoir', shortLabel: 'Avoir' },
    { key: 'deposit_slip', prefixKey: 'deposit_slip_prefix', counterKey: 'deposit_slip_next_number', label: 'Versement bancaire', shortLabel: 'Verse.' },
    { key: 'activity', prefixKey: 'activity_prefix', counterKey: 'activity_next_number', label: 'Activité', shortLabel: 'Act.' },
    { key: 'do', prefixKey: 'do_prefix', counterKey: 'do_next_number', label: 'Delivery Order', shortLabel: 'DO' },
    { key: 'batch', prefixKey: 'batch_prefix', counterKey: 'batch_next_number', label: 'Lot logistique', shortLabel: 'Lot' },
    { key: 'visit', prefixKey: 'visit_prefix', counterKey: 'visit_next_number', label: 'Visite', shortLabel: 'Vis.' },
    { key: 'loading', prefixKey: 'loading_prefix', counterKey: 'loading_next_number', label: 'Chargement', shortLabel: 'Charg.' },
    { key: 'transfer', prefixKey: 'transfer_prefix', counterKey: 'transfer_next_number', label: 'Bon de livraison', shortLabel: 'BL' },
    { key: 'return', prefixKey: 'return_prefix', counterKey: 'return_next_number', label: 'Retour', shortLabel: 'Ret.' },
    { key: 'damage', prefixKey: 'damage_prefix', counterKey: 'damage_next_number', label: 'Casse', shortLabel: 'Casse' },
    { key: 'unloading', prefixKey: 'unloading_prefix', counterKey: 'unloading_next_number', label: 'Déchargement', shortLabel: 'Déch.' },
    { key: 'session', prefixKey: 'session_prefix', counterKey: 'session_next_number', label: 'Session de travail', shortLabel: 'Sess.' },
    { key: 'expense', prefixKey: 'expense_prefix', counterKey: 'expense_next_number', label: 'Note de frais', shortLabel: 'Frais' },
    // Achats families — added 2026-08-26. `key` matches numbering_families'
    // map keys exactly (bcf/brc/facf/decf) — used to look up the `locked` flag.
    { key: 'bcf', prefixKey: 'bcf_prefix', counterKey: 'bcf_next_number', label: 'BC Fournisseur (Achats)', shortLabel: 'BCF' },
    { key: 'brc', prefixKey: 'brc_prefix', counterKey: 'brc_next_number', label: 'Bon de Réception (Achats)', shortLabel: 'BRC' },
    { key: 'facf', prefixKey: 'facf_prefix', counterKey: 'facf_next_number', label: 'Facture Fournisseur (Achats)', shortLabel: 'FACF' },
    { key: 'decf', prefixKey: 'decf_prefix', counterKey: 'decf_next_number', label: 'Décaissement Fournisseur (Achats)', shortLabel: 'DECF' },
];

export function getScopeLabel(scope: TokenSerieScope): string {
    return SCOPE_LABELS[scope] ?? scope;
}
