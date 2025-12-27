import { useState, useEffect, useCallback } from 'react';
import { workflowApi } from '@/services/api/workflowApi';
import type { WorkflowDefinition } from '@/types/task.types';
import toast from 'react-hot-toast';

export function useWorkflowTemplates() {
    const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkflows = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await workflowApi.getAll();
            setWorkflows(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to load workflows';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    return {
        workflows,
        loading,
        error,
        refetch: fetchWorkflows,
    };
}

export function useWorkflowDetail(workflowId: number | null) {
    const [workflow, setWorkflow] = useState<WorkflowDefinition | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchWorkflow = useCallback(async () => {
        if (!workflowId) {
            setWorkflow(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await workflowApi.getById(workflowId);
            setWorkflow(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to load workflow';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => {
        fetchWorkflow();
    }, [fetchWorkflow]);

    return {
        workflow,
        loading,
        error,
        refetch: fetchWorkflow,
    };
}

export function useWorkflowStatistics(workflowId: number | null) {
    const [statistics, setStatistics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = useCallback(async () => {
        if (!workflowId) {
            setStatistics(null);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const data = await workflowApi.getStatistics(workflowId);
            setStatistics(data);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to load statistics';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [workflowId]);

    useEffect(() => {
        fetchStatistics();
    }, [fetchStatistics]);

    return {
        statistics,
        loading,
        error,
        refetch: fetchStatistics,
    };
}
