import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, PhoneCall, Briefcase, Loader2, Wallet, CalendarClock, RefreshCw, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { ListPanel, DetailHeader, EmptySelection } from '@/components/telesales/panels';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { usePortfolio } from '@/hooks/telesales/useTelesalesPortfolio';
import { useStartAdhocVisit } from '@/hooks/telesales/useTelesalesVisits';
import type { PortfolioPartner } from '@/types/telesalesAgent.types';

export const TelesalesPortfolioPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const { partners, loading, refetch } = usePortfolio(search);
    const { startAdhoc, loading: starting } = useStartAdhocVisit();
    const { sessionActive } = useSessionGate();
    const [selected, setSelected] = useState<PortfolioPartner | null>(null);

    const handleCall = useCallback(async (partner: PortfolioPartner) => {
        try {
            const visit = await startAdhoc({ partner_id: partner.id });
            navigate(`/telesales/visits/${visit.id}`, { state: { visit } });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec du démarrage de l'appel");
        }
    }, [startAdhoc, navigate]);

    // ── Left panel — data list ────────────────────────────────────────────────

    const leftContent = (
        <ListPanel
            icon={Briefcase}
            title="Mon portefeuille"
            subtitle={`${partners.length} partenaire${partners.length !== 1 ? 's' : ''}`}
            accent="blue"
            items={partners}
            loading={loading}
            emptyIcon={Briefcase}
            emptyText="Aucun partenaire assigné pour le moment"
            selectedId={selected?.id ?? null}
            getId={(p) => p.id}
            onSelect={setSelected}
            filters={
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un partenaire..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>
            }
            renderRow={(p) => (
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{p.code}</p>
                    </div>
                    <p className="shrink-0 text-xs font-bold text-emerald-600">
                        {p.credit_available.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                    </p>
                </div>
            )}
        />
    );

    // ── Center panel — detail ─────────────────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={Briefcase}
                title={selected ? selected.name : 'Mon portefeuille'}
                subtitle={selected ? selected.code : 'Partenaires assignés par votre superviseur (lecture seule)'}
                accent="blue"
            />
            <TelesalesSessionBanner />
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {!selected ? (
                    <EmptySelection icon={Briefcase} title="Sélectionnez un partenaire" hint="Cliquez sur un partenaire de la liste pour lancer un appel" />
                ) : (
                    <div className="max-w-xl space-y-6">
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                <Briefcase className="w-6 h-6 text-blue-600" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-lg font-bold text-gray-900 truncate">{selected.name}</div>
                                <div className="text-sm text-gray-400">{selected.code}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                                    <Wallet className="w-3.5 h-3.5" /> Crédit disponible
                                </div>
                                <div className="text-xl font-black text-emerald-700">
                                    {selected.credit_available.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD
                                </div>
                            </div>
                            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                                    <CalendarClock className="w-3.5 h-3.5" /> Assigné le
                                </div>
                                <div className="text-sm font-semibold text-gray-800">
                                    {new Date(selected.assigned_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </div>
                            </div>
                        </div>

                        {!sessionActive && <SessionRequiredNotice />}

                        <button
                            onClick={() => handleCall(selected)}
                            disabled={starting || !sessionActive}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50"
                        >
                            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneCall className="w-4 h-4" />}
                            Appeler ce partenaire
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    // ── Right panel — actions ─────────────────────────────────────────────────

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        { icon: PhoneCall, label: 'Appeler', variant: 'sage', onClick: () => selected && handleCall(selected), disabled: !selected || starting || !sessionActive },
                    ],
                },
                {
                    items: [
                        { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                    ],
                },
            ]}
        />
    );

    return (
        <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
    );
};

export default TelesalesPortfolioPage;
