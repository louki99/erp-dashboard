import type { DispatcherOrder } from '@/types/dispatcher.types';

// Capacity estimation for a set of selected BCs — uses pre-computed `total_weight_kg` /
// `total_volume_m3` on the order header (written by `CalculateDocumentPhysicalMetrics` queued
// job, §20.2/§20.4 of 15-dispatcher.md). A flat SUM over order headers replaces the old live
// walk of order → lines → product → logistics_profile → packaging_levels (too slow at 50+
// orders and caused duplicate API calls).
//
// `dataIncomplete` is true when any selected order has `physical_metrics_calculated_at IS NULL`
// (job hasn't run yet — still queued). That order contributes 0 to both sums.
// The UI must surface this as a warning rather than showing a misleadingly-low percentage.
export interface MissionLoadEstimate {
  volumeM3: number;
  weightKg: number;
  orderCount: number;
  dataIncomplete: boolean;
  incompleteOrderIds: number[];
}

export const computeMissionLoad = (orders: DispatcherOrder[]): MissionLoadEstimate => {
  let volumeM3 = 0;
  let weightKg = 0;
  let dataIncomplete = false;
  const incompleteOrderIds: number[] = [];

  for (const order of orders) {
    if (order.physical_metrics_calculated_at == null) {
      dataIncomplete = true;
      incompleteOrderIds.push(order.id);
    } else {
      volumeM3 += Number(order.total_volume_m3) || 0;
      weightKg  += Number(order.total_weight_kg)  || 0;
    }
  }

  return { volumeM3, weightKg, orderCount: orders.length, dataIncomplete, incompleteOrderIds };
};
