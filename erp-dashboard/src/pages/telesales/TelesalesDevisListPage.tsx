import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import { FilePlus, FileText, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { ProductCatalog } from '@/components/telesales/ProductCatalog';
import { useDevisList, useCreateDevis } from '@/hooks/telesales/useTelesalesDevis';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { CatalogProduct, DevisStatus } from '@/types/telesalesAgent.types';

interface CartLine {
    product: CatalogProduct;
    quantity: number;
}

const STATUS_LABELS: Record<DevisStatus, string> = {
    draft: 'Brouillon',
    sent: 'Envoyé',
    converted: 'Converti',
    expired: 'Expiré',
};

const STATUS_COLORS: Record<DevisStatus, string> = {
    draft: 'bg-gray-100 text-gray-600',
    sent: 'bg-blue-100 text-blue-700',
    converted: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-red-100 text-red-700',
};

interface IncomingState {
    openCreateForPartner?: PartnerPickerOption;
}

export const TelesalesDevisListPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [statusFilter, setStatusFilter] = useState<string>('');
    const { devis, loading, refetch } = useDevisList({ status: statusFilter || undefined });

    const { create, loading: creating } = useCreateDevis();
    const { sessionActive } = useSessionGate();

    const incoming = (location.state as IncomingState | null) ?? null;
    const [showCreateModal, setShowCreateModal] = useState(!!incoming?.openCreateForPartner);
    const [partner, setPartner] = useState<PartnerPickerOption | null>(incoming?.openCreateForPartner ?? null);

    useEffect(() => {
        if (incoming?.openCreateForPartner) {
            // Clear the nav state so a later back/forward doesn't reopen the modal.
            navigate(location.pathname, { replace: true, state: null });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [cart, setCart] = useState<CartLine[]>([]);
    const [notes, setNotes] = useState('');

    const addProduct = (product: CatalogProduct) => {
        setCart((prev) => {
            const existing = prev.find((l) => l.product.id === product.id);
            if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
            return [...prev, { product, quantity: 1 }];
        });
    };

    const resetCreateForm = () => {
        setPartner(null);
        setCart([]);
        setNotes('');
    };

    const handleCreate = async () => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!partner || cart.length === 0) {
            toast.error('Sélectionner un partenaire et au moins un produit');
            return;
        }
        try {
            const created = await create({
                partner_id: partner.id,
                items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
                notes: notes || undefined,
            });
            toast.success(`Devis ${created.quote_number} créé`);
            resetCreateForm();
            setShowCreateModal(false);
            refetch();
            navigate(`/telesales/devis/${created.id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la création du devis');
        }
    };

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'quote_number', headerName: 'N°', width: 180 },
            {
                field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 180,
                valueGetter: (p: any) => p.data?.partner ? `${p.data.partner.name} (${p.data.partner.code})` : `#${p.data?.partner_id}`,
            },
            {
                field: 'total_amount', headerName: 'Montant', width: 130,
                valueFormatter: (p: any) => `${Number(p.value).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`,
            },
            {
                field: 'status', headerName: 'Statut', width: 120,
                cellRenderer: (p: any) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[p.value as DevisStatus]}`}>
                        {STATUS_LABELS[p.value as DevisStatus]}
                    </span>
                ),
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
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mes devis</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Devis B2B — distinct des commandes tant qu'ils ne sont pas convertis</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50"
                        >
                            <option value="">Tous les statuts</option>
                            {(Object.keys(STATUS_LABELS) as DevisStatus[]).map((s) => (
                                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                        >
                            <FilePlus className="w-4 h-4" />
                            Nouveau devis
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {!loading && devis.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun devis</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid
                        rowData={devis}
                        columnDefs={columnDefs}
                        loading={loading}
                        onRowClicked={(e: any) => navigate(`/telesales/devis/${e.data.id}`)}
                    />
                )}
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                mainContent={mainContent}
                rightContent={
                    <ActionPanel
                        groups={[
                            {
                                items: [
                                    { icon: FilePlus, label: 'Nouveau devis', variant: 'sage', onClick: () => setShowCreateModal(true) },
                                    { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                                ],
                            },
                        ]}
                    />
                }
            />

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nouveau devis" size="xl">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[70vh]">
                    <div className="lg:col-span-2 overflow-y-auto p-5 border-r border-gray-100">
                        {!partner ? (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                                <PartnerPicker value={partner} onChange={setPartner} />
                            </div>
                        ) : (
                            <ProductCatalog partnerId={partner.id} onAddProduct={addProduct} />
                        )}
                    </div>
                    <div className="overflow-y-auto p-5">
                        {partner && (
                            <div className="mb-4 flex items-center justify-between">
                                <div className="text-sm font-semibold text-gray-800">{partner.name} ({partner.code})</div>
                                <button onClick={() => setPartner(null)} className="text-xs text-sage-600 hover:underline">Changer</button>
                            </div>
                        )}
                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Lignes ({cart.length})</h3>
                        <div className="space-y-2 mb-4">
                            {cart.map((line) => (
                                <div key={line.product.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                    <div className="flex-1 min-w-0 text-xs font-semibold text-gray-700 truncate">{line.product.name}</div>
                                    <input
                                        type="number"
                                        min={1}
                                        value={line.quantity}
                                        onChange={(e) => setCart((prev) => prev.map((l) => (l.product.id === line.product.id ? { ...l, quantity: Number(e.target.value) } : l)))}
                                        className="w-14 px-1.5 py-1 text-xs text-center border border-gray-200 rounded"
                                    />
                                </div>
                            ))}
                        </div>
                        {!sessionActive && <SessionRequiredNotice className="mb-3" />}
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notes (optionnel)"
                            rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500 mb-3"
                        />
                        <button
                            onClick={handleCreate}
                            disabled={creating || !partner || cart.length === 0 || !sessionActive}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50"
                        >
                            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Créer le devis
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default TelesalesDevisListPage;
