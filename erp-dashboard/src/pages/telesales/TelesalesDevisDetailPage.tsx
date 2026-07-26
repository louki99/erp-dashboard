import { Send, ArrowRightLeft, Loader2, FileText } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { ListPanel, DetailHeader, StatusPill } from '@/components/telesales/panels';
import { useDevisList, useDevisDetail, useSendDevis, useConvertDevis } from '@/hooks/telesales/useTelesalesDevis';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { Devis, DevisStatus } from '@/types/telesalesAgent.types';

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

export const TelesalesDevisDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const devisId = Number(id);

    const { devis, setDevis, loading } = useDevisDetail(devisId);
    const { devis: allDevis, loading: loadingList } = useDevisList({});
    const { send, loading: sending } = useSendDevis();
    const { convert, loading: converting } = useConvertDevis();
    const { sessionActive } = useSessionGate();

    const [emailNotice, setEmailNotice] = useState<{ sent: boolean; reason: string | null } | null>(null);

    const handleSend = async () => {
        if (!devis) return;
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        try {
            const res = await send(devis.id);
            setDevis(res.quote);
            setEmailNotice(res.email);
            // draft -> sent always succeeds even if the email delivery itself fails (docs §6.3) —
            // email.sent is informational only, never treated as a blocking error.
            toast[res.email.sent ? 'success' : 'error'](
                res.email.sent ? 'Devis envoyé par email' : `Devis marqué envoyé — email non délivré (${res.email.reason ?? 'raison inconnue'})`
            );
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec de l'envoi");
        }
    };

    const handleConvert = async () => {
        if (!devis) return;
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        try {
            const res = await convert(devis.id);
            setDevis(res.quote);
            toast.success(`Devis converti en commande ${res.bc_number}`);
            navigate(`/telesales/orders/${res.order_id}`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la conversion');
        }
    };

    const leftContent = (
        <ListPanel
            icon={FileText}
            title="Mes devis"
            subtitle={`${allDevis.length} devis`}
            accent="purple"
            items={allDevis}
            loading={loadingList}
            emptyIcon={FileText}
            emptyText="Aucun devis"
            selectedId={devis?.id ?? devisId}
            getId={(d) => d.id}
            onSelect={(d) => navigate(`/telesales/devis/${d.id}`)}
            renderRow={(d: Devis) => (
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{d.quote_number}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 truncate">{d.partner?.name ?? `#${d.partner_id}`}</p>
                    </div>
                    <StatusPill label={STATUS_LABELS[d.status]} accent={STATUS_ACCENT[d.status]} />
                </div>
            )}
        />
    );

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={FileText}
                title={devis ? devis.quote_number : 'Devis'}
                subtitle={devis?.partner?.name}
                accent="purple"
            />
            <TelesalesSessionBanner />

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {loading ? (
                    <div className="flex items-center justify-center h-40">
                        <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
                    </div>
                ) : !devis ? (
                    <div className="text-center text-gray-500 py-12">Devis introuvable</div>
                ) : (
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
                            <div>
                                <div className="text-sm font-bold text-gray-800">{devis.partner?.name ?? `Partenaire #${devis.partner_id}`}</div>
                                <div className="text-xs text-gray-400">{devis.partner?.code}</div>
                            </div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                                devis.status === 'converted' ? 'bg-emerald-100 text-emerald-700' :
                                devis.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                                devis.status === 'expired' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                                {STATUS_LABELS[devis.status]}
                            </span>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-sage-500" />
                                <h3 className="text-xs font-bold text-gray-500 uppercase">Lignes</h3>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {devis.items.map((item) => (
                                    <div key={item.id} className="px-5 py-3 flex items-center justify-between text-sm">
                                        <div>
                                            <div className="font-semibold text-gray-800">{item.product?.name ?? `Produit #${item.product_id}`}</div>
                                            <div className="text-xs text-gray-400">{item.quantity} × {Number(item.price).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                                        </div>
                                        <div className="font-bold text-gray-700">{Number(item.line_total_ttc).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                                    </div>
                                ))}
                            </div>
                            <div className="px-5 py-3 bg-gray-50 flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-700">Total TTC</span>
                                <span className="text-lg font-black text-sage-700">{Number(devis.total_amount).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                            </div>
                        </div>

                        {emailNotice && (
                            <div className={`text-sm px-4 py-2.5 rounded-xl ${emailNotice.sent ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                {emailNotice.sent ? 'Email envoyé au partenaire.' : `Email non délivré : ${emailNotice.reason}`}
                            </div>
                        )}

                        {(devis.status === 'draft' || devis.status === 'sent') && (
                            <div className="space-y-3">
                                {!sessionActive && <SessionRequiredNotice />}
                                <div className="flex gap-3">
                                    {devis.status === 'draft' && (
                                        <button
                                            onClick={handleSend}
                                            disabled={sending || !sessionActive}
                                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            Envoyer
                                        </button>
                                    )}
                                    <button
                                        onClick={handleConvert}
                                        disabled={converting || !sessionActive}
                                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl hover:shadow disabled:opacity-50"
                                    >
                                        {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                                        Convertir en commande
                                    </button>
                                </div>
                            </div>
                        )}

                        {devis.status === 'converted' && devis.converted_order_id && (
                            <button
                                onClick={() => navigate(`/telesales/orders/${devis.converted_order_id}`)}
                                className="text-sm font-bold text-sage-600 hover:underline"
                            >
                                Voir la commande #{devis.converted_order_id}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        ...(devis?.status === 'draft'
                            ? [{ icon: Send, label: 'Envoyer', variant: 'sage' as const, onClick: handleSend, disabled: sending || !sessionActive }]
                            : []),
                        ...(devis?.status === 'draft' || devis?.status === 'sent'
                            ? [{ icon: ArrowRightLeft, label: 'Convertir', onClick: handleConvert, disabled: converting || !sessionActive }]
                            : []),
                    ],
                },
                { items: [{ icon: FileText, label: 'Mes devis', onClick: () => navigate('/telesales/devis') }] },
            ]}
        />
    );

    return (
        <MasterLayout
            leftContent={leftContent}
            mainContent={mainContent}
            rightContent={rightContent}
        />
    );
};

export default TelesalesDevisDetailPage;
