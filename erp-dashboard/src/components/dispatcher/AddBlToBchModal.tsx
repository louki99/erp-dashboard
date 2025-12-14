import { useState, useEffect, useMemo } from 'react';
import { Loader2, Search, Package } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { Modal } from '@/components/common/Modal';
import { DataGrid } from '@/components/common/DataGrid';
import { useDispatcherBonLivraisonsList } from '@/hooks/dispatcher';

interface AddBlToBchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (blIds: number[]) => void;
    loading?: boolean;
    existingBlIds?: number[];
}

export const AddBlToBchModal = ({ isOpen, onClose, onConfirm, loading = false, existingBlIds = [] }: AddBlToBchModalProps) => {
    const [selectedBls, setSelectedBls] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        console.log('AddBlToBchModal isOpen changed:', isOpen);
    }, [isOpen]);

    const { data, loading: blsLoading } = useDispatcherBonLivraisonsList({
        status: 'pending',
        search: searchTerm,
    });

    const bonLivraisons = (data as any)?.bonLivraisons?.data || [];

    const availableBls = useMemo(() => {
        return bonLivraisons.filter((bl: any) => !existingBlIds.includes(bl.id));
    }, [bonLivraisons, existingBlIds]);

    const columnDefs = useMemo<ColDef[]>((() => [
        {
            headerName: '',
            field: 'id',
            width: 50,
            checkboxSelection: true,
            headerCheckboxSelection: true,
        },
        { field: 'bl_number', headerName: 'BL', width: 200 },
        { field: 'client_name', headerName: 'Client', flex: 1 },
        {
            field: 'total_amount',
            headerName: 'Montant',
            width: 130,
            valueFormatter: (params: any) => `${parseFloat(params.value || 0).toLocaleString()} Dh`
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 120,
            valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-'
        },
    ]), []);

    const handleConfirm = () => {
        if (selectedBls.length === 0) return;
        const blIds = selectedBls.map(bl => bl.id);
        onConfirm(blIds);
    };

    useEffect(() => {
        if (!isOpen) {
            setSelectedBls([]);
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Ajouter des BLs au BCH" size="xl">
            <div className="p-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Rechercher un BL..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>

                {blsLoading ? (
                    <div className="flex items-center justify-center py-12 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Chargement des BLs...
                    </div>
                ) : availableBls.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <Package className="w-12 h-12 mb-3" />
                        <p className="text-sm">Aucun BL disponible</p>
                    </div>
                ) : (
                    <div className="h-96 border border-gray-200 rounded-lg">
                        <DataGrid
                            rowData={availableBls}
                            columnDefs={columnDefs}
                            loading={blsLoading}
                            onRowSelected={(rows) => setSelectedBls(rows)}
                            rowSelection="multiple"
                        />
                    </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                        {selectedBls.length > 0 && (
                            <span className="font-medium text-blue-600">
                                {selectedBls.length} BL(s) sélectionné(s)
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Annuler
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={loading || selectedBls.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                    Ajout...
                                </>
                            ) : (
                                `Ajouter ${selectedBls.length > 0 ? `(${selectedBls.length})` : ''}`
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};
