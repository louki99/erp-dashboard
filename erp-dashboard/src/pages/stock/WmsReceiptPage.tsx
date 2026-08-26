import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    Loader2,
    MapPin,
    Package,
    PackageCheck,
    Plus,
    RefreshCw,
    Trash2,
    Warehouse,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useCreateWmsReceipt } from '@/hooks/stock/useWms';
import { useWarehouses, useWarehouseLocations } from '@/hooks/stock/useWarehouse';
import type { GoodsReceiptItemPayload, GoodsReceiptResponse } from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (v: string) => parseFloat(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const emptyItem = (): GoodsReceiptItemPayload & { _key: string } => ({
    _key: crypto.randomUUID(),
    product_id: 0,
    quantity: 0,
    storage_location_id: 0,
    batch_number: '',
    production_date: '',
    expiry_date: '',
    unit_cost: undefined,
});

// ─── Result Panel ─────────────────────────────────────────────────────────────

const ReceiptResult = ({ result, onReset }: { result: GoodsReceiptResponse; onReset: () => void }) => (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-emerald-800">Réception enregistrée</h2>
                <p className="text-sm text-emerald-600">{result.message}</p>
            </div>
        </div>

        {/* Movements */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mouvements créés ({result.data.movements.length})
                </p>
            </div>
            <div className="divide-y divide-gray-100">
                {result.data.movements.map(mv => (
                    <div key={mv.id} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                {mv.type}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">Produit #{mv.product_id}</span>
                            {mv.stock_batch_id && (
                                <span className="text-[10px] text-indigo-500 font-mono">Lot #{mv.stock_batch_id}</span>
                            )}
                        </div>
                        <div className="text-right">
                            <span className="text-sm font-bold text-emerald-700">+{fmtQty(mv.quantity.replace('-', ''))}</span>
                            <span className="text-[10px] text-gray-400 ml-2">→ {fmtQty(mv.balance_after)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Batches created */}
        {result.data.batches.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Lots créés ({result.data.batches.length})
                    </p>
                </div>
                <div className="divide-y divide-gray-100">
                    {result.data.batches.map(b => (
                        <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-900 font-mono">{b.batch_number}</p>
                                {b.expiry_date && (
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        DLUO : {new Date(b.expiry_date).toLocaleDateString('fr-FR')}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <span className="text-sm font-bold text-gray-900">{fmtQty(b.quantity)}</span>
                                <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                                    {b.status}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-xl hover:bg-teal-700 shadow-sm transition-colors"
        >
            <Plus className="w-4 h-4" /> Nouvelle réception
        </button>
    </div>
);

// ─── Instructions Panel ───────────────────────────────────────────────────────

const InstructionsPanel = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center shadow-sm">
                <PackageCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900">Nouvelle Réception</h2>
                <p className="text-sm text-gray-400">Entrée de marchandises sur le dépôt — avec traçabilité de lot optionnelle</p>
            </div>
        </div>

        <div className="space-y-3">
            {[
                { icon: Warehouse, title: 'Choisissez l\'entrepôt', desc: 'Sélectionnez l\'entrepôt de destination pour charger ses emplacements (bins).' },
                { icon: MapPin, title: 'Emplacement obligatoire par ligne', desc: 'Vous devez choisir où ranger chaque produit — ce n\'est PAS un placement automatique (PutAwayEngine).' },
                { icon: Package, title: 'Lot optionnel (FEFO)', desc: 'Saisissez N° lot + dates uniquement pour les produits sous traçabilité FEFO. Sinon, laissez vide.' },
                { icon: AlertTriangle, title: 'Produit non tracé', desc: 'Sans N° lot, l\'entrée crée uniquement le mouvement purchase + le stock emplacement.' },
            ].map(tip => (
                <div key={tip.title} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                        <tip.icon className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-gray-800">{tip.title}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{tip.desc}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

// ─── Item Row ─────────────────────────────────────────────────────────────────

interface ItemRowProps {
    item: GoodsReceiptItemPayload & { _key: string };
    index: number;
    locations: { id: number; location_code: string; location_name: string }[];
    onChange: (key: string, field: string, value: any) => void;
    onRemove: (key: string) => void;
    canRemove: boolean;
}

const ItemRow = ({ item, index, locations, onChange, onRemove, canRemove }: ItemRowProps) => {
    const hasBatch = !!item.batch_number;
    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ligne #{index + 1}</span>
                {canRemove && (
                    <button onClick={() => onRemove(item._key)} className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
                {/* Product ID */}
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        ID Produit <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number" min="1" step="1"
                        value={item.product_id || ''}
                        onChange={e => onChange(item._key, 'product_id', parseInt(e.target.value) || 0)}
                        placeholder="ex. 1"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white bg-gray-50 transition-all"
                    />
                </div>

                {/* Quantity */}
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Quantité <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="number" min="0.001" step="0.001"
                        value={item.quantity || ''}
                        onChange={e => onChange(item._key, 'quantity', parseFloat(e.target.value) || 0)}
                        placeholder="ex. 150"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white bg-gray-50 transition-all"
                    />
                </div>

                {/* Unit cost (optional — feeds Tier 1 PMP since 2026-08-26) */}
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Coût unitaire <span className="text-[10px] font-normal text-gray-400">(optionnel — alimente le PMP)</span>
                    </label>
                    <input
                        type="number" min="0" step="0.01"
                        value={item.unit_cost ?? ''}
                        onChange={e => onChange(item._key, 'unit_cost', e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        placeholder="ex. 25.00"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white bg-gray-50 transition-all"
                    />
                </div>

                {/* Storage Location */}
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        Emplacement (bin) <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={item.storage_location_id || ''}
                        onChange={e => onChange(item._key, 'storage_location_id', parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50 transition-all"
                    >
                        <option value="">— Choisir un emplacement —</option>
                        {locations.map(loc => (
                            <option key={loc.id} value={loc.id}>
                                {loc.location_code} — {loc.location_name}
                            </option>
                        ))}
                    </select>
                    {locations.length === 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">Sélectionnez un entrepôt pour charger les emplacements.</p>
                    )}
                </div>

                {/* Batch section */}
                <div>
                    <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                        N° Lot <span className="text-[10px] font-normal text-gray-400">(optionnel — FEFO)</span>
                    </label>
                    <input
                        type="text"
                        value={item.batch_number || ''}
                        onChange={e => onChange(item._key, 'batch_number', e.target.value)}
                        placeholder="ex. LOT-2026-07-15"
                        className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white bg-gray-50 font-mono transition-all"
                    />
                </div>

                {hasBatch && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Date production
                            </label>
                            <input
                                type="date"
                                value={item.production_date || ''}
                                onChange={e => onChange(item._key, 'production_date', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                DLUO (expiry) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="date"
                                value={item.expiry_date || ''}
                                onChange={e => onChange(item._key, 'expiry_date', e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-50"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsReceiptPage = () => {
    const [warehouseId, setWarehouseId] = useState<number>(0);
    const [supplierId, setSupplierId] = useState<string>('');
    const [items, setItems] = useState([emptyItem()]);
    const [result, setResult] = useState<GoodsReceiptResponse | null>(null);

    const { data: warehousesData } = useWarehouses({ type: 'central', active_only: true });
    const { data: locationsData } = useWarehouseLocations(warehouseId || null);

    const warehouses = useMemo(() => {
        const d = warehousesData as any;
        return d?.warehouses?.data ?? d?.data ?? [];
    }, [warehousesData]);

    const locations = useMemo(() => {
        const d = locationsData as any;
        return d?.locations ?? [];
    }, [locationsData]);

    const { mutate: createReceipt, isPending } = useCreateWmsReceipt();

    const updateItem = (key: string, field: string, value: any) => {
        setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));
    };

    const addItem = () => setItems(prev => [...prev, emptyItem()]);
    const removeItem = (key: string) => setItems(prev => prev.filter(it => it._key !== key));

    const validate = (): string | null => {
        if (!warehouseId) return 'Sélectionnez un entrepôt.';
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!it.product_id) return `Ligne ${i + 1} : ID produit manquant.`;
            if (!it.quantity || it.quantity <= 0) return `Ligne ${i + 1} : quantité invalide.`;
            if (!it.storage_location_id) return `Ligne ${i + 1} : emplacement obligatoire.`;
            if (it.batch_number && !it.expiry_date) return `Ligne ${i + 1} : DLUO obligatoire quand N° lot est renseigné.`;
        }
        return null;
    };

    const handleSubmit = () => {
        const err = validate();
        if (err) { toast.error(err); return; }

        const payload = {
            warehouse_id: warehouseId,
            supplier_id: supplierId ? parseInt(supplierId) : undefined,
            items: items.map(it => ({
                product_id: it.product_id,
                quantity: it.quantity,
                storage_location_id: it.storage_location_id,
                ...(it.unit_cost != null ? { unit_cost: it.unit_cost } : {}),
                ...(it.batch_number ? {
                    batch_number: it.batch_number,
                    ...(it.production_date ? { production_date: it.production_date } : {}),
                    ...(it.expiry_date ? { expiry_date: it.expiry_date } : {}),
                } : {}),
            })),
        };

        createReceipt(payload, {
            onSuccess: (data) => {
                setResult(data);
                toast.success(`Réception enregistrée — ${data.data.movements.length} mouvement(s)`);
            },
            onError: (err: any) => {
                const msg = err?.response?.data?.message ?? 'Erreur lors de la réception.';
                toast.error(msg);
            },
        });
    };

    const handleReset = () => {
        setResult(null);
        setItems([emptyItem()]);
        setSupplierId('');
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                                <PackageCheck className="w-4.5 h-4.5 text-amber-600" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900">Nouvelle Réception</h1>
                                <p className="text-[10px] text-gray-400">{items.length} ligne{items.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Warehouse selector */}
                        <div className="mb-3">
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Entrepôt <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={warehouseId || ''}
                                onChange={e => { setWarehouseId(parseInt(e.target.value) || 0); }}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                            >
                                <option value="">— Sélectionner —</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Supplier (optional) */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                ID Fournisseur <span className="text-[10px] font-normal text-gray-400">(optionnel)</span>
                            </label>
                            <input
                                type="number" min="1" step="1"
                                value={supplierId}
                                onChange={e => setSupplierId(e.target.value)}
                                placeholder="ex. 1"
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 transition-all"
                            />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {items.map((item, i) => (
                            <ItemRow
                                key={item._key}
                                item={item}
                                index={i}
                                locations={locations}
                                onChange={updateItem}
                                onRemove={removeItem}
                                canRemove={items.length > 1}
                            />
                        ))}

                        <button
                            onClick={addItem}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-teal-600 border border-dashed border-teal-200 rounded-xl hover:bg-teal-50 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
                        </button>
                    </div>

                    {/* Submit */}
                    <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 shadow-sm transition-all"
                        >
                            {isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                                : <><ArrowRight className="w-4 h-4" /> Enregistrer la réception</>
                            }
                        </button>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex overflow-hidden">
                    {result
                        ? <ReceiptResult result={result} onReset={handleReset} />
                        : <InstructionsPanel />
                    }
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: Plus,
                                    label: 'Ajouter une ligne',
                                    variant: 'default',
                                    onClick: addItem,
                                },
                                {
                                    icon: RefreshCw,
                                    label: 'Réinitialiser',
                                    variant: 'sage',
                                    onClick: handleReset,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
