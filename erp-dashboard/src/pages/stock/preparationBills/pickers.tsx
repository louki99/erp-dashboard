// Reusable pickers for the BP (Bon de Préparation) create/edit flows.
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, CheckSquare, Square } from 'lucide-react';

import { usePreparationBillMagasiniers } from '@/hooks/stock/useWarehouse';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DispatcherOrder } from '@/types/dispatcher.types';

// ─── Generic searchable select — magasinier / mission ────────────────────────

interface OptionLike {
    value: number;
    label: string;
    description?: string | null;
}

interface SearchableSelectProps {
    value: number | null | undefined;
    onChange: (id: number | null) => void;
    options: OptionLike[];
    loading?: boolean;
    placeholder?: string;
    accent?: string;
}

const SearchableSelect = ({ value, onChange, options, loading, placeholder = 'Rechercher...' }: SearchableSelectProps) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const selected = options.find((o) => o.value === value);
    const filtered = query.trim()
        ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
        : options;

    if (selected && !open) {
        return (
            <div className="flex items-center justify-between px-3 py-2 border border-gray-200 rounded-lg bg-amber-50">
                <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 truncate block">{selected.label}</span>
                    {selected.description && <span className="text-xs text-gray-400 truncate block">{selected.description}</span>}
                </div>
                <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600 shrink-0 ml-2">
                    <X className="w-4 h-4" />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-300 animate-spin" />}
            </div>
            {open && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                    {filtered.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-400">Aucun résultat</div>
                    ) : (
                        filtered.map((opt) => (
                            <button
                                type="button"
                                key={opt.value}
                                onMouseDown={(e) => { e.preventDefault(); onChange(opt.value); setQuery(''); setOpen(false); }}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-amber-50 flex flex-col"
                            >
                                <span className="font-medium text-gray-800">{opt.label}</span>
                                {opt.description && <span className="text-xs text-gray-400">{opt.description}</span>}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

// GET /stock/preparation-bills/magasiniers (2026-08) — dedicated, role-scoped
// list. Replaces the earlier generic /masterdata/users lookup, which returned
// every user rather than just magasiniers.
export const MagasinierSelect = (props: Omit<SearchableSelectProps, 'options' | 'loading'> & { branchId?: number }) => {
    const { branchId, ...rest } = props;
    const { data, isLoading } = usePreparationBillMagasiniers(branchId);
    const options: OptionLike[] = (data?.magasiniers ?? []).map((m) => ({ value: m.id, label: m.name, description: m.email }));
    return <SearchableSelect {...rest} options={options} loading={isLoading} placeholder="Rechercher un magasinier..." />;
};

export const MissionSelect = (props: Omit<SearchableSelectProps, 'options' | 'loading'>) => {
    const { data, isLoading } = useQuery({
        queryKey: ['delivery-missions', 'picker'],
        queryFn: () => dispatcherApi.deliveryMissions.getList({ per_page: 100 }),
        staleTime: 30_000,
    });
    const options: OptionLike[] = (data ?? []).map((m) => ({
        value: m.id,
        label: m.mission_number,
        description: m.rider?.name ? `Livreur : ${m.rider.name}` : 'Non assignée',
    }));
    return <SearchableSelect {...props} options={options} loading={isLoading} placeholder="Rechercher une mission..." />;
};

// ─── Order picker — multi-select list backed by GET /dispatcher/orders/pending ──

interface OrderPickerProps {
    selectedIds: number[];
    onChange: (ids: number[]) => void;
    excludeIds?: number[];
    max?: number;
}

const money = (n: number | string) => `${Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`;

export const OrderPicker = ({ selectedIds, onChange, excludeIds = [], max = 200 }: OrderPickerProps) => {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');

    useEffect(() => {
        const t = setTimeout(() => setDebounced(search), 300);
        return () => clearTimeout(t);
    }, [search]);

    const { data, isLoading } = useQuery({
        queryKey: ['dispatcher-orders-pending', debounced],
        queryFn: () => dispatcherApi.orders.getPending({ search: debounced || undefined, per_page: 30 }),
        staleTime: 15_000,
    });

    const orders: DispatcherOrder[] = data?.data ?? [];
    const visible = orders.filter((o) => !excludeIds.includes(o.id));

    const toggle = (id: number) => {
        if (selectedIds.includes(id)) {
            onChange(selectedIds.filter((i) => i !== id));
        } else if (selectedIds.length < max) {
            onChange([...selectedIds, id]);
        }
    };

    return (
        <div className="flex flex-col h-full">
            <div className="relative mb-2 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher une commande (N°, client)..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
            </div>
            <div className="flex items-center justify-between mb-1.5 shrink-0">
                <span className="text-xs text-gray-400">Commandes confirmées en attente de dispatch</span>
                <span className="text-xs font-semibold text-amber-600">{selectedIds.length} sélectionnée{selectedIds.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement...
                    </div>
                ) : visible.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">Aucune commande disponible</div>
                ) : (
                    visible.map((o) => {
                        const checked = selectedIds.includes(o.id);
                        return (
                            <button
                                type="button"
                                key={o.id}
                                onClick={() => toggle(o.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                            >
                                {checked ? <CheckSquare className="w-4 h-4 text-amber-600 shrink-0" /> : <Square className="w-4 h-4 text-gray-300 shrink-0" />}
                                <div className="min-w-0 flex-1">
                                    <div className="text-xs font-mono font-bold text-gray-800 truncate">{o.order_code}</div>
                                    <div className="text-[11px] text-gray-400 truncate">{o.partner?.name}</div>
                                </div>
                                <div className="text-xs font-semibold text-gray-600 shrink-0">{money(o.total_amount)}</div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
};
