import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Loader2, ChevronDown } from 'lucide-react';

export interface SearchSelectOption {
    id: number;
    label: string;
    sublabel?: string;
    raw?: any;
}

interface SearchSelectProps {
    value: number | null | undefined;
    /** Display label for the currently-selected value (optional — used when editing) */
    valueLabel?: string;
    onChange: (id: number | null, option: SearchSelectOption | null) => void;
    onSearch: (query: string) => Promise<SearchSelectOption[]>;
    placeholder?: string;
    disabled?: boolean;
    /** Minimum characters before triggering search */
    minChars?: number;
    /** Debounce delay in ms */
    debounce?: number;
    className?: string;
}

/**
 * A searchable dropdown (autocomplete) that fetches results asynchronously.
 * Designed to replace raw numeric ID inputs in forms.
 */
export const SearchSelect: React.FC<SearchSelectProps> = ({
    value,
    valueLabel,
    onChange,
    onSearch,
    placeholder = 'Rechercher...',
    disabled = false,
    minChars = 1,
    debounce = 300,
    className = '',
}) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<SearchSelectOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [highlightIdx, setHighlightIdx] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

    // Display text
    const displayText = valueLabel || (value ? `#${value}` : '');

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const doSearch = useCallback(async (q: string) => {
        if (q.length < minChars) {
            setOptions([]);
            return;
        }
        setLoading(true);
        try {
            const results = await onSearch(q);
            setOptions(results);
            setHighlightIdx(-1);
        } catch {
            setOptions([]);
        } finally {
            setLoading(false);
        }
    }, [onSearch, minChars]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        setIsOpen(true);

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), debounce);
    };

    const handleSelect = (opt: SearchSelectOption) => {
        onChange(opt.id, opt);
        setQuery('');
        setIsOpen(false);
        inputRef.current?.blur();
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null, null);
        setQuery('');
        setOptions([]);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(prev => Math.min(prev + 1, options.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' && highlightIdx >= 0 && options[highlightIdx]) {
            e.preventDefault();
            handleSelect(options[highlightIdx]);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const handleFocus = () => {
        setIsOpen(true);
        if (query.length >= minChars) {
            doSearch(query);
        }
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Selected value display / search input */}
            {value && !isOpen ? (
                <div
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white flex items-center justify-between cursor-pointer hover:border-blue-400 transition-colors"
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                    }}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-gray-900 font-medium">{displayText}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-mono shrink-0">
                            #{value}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button
                            onClick={handleClear}
                            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                            type="button"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                    </div>
                </div>
            ) : (
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onFocus={handleFocus}
                        onBlur={() => {
                            // Delay close to allow click on option
                            setTimeout(() => {
                                if (!containerRef.current?.contains(document.activeElement)) {
                                    setIsOpen(false);
                                }
                            }, 150);
                        }}
                        placeholder={placeholder}
                        disabled={disabled}
                        className="w-full pl-8 pr-8 py-2 border border-blue-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                    />
                    {loading && (
                        <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 animate-spin" />
                    )}
                </div>
            )}

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {loading && options.length === 0 && (
                        <div className="px-3 py-4 text-center">
                            <Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto mb-1" />
                            <span className="text-xs text-gray-400">Recherche en cours...</span>
                        </div>
                    )}

                    {!loading && query.length >= minChars && options.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-gray-400">
                            Aucun résultat pour « {query} »
                        </div>
                    )}

                    {!loading && query.length < minChars && (
                        <div className="px-3 py-3 text-center text-xs text-gray-400">
                            Saisissez au moins {minChars} caractère(s) pour rechercher
                        </div>
                    )}

                    {options.map((opt, idx) => (
                        <button
                            key={opt.id}
                            type="button"
                            className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors ${
                                idx === highlightIdx
                                    ? 'bg-blue-50'
                                    : 'hover:bg-gray-50'
                            } ${opt.id === value ? 'bg-blue-50/50' : ''} ${idx > 0 ? 'border-t border-gray-50' : ''}`}
                            onMouseDown={(e) => {
                                e.preventDefault(); // Prevent blur
                                handleSelect(opt);
                            }}
                            onMouseEnter={() => setHighlightIdx(idx)}
                        >
                            <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center shrink-0">
                                <span className="text-[10px] font-bold text-gray-500">{opt.id}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium text-gray-900 truncate">{opt.label}</div>
                                {opt.sublabel && (
                                    <div className="text-[11px] text-gray-400 font-mono truncate">{opt.sublabel}</div>
                                )}
                            </div>
                            {opt.id === value && (
                                <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-full font-medium shrink-0">
                                    sélectionné
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
