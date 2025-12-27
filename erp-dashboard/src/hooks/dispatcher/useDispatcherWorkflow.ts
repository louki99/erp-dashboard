import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { workflowStateApi } from '@/services/api/workflowStateApi';
import type { WorkflowTransitionRequest } from '@/services/api/workflowStateApi';

export function useDispatcherBLWorkflow(blId: number) {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const [isTransitioning, setIsTransitioning] = useState(false);

    const { data: workflowState, isLoading: isLoadingState, refetch: refetchState } = useQuery({
        queryKey: ['workflow', 'bon-livraison', blId, 'state'],
        queryFn: () => workflowStateApi.bonLivraison.getAllowedActions(blId),
        enabled: !!blId && isAuthenticated,
        refetchInterval: isAuthenticated ? 5000 : false,
    });

    const { data: workflowHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['workflow', 'bon-livraison', blId, 'history'],
        queryFn: () => workflowStateApi.bonLivraison.getHistory(blId),
        enabled: !!blId,
    });

    const transitionMutation = useMutation({
        mutationFn: (data: WorkflowTransitionRequest) => 
            workflowStateApi.bonLivraison.transition(blId, data),
        onMutate: () => {
            setIsTransitioning(true);
        },
        onSuccess: (response) => {
            toast.success(response.message || 'Transition successful');
            
            if (response.metadata?.bl_creation) {
                toast.success(`BL #${response.metadata.bl_creation.bl.bl_number} created`);
            }
            if (response.metadata?.bch_creation) {
                toast.success(`BCH #${response.metadata.bch_creation.bch.bch_number} created`);
            }
            
            queryClient.invalidateQueries({ queryKey: ['workflow', 'bon-livraison', blId] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'bon-livraisons'] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'dashboard'] });
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

    const submit = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'submitted',
            comment: comment || 'BL ready for grouping',
        });
    }, [transitionMutation]);

    const group = useCallback((bchId: number | null, createNew: boolean, comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'grouped',
            comment: comment || 'Grouped in BCH for warehouse',
            metadata: {
                bch_id: bchId,
                create_new_bch: createNew,
            },
        });
    }, [transitionMutation]);

    const markPrepared = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'prepared',
            comment: comment || 'BL prepared and ready for loading',
        });
    }, [transitionMutation]);

    const load = useCallback((vehicleId: number, driverId: number, comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'loaded',
            comment: comment || 'BL loaded on vehicle',
            metadata: {
                vehicle_id: vehicleId,
                driver_id: driverId,
            },
        });
    }, [transitionMutation]);

    const startTransit = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'in_transit',
            comment: comment || 'Driver started delivery',
        });
    }, [transitionMutation]);

    const deliver = useCallback((signature: string, notes?: string) => {
        return transitionMutation.mutateAsync({
            action: 'delivered',
            comment: notes || 'Successfully delivered to customer',
            metadata: {
                signature,
                delivery_notes: notes,
                delivered_at: new Date().toISOString(),
            },
        });
    }, [transitionMutation]);

    const returnBL = useCallback((reason: string) => {
        return transitionMutation.mutateAsync({
            action: 'returned',
            comment: reason,
            metadata: {
                return_reason: reason,
                returned_at: new Date().toISOString(),
            },
        });
    }, [transitionMutation]);

    const canPerformAction = useCallback((action: string): boolean => {
        if (!workflowState?.actions) return false;
        const actionObj = workflowState.actions.find(a => a.action === action);
        return actionObj?.metadata?.can_execute ?? false;
    }, [workflowState]);

    const getActionMetadata = useCallback((action: string) => {
        return workflowState?.actions?.find(a => a.action === action);
    }, [workflowState]);

    return {
        workflowState,
        workflowHistory: workflowHistory?.history || [],
        isLoadingState,
        isLoadingHistory,
        isTransitioning,
        canPerformAction,
        getActionMetadata,
        actions: {
            submit,
            group,
            markPrepared,
            load,
            startTransit,
            deliver,
            returnBL,
            transition: transitionMutation.mutateAsync,
        },
        refetch: () => {
            refetchState();
            refetchHistory();
        },
    };
}

export function useDispatcherBCHWorkflow(bchId: number) {
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();
    const [isTransitioning, setIsTransitioning] = useState(false);

    const { data: workflowState, isLoading: isLoadingState, refetch: refetchState } = useQuery({
        queryKey: ['workflow', 'bon-chargement', bchId, 'state'],
        queryFn: () => workflowStateApi.bonChargement.getAllowedActions(bchId),
        enabled: !!bchId && isAuthenticated,
        refetchInterval: isAuthenticated ? 5000 : false,
    });

    const { data: workflowHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
        queryKey: ['workflow', 'bon-chargement', bchId, 'history'],
        queryFn: () => workflowStateApi.bonChargement.getHistory(bchId),
        enabled: !!bchId,
    });

    const transitionMutation = useMutation({
        mutationFn: (data: WorkflowTransitionRequest) => 
            workflowStateApi.bonChargement.transition(bchId, data),
        onMutate: () => {
            setIsTransitioning(true);
        },
        onSuccess: (response) => {
            toast.success(response.message || 'Transition successful');
            
            if (response.metadata?.bp_info) {
                toast.success(`BP #${response.metadata.bp_info.bp.bp_number} created for warehouse`);
            }
            
            queryClient.invalidateQueries({ queryKey: ['workflow', 'bon-chargement', bchId] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'bon-chargements'] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'dashboard'] });
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

    const sendToWarehouse = useCallback((comment?: string) => {
        return transitionMutation.mutateAsync({
            action: 'in_preparation',
            comment: comment || 'BCH sent to warehouse for preparation',
        });
    }, [transitionMutation]);

    const canPerformAction = useCallback((action: string): boolean => {
        if (!workflowState?.actions) return false;
        const actionObj = workflowState.actions.find(a => a.action === action);
        return actionObj?.metadata?.can_execute ?? false;
    }, [workflowState]);

    const getActionMetadata = useCallback((action: string) => {
        return workflowState?.actions?.find(a => a.action === action);
    }, [workflowState]);

    return {
        workflowState,
        workflowHistory: workflowHistory?.history || [],
        isLoadingState,
        isLoadingHistory,
        isTransitioning,
        canPerformAction,
        getActionMetadata,
        actions: {
            sendToWarehouse,
            transition: transitionMutation.mutateAsync,
        },
        refetch: () => {
            refetchState();
            refetchHistory();
        },
    };
}

export function useDispatcherOrderConversion(orderId: number) {
    const queryClient = useQueryClient();

    const convertToBLMutation = useMutation({
        mutationFn: () => 
            workflowStateApi.order.transition(orderId, {
                action: 'converted_to_bl',
                comment: 'Converting to Bon de Livraison',
                metadata: {
                    create_bl: true,
                    bl_items: 'all',
                },
            }),
        onSuccess: (response) => {
            if (response.metadata?.bl_creation?.bl) {
                const bl = response.metadata.bl_creation.bl;
                toast.success(`BL #${bl.bl_number} created successfully`);
            }
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'orders'] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'bon-livraisons'] });
            queryClient.invalidateQueries({ queryKey: ['dispatcher', 'dashboard'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to convert to BL');
        },
    });

    return {
        convertToBL: convertToBLMutation.mutateAsync,
        isConverting: convertToBLMutation.isPending,
    };
}
