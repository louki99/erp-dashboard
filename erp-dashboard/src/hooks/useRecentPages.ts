import { useState, useEffect } from 'react';

const STORAGE_KEY = 'erp_recent_pages';
const MAX_PAGES = 6;

export interface RecentPage {
    route: string;
    label: string;
    ts: number;
}

export function trackRecentPage(route: string, label: string): void {
    try {
        const existing: RecentPage[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
        const filtered = existing.filter(p => p.route !== route);
        const updated = [{ route, label, ts: Date.now() }, ...filtered].slice(0, MAX_PAGES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // localStorage unavailable — silent fail
    }
}

export function useRecentPages(): RecentPage[] {
    const [pages, setPages] = useState<RecentPage[]>([]);

    useEffect(() => {
        try {
            const stored: RecentPage[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            setPages(stored);
        } catch {
            setPages([]);
        }
    }, []);

    return pages;
}
