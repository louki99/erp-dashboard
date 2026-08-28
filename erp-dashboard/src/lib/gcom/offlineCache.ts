// IndexedDB cache for the GCOM/back-office heavy referentials (Produits,
// Partenaires, Grilles tarifaires) — same native-IndexedDB pattern as
// src/lib/telesales/offlineDb.ts, but a separate database: this cache backs
// instant-navigation prefetch for desktop back-office screens, not the
// télévendeur's true offline-first mobile flow, and the two have unrelated
// data shapes (full `Product`/`Partner`/`PriceList` entities here, vs the
// slimmed `CatalogSyncProduct`/`PartnerSyncRecord` sync records there).
//
// Schema-only for now — no sync hook wired in yet. Waiting on backend to
// confirm `updated_since`-capable sync endpoints for these 3 resources
// (see [[project_gcom_frontend_perf]]) before building the prefetch-on-login
// + delta-merge logic on top of these stores.

import type { Product } from '@/types/product.types';
import type { Partner } from '@/types/partner.types';
import type { PriceList } from '@/types/pricing.types';

const DB_NAME = 'gcom_offline_cache';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_PARTNERS = 'partners';
const STORE_PRICE_LISTS = 'priceLists';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('IndexedDB unavailable in this environment'));
            return;
        }
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_PRODUCTS)) {
                db.createObjectStore(STORE_PRODUCTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PARTNERS)) {
                db.createObjectStore(STORE_PARTNERS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_PRICE_LISTS)) {
                db.createObjectStore(STORE_PRICE_LISTS, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return dbPromise;
};

const tx = async <T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const putAll = async <T>(storeName: string, records: T[]): Promise<void> => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        records.forEach((r) => store.put(r));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// ─── Products ──────────────────────────────────────────────────────────────

export const putProducts = (products: Product[]): Promise<void> => putAll(STORE_PRODUCTS, products);

export const getAllProducts = (): Promise<Product[]> =>
    tx<Product[]>(STORE_PRODUCTS, 'readonly', (store) => store.getAll());

export const getProductById = (id: number): Promise<Product | undefined> =>
    tx<Product | undefined>(STORE_PRODUCTS, 'readonly', (store) => store.get(id));

export const countProducts = (): Promise<number> =>
    tx<number>(STORE_PRODUCTS, 'readonly', (store) => store.count());

// ─── Partners ──────────────────────────────────────────────────────────────

export const putPartners = (partners: Partner[]): Promise<void> => putAll(STORE_PARTNERS, partners);

export const getAllPartners = (): Promise<Partner[]> =>
    tx<Partner[]>(STORE_PARTNERS, 'readonly', (store) => store.getAll());

export const getPartnerById = (id: number): Promise<Partner | undefined> =>
    tx<Partner | undefined>(STORE_PARTNERS, 'readonly', (store) => store.get(id));

export const countPartners = (): Promise<number> =>
    tx<number>(STORE_PARTNERS, 'readonly', (store) => store.count());

// ─── Price lists ───────────────────────────────────────────────────────────

export const putPriceLists = (priceLists: PriceList[]): Promise<void> => putAll(STORE_PRICE_LISTS, priceLists);

export const getAllPriceLists = (): Promise<PriceList[]> =>
    tx<PriceList[]>(STORE_PRICE_LISTS, 'readonly', (store) => store.getAll());

export const getPriceListById = (id: number): Promise<PriceList | undefined> =>
    tx<PriceList | undefined>(STORE_PRICE_LISTS, 'readonly', (store) => store.get(id));

export const countPriceLists = (): Promise<number> =>
    tx<number>(STORE_PRICE_LISTS, 'readonly', (store) => store.count());

// ─── Meta (per-resource last_synced_at, keyed by store name) ──────────────

interface MetaRecord { key: string; value: string }

export const getMeta = async (key: string): Promise<string | null> => {
    const record = await tx<MetaRecord | undefined>(STORE_META, 'readonly', (store) => store.get(key));
    return record?.value ?? null;
};

export const setMeta = async (key: string, value: string): Promise<void> => {
    await tx(STORE_META, 'readwrite', (store) => store.put({ key, value }));
};

export const META_KEY_PRODUCTS_SYNCED_AT = 'products_last_synced_at';
export const META_KEY_PARTNERS_SYNCED_AT = 'partners_last_synced_at';
export const META_KEY_PRICE_LISTS_SYNCED_AT = 'price_lists_last_synced_at';
