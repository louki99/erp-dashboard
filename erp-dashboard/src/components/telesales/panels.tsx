// Shared "data | detail | action" building blocks for the télévendeur module —
// one consistent list/detail language across every Lot 2 agent screen instead
// of each page hand-rolling its own header/list/empty-state markup.
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type PanelAccent = 'sage' | 'emerald' | 'blue' | 'amber' | 'red' | 'rose' | 'purple' | 'indigo' | 'gray';

// Literal Tailwind class strings per accent — Tailwind's JIT scanner can't see
// dynamically-interpolated class names (`bg-${accent}-50`), so every class
// used anywhere must appear verbatim in source somewhere. This table is that.
const ACCENT: Record<PanelAccent, { bg: string; text: string; iconBg: string; borderSelected: string; dot: string }> = {
    sage:    { bg: 'bg-sage-50',    text: 'text-sage-600',    iconBg: 'bg-sage-100',    borderSelected: 'border-l-sage-500',    dot: 'bg-sage-500' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100', borderSelected: 'border-l-emerald-500', dot: 'bg-emerald-500' },
    blue:    { bg: 'bg-blue-50',    text: 'text-blue-600',    iconBg: 'bg-blue-100',    borderSelected: 'border-l-blue-500',    dot: 'bg-blue-500' },
    amber:   { bg: 'bg-amber-50',   text: 'text-amber-600',   iconBg: 'bg-amber-100',   borderSelected: 'border-l-amber-500',   dot: 'bg-amber-500' },
    red:     { bg: 'bg-red-50',     text: 'text-red-600',     iconBg: 'bg-red-100',     borderSelected: 'border-l-red-500',     dot: 'bg-red-500' },
    rose:    { bg: 'bg-rose-50',    text: 'text-rose-600',    iconBg: 'bg-rose-100',    borderSelected: 'border-l-rose-500',    dot: 'bg-rose-500' },
    purple:  { bg: 'bg-purple-50',  text: 'text-purple-600',  iconBg: 'bg-purple-100',  borderSelected: 'border-l-purple-500',  dot: 'bg-purple-500' },
    indigo:  { bg: 'bg-indigo-50',  text: 'text-indigo-600',  iconBg: 'bg-indigo-100',  borderSelected: 'border-l-indigo-500',  dot: 'bg-indigo-500' },
    gray:    { bg: 'bg-gray-50',    text: 'text-gray-600',    iconBg: 'bg-gray-100',    borderSelected: 'border-l-gray-400',    dot: 'bg-gray-400' },
};

// ─── DetailHeader — center panel's sticky top bar ────────────────────────────

interface DetailHeaderProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    accent?: PanelAccent;
    actions?: ReactNode;
}

export const DetailHeader = ({ icon: Icon, title, subtitle, accent = 'sage', actions }: DetailHeaderProps) => {
    const a = ACCENT[accent];
    return (
        <div className="px-6 lg:px-8 py-5 border-b border-gray-200 bg-white/90 backdrop-blur-md shrink-0 flex items-center gap-4">
            <div className={`w-11 h-11 rounded-xl ${a.iconBg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${a.text}`} />
            </div>
            <div className="min-w-0 flex-1">
                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight truncate">{title}</h2>
                {subtitle && <p className="text-xs font-medium text-gray-500 mt-0.5 truncate capitalize">{subtitle}</p>}
            </div>
            {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
    );
};

// ─── StatCard — KPI tile used on dashboards ──────────────────────────────────

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    accent?: PanelAccent;
    muted?: boolean;
}

export const StatCard = ({ label, value, icon: Icon, accent = 'sage', muted }: StatCardProps) => {
    const a = ACCENT[accent];
    return (
        <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm transition-all ${muted ? 'bg-white border-gray-100' : `${a.bg} border-transparent`}`}>
            <div className={`absolute -right-8 -top-8 w-28 h-28 rounded-full blur-2xl opacity-30 ${muted ? '' : a.iconBg}`} />
            <div className="relative flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wide truncate">{label}</div>
                    <div className={`text-3xl font-black mt-1.5 tracking-tight ${muted ? 'text-gray-300' : a.text}`}>{value}</div>
                </div>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${muted ? 'bg-gray-50' : 'bg-white/70'}`}>
                    <Icon className={`w-4.5 h-4.5 ${muted ? 'text-gray-300' : a.text}`} />
                </div>
            </div>
        </div>
    );
};

// ─── EmptySelection — center panel placeholder before a row is picked ───────

interface EmptySelectionProps {
    icon: LucideIcon;
    title: string;
    hint?: string;
}

export const EmptySelection = ({ icon: Icon, title, hint }: EmptySelectionProps) => (
    <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center max-w-xs">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-500">{title}</p>
            {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
    </div>
);

// ─── ListPanel — left panel's header + filters + selectable row list ────────

interface ListPanelProps<T> {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    accent?: PanelAccent;
    items: T[];
    loading?: boolean;
    emptyIcon: LucideIcon;
    emptyText: string;
    selectedId: number | string | null;
    getId: (item: T) => number | string;
    onSelect: (item: T) => void;
    filters?: ReactNode;
    renderRow: (item: T) => ReactNode;
    footer?: ReactNode;
}

export function ListPanel<T>({
    icon: Icon, title, subtitle, accent = 'sage', items, loading, emptyIcon: EmptyIcon, emptyText,
    selectedId, getId, onSelect, filters, renderRow, footer,
}: ListPanelProps<T>) {
    const a = ACCENT[accent];
    return (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${a.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 ${a.text}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-sm font-bold text-gray-900 truncate">{title}</h1>
                        {subtitle && <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>}
                    </div>
                </div>
            </div>

            {filters && <div className="px-3 py-2.5 border-b border-gray-100 shrink-0 space-y-2">{filters}</div>}

            <div className="flex-1 min-h-0 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4 text-center">
                        <EmptyIcon className="w-8 h-8 mb-2 text-gray-300" />
                        <p className="text-xs">{emptyText}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {items.map((item) => {
                            const id = getId(item);
                            const isSelected = selectedId === id;
                            return (
                                <button
                                    key={id}
                                    onClick={() => onSelect(item)}
                                    className={`w-full text-left px-4 py-3 transition-colors border-l-2 ${
                                        isSelected ? `${a.bg} ${a.borderSelected}` : 'border-l-transparent hover:bg-gray-50'
                                    }`}
                                >
                                    {renderRow(item)}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {footer && <div className="border-t border-gray-100 shrink-0">{footer}</div>}
        </div>
    );
}

// ─── StatusPill — small rounded status badge reused across row renderers ────

const STATUS_PILL_COLORS: Record<PanelAccent, string> = {
    sage: 'bg-sage-100 text-sage-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    rose: 'bg-rose-100 text-rose-700',
    purple: 'bg-purple-100 text-purple-700',
    indigo: 'bg-indigo-100 text-indigo-700',
    gray: 'bg-gray-100 text-gray-500',
};

export const StatusPill = ({ label, accent = 'gray' }: { label: string; accent?: PanelAccent }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_PILL_COLORS[accent]}`}>
        {label}
    </span>
);
