import { useCallback, useEffect, useState } from 'react';
import {
    ScanLine, CheckCircle2, RefreshCw, AlertCircle,
    Package, Upload, Clock, User, Plus, X, TrendingDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type {
    ConventionalDechargeReconciliationRequest,
    ConventionalDechargeReconciliationDetail,
    ConventionalDechargeReconciliationStatus,
    DechargeReconciliationLine,
} from '@/types/magasinier.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<ConventionalDechargeReconciliationStatus, { label: string; bg: string; text: string; border: string }> = {
    draft:        { label: 'En attente',   bg: 'bg-gray-50',    text: 'text-gray-600',    border: 'border-gray-200'    },
    reconciling:  { label: 'En cours',     bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
    completed:    { label: 'Complété',     bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
    approved:     { label: 'Approuvé',     bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    cancelled:    { label: 'Annulé',       bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200'     },
};

const statusMeta = (s?: string) =>
    STATUS_META[s as ConventionalDechargeReconciliationStatus] ??
    { label: s ?? '—', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

// ─── List card ────────────────────────────────────────────────────────────────

const ReconciliationCard = ({
    req,
    selected,
    onClick,
}: {
    req: ConventionalDechargeReconciliationRequest;
    selected: boolean;
    onClick: () => void;
}) => {
    const s = statusMeta(req.status);
    const shortageTotal = parseFloat(req.shortage_value_total ?? '0');
    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                selected
                    ? 'border-blue-300 ring-1 ring-blue-200 shadow-blue-50'
                    : 'border-gray-200 hover:border-blue-200'
            }`}
        >
            <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <ScanLine className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                        {s.label}
                    </span>
                </div>
                <p className="text-xs font-semibold text-gray-900">Réconciliation #{req.id}</p>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {req.user?.name ?? '—'}
                    </span>
                    {shortageTotal > 0 && (
                        <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
                            <TrendingDown className="w-3 h-3" /> {shortageTotal.toFixed(2)}
                        </span>
                    )}
                </div>
                {req.initiated_at && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.initiated_at).toLocaleString('fr-FR')}
                    </p>
                )}
            </div>
        </button>
    );
};

// ─── Line editor for confirm step ─────────────────────────────────────────────

const LineEditor = ({
    lines,
    onChange,
    disabled,
}: {
    lines: DechargeReconciliationLine[];
    onChange: (l: DechargeReconciliationLine[]) => void;
    disabled?: boolean;
}) => {
    const add    = () => onChange([...lines, { product_id: 0, physical_qty: 0 }]);
    const remove = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
    const update = (i: number, field: keyof DechargeReconciliationLine, v: number) =>
        onChange(lines.map((l, idx) => idx === i ? { ...l, [field]: v } : l));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Décompte physique par produit</p>
                {!disabled && (
                    <button onClick={add} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                        <Plus className="w-3 h-3" /> Ajouter
                    </button>
                )}
            </div>
            {lines.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                    <input
                        type="number"
                        value={l.product_id || ''}
                        onChange={e => update(i, 'product_id', Number(e.target.value))}
                        placeholder="ID produit"
                        disabled={disabled}
                        className="w-24 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    />
                    <input
                        type="number"
                        value={l.physical_qty}
                        onChange={e => update(i, 'physical_qty', Number(e.target.value))}
                        placeholder="Qté physique"
                        min={0}
                        disabled={disabled}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    />
                    {!disabled && lines.length > 1 && (
                        <button onClick={() => remove(i)} className="text-gray-300 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const MagasinierDechargeReconciliationPage = () => {
    const [requests, setRequests]         = useState<ConventionalDechargeReconciliationRequest[]>([]);
    const [selectedId, setSelectedId]     = useState<number | null>(null);
    const [detail, setDetail]             = useState<ConventionalDechargeReconciliationDetail | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('draft');
    const [loading, setLoading]           = useState(true);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    const [qrToken, setQrToken]     = useState('');
    const [photo, setPhoto]         = useState<File | null>(null);
    const [lines, setLines]         = useState<DechargeReconciliationLine[]>([{ product_id: 0, physical_qty: 0 }]);
    const [approveNotes, setApproveNotes] = useState('');
    const [approveDone, setApproveDone]   = useState(false);
    const [approveResult, setApproveResult] = useState<unknown>(null);

    const selected = requests.find(r => r.id === selectedId) ?? null;

    // real status transitions: draft → (confirm) → reconciling → (approve) → approved
    const canConfirm = !!selected && selected.status === 'draft' && !!qrToken.trim() && !actionLoading;
    const canApprove = !!selected && selected.status === 'reconciling'              && !approveDone && !actionLoading;

    const pending     = requests.filter(r => r.status === 'draft').length;
    const reconciling = requests.filter(r => r.status === 'reconciling').length;
    const approved    = requests.filter(r => r.status === 'approved').length;

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.dechargeReconciliation.getList({ status: filterStatus || undefined });
            setRequests(res.data ?? []);
        } catch {
            toast.error('Erreur chargement des réconciliations');
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleSelect = async (req: ConventionalDechargeReconciliationRequest) => {
        setSelectedId(req.id);
        setDetail(null);
        setQrToken('');
        setPhoto(null);
        setApproveNotes('');
        setApproveDone(req.status === 'approved');
        setApproveResult(null);

        // Seed lines from theoretical_by_product map as default
        const theoreticalLines: DechargeReconciliationLine[] = Object.entries(req.theoretical_by_product).map(
            ([pid, qty]) => ({ product_id: Number(pid), physical_qty: qty })
        );
        setLines(theoreticalLines.length > 0 ? theoreticalLines : [{ product_id: 0, physical_qty: 0 }]);

        // Load full detail with resolved product names
        setDetailLoading(true);
        try {
            const d = await magasinierApi.dechargeReconciliation.getDetail(req.id);
            setDetail(d);
            // Re-seed lines from resolved items if available
            if (d.items && d.items.length > 0) {
                setLines(d.items.map(item => ({
                    product_id: item.product_id,
                    physical_qty: item.physical_quantity ?? item.theoretical_quantity,
                })));
            }
        } catch {
            // keep theoretical map as fallback — non-blocking
        } finally {
            setDetailLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selected) return;
        if (!qrToken.trim()) { toast.error('Jeton QR requis'); return; }
        if (lines.some(l => l.product_id === 0)) { toast.error('ID produit manquant dans le décompte'); return; }
        setActionLoading(true);
        try {
            await magasinierApi.dechargeReconciliation.confirm(selected.id, {
                qr_token: qrToken.trim(),
                lines,
                photo: photo ?? undefined,
            });
            setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'reconciling' as const } : r));
            toast.success('Décompte confirmé — approuvez pour finaliser le transfert');
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message ?? 'Erreur lors de la confirmation');
        } finally {
            setActionLoading(false);
        }
    };

    const handleApprove = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            const res = await magasinierApi.dechargeReconciliation.approve(selected.id, approveNotes || undefined);
            setApproveDone(true);
            setApproveResult(res);
            setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'approved' as const } : r));
            toast.success('Réconciliation approuvée — transfert VAN → DÉPÔT effectué');
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message ?? 'Erreur lors de l\'approbation');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Left panel ────────────────────────────────────────────────────────────

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                        <ScanLine className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">Réconciliations</h1>
                        <p className="text-[10px] text-gray-400">{requests.length} demande{requests.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setSelectedId(null); setDetail(null); }}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                >
                    <option value="draft">En attente (draft)</option>
                    <option value="reconciling">En cours de réconciliation</option>
                    <option value="completed">Complétés</option>
                    <option value="approved">Approuvés</option>
                    <option value="cancelled">Annulés</option>
                    <option value="">Tous</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading ? (
                    <div className="flex items-center justify-center pt-16 text-gray-400">
                        <div className="w-5 h-5 border-b-2 border-blue-500 rounded-full animate-spin mr-2" />
                        Chargement...
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-gray-400 gap-3">
                        <ScanLine className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Aucune réconciliation pour ce filtre</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <ReconciliationCard
                            key={req.id}
                            req={req}
                            selected={selectedId === req.id}
                            onClick={() => handleSelect(req)}
                        />
                    ))
                )}
            </div>
        </div>
    );

    // ── Main panel ────────────────────────────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <div className="flex items-center gap-4 p-6 lg:p-8 border-b border-gray-200 bg-white shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center shadow-sm">
                    <ScanLine className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Réconciliation de Décharge</h2>
                    <p className="text-sm text-gray-400">Confirmez le décompte physique EOD, puis approuvez le transfert VAN → DÉPÔT (§10)</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-6">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <ScanLine className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-blue-800">Procédure en 2 étapes</p>
                        <p className="text-xs text-blue-600/80 mt-0.5">
                            <strong>1. Confirmer (draft → reconciling)</strong> — Scannez le QR vendeur et saisissez les quantités réelles reçues.<br />
                            <strong>2. Approuver (reconciling → approved)</strong> — Déclenche le transfert VAN → DÉPÔT.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'En attente',       value: pending,     color: 'text-gray-600',    bg: pending     > 0 ? 'bg-gray-50'    : 'bg-gray-50', border: pending     > 0 ? 'border-gray-300'    : 'border-gray-200' },
                        { label: 'En réconciliation', value: reconciling, color: 'text-blue-600',    bg: reconciling > 0 ? 'bg-blue-50'    : 'bg-gray-50', border: reconciling > 0 ? 'border-blue-100'    : 'border-gray-200' },
                        { label: 'Approuvés',         value: approved,    color: 'text-emerald-600', bg: approved    > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: approved    > 0 ? 'border-emerald-100' : 'border-gray-200' },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                        </div>
                    ))}
                </div>

                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                        <ScanLine className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">Sélectionnez une réconciliation dans la liste</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Header */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Réconciliation #{selected.id}</h3>
                                    <div className="flex flex-col gap-1 mt-1.5">
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <User className="w-3 h-3" /> {selected.user?.name ?? '—'}
                                        </p>
                                        <p className="text-[10px] text-gray-400">Branche : {selected.branch_code}</p>
                                        {selected.work_session_id && (
                                            <p className="text-[10px] text-gray-400">Session de travail : #{selected.work_session_id}</p>
                                        )}
                                        {selected.initiated_at && (
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Initiée le {new Date(selected.initiated_at).toLocaleString('fr-FR')}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusMeta(selected.status).bg} ${statusMeta(selected.status).text} ${statusMeta(selected.status).border}`}>
                                    {statusMeta(selected.status).label}
                                </span>
                            </div>

                            {/* Product counts table — from resolved detail or product maps */}
                            {detailLoading ? (
                                <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
                                    <div className="w-4 h-4 border-b-2 border-blue-400 rounded-full animate-spin" />
                                    Chargement des détails produit...
                                </div>
                            ) : detail?.items && detail.items.length > 0 ? (
                                <div className="border border-gray-100 rounded-lg overflow-hidden mt-3">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Théorique</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Physique</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Écart</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {detail.items.map(item => (
                                                <tr key={item.product_id} className="bg-white">
                                                    <td className="px-4 py-2.5 text-gray-800 font-medium">{item.product_name}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{item.theoretical_quantity}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{item.physical_quantity}</td>
                                                    <td className={`px-4 py-2.5 text-right font-semibold ${(item.shortage_quantity ?? 0) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                        {(item.shortage_quantity ?? 0) > 0 ? `-${item.shortage_quantity}` : '✓'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {selected.shortage_value_total && parseFloat(selected.shortage_value_total) > 0 && (
                                        <div className="flex items-center justify-between px-4 py-2 bg-red-50 border-t border-red-100">
                                            <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                <TrendingDown className="w-3 h-3" /> Valeur de l'écart total
                                            </span>
                                            <span className="text-xs font-bold text-red-700">{parseFloat(selected.shortage_value_total).toFixed(2)} MAD</span>
                                        </div>
                                    )}
                                </div>
                            ) : Object.keys(selected.theoretical_by_product).length > 0 ? (
                                <div className="border border-gray-100 rounded-lg overflow-hidden mt-3">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">ID produit</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Théorique</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Physique</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {Object.entries(selected.theoretical_by_product).map(([pid, theo]) => (
                                                <tr key={pid} className="bg-white">
                                                    <td className="px-4 py-2.5 text-gray-600">#{pid}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{theo}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">
                                                        {selected.physical_by_product?.[pid] ?? '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </div>

                        {/* Step 1 — Confirm form (only when draft) */}
                        {selected.status === 'draft' && (
                            <div className="bg-white border border-blue-100 rounded-xl shadow-sm p-5">
                                <p className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center">1</span>
                                    Confirmation du décompte (draft → reconciling)
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Jeton QR vendeur *</label>
                                        <input
                                            type="text"
                                            value={qrToken}
                                            onChange={e => setQrToken(e.target.value)}
                                            placeholder="Scannez ou collez le token QR"
                                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
                                        />
                                    </div>
                                    <LineEditor lines={lines} onChange={setLines} />
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                            <Upload className="w-3 h-3" /> Photo du bon signé (optionnel, max 15 Mo)
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={e => setPhoto(e.target.files?.[0] ?? null)}
                                            className="w-full text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-xs file:bg-blue-50 file:text-blue-600 hover:file:bg-blue-100"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step 2 — Approve form (only when reconciling) */}
                        {selected.status === 'reconciling' && !approveDone && (
                            <div className="bg-white border border-indigo-100 rounded-xl shadow-sm p-5">
                                <p className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">2</span>
                                    Approbation (reconciling → approved)
                                </p>
                                <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-3">
                                    <AlertCircle className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-indigo-700">Cette action déclenche le transfert physique VAN → DÉPÔT. Elle est irréversible.</p>
                                </div>
                                <textarea
                                    value={approveNotes}
                                    onChange={e => setApproveNotes(e.target.value)}
                                    placeholder="Notes d'approbation (facultatif) — ex: RAS, conforme au comptage."
                                    rows={2}
                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                />
                            </div>
                        )}

                        {/* Done */}
                        {approveDone && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                                <p className="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Réconciliation approuvée — transfert VAN → DÉPÔT effectué
                                </p>
                                {approveResult && (
                                    <div className="bg-white rounded-lg border border-emerald-100 p-3 mt-3">
                                        <pre className="text-[10px] text-emerald-700 whitespace-pre-wrap">{JSON.stringify(approveResult, null, 2)}</pre>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Cancelled */}
                        {selected.status === 'cancelled' && (
                            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-xs text-red-700">Cette réconciliation a été annulée — aucune action disponible.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Right panel ───────────────────────────────────────────────────────────

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        {
                            icon: ScanLine,
                            label: 'Confirmer le décompte',
                            variant: 'primary',
                            onClick: handleConfirm,
                            disabled: !canConfirm,
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: CheckCircle2,
                            label: 'Approuver le transfert',
                            variant: 'success',
                            onClick: handleApprove,
                            disabled: !canApprove,
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: Package,
                            label: 'Recharger le détail',
                            variant: 'sage',
                            onClick: () => selected && handleSelect(selected),
                            disabled: !selected || detailLoading,
                        },
                        {
                            icon: RefreshCw,
                            label: 'Actualiser la liste',
                            variant: 'sage',
                            onClick: fetchList,
                        },
                    ],
                },
            ]}
        />
    );

    return <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />;
};
