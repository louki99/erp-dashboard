import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import { DataGrid } from '@/components/common/DataGrid';
import { CheckCircle2, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PaymentTerm {
    code: string;
    name: string;
    description?: string;
}

interface PaymentTermsManagerProps {
    selectedCodes: string[];
    onSelectionChange: (codes: string[]) => void;
}

export const PaymentTermsManager = ({ selectedCodes, onSelectionChange }: PaymentTermsManagerProps) => {
    const [terms, setTerms] = useState<PaymentTerm[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadTerms = useCallback(async () => {
        setLoading(true);
        try {
            const data = await promotionsApi.getPaymentTerms();
            // Assuming the API returns an array of payment terms
            setTerms(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to load payment terms', error);
            toast.error('Échec du chargement des conditions de paiement');
            setTerms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTerms();
    }, [loadTerms]);

    const filteredTerms = terms.filter(t => 
        t.code?.toLowerCase().includes(search.toLowerCase()) ||
        t.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelection = (term: PaymentTerm) => {
        const isSelected = selectedCodes.includes(term.code);
        if (isSelected) {
            onSelectionChange(selectedCodes.filter(c => c !== term.code));
        } else {
            onSelectionChange([...selectedCodes, term.code]);
        }
    };

    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 150,
            filter: true,
        },
        { field: 'name', headerName: 'Nom', flex: 1, filter: true },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            filter: true,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            headerName: 'Sélection',
            width: 100,
            cellRenderer: (params: any) => {
                const term = params.data as PaymentTerm;
                const isSelected = selectedCodes.includes(term.code);
                return (
                    <div className="flex items-center justify-center h-full">
                        <button
                            onClick={() => handleSelection(term)}
                            className={`p-2 rounded-full transition ${
                                isSelected
                                    ? 'bg-green-100 text-green-600'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                            }`}
                            title={isSelected ? 'Désélectionner' : 'Sélectionner'}
                        >
                            <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-current' : ''}`} />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
        }
    ];

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Conditions de Paiement</h3>
                <p className="text-sm text-gray-600">
                    Sélectionnez les conditions de paiement pour lesquelles cette promotion s'applique.
                    Cliquez sur l'icône de sélection dans le tableau pour ajouter ou retirer une condition.
                </p>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par code ou nom..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
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
                        rowData={filteredTerms}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                </div>
            </div>
        </div>
    );
};

