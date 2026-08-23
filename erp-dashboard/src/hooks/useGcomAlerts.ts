import { useCallback, useEffect, useRef, useState } from 'react';
import { gcomApi } from '@/services/api/gcomApi';
import type { GcomAlertsSummary } from '@/types/gcom.types';

// 2026-09-03 — polls GET /gcom/alerts/summary for the notification bell
// (MasterLayout.tsx, previously fully decorative). Simple interval polling,
// not the Reverb private-channel push pattern dispatcherNotificationBus.ts
// uses for real-time dispatcher alerts — deliberately chosen as the MVP when
// we asked backend about this (see backend_reply_notification_system.md):
// these categories (overdue invoices, uninvoiced BLs, etc.) don't need
// second-by-second freshness the way a new BC does, and polling is simpler to
// ship on both ends. Revisit if that stops being true.
const POLL_INTERVAL_MS = 5 * 60 * 1000;

export function useGcomAlerts(enabled: boolean) {
    const [alerts, setAlerts] = useState<GcomAlertsSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const refresh = useCallback(async () => {
        if (!enabled) return;
        setLoading(true);
        try {
            setAlerts(await gcomApi.alerts.summary());
        } catch {
            // Silent — a failed poll shouldn't pop an error toast on every page
            // load; the bell just keeps showing its last-known (or no) count.
        } finally {
            setLoading(false);
        }
    }, [enabled]);

    useEffect(() => {
        if (!enabled) {
            setAlerts(null);
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            return;
        }
        refresh();
        timerRef.current = setInterval(refresh, POLL_INTERVAL_MS);
        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return { alerts, loading, refresh };
}
