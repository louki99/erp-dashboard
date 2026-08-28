import { ShoppingCart, type LucideIcon } from 'lucide-react';
import { useAppLauncherStore } from '@/stores/appLauncherStore';

// Style B from the visual proposal (pastille trail) — reusable across every
// GCOM document screen. No route param carries the current document (GCOM
// routes are flat, e.g. /gcom/factures — selection lives in page-local
// state), so the last two segments are always supplied by the caller rather
// than derived from the router.
export interface GcomBreadcrumbProps {
    // Static grouping label (e.g. "Ventes") — never clickable, mirrors a
    // menuData.ts category that has no screen of its own.
    section: string;
    // The current screen (e.g. "Factures"). Rendered as the current pill
    // when nothing is selected; becomes a clickable "back to list" crumb
    // once `current` is set.
    page: { label: string; icon: LucideIcon; onClick: () => void };
    // The open document (e.g. { label: "FAC-2026-0042" }) — omit while the
    // list view has nothing selected.
    current?: { label: string } | null;
}

export const GcomBreadcrumb = ({ section, page, current }: GcomBreadcrumbProps) => {
    const openLauncher = useAppLauncherStore(s => s.open);
    const PageIcon = page.icon;

    return (
        <nav aria-label="Fil d'Ariane" className="flex items-center flex-wrap gap-0.5 px-6 pt-3 text-[12.5px] bg-white border-b border-gray-100">
            <button
                type="button"
                onClick={openLauncher}
                className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded-md font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
                <ShoppingCart className="w-3.5 h-3.5 opacity-70" />
                GCOM
            </button>
            <span className="text-gray-300 text-[11px] px-0.5">/</span>
            <span className="px-1.5 py-1 text-gray-400 font-semibold">{section}</span>
            <span className="text-gray-300 text-[11px] px-0.5">/</span>
            {current ? (
                <>
                    <button
                        type="button"
                        onClick={page.onClick}
                        className="inline-flex items-center gap-1.5 px-1.5 py-1 rounded-md font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                        <PageIcon className="w-3.5 h-3.5 opacity-60" />
                        {page.label}
                    </button>
                    <span className="text-gray-300 text-[11px] px-0.5">/</span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sage-600 text-white font-bold">
                        {current.label}
                    </span>
                </>
            ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sage-600 text-white font-bold">
                    <PageIcon className="w-3.5 h-3.5 opacity-90" />
                    {page.label}
                </span>
            )}
        </nav>
    );
};

export default GcomBreadcrumb;
