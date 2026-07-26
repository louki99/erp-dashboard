import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    ClipboardList,
    Plus,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
    Ban,
    Loader2,
    User,
    Package,
    Calendar,
    CalendarClock,
    ChevronRight,
    X,
    Send,
    Pencil,
    Flame,
    Filter,
    Search,
    Truck,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import {
    usePreparationBills,
    usePreparationBill,
    useCreatePreparationBill,
    useUpdatePreparationBill,
} from '@/hooks/stock/useWarehouse';
import type {
    PreparationBill,
    BPStatus,
    BPFilters,
    CreatePreparationBillPayload,
} from '@/types/stock.types';
import { MagasinierSelect, MissionSelect, OrderPicker } from './preparationBills/pickers';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BPStatus, { label: string; icon: typeof Clock; color: string; bg: string }> = {
    pending: { label: 'En attente', icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100' },
    in_progress: { label: 'En cours', icon: Send, color: 'text-blue-700', bg: 'bg-blue-100' },
    completed: { label: 'Complété', icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    completed_full: { label: 'Complété (total)', icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
    completed_partial: { label: 'Complété (partiel)', icon: CheckCircle2, color: 'text-teal-700', bg: 'bg-teal-100' },
    rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-700', bg: 'bg-red-100' },
    cancelled: { label: 'Annulé', icon: Ban, color: 'text-gray-600', bg: 'bg-gray-100' },
};

// Terminal states — backend returns 422 ("Cannot edit a <status> preparation
// bill.") on PUT for any of these. Never offer mutation actions once reached.
const TERMINAL_STATUSES: BPStatus[] = ['completed', 'completed_full', 'completed_partial', 'rejected', 'cancelled'];
const isMutable = (status: BPStatus) => !TERMINAL_STATUSES.includes(status);

// priority_level is an int 1-5 on write, but has been observed echoed back as a
// label string (e.g. "normal") on read — normalize both to a 1-5 level for display.
const PRIORITY_LABELS: Record<number, string> = { 1: 'Faible', 2: 'Basse', 3: 'Normale', 4: 'Haute', 5: 'URGENT' };
const PRIORITY_STRING_MAP: Record<string, number> = {
    low: 1, faible: 1,
    below_normal: 2, basse: 2,
    normal: 3, normale: 3,
    high: 4, haute: 4,
    urgent: 5, urgente: 5,
};
const resolvePriorityLevel = (level: number | string | undefined | null): number => {
    if (typeof level === 'number') return level >= 1 && level <= 5 ? level : 3;
    if (typeof level === 'string') {
        const n = Number(level);
        if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
        return PRIORITY_STRING_MAP[level.toLowerCase()] ?? 3;
    }
    return 3;
};

const num = (v: string | number | undefined | null) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: BPStatus }) => {
    const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
};

const PriorityBadge = ({ level }: { level: number | string }) => {
    const resolved = resolvePriorityLevel(level);
    const isUrgent = resolved === 5;
    const cls = resolved === 1 ? 'text-gray-500 bg-gray-100'
        : resolved === 2 ? 'text-blue-600 bg-blue-100'
        : resolved === 3 ? 'text-indigo-600 bg-indigo-100'
        : resolved === 4 ? 'text-amber-600 bg-amber-100'
        : 'text-red-700 bg-red-100';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cls}`}>
            {isUrgent && <Flame className="w-3 h-3" />}
            {PRIORITY_LABELS[resolved]}
        </span>
    );
};

const ProgressBar = ({ prepared, total }: { prepared: number; total: number }) => {
    const pct = total > 0 ? Math.min((prepared / total) * 100, 100) : 0;
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">{prepared}/{total}</span>
        </div>
    );
};

// ─── Empty / Dashboard ────────────────────────────────────────────────────────

const BPDashboard = ({ bills }: { bills: PreparationBill[] }) => {
    const total = bills.length;
    const pending = bills.filter(b => b.status === 'pending').length;
    const inProgress = bills.filter(b => b.status === 'in_progress').length;
    const urgent = bills.filter(b => resolvePriorityLevel(b.priority_level) === 5).length;
    const done = bills.filter(b => b.status === 'completed' || b.status === 'completed_full' || b.status === 'completed_partial').length;

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 p-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center mb-5 shadow-sm">
                <ClipboardList className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Bons de Préparation</p>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
                Composez un BP à partir de commandes confirmées, assignez-le à un magasinier et envoyez-le pour préparation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 w-full max-w-2xl">
                {[
                    { label: 'Total BPs', value: total, icon: ClipboardList, color: 'text-gray-700', bg: 'bg-gray-50' },
                    { label: 'En attente', value: pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'En cours', value: inProgress, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'URGENTS', value: urgent, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Terminés', value: done, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                ].map(k => (
                    <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-white/60 shadow-sm`}>
                        <k.icon className={`w-5 h-5 ${k.color} mb-2`} />
                        <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ─── BP Detail ────────────────────────────────────────────────────────────────

const BPDetail = ({
    bp,
    onStatusChange,
    onEdit,
    onAddOrders,
}: {
    bp: PreparationBill;
    onStatusChange: () => void;
    onEdit: () => void;
    onAddOrders: () => void;
}) => {
    const { data: detailData, isLoading } = usePreparationBill(bp.id);
    const detail = (detailData as any)?.preparation_bill ?? bp;
    const items = detail.items ?? [];
    const mutable = isMutable(bp.status);
    // Adding orders is a dispatch-composition action — only makes sense before
    // the BP has been handed off (pending). Quantities are read-only on this
    // screen entirely: the magasinier's own interface owns prepared_quantity.
    const canAddOrders = bp.status === 'pending';

    const pct = detail.total_items > 0
        ? Math.round((num(detail.prepared_items) / num(detail.total_items)) * 100)
        : 0;

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-white to-slate-50/30 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-mono font-bold text-gray-900">{bp.bp_number}</span>
                            <StatusBadge status={bp.status} />
                            <PriorityBadge level={bp.priority_level} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap mt-1">
                            <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {bp.magasinier ? bp.magasinier.name : <span className="text-amber-600 font-semibold">Non assigné</span>}
                            </span>
                            {bp.delivery_mission && (
                                <span className="flex items-center gap-1">
                                    <Truck className="w-3 h-3" />
                                    {bp.delivery_mission.code}
                                </span>
                            )}
                            {bp.deadline && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(bp.deadline).toLocaleDateString('fr-FR')}
                                </span>
                            )}
                            {bp.estimated_completion && (
                                <span className="flex items-center gap-1">
                                    <CalendarClock className="w-3 h-3" />
                                    Fin est. {new Date(bp.estimated_completion).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {!mutable && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
                                    Lecture seule
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-3xl font-bold text-gray-900">{pct}%</div>
                        <div className="text-xs text-gray-400 mt-0.5">préparé</div>
                    </div>
                </div>

                {/* Progress */}
                <div className="mt-3">
                    <ProgressBar prepared={num(detail.prepared_items)} total={num(detail.total_items)} />
                </div>

                {/* Notes */}
                {bp.notes && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 italic">
                        {bp.notes}
                    </div>
                )}

                {/* Actions */}
                {mutable && (
                    <div className="mt-3 flex items-center gap-2">
                        {bp.status === 'pending' && (
                            <button
                                onClick={onStatusChange}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                <Send className="w-4 h-4" /> Envoyer au magasinier
                            </button>
                        )}
                        <button
                            onClick={onEdit}
                            className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors font-medium"
                        >
                            <Pencil className="w-4 h-4" /> Modifier
                        </button>
                        {canAddOrders && (
                            <button
                                onClick={onAddOrders}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            >
                                <Plus className="w-4 h-4" /> Commandes
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Items list — read-only here; prepared_quantity is entered exclusively
                in the magasinier's own preparation screen. */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    Articles ({items.length})
                </p>
                {isLoading ? (
                    <div className="flex items-center justify-center py-10 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Chargement des articles...
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Aucun article dans ce bon de préparation.
                    </div>
                ) : (
                    items.map((item: any) => {
                        const reqQty = num(item.requested_quantity);
                        const prepQty = num(item.prepared_quantity);
                        const shortQty = num(item.shortage_quantity);
                        const availQty = item.available_quantity !== undefined ? num(item.available_quantity) : null;
                        const itemPct = reqQty > 0 ? Math.min((prepQty / reqQty) * 100, 100) : 0;

                        return (
                            <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Package className="w-3.5 h-3.5 text-indigo-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-semibold text-gray-900 truncate">
                                                {item.product?.name ?? `Produit #${item.product_id}`}
                                            </div>
                                            <div className="text-[10px] text-gray-400 font-mono">{item.product?.code}</div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-bold text-gray-900">{prepQty.toFixed(0)}/{reqQty.toFixed(0)}</div>
                                        {shortQty > 0 && (
                                            <div className="text-[10px] text-red-600 flex items-center justify-end gap-1 mt-0.5">
                                                <AlertTriangle className="w-2.5 h-2.5" /> {shortQty.toFixed(0)} manquant
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-2">
                                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full ${itemPct >= 100 ? 'bg-emerald-500' : itemPct > 0 ? 'bg-blue-500' : 'bg-gray-300'}`}
                                            style={{ width: `${itemPct}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                                    <span>Commande #{item.order_id}</span>
                                    {availQty !== null && <span>Dispo : {availQty.toFixed(0)}</span>}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

// ─── Create BP Dialog ─────────────────────────────────────────────────────────

const CreateBPDialog = ({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) => {
    const create = useCreatePreparationBill();
    const [orderIds, setOrderIds] = useState<number[]>([]);
    const [magasinierId, setMagasinierId] = useState<number | null>(null);
    const [missionId, setMissionId] = useState<number | null>(null);
    const [priority, setPriority] = useState(3);
    const [deadline, setDeadline] = useState('');
    const [notes, setNotes] = useState('');

    const reset = () => {
        setOrderIds([]);
        setMagasinierId(null);
        setMissionId(null);
        setPriority(3);
        setDeadline('');
        setNotes('');
    };

    const handleSubmit = async () => {
        if (orderIds.length === 0) {
            toast.error('Sélectionnez au moins une commande');
            return;
        }
        const payload: CreatePreparationBillPayload = {
            order_ids: orderIds,
            magasinier_id: magasinierId ?? undefined,
            delivery_mission_id: missionId ?? undefined,
            priority_level: priority,
            deadline: deadline || undefined,
            notes: notes || undefined,
        };
        const tid = toast.loading('Création du bon de préparation...');
        try {
            const res = await create.mutateAsync(payload);
            toast.dismiss(tid);
            const bp = (res as any)?.preparation_bill;
            toast.success(`BP créé : ${bp?.bp_number ?? ''}`);
            reset();
            onClose();
        } catch (e: any) {
            toast.dismiss(tid);
            const errData = e?.response?.data;
            if (errData?.order_ids?.length) {
                toast.error(`Commandes déjà liées à un BP : ${errData.order_ids.join(', ')}`);
            } else {
                toast.error(errData?.message ?? 'Erreur lors de la création');
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-amber-500" /> Nouveau Bon de Préparation
                    </DialogTitle>
                    <DialogDescription>
                        Groupez des commandes confirmées en un BP à envoyer au magasinier.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                    <div className="h-80 md:h-96">
                        <OrderPicker selectedIds={orderIds} onChange={setOrderIds} />
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Magasinier</label>
                            <MagasinierSelect value={magasinierId} onChange={setMagasinierId} />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Mission de livraison</label>
                            <MissionSelect value={missionId} onChange={setMissionId} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Priorité</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(parseInt(e.target.value))}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                                >
                                    <option value={1}>1 — Faible</option>
                                    <option value={2}>2 — Basse</option>
                                    <option value={3}>3 — Normale</option>
                                    <option value={4}>4 — Haute</option>
                                    <option value={5}>5 — URGENT</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1 font-medium">Date limite</label>
                                <input
                                    type="date"
                                    value={deadline}
                                    onChange={e => setDeadline(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                rows={3}
                                placeholder="Commandes urgentes export Marrakech..."
                            />
                        </div>
                        {priority === 5 && (
                            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-red-700">Ce BP sera marqué <strong>URGENT</strong> — priorité maximale.</p>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={create.isPending}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Créer le BP ({orderIds.length})
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Edit BP Dialog ───────────────────────────────────────────────────────────

const EditBPDialog = ({
    open,
    bp,
    onClose,
}: {
    open: boolean;
    bp: PreparationBill | null;
    onClose: () => void;
}) => {
    const updateBP = useUpdatePreparationBill();
    const [magasinierId, setMagasinierId] = useState<number | null>(bp?.magasinier?.id ?? null);
    const [priority, setPriority] = useState(resolvePriorityLevel(bp?.priority_level));
    const [deadline, setDeadline] = useState(bp?.deadline?.slice(0, 10) ?? '');
    const [estimatedCompletion, setEstimatedCompletion] = useState(bp?.estimated_completion?.slice(0, 16) ?? '');
    const [notes, setNotes] = useState(bp?.notes ?? '');

    // Re-seed local state whenever a different BP is opened for edit.
    const [seededId, setSeededId] = useState<number | null>(null);
    if (bp && bp.id !== seededId && open) {
        setSeededId(bp.id);
        setMagasinierId(bp.magasinier?.id ?? null);
        setPriority(resolvePriorityLevel(bp.priority_level));
        setDeadline(bp.deadline?.slice(0, 10) ?? '');
        setEstimatedCompletion(bp.estimated_completion?.slice(0, 16) ?? '');
        setNotes(bp.notes ?? '');
    }

    const handleSubmit = async () => {
        if (!bp) return;
        const tid = toast.loading('Mise à jour du bon de préparation...');
        try {
            await updateBP.mutateAsync({
                id: bp.id,
                payload: {
                    magasinier_id: magasinierId,
                    priority_level: priority,
                    deadline: deadline || null,
                    estimated_completion: estimatedCompletion || null,
                    notes: notes || null,
                },
            });
            toast.dismiss(tid);
            toast.success('Bon de préparation mis à jour');
            onClose();
        } catch (e: any) {
            toast.dismiss(tid);
            toast.error(e?.response?.data?.message ?? 'Erreur lors de la mise à jour');
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="w-5 h-5 text-amber-500" /> Modifier {bp?.bp_number}
                    </DialogTitle>
                    <DialogDescription>Ajuster l'assignation, la priorité et les échéances.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Magasinier</label>
                        <MagasinierSelect value={magasinierId} onChange={setMagasinierId} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Priorité</label>
                            <select
                                value={priority}
                                onChange={e => setPriority(parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value={1}>1 — Faible</option>
                                <option value={2}>2 — Basse</option>
                                <option value={3}>3 — Normale</option>
                                <option value={4}>4 — Haute</option>
                                <option value={5}>5 — URGENT</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Date limite</label>
                            <input
                                type="date"
                                value={deadline}
                                onChange={e => setDeadline(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Fin estimée</label>
                        <input
                            type="datetime-local"
                            value={estimatedCompletion}
                            onChange={e => setEstimatedCompletion(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            rows={2}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={updateBP.isPending}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {updateBP.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Enregistrer
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Add Orders Dialog ────────────────────────────────────────────────────────

const AddOrdersDialog = ({
    open,
    bp,
    onClose,
}: {
    open: boolean;
    bp: PreparationBill | null;
    onClose: () => void;
}) => {
    const updateBP = useUpdatePreparationBill();
    const [orderIds, setOrderIds] = useState<number[]>([]);
    const excludeIds = useMemo(() => (bp?.items ?? []).map((i) => i.order_id), [bp]);

    const handleSubmit = async () => {
        if (!bp || orderIds.length === 0) return;
        const tid = toast.loading('Ajout des commandes...');
        try {
            await updateBP.mutateAsync({ id: bp.id, payload: { add_order_ids: orderIds } });
            toast.dismiss(tid);
            toast.success('Commandes ajoutées au BP');
            setOrderIds([]);
            onClose();
        } catch (e: any) {
            toast.dismiss(tid);
            const errData = e?.response?.data;
            if (errData?.order_ids?.length) {
                toast.error(`Commandes déjà liées à un BP : ${errData.order_ids.join(', ')}`);
            } else {
                toast.error(errData?.message ?? "Erreur lors de l'ajout des commandes");
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-amber-500" /> Ajouter des commandes — {bp?.bp_number}
                    </DialogTitle>
                    <DialogDescription>Max 200 commandes ajoutées en une fois.</DialogDescription>
                </DialogHeader>
                <div className="h-80 pt-2">
                    <OrderPicker selectedIds={orderIds} onChange={setOrderIds} excludeIds={excludeIds} />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={updateBP.isPending || orderIds.length === 0}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {updateBP.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Ajouter ({orderIds.length})
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Submit to Magasinier confirmation ───────────────────────────────────────

const SubmitToMagasinierDialog = ({
    open,
    bp,
    onClose,
    onConfirm,
    loading,
}: {
    open: boolean;
    bp: PreparationBill | null;
    onClose: () => void;
    onConfirm: () => void;
    loading: boolean;
}) => (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-500" /> Envoyer au magasinier ?
                </DialogTitle>
                <DialogDescription>
                    Cette action soumettra le bon de préparation au magasinier pour traitement (pending → in_progress).
                </DialogDescription>
            </DialogHeader>
            {bp && (
                <div className="my-2 p-3 bg-slate-50 rounded-lg border border-gray-200 text-sm">
                    <div className="font-mono font-bold text-gray-900">{bp.bp_number}</div>
                    <div className="text-xs text-gray-500 mt-1">{bp.total_items} articles · {bp.magasinier?.name ?? 'Aucun magasinier'}</div>
                </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                <button
                    onClick={onConfirm}
                    disabled={loading}
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Confirmer l'envoi
                </button>
            </div>
        </DialogContent>
    </Dialog>
);

// ─── Filters Dialog ───────────────────────────────────────────────────────────

const FiltersDialog = ({
    open,
    filters,
    onClose,
    onApply,
}: {
    open: boolean;
    filters: BPFilters;
    onClose: () => void;
    onApply: (f: BPFilters) => void;
}) => {
    const [magasinierId, setMagasinierId] = useState<number | null>(filters.magasinier_id ?? null);
    const [missionId, setMissionId] = useState<number | null>(filters.delivery_mission_id ?? null);
    const [fromDate, setFromDate] = useState(filters.from_date ?? '');
    const [toDate, setToDate] = useState(filters.to_date ?? '');

    return (
        <Dialog open={open} onOpenChange={v => !v && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Filter className="w-5 h-5 text-amber-500" /> Filtres
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Magasinier</label>
                        <MagasinierSelect value={magasinierId} onChange={setMagasinierId} />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Mission de livraison</label>
                        <MissionSelect value={missionId} onChange={setMissionId} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Créé du</label>
                            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">au</label>
                            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
                        </div>
                    </div>
                </div>
                <div className="flex justify-between gap-2 pt-2 border-t border-gray-100 mt-4">
                    <button
                        onClick={() => { setMagasinierId(null); setMissionId(null); setFromDate(''); setToDate(''); onApply({ ...filters, magasinier_id: undefined, delivery_mission_id: undefined, from_date: undefined, to_date: undefined }); onClose(); }}
                        className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Réinitialiser
                    </button>
                    <button
                        onClick={() => {
                            onApply({
                                ...filters,
                                magasinier_id: magasinierId ?? undefined,
                                delivery_mission_id: missionId ?? undefined,
                                from_date: fromDate || undefined,
                                to_date: toDate || undefined,
                            });
                            onClose();
                        }}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                    >
                        Appliquer
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PreparationBillsPage = () => {
    const [selected, setSelected] = useState<PreparationBill | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [showAddOrders, setShowAddOrders] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<BPFilters>({ per_page: 30 });
    const [search, setSearch] = useState('');

    const { data, isLoading, refetch } = usePreparationBills({
        ...filters,
        search: search || undefined,
    });
    const updateBP = useUpdatePreparationBill();

    const bills: PreparationBill[] = useMemo(() => {
        const d = data as any;
        if (Array.isArray(d?.preparation_bills?.data)) return d.preparation_bills.data;
        if (Array.isArray(d?.data)) return d.data;
        if (Array.isArray(d)) return d;
        return [];
    }, [data]);

    const activeExtraFilters = [filters.magasinier_id, filters.delivery_mission_id, filters.from_date, filters.to_date].filter(Boolean).length;

    const handleSubmitToMagasinier = async () => {
        if (!selected) return;
        try {
            await updateBP.mutateAsync({ id: selected.id, payload: { status: 'in_progress' } });
            setShowSubmitConfirm(false);
            toast.success('BP envoyé au magasinier');
            setSelected({ ...selected, status: 'in_progress' });
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Erreur lors de la mise à jour');
        }
    };

    const colDefs = useMemo<ColDef[]>(() => [
        {
            field: 'bp_number',
            headerName: 'N° BP',
            width: 155,
            cellRenderer: (p: any) => {
                const b: PreparationBill = p.data;
                return (
                    <div className="py-1">
                        <div className="text-xs font-mono font-bold text-gray-900">{b.bp_number}</div>
                        <div className="text-[10px] text-gray-400">
                            {new Date(b.created_at).toLocaleDateString('fr-FR')}
                        </div>
                    </div>
                );
            },
        },
        {
            field: 'status',
            headerName: 'Statut',
            width: 130,
            cellRenderer: (p: any) => <StatusBadge status={p.value} />,
        },
        {
            field: 'priority_level',
            headerName: 'Prio',
            width: 90,
            cellRenderer: (p: any) => <PriorityBadge level={p.value} />,
        },
        {
            field: 'total_items',
            headerName: 'Articles',
            width: 75,
            cellStyle: { textAlign: 'center', fontWeight: '600', color: '#4f46e5' },
        },
        {
            field: 'magasinier',
            headerName: 'Magasinier',
            width: 130,
            valueGetter: (p: any) => p.data?.magasinier?.name ?? 'Non assigné',
            cellStyle: (p: any) => ({
                fontSize: '11px',
                color: p.data?.magasinier ? '#374151' : '#f59e0b',
                fontWeight: p.data?.magasinier ? '400' : '600',
            }),
        },
    ], []);

    const statusCounts = useMemo(() => ({
        all: bills.length,
        pending: bills.filter(b => b.status === 'pending').length,
        in_progress: bills.filter(b => b.status === 'in_progress').length,
        completed: bills.filter(b => b.status === 'completed' || b.status === 'completed_full' || b.status === 'completed_partial').length,
    }), [bills]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="p-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-sm font-semibold text-gray-900">Bons de Préparation</h1>
                                <button
                                    onClick={() => setShowFilters(true)}
                                    className={`relative flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors ${
                                        activeExtraFilters > 0 ? 'border-amber-400 text-amber-700 bg-amber-50' : 'border-gray-200 text-gray-500 hover:border-amber-300'
                                    }`}
                                >
                                    <Filter className="w-3.5 h-3.5" /> Filtres
                                    {activeExtraFilters > 0 && (
                                        <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                                            {activeExtraFilters}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="N° BP..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>

                            {/* Status pills */}
                            <div className="flex flex-wrap gap-1 mt-2">
                                {([
                                    { key: undefined, label: `Tous (${statusCounts.all})` },
                                    { key: 'pending' as BPStatus, label: `Attente (${statusCounts.pending})` },
                                    { key: 'in_progress' as BPStatus, label: `En cours (${statusCounts.in_progress})` },
                                    { key: 'completed' as BPStatus, label: `Complétés (${statusCounts.completed})` },
                                ] as { key: BPStatus | undefined; label: string }[]).map(opt => (
                                    <button
                                        key={opt.label}
                                        onClick={() => setFilters(p => ({ ...p, status: opt.key }))}
                                        className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                                            filters.status === opt.key
                                                ? 'bg-amber-600 text-white border-amber-600'
                                                : 'border-gray-200 text-gray-500 hover:border-amber-300'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="h-full rounded-lg border border-gray-200 overflow-hidden">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full text-gray-400">
                                        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={bills}
                                        columnDefs={colDefs}
                                        loading={isLoading}
                                        rowSelection="single"
                                        onRowSelected={(row: PreparationBill) => setSelected(row)}
                                        onSelectionChanged={() => {}}
                                        rowHeight={48}
                                    />
                                )}
                            </div>
                        </div>
                        <div className="p-2 border-t border-gray-100 shrink-0">
                            <span className="text-xs text-gray-400">{bills.length} BP{bills.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {selected ? (
                            <div className="flex-1 flex flex-col overflow-hidden">
                                <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
                                    <button onClick={() => setSelected(null)} className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
                                        <X className="w-4 h-4 text-gray-500" />
                                    </button>
                                    <span className="text-xs font-mono text-gray-400">{selected.bp_number}</span>
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <BPDetail
                                        bp={selected}
                                        onStatusChange={() => setShowSubmitConfirm(true)}
                                        onEdit={() => setShowEdit(true)}
                                        onAddOrders={() => setShowAddOrders(true)}
                                    />
                                </div>
                            </div>
                        ) : (
                            <BPDashboard bills={bills} />
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        groups={[
                            {
                                items: [
                                    {
                                        icon: RefreshCw,
                                        label: 'Actualiser',
                                        variant: 'sage',
                                        onClick: () => refetch(),
                                    },
                                    {
                                        icon: Plus,
                                        label: 'Nouveau BP',
                                        variant: 'primary',
                                        onClick: () => setShowCreate(true),
                                    },
                                ],
                            },
                            ...(selected ? [{
                                items: [
                                    ...(isMutable(selected.status) && selected.status === 'pending' ? [{
                                        icon: Send,
                                        label: 'Envoyer au magasinier',
                                        variant: 'default' as const,
                                        onClick: () => setShowSubmitConfirm(true),
                                    }] : []),
                                    ...(isMutable(selected.status) ? [{
                                        icon: Pencil,
                                        label: 'Modifier',
                                        variant: 'default' as const,
                                        onClick: () => setShowEdit(true),
                                    }] : []),
                                    ...(selected.status === 'pending' ? [{
                                        icon: Plus,
                                        label: 'Ajouter commandes',
                                        variant: 'default' as const,
                                        onClick: () => setShowAddOrders(true),
                                    }] : []),
                                ],
                            }] : []),
                        ]}
                    />
                }
            />

            <CreateBPDialog open={showCreate} onClose={() => setShowCreate(false)} />
            <EditBPDialog
                open={showEdit}
                bp={selected}
                onClose={() => setShowEdit(false)}
            />
            <AddOrdersDialog
                open={showAddOrders}
                bp={selected}
                onClose={() => setShowAddOrders(false)}
            />
            <FiltersDialog
                open={showFilters}
                filters={filters}
                onClose={() => setShowFilters(false)}
                onApply={setFilters}
            />
            <SubmitToMagasinierDialog
                open={showSubmitConfirm}
                bp={selected}
                onClose={() => setShowSubmitConfirm(false)}
                onConfirm={handleSubmitToMagasinier}
                loading={updateBP.isPending}
            />
        </>
    );
};
