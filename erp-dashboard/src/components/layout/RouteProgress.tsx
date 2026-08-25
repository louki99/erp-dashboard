import { useEffect, useRef, useState, type ReactNode } from 'react';
import { RouteProgressContext, useRouteProgress } from '@/hooks/useRouteProgress';

// ─── Top-of-viewport route progress bar (NProgress-style) ─────────────────────
// Driven directly by <Suspense>'s own mount/unmount lifecycle via
// <RouteFallback> below — not a timer guess. <RouteFallback> IS the Suspense
// `fallback`, so its effect fires exactly when a lazy route chunk actually
// suspends, and its cleanup fires exactly when the real page has mounted and
// replaced it. That gives an accurate start/end signal for free, with no
// dependency on react-router's data-router-only useNavigation().
// Context/hook live in src/hooks/useRouteProgress.ts, not here — this file
// must only export components (react-refresh/only-export-components).

export function RouteProgressProvider({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);
    const [width, setWidth] = useState(0);
    const growTimer = useRef<ReturnType<typeof setInterval> | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Reference-counted — two nested/overlapping suspensions (rare, but
    // possible if a second lazy boundary suspends before the first clears)
    // shouldn't let an early `done()` hide the bar while work remains.
    const activeCount = useRef(0);

    const start = () => {
        activeCount.current += 1;
        if (activeCount.current > 1) return;
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        if (growTimer.current) clearInterval(growTimer.current);
        setVisible(true);
        setWidth(15);
        // Eases toward 85% but never completes on its own — only start()/
        // done()'s own resolution actually finishes the bar, same convention
        // as NProgress/Vercel-style top bars (asymptotic growth communicates
        // "still working" for loads slower than the initial jump anticipated).
        growTimer.current = setInterval(() => {
            setWidth(w => (w < 85 ? w + (85 - w) * 0.15 : w));
        }, 200);
    };

    const done = () => {
        activeCount.current = Math.max(0, activeCount.current - 1);
        if (activeCount.current > 0) return;
        if (growTimer.current) { clearInterval(growTimer.current); growTimer.current = null; }
        setWidth(100);
        hideTimer.current = setTimeout(() => { setVisible(false); setWidth(0); }, 300);
    };

    useEffect(() => () => {
        if (growTimer.current) clearInterval(growTimer.current);
        if (hideTimer.current) clearTimeout(hideTimer.current);
    }, []);

    return (
        <RouteProgressContext.Provider value={{ start, done }}>
            <div
                aria-hidden
                className="fixed top-0 left-0 right-0 z-[100] h-[3px] pointer-events-none"
                style={{ opacity: visible ? 1 : 0, transition: 'opacity 250ms ease' }}
            >
                <div
                    className="h-full bg-gradient-to-r from-sage-400 via-sage-500 to-sage-600"
                    style={{
                        width: `${width}%`,
                        transition: 'width 200ms ease-out',
                        boxShadow: '0 0 8px 1px rgba(16, 122, 66, 0.55)',
                    }}
                />
            </div>
            {children}
        </RouteProgressContext.Provider>
    );
}

// The <Suspense fallback> for every lazy route in App.tsx.
export function RouteFallback() {
    const { start, done } = useRouteProgress();
    useEffect(() => {
        start();
        return done;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="route-fallback-fade-in flex items-center justify-center min-h-screen">
            <div className="flex flex-col items-center gap-3">
                <div className="h-9 w-9 rounded-full border-2 border-sage-100 border-t-sage-600 animate-spin" />
                <p className="text-xs font-medium text-gray-400">Chargement…</p>
            </div>
        </div>
    );
}
