import { useCallback, useEffect, useState } from 'react';
import {
    RotateCcw, CheckCircle2, XCircle, RefreshCw, AlertCircle,
    Package, Clock, User, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { PartnerReturn, PartnerReturnStatus, ReturnType } from '@/types/magasinier.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META: Partial<Record<PartnerReturnStatus, { label: string; bg: string; text: string; border: string }>> = {
    PENDING_DIRECTION_APPROVAL: { label: 'Att. direction',  bg: 'bg-yellow-50',  text: 'text-yellow-700',  border: 'border-yellow-200'  },
    APPROVED:                   { label: 'Approuvé',        bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200'    },
    ASSIGNED_TO_DRIVER:         { label: 'Livreur assigné', bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200'  },
    COLLECTED:                  { label: 'Collecté',        bg: 'bg-purple-50',  text: 'text-purple-700',  border: 'border-purple-200'  },
    RECEIVED_AT_WAREHOUSE:      { label: 'Reçu au dépôt',   bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
    CLOSED:                     { label: 'Clôturé',         bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    REJECTED:                   { label: 'Rejeté',          bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200'     },
    // ROLLED_BACK = retour immédiat finalisé — stock van remis en dépôt de façon atomique
    ROLLED_BACK:                { label: 'Stock restitué',  bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200'    },
    // RECONCILED = fin de cycle retour immédiat — décharge EOD complétée
    RECONCILED:                 { label: 'Réconcilié',      bg: 'bg-cyan-50',    text: 'text-cyan-700',    border: 'border-cyan-200'    },
    // IMMEDIATE is a legacy status — new immediate returns start at ROLLED_BACK directly
    IMMEDIATE:                  { label: 'Immédiat (legacy)', bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200'  },
};

const statusMeta = (status: PartnerReturnStatus) =>
    STATUS_META[status] ?? { label: status, bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' };

const RETURN_TYPE_LABEL: Record<ReturnType, string> = {
    commercial: 'Retour commercial',
    immediate:  'Retour immédiat',
};

// ─── List card ────────────────────────────────────────────────────────────────

const ReturnCard = ({
    ret,
    selected,
    onClick,
}: {
    ret: PartnerReturn;
    selected: boolean;
    onClick: () => void;
}) => {
    const s = statusMeta(ret.status);
    return (
        <button
            onClick={onClick}
            className={`w-full text-left bg-white border rounded-xl shadow-sm transition-all hover:shadow-md ${
                selected
                    ? 'border-purple-300 ring-1 ring-purple-200 shadow-purple-50'
                    : 'border-gray-200 hover:border-purple-200'
            }`}
        >
            <div className="p-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
                        {s.label}
                    </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 truncate">{ret.return_number}</p>
                <div className="flex items-center justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <User className="w-3 h-3" /> {ret.partner.name}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ret.created_at).toLocaleDateString('fr-FR')}
                    </span>
                </div>
            </div>
        </button>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const MagasinierReturnsPage = () => {
    const [returns, setReturns]       = useState<PartnerReturn[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('COLLECTED');
    const [loading, setLoading]           = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const selected = returns.find(r => r.id === selectedId) ?? null;

    const canReceive = !!selected && selected.status === 'COLLECTED';
    const canClose   = !!selected && selected.status === 'RECEIVED_AT_WAREHOUSE';

    const collected  = returns.filter(r => r.status === 'COLLECTED').length;
    const received   = returns.filter(r => r.status === 'RECEIVED_AT_WAREHOUSE').length;
    const closed     = returns.filter(r => r.status === 'CLOSED').length;

    const fetchList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.returns.getPending({ status: filterStatus || undefined });
            setReturns(res.data?.data ?? res.data ?? []);
        } catch {
            toast.error('Erreur chargement des retours');
        } finally {
            setLoading(false);
        }
    }, [filterStatus]);

    useEffect(() => { fetchList(); }, [fetchList]);

    const handleSelect = async (ret: PartnerReturn) => {
        if (selectedId === ret.id) return;
        setSelectedId(ret.id);
        try {
            const res = await magasinierApi.returns.getDetail(ret.id);
            const detail = res.data?.data ?? res.data;
            setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, ...detail } : r));
        } catch {
            // keep list data as fallback
        }
    };

    const handleReceive = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            await magasinierApi.returns.receive(selected.id);
            toast.success('Réception confirmée au dépôt');
            fetchList();
            setSelectedId(null);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message ?? 'Erreur lors de la réception');
        } finally {
            setActionLoading(false);
        }
    };

    const handleClose = async () => {
        if (!selected) return;
        setActionLoading(true);
        try {
            await magasinierApi.returns.close(selected.id);
            toast.success('Retour clôturé');
            fetchList();
            setSelectedId(null);
        } catch (e: unknown) {
            const err = e as { response?: { data?: { message?: string } } };
            toast.error(err?.response?.data?.message ?? 'Erreur lors de la clôture');
        } finally {
            setActionLoading(false);
        }
    };

    // ── Left panel ────────────────────────────────────────────────────────────

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">Retours Partenaires</h1>
                        <p className="text-[10px] text-gray-400">{returns.length} retour{returns.length !== 1 ? 's' : ''}</p>
                    </div>
                </div>
                <select
                    value={filterStatus}
                    onChange={e => { setFilterStatus(e.target.value); setSelectedId(null); }}
                    className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:bg-white transition-all"
                >
                    <option value="COLLECTED">Collectés — à réceptionner</option>
                    <option value="RECEIVED_AT_WAREHOUSE">Reçus — à clôturer</option>
                    <option value="CLOSED">Clôturés</option>
                    <option value="">Tous les statuts</option>
                </select>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {loading ? (
                    <div className="flex items-center justify-center pt-16 text-gray-400">
                        <div className="w-5 h-5 border-b-2 border-purple-500 rounded-full animate-spin mr-2" />
                        Chargement...
                    </div>
                ) : returns.length === 0 ? (
                    <div className="flex flex-col items-center justify-center pt-16 text-gray-400 gap-3">
                        <RotateCcw className="w-10 h-10 opacity-20" />
                        <p className="text-xs text-center">Aucun retour pour ce filtre</p>
                    </div>
                ) : (
                    returns.map(ret => (
                        <ReturnCard
                            key={ret.id}
                            ret={ret}
                            selected={selectedId === ret.id}
                            onClick={() => handleSelect(ret)}
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
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 flex items-center justify-center shadow-sm">
                    <RotateCcw className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-gray-900">Retours Partenaires</h2>
                    <p className="text-sm text-gray-400">Réceptionnez et clôturez les retours collectés (§12)</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {/* Info banner */}
                <div className="flex items-start gap-3 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl mb-6">
                    <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                        <RotateCcw className="w-4 h-4 text-purple-600" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-purple-800">Flux de réception des retours</p>
                        <p className="text-xs text-purple-600/80 mt-0.5">
                            <strong>1. Réceptionner</strong> — Confirmez la prise en charge du retour collecté par le livreur.<br />
                            <strong>2. Clôturer</strong> — Après contrôle qualité (bon / endommagé / expiré), clôturez le dossier.<br />
                            <span className="text-purple-500">Aucun avoir financier n'est généré automatiquement — la clôture ne crée pas de crédit partenaire.</span>
                        </p>
                    </div>
                </div>

                {/* KPI */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {[
                        { label: 'À réceptionner', value: collected, color: 'text-purple-600', bg: collected > 0 ? 'bg-purple-50'  : 'bg-gray-50', border: collected > 0 ? 'border-purple-100'  : 'border-gray-200' },
                        { label: 'À clôturer',     value: received,  color: 'text-teal-600',   bg: received  > 0 ? 'bg-teal-50'    : 'bg-gray-50', border: received  > 0 ? 'border-teal-100'    : 'border-gray-200' },
                        { label: 'Clôturés',       value: closed,    color: 'text-emerald-600',bg: closed    > 0 ? 'bg-emerald-50' : 'bg-gray-50', border: closed    > 0 ? 'border-emerald-100' : 'border-gray-200' },
                    ].map(k => (
                        <div key={k.label} className={`${k.bg} border ${k.border} rounded-xl p-5 shadow-sm`}>
                            <div className={`text-3xl font-bold ${k.color}`}>{k.value}</div>
                            <div className="text-xs text-gray-500 mt-1 font-medium">{k.label}</div>
                        </div>
                    ))}
                </div>

                {/* Dispatcher lock alert — shown when there are COLLECTED returns waiting */}
                {collected > 0 && (
                    <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-6">
                        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-red-800">
                                {collected} livreur{collected > 1 ? 's' : ''} bloqué{collected > 1 ? 's' : ''} — retour{collected > 1 ? 's' : ''} en attente de réception
                            </p>
                            <p className="text-xs text-red-600/80 mt-0.5">
                                Le dispatcher ne peut assigner aucune nouvelle mission à un livreur ayant un retour collecté non réceptionné.
                                Réceptionnez les retours en statut <strong>Collecté</strong> pour débloquer les livreurs.
                            </p>
                        </div>
                    </div>
                )}

                {/* Detail */}
                {!selected ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
                        <RotateCcw className="w-10 h-10 opacity-20" />
                        <p className="text-sm font-medium">Sélectionnez un retour dans la liste</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Header card */}
                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">{selected.return_number}</h3>
                                    <div className="flex flex-col gap-1 mt-1.5">
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            <User className="w-3 h-3" /> {selected.partner.name}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Tag className="w-3 h-3" /> {RETURN_TYPE_LABEL[selected.return_type] ?? selected.return_type}
                                        </p>
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            {new Date(selected.created_at).toLocaleString('fr-FR')}
                                        </p>
                                        {selected.return_reason && (
                                            <p className="text-xs text-gray-400 italic">{selected.return_reason}</p>
                                        )}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusMeta(selected.status).bg} ${statusMeta(selected.status).text} ${statusMeta(selected.status).border}`}>
                                    {statusMeta(selected.status).label}
                                </span>
                            </div>

                            {/* Timeline markers */}
                            {(selected.collection_timestamp || selected.warehouse_receipt_timestamp) && (
                                <div className="border-t border-gray-100 pt-3 mt-3 space-y-1">
                                    {selected.collection_timestamp && (
                                        <p className="text-[10px] text-gray-400">
                                            Collecté le {new Date(selected.collection_timestamp).toLocaleString('fr-FR')}
                                        </p>
                                    )}
                                    {selected.warehouse_receipt_timestamp && (
                                        <p className="text-[10px] text-gray-400">
                                            Reçu au dépôt le {new Date(selected.warehouse_receipt_timestamp).toLocaleString('fr-FR')}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Items */}
                            {selected.items && selected.items.length > 0 && (
                                <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-100">
                                            <tr>
                                                <th className="text-left px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Produit</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">Qté</th>
                                                <th className="text-right px-4 py-2 font-semibold text-gray-500 uppercase tracking-wider">État</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {selected.items.map((item, i) => (
                                                <tr key={i} className="bg-white">
                                                    <td className="px-4 py-2.5 text-gray-800 font-medium">
                                                        {item.product?.name ?? `Produit #${item.product_id}`}
                                                    </td>
                                                    <td className="px-4 py-2.5 text-right text-gray-600">{item.return_quantity}</td>
                                                    <td className="px-4 py-2.5 text-right">
                                                        {item.condition ? (
                                                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-600">
                                                                {item.condition}
                                                            </span>
                                                        ) : '—'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* Quality note */}
                        {selected.items && selected.items.length > 0 && (
                            <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                                <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-amber-800">
                                    Les états de condition (Bon / Endommagé / …) sont définis lors de la collecte par le livreur.
                                    Vérifiez physiquement que l'état correspond avant de clôturer.
                                </p>
                            </div>
                        )}

                        {selected.status === 'CLOSED' && (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                <p className="text-xs text-emerald-700">Retour clôturé — le crédit partenaire a été déclenché.</p>
                            </div>
                        )}
                        {selected.status === 'REJECTED' && (
                            <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
                                <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <p className="text-xs text-red-700">Retour rejeté par la direction — aucune action requise.</p>
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
                            icon: Package,
                            label: 'Confirmer la réception',
                            variant: 'primary',
                            onClick: handleReceive,
                            disabled: !canReceive || actionLoading,
                        },
                    ],
                },
                {
                    items: [
                        {
                            icon: CheckCircle2,
                            label: 'Clôturer le retour',
                            variant: 'success',
                            onClick: handleClose,
                            disabled: !canClose || actionLoading,
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
