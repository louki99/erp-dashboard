import { useMemo, useState } from 'react';
import {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    ClipboardList,
    Loader2,
    MapPin,
    MinusCircle,
    PlusCircle,
    RefreshCw,
    Warehouse,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useCreateWmsAdjustment } from '@/hooks/stock/useWms';
import { useWarehouses, useWarehouseLocations } from '@/hooks/stock/useWarehouse';
import type { AdjustmentResponse } from '@/types/stock.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_CODES = [
    { value: 'CASSE_DEPOT', label: 'Casse dépôt — dommage physique en entrepôt' },
    { value: 'PERTE', label: 'Perte — disparition inexpliquée' },
    { value: 'VOL', label: 'Vol — soustraction malveillante' },
    { value: 'ECART_INVENTAIRE', label: 'Écart inventaire — correction de comptage' },
] as const;

type ReasonCode = typeof REASON_CODES[number]['value'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtQty = (v: string) =>
    parseFloat(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

// ─── Result Panel ─────────────────────────────────────────────────────────────

const AdjustmentResult = ({ result, onReset }: { result: AdjustmentResponse; onReset: () => void }) => {
    const mv = result.data.movement;
    const isLoss = parseFloat(mv.quantity) < 0;
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-emerald-800">Ajustement enregistré</h2>
                    <p className="text-sm text-emerald-600">{result.message}</p>
                </div>
            </div>

            {/* Movement card */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-4">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Mouvement #{mv.id}</p>
                </div>
                <div className="px-4 py-4 grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Entrepôt</p>
                        <p className="text-sm font-bold text-gray-900 font-mono">{mv.warehouse_code}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Type</p>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                            {mv.type.toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Variation</p>
                        <p className={`text-xl font-black ${isLoss ? 'text-red-600' : 'text-emerald-600'}`}>
                            {parseFloat(mv.quantity) > 0 ? '+' : ''}{fmtQty(mv.quantity)}
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Solde après</p>
                        <p className="text-xl font-black text-gray-900">{fmtQty(mv.balance_after)}</p>
                    </div>
                </div>
            </div>

            {/* Stock card */}
            {result.data.stock && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Stock mis à jour</p>
                    </div>
                    <div className="px-4 py-4 grid grid-cols-3 gap-3">
                        {[
                            { label: 'Physique', value: result.data.stock.quantity, color: 'text-gray-900' },
                            { label: 'Réservé', value: result.data.stock.reserved_quantity, color: 'text-amber-700' },
                            { label: 'Disponible', value: result.data.stock.available_quantity, color: 'text-emerald-700' },
                        ].map(kpi => (
                            <div key={kpi.label} className="text-center">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                                <p className={`text-base font-bold ${kpi.color}`}>{fmtQty(kpi.value)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={onReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 shadow-sm transition-colors"
            >
                <ClipboardList className="w-4 h-4" /> Nouvel ajustement
            </button>
        </div>
    );
};

// ─── Instructions Panel ───────────────────────────────────────────────────────

const InstructionsPanel = () => (
    <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center shadow-sm">
                <ClipboardList className="w-6 h-6 text-violet-600" />
            </div>
            <div>
                <h2 className="text-lg font-bold text-gray-900">Ajustement Manuel</h2>
                <p className="text-sm text-gray-400">Correction de stock — perte, casse, écart inventaire</p>
            </div>
        </div>

        <div className="space-y-3">
            {[
                { icon: MinusCircle, title: 'Quantité signée', desc: 'Négatif = perte/sortie. Positif = surplus/entrée. La valeur 0 est refusée par l\'API.' },
                { icon: MapPin, title: 'Emplacement obligatoire', desc: 'Sélectionnez d\'abord l\'entrepôt pour charger ses emplacements (bins).' },
                { icon: AlertTriangle, title: 'Code motif obligatoire', desc: 'Choisissez CASSE_DEPOT, PERTE, VOL ou ECART_INVENTAIRE — exigé pour la traçabilité audit.' },
                { icon: Warehouse, title: 'Acteur déduit du token', desc: 'Ne saisissez pas d\'ID utilisateur — l\'acteur est toujours déduit du token de connexion (sécurité).' },
            ].map(tip => (
                <div key={tip.title} className="flex items-start gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                        <tip.icon className="w-4 h-4 text-violet-500" />
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsAdjustmentPage = () => {
    const [warehouseId, setWarehouseId] = useState<number>(0);
    const [locationId, setLocationId] = useState<number>(0);
    const [productId, setProductId] = useState<string>('');
    const [quantity, setQuantity] = useState<string>('');
    const [reasonCode, setReasonCode] = useState<string>('');
    const [notes, setNotes] = useState<string>('');
    const [result, setResult] = useState<AdjustmentResponse | null>(null);

    const { data: warehousesData } = useWarehouses({ active_only: true });
    const { data: locationsData } = useWarehouseLocations(warehouseId || null);

    const warehouses = useMemo(() => {
        const d = warehousesData as any;
        return d?.warehouses?.data ?? d?.data ?? [];
    }, [warehousesData]);

    const locations = useMemo(() => {
        const d = locationsData as any;
        return d?.locations ?? [];
    }, [locationsData]);

    const { mutate: createAdjustment, isPending } = useCreateWmsAdjustment();

    const qty = parseFloat(quantity);
    const qtyIsLoss = !isNaN(qty) && qty < 0;
    const qtyIsSurplus = !isNaN(qty) && qty > 0;

    const validate = (): string | null => {
        if (!warehouseId) return 'Sélectionnez un entrepôt.';
        if (!locationId) return 'Sélectionnez un emplacement.';
        if (!productId || parseInt(productId) < 1) return 'ID produit invalide.';
        if (!quantity || isNaN(qty) || qty === 0) return 'La quantité ne peut pas être 0 ou vide.';
        if (!reasonCode) return 'Code motif obligatoire.';
        return null;
    };

    const handleSubmit = () => {
        const err = validate();
        if (err) { toast.error(err); return; }

        createAdjustment(
            {
                warehouse_id: warehouseId,
                storage_location_id: locationId,
                product_id: parseInt(productId),
                quantity: qty,
                reason_code: reasonCode,
                ...(notes.trim() ? { notes: notes.trim() } : {}),
            },
            {
                onSuccess: (data) => {
                    setResult(data);
                    toast.success('Ajustement enregistré');
                },
                onError: (err: any) => {
                    const msg = err?.response?.data?.message ?? 'Erreur lors de l\'ajustement.';
                    toast.error(msg);
                },
            }
        );
    };

    const handleReset = () => {
        setResult(null);
        setProductId('');
        setQuantity('');
        setReasonCode('');
        setNotes('');
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center">
                                <ClipboardList className="w-4.5 h-4.5 text-violet-600" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-gray-900">Ajustement Manuel</h1>
                                <p className="text-[10px] text-gray-400">Un produit, un emplacement</p>
                            </div>
                        </div>
                    </div>

                    {/* Form */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">

                        {/* Warehouse */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Entrepôt <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={warehouseId || ''}
                                onChange={e => { setWarehouseId(parseInt(e.target.value) || 0); setLocationId(0); }}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                            >
                                <option value="">— Sélectionner —</option>
                                {warehouses.map((w: any) => (
                                    <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Location */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Emplacement <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={locationId || ''}
                                onChange={e => setLocationId(parseInt(e.target.value) || 0)}
                                disabled={!warehouseId}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50 transition-all"
                            >
                                <option value="">— Choisir un bin —</option>
                                {locations.map((loc: any) => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.location_code} — {loc.location_name}
                                    </option>
                                ))}
                            </select>
                            {!warehouseId && (
                                <p className="text-[10px] text-gray-400 mt-1">Sélectionnez d'abord l'entrepôt.</p>
                            )}
                        </div>

                        {/* Product ID */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                ID Produit <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number" min="1" step="1"
                                value={productId}
                                onChange={e => setProductId(e.target.value)}
                                placeholder="ex. 1"
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white transition-all"
                            />
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Quantité <span className="text-red-500">*</span>
                                <span className="text-[10px] font-normal text-gray-400 ml-1">(signée — négatif = perte)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number" step="0.001"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    placeholder="ex. -10 ou +50"
                                    className={`w-full px-3 py-1.5 pr-8 text-xs border rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:bg-white font-mono transition-all ${
                                        qtyIsLoss ? 'border-red-300 text-red-700 focus:ring-red-300' :
                                        qtyIsSurplus ? 'border-emerald-300 text-emerald-700 focus:ring-emerald-300' :
                                        'border-gray-200 focus:ring-violet-400'
                                    }`}
                                />
                                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                    {qtyIsLoss && <MinusCircle className="w-3.5 h-3.5 text-red-500" />}
                                    {qtyIsSurplus && <PlusCircle className="w-3.5 h-3.5 text-emerald-500" />}
                                </div>
                            </div>
                            {quantity && qty === 0 && (
                                <p className="text-[10px] text-red-600 mt-1 font-semibold">La valeur 0 est refusée.</p>
                            )}
                        </div>

                        {/* Reason code */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Code motif <span className="text-red-500">*</span>
                            </label>
                            <select
                                value={reasonCode}
                                onChange={e => setReasonCode(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 transition-all"
                            >
                                <option value="">— Choisir le motif —</option>
                                {REASON_CODES.map(rc => (
                                    <option key={rc.value} value={rc.value}>{rc.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                Notes <span className="text-[10px] font-normal text-gray-400">(optionnel)</span>
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                placeholder="Détails supplémentaires..."
                                className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:bg-white resize-none transition-all"
                            />
                        </div>

                        {/* Security notice */}
                        <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <AlertTriangle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-slate-500">
                                L'auteur de l'ajustement est déduit du token de connexion — aucun champ utilisateur à renseigner.
                            </p>
                        </div>
                    </div>

                    {/* Submit */}
                    <div className="px-4 py-3 border-t border-gray-100 shrink-0">
                        <button
                            onClick={handleSubmit}
                            disabled={isPending}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-50 shadow-sm transition-all"
                        >
                            {isPending
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Enregistrement...</>
                                : <><ArrowRight className="w-4 h-4" /> Valider l'ajustement</>
                            }
                        </button>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex overflow-hidden">
                    {result
                        ? <AdjustmentResult result={result} onReset={handleReset} />
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
