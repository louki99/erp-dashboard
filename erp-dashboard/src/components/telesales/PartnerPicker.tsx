import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { getPartners } from '@/services/api/partnerApi';

export interface PartnerPickerOption {
    id: number;
    code: string;
    name: string;
}

interface PartnerPickerProps {
    value: PartnerPickerOption | null;
    onChange: (partner: PartnerPickerOption | null) => void;
    placeholder?: string;
}

/**
 * Inline partner search/select. No dedicated telesales partner picker exists —
 * reuses the generic GET /partners (q=) used across the Partners module.
 */
export const PartnerPicker = ({ value, onChange, placeholder = 'Rechercher un partenaire (nom, code)...' }: PartnerPickerProps) => {
    const [query, setQuery] = useState('');
    const [options, setOptions] = useState<PartnerPickerOption[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!query.trim()) {
            setOptions([]);
            return;
        }
        setLoading(true);
        const t = setTimeout(async () => {
            try {
                const result = await getPartners({ q: query, per_page: 8 });
                setOptions(result.partners.data.map((p: any) => ({ id: p.id, code: p.code, name: p.name })));
            } catch {
                setOptions([]);
            } finally {
                setLoading(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', onClickOutside);
        return () => document.removeEventListener('mousedown', onClickOutside);
    }, []);

    if (value) {
        return (
            <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-sage-50">
                <span className="text-sm font-medium text-gray-800">{value.name} <span className="text-gray-400">({value.code})</span></span>
                <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                />
            </div>
            {open && query.trim() && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {loading ? (
                        <div className="px-3 py-2 text-sm text-gray-400">Recherche...</div>
                    ) : options.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">Aucun résultat</div>
                    ) : (
                        options.map((opt) => (
                            <button
                                type="button"
                                key={opt.id}
                                onClick={() => { onChange(opt); setQuery(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-sage-50 flex items-center justify-between"
                            >
                                <span className="font-medium text-gray-800">{opt.name}</span>
                                <span className="text-gray-400">{opt.code}</span>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
