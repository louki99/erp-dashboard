import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
    Database, RefreshCw, Download, Trash2, RotateCcw, Plus,
    Clock, CheckCircle2, XCircle, AlertTriangle, Loader2,
    Calendar, ChevronDown, ChevronUp, X, Edit2,
    ToggleLeft, ToggleRight, Shield, HardDrive, User, Timer, Play, RefreshCcw, OctagonX,
} from 'lucide-react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useAuth } from '@/context/AuthContext';
import { useBackupList, usePollOperation, useSchedules } from '@/hooks/useBackup';
import * as backupApi from '@/services/api/backupApi';
import { cn } from '@/lib/utils';
import type {
    BackupFile, BackupOperation, BackupSchedule, CreateSchedulePayload,
} from '@/types/backup.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null | undefined): string {
    if (bytes == null) return '—';
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
    return `${bytes} B`;
}

function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
}

function fmtDuration(start: string | null | undefined, end: string | null | undefined): string {
    if (!start || !end) return '—';
    const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_SHORT  = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// ─── StatusBadge ──────────────────────────────────────────────────────────────

// Ops still pending/running after 10 min are considered stale (normal runs take seconds).
// Backend guarantees reap within 45 min — but we flag early so the UI isn't misleading.
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

function isStale(op: BackupOperation): boolean {
    if (op.status !== 'pending' && op.status !== 'running') return false;
    return Date.now() - new Date(op.created_at).getTime() > STALE_THRESHOLD_MS;
}

function StatusBadge({ status, stale = false }: { status: BackupOperation['status']; stale?: boolean }) {
    if (stale && (status === 'pending' || status === 'running')) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200"
                title="Cette opération n'a pas atteint de statut terminal — elle sera forcée en échec par le job de nettoyage backend (toutes les 15 min).">
                <AlertTriangle size={10} />
                Probablement bloqué
            </span>
        );
    }
    const cfg = {
        pending:   { icon: Clock,        cls: 'bg-amber-50 text-amber-700 border-amber-200',        label: 'En attente' },
        running:   { icon: Loader2,      cls: 'bg-blue-50 text-blue-700 border-blue-200',           label: 'En cours'   },
        completed: { icon: CheckCircle2, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',  label: 'Terminé'    },
        failed:    { icon: XCircle,      cls: 'bg-red-50 text-red-700 border-red-200',              label: 'Échec'      },
    }[status];
    const Icon = cfg.icon;
    return (
        <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold', cfg.cls)}>
            <Icon size={10} className={status === 'running' && !stale ? 'animate-spin' : ''} />
            {cfg.label}
        </span>
    );
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type, scheduleId }: { type: BackupOperation['type']; scheduleId?: number | null }) {
    if (scheduleId) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200">
                <Calendar size={9} />
                Auto (planif. #{scheduleId})
            </span>
        );
    }
    return (
        <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold',
            type === 'backup'
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-amber-50 text-amber-700 border-amber-200',
        )}>
            {type === 'backup' ? <HardDrive size={9} /> : <RotateCcw size={9} />}
            {type === 'backup' ? 'Sauvegarde manuelle' : 'Restauration'}
        </span>
    );
}

// ─── OpRow ────────────────────────────────────────────────────────────────────

function OpRow({ op, matchingFile, onSelectFile, onCancel, canCancel, cancelLoading }: {
    op: BackupOperation;
    matchingFile?: BackupFile;
    onSelectFile?: (file: BackupFile) => void;
    onCancel?: (op: BackupOperation) => void;
    canCancel?: boolean;
    cancelLoading?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const isDone     = op.status === 'completed' || op.status === 'failed';
    const isActive   = !isDone && (op.status === 'pending' || op.status === 'running');
    const stale      = isStale(op);
    const hasFile    = !!matchingFile;
    const canExpand  = !!op.error || (stale && !isDone);

    const handleClick = () => {
        if (isDone && hasFile && onSelectFile) { onSelectFile(matchingFile!); return; }
        if (canExpand) setOpen(v => !v);
    };

    return (
        <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
            <div className="flex items-stretch">
                <button
                    onClick={handleClick}
                    className={cn(
                        'flex-1 text-left px-4 py-3 transition-colors min-w-0',
                        isDone && hasFile
                            ? 'hover:bg-sage-50/60 dark:hover:bg-sage-900/10 cursor-pointer'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                >
                    <div className="flex items-center gap-2 flex-wrap">
                        <StatusBadge status={op.status} stale={stale} />
                        <TypeBadge type={op.type} scheduleId={op.backup_schedule_id} />
                        {op.size_bytes && (
                            <span className="text-[10px] text-gray-400 font-mono">{fmtSize(op.size_bytes)}</span>
                        )}
                        {isDone && op.started_at && op.finished_at && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                <Timer size={9} />
                                {fmtDuration(op.started_at, op.finished_at)}
                            </span>
                        )}
                        {op.initiated_by && !op.backup_schedule_id && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                <User size={9} />
                                #{op.initiated_by}
                            </span>
                        )}
                        {isDone && hasFile && (
                            <span className="ml-auto text-[10px] text-gray-300 dark:text-gray-600 flex items-center gap-0.5 shrink-0">
                                <Download size={9} />
                                Voir le fichier
                            </span>
                        )}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-gray-400">{fmtDate(op.created_at)}</span>
                        {canExpand && !hasFile && (
                            <ChevronDown size={12} className={cn('text-gray-300 transition-transform', open && 'rotate-180')} />
                        )}
                    </div>
                </button>

                {/* Kill button — only on active (non-terminal) ops */}
                {isActive && (
                    canCancel ? (
                        <button
                            onClick={() => onCancel?.(op)}
                            disabled={cancelLoading}
                            className="flex items-center gap-1 px-3 border-l border-gray-100 dark:border-gray-800 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40 shrink-0"
                            title={op.type === 'restore' ? 'Arrêter la restauration' : 'Annuler la sauvegarde'}
                        >
                            {cancelLoading
                                ? <Loader2 size={13} className="animate-spin" />
                                : <OctagonX size={13} />}
                        </button>
                    ) : (
                        <div className="flex items-center px-3 border-l border-gray-100 dark:border-gray-800 shrink-0"
                            title="Permission insuffisante (root requis pour arrêter une restauration)">
                            <OctagonX size={13} className="text-gray-200 dark:text-gray-700" />
                        </div>
                    )
                )}
            </div>
            {open && op.error && (
                <div className="px-4 pb-3">
                    <pre className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3 whitespace-pre-wrap break-all max-h-36 overflow-y-auto">
                        {op.error}
                    </pre>
                </div>
            )}
            {open && stale && !isDone && !op.error && (
                <div className="px-4 pb-3">
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                        Cette opération est bloquée. Le job de nettoyage backend (<code>backups:reap-stuck</code>) la forcera en échec dans les prochaines minutes.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── RecentOperations ─────────────────────────────────────────────────────────

function RecentOperations({ ops, backups, onSelectFile, onCancelOp, canCancelBackup, canCancelRestore, cancelLoadingId }: {
    ops: BackupOperation[];
    backups: BackupFile[];
    onSelectFile: (file: BackupFile) => void;
    onCancelOp?: (op: BackupOperation) => void;
    canCancelBackup?: boolean;
    canCancelRestore?: boolean;
    cancelLoadingId?: number | null;
}) {
    if (ops.length === 0) return null;
    return (
        <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Clock size={13} className="text-gray-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Historique des opérations
                </span>
                <span className="ml-auto text-[10px] text-gray-400">{ops.length} opération{ops.length > 1 ? 's' : ''}</span>
            </div>
            {ops.slice(0, 10).map(op => {
                const isActive = op.status === 'pending' || op.status === 'running';
                const canCancel = isActive && (
                    op.type === 'restore' ? !!canCancelRestore : !!canCancelBackup
                );
                return (
                    <OpRow
                        key={op.id}
                        op={op}
                        matchingFile={backups.find(f => f.path === op.path)}
                        onSelectFile={onSelectFile}
                        onCancel={onCancelOp}
                        canCancel={canCancel}
                        cancelLoading={cancelLoadingId === op.id}
                    />
                );
            })}
        </div>
    );
}

// ─── RestoreModal ─────────────────────────────────────────────────────────────

function RestoreModal({ file, onConfirm, onClose, loading, error }: {
    file: BackupFile; onConfirm: () => void; onClose: () => void;
    loading?: boolean; error?: string | null;
}) {
    const [typed, setTyped] = useState('');
    const match = typed === 'RESTORE';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md mx-4 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
                    <AlertTriangle size={18} className="text-red-600 dark:text-red-400" />
                    <span className="font-bold text-red-700 dark:text-red-300 text-sm">Restauration de la base de données</span>
                </div>
                <div className="p-5 space-y-4">
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300 leading-relaxed space-y-2">
                        <p>
                            Cette opération va <strong>écraser l'intégralité de la base de données en production</strong> avec
                            l'état de la sauvegarde du <strong>{fmtDate(file.created_at)}</strong>.
                        </p>
                        <p>
                            Pendant toute la durée de la restauration (quelques secondes à quelques minutes),{' '}
                            <strong>l'application sera hors ligne pour tous les utilisateurs</strong>.
                            Les sessions sont conservées — personne ne sera déconnecté.
                        </p>
                        <p>
                            <strong>Cette action est irréversible.</strong> En cas d'échec, la base de données peut
                            être dans un état partiellement restauré — contactez l'équipe technique immédiatement.
                        </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3 text-xs font-mono space-y-1">
                        <div className="text-gray-400">Fichier à restaurer</div>
                        <div className="text-gray-900 dark:text-white truncate font-semibold">{file.filename}</div>
                        <div className="flex gap-6 mt-1">
                            <div>
                                <div className="text-gray-400">Taille</div>
                                <div className="text-gray-900 dark:text-white">{fmtSize(file.size_bytes)}</div>
                            </div>
                            <div>
                                <div className="text-gray-400">Créé le</div>
                                <div className="text-gray-900 dark:text-white">{fmtDate(file.created_at)}</div>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1.5">
                            Tapez <strong className="text-gray-900 dark:text-white font-mono tracking-widest">RESTORE</strong> pour confirmer
                        </label>
                        <input
                            type="text"
                            value={typed}
                            onChange={e => setTyped(e.target.value)}
                            className={cn(
                                'w-full px-3 py-2 rounded-xl border text-sm font-mono outline-none transition-all',
                                'bg-white dark:bg-gray-800 dark:text-white',
                                typed === '' ? 'border-gray-300 dark:border-gray-600'
                                    : match ? 'border-emerald-500 ring-2 ring-emerald-100 dark:ring-emerald-900/30'
                                    : 'border-red-400 ring-2 ring-red-100 dark:ring-red-900/30',
                            )}
                            placeholder="RESTORE"
                            autoFocus
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2 border border-red-200 dark:border-red-900">{error}</p>
                    )}
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onClose} disabled={loading}
                        className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40">
                        Annuler
                    </button>
                    <button onClick={onConfirm} disabled={!match || loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Lancer la restauration
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── DeleteBackupModal ────────────────────────────────────────────────────────

function DeleteBackupModal({ file, onConfirm, onClose, loading }: {
    file: BackupFile; onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <Trash2 size={16} className="text-red-500" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">Supprimer la sauvegarde</span>
                </div>
                <div className="p-5">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        Supprimer définitivement&nbsp;
                        <strong className="text-gray-900 dark:text-white font-mono">{file.filename}</strong>&nbsp;?
                        Cette action ne peut pas être annulée.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onClose} disabled={loading}
                        className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        Annuler
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40">
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CancelRestoreConfirmModal ────────────────────────────────────────────────

function CancelRestoreConfirmModal({ onConfirm, onClose, loading }: {
    onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900">
                    <OctagonX size={16} className="text-red-600 dark:text-red-400" />
                    <span className="font-bold text-red-700 dark:text-red-300 text-sm">Arrêter la restauration</span>
                </div>
                <div className="p-5 space-y-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        Arrêter maintenant peut laisser la base de données dans un <strong>état partiellement restauré</strong>.
                        C'est le même risque qu'un échec naturel.
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                        Le mode maintenance se terminera automatiquement. Contactez l'équipe technique si vous constatez des anomalies après l'arrêt.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onClose} disabled={loading}
                        className="px-4 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40">
                        Continuer à attendre
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40">
                        {loading && <Loader2 size={13} className="animate-spin" />}
                        Arrêter quand même
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── DeleteScheduleModal ──────────────────────────────────────────────────────

function DeleteScheduleModal({ schedule, onConfirm, onClose, loading }: {
    schedule: BackupSchedule; onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-sm mx-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                    <Trash2 size={16} className="text-red-500" />
                    <span className="font-bold text-gray-900 dark:text-white text-sm">Supprimer la planification</span>
                </div>
                <div className="p-5 space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Supprimer définitivement <strong className="text-gray-900 dark:text-white">{schedule.label ?? schedule.schedule_label}</strong> ?
                    </p>
                    <p className="text-xs text-gray-400">
                        Conseil : préférez désactiver la planification plutôt que de la supprimer pour en conserver l'historique.
                    </p>
                </div>
                <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={onClose} disabled={loading}
                        className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                        Annuler
                    </button>
                    <button onClick={onConfirm} disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-40">
                        {loading && <Loader2 size={14} className="animate-spin" />}
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── RestoreOverlay ───────────────────────────────────────────────────────────
// A failed restore is a page-stop moment — the DB may be partially restored.
// This overlay blocks the page until the admin explicitly acknowledges.

function RestoreOverlay({ op, onDismiss, timedOut, onRefresh, onCancel, canCancel, cancelLoading }: {
    op: BackupOperation; onDismiss: () => void;
    timedOut?: boolean; onRefresh?: () => void;
    onCancel?: () => void; canCancel?: boolean; cancelLoading?: boolean;
}) {
    const [errorOpen, setErrorOpen] = useState(false);
    const isDone = op.status === 'completed' || op.status === 'failed';

    // Block accidental page close while restore is in-progress (or status unknown)
    useEffect(() => {
        if (isDone) return;
        const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isDone]);

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-md">
            <div className="flex flex-col items-center gap-6 max-w-md text-center px-6">

                {/* Polling timed out — status unknown, still possibly running */}
                {timedOut && !isDone && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
                            <Clock size={36} className="text-amber-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white">Statut inconnu</p>
                            <p className="text-sm text-white/70 mt-2 leading-relaxed">
                                La restauration prend plus de temps que prévu. Elle est peut-être toujours en cours.
                                <strong className="text-amber-300"> Ne fermez pas cette fenêtre</strong> — la base de données peut être dans un état partiel.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            {onRefresh && (
                                <button onClick={onRefresh}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-semibold text-sm transition-colors">
                                    <RefreshCcw size={14} />
                                    Vérifier le statut
                                </button>
                            )}
                            <button onClick={onDismiss}
                                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-colors">
                                Fermer (à mes risques)
                            </button>
                        </div>
                    </>
                )}

                {/* Still running normally */}
                {!timedOut && !isDone && (
                    <>
                        <Loader2 size={52} className="text-blue-400 animate-spin" />
                        <div className="space-y-3">
                            <p className="text-xl font-bold text-white">Restauration de la base de données…</p>
                            <p className="text-sm text-white/70 leading-relaxed">
                                {op.status === 'running'
                                    ? <>L'application est <strong className="text-amber-300">hors ligne pour tous les autres utilisateurs</strong> le temps que cette restauration se termine.</>
                                    : "La restauration est en file d'attente — démarrage imminent."}
                            </p>
                            <p className="text-xs text-white/40">Ne fermez pas cette fenêtre. La base de données est en cours de reconstruction.</p>
                        </div>
                        {canCancel ? (
                            <button onClick={onCancel} disabled={cancelLoading}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-red-500/30 border border-white/20 hover:border-red-400/50 text-white font-semibold text-sm transition-colors disabled:opacity-40">
                                {cancelLoading ? <Loader2 size={14} className="animate-spin" /> : <OctagonX size={14} />}
                                Arrêter la restauration
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/30 text-xs cursor-not-allowed"
                                title="Permission root requise pour arrêter une restauration">
                                <OctagonX size={12} />
                                Arrêter (root uniquement)
                            </div>
                        )}
                    </>
                )}

                {/* Success */}
                {op.status === 'completed' && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 size={36} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-xl font-bold text-white">Restauration réussie</p>
                            <p className="text-sm text-white/60 mt-2">La page va se recharger.</p>
                        </div>
                        <button onClick={() => window.location.reload()}
                            className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-colors">
                            Recharger la page
                        </button>
                    </>
                )}

                {/* Failure — page-stop: explicit acknowledgement required, error always visible */}
                {op.status === 'failed' && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                            <XCircle size={36} className="text-red-600" />
                        </div>
                        <div className="w-full">
                            <p className="text-xl font-bold text-white">Restauration échouée</p>
                            <p className="text-sm text-red-300 mt-2 leading-relaxed">
                                La base de données peut être dans un état partiellement restauré.
                                Contactez l'équipe technique immédiatement avant toute autre action.
                            </p>
                            {op.error && (
                                <>
                                    <button onClick={() => setErrorOpen(v => !v)}
                                        className="flex items-center gap-1 mx-auto mt-3 text-xs text-white/50 hover:text-white transition-colors">
                                        {errorOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                        {errorOpen ? 'Masquer' : 'Voir'} le détail de l'erreur
                                    </button>
                                    {errorOpen && (
                                        <pre className="mt-2 text-left text-xs text-red-300 bg-red-950/50 border border-red-500/30 rounded-xl p-3 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                                            {op.error}
                                        </pre>
                                    )}
                                </>
                            )}
                        </div>
                        {/* Explicit dismiss required — not auto-closing */}
                        <button onClick={onDismiss}
                            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm transition-colors">
                            J'ai pris connaissance de l'échec
                        </button>
                    </>
                )}

            </div>
        </div>
    );
}

// ─── BackupProgressBanner ─────────────────────────────────────────────────────

function BackupProgressBanner({ op, onDismiss, timedOut, onRefresh, onCancel, canCancel, cancelLoading }: {
    op: BackupOperation; onDismiss: () => void;
    timedOut?: boolean; onRefresh?: () => void;
    onCancel?: () => void; canCancel?: boolean; cancelLoading?: boolean;
}) {
    const [errorOpen, setErrorOpen] = useState(false);
    const isDone = op.status === 'completed' || op.status === 'failed';
    const isActive = !isDone;

    // Timed-out: polling stopped before terminal status — not a failure, just "still running"
    if (timedOut && !isDone) {
        return (
            <div className="border-b bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300">
                <div className="flex items-center justify-between px-4 py-2.5 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <Clock size={14} />
                        <span>Toujours en cours — actualisez pour vérifier le statut.</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        {canCancel && onCancel && (
                            <button onClick={onCancel} disabled={cancelLoading}
                                className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:opacity-80 transition-opacity disabled:opacity-40">
                                {cancelLoading ? <Loader2 size={11} className="animate-spin" /> : <OctagonX size={11} />}
                                Annuler
                            </button>
                        )}
                        {onRefresh && (
                            <button onClick={onRefresh}
                                className="flex items-center gap-1 text-xs font-semibold hover:opacity-80 transition-opacity">
                                <RefreshCcw size={12} />
                                Actualiser
                            </button>
                        )}
                        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const cfg = {
        pending:   'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:border-amber-800 dark:text-amber-300',
        running:   'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-300',
        completed: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300',
        failed:    'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/20 dark:border-red-800 dark:text-red-300',
    }[op.status];

    return (
        <div className={cn('border-b', cfg)}>
            <div className="flex items-center justify-between px-4 py-2.5 text-sm font-medium">
                <div className="flex items-center gap-2 min-w-0">
                    {!isDone
                        ? <Loader2 size={14} className="animate-spin shrink-0" />
                        : op.status === 'completed'
                            ? <CheckCircle2 size={14} className="shrink-0" />
                            : <XCircle size={14} className="shrink-0" />}
                    <span className="truncate">
                        {op.status === 'pending'   && "Sauvegarde en file d'attente…"}
                        {op.status === 'running'   && 'Sauvegarde en cours…'}
                        {op.status === 'completed' && 'Sauvegarde terminée avec succès.'}
                        {op.status === 'failed'    && 'Échec de la sauvegarde.'}
                    </span>
                    {op.status === 'failed' && op.error && (
                        <button onClick={() => setErrorOpen(v => !v)}
                            className="shrink-0 flex items-center gap-1 text-xs underline opacity-70 hover:opacity-100 transition-opacity ml-1">
                            {errorOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            {errorOpen ? 'Masquer' : 'Détails'}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                    {/* Kill button — only while active (backup is a soft cancel) */}
                    {isActive && canCancel && onCancel && (
                        <button onClick={onCancel} disabled={cancelLoading}
                            className="flex items-center gap-1 text-xs font-semibold opacity-70 hover:opacity-100 hover:text-red-600 transition-all disabled:opacity-40">
                            {cancelLoading ? <Loader2 size={11} className="animate-spin" /> : <OctagonX size={11} />}
                            Annuler
                        </button>
                    )}
                    {isDone && (
                        <button onClick={onDismiss} className="opacity-60 hover:opacity-100 transition-opacity">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
            {op.status === 'failed' && errorOpen && op.error && (
                <div className="px-4 pb-3">
                    <pre className="text-[10px] bg-red-100/60 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-2.5 whitespace-pre-wrap break-all max-h-28 overflow-y-auto">
                        {op.error}
                    </pre>
                </div>
            )}
        </div>
    );
}

// ─── BackupRow ────────────────────────────────────────────────────────────────

function BackupRow({ file, selected, onSelect, onRestore, onDelete, canRestore, canDelete }: {
    file: BackupFile; selected: boolean; onSelect: () => void;
    onRestore?: () => void; onDelete?: () => void;
    canRestore: boolean; canDelete: boolean;
}) {
    // Parse date parts for the visual timestamp strip
    const date = new Date(file.created_at);
    const day  = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    return (
        <div
            onClick={onSelect}
            className={cn(
                'group relative flex items-stretch gap-0 rounded-2xl cursor-pointer transition-all duration-150 overflow-hidden border',
                selected
                    ? 'border-sage-300 dark:border-sage-700 shadow-sm shadow-sage-100 dark:shadow-sage-900/20'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm',
            )}
        >
            {/* Left accent + date column */}
            <div className={cn(
                'flex flex-col items-center justify-center px-3 py-3 shrink-0 min-w-[56px] border-r transition-colors',
                selected
                    ? 'bg-sage-600 border-sage-600 text-white'
                    : 'bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-800 text-gray-400 dark:text-gray-500 group-hover:bg-gray-100 dark:group-hover:bg-gray-800',
            )}>
                <Database size={14} className={selected ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'} />
                <span className={cn('text-[9px] font-bold mt-1.5 leading-tight text-center', selected ? 'text-white/90' : '')}>
                    {day}
                </span>
                <span className={cn('text-[9px] font-mono leading-tight', selected ? 'text-white/70' : 'text-gray-400')}>
                    {time}
                </span>
            </div>

            {/* Main content */}
            <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-center gap-1">
                <p className={cn(
                    'text-[11px] font-bold font-mono truncate leading-tight',
                    selected ? 'text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-200',
                )}>
                    {file.filename}
                </p>
                <div className="flex items-center gap-2">
                    <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                        selected
                            ? 'bg-sage-100 text-sage-700 dark:bg-sage-900/40 dark:text-sage-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
                    )}>
                        <HardDrive size={8} />
                        {fmtSize(file.size_bytes)}
                    </span>
                    <span className="text-[10px] text-gray-300 dark:text-gray-600">PostgreSQL · gzip</span>
                </div>
            </div>

            {/* Actions — visible on hover or when selected */}
            <div
                className="flex items-center gap-0.5 pr-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={e => e.stopPropagation()}
            >
                <a href={file.download_url} target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    title="Télécharger">
                    <Download size={13} />
                </a>
                {canRestore && (
                    <button onClick={onRestore}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                        title="Restaurer">
                        <RotateCcw size={13} />
                    </button>
                )}
                {canDelete && (
                    <button onClick={onDelete}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Supprimer">
                        <Trash2 size={13} />
                    </button>
                )}
            </div>

            {/* Selected indicator strip */}
            {selected && (
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-sage-500 rounded-l-full" />
            )}
        </div>
    );
}

// ─── DayChips (display only) ──────────────────────────────────────────────────

function DayChips({ days }: { days: number[] }) {
    if (days.length === 0) {
        return <span className="text-[10px] text-gray-400 italic">Tous les jours</span>;
    }
    return (
        <div className="flex gap-1">
            {DAY_SHORT.map((d, i) => (
                <span key={i} className={cn(
                    'w-5 h-5 rounded-md flex items-center justify-center text-[9px] font-bold',
                    days.includes(i)
                        ? 'bg-sage-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600',
                )}>
                    {d}
                </span>
            ))}
        </div>
    );
}

// ─── ScheduleRow ──────────────────────────────────────────────────────────────

function ScheduleRow({ schedule, selected, onSelect, onEdit, onToggle, onDelete, onRunNow, canManage, runningNow }: {
    schedule: BackupSchedule; selected: boolean; onSelect: () => void;
    onEdit: () => void; onToggle: () => void; onDelete: () => void;
    onRunNow: () => void; canManage: boolean; runningNow: boolean;
}) {
    return (
        <div
            onClick={onSelect}
            className={cn(
                'group relative flex items-start gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all border',
                selected
                    ? 'bg-sage-50 dark:bg-sage-900/20 border-sage-300 dark:border-sage-700'
                    : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50',
            )}
        >
            {/* Active dot */}
            <div className="mt-1.5 shrink-0">
                <div className={cn(
                    'w-2 h-2 rounded-full',
                    schedule.is_active ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
                )} />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
                {/* Title row: name left, badge + actions right */}
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0">
                        {schedule.label ?? schedule.schedule_label}
                    </span>

                    {/* Active badge — hidden on hover to make room for actions */}
                    <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full font-bold border shrink-0 transition-opacity',
                        'group-hover:opacity-0',
                        schedule.is_active
                            ? 'text-emerald-700 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            : 'text-gray-500 border-gray-200 bg-gray-50 dark:bg-gray-800 dark:text-gray-500 dark:border-gray-700',
                    )}>
                        {schedule.is_active ? 'Actif' : 'Inactif'}
                    </span>

                    {/* Actions — appear on hover, replace the badge */}
                    {canManage && (
                        <div
                            className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity absolute right-3"
                            onClick={e => e.stopPropagation()}
                        >
                            <button onClick={onRunNow} disabled={runningNow}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Lancer maintenant">
                                {runningNow
                                    ? <Loader2 size={13} className="animate-spin text-blue-500" />
                                    : <Play size={13} />}
                            </button>
                            <button onClick={onToggle}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-sage-600 hover:bg-sage-50 dark:hover:bg-sage-900/20 transition-colors"
                                title={schedule.is_active ? 'Désactiver' : 'Activer'}>
                                {schedule.is_active
                                    ? <ToggleRight size={15} className="text-emerald-500" />
                                    : <ToggleLeft size={15} />}
                            </button>
                            <button onClick={onEdit}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-sage-600 hover:bg-sage-50 dark:hover:bg-sage-900/20 transition-colors"
                                title="Modifier">
                                <Edit2 size={12} />
                            </button>
                            <button onClick={onDelete}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Supprimer">
                                <Trash2 size={12} />
                            </button>
                        </div>
                    )}
                </div>

                {/* schedule_label — server-generated human description */}
                <p className="text-xs text-gray-500 dark:text-gray-400">{schedule.schedule_label}</p>

                {/* Days chips */}
                <DayChips days={schedule.days_of_week ?? []} />

                {/* Last triggered */}
                {schedule.last_triggered_at && (
                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock size={9} />
                        Dernier déclenchement : {fmtDate(schedule.last_triggered_at)}
                    </p>
                )}
            </div>
        </div>
    );
}

// ─── ScheduleForm ─────────────────────────────────────────────────────────────

function ScheduleForm({ initial, onSave, onCancel }: {
    initial?: BackupSchedule;
    onSave: (p: CreateSchedulePayload) => Promise<void>;
    onCancel: () => void;
}) {
    // trigger_time from API is "HH:MM:SS" — input[type=time] needs "HH:MM"
    const [label,    setLabel]    = useState(initial?.label ?? '');
    const [time,     setTime]     = useState(initial?.trigger_time?.slice(0, 5) ?? '02:00');
    const [days,     setDays]     = useState<number[]>(initial?.days_of_week ?? []);
    const [isActive, setIsActive] = useState(initial?.is_active ?? true);
    const [saving,   setSaving]   = useState(false);
    const [error,    setError]    = useState<string | null>(null);

    const toggleDay = (d: number) =>
        setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError(null);
        try {
            await onSave({
                label: label.trim() || undefined,
                trigger_time: time,
                days_of_week: days,
                is_active: isActive,
            });
        } catch (err: any) {
            setError(err?.response?.data?.message ?? err?.message ?? 'Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">

            {/* Label */}
            <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                    Libellé <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                    type="text"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    placeholder="ex: Sauvegarde quotidienne soir"
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 dark:focus:ring-sage-900/30 transition-all"
                />
            </div>

            {/* Time + Active toggle on same row */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">
                        Heure de déclenchement <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="time"
                        value={time}
                        onChange={e => setTime(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white outline-none focus:border-sage-400 focus:ring-2 focus:ring-sage-100 dark:focus:ring-sage-900/30 transition-all"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5">État</label>
                    <button
                        type="button"
                        onClick={() => setIsActive(v => !v)}
                        className={cn(
                            'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
                            isActive
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400'
                                : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-800 dark:border-gray-700',
                        )}
                    >
                        {isActive ? <ToggleRight size={16} className="text-emerald-500" /> : <ToggleLeft size={16} />}
                        {isActive ? 'Actif' : 'Inactif'}
                    </button>
                </div>
            </div>

            {/* Days of week */}
            <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    Jours de déclenchement
                    <span className="text-gray-400 font-normal ml-1">(laisser vide = tous les jours)</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                    {DAY_LABELS.map((d, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => toggleDay(i)}
                            className={cn(
                                'px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                                days.includes(i)
                                    ? 'bg-sage-600 text-white border-sage-600 shadow-sm shadow-sage-200'
                                    : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-sage-300',
                            )}
                        >
                            {d}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5">
                    {days.length === 0
                        ? '→ Déclenchée tous les jours à l\'heure indiquée'
                        : `→ Déclenchée le${days.length > 1 ? 's' : ''} ${days.map(d => DAY_LABELS[d]).join(', ')} à ${time}`}
                </p>
            </div>

            {error && (
                <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2 border border-red-200 dark:border-red-900">{error}</p>
            )}

            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-sage-600 hover:bg-sage-700 text-white transition-colors disabled:opacity-40">
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {initial ? 'Mettre à jour' : 'Créer la planification'}
                </button>
            </div>
        </form>
    );
}

// ─── BackupPage ───────────────────────────────────────────────────────────────

type TabId = 'backups' | 'schedules';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'backups',   label: 'Sauvegardes',  icon: HardDrive },
    { id: 'schedules', label: 'Planification', icon: Calendar  },
];

export function BackupPage() {
    const { user } = useAuth();
    const isRoot = user?.can?.is_root ?? false;
    const can = (perm: string) => isRoot || !!(user?.permissions?.effective?.includes(perm));
    const canCancelBackup  = can('delete-backups');
    const canCancelRestore = can('delete-backups') && can('restore-backups'); // root only

    const [searchParams] = useSearchParams();
    const initialTab = (searchParams.get('tab') === 'schedules' ? 'schedules' : 'backups') as TabId;
    const [tab, setTab]                   = useState<TabId>(initialTab);
    const [selectedFile, setSelectedFile] = useState<BackupFile | null>(null);
    const [selectedSched, setSelectedSched] = useState<BackupSchedule | null>(null);
    const [restoreTarget, setRestoreTarget] = useState<BackupFile | null>(null);
    const [deleteTarget,  setDeleteTarget]  = useState<BackupFile | null>(null);
    const [deleteSchedTarget, setDeleteSchedTarget] = useState<BackupSchedule | null>(null);
    const [restoreError,  setRestoreError]  = useState<string | null>(null);
    const [restoreLoading, setRestoreLoading] = useState(false);
    const [deleteLoading,  setDeleteLoading]  = useState(false);
    const [deleteSchedLoading, setDeleteSchedLoading] = useState(false);
    const [restoreOp,       setRestoreOp]       = useState<BackupOperation | null>(null);
    const [backupOp,        setBackupOp]        = useState<BackupOperation | null>(null);
    const [backupTimedOut,  setBackupTimedOut]  = useState(false);
    const [restoreTimedOut, setRestoreTimedOut] = useState(false);
    const [showNewForm,       setShowNewForm]       = useState(false);
    const [editMode,          setEditMode]          = useState(false);
    const [runningScheduleId, setRunningScheduleId] = useState<number | null>(null);
    const [cancelWarning,     setCancelWarning]     = useState<string | null>(null);
    const [cancelLoading,     setCancelLoading]     = useState(false);
    const [cancelRestoreConfirm, setCancelRestoreConfirm] = useState<BackupOperation | null>(null);

    // Tracks whether we've already attempted reconciliation from recent_operations on mount
    const reconciledRef = useRef(false);

    const { data, loading, error: listError, refresh } = useBackupList();
    const backupPoller  = usePollOperation();
    const restorePoller = usePollOperation();
    const {
        schedules: rawSchedules, loading: schLoading, error: schError,
        refresh: refreshSchedules, create, update, remove,
    } = useSchedules();

    const schedules = rawSchedules ?? [];
    const backups   = data?.backups ?? [];
    const recentOps = data?.recent_operations ?? [];

    useEffect(() => { refresh(); }, [refresh]);
    useEffect(() => { if (tab === 'schedules') refreshSchedules(); }, [tab, refreshSchedules]);

    // §3.1 — Reconcile in-progress operation from recent_operations on page reload.
    // Staleness rules:
    //   > 50 min  → ignore completely (backend reap job will resolve it)
    //   10–50 min → stale: show banner in timed-out state immediately, no new polling
    //   < 10 min  → genuinely fresh: resume polling normally
    const REAP_WINDOW_MS  = 50 * 60 * 1000;
    useEffect(() => {
        if (reconciledRef.current || !data) return;
        reconciledRef.current = true;

        const inProgress = data.recent_operations.find(op => {
            if (op.status !== 'pending' && op.status !== 'running') return false;
            const ageMs = Date.now() - new Date(op.created_at).getTime();
            return ageMs < REAP_WINDOW_MS;
        });
        if (!inProgress) return;

        const stale = isStale(inProgress); // > 10 min old

        if (inProgress.type === 'restore') {
            setRestoreOp(inProgress);
            if (stale) {
                setRestoreTimedOut(true); // surface timed-out state immediately
            } else {
                restorePoller.start(
                    inProgress.id,
                    op => setRestoreOp(op),
                    undefined,
                    () => setRestoreTimedOut(true),
                );
            }
        } else {
            setBackupOp(inProgress);
            if (stale) {
                setBackupTimedOut(true); // surface timed-out state immediately
            } else {
                backupPoller.start(
                    inProgress.id,
                    op => {
                        setBackupOp(op);
                        if (op.status === 'completed' || op.status === 'failed') refresh();
                    },
                    undefined,
                    () => setBackupTimedOut(true),
                );
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // Auto-select most recent backup on first load so restore/download actions are immediately visible
    useEffect(() => {
        if (!data || data.backups.length === 0 || selectedFile) return;
        setSelectedFile(data.backups[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleCancelOperation = async (op: BackupOperation) => {
        setCancelLoading(true);
        try {
            const result = await backupApi.cancelOperation(op.id);
            if (op.type === 'restore') {
                restorePoller.stop();
                setRestoreOp(null);
                setRestoreTimedOut(false);
            } else {
                backupPoller.stop();
                setBackupOp(null);
                setBackupTimedOut(false);
            }
            if (result.warning) setCancelWarning(result.warning);
            await refresh();
        } catch (err: any) {
            console.error('Cancel failed:', err);
        } finally {
            setCancelLoading(false);
            setCancelRestoreConfirm(null);
        }
    };

    const handleCreateBackup = async () => {
        try {
            const { operation_id } = await backupApi.createBackup();
            const init: BackupOperation = {
                id: operation_id, type: 'backup', status: 'pending',
                disk: null, path: null, size_bytes: null, initiated_by: null,
                error: null, started_at: null, finished_at: null,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            };
            setBackupOp(init);
            setBackupTimedOut(false);
            backupPoller.start(
                operation_id,
                op => {
                    setBackupOp(op);
                    if (op.status === 'completed' || op.status === 'failed') refresh();
                },
                undefined,
                () => setBackupTimedOut(true),
            );
        } catch (err: any) { console.error('Backup failed:', err); }
    };

    const handleRunNow = async (scheduleId: number) => {
        if (runningScheduleId) return;
        setRunningScheduleId(scheduleId);
        try {
            const { operation_id } = await backupApi.runScheduleNow(scheduleId);
            const init: BackupOperation = {
                id: operation_id, type: 'backup', status: 'pending',
                disk: null, path: null, size_bytes: null,
                initiated_by: null, backup_schedule_id: scheduleId,
                error: null, started_at: null, finished_at: null,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            };
            setBackupOp(init);
            setBackupTimedOut(false);
            backupPoller.start(
                operation_id,
                op => {
                    setBackupOp(op);
                    if (op.status === 'completed' || op.status === 'failed') {
                        setRunningScheduleId(null);
                        refresh();
                    }
                },
                undefined,
                () => { setBackupTimedOut(true); setRunningScheduleId(null); },
            );
        } catch (err: any) {
            console.error('Run-now failed:', err);
            setRunningScheduleId(null);
        }
    };

    const handleRestore = async () => {
        if (!restoreTarget) return;
        setRestoreLoading(true); setRestoreError(null);
        try {
            const { operation_id } = await backupApi.restoreBackup(restoreTarget.path);
            const init: BackupOperation = {
                id: operation_id, type: 'restore', status: 'pending',
                disk: null, path: restoreTarget.path, size_bytes: null, initiated_by: null,
                error: null, started_at: null, finished_at: null,
                created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
            };
            setRestoreTarget(null);
            setRestoreOp(init);
            setRestoreTimedOut(false);
            restorePoller.start(
                operation_id,
                op => setRestoreOp(op),
                undefined,
                () => setRestoreTimedOut(true),
            );
        } catch (err: any) {
            setRestoreError(err?.response?.data?.message ?? err?.message ?? 'Erreur restauration');
        } finally { setRestoreLoading(false); }
    };

    const handleDeleteBackup = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            await backupApi.deleteBackup(deleteTarget.path);
            setDeleteTarget(null);
            if (selectedFile?.path === deleteTarget.path) setSelectedFile(null);
            await refresh();
        } catch (err: any) { console.error('Delete failed:', err); }
        finally { setDeleteLoading(false); }
    };

    const handleDeleteSchedule = async () => {
        if (!deleteSchedTarget) return;
        setDeleteSchedLoading(true);
        try {
            await remove(deleteSchedTarget.id);
            setDeleteSchedTarget(null);
            if (selectedSched?.id === deleteSchedTarget.id) { setSelectedSched(null); setEditMode(false); }
        } catch (err: any) { console.error('Delete schedule failed:', err); }
        finally { setDeleteSchedLoading(false); }
    };

    const handleScheduleToggle = async (s: BackupSchedule) => {
        await update(s.id, { is_active: !s.is_active });
    };

    const handleOpenEdit = (s: BackupSchedule) => {
        setSelectedSched(s);
        setShowNewForm(false);
        setEditMode(true);
    };

    const handleOpenNew = () => {
        setSelectedSched(null);
        setEditMode(false);
        setShowNewForm(true);
    };

    const handleCancelForm = () => { setShowNewForm(false); setEditMode(false); };

    // ── Left panel ─────────────────────────────────────────────────────────────

    const leftContent = (
        <div className="flex flex-col h-full">
            {/* Tab bar */}
            <div className="flex border-b border-gray-100 dark:border-gray-800 shrink-0 px-2 pt-2">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setTab(id)} className={cn(
                        'flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors rounded-t-lg',
                        tab === id
                            ? 'border-sage-500 text-sage-700 dark:text-sage-400'
                            : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}>
                        <Icon size={14} />
                        {label}
                        {id === 'schedules' && schedules.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-sage-100 text-sage-700 dark:bg-sage-900/30 dark:text-sage-400">
                                {schedules.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Progress banner — visible on ALL tabs, shows timed-out state when polling capped */}
            {backupOp && (
                <BackupProgressBanner
                    op={backupOp}
                    timedOut={backupTimedOut}
                    onDismiss={() => { setBackupOp(null); setBackupTimedOut(false); }}
                    onRefresh={refresh}
                    onCancel={() => handleCancelOperation(backupOp)}
                    canCancel={canCancelBackup}
                    cancelLoading={cancelLoading}
                />
            )}

            {/* Backups list */}
            {tab === 'backups' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {loading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={22} className="animate-spin text-sage-500" />
                        </div>
                    )}
                    {listError && (
                        <div className="m-2 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900">{listError}</div>
                    )}
                    {!loading && backups.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <HardDrive size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Aucune sauvegarde disponible</p>
                            <p className="text-xs text-gray-400 mt-1">Les sauvegardes apparaîtront ici une fois créées</p>
                            {can('create-backups') && (
                                <button onClick={handleCreateBackup}
                                    className="mt-4 text-xs font-semibold text-sage-600 hover:text-sage-700 hover:underline transition-colors">
                                    + Créer la première sauvegarde
                                </button>
                            )}
                        </div>
                    )}
                    {backups.map(file => (
                        <BackupRow
                            key={file.path}
                            file={file}
                            selected={selectedFile?.path === file.path}
                            onSelect={() => setSelectedFile(file)}
                            onRestore={can('restore-backups') ? () => setRestoreTarget(file) : undefined}
                            onDelete={can('delete-backups')   ? () => setDeleteTarget(file)  : undefined}
                            canRestore={can('restore-backups')}
                            canDelete={can('delete-backups')}
                        />
                    ))}
                </div>
            )}

            {/* Schedules list */}
            {tab === 'schedules' && (
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    {schLoading && (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 size={22} className="animate-spin text-sage-500" />
                        </div>
                    )}
                    {schError && (
                        <div className="m-2 p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900">{schError}</div>
                    )}
                    {!schLoading && schedules.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <Calendar size={24} className="text-gray-400" />
                            </div>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Aucune planification configurée</p>
                            <p className="text-xs text-gray-400 mt-1">Créez une planification pour automatiser vos sauvegardes</p>
                            {can('manage-backup-schedule') && (
                                <button onClick={handleOpenNew}
                                    className="mt-4 text-xs font-semibold text-sage-600 hover:text-sage-700 hover:underline transition-colors">
                                    + Créer une planification
                                </button>
                            )}
                        </div>
                    )}
                    {schedules.map(s => (
                        <ScheduleRow
                            key={s.id}
                            schedule={s}
                            selected={selectedSched?.id === s.id}
                            onSelect={() => { setSelectedSched(s); setEditMode(false); setShowNewForm(false); }}
                            onEdit={() => handleOpenEdit(s)}
                            onToggle={() => handleScheduleToggle(s)}
                            onDelete={() => setDeleteSchedTarget(s)}
                            onRunNow={() => handleRunNow(s.id)}
                            canManage={can('manage-backup-schedule')}
                            runningNow={runningScheduleId === s.id}
                        />
                    ))}
                </div>
            )}
        </div>
    );

    // ── Main panel ─────────────────────────────────────────────────────────────

    const mainContent = (
        <div className="flex flex-col min-h-full p-5 space-y-5">

            {/* ── BACKUPS TAB ──────────────────────────────────────── */}
            {tab === 'backups' && (
                <>
                    {selectedFile ? (
                        <div className="space-y-5">
                            {/* File header */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                                <div className="w-10 h-10 rounded-xl bg-sage-100 dark:bg-sage-900/30 border border-sage-200 dark:border-sage-800 flex items-center justify-center shrink-0">
                                    <Database size={18} className="text-sage-600 dark:text-sage-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h2 className="text-sm font-bold text-gray-900 dark:text-white font-mono truncate">{selectedFile.filename}</h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Sauvegarde complète de la base de données PostgreSQL</p>
                                </div>
                                <button onClick={() => setSelectedFile(null)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Metadata */}
                            <div className="grid grid-cols-2 gap-3">
                                {([
                                    ['Taille', fmtSize(selectedFile.size_bytes)],
                                    ['Créé le', fmtDate(selectedFile.created_at)],
                                ] as [string, string][]).map(([k, v]) => (
                                    <div key={k} className="rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 shadow-sm">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{k}</div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-white font-mono">{v}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="space-y-2">
                                <a href={selectedFile.download_url} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 transition-colors">
                                    <Download size={15} />
                                    Télécharger le fichier
                                    <span className="ml-auto text-[10px] text-blue-400 font-normal">Lien valide 24h</span>
                                </a>
                                {can('restore-backups') ? (
                                    <button onClick={() => setRestoreTarget(selectedFile)}
                                        className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-amber-50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 transition-colors">
                                        <RotateCcw size={15} />
                                        Restaurer depuis ce fichier
                                        <span className="ml-auto text-[10px] text-amber-500 font-normal">Root uniquement</span>
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-gray-50 dark:bg-gray-800/50 text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 border-dashed cursor-not-allowed"
                                        title="Permission restore-backups requise (root uniquement)">
                                        <RotateCcw size={15} />
                                        Restaurer depuis ce fichier
                                        <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-gray-400">
                                            <Shield size={10} />
                                            Root requis
                                        </span>
                                    </div>
                                )}
                                {can('delete-backups') && (
                                    <button onClick={() => setDeleteTarget(selectedFile)}
                                        className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900 transition-colors">
                                        <Trash2 size={15} />
                                        Supprimer cette sauvegarde
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center min-h-[140px] text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6">
                            <Database size={24} className="text-gray-300 dark:text-gray-600 mb-2" />
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Sélectionnez une sauvegarde</p>
                            <p className="text-xs text-gray-400 mt-0.5">Cliquez sur un fichier dans le panneau gauche pour voir les actions — téléchargement, restauration, suppression.</p>
                        </div>
                    )}

                    {/* Operations history — always visible; clicking a completed op selects its file */}
                    <RecentOperations
                        ops={recentOps} backups={backups} onSelectFile={setSelectedFile}
                        onCancelOp={op => op.type === 'restore' ? setCancelRestoreConfirm(op) : handleCancelOperation(op)}
                        canCancelBackup={canCancelBackup} canCancelRestore={canCancelRestore}
                        cancelLoadingId={cancelLoading ? (backupOp?.id ?? restoreOp?.id ?? null) : null}
                    />
                </>
            )}

            {/* ── SCHEDULES TAB ────────────────────────────────────── */}
            {tab === 'schedules' && (
                <>
                    {/* Create form */}
                    {showNewForm && (
                        <div className="rounded-2xl border border-sage-200 dark:border-sage-800 bg-sage-50/50 dark:bg-sage-900/10 p-5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                                <Plus size={14} className="text-sage-600" />
                                Nouvelle planification de sauvegarde
                            </h3>
                            <ScheduleForm
                                onSave={async p => { await create(p); setShowNewForm(false); }}
                                onCancel={handleCancelForm}
                            />
                        </div>
                    )}

                    {/* Edit form */}
                    {editMode && selectedSched && (
                        <div className="rounded-2xl border border-sage-200 dark:border-sage-800 bg-sage-50/50 dark:bg-sage-900/10 p-5">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                                <Edit2 size={14} className="text-sage-600" />
                                Modifier la planification
                            </h3>
                            <ScheduleForm
                                initial={selectedSched}
                                onSave={async p => { await update(selectedSched.id, p); setEditMode(false); }}
                                onCancel={handleCancelForm}
                            />
                        </div>
                    )}

                    {/* Schedule detail (selected, not editing) */}
                    {!showNewForm && !editMode && selectedSched && (
                        <>
                            {/* Info card — display only, no footer */}
                            <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
                                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
                                    <div className={cn(
                                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                        selectedSched.is_active ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-gray-100 dark:bg-gray-800',
                                    )}>
                                        <Calendar size={16} className={selectedSched.is_active ? 'text-emerald-600' : 'text-gray-400'} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">
                                            {selectedSched.label ?? selectedSched.schedule_label}
                                        </h3>
                                        <p className="text-xs text-gray-500 truncate">{selectedSched.schedule_label}</p>
                                    </div>
                                    <span className={cn(
                                        'text-[10px] px-2 py-1 rounded-full font-bold border shrink-0',
                                        selectedSched.is_active
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-gray-50 text-gray-500 border-gray-200',
                                    )}>
                                        {selectedSched.is_active ? 'Actif' : 'Inactif'}
                                    </span>
                                </div>
                                <div className="p-5 grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Jours</div>
                                        <DayChips days={selectedSched.days_of_week ?? []} />
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Heure</div>
                                        <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                                            {selectedSched.trigger_time?.slice(0, 5)}
                                        </span>
                                    </div>
                                    {selectedSched.last_triggered_at && (
                                        <div className="col-span-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Dernier déclenchement</div>
                                            <span className="text-gray-700 dark:text-gray-300">{fmtDate(selectedSched.last_triggered_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions — standalone section, always in document flow */}
                            {can('manage-backup-schedule') && (
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleRunNow(selectedSched.id)}
                                        disabled={!!runningScheduleId}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/20 dark:border-blue-800 dark:text-blue-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                        {runningScheduleId === selectedSched.id
                                            ? <Loader2 size={14} className="animate-spin" />
                                            : <Play size={14} />}
                                        Lancer maintenant
                                    </button>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleScheduleToggle(selectedSched)}
                                            className={cn(
                                                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold border transition-colors',
                                                selectedSched.is_active
                                                    ? 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                                                    : 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100',
                                            )}>
                                            {selectedSched.is_active
                                                ? <ToggleLeft size={15} />
                                                : <ToggleRight size={15} className="text-emerald-500" />}
                                            {selectedSched.is_active ? 'Désactiver' : 'Activer'}
                                        </button>
                                        <button onClick={() => handleOpenEdit(selectedSched)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl text-sm font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 transition-colors">
                                            <Edit2 size={14} />
                                            Modifier
                                        </button>
                                    </div>
                                    <button onClick={() => setDeleteSchedTarget(selectedSched)}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-2xl text-xs font-semibold text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 border border-transparent hover:border-red-200 dark:hover:border-red-800 transition-colors">
                                        <Trash2 size={12} />
                                        Supprimer la planification
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Empty state — no selection */}
                    {!showNewForm && !editMode && !selectedSched && (
                        <div className="flex flex-col items-center justify-center min-h-[140px] text-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 p-6">
                            <Shield size={22} className="text-gray-300 dark:text-gray-600 mb-2" />
                            <p className="text-sm font-medium text-gray-400 dark:text-gray-500">Sélectionnez une planification</p>
                            <p className="text-xs text-gray-400 mt-0.5">ou créez-en une nouvelle depuis le panneau d'actions</p>
                        </div>
                    )}

                    {/* Operations history on schedules tab — highlight auto-triggered */}
                    <RecentOperations
                        ops={recentOps} backups={backups} onSelectFile={f => { setSelectedFile(f); setTab('backups'); }}
                        onCancelOp={op => op.type === 'restore' ? setCancelRestoreConfirm(op) : handleCancelOperation(op)}
                        canCancelBackup={canCancelBackup} canCancelRestore={canCancelRestore}
                        cancelLoadingId={cancelLoading ? (backupOp?.id ?? restoreOp?.id ?? null) : null}
                    />
                </>
            )}
        </div>
    );

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = [
        ...(tab === 'backups' ? [{
            items: [
                ...(can('create-backups') ? [{
                    label: 'Nouvelle sauvegarde',
                    icon: Plus,
                    onClick: handleCreateBackup,
                    disabled: backupOp?.status === 'pending' || backupOp?.status === 'running',
                }] : []),
                { label: 'Rafraîchir', icon: RefreshCw, onClick: refresh },
            ],
        }] : []),
        ...(tab === 'schedules' && can('manage-backup-schedule') ? [{
            items: [
                {
                    label: 'Nouvelle planification',
                    icon: Plus,
                    onClick: handleOpenNew,
                },
                { label: 'Rafraîchir', icon: RefreshCw, onClick: refreshSchedules },
            ],
        }] : []),
    ];

    return (
        <>
            <MasterLayout
                leftContent={leftContent}
                mainContent={mainContent}
                rightContent={actionGroups.length > 0 ? <ActionPanel groups={actionGroups} /> : undefined}
            />

            {restoreTarget && (
                <RestoreModal
                    file={restoreTarget}
                    onConfirm={handleRestore}
                    onClose={() => { setRestoreTarget(null); setRestoreError(null); }}
                    loading={restoreLoading}
                    error={restoreError}
                />
            )}
            {deleteTarget && (
                <DeleteBackupModal
                    file={deleteTarget}
                    onConfirm={handleDeleteBackup}
                    onClose={() => setDeleteTarget(null)}
                    loading={deleteLoading}
                />
            )}
            {deleteSchedTarget && (
                <DeleteScheduleModal
                    schedule={deleteSchedTarget}
                    onConfirm={handleDeleteSchedule}
                    onClose={() => setDeleteSchedTarget(null)}
                    loading={deleteSchedLoading}
                />
            )}
            {restoreOp && (
                <RestoreOverlay
                    op={restoreOp}
                    timedOut={restoreTimedOut}
                    onDismiss={() => { setRestoreOp(null); setRestoreTimedOut(false); }}
                    onRefresh={refresh}
                    onCancel={() => setCancelRestoreConfirm(restoreOp)}
                    canCancel={canCancelRestore}
                    cancelLoading={cancelLoading}
                />
            )}

            {/* Restore cancel confirmation modal */}
            {cancelRestoreConfirm && (
                <CancelRestoreConfirmModal
                    onConfirm={() => handleCancelOperation(cancelRestoreConfirm)}
                    onClose={() => setCancelRestoreConfirm(null)}
                    loading={cancelLoading}
                />
            )}

            {/* Persistent soft-cancel warning — backup process still running server-side */}
            {cancelWarning && (
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] w-full max-w-lg mx-4 px-4">
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-2xl shadow-xl p-4">
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Processus non interrompu côté serveur</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">{cancelWarning}</p>
                        </div>
                        <button onClick={() => setCancelWarning(null)}
                            className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition-colors">
                            <X size={14} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}

export default BackupPage;
