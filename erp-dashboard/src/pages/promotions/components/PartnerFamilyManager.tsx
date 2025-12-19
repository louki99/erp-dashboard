import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { PartnerFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Users, Search, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PartnerFamilyManagementDrawer } from './PartnerFamilyManagementDrawer';

interface PartnerFamilyManagerProps {
    selectedCodes: string[];
    onSelectionChange: (codes: string[]) => void;
}

export const PartnerFamilyManager = ({ selectedCodes, onSelectionChange }: PartnerFamilyManagerProps) => {
    const [families, setFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isManagementDrawerOpen, setIsManagementDrawerOpen] = useState(false);

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const response = await promotionsApi.getPartnerFamilies();
            setFamilies(response.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load partner families', error);
            toast.error('Échec du chargement des familles de partenaires');
            setFamilies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadFamilies();
    }, [loadFamilies]);

    const filteredFamilies = families.filter(f => 
        f.code?.toLowerCase().includes(search.toLowerCase()) ||
        f.name?.toLowerCase().includes(search.toLowerCase())
    );


    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 150,
            filter: true,
            checkboxSelection: true,
            headerCheckboxSelection: true,
        },
        { field: 'name', headerName: 'Nom', flex: 1, filter: true },
        {
            field: 'partner_condition',
            headerName: 'Condition',
            flex: 1,
            filter: true,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            field: 'partners_count',
            headerName: 'Partenaires',
            width: 120,
            valueFormatter: (params: any) => params.value || 0
        }
    ];

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        Familles de Partenaires
                    </h3>
                    <button
                        type="button"
                        onClick={() => setIsManagementDrawerOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                    >
                        <Settings className="w-4 h-4" />
                        Gérer les Familles
                    </button>
                </div>
                <p className="text-sm text-gray-600">
                    Sélectionnez les familles de partenaires à cibler pour cette promotion.
                    Pour créer ou modifier des familles, utilisez la page de gestion dédiée.
                </p>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par code ou nom..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-gray-600">
                        {selectedCodes.length} sélectionnée(s)
                    </div>
                </div>

                <div className="h-96">
                    <DataGrid
                        rowData={filteredFamilies}
                        columnDefs={columnDefs}
                        loading={loading}
                        rowSelection="multiple"
                        onSelectionChanged={(rows) => {
                            const codes = rows.map((r: PartnerFamily) => r.code);
                            onSelectionChange(codes);
                        }}
                        defaultSelectedIds={(row: PartnerFamily) => selectedCodes.includes(row.code || '')}
                    />
                </div>
            </div>

            <PartnerFamilyManagementDrawer
                isOpen={isManagementDrawerOpen}
                onClose={() => setIsManagementDrawerOpen(false)}
                onFamiliesUpdated={loadFamilies}
            />
        </div>
    );
};

