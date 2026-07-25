import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import { CalendarPlus, Phone, PhoneCall, Loader2, CalendarDays, RefreshCw, ArrowRight, Clock, StickyNote, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal } from '@/components/common/Modal';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { usePlanning, useScheduleVisit, useStartAdhocVisit, useStartVisit } from '@/hooks/telesales/useTelesalesVisits';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import type { TeleVisit } from '@/types/telesalesAgent.types';

const todayIso = () => new Date().toISOString().slice(0, 10);

export const TelesalesPlanningPage = () => {
    const navigate = useNavigate();
    const [date, setDate] = useState(todayIso());
    const { visits, loading, refetch } = usePlanning(date);
    const [selected, setSelected] = useState<TeleVisit | null>(null);

    const { schedule, loading: scheduling } = useScheduleVisit();
    const { startAdhoc, loading: startingAdhoc } = useStartAdhocVisit();
    const { start: startPlanned, loading: startingPlanned } = useStartVisit();
    const { sessionActive } = useSessionGate();

    // Plan a call
    const [showPlanModal, setShowPlanModal] = useState(false);
    const [planPartner, setPlanPartner] = useState<PartnerPickerOption | null>(null);
    const [planDate, setPlanDate] = useState('');
    const [planTime, setPlanTime] = useState('');
    const [planNotes, setPlanNotes] = useState('');

    // Adhoc call
    const [showAdhocModal, setShowAdhocModal] = useState(false);
    const [adhocPartner, setAdhocPartner] = useState<PartnerPickerOption | null>(null);

    const handlePlan = async () => {
        if (!planPartner || !planDate || !planTime) {
            toast.error('Partenaire, date et heure sont requis');
            return;
        }
        try {
            await schedule({
                partner_id: planPartner.id,
                scheduled_at: `${planDate} ${planTime}:00`,
                notes: planNotes || undefined,
            });
            toast.success('Appel planifié');
            setPlanPartner(null);
            setPlanDate('');
            setPlanTime('');
            setPlanNotes('');
            setShowPlanModal(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la planification');
        }
    };

    const handleStartAdhoc = async () => {
        if (!adhocPartner) {
            toast.error('Sélectionner un partenaire');
            return;
        }
        try {
            const visit = await startAdhoc({ partner_id: adhocPartner.id });
            setAdhocPartner(null);
            setShowAdhocModal(false);
            navigate(`/telesales/visits/${visit.id}`, { state: { visit } });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec du démarrage de l'appel");
        }
    };

    // Already-started visits (`started_at` set) resume straight into the fiche —
    // no need to hit /start again, that would 422 ("déjà démarrée").
    const handleCall = useCallback(async (visit: TeleVisit) => {
        if (visit.started_at) {
            navigate(`/telesales/visits/${visit.id}`, { state: { visit } });
            return;
        }
        try {
            const started = await startPlanned(visit.id);
            navigate(`/telesales/visits/${started.id}`, { state: { visit: started } });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec du démarrage de l'appel");
        }
    }, [startPlanned, navigate]);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            {
                field: 'scheduled_at', headerName: 'Heure', width: 90,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '-',
            },
            {
                field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 150,
                valueGetter: (p: any) => p.data?.partner?.name ?? `#${p.data?.partner_id}`,
            },
            {
                field: 'started_at', headerName: 'Statut', width: 100, sortable: false,
                cellRenderer: (p: any) => (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${p.value ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {p.value ? 'En cours' : 'En attente'}
                    </span>
                ),
            },
        ],
        []
    );

    const detailContent = selected ? (
        <div className="max-w-xl space-y-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-sage-100 flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-sage-600" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="text-lg font-bold text-gray-900 truncate">{selected.partner?.name ?? `Partenaire #${selected.partner_id}`}</div>
                    <div className="text-sm text-gray-400">{selected.partner?.code}</div>
                </div>
                <span className={`shrink-0 inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${selected.started_at ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                    {selected.started_at ? 'En cours' : 'En attente'}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                        <Clock className="w-3.5 h-3.5" /> Créneau
                    </div>
                    <div className="text-sm font-semibold text-gray-800">
                        {selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase mb-1">
                        <StickyNote className="w-3.5 h-3.5" /> Notes
                    </div>
                    <div className="text-sm font-semibold text-gray-800 truncate">{selected.notes || '-'}</div>
                </div>
            </div>

            {!sessionActive && <SessionRequiredNotice />}

            <button
                onClick={() => handleCall(selected)}
                disabled={startingPlanned || !sessionActive}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50"
            >
                {startingPlanned ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
                {selected.started_at ? 'Continuer vers la fiche' : 'Appeler'}
                <ArrowRight className="w-4 h-4" />
            </button>
        </div>
    ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
                <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium">Sélectionnez un appel</p>
                <p className="text-xs text-gray-400 mt-1">Cliquez sur une ligne pour afficher les détails</p>
            </div>
        </div>
    );

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <TelesalesSessionBanner />
            <div className="flex-1 flex items-center justify-center overflow-y-auto p-6">
                {detailContent}
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center justify-between">
                            <h1 className="text-sm font-semibold text-gray-900">Semainier / Planning</h1>
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{visits.length}</span>
                        </div>
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500 focus:border-transparent bg-gray-50"
                            />
                        </div>
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                    </div>
                                ) : visits.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-gray-400 text-xs text-center px-4">
                                        Aucun appel planifié pour cette date
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={visits}
                                        columnDefs={columnDefs}
                                        loading={loading}
                                        rowSelection="single"
                                        onRowClicked={(e: any) => setSelected(e.data)}
                                        getRowClass={(p: any) => (selected && p.data?.id === selected.id ? 'bg-sage-50' : '')}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                }
                mainContent={mainContent}
                rightContent={
                    <ActionPanel
                        groups={[
                            {
                                items: [
                                    { icon: CalendarPlus, label: 'Planifier un appel', variant: 'sage', onClick: () => setShowPlanModal(true) },
                                    { icon: PhoneCall, label: 'Appel libre', onClick: () => setShowAdhocModal(true) },
                                    { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                                ],
                            },
                        ]}
                    />
                }
            />

            <Modal isOpen={showPlanModal} onClose={() => setShowPlanModal(false)} title="Planifier un appel" size="md">
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                        <PartnerPicker value={planPartner} onChange={setPlanPartner} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Date</label>
                            <input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Heure</label>
                            <input type="time" value={planTime} onChange={(e) => setPlanTime(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Notes (optionnel)</label>
                        <textarea value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowPlanModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button onClick={handlePlan} disabled={scheduling}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50">
                            {scheduling && <Loader2 className="w-4 h-4 animate-spin" />}
                            Planifier
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showAdhocModal} onClose={() => setShowAdhocModal(false)} title="Appel libre" size="md">
                <div className="p-5 space-y-4">
                    {!sessionActive && <SessionRequiredNotice />}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                        <PartnerPicker value={adhocPartner} onChange={setAdhocPartner} />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowAdhocModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button onClick={handleStartAdhoc} disabled={startingAdhoc || !sessionActive}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50">
                            {startingAdhoc && <Loader2 className="w-4 h-4 animate-spin" />}
                            Démarrer l'appel
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default TelesalesPlanningPage;
