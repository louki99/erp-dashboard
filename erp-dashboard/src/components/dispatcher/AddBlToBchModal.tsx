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
  bchId?: number;
  loading?: boolean;
  existingBlIds?: number[];
}

export const AddBlToBchModal = ({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  existingBlIds = [],
}: AddBlToBchModalProps) => {
  const [selectedBls, setSelectedBls] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, loading: blsLoading } = useDispatcherBonLivraisonsList({
    status: 'confirmed',
    search: searchTerm || undefined,
  });

  const bonLivraisons = data?.data ?? [];

  const availableBls = useMemo(
    () => bonLivraisons.filter((bl) => !existingBlIds.includes(bl.id)),
    [bonLivraisons, existingBlIds],
  );

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: '',
      field: 'id',
      width: 50,
      checkboxSelection: true,
      headerCheckboxSelection: true,
    },
    {
      field: 'delivery_number',
      headerName: 'N° BL',
      width: 200,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    { field: 'partner.name', headerName: 'Partenaire', flex: 1 },
    {
      field: 'total_amount',
      headerName: 'Montant',
      width: 130,
      valueFormatter: (p: any) => p.value ? `${Number(p.value).toLocaleString('fr-MA')} Dh` : '—',
    },
    {
      field: 'delivery_date',
      headerName: 'Livraison',
      width: 110,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
  ], []);

  const handleConfirm = () => {
    if (selectedBls.length === 0) return;
    onConfirm(selectedBls.map((bl) => bl.id));
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedBls([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter des BLs confirmés au BCH" size="xl">
      <div className="p-5 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Rechercher BL, partenaire…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
          />
        </div>

        {blsLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement des BLs…
          </div>
        ) : availableBls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Aucun BL confirmé disponible</p>
            <p className="text-xs mt-1">Les BLs doivent être confirmés avant d'être ajoutés</p>
          </div>
        ) : (
          <div className="h-80 border border-gray-200 rounded-lg">
            <DataGrid
              rowData={availableBls}
              columnDefs={columnDefs}
              loading={false}
              onRowSelected={(rows: any) => setSelectedBls(Array.isArray(rows) ? rows : [rows])}
              rowSelection="multiple"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="text-sm text-gray-500">
            {selectedBls.length > 0 ? (
              <span className="font-semibold text-blue-600">{selectedBls.length} BL(s) sélectionné(s)</span>
            ) : (
              'Sélectionnez un ou plusieurs BLs'
            )}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading || selectedBls.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Ajout…' : `Ajouter${selectedBls.length > 0 ? ` (${selectedBls.length})` : ''}`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
