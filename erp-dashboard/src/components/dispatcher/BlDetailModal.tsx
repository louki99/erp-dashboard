import { useEffect, useState } from 'react';
import { Loader2, Package, FileText, User, ChevronDown, ChevronUp } from 'lucide-react';

import { Modal } from '@/components/common/Modal';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DeliveryNote, DispatcherOrder, BlStatus } from '@/types/dispatcher.types';

const BL_STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', confirmed: 'Confirmé', batched: 'En lot',
  submitted_to_magasinier: 'Au magasinier', in_preparation: 'En préparation',
  ready: 'Prêt', loaded: 'Chargé', in_transit: 'En transit',
  delivered: 'Livré', partially_delivered: 'Livraison partielle',
  returned: 'Retourné', cancelled: 'Annulé',
};

// Detail view for a BL, reachable from the mission workspace's BL rows — shows the BL's own
// items, plus the linked BC (order) with an on-demand "full BC" expand (order detail is fetched
// lazily, not by default, since most of the time the BL summary already has what's needed).
export const BlDetailModal = ({ blId, onClose }: { blId: number | null; onClose: () => void }) => {
  const [bl, setBl] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFullOrder, setShowFullOrder] = useState(false);
  const [order, setOrder] = useState<DispatcherOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  useEffect(() => {
    if (!blId) { setBl(null); setShowFullOrder(false); setOrder(null); return; }
    setLoading(true);
    dispatcherApi.bonLivraisons.getById(blId)
      .then(setBl)
      .catch(() => setBl(null))
      .finally(() => setLoading(false));
  }, [blId]);

  const handleExpandOrder = () => {
    setShowFullOrder((v) => !v);
    if (!order && bl?.order?.id) {
      setLoadingOrder(true);
      dispatcherApi.orders.getById(bl.order.id)
        .then(setOrder)
        .catch(() => setOrder(null))
        .finally(() => setLoadingOrder(false));
    }
  };

  return (
    <Modal isOpen={blId != null} onClose={onClose} title={bl?.delivery_number ?? 'Détail BL'} size="lg">
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : !bl ? (
          <p className="text-sm text-gray-400 text-center py-8">BL introuvable</p>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                {BL_STATUS_LABEL[bl.status as BlStatus] ?? bl.status}
              </span>
              <span className="text-sm text-gray-500">{bl.partner.name}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-xs text-gray-500">Montant total</div>
                <div className="font-semibold text-gray-900">{Number(bl.total_amount).toLocaleString('fr-MA')} Dh</div>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                <div className="text-xs text-gray-500">Date livraison</div>
                <div className="font-semibold text-gray-900">{bl.delivery_date ?? '—'}</div>
              </div>
            </div>

            {bl.notes && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-sm text-amber-800">{bl.notes}</div>
            )}

            {/* BL items */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5"><Package size={12} /> Lignes BL ({bl.items?.length ?? 0})</h4>
              {bl.items && bl.items.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-100 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-600">Produit</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Qté</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">Alloué</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-600">P.U</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {bl.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">{item.product?.name ?? `#${item.product_id}`}</td>
                          <td className="px-3 py-2 text-right">{item.ordered_quantity ?? item.quantity}</td>
                          <td className="px-3 py-2 text-right">{item.allocated_quantity ?? item.allocated_qty}</td>
                          <td className="px-3 py-2 text-right">{Number(item.unit_price).toLocaleString()} Dh</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-gray-400">Aucune ligne</p>
              )}
            </div>

            {/* Linked BC */}
            {bl.order && (
              <div>
                <button
                  onClick={handleExpandOrder}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-colors"
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-indigo-800">
                    <FileText size={14} /> BC {bl.order.order_code} ({bl.order.bc_status})
                  </span>
                  {showFullOrder ? <ChevronUp size={14} className="text-indigo-500" /> : <ChevronDown size={14} className="text-indigo-500" />}
                </button>

                {showFullOrder && (
                  <div className="mt-2 p-3 rounded-lg border border-gray-200 bg-white">
                    {loadingOrder ? (
                      <div className="flex items-center justify-center py-6 text-gray-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                    ) : !order ? (
                      <p className="text-xs text-gray-400 text-center py-4">BC introuvable</p>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div><span className="text-gray-500">Montant total: </span><strong>{Number(order.total_amount).toLocaleString('fr-MA')} Dh</strong></div>
                          <div><span className="text-gray-500">Date commande: </span><strong>{order.order_date ?? '—'}</strong></div>
                          <div><span className="text-gray-500">Branche: </span><strong>{order.branch_code ?? '—'}</strong></div>
                          {order.salesperson_data?.salesperson?.name && (
                            <div className="flex items-center gap-1"><User size={11} className="text-gray-400" /><strong>{order.salesperson_data.salesperson.name}</strong></div>
                          )}
                        </div>
                        {order.order_products && order.order_products.length > 0 && (
                          <table className="min-w-full divide-y divide-gray-100 text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Produit</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-gray-600">Qté</th>
                                <th className="px-2 py-1.5 text-right font-semibold text-gray-600">P.U</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {order.order_products.map((p) => (
                                <tr key={p.id}>
                                  <td className="px-2 py-1.5">{p.product?.name ?? `#${p.product_id}`}</td>
                                  <td className="px-2 py-1.5 text-right">{p.quantity}</td>
                                  <td className="px-2 py-1.5 text-right">{Number(p.unit_price).toLocaleString()} Dh</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default BlDetailModal;
