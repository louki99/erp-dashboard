import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

// Reverb config (dev — matches backend message exactly)
const REVERB_CONFIG = {
    broadcaster:       'reverb' as const,
    key:               '0rgxohnb3wdhyuxvkphs',
    wsHost:            'localhost',
    wsPort:            8080,
    forceTLS:          false,
    enabledTransports: ['ws'] as string[],
    authEndpoint:      'http://localhost:8000/broadcasting/auth',
};

export type DispatcherOrderReason =
    | 'validated_by_adv'       // BC confirmed by ADV — appears in dispatcher workspace
    | 'rejected'               // BC rejected — disappears from workspace
    | 'cancelled'              // BC cancelled — disappears from workspace
    | 'converted_to_mission'   // BC converted to BL + assigned to a mission
    | 'mission_assigned'       // mission assignment only (no status change)
    | 'status_changed';        // generic fallback

export interface OrderUpdatedPayload {
    order_id:     number;
    branch_id:    number | string;
    is_pending:   boolean;
    reason:       DispatcherOrderReason;
    order_code:   string;      // BC reference code — for immediate toast display
    partner_name: string;      // customer name — for immediate toast display
    changed_at:   string;
}

let _echo: Echo | null = null;

function getEcho(): Echo {
    if (_echo) return _echo;
    const token = localStorage.getItem('erp_token') ?? '';
    // pusher-js must be on window before Echo instantiates
    (window as any).Pusher = Pusher;
    _echo = new Echo({
        ...REVERB_CONFIG,
        auth: { headers: { Authorization: `Bearer ${token}` } },
    });
    return _echo;
}

type Callback = (payload: OrderUpdatedPayload) => void;

/**
 * Subscribe to the dispatcher branch channel.
 * branchId null → falls back to the company-wide "all" channel.
 * Returns an unsubscribe function; call it in useEffect cleanup.
 * Connection errors are swallowed — the app degrades to polling only.
 */
export function subscribeToDispatcherChannel(
    branchId: number | string | null,
    onOrderUpdated: Callback,
): () => void {
    let channel: ReturnType<Echo['private']> | null = null;
    try {
        const echo       = getEcho();
        const channelKey = branchId != null
            ? `dispatcher.branch.${branchId}`
            : 'dispatcher.branch.all';
        channel = echo.private(channelKey);
        channel.listen('.order.updated', onOrderUpdated);
    } catch (err) {
        // Reverb not running in this env — real-time unavailable, sync still works
        console.warn('[dispatcher:realtime] WebSocket unavailable:', err);
    }

    return () => {
        try {
            if (channel) {
                const channelKey = branchId != null
                    ? `dispatcher.branch.${branchId}`
                    : 'dispatcher.branch.all';
                _echo?.leave(channelKey);
            }
        } catch {}
    };
}

export function disconnectDispatcherRealtime(): void {
    try { _echo?.disconnect(); } catch {}
    _echo = null;
}
