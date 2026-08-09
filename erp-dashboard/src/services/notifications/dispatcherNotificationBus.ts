import type { DispatcherOrderReason } from '@/services/realtime/dispatcherRealtime';

export interface NewBcNotification {
    orderId:     number;
    orderName:   string;
    partnerName: string;
    reason:      DispatcherOrderReason;
    amount?:     number;   // only available after sync — omitted in immediate Reverb-triggered toasts
    arrivedAt:   Date;
}

type Listener = (n: NewBcNotification) => void;

const _listeners = new Set<Listener>();

export function onNewBc(cb: Listener): () => void {
    _listeners.add(cb);
    return () => _listeners.delete(cb);
}

export function emitNewBc(n: NewBcNotification): void {
    _listeners.forEach(l => l(n));
}
