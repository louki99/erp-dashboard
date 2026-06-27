// Document print/download — MinIO pre-signed URL flow (docs §12e, 2026-06-24).
//
// Flow: click → modal loading → GET /url → modal "ready" → user clicks
//   [Ouvrir / Imprimer] or [Télécharger] inside the modal.
//
// No automatic window.open / redirect. The modal stays on screen so the user
// decides what to do with the document. window.open fires from the button click
// inside the modal (synchronous user gesture) so popup blockers never trigger.

import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import apiClient from '@/services/api/client';
import { PdfProgressModal } from '@/components/common/PdfProgressModal';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PdfDocType = 'bc' | 'bp' | 'bl' | 'mission';

export interface PdfOpts {
  /** Re-render even if a cached PDF exists. Always pass after mutations. */
  force?:     boolean;
  /** Diagonal stamp overlay, e.g. "DRAFT", "ANNULÉ". */
  watermark?: string;
  /** Hide unit prices — warehouse copy of a BL. */
  prices?:    boolean;
}

interface PresignedUrlResponse {
  url:        string;
  expires_at: string;
  ttl:        number;
  type:       string;
  id:         number;
}

// ─── Modal singleton ────────────────────────────────────────────────────────────

let _root:      Root | null        = null;
let _container: HTMLDivElement | null = null;

const getRoot = (): Root => {
  if (!_container) {
    _container = document.createElement('div');
    _container.id = 'pdf-modal-root';
    document.body.appendChild(_container);
    _root = createRoot(_container);
  }
  return _root!;
};

const renderModal = (
  status:       'loading' | 'ready' | 'error',
  docType:      PdfDocType,
  extra:        { presignedUrl?: string; errorMessage?: string } = {}
) => {
  getRoot().render(
    createElement(PdfProgressModal, {
      status,
      docType,
      presignedUrl: extra.presignedUrl,
      errorMessage: extra.errorMessage,
      onClose:      clearModal,
    })
  );
};

const clearModal = () => getRoot().render(null);

// ─── Helpers ────────────────────────────────────────────────────────────────────

const buildQs = (opts: PdfOpts): string => {
  const p = new URLSearchParams();
  if (opts.force)            p.set('force', '1');
  if (opts.watermark)        p.set('watermark', opts.watermark);
  if (opts.prices === false) p.set('prices', '0');
  const s = p.toString();
  return s ? `?${s}` : '';
};

const fetchPresignedUrl = async (type: PdfDocType, id: number, opts: PdfOpts): Promise<string> => {
  const { data } = await apiClient.get<PresignedUrlResponse>(
    `/api/backend/documents/${type}/${id}/url${buildQs(opts)}`
  );
  return data.url;
};

const extractError = (err: unknown): string => {
  const e = err as any;
  if (e?.response?.status === 410) return "Ce type de document n'est plus disponible.";
  return e?.response?.data?.message ?? 'Impossible de générer le PDF.';
};

// ─── Public API ─────────────────────────────────────────────────────────────────

/**
 * Show the PDF modal for a document.
 *
 * 1. Modal appears immediately in "loading" state.
 * 2. GET /url fetches the 15-min pre-signed MinIO URL.
 * 3. Modal transitions to "ready" — user sees [Ouvrir / Imprimer] + [Télécharger].
 * 4. Clicking either button performs the action and closes the modal.
 *
 * Both openPdf and downloadPdf show the same modal — the user always gets both
 * options regardless of which button they originally clicked.
 */
const showPdfModal = (type: PdfDocType, id: number, opts: PdfOpts = {}): void => {
  renderModal('loading', type);

  fetchPresignedUrl(type, id, opts)
    .then((url) => renderModal('ready', type, { presignedUrl: url }))
    .catch((err) => renderModal('error', type, { errorMessage: extractError(err) }));
};

/** Open the PDF modal (print-oriented entry point — same modal as downloadPdf). */
export const openPdf = (type: PdfDocType, id: number, opts: PdfOpts = {}): void =>
  showPdfModal(type, id, opts);

/** Open the PDF modal (download-oriented entry point — same modal as openPdf). */
export const downloadPdf = (type: PdfDocType, id: number, opts: PdfOpts = {}): void =>
  showPdfModal(type, id, opts);
