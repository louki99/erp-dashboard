import { useState } from 'react';
import { ArrowUpDown, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowTask } from '@/types/task.types';

interface TaskMoveDialogProps {
    task: WorkflowTask;
    maxOrder: number;
    onClose: () => void;
    onSuccess: () => void;
}

export function TaskMoveDialog({ task, maxOrder, onClose, onSuccess }: TaskMoveDialogProps) {
    const [newOrder, setNewOrder] = useState(task.order);
    const [loading, setLoading] = useState(false);

    const handleMove = async () => {
        if (newOrder === task.order) {
            toast.error('Task is already at this position');
            return;
        }

        if (newOrder < 1 || newOrder > maxOrder) {
            toast.error(`Order must be between 1 and ${maxOrder}`);
            return;
        }

        try {
            setLoading(true);
            await taskApi.tasks.move(task.id, newOrder);
            toast.success(`Task moved from position ${task.order} to ${newOrder}`);
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to move task');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
                <div className="flex items-center gap-3 mb-4">
                    <ArrowUpDown className="w-6 h-6 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Move Task</h3>
                </div>

                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                        <strong>{task.name}</strong>
                    </p>
                    <p className="text-xs text-gray-500">
                        Current position: {task.order} of {maxOrder}
                    </p>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        New Position
                    </label>
                    <div className="flex items-center gap-3">
                        <input
                            type="number"
                            min={1}
                            max={maxOrder}
                            value={newOrder}
                            onChange={(e) => setNewOrder(Number(e.target.value))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <span className="text-sm text-gray-500">of {maxOrder}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                        <button
                            onClick={() => setNewOrder(Math.max(1, newOrder - 1))}
                            disabled={newOrder <= 1}
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded disabled:opacity-50"
                        >
                            ← Earlier
                        </button>
                        <button
                            onClick={() => setNewOrder(Math.min(maxOrder, newOrder + 1))}
                            disabled={newOrder >= maxOrder}
                            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded disabled:opacity-50"
                        >
                            Later →
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleMove}
                        disabled={loading || newOrder === task.order}
                        className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <ArrowUpDown className="w-4 h-4 mr-2" />
                        )}
                        Move Task
                    </button>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}
