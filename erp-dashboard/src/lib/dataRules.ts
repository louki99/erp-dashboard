import type {
    DataRuleAction,
    DataRuleModelType,
    DataRuleScopeType,
    DataRuleSubject,
    ModelTypeOption,
    ScopeTypeOption,
} from '../types/dataRules.types';

export const MODEL_TYPE_OPTIONS: ModelTypeOption[] = [
    { label: 'Page Produit', value: 'App\\Models\\ProductPage', subject: 'product_page' },
    { label: 'Condition de règlement', value: 'App\\Models\\PaymentTerm', subject: 'payment_term' },
    { label: 'Moyen de paiement', value: 'App\\Models\\PaymentMethod', subject: 'payment_method' },
    { label: 'Catégorie', value: 'App\\Models\\Category', subject: 'category' },
    { label: 'Produit', value: 'App\\Models\\Product', subject: 'product' },
    { label: 'Route de transfert trésorerie', value: 'App\\Models\\TreasuryTransferRoute', subject: 'treasury_transfer_route' },
    { label: 'Type de document', value: 'App\\Models\\DocumentType', subject: 'document_type' },
    { label: 'Mission de livraison', value: 'App\\Models\\DeliveryMission', subject: 'delivery_mission' },
];

export const SCOPE_TYPE_OPTIONS: ScopeTypeOption[] = [
    { label: 'Utilisateur', value: 'user', example: 'users.id (ex: 42)' },
    { label: 'Profil', value: 'profile', example: 'access_profiles.id (ex: 8)' },
    { label: 'Rôle', value: 'role', example: 'Spatie role name (ex: sfa_order_taker)' },
    { label: 'Dépôt', value: 'branch', example: 'branches.code (ex: CAS-001)' },
    { label: 'Partenaire', value: 'partner', example: 'partners.id (ex: 156)' },
];

export const ACTION_OPTIONS: { label: string; value: DataRuleAction }[] = [
    { label: 'Autoriser', value: 'allow' },
    { label: 'Refuser', value: 'deny' },
];

export function getModelTypeLabel(modelType: DataRuleModelType): string {
    return MODEL_TYPE_OPTIONS.find((opt) => opt.value === modelType)?.label ?? modelType;
}

export function getScopeTypeLabel(scopeType: DataRuleScopeType): string {
    return SCOPE_TYPE_OPTIONS.find((opt) => opt.value === scopeType)?.label ?? scopeType;
}

export function getActionLabel(action: DataRuleAction): string {
    return ACTION_OPTIONS.find((opt) => opt.value === action)?.label ?? action;
}

export function getModelTypeBySubject(subject: DataRuleSubject): DataRuleModelType | undefined {
    return MODEL_TYPE_OPTIONS.find((opt) => opt.subject === subject)?.value;
}
