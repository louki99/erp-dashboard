export type ExportFormat = 'xlsx' | 'csv' | 'pdf';
export type SourceType  = 'procedure' | 'query';

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
