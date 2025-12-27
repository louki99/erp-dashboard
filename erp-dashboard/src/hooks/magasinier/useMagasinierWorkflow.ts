import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { workflowStateApi } from '@/services/api/workflowStateApi';
import type { WorkflowTransitionRequest } from '@/services/api/workflowStateApi';

export interface BPItemUpdate {
    product_id: number;
    prepared_quantity: number;
}

export interface BPStatistics {
    total_items: number;
    prepared_items: number;
    remaining_items: number;
    progress: number;
    total_quantity: number;
    prepared_quantity: number;
}

export function useMagasinierBPWorkflow(bpId: number) {
    const queryClient = useQueryClient();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [statistics, setStatistics] = useState<BPStatistics | null>(null);

    const { data: workflowState, isLoading: isLoadingState, refetch: refetchState } = useQuery({
        queryKey: ['workflow', 'bon-preparation', bpId, 'state'],
        queryFn: () => workflowStateApi.bonPreparation.getAllowedActions(bpId),
        enabled: !!bpId,
        refetchInterval: 3000,
    });

    const { data: workflowHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['workflow', 'bon-preparation', bpId, 'history'],
        queryFn: () => workflowStateApi.bonPreparation.getHistory(bpId),
        enabled: !!bpId,
    });

    const transitionMutation = useMutation({
        mutationFn: (data: WorkflowTransitionRequest) => 
            workflowStateApi.bonPreparation.transition(bpId, data),
        onMutate: () => {
            setIsTransitioning(true);
        },
        onSuccess: (response) => {
            toast.success(response.message || 'Transition successful');
            queryClient.invalidateQueries({ queryKey: ['workflow', 'bon-preparation', bpId] });
            queryClient.invalidateQueries({ queryKey: ['magasinier', 'preparations'] });
            queryClient.invalidateQueries({ queryKey: ['magasinier', 'dashboard'] });
            refetchState();
            refetchHistory();
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Transition failed';
            toast.error(message);
        },
        onSettled: () => {
            setIsTransitioning(false);
        },
    });

    const updateItemsMutation = useMutation({
        mutationFn: (items: BPItemUpdate[]) => 
            workflowStateApi.bonPreparation.updateItems(bpId, items),
        onSuccess: (response) => {
            if (response.data?.statistics) {
                setStatistics(response.data.statistics);
                toast.success(`Progress: ${response.data.statistics.progress}%`);
            }
            queryClient.invalidateQueries({ queryKey: ['magasinier', 'preparations', bpId] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to update items');
        },
    });

    const startPreparation = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'in_progress',
            comment: comment || 'Starting preparation of items',
        });
    }, [transitionMutation]);

    const completePreparation = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'completed',
            comment: comment || 'All items prepared and ready for loading',
        });
    }, [transitionMutation]);

    const pausePreparation = useCallback((comment: string) => {
        return transitionMutation.mutateAsync({
            action: 'paused',
            comment,
        });
    }, [transitionMutation]);

    const resumePreparation = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'resumed',
            comment: comment || 'Resuming preparation',
        });
    }, [transitionMutation]);

    const updateItems = useCallback((items: BPItemUpdate[]) => {
        return updateItemsMutation.mutateAsync(items);
    }, [updateItemsMutation]);

    const updateSingleItem = useCallback((productId: number, preparedQuantity: number) => {
        return updateItemsMutation.mutateAsync([{ product_id: productId, prepared_quantity: preparedQuantity }]);
    }, [updateItemsMutation]);

    const canPerformAction = useCallback((action: string): boolean => {
        return workflowState?.allowed_actions?.includes(action) || false;
    }, [workflowState]);

    return {
        workflowState,
        workflowHistory: workflowHistory?.data || [],
        statistics,
        isLoadingState,
        isLoadingHistory,
        isTransitioning,
        isUpdatingItems: updateItemsMutation.isPending,
        canPerformAction,
        actions: {
            startPreparation,
            completePreparation,
            pausePreparation,
            resumePreparation,
            updateItems,
            updateSingleItem,
            transition: transitionMutation.mutateAsync,
        },
        refetch: () => {
            refetchState();
            refetchHistory();
        },
    };
}

export function useMagasinierBatchPreparation() {
    const queryClient = useQueryClient();
    const [batchProgress, setBatchProgress] = useState<Record<number, number>>({});

    const batchUpdateMutation = useMutation({
        mutationFn: async (updates: Array<{ bpId: number; items: BPItemUpdate[] }>) => {
            const results = await Promise.allSettled(
                updates.map(async ({ bpId, items }) => {
                    const result = await workflowStateApi.bonPreparation.updateItems(bpId, items);
                    if (result.data?.statistics) {
                        setBatchProgress(prev => ({
                            ...prev,
                            [bpId]: result.data.statistics.progress,
                        }));
                    }
                    return result;
                })
            );
            return results;
        },
        onSuccess: (results) => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (successful > 0) {
                toast.success(`${successful} preparation(s) updated successfully`);
            }
            if (failed > 0) {
                toast.error(`${failed} preparation(s) failed to update`);
            }
            
            queryClient.invalidateQueries({ queryKey: ['magasinier', 'preparations'] });
            queryClient.invalidateQueries({ queryKey: ['magasinier', 'dashboard'] });
        },
        onError: () => {
            toast.error('Batch update failed');
        },
    });

    return {
        batchUpdate: batchUpdateMutation.mutateAsync,
        isBatchProcessing: batchUpdateMutation.isPending,
        batchProgress,
    };
}

export function useMagasinierRealtimeProgress(bpId: number) {
    const [progress, setProgress] = useState<BPStatistics | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['magasinier', 'preparations', bpId, 'progress'],
        queryFn: async () => {
            const state = await workflowStateApi.bonPreparation.getAllowedActions(bpId);
            if (state.metadata?.statistics) {
                setProgress(state.metadata.statistics);
            }
            return state;
        },
        enabled: !!bpId,
        refetchInterval: 2000,
    });

    return {
        progress,
        isLoading,
        currentState: data?.current_state,
    };
}
