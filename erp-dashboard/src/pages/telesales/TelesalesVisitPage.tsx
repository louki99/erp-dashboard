import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    CheckCircle2, PhoneOff, MessageSquareWarning, PhoneMissed, PhoneCall, PackageX,
    ShoppingCart, FileText, Loader2, User, RefreshCw, Phone, Clock, CalendarDays,
    StickyNote, AlertCircle, CheckCircle,
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

const OUTCOME_CONFIG: Record<TeleVisitOutcome, { icon: React.ElementType; ring: string; iconBg: string; iconColor: string; textColor: string }> = {
    ORDER_TAKEN: { icon: CheckCircle2, ring: 'ring-emerald-200 hover:ring-emerald-300', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', textColor: 'text-emerald-700' },
    UNAVAILABLE: { icon: PhoneOff, ring: 'ring-gray-200 hover:ring-gray-300', iconBg: 'bg-gray-100', iconColor: 'text-gray-500', textColor: 'text-gray-700' },
    COMPLAINT: { icon: MessageSquareWarning, ring: 'ring-red-200 hover:ring-red-300', iconBg: 'bg-red-50', iconColor: 'text-red-500', textColor: 'text-red-700' },
    NO_ANSWER: { icon: PhoneMissed, ring: 'ring-amber-200 hover:ring-amber-300', iconBg: 'bg-amber-50', iconColor: 'text-amber-500', textColor: 'text-amber-700' },
    BUSY: { icon: PhoneCall, ring: 'ring-rose-200 hover:ring-rose-300', iconBg: 'bg-rose-50', iconColor: 'text-rose-500', textColor: 'text-rose-700' },
    RESTOCK_NEEDED: { icon: PackageX, ring: 'ring-blue-200 hover:ring-blue-300', iconBg: 'bg-blue-50', iconColor: 'text-blue-500', textColor: 'text-blue-700' },
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
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err
                ? (err.response as { data?: { message?: string } })?.data?.message
                : undefined;
            toast.error(message || 'Échec de la qualification');
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
        <div className="max-w-3xl space-y-6">
            {/* Partner status header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-sage-50 flex items-center justify-center shrink-0">
                            <User className="w-6 h-6 text-sage-600" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">{visit.partner?.name ?? `Partenaire #${visit.partner_id}`}</div>
                            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
                                <span>{visit.partner?.code}</span>
                                {visit.scheduled_at && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <span className="inline-flex items-center gap-1">
                                            <CalendarDays className="w-3.5 h-3.5" />
                                            {new Date(visit.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div>
                        {alreadyQualified ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                <CheckCircle className="w-3.5 h-3.5" />
                                Qualifié · {TELE_VISIT_OUTCOME_LABELS[visit.outcome!]}
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700">
                                <Clock className="w-3.5 h-3.5" />
                                En attente de qualification
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {visit.partner && <PartnerFicheCard partner={visit.partner} />}

            {!sessionActive && !alreadyQualified && <SessionRequiredNotice className="rounded-xl px-4 py-3" />}

            {/* Notes */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3">
                    <StickyNote className="w-4 h-4 text-sage-600" />
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Notes de l'appel</label>
                </div>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    disabled={alreadyQualified || !sessionActive}
                    rows={4}
                    placeholder="Points clés de la conversation, demandes particulières, relances..."
                    className="w-full px-3.5 py-3 text-sm text-gray-700 bg-gray-50/50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-500 focus:bg-white transition-all disabled:bg-gray-100 disabled:text-gray-400 resize-none"
                />
            </div>

            {/* Outcome */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-sage-600" />
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Résultat de l'appel</label>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(Object.keys(TELE_VISIT_OUTCOME_LABELS) as TeleVisitOutcome[]).map((outcome) => {
                        const { icon: Icon, ring, iconBg, iconColor, textColor } = OUTCOME_CONFIG[outcome];
                        const isPending = pendingOutcome === outcome && completing;
                        const isSelected = visit?.outcome === outcome;
                        return (
                            <button
                                key={outcome}
                                onClick={() => handleQualify(outcome)}
                                disabled={alreadyQualified || completing || !sessionActive}
                                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border font-semibold text-sm shadow-sm transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                                    isSelected
                                        ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200'
                                        : `bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200 ring-1 ring-transparent ${ring}`
                                }`}
                            >
                                <span className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                                    {isPending ? (
                                        <Loader2 className={`w-4 h-4 shrink-0 animate-spin ${iconColor}`} />
                                    ) : (
                                        <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                                    )}
                                </span>
                                <span className={`${isSelected ? 'text-emerald-700' : textColor}`}>
                                    {TELE_VISIT_OUTCOME_LABELS[outcome]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {visit.outcome === 'ORDER_TAKEN' && (visit.order_id || linkedOrderId) && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <div className="text-sm font-bold text-emerald-800">Commande liée à cet appel</div>
                        <div className="text-xs text-emerald-600/80">Commande #{visit.order_id ?? linkedOrderId}</div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                    onClick={goToOrder}
                    disabled={alreadyQualified || !sessionActive}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-white bg-emerald-700 rounded-xl shadow-sm hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <ShoppingCart className="w-4 h-4" /> Prise de commande
                </button>
                <button
                    onClick={goToDevis}
                    disabled={alreadyQualified || !sessionActive}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
