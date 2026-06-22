import type { DispatcherOrder } from '@/types/dispatcher.types';

// Σ(quantity × unit_volume_m3 / unit_weight_kg) across a set of selected BCs — backend added
// these fields 2026-06-22 (resolved from product_logistics_profiles → product_packaging_levels).
// Most SKUs in the current catalog still have null volume/weight (data-entry gap, not a bug), so
// this tracks how many line items were skipped rather than silently treating null as zero —
// callers should show that count, not just a confident-looking percentage.
export interface MissionLoadEstimate {
  volumeM3: number;
  weightKg: number;
  itemCount: number;
  missingVolumeCount: number;
  missingWeightCount: number;
}

export const computeMissionLoad = (orders: DispatcherOrder[]): MissionLoadEstimate => {
  let volumeM3 = 0;
  let weightKg = 0;
  let itemCount = 0;
  let missingVolumeCount = 0;
  let missingWeightCount = 0;

  for (const order of orders) {
    for (const item of order.order_products ?? []) {
      itemCount += 1;
      const qty = Number(item.quantity) || 0;
      if (item.product?.unit_volume_m3 != null) {
        volumeM3 += qty * item.product.unit_volume_m3;
      } else {
        missingVolumeCount += 1;
      }
      if (item.product?.unit_weight_kg != null) {
        weightKg += qty * item.product.unit_weight_kg;
      } else {
        missingWeightCount += 1;
      }
    }
  }

  return { volumeM3, weightKg, itemCount, missingVolumeCount, missingWeightCount };
};
