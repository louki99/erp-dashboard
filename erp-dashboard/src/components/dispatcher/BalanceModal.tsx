import { useState, useEffect } from 'react';
import { X, AlertCircle, Scale } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import type { BalanceAnalysis, BalanceAdjustment, SplitStrategy } from '@/types/dispatcher.types';

interface BalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (strategy: SplitStrategy, adjustments?: BalanceAdjustment[]) => Promise<void>;
  balance: BalanceAnalysis | null;
  loading?: boolean;
}

export const BalanceModal = ({ isOpen, onClose, onSave, balance, loading = false }: BalanceModalProps) => {
  // Manual allocations: product_id -> bl_id -> new_quantity
  const [allocs, setAllocs] = useState<Record<number, Record<number, number>>>({});
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && balance) {
      const init: Record<number, Record<number, number>> = {};
      balance.products.forEach((p) => {
        init[p.product_id] = {};
        p.requesting_bls.forEach((bl) => {
          init[p.product_id][bl.bl_id] = bl.current_prepared;
        });
      });
      setAllocs(init);
      setErrors([]);
    }
  }, [isOpen, balance]);

  const setAlloc = (productId: number, blId: number, value: number) => {
    setAllocs((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], [blId]: Math.max(0, value) },
    }));
  };

  const validate = (): string[] => {
    if (!balance) return ['Aucune donnée de balance'];
    const errs: string[] = [];
    balance.products.forEach((p) => {
      const totalAlloc = Object.values(allocs[p.product_id] ?? {}).reduce((a, b) => a + b, 0);
      if (totalAlloc > p.total_prepared) {
        errs.push(`${p.product_name}: allocation totale (${totalAlloc}) > disponible (${p.total_prepared})`);
      }
    });
    return errs;
  };

  const handleManual = async () => {
    const validationErrors = validate();
    if (validationErrors.length > 0) { setErrors(validationErrors); return; }
    if (!balance) return;

    const adjustments: BalanceAdjustment[] = [];
    balance.products.forEach((p) => {
      p.requesting_bls.forEach((bl) => {
        const qty = allocs[p.product_id]?.[bl.bl_id];
        if (qty !== undefined) {
          adjustments.push({ bl_item_id: bl.bl_id, new_quantity: qty });
        }
      });
    });
    await onSave('manual', adjustments);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rééquilibrage manuel des ruptures" size="xl">
      <div className="p-5 space-y-5">
        {!balance || balance.products.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucune rupture à équilibrer</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                Ajustez manuellement les quantités par BL. Le total par produit ne peut pas dépasser le stock préparé.
              </span>
            </div>

            {balance.products.map((product) => {
              const totalAlloc = Object.values(allocs[product.product_id] ?? {}).reduce((a, b) => a + b, 0);
              const overAllocated = totalAlloc > product.total_prepared;
              return (
                <div key={product.product_id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{product.product_name}</div>
                      <div className="text-xs text-gray-500">{product.sku}</div>
                    </div>
                    <div className={`text-xs font-bold px-2 py-1 rounded ${overAllocated ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {totalAlloc} / {product.total_prepared} alloués
                    </div>
                  </div>
                  <div className="divide-y divide-gray-50">
                    <div className="grid grid-cols-4 px-4 py-1.5 bg-white text-xs text-gray-500 font-medium">
                      <div className="col-span-2">BL / Partenaire</div>
                      <div className="text-center">Demandé</div>
                      <div className="text-center">Nouvelle qté</div>
                    </div>
                    {product.requesting_bls.map((bl) => (
                      <div key={bl.bl_id} className="grid grid-cols-4 px-4 py-2.5 items-center">
                        <div className="col-span-2 min-w-0">
                          <div className="text-xs font-mono font-semibold text-gray-800 truncate">{bl.delivery_number}</div>
                          <div className="text-xs text-gray-400 truncate">{bl.partner_name}</div>
                        </div>
                        <div className="text-center text-xs text-gray-600">{bl.requested}</div>
                        <div className="flex justify-center">
                          <input
                            type="number"
                            min={0}
                            max={product.total_prepared}
                            value={allocs[product.product_id]?.[bl.bl_id] ?? 0}
                            onChange={(e) => setAlloc(product.product_id, bl.bl_id, parseInt(e.target.value) || 0)}
                            className="w-20 text-center text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <ul className="text-xs text-red-700 space-y-0.5">
                    {errors.map((e, i) => <li key={i}>• {e}</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleManual}
                disabled={loading}
                className="flex-1 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
