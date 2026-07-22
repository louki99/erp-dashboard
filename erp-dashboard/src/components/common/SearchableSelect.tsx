/**
 * SearchableSelect — built on @radix-ui/react-select so it works correctly
 * inside Radix Dialog without any portal / DismissableLayer conflicts.
 */
import React, { useMemo, useState } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
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
    const [query, setQuery] = useState('');

    const stringValue = value != null && value !== '' ? String(value) : '';

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter(o =>
            o.label.toLowerCase().includes(q) ||
            (o.sublabel ?? '').toLowerCase().includes(q) ||
            (o.badge ?? '').toLowerCase().includes(q),
        );
    }, [options, query]);

    const selected = options.find(o => String(o.value) === stringValue);

    const handleValueChange = (strVal: string) => {
        const opt = options.find(o => String(o.value) === strVal);
        onChange(opt ? opt.value : strVal);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onChange(undefined);
    };

    return (
        <SelectPrimitive.Root
            value={stringValue}
            onValueChange={handleValueChange}
            onOpenChange={(open) => { if (!open) setQuery(''); }}
            disabled={disabled}
        >
            <div className="relative w-full">
                <SelectPrimitive.Trigger
                    className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 border rounded-lg text-sm transition-all text-left min-h-[38px] bg-white',
                        hasError ? 'border-red-300 bg-red-50/30' : 'border-gray-200 hover:border-gray-300',
                        'focus:outline-none data-[state=open]:border-blue-400 data-[state=open]:ring-2 data-[state=open]:ring-blue-500/20',
                        disabled && 'opacity-50 cursor-not-allowed bg-gray-50',
                    )}
                >
                    <SelectPrimitive.Value placeholder={placeholder}>
                        <span className={cn('truncate flex-1', selected ? 'text-gray-800' : 'text-gray-300')}>
                            {selected?.label ?? placeholder}
                        </span>
                    </SelectPrimitive.Value>
                    <span className="flex items-center gap-1 shrink-0 ml-auto">
                        {clearable && stringValue && (
                            <span
                                onPointerDown={handleClear}
                                className="p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 cursor-pointer"
                            >
                                <X className="w-3 h-3" />
                            </span>
                        )}
                        <SelectPrimitive.Icon>
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </SelectPrimitive.Icon>
                    </span>
                </SelectPrimitive.Trigger>
            </div>

            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position="popper"
                    sideOffset={4}
                    className="z-[9999] w-[--radix-select-trigger-width] rounded-xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/80 overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                >
                    {/* Search input — stopPropagation prevents Radix type-ahead from consuming keystrokes */}
                    <div className="p-2 border-b border-gray-100 bg-gray-50/80">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={query}
                                autoFocus
                                onChange={e => setQuery(e.target.value)}
                                onKeyDown={e => e.stopPropagation()}
                                onPointerDown={e => e.stopPropagation()}
                                placeholder="Rechercher..."
                                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                            />
                        </div>
                    </div>

                    <SelectPrimitive.Viewport className="max-h-[216px] overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-8 text-sm text-center text-gray-400">
                                Aucun résultat pour «&nbsp;{query}&nbsp;»
                            </div>
                        ) : (
                            filtered.map(opt => (
                                <SelectPrimitive.Item
                                    key={opt.value}
                                    value={String(opt.value)}
                                    className={cn(
                                        'relative flex w-full cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-sm outline-none transition-colors',
                                        'focus:bg-blue-50 focus:text-blue-700',
                                        String(opt.value) === stringValue
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-gray-800 hover:bg-gray-50',
                                    )}
                                >
                                    <span className="flex items-center gap-2 min-w-0 flex-1">
                                        <SelectPrimitive.ItemText>
                                            <span className="font-medium truncate">{opt.label}</span>
                                        </SelectPrimitive.ItemText>
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
                                        <SelectPrimitive.ItemIndicator>
                                            <Check className="w-3.5 h-3.5 text-blue-600" />
                                        </SelectPrimitive.ItemIndicator>
                                    </span>
                                </SelectPrimitive.Item>
                            ))
                        )}
                    </SelectPrimitive.Viewport>

                    {options.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-[10px] text-gray-400">
                                {filtered.length} / {options.length} résultats
                            </p>
                        </div>
                    )}
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
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
