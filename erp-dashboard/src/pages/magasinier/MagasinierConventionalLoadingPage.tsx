import { useCallback, useEffect, useState } from 'react';
import {
    Truck, CheckCircle2, XCircle, QrCode, RefreshCw,
    AlertCircle, Package, Clock, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { LoadingRequest, LoadingRequestStatus } from '@/types/magasinier.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<LoadingRequestStatus, { label: string; bg: string; text: string; border: string }> = {
    submitted:          { label: 'Soumis',            bg: 'bg-gray-50',    text: 'text-gray-600',   border: 'border-gray-200'   },
    pending_cdz:        { label: 'Att. CDZ',          bg: 'bg-yellow-50',  text: 'text-yellow-700', border: 'border-yellow-200' },
    pending_adv:        { label: 'Att. ADV',          bg: 'bg-orange-50',  text: 'text-orange-700', border: 'border-orange-200' },
    approved:           { label: 'Approuvé',          bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'   },
    fulfilled:          { label: 'QR émis',           bg: 'bg-indigo-50',  text: 'text-indigo-700', border: 'border-indigo-200' },
    confirmed:          { label: 'Confirmé',          bg: 'bg-emerald-50', text: 'text-emerald-700',border: 'border-emerald-200'},
    cancelled:          { label: 'Annulé',            bg: 'bg-gray-100',   text: 'text-gray-500',   border: 'border-gray-200'   },
    rejected:           { label: 'Rejeté',            bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'    },
    rejected_by_vendor: { label: 'Refusé vendeur',   bg: 'bg-rose-50',    text: 'text-rose-700',   border: 'border-rose-200'   },
};

// ─── List Card ────────────────────────────────────────────────────────────────

const RequestCard = ({
    req,
    selected,
    onClick,
}: {
    req: LoadingRequest;
    selected: boolean;
    onClick: () => void;
}) => {
    const s = STATUS_META[req.status] ?? STATUS_META.submitted;
    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                selected
                    ? 'border-amber-300 ring-1 ring-amber-200 shadow-amber-50'
                    : 'border-gray-200 hover:border-amber-200'
            }`}
        >
            <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                        <Truck className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                        {s.label}
                    </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">#{req.id} — {req.user.name}</p>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {req.vendeur_items_snapshot.length} article{req.vendeur_items_snapshot.length > 1 ? 's' : ''}
                    </span>
                    {req.approved_at && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(req.approved_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const MagasinierConventionalLoadingPage = () => {
    const [requests, setRequests] = useState<LoadingRequest[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('approved');
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [fulfilledQtys, setFulfilledQtys] = useState<Record<number, number>>({});
    const [fulfillNotes, setFulfillNotes] = useState('');
    const [qrResult, setQrResult] = useState<{ token: string; expires_at: string } | null>(null);

    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectReason, setRejectReason] = useState('');

    const selected = requests.find(r => r.id === selectedId) ?? null;
    const canFulfill = !!selected && selected.status === 'approved' && !qrResult;
    const canReject  = !!selected && selected.status === 'approved';

    const fulfilled  = requests.filter(r => r.status === 'fulfilled').length;
    const approved   = requests.filter(r => r.status === 'approved').length;
    const confirmed  = requests.filter(r => r.status === 'confirmed').length;

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.conventionalLoading.getList({ status: filterStatus || undefined });
            setRequests(res.data ?? []);
        } catch {
            toast.error('Erreur chargement des demandes de chargement');
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleSelect = (req: LoadingRequest) => {
        setSelectedId(req.id);
        setQrResult(null);
        setShowRejectForm(false);
        setRejectReason('');
        setFulfillNotes('');
        const init: Record<number, number> = {};
        req.vendeur_items_snapshot.forEach(item => { init[item.product_id] = item.quantity; });
        setFulfilledQtys(init);
    };

    const handleFulfill = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            const res = await magasinierApi.conventionalLoading.fulfill(selected.id, {
                fulfilled_quantities: Object.fromEntries(
                    Object.entries(fulfilledQtys).map(([k, v]) => [k, v])
                ),
                notes: fulfillNotes || undefined,
            });
            setQrResult({ token: res.data.qr_token, expires_at: res.data.qr_expires_at });
            toast.success('Chargement préparé — QR émis');
            fetchList();
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Erreur lors de la préparation');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selected || !rejectReason.trim()) { toast.error('Motif requis'); return; }
        setActionLoading(true);
        try {
            await magasinierApi.conventionalLoading.rejectAtVendor(selected.id, rejectReason.trim());
            toast.success('Demande refusée au vendeur');
            setShowRejectForm(false);
            setRejectReason('');
            setSelectedId(null);
            fetchList();
        } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Erreur lors du refus');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Left panel ────────────────────────────────────────────────────────────

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                        <Truck className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">Chargements SFA</h1>
                        <p className="text-[10px] text-gray-400">{requests.length} demande{requests.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setSelectedId(null); }}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all"
                >
                    <option value="approved">Approuvés — à préparer</option>
                    <option value="fulfilled">QR émis</option>
                    <option value="confirmed">Confirmés</option>
                    <option value="rejected_by_vendor">Refusés vendeur</option>
                    <option value="">Tous les statuts</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading ? (
                    <div className="flex items-center justify-center pt-16 text-gray-400">
                        <div className="w-5 h-5 border-b-2 border-amber-500 rounded-full animate-spin mr-2" />
                        Chargement...
                    </div>
                ) : requests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-gray-400 gap-3">
                        <Truck className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Aucune demande pour ce filtre</p>
                    </div>
                ) : (
                    requests.map(req => (
                        <RequestCard
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
            {/* Fixed header */}
            <div className="flex items-center gap-4 p-6 lg:p-8 border-b border-gray-200 bg-white shrink-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center shadow-sm">
                    <Truck className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Chargement Conventionnel</h2>
                    <p className="text-sm text-gray-400">Préparez les chargements vendeurs SFA et émettez les QR de confirmation (§9)</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {/* Info banner */}
                <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl mb-6">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-amber-800">Flux chargement SFA</p>
                        <p className="text-xs text-amber-600/80 mt-0.5">
                            Préparez physiquement les articles, saisissez les quantités réelles puis émettez le QR.
                            Le vendeur scanne le QR sur son appli — le transfert CENTRAL → VAN s'applique automatiquement à la confirmation.
                        </p>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'À préparer',   value: approved,  color: 'text-blue-600',    bg: approved  > 0 ? 'bg-blue-50'    : 'bg-gray-50', border: approved  > 0 ? 'border-blue-100'    : 'border-gray-200' },
                        { label: 'QR émis',      value: fulfilled, color: 'text-indigo-600',  bg: fulfilled > 0 ? 'bg-indigo-50'  : 'bg-gray-50', border: fulfilled > 0 ? 'border-indigo-100'  : 'border-gray-200' },
                        { label: 'Confirmés',    value: confirmed, color: 'text-emerald-600', bg: confirmed > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: confirmed > 0 ? 'border-emerald-100' : 'border-gray-200' },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* Detail / empty */}
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                        <Truck className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">Sélectionnez une demande dans la liste</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Request header */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">Demande #{selected.id}</h3>
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                        <User className="w-3 h-3" /> {selected.user.name}
                                    </p>
                                    {selected.notes && <p className="text-xs text-gray-400 mt-1 italic">{selected.notes}</p>}
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${STATUS_META[selected.status]?.bg} ${STATUS_META[selected.status]?.text} ${STATUS_META[selected.status]?.border}`}>
                                    {STATUS_META[selected.status]?.label ?? selected.status}
                                </span>
                            </div>

                            {/* Items table */}
                            <div className="border border-gray-100 rounded-lg overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                            <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Demandé</th>
                                            {canFulfill && <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Préparé</th>}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {selected.vendeur_items_snapshot.map(item => (
                                            <tr key={item.product_id} className="bg-white">
                                                <td className="px-4 py-2.5 text-gray-800 font-medium">{item.product_name}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                                                {canFulfill && (
                                                    <td className="px-4 py-2.5 text-right">
                                                        <input
                                                            type="number"
                                                            min={0}
                                                            max={item.quantity}
                                                            value={fulfilledQtys[item.product_id] ?? item.quantity}
                                                            onChange={e => setFulfilledQtys(prev => ({ ...prev, [item.product_id]: Number(e.target.value) }))}
                                                            className="w-20 text-right text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-amber-400"
                                                        />
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Notes field for fulfill */}
                            {canFulfill && (
                                <textarea
                                    value={fulfillNotes}
                                    onChange={e => setFulfillNotes(e.target.value)}
                                    placeholder="Notes de préparation (facultatif) — ex: rupture partielle"
                                    rows={2}
                                    className="mt-3 w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                                />
                            )}
                        </div>

                        {/* QR result */}
                        {qrResult && (
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <QrCode className="w-5 h-5 text-indigo-600" />
                                    <p className="text-sm font-bold text-indigo-900">QR émis — transmettez au vendeur</p>
                                </div>
                                <div className="bg-white rounded-lg border border-indigo-100 p-3 font-mono text-xs text-indigo-800 break-all mb-2">
                                    {qrResult.token}
                                </div>
                                <p className="text-[10px] text-indigo-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Expire le {new Date(qrResult.expires_at).toLocaleString('fr-FR')}
                                </p>
                            </div>
                        )}

                        {/* Reject form (inline, shown via action) */}
                        {showRejectForm && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-5">
                                <p className="text-sm font-bold text-red-800 mb-3 flex items-center gap-2">
                                    <XCircle className="w-4 h-4" />Refuser au vendeur
                                </p>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    placeholder="Motif de refus requis — ex: pièce d'identité non conforme"
                                    rows={3}
                                    className="w-full text-xs border border-red-200 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-white"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleReject}
                                        disabled={actionLoading || !rejectReason.trim()}
                                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold py-2 rounded-lg transition-colors"
                                    >
                                        {actionLoading ? 'En cours...' : 'Confirmer le refus'}
                                    </button>
                                    <button
                                        onClick={() => setShowRejectForm(false)}
                                        className="px-4 py-2 text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg"
                                    >
                                        Annuler
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status info for non-actionable states */}
                        {selected.status === 'fulfilled' && !qrResult && (
                            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                                <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0" />
                                <p className="text-xs text-indigo-700">QR déjà émis pour cette demande — en attente de confirmation par le vendeur.</p>
                            </div>
                        )}
                        {selected.status === 'confirmed' && (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <p className="text-xs text-emerald-700">Confirmé — le transfert CENTRAL → VAN a été appliqué automatiquement.</p>
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
                            icon: CheckCircle2,
                            label: 'Préparer & émettre QR',
                            variant: 'success',
                            onClick: handleFulfill,
                            disabled: !canFulfill || actionLoading,
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: XCircle,
                            label: showRejectForm ? 'Annuler le refus' : 'Refuser au vendeur',
                            variant: 'danger',
                            onClick: () => setShowRejectForm(v => !v),
                            disabled: !canReject,
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
