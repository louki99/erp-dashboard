import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/services/api/client';

// Types
export interface SLAStatistics {
    total_in_progress: number;
    on_time: number;
    at_risk: number;
    exceeded: number;
    compliance_rate: number;
}

export interface TaskAtRisk {
    task_id: number;
    task_code: string;
    task_name: string;
    workflow_type: string;
    remaining_minutes: number;
    timeout_minutes: number;
    risk_level: 'exceeded' | 'critical' | 'high' | 'medium' | 'low';
}

interface UseSLATrackingOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
}

/**
 * Custom hook for SLA tracking and monitoring
 * Follows Single Responsibility Principle - handles only SLA-related data
 */
export function useSLATracking(options: UseSLATrackingOptions = {}) {
    const { autoRefresh = false, refreshInterval = 30000 } = options;
    
    const [statistics, setStatistics] = useState<SLAStatistics | null>(null);
    const [tasksAtRisk, setTasksAtRisk] = useState<TaskAtRisk[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Fetch SLA statistics
    const fetchStatistics = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/backend/tasks/sla/statistics');
            if (response.data.success) {
                setStatistics(response.data.statistics);
            }
        } catch (err: any) {
            console.error('Error fetching SLA statistics:', err);
            setError(err.response?.data?.message || 'Failed to fetch SLA statistics');
        }
    }, []);

    // Fetch tasks at risk
    const fetchTasksAtRisk = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/backend/tasks/sla/at-risk');
            if (response.data.success) {
                setTasksAtRisk(response.data.tasks_at_risk || []);
            }
        } catch (err: any) {
            console.error('Error fetching tasks at risk:', err);
            setError(err.response?.data?.message || 'Failed to fetch tasks at risk');
        }
    }, []);

    // Fetch all SLA data
    const fetchSLAData = useCallback(async () => {
        setLoading(true);
        try {
            await Promise.all([fetchStatistics(), fetchTasksAtRisk()]);
            setError(null);
        } catch (err) {
            console.error('Error fetching SLA data:', err);
        } finally {
            setLoading(false);
        }
    }, [fetchStatistics, fetchTasksAtRisk]);

    // Setup auto-refresh
    useEffect(() => {
        fetchSLAData();

        if (autoRefresh) {
            const interval = setInterval(fetchSLAData, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchSLAData, autoRefresh, refreshInterval]);

    return {
        statistics,
        tasksAtRisk,
        loading,
        error,
        refetch: fetchSLAData,
    };
}

/**
 * Helper function to get risk level color
 * Follows Open/Closed Principle - can be extended without modification
 */
export function getRiskLevelColor(riskLevel: TaskAtRisk['risk_level']): string {
    const colorMap: Record<TaskAtRisk['risk_level'], string> = {
        exceeded: 'bg-red-100 text-red-700 border-red-200',
        critical: 'bg-orange-100 text-orange-700 border-orange-200',
        high: 'bg-yellow-100 text-yellow-700 border-yellow-200',
        medium: 'bg-blue-100 text-blue-700 border-blue-200',
        low: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    
    return colorMap[riskLevel] || colorMap.low;
}

/**
 * Helper function to get alert level icon
 */
export function getAlertLevelIcon(alertLevel: 'critical' | 'high' | 'medium' | 'low'): string {
    const iconMap = {
        critical: '🚨',
        high: '⚠️',
        medium: '⚡',
        low: 'ℹ️',
    };
    
    return iconMap[alertLevel] || iconMap.low;
}
