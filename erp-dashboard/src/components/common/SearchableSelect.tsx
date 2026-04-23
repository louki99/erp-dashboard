/**
 * SearchableSelect
 * ─────────────────────────────────────────────────────────────────────────────
 * Portal-based searchable dropdown.
 * Renders the open panel via ReactDOM.createPortal so it is never clipped by
 * overflow:hidden / overflow:auto ancestors (scrollable cards, modals, etc.).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { AlertCircle, Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SelectOption {
    value: string | number;
    label: string;
    sublabel?: string;
    badge?: string;
}

export interface SearchableSelectProps {
    options: SelectOption[];
    value?: string | number | null;
    onChange: (val: string | number | undefined) => void;
    placeholder?: string;
    clearable?: boolean;
    hasError?: boolean;
    disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const SearchableSelect: React.FC<SearchableSelectProps> = ({
    options,
    value,
    onChange,
    placeholder = '— Sélectionner —',
    clearable = false,
    hasError = false,
    disabled = false,
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [dropPos, setDropPos] = useState<React.CSSProperties>({});
    const triggerRef = useRef<HTMLButtonElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            const dropdown = document.getElementById('sage-searchable-dropdown');
            if (triggerRef.current?.contains(target) || dropdown?.contains(target)) return;
            setOpen(false);
            setQuery('');
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Focus search input when opened
    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 60);
    }, [open]);

    const handleToggle = () => {
        if (disabled) return;
        if (!open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const dropH = Math.min(280, options.length * 36 + 56);
            setDropPos({
                position: 'fixed',
                top: spaceBelow > dropH ? rect.bottom + 4 : rect.top - dropH - 4,
                left: rect.left,
                width: rect.width,
                zIndex: 9999,
            });
        }
        setOpen(o => !o);
        if (open) setQuery('');
    };

    const selected = options.find(o => String(o.value) === String(value ?? ''));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel ?? '').toLowerCase().includes(q) ||
            (o.badge ?? '').toLowerCase().includes(q)
        );
    }, [options, query]);

    const handleSelect = (opt: SelectOption) => {
        onChange(opt.value);
        setOpen(false);
        setQuery('');
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(undefined);
    };

    const dropdown = open ? (
        <div
            id="sage-searchable-dropdown"
            style={dropPos}
            className="bg-white border border-gray-200 rounded-xl shadow-2xl shadow-gray-200/80 overflow-hidden"
        >
            <div className="p-2 border-b border-gray-100 bg-gray-50/80">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                            if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0]);
                        }}
                        placeholder="Rechercher..."
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                    />
                </div>
            </div>
            <div className="overflow-y-auto" style={{ maxHeight: 216 }}>
                {filtered.length === 0 ? (
                    <div className="px-4 py-8 text-sm text-center text-gray-400">
                        Aucun résultat pour «&nbsp;{query}&nbsp;»
                    </div>
                ) : (
                    filtered.map(opt => {
                        const isActive = String(opt.value) === String(value ?? '');
                        return (
                            <button
                                key={opt.value}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); handleSelect(opt); }}
                                className={cn(
                                    'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors',
                                    isActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-800',
                                )}
                            >
                                <span className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className={cn('font-medium truncate', isActive && 'text-blue-700')}>
                                        {opt.label}
                                    </span>
                                    {opt.sublabel && (
                                        <span className="text-[11px] text-gray-400 shrink-0">{opt.sublabel}</span>
                                    )}
                                </span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                    {opt.badge && (
                                        <span className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 rounded">
                                            {opt.badge}
                                        </span>
                                    )}
                                    {isActive && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                </span>
                            </button>
                        );
                    })
                )}
            </div>
            {options.length > 0 && (
                <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50">
                    <p className="text-[10px] text-gray-400">
                        {filtered.length} / {options.length} résultats
                    </p>
                </div>
            )}
        </div>
    ) : null;

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={handleToggle}
                disabled={disabled}
                className={cn(
                    'w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-all text-left min-h-[38px]',
                    hasError ? 'border-red-300 bg-red-50/30' : 'border-gray-200 bg-white hover:border-gray-300',
                    open && 'border-blue-400 ring-2 ring-blue-500/20',
                    disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
                )}
            >
                <span className={cn('truncate flex-1', selected ? 'text-gray-800' : 'text-gray-300')}>
                    {selected?.label ?? placeholder}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    {clearable && selected && (
                        <span
                            onMouseDown={e => e.preventDefault()}
                            onClick={handleClear}
                            className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    )}
                    <ChevronDown className={cn('w-4 h-4 text-gray-400 transition-transform duration-200', open && 'rotate-180')} />
                </span>
            </button>
            {typeof document !== 'undefined' && ReactDOM.createPortal(dropdown, document.body)}
        </>
    );
};

export default SearchableSelect;

// ─── FieldError helper (co-located for convenience) ──────────────────────────

export const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
    msg ? (
        <p className="flex items-center gap-1 text-[10px] text-red-500 mt-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            {msg}
        </p>
    ) : null;
