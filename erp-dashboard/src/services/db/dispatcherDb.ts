import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { DispatcherOrder } from '@/types/dispatcher.types';

interface DispatcherDBSchema extends DBSchema {
    orders: { key: number; value: DispatcherOrder };
    meta:   { key: string; value: string };
}

const DB_NAME    = 'erp-dispatcher';
const DB_VERSION = 1;

let _db: Promise<IDBPDatabase<DispatcherDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<DispatcherDBSchema>> {
    if (!_db) {
        _db = openDB<DispatcherDBSchema>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('orders')) db.createObjectStore('orders', { keyPath: 'id' });
                if (!db.objectStoreNames.contains('meta'))   db.createObjectStore('meta');
            },
        });
    }
    return _db;
}

export async function db_getAllOrders(): Promise<DispatcherOrder[]> {
    return (await getDb()).getAll('orders');
}

export async function db_upsertOrders(orders: DispatcherOrder[]): Promise<void> {
    if (orders.length === 0) return;
    const db = await getDb();
    const tx = db.transaction('orders', 'readwrite');
    await Promise.all(orders.map(o => tx.store.put(o)));
    await tx.done;
}

export async function db_removeOrders(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const db = await getDb();
    const tx = db.transaction('orders', 'readwrite');
    await Promise.all(ids.map(id => tx.store.delete(id)));
    await tx.done;
}

export async function db_getSyncCursor(): Promise<string | undefined> {
    const db = await getDb();
    const val = await db.get('meta', 'sync_cursor');
    return val ?? undefined;
}

export async function db_setSyncCursor(cursor: string): Promise<void> {
    await (await getDb()).put('meta', cursor, 'sync_cursor');
}

export async function db_clearOrders(): Promise<void> {
    const db = await getDb();
    await db.clear('orders');
    await db.delete('meta', 'sync_cursor');
}
