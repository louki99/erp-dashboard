import React, { useState } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { EntityRecordExample } from '@/components/layout/EntityRecordExample';

// Mock Data for Partners
const MOCK_PARTNERS = [
    { code: 'CUST-00921', name: 'TechCorp Inc.', status: 'Actif', currency: 'EUR - Euro', rep: 'Jean Dupont', sector: 'NORD-EST', city: 'Paris' },
    { code: 'CUST-00922', name: 'Global Logistics', status: 'Actif', currency: 'USD - Dollar', rep: 'Marie Curie', sector: 'SUD-OUEST', city: 'Lyon' },
    { code: 'CUST-00923', name: 'Alpha Solutions', status: 'Inactif', currency: 'GBP - Pound', rep: 'Pierre Martin', sector: 'EST', city: 'Strasbourg' },
    { code: 'CUST-00924', name: 'Omega Retail', status: 'Actif', currency: 'EUR - Euro', rep: 'Jean Dupont', sector: 'NORD', city: 'Lille' },
    { code: 'CUST-00925', name: 'Delta Force', status: 'En attente', currency: 'USD - Dollar', rep: 'Sarah Connor', sector: 'OUEST', city: 'Bordeaux' },
    { code: 'CUST-00926', name: 'Echo Services', status: 'Actif', currency: 'EUR - Euro', rep: 'Luc Besson', sector: 'SUD', city: 'Marseille' },
    { code: 'CUST-00927', name: 'Foxtrot Systems', status: 'Bloqué', currency: 'JPY - Yen', rep: 'Jean Dupont', sector: 'PARIS', city: 'Paris' },
    { code: 'CUST-00928', name: 'Golf Distribution', status: 'Actif', currency: 'EUR - Euro', rep: 'Tiger Woods', sector: 'SUD-EST', city: 'Nice' },
];

export const PartnerPage: React.FC = () => {
    const [selectedPartner, setSelectedPartner] = useState<any>(MOCK_PARTNERS[0]);

    const columnDefs = [
        { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
        { field: 'name', headerName: 'Raison Sociale', width: 200 },
        { field: 'city', headerName: 'Ville', width: 120 },
        {
            field: 'status', headerName: 'Statut', width: 100, cellRenderer: (params: any) => {
                const colors: any = {
                    'Actif': 'text-green-600 bg-green-50',
                    'Inactif': 'text-red-600 bg-red-50',
                    'En attente': 'text-orange-600 bg-orange-50',
                    'Bloqué': 'text-gray-600 bg-gray-50'
                };
                return <span className={`px-2 py-0.5 rounded-full text-xs font-medium border border-transparent ${colors[params.value] || 'text-gray-600 bg-gray-50'}`}>{params.value}</span>;
            }
        },
        { field: 'rep', headerName: 'Représentant', width: 150 }
    ];

    const LeftPane = (
        <div className="flex flex-col h-full">
            <div className="p-2 border-b border-gray-200 bg-gray-50/50 flex justify-between items-center text-xs">
                <span className="font-semibold text-gray-700">Tous les partenaires</span>
                <span className="text-gray-500">{MOCK_PARTNERS.length} enregistrements</span>
            </div>
            <div className="flex-1">
                <DataGrid rowData={MOCK_PARTNERS} columnDefs={columnDefs} onRowSelected={setSelectedPartner} />
            </div>
        </div>
    );

    const MainPane = (
        <div className="h-full">
            {selectedPartner ? (
                <EntityRecordExample data={selectedPartner} />
            ) : (
                <div className="flex h-full items-center justify-center text-gray-400">Sélectionnez un partenaire</div>
            )}
        </div>
    );

    return (
        <MasterLayout
            leftContent={LeftPane}
            mainContent={MainPane}
            rightContent={<ActionPanel />}
        />
    );
};
