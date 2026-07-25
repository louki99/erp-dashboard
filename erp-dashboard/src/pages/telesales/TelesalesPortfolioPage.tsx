import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import { Search, PhoneCall, Briefcase, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { usePortfolio } from '@/hooks/telesales/useTelesalesPortfolio';
import { useStartAdhocVisit } from '@/hooks/telesales/useTelesalesVisits';
import type { PortfolioPartner } from '@/types/telesalesAgent.types';

export const TelesalesPortfolioPage = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const { partners, loading, refetch } = usePortfolio(search);
    const { startAdhoc, loading: starting } = useStartAdhocVisit();

    const handleCall = useCallback(async (partner: PortfolioPartner) => {
        try {
            const visit = await startAdhoc({ partner_id: partner.id });
            navigate(`/telesales/visits/${visit.id}`, { state: { visit } });
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec du démarrage de l'appel");
        }
    }, [startAdhoc, navigate]);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'name', headerName: 'Partenaire', flex: 1, minWidth: 180 },
            { field: 'code', headerName: 'Code', width: 130 },
            {
                field: 'credit_available', headerName: 'Crédit disponible', width: 160,
                valueFormatter: (p: any) => `${Number(p.value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`,
            },
            {
                field: 'assigned_at', headerName: 'Assigné le', width: 140,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '-',
            },
            {
                headerName: '', width: 130, sortable: false, filter: false,
                cellRenderer: (p: any) => (
                    <button
                        onClick={() => handleCall(p.data)}
                        disabled={starting}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-40"
                    >
                        <PhoneCall className="w-3 h-3" /> Appeler
                    </button>
                ),
            },
        ],
        [starting, handleCall]
    );

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <TelesalesSessionBanner />
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Mon portefeuille</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                    Partenaires qui vous ont été assignés par votre superviseur (lecture seule)
                </p>
                <div className="relative mt-4 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un partenaire..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                    </div>
                ) : partners.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun partenaire assigné pour le moment</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid rowData={partners} columnDefs={columnDefs} loading={loading} />
                )}
            </div>
        </div>
    );

    return (
        <MasterLayout
            mainContent={mainContent}
            rightContent={
                <ActionPanel groups={[{ items: [{ icon: Search, label: 'Rafraîchir', onClick: refetch }] }]} />
            }
        />
    );
};

export default TelesalesPortfolioPage;
