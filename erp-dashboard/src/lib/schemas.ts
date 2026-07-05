import { z } from 'zod';

export const reportRequestSchema = z.object({
  source_type:  z.enum(['procedure', 'query', 'view']),
  source_name:  z.string().min(1),
  parameters:   z.record(z.unknown()).optional(),
  filters: z.array(z.object({
    column:   z.string().min(1),
    operator: z.enum([
      'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
      'contains', 'starts_with', 'ends_with',
      'in', 'not_in', 'between', 'is_null', 'is_not_null',
    ]),
    value:    z.unknown().optional(),
    value_to: z.unknown().optional(),
    values:   z.array(z.union([z.string(), z.number()])).optional(),
  })).optional(),
  filter_logic:  z.enum(['AND', 'OR']).optional(),
  sort: z.array(z.object({
    column:    z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  export_format: z.enum(['xlsx', 'csv', 'pdf']),
  report_name:   z.string().min(1),
  theme:         z.string().optional(),
  style:         z.record(z.unknown()).optional(),
});

export const templateCreateSchema = z.object({
  code:             z.string().min(1).max(120),
  name:             z.string().min(1).max(255),
  description:      z.string().optional(),
  document_type:    z.string().max(120).default('custom'),
  page_format:      z.enum(['A4', 'A5', 'letter']).default('A4'),
  page_orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  margin_top:       z.number().default(10),
  margin_right:     z.number().default(10),
  margin_bottom:    z.number().default(10),
  margin_left:      z.number().default(10),
});

const CATEGORIES = ['clients', 'products', 'price_lists', 'sales', 'visits', 'delivery', 'treasury'] as const;
const SOURCE_TYPES = ['view', 'query', 'procedure'] as const;
const FORMATS = ['xlsx', 'csv', 'pdf'] as const;

export const reportDefinitionSchema = z.object({
  code: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_]+$/, 'snake_case uniquement (a-z, 0-9, _)'),
  name:             z.string().min(1).max(255),
  description:      z.string().optional(),
  category:         z.enum(CATEGORIES),
  sort_order:       z.coerce.number().int().min(0).default(0),
  source_type:      z.enum(SOURCE_TYPES),
  source_name:      z.string().min(1),
  allowed_formats:  z.array(z.enum(FORMATS)).min(1, 'Au moins un format requis'),
  default_format:   z.enum(FORMATS),
  default_theme:    z.string().optional(),
  parameter_schema: z.string().default('[]'),   // JSON string — validated on submit
  default_columns:  z.string().default('[]'),   // JSON string
  default_style:    z.string().default('{}'),   // JSON string
});

export type ReportRequestInput     = z.infer<typeof reportRequestSchema>;
export type TemplateCreateInput    = z.infer<typeof templateCreateSchema>;
export type ReportDefinitionInput  = z.infer<typeof reportDefinitionSchema>;

export const REPORT_CATEGORIES = CATEGORIES;
export const REPORT_SOURCE_TYPES = SOURCE_TYPES;
export const REPORT_FORMATS = FORMATS;
