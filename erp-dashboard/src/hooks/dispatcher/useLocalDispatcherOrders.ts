import { useState, useEffect, useCallback, useRef } from 'react';
import type { DispatcherOrder } from '@/types/dispatcher.types';
import { db_getAllOrders, db_clearOrders } from '@/services/db/dispatcherDb';
import { runDispatcherSync } from '@/services/sync/dispatcherSync';
import { subscribeToDispatcherChannel } from '@/services/realtime/dispatcherRealtime';
import { emitNewBc } from '@/services/notifications/dispatcherNotificationBus';
import { useAuth } from '@/context/AuthContext';

export interface LocalDispatcherOrdersState {
    orders:    DispatcherOrder[];
    loading:   boolean;   // true only before any local data is available
    syncing:   boolean;   // true during background delta sync
    error:     string | null;
    lastSync:  Date | null;
    refetch:   () => void;
    hardReset: () => Promise<void>;
}

export function useLocalDispatcherOrders(): LocalDispatcherOrdersState {
    const { user }  = useAuth();
    const mounted   = useRef(true);

    const [orders,   setOrders]   = useState<DispatcherOrder[]>([]);
    const [loading,  setLoading]  = useState(true);
    const [syncing,  setSyncing]  = useState(false);
    const [error,    setError]    = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    // Pure data sync — no notification side-effects here.
    // Notifications are fired immediately from the Reverb event payload (see below).
    const sync = useCallback(async () => {
        if (!mounted.current) return;
        setSyncing(true);
        setError(null);
        try {
            await runDispatcherSync();
            const local = await db_getAllOrders();
            if (!mounted.current) return;
            setOrders(local);
            setLastSync(new Date());
        } catch (err: any) {
            if (mounted.current) {
                setError(err?.response?.data?.message ?? err?.message ?? 'Erreur de synchronisation');
            }
        } finally {
            if (mounted.current) {
                setSyncing(false);
                setLoading(false);
            }
        }
    }, []);

    const hardReset = useCallback(async () => {
        await db_clearOrders();
        if (mounted.current) setOrders([]);
        await sync();
    }, [sync]);

    // Boot: load IndexDB instantly → drop spinner → sync delta in background
    useEffect(() => {
        mounted.current = true;
        (async () => {
            const local = await db_getAllOrders();
            if (mounted.current) {
                setOrders(local);
                if (local.length > 0) setLoading(false);
            }
            await sync();
        })();
        return () => { mounted.current = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Real-time: Reverb event → immediate notification (no sync wait) + background sync
    useEffect(() => {
        // branch.id added to user payload on 2026-08-07 — scoped channel when available
        const branchId = user?.branch?.id ?? null;

        const unsubscribe = subscribeToDispatcherChannel(branchId, (signal) => {
            // Emit toast immediately from payload fields — no need to wait for sync
            if (signal.is_pending && signal.reason === 'validated_by_adv') {
                emitNewBc({
                    orderId:     signal.order_id,
                    orderName:   signal.order_code,
                    partnerName: signal.partner_name,
                    reason:      signal.reason,
                    arrivedAt:   new Date(),
                });
            }
            // Always sync to keep IndexDB current
            sync();
        });

        return unsubscribe;
    }, [user?.branch?.id, sync]);

    return { orders, loading, syncing, error, lastSync, refetch: sync, hardReset };
}
