import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FilePlus, FileText, RefreshCw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { ProductCatalog } from '@/components/telesales/ProductCatalog';
import { ListPanel, DetailHeader, EmptySelection, StatCard, StatusPill } from '@/components/telesales/panels';
import { useDevisList, useCreateDevis } from '@/hooks/telesales/useTelesalesDevis';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { CatalogProduct, DevisStatus, Devis } from '@/types/telesalesAgent.types';

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

const STATUS_ACCENT: Record<DevisStatus, 'gray' | 'blue' | 'emerald' | 'red'> = {
    draft: 'gray',
    sent: 'blue',
    converted: 'emerald',
    expired: 'red',
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

    const draftCount = devis.filter((d) => d.status === 'draft').length;
    const sentCount = devis.filter((d) => d.status === 'sent').length;
    const convertedCount = devis.filter((d) => d.status === 'converted').length;

    // ── Left panel — data list ────────────────────────────────────────────────

    const leftContent = (
        <ListPanel
            icon={FileText}
            title="Mes devis"
            subtitle={`${devis.length} devis`}
            accent="purple"
            items={devis}
            loading={loading}
            emptyIcon={FileText}
            emptyText="Aucun devis"
            selectedId={null}
            getId={(d) => d.id}
            onSelect={(d) => navigate(`/telesales/devis/${d.id}`)}
            filters={
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full appearance-none text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-purple-400 cursor-pointer"
                >
                    <option value="">Tous les statuts</option>
                    {(Object.keys(STATUS_LABELS) as DevisStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                </select>
            }
            renderRow={(d: Devis) => (
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{d.quote_number}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{d.partner?.name ?? `#${d.partner_id}`}</p>
                    </div>
                    <div className="shrink-0 text-right">
                        <p className="text-xs font-bold text-gray-700">{Number(d.total_amount).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</p>
                        <StatusPill label={STATUS_LABELS[d.status]} accent={STATUS_ACCENT[d.status]} />
                    </div>
                </div>
            )}
        />
    );

    // ── Center panel — overview ───────────────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={FileText}
                title="Devis B2B"
                subtitle="Création, envoi et conversion en commande"
                accent="purple"
                actions={
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                    >
                        <FilePlus className="w-3.5 h-3.5" /> Nouveau devis
                    </button>
                }
            />
            <TelesalesSessionBanner />
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                <div className="max-w-3xl space-y-8">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard label="Brouillons" value={draftCount} icon={FileText} accent="gray" muted={draftCount === 0} />
                        <StatCard label="Envoyés" value={sentCount} icon={FileText} accent="blue" muted={sentCount === 0} />
                        <StatCard label="Convertis" value={convertedCount} icon={FileText} accent="emerald" muted={convertedCount === 0} />
                    </div>
                    <EmptySelection icon={FileText} title="Sélectionnez un devis" hint="Cliquez sur un devis de la liste pour l'ouvrir, ou créez-en un nouveau" />
                </div>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={leftContent}
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
