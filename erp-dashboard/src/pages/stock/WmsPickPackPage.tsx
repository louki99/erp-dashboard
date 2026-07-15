import { useState, useMemo } from 'react';
import {
    AlertOctagon,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    ClipboardList,
    Hash,
    Loader2,
    MapPin,
    Package,
    RefreshCw,
    X,
    XCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { useWmsPickTasks, useCompletePickTask } from '@/hooks/stock/useWms';
import type { WmsPickTask, PickTaskStatus } from '@/types/stock.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PickTaskStatus, { label: string; bg: string; text: string; border: string }> = {
    pending:     { label: 'En attente',   bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200' },
    in_progress: { label: 'En cours',     bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'  },
    completed:   { label: 'Complété',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    cancelled:   { label: 'Annulé',       bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200'  },
};

// ─── Complete Task Modal ───────────────────────────────────────────────────────

interface CompleteModalProps {
    task: WmsPickTask | null;
    onClose: () => void;
}

const CompleteTaskModal = ({ task, onClose }: CompleteModalProps) => {
    const [qty, setQty] = useState<string>('');
    const [batchId, setBatchId] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [batchError, setBatchError] = useState<{ message: string; batchNumber: string; reason: string } | null>(null);

    const { mutate: complete, isPending } = useCompletePickTask();

    const handleSubmit = () => {
        if (!task) return;
        const actual = parseFloat(qty);
        if (!qty || isNaN(actual) || actual <= 0) {
            toast.error('Saisissez une quantité collectée valide.');
            return;
        }
        setBatchError(null);

        const payload: any = { actual_picked_quantity: actual };
        if (batchId.trim()) payload.stock_batch_id = parseInt(batchId.trim(), 10);
        if (notes.trim()) payload.notes = notes.trim();

        complete(
            { id: task.id, payload },
            {
                onSuccess: () => {
                    toast.success('Tâche de collecte validée !');
                    onClose();
                },
                onError: (err: any) => {
                    const data = err?.response?.data;
                    if (data?.error_code === 'WMS_INVALID_BATCH') {
                        setBatchError({
                            message: data.message ?? 'Lot invalide',
                            batchNumber: data.errors?.batch_number ?? `#${batchId}`,
                            reason: data.errors?.reason ?? 'Lot expiré ou bloqué',
                        });
                    } else {
                        toast.error(data?.message ?? 'Erreur lors de la validation.');
                    }
                },
            }
        );
    };

    const handleClose = () => {
        setBatchError(null);
        setQty('');
        setBatchId('');
        setNotes('');
        onClose();
    };

    if (!task) return null;

    return (
        <Dialog open={task !== null} onOpenChange={v => !v && handleClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <ClipboardList className="w-4 h-4 text-teal-500" />
                        Valider la collecte #{task.sequence_number}
                    </DialogTitle>
                    <DialogDescription>
                        {task.product.name} — {task.storage_location.location_code}
                    </DialogDescription>
                </DialogHeader>

                {/* Batch error blocking banner */}
                {batchError && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                            <AlertOctagon className="w-4 h-4 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-red-800">Lot invalide — collecte rejetée</p>
                            <p className="text-xs text-red-700 mt-0.5 font-mono font-semibold">LOT : {batchError.batchNumber}</p>
                            <p className="text-xs text-red-600 mt-0.5">{batchError.reason}</p>
                            <p className="text-xs text-red-500 mt-1">Scannez un autre lot ou laissez le champ vide pour continuer sans traçabilité de lot.</p>
                        </div>
                        <button onClick={() => { setBatchError(null); setBatchId(''); }} className="shrink-0 text-red-400 hover:text-red-600">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Task info */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-1">À collecter</div>
                        <div className="text-2xl font-bold text-gray-900">{task.quantity_to_pick}</div>
                        <div className="text-xs text-gray-500">unité{task.quantity_to_pick !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                        <div className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold mb-1">Emplacement</div>
                        <div className="text-sm font-bold text-indigo-800 font-mono">{task.storage_location.location_code}</div>
                        <div className="text-[10px] text-indigo-400">{task.storage_location.location_type}</div>
                    </div>
                </div>

                {/* Form fields */}
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Quantité réellement collectée <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="1"
                            value={qty}
                            onChange={e => setQty(e.target.value)}
                            placeholder={`Max : ${task.quantity_to_pick}`}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            ID du lot scanné
                            <span className="ml-1 text-[10px] font-normal text-gray-400">(optionnel — si traçabilité lot activée)</span>
                        </label>
                        <input
                            type="number"
                            min="1"
                            step="1"
                            value={batchId}
                            onChange={e => { setBatchId(e.target.value); setBatchError(null); }}
                            placeholder="ex. 12"
                            className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${batchError ? 'border-red-300 focus:ring-red-400 bg-red-50' : 'border-gray-200 focus:ring-teal-400'}`}
                        />
                        {batchError && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Lot rejeté — modifiez ou effacez ce champ
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">
                            Notes <span className="text-[10px] font-normal text-gray-400">(optionnel)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Collecte conforme, anomalie observée..."
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isPending || !qty}
                        className="inline-flex items-center gap-2 px-5 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Valider la collecte
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
};

// ─── Task Card ─────────────────────────────────────────────────────────────────

const TaskCard = ({ task, onComplete }: { task: WmsPickTask; onComplete: (t: WmsPickTask) => void }) => {
    const status = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;
    const canComplete = task.status === 'pending' || task.status === 'in_progress';

    return (
        <div className={`bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${canComplete ? 'border-gray-200 hover:border-teal-200' : 'border-gray-100 opacity-70'}`}>
            <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                    {/* Sequence badge */}
                    <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-bold text-teal-700">#{task.sequence_number}</span>
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${status.bg} ${status.text} ${status.border}`}>
                                {status.label}
                            </span>
                            <span className="text-[10px] text-gray-400 font-mono">BP #{task.preparation_order_id}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 leading-tight truncate">{task.product.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5">{task.product.code}</p>
                    </div>

                    {/* Qty */}
                    <div className="shrink-0 text-right">
                        <div className="text-xl font-bold text-gray-900">{task.quantity_to_pick}</div>
                        <div className="text-[10px] text-gray-400">à collecter</div>
                        {task.actual_picked_quantity != null && (
                            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                                ✓ {task.actual_picked_quantity} collecté
                            </div>
                        )}
                    </div>
                </div>

                {/* Location row */}
                <div className="flex items-center gap-1.5 mt-3 px-3 py-2 bg-indigo-50 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span className="text-xs font-mono font-semibold text-indigo-700">{task.storage_location.location_code}</span>
                    <ChevronRight className="w-3 h-3 text-indigo-300" />
                    <span className="text-[10px] text-indigo-400 truncate">{task.storage_location.location_name}</span>
                    <span className="ml-auto text-[10px] text-indigo-300 font-medium shrink-0">{task.storage_location.location_type}</span>
                </div>

                {/* Action */}
                {canComplete && (
                    <button
                        onClick={() => onComplete(task)}
                        className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-sm"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        Valider la collecte
                    </button>
                )}

                {task.status === 'completed' && task.completed_at && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" />
                        Complété le {new Date(task.completed_at).toLocaleString('fr-FR')}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export const WmsPickPackPage = () => {
    const [bpId, setBpId] = useState<string>('');
    const [showCompleted, setShowCompleted] = useState(false);
    const [completingTask, setCompletingTask] = useState<WmsPickTask | null>(null);

    const filters = useMemo(() => ({
        preparation_order_id: bpId ? parseInt(bpId, 10) : undefined,
        status: showCompleted ? ('completed' as const) : undefined,
    }), [bpId, showCompleted]);

    const { data, isLoading, refetch } = useWmsPickTasks(filters);

    // Sort by sequence_number (mandatory — server-calculated optimal visit order)
    const tasks: WmsPickTask[] = useMemo(() => {
        const raw: any = data;
        const list: WmsPickTask[] = Array.isArray(raw?.data?.data) ? raw.data.data : [];
        return [...list].sort((a, b) => a.sequence_number - b.sequence_number);
    }, [data]);

    const pendingCount = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                                    <Package className="w-4.5 h-4.5 text-teal-600" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900">Console Pick & Pack</h1>
                                    <p className="text-[10px] text-gray-400">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>

                            {/* BP filter */}
                            <div className="mb-3">
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                    <Hash className="w-3 h-3 inline mr-1" />Bon de préparation (optionnel)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={bpId}
                                    onChange={e => setBpId(e.target.value)}
                                    placeholder="ID du BP, ex. 1"
                                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:bg-white transition-all"
                                />
                                {bpId && (
                                    <button
                                        onClick={() => setBpId('')}
                                        className="mt-1 text-[10px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                    >
                                        <X className="w-3 h-3" /> Effacer le filtre BP
                                    </button>
                                )}
                            </div>

                            {/* Completed toggle */}
                            <button
                                onClick={() => setShowCompleted(v => !v)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${showCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                            >
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    Voir l'historique complété
                                </span>
                                {showCompleted && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">ON</span>}
                            </button>
                        </div>

                        {/* Progress summary */}
                        {!showCompleted && tasks.length > 0 && (
                            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                                    <span className="font-medium">Progression</span>
                                    <span className="font-semibold text-gray-700">{completedCount}/{tasks.length}</span>
                                </div>
                                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                        style={{ width: tasks.length > 0 ? `${(completedCount / tasks.length) * 100}%` : '0%' }}
                                    />
                                </div>
                                <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                                    <span className="flex items-center gap-1 text-amber-600 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                                        {pendingCount} en attente
                                    </span>
                                    <span className="flex items-center gap-1 text-emerald-600 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                        {completedCount} complété{completedCount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Route legend */}
                        {tasks.length > 0 && (
                            <div className="px-4 py-2 border-b border-gray-100 shrink-0">
                                <p className="text-[10px] text-gray-400 font-medium">
                                    Ordre de visite optimisé par le serveur (séquence PickTaskEngine)
                                </p>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-400 pt-16">
                                    <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : tasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center pt-16 text-gray-400 gap-3">
                                    <ClipboardList className="w-12 h-12 opacity-25" />
                                    <p className="text-sm font-medium text-center">
                                        {bpId ? `Aucune tâche pour le BP #${bpId}` : 'Aucune tâche de collecte active'}
                                    </p>
                                    <p className="text-xs text-center max-w-[180px]">
                                        {bpId ? 'Vérifiez l\'identifiant du bon de préparation.' : 'Saisissez un ID de bon de préparation pour filtrer.'}
                                    </p>
                                </div>
                            ) : (
                                tasks.map(task => (
                                    <TaskCard
                                        key={task.id}
                                        task={task}
                                        onComplete={setCompletingTask}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
                        <div className="flex items-center gap-4 p-6 lg:p-8 border-b border-gray-200 bg-white shrink-0">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center shadow-sm">
                                <Package className="w-6 h-6 text-teal-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Console Pick & Pack</h2>
                                <p className="text-sm text-gray-400">
                                    Tâches de collecte du magasinier — triées par <span className="font-semibold text-gray-600">séquence_number</span> (ordre de visite optimal)
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                            {/* Instructions banner */}
                            <div className="flex items-start gap-3 px-4 py-3 bg-teal-50 border border-teal-100 rounded-xl mb-6">
                                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                                    <ClipboardList className="w-4 h-4 text-teal-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-teal-800">Règle de collecte FEFO</p>
                                    <p className="text-xs text-teal-600/80 mt-0.5">
                                        Suivez l'ordre des numéros de séquence — ils représentent le chemin optimal calculé par le serveur pour minimiser vos déplacements dans le dépôt.
                                        Si vous scannez un lot lors de la collecte et que l'API retourne <code className="bg-teal-100 px-1 rounded text-[10px]">WMS_INVALID_BATCH</code>, le lot est périmé ou bloqué — choisissez un autre lot.
                                    </p>
                                </div>
                            </div>

                            {/* KPI summary */}
                            {tasks.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {[
                                        { label: 'Total tâches', value: tasks.length, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
                                        { label: 'En attente', value: pendingCount, color: pendingCount > 0 ? 'text-amber-600' : 'text-gray-400', bg: pendingCount > 0 ? 'bg-amber-50' : 'bg-gray-50', border: pendingCount > 0 ? 'border-amber-100' : 'border-gray-200' },
                                        { label: 'Complétées', value: completedCount, color: completedCount > 0 ? 'text-emerald-600' : 'text-gray-400', bg: completedCount > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: completedCount > 0 ? 'border-emerald-100' : 'border-gray-200' },
                                    ].map(k => (
                                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {tasks.length === 0 && !isLoading && (
                                <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
                                    <AlertTriangle className="w-12 h-12 opacity-25" />
                                    <p className="text-sm font-medium">Aucune tâche de collecte disponible</p>
                                    <p className="text-xs">Saisissez un numéro de bon de préparation dans la barre latérale pour charger les tâches.</p>
                                </div>
                            )}
                        </div>
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
                                ],
                            },
                        ]}
                    />
                }
            />

            <CompleteTaskModal
                task={completingTask}
                onClose={() => setCompletingTask(null)}
            />
        </>
    );
};
