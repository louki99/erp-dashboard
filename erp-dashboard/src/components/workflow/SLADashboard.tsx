import { useSLATracking, getRiskLevelColor, getAlertLevelIcon } from '@/hooks/workflow/useSLATracking';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SLADashboardProps {
    className?: string;
}

/**
 * SLA Dashboard Component
 * Follows Single Responsibility Principle - displays SLA metrics and alerts
 */
export function SLADashboard({ className }: SLADashboardProps) {
    const { statistics, tasksAtRisk, loading, error, refetch } = useSLATracking({
        autoRefresh: true,
        refreshInterval: 30000,
    });

    if (loading && !statistics) {
        return (
            <div className={cn('flex items-center justify-center p-8', className)}>
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error) {
        return (
            <div className={cn('bg-red-50 border border-red-200 rounded-lg p-4', className)}>
                <div className="flex items-center gap-2 text-red-700">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">Failed to load SLA data</span>
                </div>
                <button
                    onClick={refetch}
                    className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className={cn('space-y-6', className)}>
            {/* SLA Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="On Time"
                    value={statistics?.on_time || 0}
                    icon={CheckCircle2}
                    color="green"
                    total={statistics?.total_in_progress || 0}
                />
                <StatCard
                    title="At Risk"
                    value={statistics?.at_risk || 0}
                    icon={AlertTriangle}
                    color="orange"
                    total={statistics?.total_in_progress || 0}
                />
                <StatCard
                    title="Exceeded"
                    value={statistics?.exceeded || 0}
                    icon={AlertTriangle}
                    color="red"
                    total={statistics?.total_in_progress || 0}
                />
                <StatCard
                    title="Compliance Rate"
                    value={`${statistics?.compliance_rate?.toFixed(1) || 0}%`}
                    icon={TrendingUp}
                    color={
                        (statistics?.compliance_rate || 0) > 80
                            ? 'green'
                            : (statistics?.compliance_rate || 0) > 60
                            ? 'orange'
                            : 'red'
                    }
                />
            </div>

            {/* Tasks At Risk */}
            {tasksAtRisk.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                            Tasks At Risk ({tasksAtRisk.length})
                        </h3>
                        <button
                            onClick={refetch}
                            className="text-sm text-blue-600 hover:text-blue-700"
                        >
                            Refresh
                        </button>
                    </div>
                    <div className="space-y-3">
                        {tasksAtRisk.map((task) => (
                            <TaskAtRiskCard key={task.task_id} task={task} />
                        ))}
                    </div>
                </div>
            )}

            {/* No Tasks At Risk */}
            {tasksAtRisk.length === 0 && statistics && statistics.total_in_progress > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-900 mb-1">
                        All Tasks On Track
                    </h3>
                    <p className="text-green-700">
                        No tasks are currently at risk of exceeding their SLA
                    </p>
                </div>
            )}
        </div>
    );
}

/**
 * Stat Card Component
 * Follows Single Responsibility Principle - displays single metric
 */
interface StatCardProps {
    title: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    color: 'green' | 'orange' | 'red' | 'blue';
    total?: number;
}

function StatCard({ title, value, icon: Icon, color, total }: StatCardProps) {
    const colorClasses = {
        green: 'bg-green-50 border-green-200 text-green-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        red: 'bg-red-50 border-red-200 text-red-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
    };

    const iconColorClasses = {
        green: 'text-green-600',
        orange: 'text-orange-600',
        red: 'text-red-600',
        blue: 'text-blue-600',
    };

    return (
        <div className={cn('border rounded-lg p-4', colorClasses[color])}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{title}</span>
                <Icon className={cn('w-5 h-5', iconColorClasses[color])} />
            </div>
            <div className="text-2xl font-bold">{value}</div>
            {total !== undefined && typeof value === 'number' && (
                <div className="text-xs mt-1 opacity-75">
                    of {total} tasks
                </div>
            )}
        </div>
    );
}

/**
 * Task At Risk Card Component
 * Follows Single Responsibility Principle - displays single at-risk task
 */
interface TaskAtRiskCardProps {
    task: {
        task_id: number;
        task_code: string;
        task_name: string;
        workflow_type: string;
        remaining_minutes: number;
        timeout_minutes: number;
        risk_level: 'exceeded' | 'critical' | 'high' | 'medium' | 'low';
    };
}

function TaskAtRiskCard({ task }: TaskAtRiskCardProps) {
    const alertIcon = getAlertLevelIcon(
        task.risk_level === 'exceeded' ? 'critical' : task.risk_level as any
    );

    return (
        <div className={cn('border rounded-lg p-4', getRiskLevelColor(task.risk_level))}>
            <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{alertIcon}</span>
                        <h4 className="font-semibold truncate">{task.task_name}</h4>
                    </div>
                    <p className="text-xs opacity-75 mb-2">{task.task_code}</p>
                    <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>
                                {task.remaining_minutes > 0
                                    ? `${task.remaining_minutes}m remaining`
                                    : `${Math.abs(task.remaining_minutes)}m overdue`}
                            </span>
                        </div>
                        <div className="text-xs opacity-75">
                            Timeout: {task.timeout_minutes}m
                        </div>
                    </div>
                </div>
                <span className="px-2 py-1 bg-white rounded text-xs font-medium uppercase">
                    {task.risk_level}
                </span>
            </div>
        </div>
    );
}
