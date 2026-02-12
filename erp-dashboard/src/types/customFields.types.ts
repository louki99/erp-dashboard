// ─── Custom Fields Types ─────────────────────────────────────────────────────

export type EntityType = 'partner' | 'product';

export type FieldType =
    | 'text'
    | 'textarea'
    | 'number'
    | 'email'
    | 'date'
    | 'datetime'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'file';

// ─── Custom Field Definition ─────────────────────────────────────────────────

export interface CustomField {
    id: number;
    field_name: string;
    field_label: string;
    field_type: FieldType;
    entity_type: EntityType;
    is_required: boolean;
    default_value: string | null;
    options: string[] | null;
    validation_rules: string[] | null;
    placeholder: string | null;
    help_text: string | null;
    order: number;
    is_active: boolean;
    is_searchable: boolean;
    is_visible?: boolean;
    created_at?: string;
    updated_at?: string;
    // Edit-form helpers
    options_string?: string;
    validation_rules_string?: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    per_page: number;
    total: number;
    last_page?: number;
}

export interface CustomFieldListResponse {
    customFields: PaginatedResponse<CustomField>;
    entityTypes: Record<string, string>;
    currentEntityType: string;
}

export interface CustomFieldCreateFormResponse {
    fieldTypes: Record<string, string>;
    entityTypes: Record<string, string>;
}

export interface CustomFieldEditFormResponse {
    customField: CustomField;
    fieldTypes: Record<string, string>;
    entityTypes: Record<string, string>;
}

export interface CustomFieldMutationResponse {
    success: boolean;
    message: string;
    customField?: CustomField;
}

export interface CustomFieldToggleResponse {
    success: boolean;
    is_active: boolean;
    message: string;
}

export interface CustomFieldReorderResponse {
    success: boolean;
    message: string;
}

// ─── Request Types ───────────────────────────────────────────────────────────

export interface CustomFieldFilters {
    entity_type?: EntityType | 'all';
    page?: number;
    per_page?: number;
}

export interface CreateCustomFieldRequest {
    field_label: string;
    field_type: FieldType;
    entity_type: EntityType;
    is_required?: boolean;
    default_value?: string;
    placeholder?: string;
    help_text?: string;
    options?: string;
    validation_rules?: string;
    order?: number;
    is_active?: boolean;
    is_searchable?: boolean;
}

export interface UpdateCustomFieldRequest extends CreateCustomFieldRequest {
    // Same fields as create, all required for update
}

export interface ReorderItem {
    id: number;
    order: number;
}

export interface ReorderRequest {
    items: ReorderItem[];
}
