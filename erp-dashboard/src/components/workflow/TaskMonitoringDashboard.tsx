import { useState, useEffect } from 'react';
import { 
    BarChart3, 
    Clock, 
    CheckCircle, 
    XCircle, 
    AlertCircle,
    Loader2
} from 'lucide-react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowType } from '@/types/task.types';

interface TaskStatistics {
    total: number;
    pending: number;
    ready: number;
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
}

interface TaskMonitoringDashboardProps {
    workflowType?: WorkflowType;
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export function TaskMonitoringDashboard({ 
    workflowType, 
    autoRefresh = true,
    refreshInterval = 10000 
}: TaskMonitoringDashboardProps) {
    const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    const fetchStatistics = async () => {
        try {
            const data = await taskApi.workflow.getStatistics();
            setStatistics(data.statistics);
            setLastUpdate(new Date());
        } catch (error) {
            console.error('Failed to fetch task statistics:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStatistics();

        if (autoRefresh) {
            const interval = setInterval(fetchStatistics, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [workflowType, autoRefresh, refreshInterval]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!statistics) {
        return (
            <div className="text-center py-12 text-gray-500">
                No statistics available
            </div>
        );
    }

    const completionRate = statistics.total > 0 
        ? ((statistics.completed / statistics.total) * 100).toFixed(1)
        : '0';

    const activeTasksCount = statistics.ready + statistics.in_progress;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <BarChart3 className="w-6 h-6 text-blue-600" />
                    <h2 className="text-xl font-semibold text-gray-900">
                        Task Monitoring Dashboard
                    </h2>
                </div>
                <div className="text-sm text-gray-500">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Tasks */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Total Tasks</span>
                        <BarChart3 className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{statistics.total}</div>
                    <div className="text-xs text-gray-500 mt-1">All workflow tasks</div>
                </div>

                {/* Active Tasks */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Active Tasks</span>
                        <Clock className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{activeTasksCount}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {statistics.ready} ready, {statistics.in_progress} in progress
                    </div>
                </div>

                {/* Completed */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Completed</span>
                        <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{statistics.completed}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        {completionRate}% completion rate
                    </div>
                </div>

                {/* Failed/Cancelled */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">Issues</span>
                        <XCircle className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">
                        {statistics.failed + statistics.cancelled}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                        {statistics.failed} failed, {statistics.cancelled} cancelled
                    </div>
                </div>
            </div>

            {/* Status Breakdown */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Breakdown</h3>
                
                <div className="space-y-3">
                    {/* Pending */}
                    <div className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">Pending</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                            <div 
                                className="bg-gray-400 h-6 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${(statistics.pending / statistics.total) * 100}%` }}
                            >
                                <span className="text-xs text-white font-medium">
                                    {statistics.pending}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Ready */}
                    <div className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">Ready</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                            <div 
                                className="bg-orange-400 h-6 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${(statistics.ready / statistics.total) * 100}%` }}
                            >
                                <span className="text-xs text-white font-medium">
                                    {statistics.ready}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* In Progress */}
                    <div className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">In Progress</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                            <div 
                                className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${(statistics.in_progress / statistics.total) * 100}%` }}
                            >
                                <span className="text-xs text-white font-medium">
                                    {statistics.in_progress}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Completed */}
                    <div className="flex items-center">
                        <div className="w-32 text-sm text-gray-600">Completed</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                            <div 
                                className="bg-green-500 h-6 rounded-full flex items-center justify-end pr-2"
                                style={{ width: `${(statistics.completed / statistics.total) * 100}%` }}
                            >
                                <span className="text-xs text-white font-medium">
                                    {statistics.completed}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Failed */}
                    {statistics.failed > 0 && (
                        <div className="flex items-center">
                            <div className="w-32 text-sm text-gray-600">Failed</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                                <div 
                                    className="bg-red-500 h-6 rounded-full flex items-center justify-end pr-2"
                                    style={{ width: `${(statistics.failed / statistics.total) * 100}%` }}
                                >
                                    <span className="text-xs text-white font-medium">
                                        {statistics.failed}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">
                            Monitoring Tips
                        </h4>
                        <ul className="text-xs text-blue-800 space-y-1">
                            <li>• Dashboard auto-refreshes every {refreshInterval / 1000} seconds</li>
                            <li>• {activeTasksCount} tasks require attention</li>
                            {statistics.failed > 0 && (
                                <li className="text-red-600 font-medium">
                                    • {statistics.failed} failed tasks need review
                                </li>
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
