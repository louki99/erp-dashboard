import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';

export interface ComboboxOption {
  id: number | string;
  label: string;
  sub?: string;
}

interface AsyncComboboxProps {
  value: ComboboxOption | null;
  onChange: (option: ComboboxOption | null) => void;
  onSearch: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
  /** Minimum characters before triggering search (default 0 = fetch all on open) */
  minChars?: number;
}

export function AsyncCombobox({
  value,
  onChange,
  onSearch,
  placeholder = 'Rechercher…',
  required,
  disabled,
  clearable = true,
  className = '',
  minChars = 0,
}: AsyncComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < minChars) { setOptions([]); return; }
    setLoading(true);
    try {
      const results = await onSearch(q);
      setOptions(results);
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [onSearch, minChars]);

  // Debounced search when query changes
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => doSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, open, doSearch]);

  // Load initial options when opened
  useEffect(() => {
    if (open) {
      doSearch(query);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const select = (opt: ComboboxOption) => {
    onChange(opt);
    setOpen(false);
    setQuery('');
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={`w-full flex items-center justify-between border rounded-lg px-3 py-2 text-sm text-left transition-colors
          ${disabled ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'bg-white cursor-pointer hover:border-gray-400'}
          ${open ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-gray-300'}
          focus:outline-none`}
      >
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>
          {value ? (
            <span className="flex items-center gap-1.5">
              <span className="font-medium">{value.label}</span>
              {value.sub && <span className="text-xs text-gray-400">{value.sub}</span>}
            </span>
          ) : placeholder}
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {clearable && value && (
            <span onClick={clear} className="p-0.5 text-gray-400 hover:text-gray-700 rounded">
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-52 overflow-y-auto py-1">
            {!loading && options.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400 text-center">—</li>
            )}
            {options.map(opt => {
              const isSelected = value?.id === opt.id;
              return (
                <li key={opt.id}>
                  <button
                    type="button"
                    onClick={() => select(opt)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left transition-colors
                      ${isSelected ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-gray-50 text-gray-800'}`}
                  >
                    <span>
                      <span className="font-medium">{opt.label}</span>
                      {opt.sub && <span className="ml-1.5 text-xs text-gray-400">{opt.sub}</span>}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
