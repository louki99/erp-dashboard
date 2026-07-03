// ─── Dynamic Configuration Settings (Module 19) ──────────────────────────────

export type SettingType = 'boolean' | 'integer' | 'decimal' | 'string' | 'json';

export type ScopeKey =
    | 'SYSTEM'
    | 'ROLE'
    | 'USER'
    | 'ACCESS_PROFILE'
    | 'BRANCH'
    | 'SHOP'
    | 'COMPANY'
    | 'PARTNER';

export const CONFIG_SCOPES: Record<ScopeKey, string> = {
    SYSTEM:         'system',
    ROLE:           'Spatie\\Permission\\Models\\Role',
    USER:           'App\\Models\\User',
    ACCESS_PROFILE: 'App\\Models\\AccessProfile',
    BRANCH:         'App\\Models\\Branch',
    SHOP:           'App\\Models\\Shop',
    COMPANY:        'App\\Models\\Company',
    PARTNER:        'App\\Models\\Partner',
} as const;

export const SCOPE_LABELS: Record<ScopeKey, string> = {
    SYSTEM:         'Système',
    ROLE:           'Rôle',
    USER:           'Utilisateur',
    ACCESS_PROFILE: 'Profil d\'accès',
    BRANCH:         'Agence / Dépôt',
    SHOP:           'Point de vente',
    COMPANY:        'Société',
    PARTNER:        'Partenaire',
};

export const SCOPE_DESCRIPTIONS: Record<ScopeKey, string> = {
    SYSTEM:         'Valeurs par défaut globales pour toute l\'application',
    ROLE:           'Comportement par défaut pour tous les utilisateurs d\'un rôle',
    USER:           'Override individuel par utilisateur',
    ACCESS_PROFILE: 'Profil d\'accès personnalisé',
    BRANCH:         'Configuration spécifique à une agence ou dépôt',
    SHOP:           'Configuration spécifique à un point de vente',
    COMPANY:        'Configuration spécifique à une société',
    PARTNER:        'Règles métier spécifiques à un partenaire',
};

export interface ConfigSetting {
    key: string;
    value: boolean | number | string | object | null;
    type: SettingType;
}

export interface ConfigSettingsResponse {
    configurable_type: string;
    configurable_id: number;
    settings: ConfigSetting[];
}

export interface SaveBatchRequest {
    configurable_type: string;
    configurable_id: number;
    settings: Record<string, unknown>;
}

export interface ResetSettingRequest {
    configurable_type: string;
    configurable_id: number;
    key: string;
}

export interface ScopeEntity {
    id: number;
    name: string;
    description?: string;
    label?: string;
    code?: string;
}

// Local edit state — one entry per setting being edited
export interface SettingDraft {
    key: string;
    type: SettingType;
    originalValue: boolean | number | string | object | null;
    currentValue: boolean | number | string | object | null;
    isDirty: boolean;
    jsonError?: string;
}

// sfa-params dictionary entry
export interface SfaParam {
    key: string;
    value_type: SettingType;
    description: string;
    default_value?: unknown;
}

// Response from GET /api/backend/masterdata/sfa-params
export interface SfaParamsResponse {
    params: SfaParam[];
    grouped: Record<string, SfaParam[]>;
}

// Merged row used in the param table
export interface ParamDraft {
    key: string;
    type: SettingType;
    description: string;
    namespace: string;
    isOverride: boolean;
    savedValue: unknown;
    currentValue: unknown;
    isDirty: boolean;
    jsonError?: string;
}
