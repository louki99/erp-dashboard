import { useEffect, useRef, useState } from 'react';
import { WrenchIcon } from 'lucide-react';

export function MaintenanceBanner() {
    const [visible, setVisible]     = useState(false);
    const [countdown, setCountdown] = useState(0);
    const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const onMaintenance = (e: Event) => {
            const { retryAfter } = (e as CustomEvent<{ retryAfter: number }>).detail;
            setVisible(true);
            setCountdown(retryAfter > 0 ? retryAfter : 15);
        };
        const onClear = () => {
            setVisible(false);
            setCountdown(0);
        };

        window.addEventListener('app:maintenance', onMaintenance);
        window.addEventListener('app:maintenance:clear', onClear);
        return () => {
            window.removeEventListener('app:maintenance', onMaintenance);
            window.removeEventListener('app:maintenance:clear', onClear);
        };
    }, []);

    // Countdown tick — resets each time visible or countdown changes
    useEffect(() => {
        if (!visible || countdown <= 0) return;

        tickRef.current = setInterval(() => {
            setCountdown(c => {
                if (c <= 1) {
                    if (tickRef.current) clearInterval(tickRef.current);
                    return 0;
                }
                return c - 1;
            });
        }, 1000);

        return () => { if (tickRef.current) clearInterval(tickRef.current); };
    }, [visible, countdown > 0]);  // eslint-disable-line react-hooks/exhaustive-deps

    if (!visible) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            className="fixed top-0 left-0 right-0 z-[500] flex items-center justify-center gap-3 bg-amber-500 text-white px-4 py-2.5 text-sm font-medium shadow-lg"
        >
            <WrenchIcon size={14} className="shrink-0" />
            <span>
                L'application est temporairement hors ligne pour maintenance — veuillez patienter.
            </span>
            {countdown > 0 && (
                <span className="text-amber-100 text-xs shrink-0">
                    Nouvelle tentative dans {countdown}s
                </span>
            )}
        </div>
    );
}
