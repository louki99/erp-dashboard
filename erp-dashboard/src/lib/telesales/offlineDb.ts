// Minimal native IndexedDB wrapper for the télévendeur offline cache (docs §4.4).
// No external dependency — two stores (products, partners) + a meta store for
// sync timestamps. Catalogue and partners are cached separately (catalogue is
// shared across agents, partners are per-agent) and combined at read time by
// the price resolver (see priceResolver.ts).

import type { CatalogSyncProduct, PartnerSyncRecord } from '@/types/telesalesAgent.types';

const DB_NAME = 'telesales_offline';
const DB_VERSION = 1;
const STORE_PRODUCTS = 'products';
const STORE_PARTNERS = 'partners';
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

export const putProducts = async (products: CatalogSyncProduct[]): Promise<void> => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_PRODUCTS, 'readwrite');
        const store = transaction.objectStore(STORE_PRODUCTS);
        products.forEach((p) => store.put(p));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getAllProducts = (): Promise<CatalogSyncProduct[]> =>
    tx<CatalogSyncProduct[]>(STORE_PRODUCTS, 'readonly', (store) => store.getAll());

export const countProducts = (): Promise<number> =>
    tx<number>(STORE_PRODUCTS, 'readonly', (store) => store.count());

export const putPartners = async (partners: PartnerSyncRecord[]): Promise<void> => {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_PARTNERS, 'readwrite');
        const store = transaction.objectStore(STORE_PARTNERS);
        partners.forEach((p) => store.put(p));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getAllPartners = (): Promise<PartnerSyncRecord[]> =>
    tx<PartnerSyncRecord[]>(STORE_PARTNERS, 'readonly', (store) => store.getAll());

export const getPartnerById = (id: number): Promise<PartnerSyncRecord | undefined> =>
    tx<PartnerSyncRecord | undefined>(STORE_PARTNERS, 'readonly', (store) => store.get(id));

export const countPartners = (): Promise<number> =>
    tx<number>(STORE_PARTNERS, 'readonly', (store) => store.count());

interface MetaRecord { key: string; value: string }

export const getMeta = async (key: string): Promise<string | null> => {
    const record = await tx<MetaRecord | undefined>(STORE_META, 'readonly', (store) => store.get(key));
    return record?.value ?? null;
};

export const setMeta = async (key: string, value: string): Promise<void> => {
    await tx(STORE_META, 'readwrite', (store) => store.put({ key, value }));
};
