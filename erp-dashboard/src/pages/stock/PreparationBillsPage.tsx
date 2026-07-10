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
    Loader2,
    User,
    Package,
    Calendar,
    ChevronRight,
    X,
    Send,
    Hash,
    Flame,
    Filter,
    Search,
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
    UpdatePreparationBillPayload,
} from '@/types/stock.types';

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
    rejected: { label: 'Rejeté', icon: XCircle, color: 'text-red-700', bg: 'bg-red-100' },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
    1: { label: 'P1', color: 'text-gray-500', bg: 'bg-gray-100' },
    2: { label: 'P2', color: 'text-blue-600', bg: 'bg-blue-100' },
    3: { label: 'P3', color: 'text-indigo-600', bg: 'bg-indigo-100' },
    4: { label: 'P4', color: 'text-amber-600', bg: 'bg-amber-100' },
    5: { label: 'URGENT', color: 'text-red-700', bg: 'bg-red-100' },
};

const isMutable = (status: BPStatus) => status !== 'completed' && status !== 'rejected';

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: BPStatus }) => {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
};

const PriorityBadge = ({ level }: { level: number }) => {
    const cfg = PRIORITY_CONFIG[level] ?? PRIORITY_CONFIG[3];
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color}`}>
            {level === 5 && <Flame className="w-3 h-3" />}
            {cfg.label}
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
    const urgent = bills.filter(b => b.priority_level === 5).length;

    return (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-50/50 p-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center mb-5 shadow-sm">
                <ClipboardList className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">Bons de Préparation</p>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
                Sélectionnez un BP pour voir ses détails, articles et statut de préparation.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-xl">
                {[
                    { label: 'Total BPs', value: total, icon: ClipboardList, color: 'text-gray-700', bg: 'bg-gray-50' },
                    { label: 'En attente', value: pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'En cours', value: inProgress, icon: Send, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'URGENTS', value: urgent, icon: Flame, color: 'text-red-600', bg: 'bg-red-50' },
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
}: {
    bp: PreparationBill;
    onStatusChange: (newStatus: 'pending' | 'in_progress') => void;
}) => {
    const { data: detailData, isLoading } = usePreparationBill(bp.id);
    const detail = (detailData as any)?.preparation_bill ?? bp;
    const items = detail.items ?? [];
    const mutable = isMutable(bp.status);

    const pct = detail.total_items > 0
        ? Math.round((detail.prepared_items / detail.total_items) * 100)
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
                            {bp.magasinier && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {bp.magasinier.name}
                                </span>
                            )}
                            {bp.deadline && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(bp.deadline).toLocaleDateString('fr-FR')}
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
                    <ProgressBar prepared={detail.prepared_items} total={detail.total_items} />
                </div>

                {/* Notes */}
                {bp.notes && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 italic">
                        {bp.notes}
                    </div>
                )}

                {/* Status action */}
                {mutable && bp.status === 'pending' && (
                    <button
                        onClick={() => onStatusChange('in_progress')}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                        <Send className="w-4 h-4" /> Envoyer au magasinier
                    </button>
                )}
            </div>

            {/* Items list */}
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
                        const reqQty = parseFloat(item.requested_quantity);
                        const prepQty = parseFloat(item.prepared_quantity);
                        const shortQty = parseFloat(item.shortage_quantity);
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
                                            <div className="text-[10px] text-gray-400 font-mono">{item.product?.reference}</div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-bold text-gray-900">{prepQty.toFixed(0)}/{reqQty.toFixed(0)}</div>
                                        {shortQty > 0 && (
                                            <div className="text-[10px] text-red-600 flex items-center justify-end gap-1">
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
                                    {item.product?.barcode && <span className="font-mono">{item.product.barcode}</span>}
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
    const [orderIdsText, setOrderIdsText] = useState('');
    const [form, setForm] = useState<Omit<CreatePreparationBillPayload, 'order_ids'>>({
        magasinier_id: undefined,
        priority_level: 3,
        deadline: '',
        notes: '',
    });

    const handleSubmit = async () => {
        const ids = orderIdsText.split(/[\s,;]+/).map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
        if (ids.length === 0) {
            toast.error('Au moins un ID de commande est requis');
            return;
        }
        const tid = toast.loading('Création du bon de préparation...');
        try {
            const res = await create.mutateAsync({
                order_ids: ids,
                ...form,
                deadline: form.deadline || undefined,
                notes: form.notes || undefined,
                magasinier_id: form.magasinier_id || undefined,
            });
            toast.dismiss(tid);
            const bp = (res as any)?.preparation_bill;
            toast.success(`BP créé : ${bp?.bp_number ?? ''}`);
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
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-amber-500" /> Nouveau Bon de Préparation
                    </DialogTitle>
                    <DialogDescription>
                        Créer un BP à partir d'une sélection de commandes.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">IDs Commandes * (séparés par virgule ou espace)</label>
                        <textarea
                            value={orderIdsText}
                            onChange={e => setOrderIdsText(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                            rows={3}
                            placeholder="1042, 1043, 1044"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">ID Magasinier</label>
                            <input
                                type="number"
                                value={form.magasinier_id ?? ''}
                                onChange={e => setForm(p => ({ ...p, magasinier_id: parseInt(e.target.value) || undefined }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                                placeholder="22"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1 font-medium">Priorité (1–5)</label>
                            <select
                                value={form.priority_level}
                                onChange={e => setForm(p => ({ ...p, priority_level: parseInt(e.target.value) }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                            >
                                <option value={1}>1 — Faible</option>
                                <option value={2}>2 — Basse</option>
                                <option value={3}>3 — Normale</option>
                                <option value={4}>4 — Haute</option>
                                <option value={5}>5 — URGENT</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Date limite</label>
                        <input
                            type="date"
                            value={form.deadline ?? ''}
                            onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Notes</label>
                        <textarea
                            value={form.notes ?? ''}
                            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                            rows={2}
                            placeholder="Commandes urgentes export Marrakech..."
                        />
                    </div>

                    {(form.priority_level ?? 0) === 5 && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-700">Ce BP sera marqué <strong>URGENT</strong> — priorité maximale.</p>
                        </div>
                    )}
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 mt-4">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Annuler</button>
                    <button
                        onClick={handleSubmit}
                        disabled={create.isPending}
                        className="px-5 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        {create.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                        Créer le BP
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
}: {
    open: boolean;
    bp: PreparationBill | null;
    onClose: () => void;
    onConfirm: () => void;
}) => (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
        <DialogContent className="max-w-sm">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Send className="w-5 h-5 text-blue-500" /> Envoyer au magasinier ?
                </DialogTitle>
                <DialogDescription>
                    Cette action soumettra le bon de préparation au magasinier pour traitement.
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
                    className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                >
                    <Send className="w-4 h-4" /> Confirmer l'envoi
                </button>
            </div>
        </DialogContent>
    </Dialog>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

export const PreparationBillsPage = () => {
    const [selected, setSelected] = useState<PreparationBill | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
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

    const handleSubmitToMagasinier = async () => {
        if (!selected) return;
        setShowSubmitConfirm(false);
        const tid = toast.loading('Envoi au magasinier...');
        try {
            await updateBP.mutateAsync({ id: selected.id, payload: { status: 'in_progress' } });
            toast.dismiss(tid);
            toast.success('BP envoyé au magasinier');
            setSelected({ ...selected, status: 'in_progress' });
        } catch (e: any) {
            toast.dismiss(tid);
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
            width: 110,
            cellRenderer: (p: any) => <StatusBadge status={p.value} />,
        },
        {
            field: 'priority_level',
            headerName: 'Prio',
            width: 75,
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
        completed: bills.filter(b => b.status === 'completed').length,
        rejected: bills.filter(b => b.status === 'rejected').length,
    }), [bills]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="p-3 border-b border-gray-100 shrink-0">
                            <h1 className="text-sm font-semibold text-gray-900 mb-2">Bons de Préparation</h1>
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
                                    ...(selected.status === 'pending' ? [{
                                        icon: Send,
                                        label: 'Envoyer au magasinier',
                                        variant: 'default' as const,
                                        onClick: () => setShowSubmitConfirm(true),
                                    }] : []),
                                    {
                                        icon: Hash,
                                        label: `${selected.total_items} articles`,
                                        variant: 'default' as const,
                                        onClick: () => {},
                                        disabled: true,
                                    },
                                    {
                                        icon: Calendar,
                                        label: selected.deadline
                                            ? `Deadline: ${new Date(selected.deadline).toLocaleDateString('fr-FR')}`
                                            : 'Pas de deadline',
                                        variant: 'default' as const,
                                        onClick: () => {},
                                        disabled: true,
                                    },
                                ],
                            }] : []),
                        ]}
                    />
                }
            />

            <CreateBPDialog open={showCreate} onClose={() => setShowCreate(false)} />
            <SubmitToMagasinierDialog
                open={showSubmitConfirm}
                bp={selected}
                onClose={() => setShowSubmitConfirm(false)}
                onConfirm={handleSubmitToMagasinier}
            />
        </>
    );
};
