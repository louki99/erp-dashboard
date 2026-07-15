import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowLeftRight,
    ArrowRight,
    CheckCircle2,
    Info,
    Loader2,
    Package,
    Plus,
    RefreshCw,
    Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useCreateWmsTransfer } from '@/hooks/stock/useWms';
import { useWarehouses } from '@/hooks/stock/useWarehouse';
import type { TransferItemPayload, TransferResponse } from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (v: string) =>
    parseFloat(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

const emptyItem = (): TransferItemPayload & { _key: string } => ({
    _key: crypto.randomUUID(),
    product_id: 0,
    quantity: 0,
    stock_batch_id: undefined,
});

// ─── Result Panel ─────────────────────────────────────────────────────────────

const TransferResult = ({ result, onReset }: { result: TransferResponse; onReset: () => void }) => (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-emerald-800">Transfert enregistré</h2>
                <p className="text-sm text-emerald-600">{result.message}</p>
            </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Mouvements créés ({result.data.movements.length})
                </p>
            </div>
            <div className="divide-y divide-gray-100">
                {result.data.movements.map(mv => {
                    const isOut = mv.type === 'transfer_out';
                    return (
                        <div key={mv.id} className="px-4 py-3 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${isOut ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                    {isOut ? '↑ SORTIE' : '↓ ENTRÉE'}
                                </span>
                                <span className="text-xs text-gray-500 font-mono">{mv.warehouse_code}</span>
                                {mv.stock_batch_id && (
                                    <span className="text-[10px] text-indigo-500 font-mono">Lot #{mv.stock_batch_id}</span>
                                )}
                            </div>
                            <div className="text-right">
                                <span className={`text-sm font-bold ${isOut ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {isOut ? '' : '+'}{fmtQty(mv.quantity)}
                                </span>
                                <span className="text-[10px] text-gray-400 ml-2">→ {fmtQty(mv.balance_after)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>

        <button
            onClick={onReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 shadow-sm transition-colors"
        >
            <Plus className="w-4 h-4" /> Nouveau transfert
        </button>
    </div>
);

// ─── Instructions Panel ───────────────────────────────────────────────────────

const InstructionsPanel = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center shadow-sm">
                <ArrowLeftRight className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900">Bon de Transfert</h2>
                <p className="text-sm text-gray-400">Mouvement inter-entrepôt avec traçabilité FEFO optionnelle</p>
            </div>
        </div>

        {/* Warning banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
                <p className="text-xs font-bold text-amber-800">Pas de lot miroir à la destination</p>
                <p className="text-[11px] text-amber-600 mt-0.5">
                    Si vous précisez un <span className="font-mono">stock_batch_id</span>, le lot sera débité côté source mais{' '}
                    <strong>aucun lot miroir ne sera créé</strong> à la destination. Le stock destination est crédité en
                    quantité simple (sans traçabilité de lot).
                </p>
            </div>
        </div>

        <div className="space-y-3">
            {[
                { icon: ArrowLeftRight, title: 'Source ≠ Destination', desc: 'Les deux entrepôts doivent être différents — l\'API rejette un transfert interne.' },
                { icon: Package, title: 'Lot source optionnel (FEFO)', desc: 'Fournissez un stock_batch_id uniquement pour respecter l\'ordre FEFO côté source.' },
                { icon: Info, title: 'Rupture de stock', desc: 'L\'API répond 422 "Insufficient stock" si le stock source est insuffisant — vérifiez la matrice avant de transférer.' },
            ].map(tip => (
                <div key={tip.title} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                        <tip.icon className="w-4 h-4 text-indigo-500" />
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
    item: TransferItemPayload & { _key: string };
    index: number;
    onChange: (key: string, field: string, value: any) => void;
    onRemove: (key: string) => void;
    canRemove: boolean;
}

const ItemRow = ({ item, index, onChange, onRemove, canRemove }: ItemRowProps) => (
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
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    ID Produit <span className="text-red-500">*</span>
                </label>
                <input
                    type="number" min="1" step="1"
                    value={item.product_id || ''}
                    onChange={e => onChange(item._key, 'product_id', parseInt(e.target.value) || 0)}
                    placeholder="ex. 1"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white bg-gray-50 transition-all"
                />
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Quantité <span className="text-red-500">*</span>
                </label>
                <input
                    type="number" min="0.001" step="0.001"
                    value={item.quantity || ''}
                    onChange={e => onChange(item._key, 'quantity', parseFloat(e.target.value) || 0)}
                    placeholder="ex. 50"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white bg-gray-50 transition-all"
                />
            </div>
            <div>
                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    ID Lot source <span className="text-[10px] font-normal text-gray-400">(optionnel — FEFO)</span>
                </label>
                <input
                    type="number" min="1" step="1"
                    value={item.stock_batch_id ?? ''}
                    onChange={e => onChange(item._key, 'stock_batch_id', e.target.value ? parseInt(e.target.value) : undefined)}
                    placeholder="ex. 12"
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white bg-gray-50 font-mono transition-all"
                />
                <p className="text-[10px] text-amber-600 mt-1">⚠ Aucun lot miroir créé côté destination.</p>
            </div>
        </div>
    </div>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsTransferPage = () => {
    const [sourceId, setSourceId] = useState<number>(0);
    const [destId, setDestId] = useState<number>(0);
    const [items, setItems] = useState([emptyItem()]);
    const [result, setResult] = useState<TransferResponse | null>(null);

    const { data: warehousesData } = useWarehouses({ active_only: true });
    const warehouses = useMemo(() => {
        const d = warehousesData as any;
        return d?.warehouses?.data ?? d?.data ?? [];
    }, [warehousesData]);

    const { mutate: createTransfer, isPending } = useCreateWmsTransfer();

    const updateItem = (key: string, field: string, value: any) =>
        setItems(prev => prev.map(it => it._key === key ? { ...it, [field]: value } : it));

    const addItem = () => setItems(prev => [...prev, emptyItem()]);
    const removeItem = (key: string) => setItems(prev => prev.filter(it => it._key !== key));

    const validate = (): string | null => {
        if (!sourceId) return 'Sélectionnez l\'entrepôt source.';
        if (!destId) return 'Sélectionnez l\'entrepôt destination.';
        if (sourceId === destId) return 'Source et destination doivent être différents.';
        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            if (!it.product_id) return `Ligne ${i + 1} : ID produit manquant.`;
            if (!it.quantity || it.quantity <= 0) return `Ligne ${i + 1} : quantité invalide.`;
        }
        return null;
    };

    const handleSubmit = () => {
        const err = validate();
        if (err) { toast.error(err); return; }

        createTransfer(
            {
                source_warehouse_id: sourceId,
                destination_warehouse_id: destId,
                items: items.map(it => ({
                    product_id: it.product_id,
                    quantity: it.quantity,
                    ...(it.stock_batch_id ? { stock_batch_id: it.stock_batch_id } : {}),
                })),
            },
            {
                onSuccess: (data) => {
                    setResult(data);
                    toast.success(`Transfert enregistré — ${data.data.movements.length} mouvement(s)`);
                },
                onError: (err: any) => {
                    const code = err?.response?.data?.error_code;
                    const msg = err?.response?.data?.message ?? 'Erreur lors du transfert.';
                    if (code === 'INSUFFICIENT_STOCK') {
                        toast.error(`Stock insuffisant — ${msg}`);
                    } else {
                        toast.error(msg);
                    }
                },
            }
        );
    };

    const handleReset = () => {
        setResult(null);
        setItems([emptyItem()]);
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                                <ArrowLeftRight className="w-4.5 h-4.5 text-indigo-600" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900">Bon de Transfert</h1>
                                <p className="text-[10px] text-gray-400">{items.length} produit{items.length !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        {/* Warehouse selectors */}
                        <div className="space-y-2.5">
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                    Source <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={sourceId || ''}
                                    onChange={e => setSourceId(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                >
                                    <option value="">— Entrepôt source —</option>
                                    {warehouses.map((w: any) => (
                                        <option key={w.id} value={w.id} disabled={w.id === destId}>
                                            {w.code} — {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-center">
                                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100">
                                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                    Destination <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={destId || ''}
                                    onChange={e => setDestId(parseInt(e.target.value) || 0)}
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all"
                                >
                                    <option value="">— Entrepôt destination —</option>
                                    {warehouses.map((w: any) => (
                                        <option key={w.id} value={w.id} disabled={w.id === sourceId}>
                                            {w.code} — {w.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {sourceId > 0 && destId > 0 && sourceId === destId && (
                            <p className="mt-2 text-[10px] text-red-600 font-semibold">
                                ⚠ Source et destination identiques — transfert impossible.
                            </p>
                        )}
                    </div>

                    {/* Items */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        {items.map((item, i) => (
                            <ItemRow
                                key={item._key}
                                item={item}
                                index={i}
                                onChange={updateItem}
                                onRemove={removeItem}
                                canRemove={items.length > 1}
                            />
                        ))}

                        <button
                            onClick={addItem}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-600 border border-dashed border-indigo-200 rounded-xl hover:bg-indigo-50 transition-all"
                        >
                            <Plus className="w-3.5 h-3.5" /> Ajouter un produit
                        </button>
                    </div>

                    {/* Submit */}
                    <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 shadow-sm transition-all"
                        >
                            {isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Transfert en cours...</>
                                : <><ArrowRight className="w-4 h-4" /> Valider le transfert</>
                            }
                        </button>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex overflow-hidden">
                    {result
                        ? <TransferResult result={result} onReset={handleReset} />
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
                                    label: 'Ajouter un produit',
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
