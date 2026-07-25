import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { RotateCcw, Plus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { ProductCatalog } from '@/components/telesales/ProductCatalog';
import { useReturnsList, useCreateReturn } from '@/hooks/telesales/useTelesalesReturns';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { CatalogProduct, ReturnCondition, ReturnReason } from '@/types/telesalesAgent.types';
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

const STATUS_COLORS: Record<string, string> = {
    PENDING_DIRECTION_APPROVAL: 'bg-amber-100 text-amber-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    REJECTED: 'bg-red-100 text-red-700',
};

export const TelesalesReturnsPage = () => {
    const [statusFilter, setStatusFilter] = useState('');
    const { returns, loading, refetch } = useReturnsList({ status: statusFilter || undefined });
    const { createReturn, loading: creating } = useCreateReturn();
    const { sessionActive } = useSessionGate();

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

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'return_number', headerName: 'N°', width: 160 },
            {
                field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 180,
                valueGetter: (p: any) => p.data?.partner ? `${p.data.partner.name} (${p.data.partner.code})` : '-',
            },
            {
                field: 'status', headerName: 'Statut', width: 200,
                cellRenderer: (p: any) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[p.value] ?? 'bg-gray-100 text-gray-600'}`}>
                        {p.value}
                    </span>
                ),
            },
            {
                field: 'created_at', headerName: 'Créé le', width: 140,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '-',
            },
        ],
        []
    );

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <TelesalesSessionBanner />
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Retours clients</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Retours commerciaux (différés) — pas de retour immédiat depuis le télévendeur</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50"
                        >
                            <option value="">Tous les statuts</option>
                            <option value="PENDING_DIRECTION_APPROVAL">En attente</option>
                            <option value="APPROVED">Approuvé</option>
                            <option value="REJECTED">Rejeté</option>
                        </select>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                        >
                            <Plus className="w-4 h-4" />
                            Nouveau retour
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {!loading && returns.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <RotateCcw className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun retour</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid rowData={returns} columnDefs={columnDefs} loading={loading} />
                )}
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                mainContent={mainContent}
                rightContent={
                    <ActionPanel groups={[{ items: [{ icon: Plus, label: 'Nouveau retour', variant: 'sage', onClick: () => setShowCreateModal(true) }] }]} />
                }
            />

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
