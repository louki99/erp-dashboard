import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

// Searchable multi-select checkbox dropdown — shared between the mission workspace's filter
// modal (Commercial/Tournée) and DecisionActionsBar's edit-mission form (add/remove BL pickers).
export type CheckboxOption = { id: number; label: string };

export const CheckboxSearchDropdown = ({
  label,
  icon,
  options,
  selected,
  onChange,
  emptyLabel = 'Tous',
  noResultsLabel = 'Aucun résultat',
}: {
  label: string;
  icon?: React.ReactNode;
  options: CheckboxOption[];
  selected: number[];
  onChange: (ids: number[]) => void;
  emptyLabel?: string;
  noResultsLabel?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const needle = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(needle));
  }, [options, query]);

  const toggle = (id: number) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

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
      <label className="text-[11px] text-gray-500 flex items-center gap-1 mb-1">{icon} {label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:bg-gray-50"
      >
        <span className="truncate text-left">
          {selected.length === 0 ? emptyLabel : `${selected.length} sélectionné(s)`}
        </span>
        <ChevronDown size={12} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
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
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3 px-3">{noResultsLabel}</p>
              ) : (
                filtered.map((o) => {
                  const isChecked = selected.includes(o.id);
                  return (
                    <label
                      key={o.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-gray-50 cursor-pointer"
                    >
                      <span
                        className={`w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center ${
                          isChecked ? 'bg-sage-500 border-sage-500' : 'border-gray-300'
                        }`}
                      >
                        {isChecked && <Check size={10} className="text-white" />}
                      </span>
                      <input type="checkbox" checked={isChecked} onChange={() => toggle(o.id)} className="hidden" />
                      <span className="truncate">{o.label}</span>
                    </label>
                  );
                })
              )}
            </div>
            {selected.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="w-full text-xs text-red-500 hover:text-red-700 font-medium py-1.5 border-t border-gray-100"
              >
                Effacer
              </button>
            )}
          </div>
      )}
    </div>
  );
};

export default CheckboxSearchDropdown;
