import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { workflowStateApi } from '@/services/api/workflowStateApi';
import type { WorkflowTransitionRequest } from '@/services/api/workflowStateApi';

export function useAdvWorkflow(orderId: number) {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const [isTransitioning, setIsTransitioning] = useState(false);

    const { data: workflowState, isLoading: isLoadingState, refetch: refetchState } = useQuery({
        queryKey: ['workflow', 'order', orderId, 'state'],
        queryFn: () => workflowStateApi.order.getAllowedActions(orderId),
        enabled: !!orderId && isAuthenticated,
        refetchInterval: isAuthenticated ? 5000 : false,
    });

    const { data: workflowHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['workflow', 'order', orderId, 'history'],
        queryFn: () => workflowStateApi.order.getHistory(orderId),
        enabled: !!orderId,
    });

    const transitionMutation = useMutation({
        mutationFn: (data: WorkflowTransitionRequest) => 
            workflowStateApi.order.transition(orderId, data),
        onMutate: () => {
            setIsTransitioning(true);
        },
        onSuccess: (response) => {
            toast.success(response.message || 'Transition successful');
            queryClient.invalidateQueries({ queryKey: ['workflow', 'order', orderId] });
            queryClient.invalidateQueries({ queryKey: ['adv', 'bc'] });
            queryClient.invalidateQueries({ queryKey: ['adv', 'dashboard'] });
            refetchState();
            refetchHistory();
        },
        onError: (error: any) => {
            const message = error.response?.data?.message || 'Transition failed';
            toast.error(message);
            if (error.response?.data?.errors) {
                error.response.data.errors.forEach((err: string) => toast.error(err));
            }
        },
        onSettled: () => {
            setIsTransitioning(false);
        },
    });

    const validateTransitionMutation = useMutation({
        mutationFn: (action: string) => 
            workflowStateApi.order.validateTransition(orderId, action),
    });

    const sendToReview = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'adv_review',
            comment: comment || 'Sending to ADV for review',
        });
    }, [transitionMutation]);

    const approve = useCallback((comment?: string, force = false) => {
        return transitionMutation.mutateAsync({
            action: 'adv_approved',
            comment: comment || 'Order approved - stock and credit OK',
            force,
        });
    }, [transitionMutation]);

    const reject = useCallback((comment: string) => {
        return transitionMutation.mutateAsync({
            action: 'adv_rejected',
            comment,
        });
    }, [transitionMutation]);

    const hold = useCallback((comment: string) => {
        return transitionMutation.mutateAsync({
            action: 'adv_on_hold',
            comment,
        });
    }, [transitionMutation]);

    const confirm = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'confirmed',
            comment: comment || 'Order confirmed and ready for conversion',
        });
    }, [transitionMutation]);

    const canPerformAction = useCallback((action: string): boolean => {
        if (!workflowState?.actions) return false;
        const actionObj = workflowState.actions.find(a => a.action === action);
        return actionObj?.metadata?.can_execute ?? false;
    }, [workflowState]);

    const getActionMetadata = useCallback((action: string) => {
        if (!workflowState?.actions) return null;
        return workflowState.actions.find(a => a.action === action);
    }, [workflowState]);

    const validateAction = useCallback(async (action: string) => {
        const result = await validateTransitionMutation.mutateAsync(action);
        return result;
    }, [validateTransitionMutation]);

    return {
        workflowState,
        workflowHistory: workflowHistory?.history || [],
        isLoadingState,
        isLoadingHistory,
        isTransitioning,
        canPerformAction,
        getActionMetadata,
        validateAction,
        actions: {
            sendToReview,
            approve,
            reject,
            hold,
            confirm,
            transition: transitionMutation.mutateAsync,
        },
        refetch: () => {
            refetchState();
            refetchHistory();
        },
    };
}

export function useAdvBatchWorkflow() {
    const queryClient = useQueryClient();

    const batchApproveMutation = useMutation({
        mutationFn: async (orderIds: number[]) => {
            const results = await Promise.allSettled(
                orderIds.map(orderId =>
                    workflowStateApi.order.transition(orderId, {
                        action: 'adv_approved',
                        comment: 'Batch approval',
                    })
                )
            );
            return results;
        },
        onSuccess: (results) => {
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            
            if (successful > 0) {
                toast.success(`${successful} order(s) approved successfully`);
            }
            if (failed > 0) {
                toast.error(`${failed} order(s) failed to approve`);
            }
            
            queryClient.invalidateQueries({ queryKey: ['adv', 'bc'] });
            queryClient.invalidateQueries({ queryKey: ['adv', 'dashboard'] });
        },
        onError: () => {
            toast.error('Batch approval failed');
        },
    });

    return {
        batchApprove: batchApproveMutation.mutateAsync,
        isBatchProcessing: batchApproveMutation.isPending,
    };
}
