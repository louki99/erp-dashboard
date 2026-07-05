export type ExportFormat = 'xlsx' | 'csv' | 'pdf';
export type SourceType  = 'procedure' | 'query' | 'view';

export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'between' | 'is_null' | 'is_not_null';

export interface ReportFilter {
  column:    string;
  operator:  FilterOperator;
  value?:    string | number | boolean | null;
  value_to?: string | number | null;
  values?:   (string | number)[];
}

export interface ReportColumn {
  key:            string;
  label:          string;
  width?:         number;
  align?:         'left' | 'center' | 'right';
  number_format?: string;
}

export interface StyleConfig {
  font_family?:         string;
  font_size?:           number;
  header_font_color?:   string;
  header_bg_color?:     string;
  alternate_row_color?: string;
  border_color?:        string;
  freeze_header?:       boolean;
  autofit_columns?:     boolean;
  freeze_columns?:      number;
  enable_autofilter?:   boolean;
  show_totals_row?:     boolean;
  totals?:              Record<string, 'sum' | 'avg' | 'count' | 'min' | 'max'>;
  title?:               string;
  logo_url?:            string;
}

// ── Report Definitions (catalogue from backend) ─────────────────────────────

export type ParameterFieldType = 'date' | 'select' | 'boolean' | 'text' | 'number';

export interface ParameterOption {
  value: string;
  label: string;
}

export interface ParameterField {
  key:          string;
  label:        string;
  type:         ParameterFieldType;
  required:     boolean;
  placeholder?: string;
  options?:     (ParameterOption | string)[];  // backend may send string[] or {value,label}[]
}

export interface ReportDefinition {
  code:             string;
  name:             string;
  description?:     string;
  source_type:      SourceType;
  source_name:      string;
  allowed_formats:  ExportFormat[];
  default_format:   ExportFormat;
  default_theme?:   string;
  default_style?:   StyleConfig;
  parameter_schema: ParameterField[];
  default_columns:  ReportColumn[];
}

export interface ReportDefinitionsResponse {
  data: Record<string, ReportDefinition[]>;
}

// ── Admin sources catalogue ───────────────────────────────────────────────────

export interface SourceView {
  view:        string;
  category:    string;
  label:       string;
  description: string;
  columns:     string[];
}

// ── Admin ────────────────────────────────────────────────────────────────────

export interface ReportDefinitionAdmin extends ReportDefinition {
  id:         number;
  category:   string;
  sort_order: number;
  is_active:  boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportDefinitionPayload {
  code:             string;
  name:             string;
  description?:     string;
  category:         string;
  sort_order?:      number;
  source_type:      SourceType;
  source_name:      string;
  allowed_formats:  ExportFormat[];
  default_format:   ExportFormat;
  default_theme?:   string;
  parameter_schema: ParameterField[];
  default_columns:  ReportColumn[];
  default_style?:   Record<string, unknown>;
}

// ── Request / Response ───────────────────────────────────────────────────────

export interface ReportRequest {
  source_type:    SourceType;
  source_name:    string;
  parameters?:    Record<string, unknown>;
  filters?:       ReportFilter[];
  filter_logic?:  'AND' | 'OR';
  sort?:          Array<{ column: string; direction: 'asc' | 'desc' }>;
  export_format:  ExportFormat;
  report_name:    string;
  columns?:       ReportColumn[];
  theme?:         string;
  style?:         StyleConfig;
}

export interface ReportPreviewResponse {
  total_rows: number;
  sample:     Record<string, unknown>[];
}
