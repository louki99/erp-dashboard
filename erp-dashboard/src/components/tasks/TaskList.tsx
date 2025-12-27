import { TaskCard } from './TaskCard';
import type { WorkflowTask } from '@/types/task.types';
import { Loader2 } from 'lucide-react';

interface TaskListProps {
    tasks: WorkflowTask[];
    loading?: boolean;
    onClaim?: (taskId: number) => void;
    onStart?: (taskId: number) => void;
    onView?: (taskId: number) => void;
    emptyMessage?: string;
}

export const TaskList: React.FC<TaskListProps> = ({
    tasks,
    loading = false,
    onClaim,
    onStart,
    onView,
    emptyMessage = 'Aucune tâche disponible',
}) => {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!tasks || tasks.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-500">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tasks.map((task) => (
                <TaskCard
                    key={task.id}
                    task={task}
                    onClaim={onClaim}
                    onStart={onStart}
                    onView={onView}
                />
            ))}
        </div>
    );
};
