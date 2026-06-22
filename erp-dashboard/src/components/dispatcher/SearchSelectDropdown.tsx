import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Searchable single-select dropdown — same visual language as the multi-select checkbox
// dropdowns used for filters (DispatcherMissionWorkspacePage filter modal). Shared between the
// mission workspace's Livreur/Véhicule pickers and the map workspace's mission-creation panel.
export type SelectOption = { id: number; label: string; sublabel?: string };

export const SearchSelectDropdown = ({
  label,
  icon,
  options,
  value,
  onChange,
  placeholder = 'Sélectionner…',
  disabled = false,
}: {
  label: string;
  icon?: React.ReactNode;
  options: SelectOption[];
  value: number | '';
  onChange: (id: number | '') => void;
  placeholder?: string;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle) || o.sublabel?.toLowerCase().includes(needle));
  }, [options, query]);

  const selectedOption = options.find((o) => o.id === value);

  // Outside-click detection via a document listener instead of a fixed full-viewport overlay —
  // the overlay was intercepting wheel/touch scroll over everything behind it (including the
  // modal body this dropdown lives in), making the whole modal unscrollable while open.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-semibold text-gray-600 mb-1 flex items-center gap-1.5">{icon}{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between border border-gray-300 rounded-lg px-2.5 py-2 text-sm bg-white hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span className={`truncate text-left ${selectedOption ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={14} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && !disabled && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher…"
                  autoFocus
                  className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-200 rounded"
                />
              </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3 px-3">{options.length === 0 ? 'Aucune option disponible' : 'Aucun résultat'}</p>
              ) : (
                filtered.map((o) => {
                  const isSelected = o.id === value;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => { onChange(o.id); setOpen(false); setQuery(''); }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs text-left hover:bg-gray-50 ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{o.label}</span>
                        {o.sublabel && <span className="block truncate text-gray-400 text-[10px]">{o.sublabel}</span>}
                      </span>
                      {isSelected && <Check size={12} className="text-blue-600 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
      )}
    </div>
  );
};

export default SearchSelectDropdown;
