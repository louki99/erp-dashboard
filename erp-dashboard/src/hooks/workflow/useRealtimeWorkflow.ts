import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';

// Types
export interface TaskStatusChangeEvent {
    task_id: number;
    task_code: string;
    task_name: string;
    workflow_type: string;
    taskable_type: string;
    taskable_id: number;
    old_status: string;
    new_status: string;
    can_start: boolean;
    changed_by: number;
    changed_at: string;
}

export interface TaskBecameReadyEvent {
    task_id: number;
    task_code: string;
    task_name: string;
    task_type: string;
    workflow_type: string;
    taskable_type: string;
    taskable_id: number;
    timeout_minutes: number;
    assignments: Array<{
        type: string;
        user_id: number | null;
        role_name: string | null;
    }>;
    became_ready_at: string;
}

export interface TaskSLAExceededEvent {
    task_id: number;
    task_code: string;
    task_name: string;
    workflow_type: string;
    taskable_type: string;
    taskable_id: number;
    timeout_minutes: number;
    exceeded_by_minutes: number;
    started_at: string;
    alert_level: 'critical' | 'high' | 'medium' | 'low';
    alerted_at: string;
}

export interface WorkflowProgress {
    total: number;
    completed: number;
    in_progress: number;
    pending: number;
    progress_percentage: number;
    tasks: Array<{
        id: number;
        code: string;
        name: string;
        status: string;
        order: number;
        completed_at?: string;
        started_at?: string;
        can_start?: boolean;
    }>;
}

interface UseRealtimeWorkflowOptions {
    workflowType: string;
    taskableId: number;
    onTaskStatusChange?: (event: TaskStatusChangeEvent) => void;
    onTaskBecameReady?: (event: TaskBecameReadyEvent) => void;
    onTaskSLAExceeded?: (event: TaskSLAExceededEvent) => void;
    enableNotifications?: boolean;
}

/**
 * Custom hook for real-time workflow monitoring
 * Implements Single Responsibility Principle - handles only real-time workflow updates
 */
export function useRealtimeWorkflow({
    workflowType,
    taskableId,
    onTaskStatusChange,
    onTaskBecameReady,
    onTaskSLAExceeded,
    enableNotifications = true,
}: UseRealtimeWorkflowOptions) {
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch initial progress
    const fetchProgress = useCallback(async () => {
        try {
            const response = await apiClient.get(
                `/api/backend/tasks/workflow/${workflowType}/Order/${taskableId}/progress`
            );
            
            if (response.data.success) {
                setProgress(response.data.progress);
                setError(null);
            } else {
                setError(response.data.message || 'Failed to fetch progress');
            }
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch workflow progress');
            console.error('Error fetching workflow progress:', err);
        }
    }, [workflowType, taskableId]);

    // Handle task status change
    const handleTaskStatusChange = useCallback((event: TaskStatusChangeEvent) => {
        console.log('Task status changed:', event);
        
        // Refresh progress
        fetchProgress();
        
        // Show notification
        if (enableNotifications) {
            if (event.new_status === 'completed') {
                toast.success(`✓ ${event.task_name} completed!`);
            } else if (event.new_status === 'in_progress') {
                toast(`⏳ ${event.task_name} started`, { icon: 'ℹ️' });
            }
        }
        
        // Call custom handler
        onTaskStatusChange?.(event);
    }, [fetchProgress, enableNotifications, onTaskStatusChange]);

    // Handle task became ready
    const handleTaskBecameReady = useCallback((event: TaskBecameReadyEvent) => {
        console.log('Task became ready:', event);
        
        // Refresh progress
        fetchProgress();
        
        // Show notification
        if (enableNotifications) {
            toast(`🔔 ${event.task_name} is ready!`, {
                icon: '🔔',
                duration: 5000,
            });
        }
        
        // Call custom handler
        onTaskBecameReady?.(event);
    }, [fetchProgress, enableNotifications, onTaskBecameReady]);

    // Handle SLA exceeded
    const handleTaskSLAExceeded = useCallback((event: TaskSLAExceededEvent) => {
        console.log('Task SLA exceeded:', event);
        
        // Show notification based on alert level
        if (enableNotifications) {
            const icon = event.alert_level === 'critical' ? '🚨' : '⚠️';
            toast.error(
                `${icon} ${event.task_name} exceeded SLA by ${event.exceeded_by_minutes} minutes!`,
                { duration: 10000 }
            );
        }
        
        // Call custom handler
        onTaskSLAExceeded?.(event);
    }, [enableNotifications, onTaskSLAExceeded]);

    // Setup WebSocket/EventSource connection
    useEffect(() => {
        fetchProgress();

        // For now, use polling until WebSocket is configured
        // TODO: Replace with actual WebSocket/EventSource when backend is ready
        const pollInterval = setInterval(fetchProgress, 5000);

        // Simulate WebSocket connection status
        setIsConnected(true);

        // Note: handleTaskStatusChange, handleTaskBecameReady, handleTaskSLAExceeded
        // are ready for WebSocket integration when backend is configured
        // They will be called when WebSocket events are received

        return () => {
            clearInterval(pollInterval);
            setIsConnected(false);
        };
    }, [fetchProgress, handleTaskStatusChange, handleTaskBecameReady, handleTaskSLAExceeded]);

    return {
        progress,
        isConnected,
        error,
        refetch: fetchProgress,
    };
}
