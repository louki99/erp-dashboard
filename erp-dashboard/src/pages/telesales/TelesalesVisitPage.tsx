import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    CheckCircle2, PhoneOff, MessageSquareWarning, PhoneMissed, PhoneCall, PackageX,
    ShoppingCart, FileText, Loader2, User, RefreshCw, Phone, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { ListPanel, DetailHeader, EmptySelection } from '@/components/telesales/panels';
import { PartnerFicheCard } from '@/components/telesales/PartnerFicheCard';
import { useCompleteVisit, useVisitsHistory } from '@/hooks/telesales/useTelesalesVisits';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { TeleVisit, TeleVisitOutcome } from '@/types/telesalesAgent.types';
import { TELE_VISIT_OUTCOME_LABELS } from '@/types/telesalesAgent.types';

const OUTCOME_CONFIG: Record<TeleVisitOutcome, { icon: React.ElementType; bg: string; border: string; iconColor: string; textColor: string }> = {
    ORDER_TAKEN: { icon: CheckCircle2, bg: 'bg-emerald-50 hover:bg-emerald-100', border: 'border-emerald-100', iconColor: 'text-emerald-600', textColor: 'text-emerald-700' },
    UNAVAILABLE: { icon: PhoneOff, bg: 'bg-gray-50 hover:bg-gray-100', border: 'border-gray-200', iconColor: 'text-gray-400', textColor: 'text-gray-600' },
    COMPLAINT: { icon: MessageSquareWarning, bg: 'bg-red-50 hover:bg-red-100', border: 'border-red-100', iconColor: 'text-red-500', textColor: 'text-red-700' },
    NO_ANSWER: { icon: PhoneMissed, bg: 'bg-amber-50 hover:bg-amber-100', border: 'border-amber-100', iconColor: 'text-amber-500', textColor: 'text-amber-700' },
    BUSY: { icon: PhoneCall, bg: 'bg-rose-50 hover:bg-rose-100', border: 'border-rose-100', iconColor: 'text-rose-500', textColor: 'text-rose-700' },
    RESTOCK_NEEDED: { icon: PackageX, bg: 'bg-blue-50 hover:bg-blue-100', border: 'border-blue-100', iconColor: 'text-blue-500', textColor: 'text-blue-700' },
};

const todayIso = () => new Date().toISOString().slice(0, 10);

export const TelesalesVisitPage = () => {
    const { id } = useParams<{ id: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const visitId = Number(id);

    const incomingState = (location.state as { visit?: TeleVisit; orderId?: number } | null) ?? null;

    // Left panel: today's calls (planned + adhoc) so the agent can jump between
    // them without leaving the fiche. No dedicated GET /visits/{id} exists, so
    // this list also doubles as the lookup source when landing here directly
    // (e.g. page refresh) without the router-state fast path below.
    const { visits: todaysVisits, loading: loadingToday, refetch: refetchToday } = useVisitsHistory({ date_from: todayIso(), date_to: todayIso() });

    const [visit, setVisit] = useState<TeleVisit | null>(incomingState?.visit ?? null);
    // Set when returning from the order-taking screen (docs §5) after ORDER_TAKEN —
    // links the order to this visit's qualification automatically.
    const [linkedOrderId] = useState<number | undefined>(incomingState?.orderId);

    useEffect(() => {
        const found = todaysVisits.find((v) => v.id === visitId);
        if (found) setVisit(found);
    }, [todaysVisits, visitId]);

    const { complete, loading: completing } = useCompleteVisit();
    const { sessionActive } = useSessionGate();
    const [notes, setNotes] = useState('');
    const [pendingOutcome, setPendingOutcome] = useState<TeleVisitOutcome | null>(null);

    const handleQualify = async (outcome: TeleVisitOutcome) => {
        if (!visit) return;
        setPendingOutcome(outcome);
        try {
            const updated = await complete(visit.id, {
                outcome,
                notes: notes || undefined,
                order_id: outcome === 'ORDER_TAKEN' ? linkedOrderId : undefined,
            });
            setVisit(updated);
            toast.success(`Appel qualifié : ${TELE_VISIT_OUTCOME_LABELS[outcome]}`);
            refetchToday();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la qualification');
        } finally {
            setPendingOutcome(null);
        }
    };

    const alreadyQualified = !!visit?.outcome;

    const statusOf = (v: TeleVisit) => (v.outcome ? 'Qualifié' : v.started_at ? 'En cours' : 'En attente');
    const statusColor = (v: TeleVisit) =>
        v.outcome ? 'bg-emerald-100 text-emerald-700' : v.started_at ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';

    const goToOrder = () => {
        if (!visit) return;
        navigate('/telesales/orders/new', {
            state: { visitId: visit.id, partnerId: visit.partner_id, partnerName: visit.partner?.name, partnerCode: visit.partner?.code },
        });
    };

    const goToDevis = () => {
        if (!visit) return;
        navigate('/telesales/devis', {
            state: { openCreateForPartner: { id: visit.partner_id, name: visit.partner?.name ?? '', code: visit.partner?.code ?? '' } },
        });
    };

    // ── Left panel — data list ────────────────────────────────────────────────

    const leftContent = (
        <ListPanel
            icon={Phone}
            title="Appels du jour"
            subtitle={`${todaysVisits.length} appel${todaysVisits.length !== 1 ? 's' : ''}`}
            accent="sage"
            items={todaysVisits}
            loading={loadingToday}
            emptyIcon={Phone}
            emptyText="Aucun appel aujourd'hui"
            selectedId={visitId}
            getId={(v) => v.id}
            onSelect={(v) => navigate(`/telesales/visits/${v.id}`, { state: { visit: v } })}
            renderRow={(v) => (
                <>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
                            <Clock className="w-3.5 h-3.5 text-sage-600" />
                            {(v.scheduled_at ?? v.started_at)
                                ? new Date(v.scheduled_at ?? v.started_at!).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                                : '--:--'}
                        </span>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColor(v)}`}>
                            {statusOf(v)}
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 truncate">
                        {v.partner?.name ?? `Partenaire #${v.partner_id}`}
                    </p>
                    {v.partner?.code && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{v.partner.code}</p>
                    )}
                </>
            )}
        />
    );

    // ── Center panel — detail ─────────────────────────────────────────────────

    const detailContent = !visit ? (
        loadingToday ? (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
            </div>
        ) : (
            <EmptySelection icon={Phone} title="Sélectionnez un appel" hint="Cliquez sur un appel de la liste pour afficher la fiche" />
        )
    ) : (
        <div className="max-w-2xl space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-sage-600" />
                </div>
                <div>
                    <div className="text-lg font-bold text-gray-900">{visit.partner?.name ?? `Partenaire #${visit.partner_id}`}</div>
                    <div className="text-sm text-gray-400">{visit.partner?.code}</div>
                </div>
                {alreadyQualified && (
                    <span className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                        Qualifié — {TELE_VISIT_OUTCOME_LABELS[visit.outcome!]}
                    </span>
                )}
            </div>

            {visit.partner && <PartnerFicheCard partner={visit.partner} />}

            {!sessionActive && !alreadyQualified && <SessionRequiredNotice />}

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Notes de l'appel</label>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={alreadyQualified || !sessionActive}
                    rows={4}
                    placeholder="Points clés de la conversation..."
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
            </div>

            <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Résultat de l'appel</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(Object.keys(TELE_VISIT_OUTCOME_LABELS) as TeleVisitOutcome[]).map((outcome) => {
                        const { icon: Icon, bg, border, iconColor, textColor } = OUTCOME_CONFIG[outcome];
                        const isPending = pendingOutcome === outcome && completing;
                        return (
                            <button
                                key={outcome}
                                onClick={() => handleQualify(outcome)}
                                disabled={alreadyQualified || completing || !sessionActive}
                                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border font-semibold text-sm shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${bg} ${border} ${textColor}`}
                            >
                                {isPending ? (
                                    <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${iconColor}`} />
                                ) : (
                                    <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                )}
                                {TELE_VISIT_OUTCOME_LABELS[outcome]}
                            </button>
                        );
                    })}
                </div>
            </div>

            {visit.outcome === 'ORDER_TAKEN' && (visit.order_id || linkedOrderId) && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <div className="text-sm text-emerald-700 font-medium">
                        Commande #{visit.order_id ?? linkedOrderId} liée à cet appel.
                    </div>
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={goToOrder}
                    disabled={alreadyQualified || !sessionActive}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-white bg-emerald-800 rounded-xl shadow-sm hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <ShoppingCart className="w-4 h-4" /> Prise de commande
                </button>
                <button
                    onClick={goToDevis}
                    disabled={alreadyQualified || !sessionActive}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    <FileText className="w-4 h-4 text-gray-500" /> Créer un devis
                </button>
            </div>
        </div>
    );

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            <DetailHeader
                icon={Phone}
                title={visit ? (visit.partner?.name ?? `Partenaire #${visit.partner_id}`) : 'Fiche télé-visite'}
                subtitle={visit
                    ? [visit.partner?.code,
                       visit.scheduled_at
                           ? `Créneau ${new Date(visit.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
                           : null,
                      ].filter(Boolean).join(' · ') || undefined
                    : 'Qualification des appels du jour'}
                accent="sage"
            />
            <TelesalesSessionBanner />
            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                {detailContent}
            </div>
        </div>
    );

    // ── Right panel — actions ─────────────────────────────────────────────────

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        { icon: ShoppingCart, label: 'Prise de commande', variant: 'sage', onClick: goToOrder, disabled: !visit },
                        { icon: FileText, label: 'Créer un devis', onClick: goToDevis, disabled: !visit },
                    ],
                },
                {
                    items: [
                        { icon: RefreshCw, label: 'Rafraîchir', onClick: refetchToday },
                    ],
                },
            ]}
        />
    );

    return (
        <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
    );
};

export default TelesalesVisitPage;
