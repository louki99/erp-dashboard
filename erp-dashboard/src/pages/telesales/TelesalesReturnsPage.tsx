import { useState } from 'react';
import { RotateCcw, Plus, Loader2, Trash2, AlertTriangle, RefreshCw, Package, CalendarClock } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { ProductCatalog } from '@/components/telesales/ProductCatalog';
import { ListPanel, DetailHeader, EmptySelection, StatusPill } from '@/components/telesales/panels';
import { useReturnsList, useCreateReturn, useReturnDetail } from '@/hooks/telesales/useTelesalesReturns';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { CatalogProduct, ReturnCondition, ReturnReason, PartnerReturnSummary } from '@/types/telesalesAgent.types';
import { RETURN_REASON_LABELS } from '@/types/telesalesAgent.types';

interface ReturnLine {
    product: CatalogProduct;
    return_quantity: number;
    condition: ReturnCondition;
    reason: ReturnReason;
}

const CONDITION_LABELS: Record<ReturnCondition, string> = {
    good: 'Bon état',
    damaged: 'Endommagé',
    expired: 'Périmé',
};

const STATUS_ACCENT: Record<string, 'amber' | 'emerald' | 'red' | 'gray'> = {
    PENDING_DIRECTION_APPROVAL: 'amber',
    APPROVED: 'emerald',
    REJECTED: 'red',
};

const STATUS_LABELS: Record<string, string> = {
    PENDING_DIRECTION_APPROVAL: 'En attente direction',
    APPROVED: 'Approuvé',
    REJECTED: 'Rejeté',
};

export const TelesalesReturnsPage = () => {
    const [statusFilter, setStatusFilter] = useState('');
    const { returns, loading, refetch } = useReturnsList({ status: statusFilter || undefined });
    const { createReturn, loading: creating } = useCreateReturn();
    const { sessionActive } = useSessionGate();
    const [selected, setSelected] = useState<PartnerReturnSummary | null>(null);
    const { detail, loading: loadingDetail } = useReturnDetail(selected?.id ?? null);

    const [showCreateModal, setShowCreateModal] = useState(false);
    const [partner, setPartner] = useState<PartnerPickerOption | null>(null);
    const [lines, setLines] = useState<ReturnLine[]>([]);
    const [notes, setNotes] = useState('');

    const addProduct = (product: CatalogProduct) => {
        setLines((prev) => {
            if (prev.some((l) => l.product.id === product.id)) return prev;
            return [...prev, { product, return_quantity: 1, condition: 'good', reason: 'COMMERCIAL_RETURN' }];
        });
    };

    const updateLine = (productId: number, patch: Partial<ReturnLine>) => {
        setLines((prev) => prev.map((l) => (l.product.id === productId ? { ...l, ...patch } : l)));
    };

    const removeLine = (productId: number) => {
        setLines((prev) => prev.filter((l) => l.product.id !== productId));
    };

    const resetForm = () => {
        setPartner(null);
        setLines([]);
        setNotes('');
    };

    const handleCreate = async () => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!partner || lines.length === 0) {
            toast.error('Sélectionner un partenaire et au moins un produit');
            return;
        }
        try {
            const created = await createReturn({
                partner_id: partner.id,
                notes: notes || undefined,
                items: lines.map((l) => ({
                    product_id: l.product.id,
                    return_quantity: l.return_quantity,
                    condition: l.condition,
                    reason: l.reason,
                    unit_price: l.product.price,
                })),
            });
            toast.success(`Retour ${created.return_number} créé — en attente d'approbation direction`);
            resetForm();
            setShowCreateModal(false);
            refetch();
        } catch (err: any) {
            // §5.7 prerequisite: agent needs an AccessProfile ("Télévendeur Profile")
            // assigned — a 403 here often means that's missing, not a permission bug.
            if (err?.response?.status === 403) {
                toast.error("Accès refusé — vérifiez qu'un profil d'accès Télévendeur vous a été assigné (contactez un admin)");
            } else {
                toast.error(err?.response?.data?.message || 'Échec de la création du retour');
            }
        }
    };

    // ── Left panel — data list ────────────────────────────────────────────────

    const leftContent = (
        <ListPanel
            icon={RotateCcw}
            title="Retours clients"
            subtitle={`${returns.length} retour${returns.length !== 1 ? 's' : ''}`}
            accent="rose"
            items={returns}
            loading={loading}
            emptyIcon={RotateCcw}
            emptyText="Aucun retour"
            selectedId={selected?.id ?? null}
            getId={(r) => r.id}
            onSelect={setSelected}
            filters={
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400 cursor-pointer"
                >
                    <option value="">Tous les statuts</option>
                    <option value="PENDING_DIRECTION_APPROVAL">En attente</option>
                    <option value="APPROVED">Approuvé</option>
                    <option value="REJECTED">Rejeté</option>
                </select>
            }
            renderRow={(r) => (
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{r.return_number}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{r.partner?.name ?? '-'}</p>
                    </div>
                    <StatusPill label={STATUS_LABELS[r.status] ?? r.status} accent={STATUS_ACCENT[r.status] ?? 'gray'} />
                </div>
            )}
        />
    );

    // ── Center panel — detail ─────────────────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={RotateCcw}
                title={selected ? selected.return_number : 'Retours clients'}
                subtitle={selected ? selected.partner?.name : 'Retours commerciaux différés — pas de retour immédiat'}
                accent="rose"
                actions={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                    >
                        <Plus className="w-3.5 h-3.5" /> Nouveau retour
                    </button>
                }
            />
            <TelesalesSessionBanner />
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {!selected ? (
                    <EmptySelection icon={RotateCcw} title="Sélectionnez un retour" hint="Cliquez sur un retour de la liste pour afficher le détail, ou créez-en un nouveau" />
                ) : loadingDetail ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
                    </div>
                ) : (
                    <div className="max-w-xl space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                <RotateCcw className="w-6 h-6 text-rose-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-lg font-bold text-gray-900 truncate">{selected.partner?.name ?? `Partenaire #${selected.partner?.id}`}</div>
                                <div className="text-sm text-gray-400">{selected.partner?.code}</div>
                            </div>
                            <StatusPill label={STATUS_LABELS[selected.status] ?? selected.status} accent={STATUS_ACCENT[selected.status] ?? 'gray'} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                                    <CalendarClock className="w-3.5 h-3.5" /> Créé le
                                </div>
                                <div className="text-sm font-semibold text-gray-800">
                                    {selected.created_at ? new Date(selected.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="text-[11px] font-bold text-gray-400 uppercase mb-1">Type</div>
                                <div className="text-sm font-semibold text-gray-800 capitalize">{selected.return_type}</div>
                            </div>
                        </div>

                        {detail?.items && detail.items.length > 0 && (
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5">
                                    <Package className="w-4 h-4 text-gray-400" />
                                    <h3 className="text-[11px] font-bold text-gray-500 uppercase">Lignes ({detail.items.length})</h3>
                                </div>
                                <div className="divide-y divide-gray-50">
                                    {detail.items.map((item) => (
                                        <div key={item.id} className="px-5 py-3 flex items-center justify-between text-sm">
                                            <div>
                                                <div className="font-semibold text-gray-800">Produit #{item.product_id}</div>
                                                <div className="text-xs text-gray-400">
                                                    {item.return_quantity} × {CONDITION_LABELS[item.condition]} · {RETURN_REASON_LABELS[item.reason]}
                                                </div>
                                            </div>
                                            <div className="font-bold text-gray-700">{Number(item.unit_price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                            Ce retour suit le workflow d'approbation direction standard — un chauffeur sera assigné pour la collecte une fois approuvé. Aucune action supplémentaire requise côté agent.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Right panel — actions ─────────────────────────────────────────────────

    const rightContent = (
        <ActionPanel
            groups={[
                { items: [{ icon: Plus, label: 'Nouveau retour', variant: 'sage', onClick: () => setShowCreateModal(true) }] },
                { items: [{ icon: RefreshCw, label: 'Rafraîchir', onClick: refetch }] },
            ]}
        />
    );

    return (
        <>
            <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nouveau retour client" size="xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[70vh]">
                    <div className="lg:col-span-2 overflow-y-auto p-5 border-r border-gray-100">
                        {!partner ? (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                                <PartnerPicker value={partner} onChange={setPartner} />
                            </div>
                        ) : (
                            <ProductCatalog
                                partnerId={partner.id}
                                onAddProduct={addProduct}
                                requireFlag="is_returnable"
                                requireFlagMessage="Ce produit n'est pas éligible aux retours"
                            />
                        )}
                    </div>
                    <div className="overflow-y-auto p-5">
                        {partner && (
                            <div className="mb-4 flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-800">{partner.name} ({partner.code})</div>
                                <button onClick={() => setPartner(null)} className="text-xs text-sage-600 hover:underline">Changer</button>
                            </div>
                        )}
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Lignes ({lines.length})</h3>
                        <div className="space-y-3 mb-4">
                            {lines.map((line) => (
                                <div key={line.product.id} className="p-3 bg-gray-50 rounded-lg space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-gray-700 truncate">{line.product.name}</span>
                                        <button onClick={() => removeLine(line.product.id)} className="text-red-400 hover:text-red-600">
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        <input
                                            type="number"
                                            min={1}
                                            value={line.return_quantity}
                                            onChange={(e) => updateLine(line.product.id, { return_quantity: Number(e.target.value) })}
                                            className="px-1.5 py-1 text-xs border border-gray-200 rounded text-center"
                                        />
                                        <select
                                            value={line.condition}
                                            onChange={(e) => updateLine(line.product.id, { condition: e.target.value as ReturnCondition })}
                                            className="px-1 py-1 text-xs border border-gray-200 rounded"
                                        >
                                            {(Object.keys(CONDITION_LABELS) as ReturnCondition[]).map((c) => (
                                                <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={line.reason}
                                            onChange={(e) => updateLine(line.product.id, { reason: e.target.value as ReturnReason })}
                                            className="px-1 py-1 text-xs border border-gray-200 rounded"
                                        >
                                            {(Object.keys(RETURN_REASON_LABELS) as ReturnReason[]).map((r) => (
                                                <option key={r} value={r}>{RETURN_REASON_LABELS[r]}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notes (optionnel)"
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500 mb-3"
                        />
                        <div className="flex items-start gap-2 text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-3">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            Nécessite un profil d'accès "Télévendeur Profile" assigné par un admin — sinon 403 sur la création.
                        </div>
                        {!sessionActive && <SessionRequiredNotice className="mb-3" />}
                        <button
                            onClick={handleCreate}
                            disabled={creating || !partner || lines.length === 0 || !sessionActive}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50"
                        >
                            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Créer le retour
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default TelesalesReturnsPage;
