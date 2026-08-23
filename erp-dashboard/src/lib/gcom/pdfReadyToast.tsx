import toast from 'react-hot-toast';
import { Loader2, CheckCircle2, AlertTriangle, Download, X } from 'lucide-react';

// Split out from gcomApi.ts (a plain .ts file — no JSX there) so a PDF stuck
// "generating" server-side (see fetchPdfBlobUrl's comment) can notify with a
// real clickable action once ready, instead of blocking the calling page for
// up to two minutes. Opening the PDF must happen on a direct click — a
// background poll calling window.open() automatically once it resolves gets
// silently killed by the browser's popup blocker, since it isn't the direct
// result of a user gesture. Routing it through a toast the user clicks
// themselves sidesteps that entirely.
//
// Custom card (not the default toast.loading/success one-liner) to match this
// app's existing toast convention — see DispatcherNewOrderAlert.tsx's BcToast:
// icon badge + title/subtitle + dismiss, white card, rounded-xl, shadow-2xl.
// All three states share one `id` so a toast.custom() re-invocation with that
// id updates the same card in place instead of stacking a new one.

const CARD_BASE =
    'flex items-start gap-3 bg-white dark:bg-gray-900 shadow-2xl border border-gray-100 ' +
    'dark:border-gray-800 rounded-xl px-4 py-3 w-80 transition-all duration-300';

const cardClass = (visible: boolean) => `${CARD_BASE} ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`;

export const showPdfGeneratingToast = (message: string): string => {
    const toastId = toast.custom(
        t => (
            <div className={cardClass(t.visible)}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-sage-600 flex items-center justify-center shadow">
                    <Loader2 size={16} className="text-white animate-spin" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-sage-600 mb-0.5">Document GCOM</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{message}</p>
                    <div className="mt-2 h-1 w-full rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                            className="h-full w-1/3 rounded-full bg-sage-500"
                            style={{ animation: 'pdf-toast-indeterminate 1.3s ease-in-out infinite' }}
                        />
                    </div>
                </div>
            </div>
        ),
        { duration: Infinity },
    );
    return toastId;
};

export const showPdfReadyToast = (toastId: string, blobUrl: string) => {
    toast.custom(
        t => (
            <div className={cardClass(t.visible)}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center shadow">
                    <CheckCircle2 size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-0.5">Document prêt</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">Le document a fini de se générer.</p>
                    <button
                        onClick={() => { window.open(blobUrl, '_blank'); toast.dismiss(toastId); }}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors"
                    >
                        <Download size={12} /> Ouvrir le PDF
                    </button>
                </div>
                <button
                    onClick={() => toast.dismiss(toastId)}
                    className="shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        ),
        // Persistent — the user asked not to have this auto-dismiss before
        // they've had a chance to click "Ouvrir" (e.g. mid-navigation, not
        // looking at the toast when it lands). Stays until "Ouvrir" or the
        // manual X dismiss it.
        { id: toastId, duration: Infinity },
    );
};

export const showPdfFailedToast = (toastId: string, message: string) => {
    toast.custom(
        t => (
            <div className={cardClass(t.visible)}>
                <div className="shrink-0 w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center shadow">
                    <AlertTriangle size={16} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-0.5">Échec de génération</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">{message}</p>
                </div>
                <button
                    onClick={() => toast.dismiss(toastId)}
                    className="shrink-0 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        ),
        { id: toastId, duration: 8000 },
    );
};
