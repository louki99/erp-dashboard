import { fetchDispatcherSync } from '@/services/api/dispatcherSyncApi';
import {
    db_upsertOrders,
    db_removeOrders,
    db_getSyncCursor,
    db_setSyncCursor,
} from '@/services/db/dispatcherDb';

export interface SyncResult {
    upserted: number;
    removed:  number;
    cursor:   string;
}

// Prevent concurrent sync calls — queue a single follow-up if one is already running
let syncInFlight = false;
let syncQueued   = false;

export async function runDispatcherSync(): Promise<SyncResult> {
    if (syncInFlight) {
        syncQueued = true;
        return { upserted: 0, removed: 0, cursor: '' };
    }

    syncInFlight = true;
    try {
        const cursor   = await db_getSyncCursor();
        const response = await fetchDispatcherSync(cursor);

        const { updated, removed_ids } = response.orders;
        await db_upsertOrders(updated);
        await db_removeOrders(removed_ids);
        await db_setSyncCursor(response.server_time);

        return { upserted: updated.length, removed: removed_ids.length, cursor: response.server_time };
    } finally {
        syncInFlight = false;
        if (syncQueued) {
            syncQueued = false;
            // fire-and-forget the queued sync
            runDispatcherSync().catch(() => {});
        }
    }
}
