import { useState } from 'react';
import { CheckSquare, XCircle, UserPlus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { taskApi } from '@/services/api/taskApi';

interface BulkTaskActionsProps {
    selectedTaskIds: number[];
    onActionComplete: () => void;
    onClearSelection: () => void;
}

export function BulkTaskActions({ selectedTaskIds, onActionComplete, onClearSelection }: BulkTaskActionsProps) {
    const [loading, setLoading] = useState(false);
    const [showReassignDialog, setShowReassignDialog] = useState(false);
    const [newUserId, setNewUserId] = useState<number | null>(null);

    const handleBulkComplete = async () => {
        if (selectedTaskIds.length === 0) {
            toast.error('No tasks selected');
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to complete ${selectedTaskIds.length} task(s)?`
        );
        if (!confirmed) return;

        try {
            setLoading(true);
            const result = await taskApi.bulk.complete(selectedTaskIds, {
                result: 'bulk_approved',
                notes: 'Bulk completion',
            });

            toast.success(result.message);

            if (result.results.failed.length > 0) {
                toast.error(`${result.results.failed.length} task(s) failed to complete`);
                console.error('Failed tasks:', result.results.failed);
            }

            onActionComplete();
            onClearSelection();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to complete tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkCancel = async () => {
        if (selectedTaskIds.length === 0) {
            toast.error('No tasks selected');
            return;
        }

        const reason = window.prompt(
            `Enter reason for cancelling ${selectedTaskIds.length} task(s):`
        );
        if (!reason) return;

        try {
            setLoading(true);
            const result = await taskApi.bulk.cancel(selectedTaskIds, reason);

            toast.success(result.message);

            if (result.results.failed.length > 0) {
                toast.error(`${result.results.failed.length} task(s) failed to cancel`);
                console.error('Failed tasks:', result.results.failed);
            }

            onActionComplete();
            onClearSelection();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to cancel tasks');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkReassign = async () => {
        if (!newUserId) {
            toast.error('Please select a user');
            return;
        }

        try {
            setLoading(true);
            const result = await taskApi.bulk.reassign(
                selectedTaskIds,
                newUserId,
                'Bulk reassignment'
            );

            toast.success(result.message);

            if (result.results.failed.length > 0) {
                toast.error(`${result.results.failed.length} task(s) failed to reassign`);
                console.error('Failed tasks:', result.results.failed);
            }

            setShowReassignDialog(false);
            onActionComplete();
            onClearSelection();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to reassign tasks');
        } finally {
            setLoading(false);
        }
    };

    if (selectedTaskIds.length === 0) {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50">
                <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">
                        {selectedTaskIds.length} task(s) selected
                    </span>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleBulkComplete}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <CheckSquare className="w-4 h-4 mr-2" />
                            )}
                            Complete All
                        </button>

                        <button
                            onClick={handleBulkCancel}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <XCircle className="w-4 h-4 mr-2" />
                            )}
                            Cancel All
                        </button>

                        <button
                            onClick={() => setShowReassignDialog(true)}
                            disabled={loading}
                            className="inline-flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Reassign
                        </button>

                        <button
                            onClick={onClearSelection}
                            className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded-lg transition-colors"
                        >
                            Clear
                        </button>
                    </div>
                </div>
            </div>

            {showReassignDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Reassign {selectedTaskIds.length} Task(s)
                        </h3>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select User
                            </label>
                            <input
                                type="number"
                                value={newUserId || ''}
                                onChange={(e) => setNewUserId(Number(e.target.value))}
                                placeholder="Enter user ID"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Note: In production, this would be a user selector dropdown
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleBulkReassign}
                                disabled={loading || !newUserId}
                                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <UserPlus className="w-4 h-4 mr-2" />
                                )}
                                Reassign
                            </button>
                            <button
                                onClick={() => setShowReassignDialog(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
