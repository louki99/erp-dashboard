import apiClient from '@/services/api/client';
import { showPdfGeneratingToast, showPdfReadyToast, showPdfFailedToast } from '@/lib/gcom/pdfReadyToast';

// Extracted from gcomApi.ts (2026-08-26) once the Achats module's PDF
// endpoints (purchase-orders/purchase-receptions/supplier-invoices) turned
// out to run through "the same Document Studio pipeline" as every other GCOM
// document (backend's own words) — same MinIO cache, same async-regeneration
// 202 behavior, same slow-cold-cache case. Reusing this verbatim rather than
// writing a second, simpler version that would silently miss those cases.
//
// Auth is a Bearer token (not a cookie), so a plain <a href> can't carry it —
// fetch as a blob and hand the caller an object URL to open/download instead.
//
// 2026-09-03 — "PDF stays in sync after an edit": a recent mutation can leave
// the document mid-regeneration, in which case this same endpoint returns 202
// with a JSON body (`{ status: 'generating', retry_after_seconds }`) instead of
// the PDF — axios still hands it back as an opaque Blob since we asked for
// responseType: 'blob', so detection has to happen on response.status, not
// content.
//
// 2026-09-03, revised same day: a 202 isn't actually the only slow case —
// live-tested a cold-cache PDF that returned a perfectly normal 200, just
// after 31s (a warm re-request of the exact same document was 2.3s). The
// backend doc only defines 202 for a genuinely in-flight regeneration; a slow
// *synchronous* render on a cache miss is a real, separate case that still
// looks identical to the user (a stuck "Imprimer" button) and needed the same
// treatment. So instead of only reacting to a 202, every request now races
// against PDF_SLOW_THRESHOLD_MS: if it hasn't settled by then — 202 or just
// slow — stop blocking the caller and hand it off to the same background
// path. A 202 that arrives fast still backgrounds immediately (no need to
// wait out the threshold once the status is already known). Not a blocking
// retry loop (an earlier version of this was — reverted after user feedback:
// don't make someone stare at one button for 30-50s, unable to navigate,
// for something they don't need to watch). Callers get `null` back the
// moment this call stops blocking; a toast (`pdfReadyToast.tsx` — kept out of
// this plain .ts file since it needs JSX for the clickable action) lets the
// user open the PDF once it's ready, from wherever they've navigated to
// since. Opening automatically once ready was considered and rejected:
// window.open() outside a direct user gesture (e.g. from a
// setTimeout/promise continuation) gets silently killed by the browser's
// popup blocker — routing it through a toast the user clicks themselves
// sidesteps that entirely. Not wired to the document.pdf.ready WebSocket
// event (documents.{type}.{id}) — polling is simpler and just as correct now
// that nothing blocks on it; the socket event would only save the last few
// seconds before the next poll tick anyway.
const PDF_SLOW_THRESHOLD_MS = 8_000; // don't block the caller past this — background it and notify instead
const PDF_GENERATING_MAX_WAIT_MS = 110_000; // under the backend's 2min safety-net TTL
const PDF_GENERATING_DEFAULT_RETRY_MS = 3_000;

const readRetryAfterMs = async (blob: Blob): Promise<number> => {
    try {
        const body = JSON.parse(await blob.text()) as { retry_after_seconds?: number };
        return body.retry_after_seconds ? body.retry_after_seconds * 1000 : PDF_GENERATING_DEFAULT_RETRY_MS;
    } catch {
        return PDF_GENERATING_DEFAULT_RETRY_MS; // malformed/unexpected body
    }
};

// 2026-09-03 — the PDF endpoints send `Cache-Control: max-age=300, private`
// (live-verified via curl), so the *browser's own* HTTP cache can silently
// serve a 5-minute-old response for an identical URL — completely bypassing
// this file's "always fetch fresh" logic, since the cache hit happens before
// the request ever reaches the network. Live-reproduced: opened a genuinely
// new blob: tab (a real new URL.createObjectURL call, so a fresh network
// layer request had to have happened) that still showed pre-edit data. A
// unique per-request query param defeats browser caching by making every
// request address a URL the cache has never seen, without touching the
// server's own Cache-Control header (reported to backend separately — even
// a short max-age is at odds with a document that can now be edited and
// regenerated at any time).
const withCacheBust = <T extends object>(params: T | undefined): T & { _: string } =>
    ({ ...params, _: Date.now().toString() }) as T & { _: string };

const pollPdfInBackground = async (
    url: string,
    params: Record<string, unknown> | undefined,
    toastId: string,
    firstDelayMs: number,
): Promise<void> => {
    const deadline = Date.now() + PDF_GENERATING_MAX_WAIT_MS;
    let delay = firstDelayMs;
    for (;;) {
        await new Promise(resolve => setTimeout(resolve, delay));
        let response;
        try {
            response = await apiClient.get(url, { responseType: 'blob', params: withCacheBust(params) });
        } catch {
            showPdfFailedToast(toastId, 'Erreur lors de la génération du document.');
            return;
        }
        if (response.status !== 202) {
            showPdfReadyToast(toastId, URL.createObjectURL(response.data as Blob));
            return;
        }
        if (Date.now() >= deadline) {
            showPdfFailedToast(toastId, 'Le document met plus de temps que prévu à se générer — réessayez depuis l’écran.');
            return;
        }
        delay = PDF_GENERATING_DEFAULT_RETRY_MS;
    }
};

// 2026-09-03 — generalized from a (url, priceMode) pair to a plain (url,
// params) pair once the Relevé de Compte PDF needed to reuse this (it takes
// GcomLedgerFilters — {from, to} — not a price mode). Callers that need
// price_mode build that one-key object themselves now.
export const fetchPdfBlobUrl = (url: string, params?: Record<string, unknown>): Promise<string | null> => {
    const requestPromise = apiClient.get(url, { responseType: 'blob', params: withCacheBust(params) });

    return new Promise<string | null>((resolve, reject) => {
        let settled = false;

        // The in-flight request may still resolve into either a real PDF (it was
        // just slow, not a 202) or a genuine 202 — handle both the same way the
        // fast path below would have.
        const backgroundFromHere = (toastId: string) => {
            requestPromise
                .then(async response => {
                    if (response.status !== 202) {
                        showPdfReadyToast(toastId, URL.createObjectURL(response.data as Blob));
                        return;
                    }
                    const retryAfterMs = await readRetryAfterMs(response.data as Blob);
                    void pollPdfInBackground(url, params, toastId, retryAfterMs);
                })
                .catch(() => showPdfFailedToast(toastId, 'Impossible de charger le PDF.'));
        };

        const slowTimer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const toastId = showPdfGeneratingToast('Génération du document en cours… vous serez notifié, vous pouvez continuer à naviguer.');
            backgroundFromHere(toastId);
            resolve(null);
        }, PDF_SLOW_THRESHOLD_MS);

        requestPromise
            .then(async response => {
                if (settled) return; // already handed off to backgroundFromHere above
                clearTimeout(slowTimer);
                settled = true;
                if (response.status !== 202) {
                    resolve(URL.createObjectURL(response.data as Blob));
                    return;
                }
                // A 202 that arrived fast still needs the background treatment —
                // it just skips waiting out the threshold since the status is
                // already known.
                const toastId = showPdfGeneratingToast('Génération du document en cours… vous serez notifié, vous pouvez continuer à naviguer.');
                const retryAfterMs = await readRetryAfterMs(response.data as Blob);
                void pollPdfInBackground(url, params, toastId, retryAfterMs);
                resolve(null);
            })
            .catch(err => {
                if (settled) return; // already backgrounded — its own .catch handles the failure toast
                clearTimeout(slowTimer);
                settled = true;
                reject(err);
            });
    });
};
