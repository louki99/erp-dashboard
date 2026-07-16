import { useCallback, useEffect, useState } from 'react';
import {
    PackageCheck, CheckCircle2, RefreshCw, AlertCircle, Clock, User, Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { MagasinierDecharge } from '@/types/magasinier.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; text: string; border: string }> = {
    pending:   { label: 'En attente',  bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
    approved:  { label: 'Approuvé',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    rejected:  { label: 'Rejeté',     bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
    cancelled: { label: 'Annulé',     bg: 'bg-gray-100',   text: 'text-gray-500',    border: 'border-gray-200'    },
};

const statusMeta = (status?: string) =>
    STATUS_META[status ?? ''] ?? { label: status ?? '—', bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

// ─── List card ────────────────────────────────────────────────────────────────

const DechargeCard = ({
    decharge,
    selected,
    onClick,
}: {
    decharge: MagasinierDecharge;
    selected: boolean;
    onClick: () => void;
}) => {
    const s = statusMeta(decharge.status);
    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                selected
                    ? 'border-orange-300 ring-1 ring-orange-200 shadow-orange-50'
                    : 'border-gray-200 hover:border-orange-200'
            }`}
        >
            <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                        <PackageCheck className="w-3.5 h-3.5 text-orange-600" />
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                        {s.label}
                    </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">
                    {decharge.decharge_number ?? `#${decharge.id}`}
                </p>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {decharge.partner?.name ?? 'Partenaire inconnu'}
                    </span>
                    {decharge.created_at && (
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(decharge.created_at).toLocaleDateString('fr-FR')}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const MagasinierDechargePage = () => {
    const [decharges, setDecharges]   = useState<MagasinierDecharge[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('pending');
    const [loading, setLoading]           = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [approveNotes, setApproveNotes]   = useState('');

    const selected = decharges.find(d => d.id === selectedId) ?? null;
    const canApprove = !!selected && selected.status === 'pending';

    const pending  = decharges.filter(d => d.status === 'pending').length;
    const approved = decharges.filter(d => d.status === 'approved').length;

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.decharges.getList({ status: filterStatus || undefined });
            setDecharges(res.data?.data ?? res.data ?? []);
        } catch {
            toast.error('Erreur chargement des décharges');
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleSelect = async (d: MagasinierDecharge) => {
        if (selectedId === d.id) return;
        setSelectedId(d.id);
        setApproveNotes('');
        try {
            const res = await magasinierApi.decharges.getDetail(d.id);
            const detail = res.data?.data ?? res.data;
            setDecharges(prev => prev.map(x => x.id === d.id ? { ...x, ...detail } : x));
        } catch {
            // keep list data as fallback
        }
    };

    const handleApprove = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            await magasinierApi.decharges.approve(selected.id, approveNotes || undefined);
            toast.success('Décharge Van→Dépôt approuvée');
            setSelectedId(null);
            fetchList();
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
                    <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                        <PackageCheck className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">Décharges Van</h1>
                        <p className="text-[10px] text-gray-400">{decharges.length} décharge{decharges.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setSelectedId(null); }}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:bg-white transition-all"
                >
                    <option value="pending">En attente d'approbation</option>
                    <option value="approved">Approuvées</option>
                    <option value="">Toutes</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading ? (
                    <div className="flex items-center justify-center pt-16 text-gray-400">
                        <div className="w-5 h-5 border-b-2 border-orange-500 rounded-full animate-spin mr-2" />
                        Chargement...
                    </div>
                ) : decharges.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-gray-400 gap-3">
                        <PackageCheck className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Aucune décharge pour ce filtre</p>
                    </div>
                ) : (
                    decharges.map(d => (
                        <DechargeCard
                            key={d.id}
                            decharge={d}
                            selected={selectedId === d.id}
                            onClick={() => handleSelect(d)}
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-50 to-amber-100 flex items-center justify-center shadow-sm">
                    <PackageCheck className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Décharge Van → Dépôt</h2>
                    <p className="text-sm text-gray-400">Approuvez la réception des marchandises déchargées du van (§11)</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {/* Info banner */}
                <div className="flex items-start gap-3 px-4 py-3 bg-orange-50 border border-orange-100 rounded-xl mb-6">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-orange-800">Rôle du magasinier</p>
                        <p className="text-xs text-orange-600/80 mt-0.5">
                            Les décharges sont créées par le dispatcher après la fin de la tournée.
                            Votre rôle est de vérifier physiquement les marchandises et d'approuver le transfert VAN → DÉPÔT via le workflow.
                        </p>
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'En attente',   value: pending,           color: 'text-orange-600',  bg: pending  > 0 ? 'bg-orange-50'  : 'bg-gray-50', border: pending  > 0 ? 'border-orange-100'  : 'border-gray-200' },
                        { label: 'Approuvées',   value: approved,          color: 'text-emerald-600', bg: approved > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: approved > 0 ? 'border-emerald-100' : 'border-gray-200' },
                        { label: 'Total chargé', value: decharges.length,  color: 'text-gray-700',    bg: 'bg-gray-50',    border: 'border-gray-200'    },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* Detail */}
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                        <PackageCheck className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">Sélectionnez une décharge dans la liste</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Header card */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">
                                        {selected.decharge_number ?? `Décharge #${selected.id}`}
                                    </h3>
                                    <div className="flex flex-col gap-1 mt-1.5">
                                        {selected.partner && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <User className="w-3 h-3" /> {selected.partner.name}
                                            </p>
                                        )}
                                        {selected.rider && (
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <Package className="w-3 h-3" /> Livreur : {selected.rider.name}
                                            </p>
                                        )}
                                        {selected.created_at && (
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(selected.created_at).toLocaleString('fr-FR')}
                                            </p>
                                        )}
                                    </div>
                                    {(selected.comment || selected.reason) && (
                                        <p className="text-xs text-gray-400 italic mt-2">{selected.comment ?? selected.reason}</p>
                                    )}
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusMeta(selected.status).bg} ${statusMeta(selected.status).text} ${statusMeta(selected.status).border}`}>
                                    {statusMeta(selected.status).label}
                                </span>
                            </div>

                            {/* Items table */}
                            {selected.items && selected.items.length > 0 && (
                                <div className="border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Qté</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selected.items.map((item, i) => (
                                                <tr key={i} className="bg-white">
                                                    <td className="px-4 py-2.5 text-gray-800 font-medium">
                                                        {item.product_name ?? `Produit #${item.product_id}`}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{item.quantity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* Approve notes */}
                            {canApprove && (
                                <textarea
                                    value={approveNotes}
                                    onChange={e => setApproveNotes(e.target.value)}
                                    placeholder="Notes d'approbation (facultatif)"
                                    rows={2}
                                    className="mt-3 w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                                />
                            )}
                        </div>

                        {selected.status === 'approved' && (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <p className="text-xs text-emerald-700">Décharge approuvée — le transfert VAN → DÉPÔT est finalisé.</p>
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
                            label: 'Approuver la décharge',
                            variant: 'success',
                            onClick: handleApprove,
                            disabled: !canApprove || actionLoading,
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
