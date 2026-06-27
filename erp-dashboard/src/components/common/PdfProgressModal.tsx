import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, FileText, Printer, Download, X } from 'lucide-react';
import type { PdfDocType } from '@/utils/pdfUtils';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type PdfModalStatus = 'loading' | 'ready' | 'error';

export interface PdfProgressModalProps {
  status: PdfModalStatus;
  docType: PdfDocType;
  /** Pre-signed MinIO URL — present only when status === 'ready'. */
  presignedUrl?: string;
  errorMessage?: string;
  onClose: () => void;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const DOC_META: Record<PdfDocType, { label: string; badge: string }> = {
  bc: { label: 'Bon de Commande', badge: 'bg-indigo-100 text-indigo-700 ring-indigo-200' },
  bp: { label: 'Bon de Préparation', badge: 'bg-blue-100   text-blue-700   ring-blue-200' },
  bl: { label: 'Bon de Livraison', badge: 'bg-emerald-100 text-emerald-700 ring-emerald-200' },
  mission: { label: 'Mission de livraison', badge: 'bg-violet-100 text-violet-700 ring-violet-200' },
};

const STEPS = [
  'Connexion au service documentaire…',
  'Préparation des données…',
  'Génération du lien sécurisé…',
];

// ─── Sub-components ────────────────────────────────────────────────────────────

const IndeterminateBar = () => (
  <div className="relative mt-6 h-1 rounded-full bg-gray-100 overflow-hidden w-full">
    <style>{`
      @keyframes pdf-slide {
        0%   { left: -55%; width: 55%; }
        100% { left: 110%; width: 55%; }
      }
    `}</style>
    <div
      className="absolute top-0 bottom-0 rounded-full bg-gradient-to-r from-sage-500 via-sage-600 to-sage-500"
      style={{ animation: 'pdf-slide 1.5s cubic-bezier(0.4,0,0.6,1) infinite' }}
    />
  </div>
);

// ─── Main component ────────────────────────────────────────────────────────────

export const PdfProgressModal = ({
  status,
  docType,
  presignedUrl,
  errorMessage,
  onClose,
}: PdfProgressModalProps) => {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // Enter animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 10);
    return () => clearTimeout(t);
  }, []);

  // Cycle loading steps
  useEffect(() => {
    if (status !== 'loading') return;
    const id = setInterval(() => setStepIdx(i => (i + 1) % STEPS.length), 1300);
    return () => clearInterval(id);
  }, [status]);

  const triggerClose = () => {
    setClosing(true);
    setTimeout(onClose, 220);
  };

  const handleOpen = () => {
    if (!presignedUrl) return;
    window.open(presignedUrl, '_blank');
    triggerClose();
  };

  const handleDownload = () => {
    if (!presignedUrl) return;
    const a = document.createElement('a');
    a.href = presignedUrl;
    const ext = docType.toUpperCase();
    a.download = `${ext}-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    triggerClose();
  };

  const visible = mounted && !closing;
  const meta = DOC_META[docType];

  // ── Accent strip color per status ────────────────────────────────────────────
  const accentCls =
    status === 'loading' ? 'bg-gradient-to-r from-sage-500 to-sage-700' :
      status === 'ready' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' :
        'bg-gradient-to-r from-red-400 to-rose-500';

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4
        transition-all duration-200
        ${visible ? 'bg-black/50 backdrop-blur-sm' : 'bg-black/0 backdrop-blur-none'}`}
    >
      <div
        className={`relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden
          transition-all duration-200
          ${visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}`}
      >
        {/* Accent strip */}
        <div className={`h-1 w-full ${accentCls}`} />

        {/* Close button — only when not loading */}
        {status !== 'loading' && (
          <button
            onClick={triggerClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-300 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="px-8 py-8 flex flex-col items-center text-center">

          {/* Document type badge */}
          <span className={`mb-5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ring-1 ${meta.badge}`}>
            <FileText className="w-3 h-3" />
            {meta.label}
          </span>

          {/* ── LOADING ── */}
          {status === 'loading' && (
            <>
              <div className="relative mb-5 w-16 h-16">
                <span className="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin" />
                <span className="absolute inset-[10px] rounded-full border-4 border-blue-100 border-b-blue-400 animate-spin [animation-direction:reverse] [animation-duration:0.85s]" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-indigo-500 animate-pulse" />
                </span>
              </div>

              <h3 className="text-base font-bold text-gray-900 mb-1">Génération du document</h3>

              <p
                key={stepIdx}
                className="text-xs text-gray-400 min-h-[1.5rem]"
                style={{ animation: 'pdf-fadein 0.4s ease both' }}
              >
                <style>{`
                  @keyframes pdf-fadein {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0);   }
                  }
                `}</style>
                {STEPS[stepIdx]}
              </p>

              <IndeterminateBar />
            </>
          )}

          {/* ── READY ── */}
          {status === 'ready' && (
            <>
              <style>{`
                @keyframes pdf-pop {
                  from { opacity: 0; transform: scale(0.3); }
                  to   { opacity: 1; transform: scale(1);   }
                }
              `}</style>

              <CheckCircle2
                className="w-14 h-14 text-emerald-500 mb-4"
                style={{ animation: 'pdf-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}
              />

              <h3 className="text-base font-bold text-gray-900 mb-1">Document prêt !</h3>
              <p className="text-xs text-gray-400 mb-6">
                Choisissez une action pour ce document.
              </p>

              {/* Action buttons */}
              <div className="w-full flex flex-col gap-2.5">
                <button
                  onClick={handleOpen}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl
                    bg-sage-500 hover:bg-sage-600 active:scale-[0.98]
                    text-white text-sm font-semibold shadow-sm transition-all"
                >
                  <Printer className="w-4 h-4" />
                  Ouvrir
                </button>

                <button
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl
                    bg-gray-100 hover:bg-gray-200 active:scale-[0.98]
                    text-gray-700 text-sm font-semibold transition-all"
                >
                  <Download className="w-4 h-4" />
                  Télécharger
                </button>
              </div>

              <button
                onClick={triggerClose}
                className="mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Annuler
              </button>
            </>
          )}

          {/* ── ERROR ── */}
          {status === 'error' && (
            <>
              <XCircle
                className="w-14 h-14 text-red-500 mb-4"
                style={{ animation: 'pdf-pop 0.3s cubic-bezier(0.34,1.56,0.64,1) both' }}
              />

              <h3 className="text-base font-bold text-red-700 mb-1">Erreur de génération</h3>
              <p className="text-xs text-gray-500 leading-snug max-w-[220px]">
                {errorMessage ?? "Une erreur inattendue s'est produite."}
              </p>

              <button
                onClick={triggerClose}
                className="mt-6 w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-700
                  text-white text-sm font-semibold transition-colors"
              >
                Fermer
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfProgressModal;
