/**
 * useGcomDraft
 * ─────────────────────────────────────────────────────────────────────────────
 * Autosaves an in-progress GCOM creation form (BC/BL/Devis/Comptoir) to
 * IndexedDB so a token expiry (hard logout, see apiClient's 401 handler) or
 * an accidental refresh doesn't wipe out several minutes of line-item entry.
 *
 * Modeled on `usePartnerDraft.ts`'s IndexedDB architecture (same storage
 * mechanism, for consistency), but simpler: unlike Partners, a GCOM creation
 * screen only ever has ONE relevant in-progress draft at a time (keyed by
 * `draftKey`, e.g. "gcom-bc-create"), so this is a single-slot get/save/clear
 * rather than a list. Also unlike Partners' manual "Save as draft" button,
 * this autosaves automatically (debounced) — the goal here is protecting
 * against involuntary loss, not a deliberate pause-and-resume-later flow.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface GcomDraft {
    /** = draftKey, unique per screen (e.g. "gcom-bc-create") */
    id: string;
    partnerName: string;
    data: Record<string, unknown>;
    savedAt: string; // ISO-8601
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME = 'erp_gcom_drafts';
const STORE_NAME = 'drafts';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = e => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = e => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror = () => reject(req.error);
    });
}

function idbGet(db: IDBDatabase, id: string): Promise<GcomDraft | undefined> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as GcomDraft | undefined);
        req.onerror = () => reject(req.error);
    });
}

function idbPut(db: IDBDatabase, draft: GcomDraft): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseGcomDraftResult {
    /** The one draft saved under this screen's key, if any. `null` once dismissed/restored. */
    draft: GcomDraft | null;
    loading: boolean;
    /** Debounced write — safe to call on every render/change. */
    saveDraft: (data: Record<string, unknown>, partnerName: string) => void;
    /** Remove the draft and stop offering to restore it this session. */
    clearDraft: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 1500;

export function useGcomDraft(draftKey: string | undefined): UseGcomDraftResult {
    const [draft, setDraft] = useState<GcomDraft | null>(null);
    const [loading, setLoading] = useState(!!draftKey);
    const dbRef = useRef<IDBDatabase | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const getDb = useCallback(async (): Promise<IDBDatabase> => {
        if (!dbRef.current) dbRef.current = await openDB();
        return dbRef.current;
    }, []);

    // Load once on mount (or when draftKey becomes available/changes).
    useEffect(() => {
        if (!draftKey) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            try {
                const db = await getDb();
                const found = await idbGet(db, draftKey);
                if (!cancelled) setDraft(found ?? null);
            } catch (err) {
                console.warn('[useGcomDraft] read error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    const clearDraft = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setDraft(null);
        if (!draftKey) return;
        getDb().then(db => idbDelete(db, draftKey)).catch(() => {});
    }, [draftKey, getDb]);

    const saveDraft = useCallback((data: Record<string, unknown>, partnerName: string) => {
        if (!draftKey) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            getDb()
                .then(db => idbPut(db, { id: draftKey, partnerName, data, savedAt: new Date().toISOString() }))
                .catch(err => console.warn('[useGcomDraft] write error:', err));
        }, AUTOSAVE_DEBOUNCE_MS);
    }, [draftKey, getDb]);

    useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

    return { draft, loading, saveDraft, clearDraft };
}

/** Human-readable relative time (e.g. "il y a 5 min") — same convention as usePartnerDraft's. */
export function draftRelativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1) return 'à l\'instant';
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
}
