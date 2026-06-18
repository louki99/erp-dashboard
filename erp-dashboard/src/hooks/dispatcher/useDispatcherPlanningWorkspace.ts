import { useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { ApiSuccessResponse, CreateBatchPayload } from '@/types/dispatcher.types';

export const useCreateDeliveryOrderDecision = () => {
  const [loading, setLoading] = useState(false);

  const create = async (payload: {
    order_ids: number[];
    // Optional: omitted when the current user's branch can't be resolved client-side — the
    // backend can derive it from the orders' own branch when not supplied.
    branch_code?: string;
    delivery_zone?: string;
    auto_allocate?: boolean;
    allocation_strategy?: string;
  }) => {
    setLoading(true);
    try {
      return await dispatcherApi.deliveryOrders.executeDecision(0, 'create_delivery_order', payload);
    } finally {
      setLoading(false);
    }
  };

  return { create, loading };
};

export const useCreateBatch = () => {
  const [loading, setLoading] = useState(false);

  const createBatch = async (payload: CreateBatchPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try {
      return await dispatcherApi.batches.executeDecision(0, 'create_batch', payload);
    } finally {
      setLoading(false);
    }
  };

  return { createBatch, loading };
};

export const useSealBatch = () => {
  const [loading, setLoading] = useState(false);

  const sealBatch = async (payload: CreateBatchPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try {
      const created = await dispatcherApi.batches.executeDecision(0, 'create_batch', payload);
      const newBatchId = (created.data as { id?: number; batch?: { id?: number } } | undefined)?.id
        ?? (created.data as { batch?: { id?: number } } | undefined)?.batch?.id;
      if (!newBatchId) {
        throw new Error('LOT créé mais id introuvable dans la réponse — impossible de sceller automatiquement.');
      }
      return await dispatcherApi.batches.executeDecision(newBatchId, 'seal_batch', {});
    } finally {
      setLoading(false);
    }
  };

  return { sealBatch, loading };
};
