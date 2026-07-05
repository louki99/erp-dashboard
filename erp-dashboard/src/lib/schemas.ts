import { z } from 'zod';

export const reportRequestSchema = z.object({
  source_type:  z.enum(['procedure', 'query']),
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

export type ReportRequestInput   = z.infer<typeof reportRequestSchema>;
export type TemplateCreateInput  = z.infer<typeof templateCreateSchema>;
