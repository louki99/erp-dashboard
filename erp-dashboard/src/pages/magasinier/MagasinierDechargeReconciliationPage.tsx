import { useCallback, useEffect, useState } from 'react';
import {
    ScanLine, CheckCircle2, RefreshCw, AlertCircle,
    Package, Upload, Clock, User, Plus, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type {
    ConventionalDechargeReconciliationRequest,
    ConventionalDechargeReconciliationStatus,
    DechargeReconciliationLine,
} from '@/types/magasinier.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<ConventionalDechargeReconciliationStatus, { label: string; bg: string; text: string; border: string }> = {
    pending:   { label: 'En attente',  bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
    confirmed: { label: 'Confirmé',   bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
    approved:  { label: 'Approuvé',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    rejected:  { label: 'Rejeté',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
};

const statusMeta = (status?: string) =>
    STATUS_META[status as ConventionalDechargeReconciliationStatus] ?? { label: status ?? '—', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

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
                    {req.user ? (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <User className="w-3 h-3" /> {req.user.name}
                        </span>
                    ) : (
                        <span className="text-[10px] text-gray-400">—</span>
                    )}
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(req.created_at).toLocaleDateString('fr-FR')}
                    </span>
                </div>
            </div>
        </button>
    );
};

// ─── Inline line editor ───────────────────────────────────────────────────────

const LineEditor = ({
    lines,
    onChange,
    disabled,
}: {
    lines: DechargeReconciliationLine[];
    onChange: (lines: DechargeReconciliationLine[]) => void;
    disabled?: boolean;
}) => {
    const addLine    = () => onChange([...lines, { product_id: 0, physical_qty: 0 }]);
    const removeLine = (i: number) => onChange(lines.filter((_, idx) => idx !== i));
    const update     = (i: number, field: keyof DechargeReconciliationLine, v: number) =>
        onChange(lines.map((l, idx) => idx === i ? { ...l, [field]: v } : l));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Décompte physique</p>
                {!disabled && (
                    <button onClick={addLine} className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
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
                        placeholder="Qté"
                        min={0}
                        disabled={disabled}
                        className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50"
                    />
                    {!disabled && lines.length > 1 && (
                        <button onClick={() => removeLine(i)} className="text-gray-300 hover:text-red-400 transition-colors">
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
    const [requests, setRequests]     = useState<ConventionalDechargeReconciliationRequest[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('pending');
    const [loading, setLoading]           = useState(true);
    const [listUnavailable, setListUnavailable] = useState(false);
    const [actionLoading, setActionLoading]     = useState(false);

    // Confirm step state
    const [qrToken, setQrToken]     = useState('');
    const [photo, setPhoto]         = useState<File | null>(null);
    const [lines, setLines]         = useState<DechargeReconciliationLine[]>([{ product_id: 0, physical_qty: 0 }]);
    const [confirmDone, setConfirmDone] = useState(false);

    // Approve step state
    const [approveNotes, setApproveNotes] = useState('');
    const [approveDone, setApproveDone]   = useState(false);
    const [approveResult, setApproveResult] = useState<unknown>(null);

    const selected = requests.find(r => r.id === selectedId) ?? null;

    const pending  = requests.filter(r => r.status === 'pending').length;
    const confirmed = requests.filter(r => r.status === 'confirmed').length;
    const approved  = requests.filter(r => r.status === 'approved').length;

    const canConfirm = !!selected && (selected.status === 'pending' || selected.status === 'confirmed') && !confirmDone && !!qrToken.trim() && !actionLoading;
    const canApprove = !!selected && (selected.status === 'confirmed' || confirmDone) && !approveDone && !actionLoading;

    const fetchList = useCallback(async () => {
        setLoading(true);
        setListUnavailable(false);
        try {
            const res = await magasinierApi.dechargeReconciliation.getList({ status: filterStatus || undefined });
            setRequests(res.data ?? []);
        } catch (e: unknown) {
            const err = e as { response?: { status?: number } };
            // 404 = endpoint not yet deployed on backend
            if (err?.response?.status === 404 || err?.response?.status === 405) {
                setListUnavailable(true);
                setRequests([]);
            } else {
                toast.error('Erreur chargement des réconciliations');
            }
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleSelect = (req: ConventionalDechargeReconciliationRequest) => {
        setSelectedId(req.id);
        setQrToken('');
        setPhoto(null);
        setLines([{ product_id: 0, physical_qty: 0 }]);
        setConfirmDone(req.status === 'confirmed' || req.status === 'approved');
        setApproveDone(req.status === 'approved');
        setApproveNotes('');
        setApproveResult(null);
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
            setConfirmDone(true);
            setRequests(prev => prev.map(r => r.id === selected.id ? { ...r, status: 'confirmed' as const } : r));
            toast.success('Décompte confirmé — approuvez pour finaliser');
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
                        <p className="text-[10px] text-gray-400">
                            {listUnavailable ? 'Endpoint en déploiement' : `${requests.length} demande${requests.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setSelectedId(null); }}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white transition-all"
                >
                    <option value="pending">En attente</option>
                    <option value="confirmed">Confirmés</option>
                    <option value="approved">Approuvés</option>
                    <option value="">Tous</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading ? (
                    <div className="flex items-center justify-center pt-16 text-gray-400">
                        <div className="w-5 h-5 border-b-2 border-blue-500 rounded-full animate-spin mr-2" />
                        Chargement...
                    </div>
                ) : listUnavailable ? (
                    <div className="flex flex-col items-center justify-center pt-12 text-gray-400 gap-3 px-3">
                        <div className="w-10 h-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                            <AlertCircle className="w-5 h-5 text-yellow-500" />
                        </div>
                        <div className="text-center">
                            <p className="text-xs font-semibold text-gray-600">Liste non disponible</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Le backend déploie le endpoint<br />
                                <code className="bg-gray-100 px-1 rounded">GET /conventional-decharge-reconciliation</code>
                            </p>
                        </div>
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
                    <p className="text-sm text-gray-400">Confirmez le décompte physique à la réception des marchandises SFA (§10)</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {/* Info banner */}
                <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl mb-6">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <ScanLine className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-blue-800">Procédure en 2 étapes</p>
                        <p className="text-xs text-blue-600/80 mt-0.5">
                            <strong>1. Confirmer</strong> — Scannez le QR vendeur et saisissez les quantités réelles reçues.&nbsp;
                            <strong>2. Approuver</strong> — Validez la réconciliation pour déclencher le transfert VAN → DÉPÔT.
                        </p>
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'En attente',  value: pending,   color: 'text-blue-600',    bg: pending    > 0 ? 'bg-blue-50'    : 'bg-gray-50', border: pending    > 0 ? 'border-blue-100'    : 'border-gray-200' },
                        { label: 'Confirmés',   value: confirmed, color: 'text-indigo-600',  bg: confirmed  > 0 ? 'bg-indigo-50'  : 'bg-gray-50', border: confirmed  > 0 ? 'border-indigo-100'  : 'border-gray-200' },
                        { label: 'Approuvés',   value: approved,  color: 'text-emerald-600', bg: approved   > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: approved   > 0 ? 'border-emerald-100' : 'border-gray-200' },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* Empty state */}
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                        <ScanLine className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">Sélectionnez une réconciliation dans la liste</p>
                        {listUnavailable && (
                            <p className="text-xs text-yellow-600 mt-1">
                                La liste sera disponible dès que le backend déploie le endpoint GET.
                            </p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Request header */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Réconciliation #{selected.id}</h3>
                                    <div className="flex flex-col gap-1 mt-1.5">
                                        {selected.user && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="w-3 h-3" /> {selected.user.name}
                                            </p>
                                        )}
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(selected.created_at).toLocaleString('fr-FR')}
                                        </p>
                                        {selected.loading_request_id && (
                                            <p className="text-[10px] text-gray-400">Chargement lié : #{selected.loading_request_id}</p>
                                        )}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusMeta(selected.status).bg} ${statusMeta(selected.status).text} ${statusMeta(selected.status).border}`}>
                                    {statusMeta(selected.status).label}
                                </span>
                            </div>

                            {/* Items snapshot (if backend returns them) */}
                            {selected.items && selected.items.length > 0 && (
                                <div className="border border-gray-100 rounded-lg overflow-hidden mb-4">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Attendu</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selected.items.map((item, i) => (
                                                <tr key={i} className="bg-white">
                                                    <td className="px-4 py-2.5 text-gray-800">{item.product_name ?? `#${item.product_id}`}</td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Step 1 — Confirm form */}
                        {!confirmDone && (
                            <div className="bg-white border border-blue-100 rounded-xl shadow-sm p-5">
                                <p className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-black flex items-center justify-center">1</span>
                                    Confirmation du décompte
                                </p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1">Jeton QR vendeur *</label>
                                        <input
                                            type="text"
                                            value={qrToken}
                                            onChange={e => setQrToken(e.target.value)}
                                            placeholder="Scannez ou collez le token QR du vendeur"
                                            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white"
                                        />
                                    </div>
                                    <LineEditor lines={lines} onChange={setLines} />
                                    <div>
                                        <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1">
                                            <Upload className="w-3 h-3" /> Photo justificative
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

                        {/* Step 1 — Done indicator */}
                        {confirmDone && !approveDone && (
                            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0" />
                                <p className="text-xs text-indigo-700">Décompte confirmé — passez à l'approbation.</p>
                            </div>
                        )}

                        {/* Step 2 — Approve form */}
                        {confirmDone && !approveDone && (
                            <div className="bg-white border border-indigo-100 rounded-xl shadow-sm p-5">
                                <p className="text-sm font-bold text-indigo-800 mb-4 flex items-center gap-2">
                                    <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black flex items-center justify-center">2</span>
                                    Approbation de la réconciliation
                                </p>
                                <textarea
                                    value={approveNotes}
                                    onChange={e => setApproveNotes(e.target.value)}
                                    placeholder="Notes d'approbation (facultatif)"
                                    rows={2}
                                    className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                />
                            </div>
                        )}

                        {/* Done */}
                        {approveDone && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                                <p className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Réconciliation approuvée — transfert VAN → DÉPÔT effectué
                                </p>
                                {approveResult && (
                                    <div className="bg-white rounded-lg border border-emerald-100 p-3">
                                        <pre className="text-[10px] text-emerald-700 whitespace-pre-wrap">
                                            {JSON.stringify(approveResult, null, 2)}
                                        </pre>
                                    </div>
                                )}
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
                            label: 'Approuver la réconciliation',
                            variant: 'success',
                            onClick: handleApprove,
                            disabled: !canApprove,
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: RefreshCw,
                            label: 'Actualiser',
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
