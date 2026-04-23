/**
 * usePartnerDraft
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages partner form drafts persisted in IndexedDB so users can safely
 * navigate away mid-form and resume later.
 *
 * Architecture
 * ────────────
 * • One IndexedDB database (`erp_partner_drafts`) with a single object store
 *   (`drafts`) keyed by `id`.
 * • The hook returns the live list of drafts and async helpers (save / delete).
 * • Because both PartnerFormPanel and PartnerManagementPage use this hook
 *   independently, call `refresh()` after the form closes to sync the
 *   notification banner.
 *
 * Draft ID conventions
 * ────────────────────
 * • create mode  → caller generates `draft-create-<timestamp>` on first mount
 * • edit mode    → `draft-edit-<partnerId>`
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Schema ───────────────────────────────────────────────────────────────────

export interface PartnerDraft {
    /** Unique key in IndexedDB */
    id: string;
    mode: 'create' | 'edit';
    partnerId?: number;
    /** Display name shown in the notification banner */
    partnerName: string;
    /** Serialised form state snapshots */
    auth:    Record<string, unknown>;
    pForm:   Record<string, unknown>;
    cfForm:  Record<string, string>;
    savedAt: string; // ISO-8601
}

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

const DB_NAME    = 'erp_partner_drafts';
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
        req.onsuccess = e  => resolve((e.target as IDBOpenDBRequest).result);
        req.onerror   = () => reject(req.error);
    });
}

function idbGetAll(db: IDBDatabase): Promise<PartnerDraft[]> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
        req.onsuccess = () => resolve(req.result as PartnerDraft[]);
        req.onerror   = () => reject(req.error);
    });
}

function idbPut(db: IDBDatabase, draft: PartnerDraft): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(draft);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

function idbDelete(db: IDBDatabase, id: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UsePartnerDraftResult {
    /** All drafts sorted newest-first */
    drafts:      PartnerDraft[];
    loading:     boolean;
    hasDrafts:   boolean;
    /** Upsert a draft (adds `savedAt` automatically) */
    saveDraft:   (draft: Omit<PartnerDraft, 'savedAt'>) => Promise<void>;
    /** Remove a single draft (e.g. after successful save) */
    deleteDraft: (id: string) => Promise<void>;
    /** Force a fresh read from IndexedDB */
    refresh:     () => Promise<void>;
}

export function usePartnerDraft(): UsePartnerDraftResult {
    const [drafts,  setDrafts]  = useState<PartnerDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const dbRef = useRef<IDBDatabase | null>(null);

    const getDb = useCallback(async (): Promise<IDBDatabase> => {
        if (!dbRef.current) dbRef.current = await openDB();
        return dbRef.current;
    }, []);

    const refresh = useCallback(async () => {
        try {
            const db  = await getDb();
            const all = await idbGetAll(db);
            all.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
            setDrafts(all);
        } catch (err) {
            console.warn('[usePartnerDraft] read error:', err);
        } finally {
            setLoading(false);
        }
    }, [getDb]);

    // Load on mount
    useEffect(() => { refresh(); }, [refresh]);

    const saveDraft = useCallback(async (draft: Omit<PartnerDraft, 'savedAt'>) => {
        const db = await getDb();
        await idbPut(db, { ...draft, savedAt: new Date().toISOString() });
        await refresh();
    }, [getDb, refresh]);

    const deleteDraft = useCallback(async (id: string) => {
        const db = await getDb();
        await idbDelete(db, id);
        setDrafts(prev => prev.filter(d => d.id !== id));
    }, [getDb]);

    return {
        drafts,
        loading,
        hasDrafts: drafts.length > 0,
        saveDraft,
        deleteDraft,
        refresh,
    };
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Human-readable relative time (e.g. "il y a 5 min") */
export function draftRelativeTime(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const m = Math.floor(diff / 60_000);
    if (m < 1)  return 'à l\'instant';
    if (m < 60) return `il y a ${m} min`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h}h`;
    return `il y a ${Math.floor(h / 24)}j`;
}
