/**
 * Centralised API endpoint registry.
 * All paths are relative to the Laravel gateway baseURL (VITE_API_BASE_URL).
 * The baseURL already includes the host — no need to repeat it here.
 *
 * Security rule: NEVER add X-API-Key here or anywhere in frontend code.
 * Laravel injects it server-side before forwarding to the FastAPI microservice.
 */

export const ENDPOINTS = {
  // ── Document Studio ────────────────────────────────────────────────────────
  DOCUMENT_STUDIO_TEMPLATES:    '/api/v1/document-studio/templates',
  DOCUMENT_STUDIO_ASSETS:       '/api/v1/document-studio/assets',

  RENDER_PREVIEW:                '/api/v1/document-studio/render/preview',
  RENDER_STREAM:                 '/api/v1/document-studio/render/generate/stream',

  /** Append `/${id}` when calling */
  RENDER_GENERATE_ORDER:         '/api/v1/document-studio/render/generate/order',
  RENDER_GENERATE_DELIVERY_NOTE: '/api/v1/document-studio/render/generate/delivery_note',
  RENDER_GENERATE_INVOICE:       '/api/v1/document-studio/render/generate/invoice',

  // ── Reporting ──────────────────────────────────────────────────────────────
  REPORTING_DEFINITIONS:         '/api/v1/reporting/definitions',
  REPORTING_THEMES:              '/api/v1/reporting/themes',
  REPORTING_PREVIEW:             '/api/v1/reporting/preview',
  REPORTING_EXPORT:              '/api/v1/reporting/export',
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;
