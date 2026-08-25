import { createContext, useContext } from 'react';

export interface RouteProgressApi {
    start: () => void;
    done: () => void;
}

export const RouteProgressContext = createContext<RouteProgressApi | null>(null);

export function useRouteProgress(): RouteProgressApi {
    const ctx = useContext(RouteProgressContext);
    if (!ctx) throw new Error('useRouteProgress must be used within RouteProgressProvider');
    return ctx;
}
