import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Activity, AlertTriangle, AlertCircle, Download, Settings2, Trash2,
    RefreshCw, ChevronLeft, ChevronRight, SlidersHorizontal, X,
    Eye, Globe, Tag, Link2, FileText,
    CheckCircle2, ShieldAlert, User, ArrowRight, Database, GitBranch,
} from 'lucide-react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import type { ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { useAuth } from '@/context/AuthContext';
import {
    useActivities, useActivityDetail,
    useAnomalies, useAnomalyDetail,
    useDbDeletions, useDbDeletionCascade,
    useExportLogs, useAuditSettings, usePurgeLogs,
} from '@/hooks/useAudit';
import type {
    ActivityLog, AnomalyLog, DbDeletion, ActivityFilters, AnomalyFilters, DbDeletionFilters,
    ActivityDiffEntry, ExportFormat, ExportSource, PurgeTarget, AuditLevel,
    PurgeTargetResult,
} from '@/types/audit.types';

// ─── Tab Types ────────────────────────────────────────────────────────────────

type Tab = 'journal' | 'anomalies' | 'deletions' | 'settings' | 'purge';

const TAB_CONFIG: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'journal', label: 'Journal', icon: Activity },
    { id: 'anomalies', label: 'Anomalies', icon: AlertTriangle },
    { id: 'deletions', label: 'Suppressions DB', icon: Database },
    { id: 'settings', label: 'Réglages', icon: Settings2 },
    { id: 'purge', label: 'Purge', icon: Trash2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' });
}

function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR');
}

function shortType(fqcn: string | null | undefined): string {
    if (!fqcn) return '—';
    const parts = fqcn.split('\\');
    return parts[parts.length - 1];
}

function eventDotColor(event: string): string {
    switch (event) {
        case 'created': return '#10b981';
        case 'updated': return '#3b82f6';
        case 'deleted': return '#ef4444';
        case 'restored': return '#8b5cf6';
        case 'auth_failed': return '#ef4444';
        default: return '#9ca3af';
    }
}

function AuditLevelBadge({ level }: { level: string }) {
    const styles: Record<string, string> = {
        standard: 'bg-gray-100 text-gray-600',
        medium: 'bg-blue-100 text-blue-700',
        advanced: 'bg-amber-100 text-amber-700',
    };
    return (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${styles[level] ?? styles.standard}`}>
            {level}
        </span>
    );
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
            {role}
        </span>
    );
}

function severityBadge(sev: string) {
    if (sev === 'CRITICAL') {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">
                <ShieldAlert className="w-2.5 h-2.5" /> CRITICAL
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
            <AlertTriangle className="w-2.5 h-2.5" /> WARNING
        </span>
    );
}

// ─── Active filter chips ──────────────────────────────────────────────────────

const FILTER_LABELS: Record<string, string> = {
    action: 'Événement',
    audit_level: 'Niveau',
    entity_type: 'Entité',
    user_role: 'Rôle',
    changed_field: 'Champ',
    correlation_id: 'Corrélation',
    date_from: 'Depuis',
    date_to: "Jusqu'à",
};

function ActiveFilterChips({ filters, onRemove }: { filters: ActivityFilters; onRemove: (key: keyof ActivityFilters) => void }) {
    const chips = Object.entries(filters)
        .filter(([k, v]) => v && !['page', 'per_page'].includes(k))
        .map(([k, v]) => ({ key: k as keyof ActivityFilters, label: FILTER_LABELS[k] ?? k, value: String(v) }));

    if (chips.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 px-2 pb-2">
            {chips.map(c => (
                <span key={c.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-[10px] font-semibold text-indigo-700 max-w-[120px]">
                    <span className="truncate">{c.label}: {c.value.length > 10 ? c.value.slice(0, 8) + '…' : c.value}</span>
                    <button onClick={() => onRemove(c.key)} className="shrink-0 hover:text-indigo-900">
                        <X className="w-2.5 h-2.5" />
                    </button>
                </span>
            ))}
        </div>
    );
}

// ─── Filter modal ─────────────────────────────────────────────────────────────

interface FilterModalProps {
    current: ActivityFilters;
    onApply: (f: ActivityFilters) => void;
    onClose: () => void;
}

function FilterModal({ current, onApply, onClose }: FilterModalProps) {
    const [form, setForm] = useState<ActivityFilters>({ ...current });

    const set = (key: keyof ActivityFilters, val: string) =>
        setForm(f => ({ ...f, [key]: val || undefined }));

    const handleApply = () => {
        onApply({ ...form, page: 1 });
        onClose();
    };

    const handleReset = () => {
        onApply({ page: 1, per_page: current.per_page ?? 50 });
        onClose();
    };

    const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30';
    const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-[400px] max-w-[95vw] overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-sm font-bold text-gray-900">Filtres avancés</h2>
                    <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Événement</label>
                            <select value={form.action ?? ''} onChange={e => set('action', e.target.value)} className={inputCls}>
                                <option value="">Tous</option>
                                <option value="created">created</option>
                                <option value="updated">updated</option>
                                <option value="deleted">deleted</option>
                                <option value="restored">restored</option>
                                <option value="auth_failed">auth_failed</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelCls}>Niveau d'audit</label>
                            <select value={form.audit_level ?? ''} onChange={e => set('audit_level', e.target.value)} className={inputCls}>
                                <option value="">Tous</option>
                                <option value="standard">standard</option>
                                <option value="medium">medium</option>
                                <option value="advanced">advanced</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Type d'entité</label>
                        <input type="text" placeholder="ex: Partner, Order, Invoice…" value={form.entity_type ?? ''}
                            onChange={e => set('entity_type', e.target.value)} className={inputCls} />
                        <p className="text-[10px] text-gray-400 mt-0.5">Correspondance partielle sur auditable_type</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Rôle utilisateur</label>
                            <input type="text" placeholder="ex: admin, root…" value={form.user_role ?? ''}
                                onChange={e => set('user_role', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Champ modifié</label>
                            <input type="text" placeholder="ex: status, total_amount" value={form.changed_field ?? ''}
                                onChange={e => set('changed_field', e.target.value)} className={inputCls} />
                            <p className="text-[10px] text-gray-400 mt-0.5">Recherche dans old/new values</p>
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Corrélation ID</label>
                        <input type="text" placeholder="UUID de corrélation" value={form.correlation_id ?? ''}
                            onChange={e => set('correlation_id', e.target.value)} className={inputCls} />
                        <p className="text-[10px] text-gray-400 mt-0.5">Retourne toute la chaîne causale (sans pagination)</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Date depuis</label>
                            <input type="date" value={form.date_from ?? ''}
                                onChange={e => set('date_from', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Date jusqu'à</label>
                            <input type="date" value={form.date_to ?? ''}
                                onChange={e => set('date_to', e.target.value)} className={inputCls} />
                        </div>
                    </div>
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
                    <button onClick={handleReset}
                        className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Réinitialiser
                    </button>
                    <button onClick={handleApply}
                        className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                        Appliquer
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Export Modal ─────────────────────────────────────────────────────────────

function ExportModal({ onClose }: { onClose: () => void }) {
    const { execute, loading, error } = useExportLogs();
    const [form, setForm] = useState({
        date_from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
        date_to: new Date().toISOString().slice(0, 10),
        source: 'activities' as ExportSource,
        format: 'csv' as ExportFormat,
    });
    const [result, setResult] = useState<{ download_url: string; expires_in_hours: number; filename: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await execute(form);
        setResult(res);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw] overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                        <Download className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900">Export des logs</h2>
                        <p className="text-[10px] text-gray-400">Lien MinIO présigné, valable 24h</p>
                    </div>
                    <button onClick={onClose} className="ml-auto w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {result ? (
                    <div className="px-5 py-5 space-y-4">
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-emerald-800">Export prêt</p>
                                <p className="text-[11px] text-emerald-600">{result.filename} · valable {result.expires_in_hours}h</p>
                            </div>
                        </div>
                        <a href={result.download_url} download={result.filename}
                            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                            <Download className="w-4 h-4" /> Télécharger
                        </a>
                        <p className="text-[10px] text-gray-400 text-center">Téléchargement direct MinIO — ne passe pas par le backend</p>
                        <button onClick={onClose} className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Fermer</button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date début</label>
                                <input type="date" value={form.date_from} onChange={e => setForm(f => ({ ...f, date_from: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-600 mb-1">Date fin</label>
                                <input type="date" value={form.date_to} onChange={e => setForm(f => ({ ...f, date_to: e.target.value }))}
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Source</label>
                            <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value as ExportSource }))}
                                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                                <option value="activities">Activités</option>
                                <option value="anomalies">Anomalies</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Format</label>
                            <div className="flex gap-2">
                                {(['csv', 'json'] as ExportFormat[]).map(fmt => (
                                    <button key={fmt} type="button" onClick={() => setForm(f => ({ ...f, format: fmt }))}
                                        className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${form.format === fmt ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                        {fmt.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                        <div className="flex gap-2 pt-1">
                            <button type="button" onClick={onClose}
                                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                            <button type="submit" disabled={loading}
                                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {loading ? 'Génération...' : 'Générer'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── Editor Log Viewer ────────────────────────────────────────────────────────

// VS Code Dark+ color palette
const C = {
    key:     '#9cdcfe',  // property name (blue)
    str:     '#ce9178',  // string value (orange)
    num:     '#b5cea8',  // number (light green)
    kw:      '#569cd6',  // keyword: null/true/false (blue)
    punct:   '#d4d4d4',  // braces, colons (light gray)
    comment: '#6a9955',  // comments (green)
    uuid:    '#c586c0',  // uuid/id (purple)
    date:    '#4ec9b0',  // dates (teal)
    dimRm:   '#f14c4c',  // diff remove (red)
    dimAdd:  '#23d18b',  // diff add (green)
};

const Str  = ({ v }: { v: string }) => <span style={{ color: C.str }}>"{v}"</span>;
const Num  = ({ v }: { v: number }) => <span style={{ color: C.num }}>{v}</span>;
const Kw   = ({ v }: { v: string }) => <span style={{ color: C.kw }}>{v}</span>;
const Key  = ({ v }: { v: string }) => <><span style={{ color: C.key }}>"{v}"</span><span style={{ color: C.punct }}>: </span></>;
const P    = ({ v }: { v: string }) => <span style={{ color: C.punct }}>{v}</span>;

function Val({ v }: { v: any }) {
    if (v === null || v === undefined) return <Kw v="null" />;
    if (typeof v === 'boolean') return <Kw v={String(v)} />;
    if (typeof v === 'number') return <Num v={v} />;
    const s = String(v);
    // ISO date
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return <><span style={{ color: C.date }}>"{s}"</span></>;
    // UUID
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s)) return <><span style={{ color: C.uuid }}>"{s}"</span></>;
    return <Str v={s} />;
}

// ─── Formatting utilities ─────────────────────────────────────────────────────

/** `2026-07-17T23:09:19.000000Z` → `17 juillet 2026 à 23:09` */
function fmtDatetime(iso: string): string {
    try {
        return new Intl.DateTimeFormat('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Europe/Paris',
        }).format(new Date(iso)).replace(' à', ' à'); // already correct
    } catch {
        return iso;
    }
}

/** Remove trailing decimal zeros: `5.000000` → `5`, `1.50` → `1.5` */
function fmtNum(raw: string | number): string {
    const n = typeof raw === 'number' ? raw : parseFloat(raw as string);
    if (isNaN(n)) return String(raw);
    return n % 1 === 0 ? String(Math.round(n)) : n.toPrecision(10).replace(/\.?0+$/, '');
}

/**
 * Map a Laravel model class → frontend route for deep-linking.
 * Returns null when no mapping exists.
 */
function modelRoute(auditableType: string | null, auditableId: number | string | null): string | null {
    if (!auditableType || !auditableId) return null;
    const model = auditableType.split('\\').pop()?.toLowerCase() ?? '';
    const id = auditableId;
    const map: Record<string, string> = {
        partner:                `/partners/${id}`,
        partnerpriceoverride:   `/pricing/overrides/${id}`,
        pricelist:              `/pricing/lists/${id}`,
        promotion:              `/promotions/${id}`,
        order:                  `/wms/orders/${id}`,
        stockadjustment:        `/wms/adjustments/${id}`,
        picklist:               `/wms/picking/${id}`,
        bonpreparation:         `/magasinier/bp/${id}`,
        user:                   `/admin/users/${id}`,
    };
    return map[model] ?? null;
}

// ─── Structured detail helpers ────────────────────────────────────────────────

function eventBadge(event: string) {
    const e = event.toLowerCase();
    const isCreate = e.includes('creat');
    const isDelete = e.includes('delet') || e.includes('destroy') || e.includes('remov') || e.includes('purg');
    const isUpdate = e.includes('updat') || e.includes('edit') || e.includes('modif') || e.includes('restor');
    const cls = isCreate
        ? 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30'
        : isDelete
        ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30'
        : isUpdate
        ? 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30'
        : 'bg-gray-500/15 text-gray-400 ring-1 ring-gray-500/30';
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wide ${cls}`}>
            {event}
        </span>
    );
}

function SectionLabel({ label, extra }: { label: string; extra?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between px-4 py-2 border-b border-[#3c3c3c]">
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#6b7280]">{label}</span>
            {extra}
        </div>
    );
}

function KVRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4 px-4 py-2 hover:bg-white/[0.025] transition-colors">
            <span className="w-28 shrink-0 text-[11px] text-[#6b7280] pt-px font-medium">{label}</span>
            <div className="flex-1 flex items-center flex-wrap gap-1.5 text-[12px] text-[#cccccc] font-mono">{children}</div>
        </div>
    );
}

function formatDiffValue(v: any): string {
    if (v === null || v === undefined) return 'null';
    const s = String(v);
    // ISO datetime
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return fmtDatetime(s);
    // Decimal number string (e.g. "5.000000")
    if (/^-?\d+\.\d+$/.test(s)) return fmtNum(s);
    return s;
}

function DiffTable({ diff }: { diff: ActivityDiffEntry[] }) {
    if (diff.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
                <div className="w-9 h-9 rounded-full bg-[#2d2d2d] flex items-center justify-center">
                    <GitBranch className="w-4 h-4 text-[#6b7280]" />
                </div>
                <p className="text-[11px] text-[#6b7280] text-center leading-relaxed max-w-xs">
                    Aucune modification de champ enregistrée pour ce niveau d'audit
                </p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-[11px] font-mono border-collapse">
                <thead>
                    <tr className="border-b border-[#3c3c3c]">
                        <th className="text-left px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b7280] font-semibold w-36">Champ</th>
                        <th className="text-left px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b7280] font-semibold">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500/60 inline-block" />
                                Avant
                            </span>
                        </th>
                        <th className="text-left px-4 py-2 text-[10px] uppercase tracking-widest text-[#6b7280] font-semibold">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-emerald-500/60 inline-block" />
                                Après
                            </span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {diff.map((entry, i) => (
                        <tr key={i} className="border-b border-[#3c3c3c]/40 hover:bg-white/[0.025]">
                            <td className="px-4 py-2.5 text-[#9cdcfe]">{entry.attribute}</td>
                            <td className="px-4 py-2.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-500/20 text-red-400 line-through decoration-red-500/60 decoration-1">
                                    {formatDiffValue(entry.old)}
                                </span>
                            </td>
                            <td className="px-4 py-2.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25 font-semibold">
                                    {formatDiffValue(entry.new)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Editor Log Viewer (used by DbDeletionDetail) ─────────────────────────────

interface EditorLine {
    content: React.ReactNode;
    type?: 'normal' | 'comment' | 'diff-remove' | 'diff-add';
}

function EditorContent({ lines }: { lines: EditorLine[] }) {
    return (
        <div className="py-2 select-text">
            {lines.map((line, i) => {
                const bg =
                    line.type === 'diff-remove' ? 'bg-[#ff000020]' :
                    line.type === 'diff-add'    ? 'bg-[#00ff0012]' :
                    '';
                const hover = line.type ? '' : 'hover:bg-white/[0.03]';
                return (
                    <div key={i} className={`flex items-start min-h-[20px] leading-5 ${bg} ${hover}`}>
                        <span className="w-10 shrink-0 text-right pr-4 text-[11px] select-none py-px font-mono"
                            style={{ color: '#4e4e4e' }}>
                            {i + 1}
                        </span>
                        <span className="flex-1 text-[11px] py-px pr-4 font-mono break-all whitespace-pre-wrap">
                            {line.content}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

interface ActivityDetailProps {
    log: ActivityLog;
    diff: ActivityDiffEntry[];
    loading: boolean;
    onTraceCorrelation: (correlationId: string) => void;
}

function ActivityDetail({ log, diff, loading, onTraceCorrelation }: ActivityDetailProps) {
    if (loading) return (
        <div className="h-full flex flex-col bg-[#1e1e2e]">
            <div className="shrink-0 h-9 bg-[#252526] border-b border-[#3c3c3c]" />
            <div className="flex-1 flex items-center justify-center">
                <span className="text-[#858585] text-sm font-mono">Chargement...</span>
            </div>
        </div>
    );

    return (
        <div className="h-full flex flex-col" style={{ background: '#1e1e2e' }}>
            {/* Tab bar */}
            <div className="shrink-0 flex items-center h-9 border-b" style={{ background: '#252526', borderColor: '#3c3c3c' }}>
                <div className="flex items-center gap-1.5 h-full px-4 border-r border-t-2" style={{ background: '#1e1e2e', borderColor: '#3c3c3c', borderTopColor: '#7c6af7' }}>
                    <FileText className="w-3 h-3" style={{ color: '#519aba' }} />
                    <span className="text-[11px] font-mono" style={{ color: '#cccccc' }}>activity_{log.id}</span>
                </div>
                <div className="ml-auto flex items-center gap-2 px-3">
                    <AuditLevelBadge level={log.audit_level} />
                    {log.user_role && <RoleBadge role={log.user_role} />}
                </div>
            </div>

            {/* Body — structured sections */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#3c3c3c]">

                {/* Event hero row */}
                <div className="flex items-center gap-3 px-4 py-4">
                    {eventBadge(log.event)}
                    <span className="text-[11px] font-mono text-[#6b7280]">#{log.id}</span>
                    {log.action_intent && log.action_intent !== log.event && (
                        <span className="text-[11px] font-mono text-[#6b7280]">· {log.action_intent}</span>
                    )}
                    <span className="ml-auto text-[11px] font-sans" style={{ color: C.date }}>
                        {fmtDatetime(log.created_at)}
                    </span>
                </div>

                {/* Acteur & Cible */}
                <div>
                    <SectionLabel label="Acteur & Cible" />
                    {log.user?.name && (
                        <KVRow label="Utilisateur">
                            <span className="text-[#cccccc]">{log.user.name}</span>
                            {log.user.email && <span className="text-[#6b7280]">({log.user.email})</span>}
                        </KVRow>
                    )}
                    {!log.user?.name && log.user_id && (
                        <KVRow label="User ID">
                            <span style={{ color: C.num }}>{log.user_id}</span>
                        </KVRow>
                    )}
                    {log.user_role && (
                        <KVRow label="Rôle">
                            <span style={{ color: C.str }}>{log.user_role}</span>
                        </KVRow>
                    )}
                    {log.auditable_type && (() => {
                        const route = modelRoute(log.auditable_type, log.auditable_id);
                        return (
                            <KVRow label="Modèle">
                                <span style={{ color: C.key }}>{shortType(log.auditable_type)}</span>
                                {log.auditable_id && (
                                    route ? (
                                        <a
                                            href={route}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors"
                                            style={{ color: C.uuid, background: '#c586c015' }}
                                            title={`Ouvrir ${shortType(log.auditable_type)} #${log.auditable_id}`}
                                        >
                                            <ArrowRight className="w-2.5 h-2.5" />
                                            #{log.auditable_id}
                                        </a>
                                    ) : (
                                        <span className="text-[#6b7280]">· #{log.auditable_id}</span>
                                    )
                                )}
                            </KVRow>
                        );
                    })()}
                </div>

                {/* Contexte */}
                <div>
                    <SectionLabel label="Contexte" />
                    {log.ip_address && (
                        <KVRow label="IP Address">
                            <span style={{ color: C.num }}>{log.ip_address}</span>
                        </KVRow>
                    )}
                    {log.description && (
                        <KVRow label="Description">
                            <span className="font-sans text-[#cccccc] text-[11px]">{log.description}</span>
                        </KVRow>
                    )}
                    {log.correlation_id && (
                        <KVRow label="Corrélation">
                            <span style={{ color: C.uuid }}>{log.correlation_id}</span>
                            <button
                                onClick={() => onTraceCorrelation(log.correlation_id!)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold hover:bg-indigo-500 transition-colors"
                            >
                                <Link2 className="w-2.5 h-2.5" /> Trace
                            </button>
                        </KVRow>
                    )}
                </div>

                {/* Diff */}
                <div>
                    <SectionLabel
                        label={diff.length > 0
                            ? `Diff — ${diff.length} champ${diff.length > 1 ? 's' : ''} modifié${diff.length > 1 ? 's' : ''}`
                            : 'Diff'}
                    />
                    <DiffTable diff={diff} />
                </div>
            </div>
        </div>
    );
}

// ─── Anomaly Detail ───────────────────────────────────────────────────────────

function AnomalyDetail({ log }: { log: AnomalyLog }) {
    const sevColor = log.error_severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
    const sevTopBorder = log.error_severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';

    return (
        <div className="h-full flex flex-col" style={{ background: '#1e1e2e' }}>
            {/* Tab bar */}
            <div className="shrink-0 flex items-center h-9 border-b" style={{ background: '#252526', borderColor: '#3c3c3c' }}>
                <div className="flex items-center gap-1.5 h-full px-4 border-r border-t-2" style={{ background: '#1e1e2e', borderColor: '#3c3c3c', borderTopColor: sevTopBorder }}>
                    <AlertTriangle className="w-3 h-3" style={{ color: sevColor }} />
                    <span className="text-[11px] font-mono" style={{ color: '#cccccc' }}>anomaly_{log.id}</span>
                </div>
                <div className="ml-auto px-3">
                    {severityBadge(log.error_severity)}
                </div>
            </div>

            {/* Body — structured sections */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#3c3c3c]">

                {/* Severity hero row */}
                <div className="flex items-center gap-3 px-4 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold uppercase tracking-wide ${log.error_severity === 'CRITICAL' ? 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' : 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30'}`}>
                        {log.error_severity === 'CRITICAL' ? <AlertTriangle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {log.error_severity}
                    </span>
                    <span className="text-[12px] font-mono" style={{ color: C.key }}>{log.error_code}</span>
                    <span className="ml-auto text-[11px] font-sans" style={{ color: C.date }}>
                        {fmtDatetime(log.created_at)}
                    </span>
                </div>

                {/* Error details */}
                <div>
                    <SectionLabel label="Anomalie" />
                    <KVRow label="Source">
                        <span style={{ color: C.str }}>{log.source}</span>
                    </KVRow>
                    <KVRow label="Code erreur">
                        <span style={{ color: C.key }}>{log.error_code}</span>
                    </KVRow>
                    {log.user_id && (
                        <KVRow label="User ID">
                            <span style={{ color: C.num }}>{log.user_id}</span>
                        </KVRow>
                    )}
                </div>

                {/* Reference */}
                {log.reference_type && (
                    <div>
                        <SectionLabel label="Référence" />
                        <KVRow label="Type">
                            <span style={{ color: C.key }}>{shortType(log.reference_type)}</span>
                        </KVRow>
                        <KVRow label="ID">
                            <span style={{ color: C.num }}>#{log.reference_id}</span>
                        </KVRow>
                    </div>
                )}

                {/* Context payload */}
                <div>
                    <SectionLabel label="Context Payload" />
                    {log.context_payload ? (
                        <div className="px-4 py-3">
                            <pre className="text-[11px] font-mono leading-5 whitespace-pre-wrap break-all select-text" style={{ color: C.punct }}>
                                {JSON.stringify(log.context_payload, null, 2)}
                            </pre>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-4 py-6 text-[#6b7280]">
                            <span className="text-[11px]">Aucun payload de contexte</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── DB Deletion Detail ───────────────────────────────────────────────────────

function buildDeletionEditorLines(
    entry: DbDeletion,
    index: number,
    total: number,
    onTraceCorrelation: (id: string) => void,
): EditorLine[] {
    const rows: EditorLine[] = [];
    const c = (s: string) => <span style={{ color: C.comment }}>{s}</span>;
    const tableShort = entry.table_name.split('.').pop() ?? entry.table_name;

    if (total > 1) {
        rows.push({ content: <>{c(`// ─── [${index + 1}/${total}] ${entry.table_name}  #${entry.record_id}`)}</>, type: 'comment' });
    }
    rows.push({
        content: (
            <div className="flex items-center gap-2">
                <P v="{" />
                <span className="text-[10px] font-mono" style={{ color: '#4e4e4e' }}>
                    — {tableShort} #{entry.record_id} · txn {entry.db_transaction_id}
                </span>
            </div>
        ),
    });

    rows.push({ content: <>{c('  // ─── Attribution')}</>, type: 'comment' });
    rows.push({ content: <><span style={{ color: C.punct }}>{'  '}</span><Key v="deleted_by_user_id" /><Val v={entry.deleted_by_user_id} /><P v="," /></> });
    rows.push({ content: <><span style={{ color: C.punct }}>{'  '}</span><Key v="db_transaction_id" /><Num v={entry.db_transaction_id} /><P v="," /></> });
    rows.push({ content: <><span style={{ color: C.punct }}>{'  '}</span><Key v="created_at" /><span style={{ color: C.date }}>"{entry.created_at}"</span><P v="," /></> });

    if (entry.correlation_id) {
        rows.push({
            content: (
                <div className="flex items-center gap-2">
                    <span style={{ color: C.punct }}>{'  '}</span>
                    <Key v="correlation_id" />
                    <span style={{ color: C.uuid }}>"{entry.correlation_id}"</span>
                    <P v="," />
                    <button
                        onClick={() => onTraceCorrelation(entry.correlation_id!)}
                        className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[9px] font-bold hover:bg-indigo-500 transition-colors"
                    >
                        <Activity className="w-2.5 h-2.5" /> Journal
                    </button>
                </div>
            ),
        });
    }

    rows.push({ content: <></>, type: 'comment' });
    rows.push({ content: <>{c('  // ─── Snapshot complet (deleted_row)')}</>, type: 'comment' });

    // Render each field of deleted_row as a diff-remove line (everything is gone)
    Object.entries(entry.deleted_row).forEach(([k, v]) => {
        rows.push({
            type: 'diff-remove',
            content: (
                <>
                    <span style={{ color: C.dimRm }}>−{'  '}</span>
                    <Key v={k} />
                    <Val v={v} />
                </>
            ),
        });
    });

    rows.push({ content: <P v="}" /> });
    return rows;
}

interface DbDeletionDetailProps {
    entry: DbDeletion;
    cascade: DbDeletion[] | null;
    cascadeLoading: boolean;
    onLoadCascade: (txnId: number) => void;
    onTraceToJournal: (correlationId: string) => void;
}

function DbDeletionDetail({ entry, cascade, cascadeLoading, onLoadCascade, onTraceToJournal }: DbDeletionDetailProps) {
    const displayList = cascade ?? [entry];
    const isCascadeView = cascade !== null && cascade.length > 1;

    const lines = useMemo((): EditorLine[] => {
        const rows: EditorLine[] = [];
        displayList.forEach((d, i) => {
            if (i > 0) {
                rows.push({ content: <></> });
                rows.push({ content: <></> });
            }
            rows.push(...buildDeletionEditorLines(d, i, displayList.length, onTraceToJournal));
        });
        return rows;
    }, [displayList, onTraceToJournal]);

    return (
        <div className="h-full flex flex-col" style={{ background: '#1e1e2e' }}>
            {/* Tab bar */}
            <div className="shrink-0 flex items-center h-9 border-b" style={{ background: '#252526', borderColor: '#3c3c3c' }}>
                <div className="flex items-center gap-1.5 h-full px-4 border-r border-t-2" style={{ background: '#1e1e2e', borderColor: '#3c3c3c', borderTopColor: '#ef4444' }}>
                    <Database className="w-3 h-3" style={{ color: '#ef4444' }} />
                    <span className="text-[11px] font-mono" style={{ color: '#cccccc' }}>
                        {isCascadeView ? `txn_${entry.db_transaction_id}.log` : `deletion_${entry.id}.log`}
                    </span>
                </div>
                {/* Cascade button */}
                {!isCascadeView && (
                    <button
                        onClick={() => onLoadCascade(entry.db_transaction_id)}
                        disabled={cascadeLoading}
                        className="ml-3 inline-flex items-center gap-1 px-2 py-1 rounded bg-red-900/50 border border-red-700/50 text-[10px] font-semibold hover:bg-red-800/60 transition-colors disabled:opacity-50"
                        style={{ color: '#f87171' }}
                    >
                        <GitBranch className="w-3 h-3" />
                        {cascadeLoading ? 'Chargement...' : `Voir cascade txn #${entry.db_transaction_id}`}
                    </button>
                )}
                {isCascadeView && (
                    <span className="ml-3 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-900/30 border border-red-700/30" style={{ color: '#fca5a5' }}>
                        <GitBranch className="w-3 h-3" /> {displayList.length} suppressions · même transaction
                    </span>
                )}
            </div>
            {/* Editor content */}
            <div className="flex-1 overflow-y-auto">
                <EditorContent lines={lines} />
            </div>
        </div>
    );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel() {
    const { settings, loading, error, fetch, save } = useAuditSettings();
    const [level, setLevel] = useState<AuditLevel>('medium');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => { fetch(); }, []);
    useEffect(() => { if (settings) setLevel(settings.audit_level); }, [settings]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await save({ audit_level: level });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Chargement...</div>;
    if (error) return <div className="p-5 text-sm text-red-600 bg-red-50 rounded-xl m-4">{error}</div>;

    const levelDesc: Record<AuditLevel, string> = {
        standard: 'Suppressions uniquement + événements de sécurité (auth_failed, etc.)',
        medium: 'Standard + créations/modifications/restaurations sur tous les modèles',
        advanced: 'Tout + capture complète old/new values + IP/UA/URL/route',
    };

    return (
        <div className="h-full overflow-y-auto p-5 space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                    <Settings2 className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-gray-900">Niveau d'audit</h2>
                    <p className="text-[11px] text-gray-400">Prend effet immédiatement, sans redémarrage</p>
                </div>
            </div>

            <div className="space-y-2">
                {(['standard', 'medium', 'advanced'] as AuditLevel[]).map(l => (
                    <label key={l} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${level === l ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                        <input type="radio" name="audit_level" value={l} checked={level === l}
                            onChange={() => setLevel(l)} className="mt-0.5 accent-indigo-600" />
                        <div>
                            <div className="flex items-center gap-2 mb-0.5">
                                <p className="text-xs font-bold text-gray-800 capitalize">{l}</p>
                                <AuditLevelBadge level={l} />
                            </div>
                            <p className="text-[11px] text-gray-500">{levelDesc[l]}</p>
                        </div>
                    </label>
                ))}
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-[11px] text-amber-700">
                    <strong>advanced</strong> génère un volume élevé. À utiliser pendant une investigation, puis redescendre à <strong>medium</strong>.
                </p>
            </div>

            <button onClick={handleSave} disabled={saving || level === settings?.audit_level}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'} disabled:opacity-40`}>
                {saved ? '✓ Sauvegardé' : saving ? 'Sauvegarde...' : 'Appliquer le niveau'}
            </button>
        </div>
    );
}

// ─── Purge Panel ──────────────────────────────────────────────────────────────

function PurgeArchiveCard({ label, result }: { label: string; result: PurgeTargetResult }) {
    return (
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-blue-800 capitalize">{label}</span>
                <span className="text-[10px] text-blue-500">{result.purged_count} enregistrements</span>
            </div>
            {result.archive ? (
                <a href={result.archive.download_url} download={result.archive.filename}
                    className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold hover:bg-blue-700 transition-colors">
                    <Download className="w-3 h-3" /> {result.archive.filename}
                </a>
            ) : (
                <p className="text-[10px] text-blue-400 italic">Aucune archive (0 lignes)</p>
            )}
        </div>
    );
}

function PurgePanel() {
    const { execute, loading, error } = usePurgeLogs();
    const [months, setMonths] = useState(6);
    const [target, setTarget] = useState<PurgeTarget>('all');
    const [confirmText, setConfirmText] = useState('');
    const [step, setStep] = useState<'form' | 'confirm' | 'result'>('form');
    const [result, setResult] = useState<{ activities?: PurgeTargetResult; anomalies?: PurgeTargetResult } | null>(null);

    const handlePurge = async () => {
        const res = await execute({ older_than_months: months, target });
        setResult(res);
        setStep('result');
    };

    if (step === 'result' && result) {
        return (
            <div className="h-full overflow-y-auto p-5 space-y-4">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-emerald-800">Purge effectuée</p>
                        <p className="text-[11px] text-emerald-600">Téléchargez les archives — liens présignés, expirent bientôt</p>
                    </div>
                </div>
                {result.activities && <PurgeArchiveCard label="Activités" result={result.activities} />}
                {result.anomalies && <PurgeArchiveCard label="Anomalies" result={result.anomalies} />}
                <p className="text-[10px] text-red-400">⚠ Ces liens expirent. Téléchargez les archives maintenant.</p>
                <button onClick={() => { setStep('form'); setResult(null); setConfirmText(''); }}
                    className="w-full py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                    Nouvelle purge
                </button>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-5 space-y-4">
            <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-4 h-4 text-white" />
                </div>
                <div>
                    <h2 className="text-sm font-bold text-gray-900">Purge des logs</h2>
                    <p className="text-[11px] text-gray-400">Archive d'abord, supprime ensuite — minimum 3 mois</p>
                </div>
            </div>
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
                <p className="text-[11px] text-red-700">Action irréversible. Les données sont archivées (MinIO) avant suppression.</p>
            </div>
            <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">Cible</label>
                <select value={target} onChange={e => setTarget(e.target.value as PurgeTarget)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30">
                    <option value="all">Tout (activités + anomalies)</option>
                    <option value="activities">Activités uniquement</option>
                    <option value="anomalies">Anomalies uniquement</option>
                </select>
            </div>
            <div>
                <label className="block text-[11px] font-bold text-gray-600 uppercase tracking-wide mb-1.5">
                    Entrées de plus de <span className="text-red-600 font-bold">{months} mois</span>
                </label>
                <input type="range" min={3} max={24} value={months} onChange={e => setMonths(+e.target.value)} className="w-full accent-red-600" />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1"><span>3 mois (min)</span><span>24 mois</span></div>
            </div>
            {step === 'confirm' ? (
                <div className="space-y-3">
                    <p className="text-[11px] text-gray-700">Tapez <strong className="text-red-600 font-mono">PURGE</strong> pour confirmer :</p>
                    <input type="text" value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="PURGE"
                        className="w-full px-3 py-2 rounded-xl border border-red-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                    {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
                    <div className="flex gap-2">
                        <button onClick={() => { setStep('form'); setConfirmText(''); }}
                            className="flex-1 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                        <button onClick={handlePurge} disabled={confirmText !== 'PURGE' || loading}
                            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                            {loading ? 'Purge...' : 'Confirmer'}
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={() => setStep('confirm')}
                    className="w-full py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">
                    Lancer la purge
                </button>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AuditPage() {
    const { user } = useAuth();
    const isRoot = user?.can?.is_root ?? false;
    const canManageSettings = user?.permissions?.effective?.includes('manage-audit-settings') ?? isRoot;

    const [activeTab, setActiveTab] = useState<Tab>('journal');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showFilterModal, setShowFilterModal] = useState(false);

    // Activities
    const { activities, loading: actLoading, fetch: fetchActivities } = useActivities();
    const { detail: actDetail, loading: detailLoading, fetch: fetchActivityDetail } = useActivityDetail();
    const [actFilters, setActFilters] = useState<ActivityFilters>({ page: 1, per_page: 50 });
    const [selectedActivity, setSelectedActivity] = useState<ActivityLog | null>(null);

    // Anomalies
    const { anomalies, loading: anomLoading, fetch: fetchAnomalies } = useAnomalies();
    const { detail: anomDetail, fetch: fetchAnomalyDetail } = useAnomalyDetail();
    const [anomFilters] = useState<AnomalyFilters>({ page: 1, per_page: 50 });
    const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyLog | null>(null);

    // DB Deletions
    const { deletions, loading: delLoading, fetch: fetchDeletions } = useDbDeletions();
    const { cascade, loading: cascadeLoading, fetch: fetchCascade } = useDbDeletionCascade();
    const [delFilters, setDelFilters] = useState<DbDeletionFilters>({ page: 1, per_page: 50 });
    const [selectedDeletion, setSelectedDeletion] = useState<DbDeletion | null>(null);
    const [activeCascadeTxnId, setActiveCascadeTxnId] = useState<number | null>(null);

    useEffect(() => {
        if (activeTab === 'journal') fetchActivities(actFilters);
    }, [activeTab, actFilters]);

    useEffect(() => {
        if (activeTab === 'anomalies') fetchAnomalies(anomFilters);
    }, [activeTab, anomFilters]);

    useEffect(() => {
        if (activeTab === 'deletions') fetchDeletions(delFilters);
    }, [activeTab, delFilters]);

    const handleActivityClick = useCallback((log: ActivityLog) => {
        setSelectedActivity(log);
        fetchActivityDetail(log.id);
    }, [fetchActivityDetail]);

    const handleAnomalyClick = useCallback((log: AnomalyLog) => {
        setSelectedAnomaly(log);
        fetchAnomalyDetail(log.id);
    }, [fetchAnomalyDetail]);

    const handleDeletionClick = useCallback((d: DbDeletion) => {
        setSelectedDeletion(d);
        setActiveCascadeTxnId(null);
    }, []);

    const handleLoadCascade = useCallback((txnId: number) => {
        setActiveCascadeTxnId(txnId);
        fetchCascade(txnId);
    }, [fetchCascade]);

    // "Voir la trace" in Journal — cross-reference by correlation_id
    const handleTraceCorrelation = useCallback((correlationId: string) => {
        setSelectedActivity(null);
        setActFilters({ page: 1, per_page: 50, correlation_id: correlationId });
    }, []);

    // Cross-reference: from DB deletion detail → switch to Journal tab with correlation filter
    const handleTraceToJournal = useCallback((correlationId: string) => {
        setActiveTab('journal');
        setSelectedActivity(null);
        setActFilters({ page: 1, per_page: 50, correlation_id: correlationId });
    }, []);

    const applyFilters = useCallback((f: ActivityFilters) => {
        setSelectedActivity(null);
        setActFilters(f);
    }, []);

    const removeFilter = useCallback((key: keyof ActivityFilters) => {
        setActFilters(prev => {
            const next = { ...prev, [key]: undefined, page: 1 };
            delete next[key];
            return next;
        });
    }, []);

    // Count active filters (excluding pagination)
    const activeFilterCount = useMemo(() =>
        Object.entries(actFilters).filter(([k, v]) => v && !['page', 'per_page'].includes(k)).length,
        [actFilters]
    );

    const isCorrelationMode = !!actFilters.correlation_id;

    // Activity columns
    const activityColumns = useMemo(() => [
        {
            colId: 'event', headerName: 'Événement', flex: 1, minWidth: 100,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => {
                const log: ActivityLog = p.data;
                if (!log) return null;
                return (
                    <div className="flex items-center gap-1.5 h-full min-w-0">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: eventDotColor(log.event) }} />
                        <span className="text-[11px] font-semibold text-gray-800 truncate">
                            {log.action_intent ?? log.event}
                        </span>
                    </div>
                );
            },
        },
        {
            colId: 'entity', headerName: 'Entité', width: 82,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] font-mono text-gray-500 truncate">{shortType(p.data?.auditable_type)}</span>
            ),
        },
        {
            colId: 'user', headerName: 'User', width: 80,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[11px] text-gray-600 truncate">{p.data?.user?.name ?? `#${p.data?.user_id}` ?? '—'}</span>
            ),
        },
        {
            colId: 'created_at', headerName: 'Date', width: 70,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] text-gray-400">{p.data?.created_at ? shortDate(p.data.created_at) : '—'}</span>
            ),
        },
    ], []);

    // Anomaly columns
    const anomalyColumns = useMemo(() => [
        {
            colId: 'code', headerName: 'Code', flex: 1, minWidth: 120,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => {
                const log: AnomalyLog = p.data;
                if (!log) return null;
                return (
                    <div className="flex items-center gap-1.5 h-full min-w-0">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: log.error_severity === 'CRITICAL' ? '#ef4444' : '#f59e0b' }} />
                        <span className="text-[10px] font-mono font-semibold text-gray-700 truncate">{log.error_code}</span>
                    </div>
                );
            },
        },
        {
            colId: 'source', headerName: 'Source', width: 80,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] text-gray-500 truncate">{p.data?.source ?? '—'}</span>
            ),
        },
        {
            colId: 'created_at', headerName: 'Date', width: 70,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] text-gray-400">{p.data?.created_at ? shortDate(p.data.created_at) : '—'}</span>
            ),
        },
    ], []);

    // DB Deletion columns
    const deletionColumns = useMemo(() => [
        {
            colId: 'table_name', headerName: 'Table', flex: 1, minWidth: 110,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => {
                const d: DbDeletion = p.data;
                if (!d) return null;
                const tableShort = d.table_name.split('.').pop() ?? d.table_name;
                return (
                    <div className="flex items-center gap-1.5 h-full min-w-0">
                        <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: '#ef4444' }} />
                        <span className="text-[11px] font-mono font-semibold text-gray-800 truncate">{tableShort}</span>
                    </div>
                );
            },
        },
        {
            colId: 'record_id', headerName: '#', width: 50,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] font-mono text-gray-500">#{p.data?.record_id}</span>
            ),
        },
        {
            colId: 'created_at', headerName: 'Date', width: 70,
            resizable: false, sortable: false, filter: false, floatingFilter: false,
            cellRenderer: (p: any) => (
                <span className="text-[10px] text-gray-400">{p.data?.created_at ? shortDate(p.data.created_at) : '—'}</span>
            ),
        },
    ], []);

    // ActionPanel
    const actionGroups = useMemo(() => {
        const groups: { items: ActionItemProps[] }[] = [
            { items: [{ icon: Download, label: 'Exporter les logs', variant: 'primary', onClick: () => setShowExportModal(true) }] },
            {
                items: [{
                    icon: RefreshCw, label: 'Actualiser', variant: 'default',
                    onClick: () => {
                        if (activeTab === 'journal') fetchActivities(actFilters);
                        if (activeTab === 'anomalies') fetchAnomalies(anomFilters);
                        if (activeTab === 'deletions') fetchDeletions(delFilters);
                    },
                }],
            },
        ];
        return groups;
    }, [activeTab, actFilters, anomFilters]);

    // ─── Left panel ──────────────────────────────────────────────────────────

    const leftContent = (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="px-3 pt-3 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 leading-tight">Audit Trail</h1>
                        <p className="text-[10px] text-gray-400">Console de supervision</p>
                    </div>
                </div>
            </div>

            {/* Tab nav */}
            <div className="px-2 pt-2 shrink-0 flex flex-col gap-0.5">
                {TAB_CONFIG.filter(t => {
                    if (t.id === 'purge' && !isRoot) return false;
                    if (t.id === 'settings' && !canManageSettings) return false;
                    return true;
                }).map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setActiveTab(id)}
                        className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-colors text-[12px] font-semibold ${activeTab === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span>{label}</span>
                        {id === 'anomalies' && (anomalies?.data ?? []).some(a => a.error_severity === 'CRITICAL') && (
                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />
                        )}
                    </button>
                ))}
            </div>

            <div className="h-px bg-gray-100 mx-3 my-2 shrink-0" />

            {/* Tab content */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                {activeTab === 'journal' && (
                    <>
                        {/* Filter toolbar */}
                        <div className="px-2 pb-1 shrink-0 space-y-1">
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setShowFilterModal(true)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${activeFilterCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                    <SlidersHorizontal className="w-3 h-3" />
                                    <span>Filtres</span>
                                    {activeFilterCount > 0 && (
                                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </button>
                                {activeFilterCount > 0 && (
                                    <button onClick={() => applyFilters({ page: 1, per_page: actFilters.per_page })}
                                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 transition-colors" title="Effacer les filtres">
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                            {isCorrelationMode && (
                                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <Link2 className="w-3 h-3 text-indigo-500 shrink-0" />
                                    <span className="text-[10px] text-indigo-700 font-semibold truncate flex-1">Trace causale</span>
                                    <button onClick={() => applyFilters({ page: 1, per_page: actFilters.per_page })}
                                        className="text-indigo-400 hover:text-indigo-600"><X className="w-3 h-3" /></button>
                                </div>
                            )}
                            <ActiveFilterChips
                                filters={actFilters}
                                onRemove={removeFilter}
                            />
                        </div>

                        {/* List */}
                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={activities?.data ?? []}
                                columnDefs={activityColumns}
                                loading={actLoading}
                                headerHeight={0}
                                rowHeight={34}
                                suppressAutoFit
                                onRowClicked={e => e.data && handleActivityClick(e.data)}
                                defaultSelectedIds={row => row.id === selectedActivity?.id}
                            />
                        </div>

                        {/* Pagination — always visible */}
                        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-100">
                            <button
                                disabled={!activities || (actFilters.page ?? 1) <= 1}
                                onClick={() => setActFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <span className="text-[10px] text-gray-500 text-center">
                                {activities
                                    ? isCorrelationMode
                                        ? `${activities.total} entrées (trace)`
                                        : `${activities.total} résultats · p.${actFilters.page ?? 1}/${activities.last_page}`
                                    : '—'
                                }
                            </span>
                            <button
                                disabled={!activities || (actFilters.page ?? 1) >= activities.last_page}
                                onClick={() => setActFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </div>
                    </>
                )}

                {activeTab === 'anomalies' && (
                    <>
                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={anomalies?.data ?? []}
                                columnDefs={anomalyColumns}
                                loading={anomLoading}
                                headerHeight={0}
                                rowHeight={34}
                                suppressAutoFit
                                onRowClicked={e => e.data && handleAnomalyClick(e.data)}
                                defaultSelectedIds={row => row.id === selectedAnomaly?.id}
                            />
                        </div>
                        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-100">
                            <span className="text-[10px] text-gray-500 w-full text-center">
                                {anomalies ? `${anomalies.total} anomalies` : '—'}
                            </span>
                        </div>
                    </>
                )}

                {activeTab === 'deletions' && (
                    <>
                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={deletions?.data ?? []}
                                columnDefs={deletionColumns}
                                loading={delLoading}
                                headerHeight={0}
                                rowHeight={34}
                                suppressAutoFit
                                onRowClicked={e => e.data && handleDeletionClick(e.data)}
                                defaultSelectedIds={row => row.id === selectedDeletion?.id}
                            />
                        </div>
                        <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-100">
                            <button
                                disabled={!deletions || (delFilters.page ?? 1) <= 1}
                                onClick={() => setDelFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                            <span className="text-[10px] text-gray-500 text-center">
                                {deletions ? `${deletions.total} suppressions · p.${delFilters.page ?? 1}/${deletions.last_page}` : '—'}
                            </span>
                            <button
                                disabled={!deletions || (delFilters.page ?? 1) >= deletions.last_page}
                                onClick={() => setDelFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
                                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30">
                                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                            </button>
                        </div>
                    </>
                )}

                {(activeTab === 'settings' || activeTab === 'purge') && (
                    <div className="flex-1 min-h-0 flex items-center justify-center px-4 py-6">
                        <div className="text-center text-gray-400">
                            <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-[11px]">Panneau central</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Main content ─────────────────────────────────────────────────────────

    const mainContent = (
        <div className="h-full overflow-hidden">
            {activeTab === 'journal' && (
                selectedActivity
                    ? <ActivityDetail
                        log={actDetail?.data ?? selectedActivity}
                        diff={actDetail?.diff ?? []}
                        loading={detailLoading}
                        onTraceCorrelation={handleTraceCorrelation}
                    />
                    : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                            <Activity className="w-12 h-12 mb-3" />
                            <p className="text-sm font-medium text-gray-400">Sélectionnez une entrée</p>
                            {activities && (
                                <p className="text-xs mt-1 text-gray-400">
                                    {isCorrelationMode
                                        ? `${activities.total} entrées dans cette trace causale`
                                        : `${activities.total} résultats · page ${actFilters.page ?? 1} / ${activities.last_page}`
                                    }
                                </p>
                            )}
                        </div>
                    )
            )}

            {activeTab === 'anomalies' && (
                selectedAnomaly
                    ? <AnomalyDetail log={anomDetail ?? selectedAnomaly} />
                    : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                            <AlertTriangle className="w-12 h-12 mb-3" />
                            <p className="text-sm font-medium text-gray-400">Sélectionnez une anomalie</p>
                            <p className="text-xs mt-1 text-gray-400">
                                {(anomalies?.data ?? []).filter(a => a.error_severity === 'CRITICAL').length} critiques ·{' '}
                                {(anomalies?.data ?? []).filter(a => a.error_severity === 'WARNING').length} warnings
                            </p>
                        </div>
                    )
            )}

            {activeTab === 'deletions' && (
                selectedDeletion
                    ? <DbDeletionDetail
                        entry={selectedDeletion}
                        cascade={activeCascadeTxnId ? cascade : null}
                        cascadeLoading={cascadeLoading}
                        onLoadCascade={handleLoadCascade}
                        onTraceToJournal={handleTraceToJournal}
                    />
                    : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                            <Database className="w-12 h-12 mb-3" />
                            <p className="text-sm font-medium text-gray-400">Sélectionnez une suppression</p>
                            <p className="text-xs mt-1 text-gray-400">{deletions ? `${deletions.total} entrées` : '—'}</p>
                        </div>
                    )
            )}

            {activeTab === 'settings' && <SettingsPanel />}
            {activeTab === 'purge' && <PurgePanel />}
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={leftContent}
                mainContent={mainContent}
                rightContent={<ActionPanel groups={actionGroups} />}
            />
            {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
            {showFilterModal && (
                <FilterModal
                    current={actFilters}
                    onApply={applyFilters}
                    onClose={() => setShowFilterModal(false)}
                />
            )}
        </>
    );
}
