import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';
import type { WorkflowProgress } from '@/types/task.types';

interface WorkflowProgressBarProps {
    progress: WorkflowProgress;
    showDetails?: boolean;
}

export const WorkflowProgressBar: React.FC<WorkflowProgressBarProps> = ({ progress, showDetails = true }) => {
    const { total, completed, failed, in_progress, pending, ready, progress_percentage } = progress;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Progression du workflow</h3>
                <span className="text-2xl font-bold text-blue-600">{Math.round(progress_percentage)}%</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div
                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${progress_percentage}%` }}
                />
            </div>

            {showDetails && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="flex items-center gap-2">
                        <Circle className="w-4 h-4 text-gray-400" />
                        <div>
                            <div className="text-xs text-gray-500">Total</div>
                            <div className="text-sm font-semibold text-gray-900">{total}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <div>
                            <div className="text-xs text-gray-500">Terminées</div>
                            <div className="text-sm font-semibold text-green-600">{completed}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-yellow-600" />
                        <div>
                            <div className="text-xs text-gray-500">En cours</div>
                            <div className="text-sm font-semibold text-yellow-600">{in_progress}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Circle className="w-4 h-4 text-blue-600" />
                        <div>
                            <div className="text-xs text-gray-500">Prêtes</div>
                            <div className="text-sm font-semibold text-blue-600">{ready}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Circle className="w-4 h-4 text-gray-400" />
                        <div>
                            <div className="text-xs text-gray-500">En attente</div>
                            <div className="text-sm font-semibold text-gray-600">{pending}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <XCircle className="w-4 h-4 text-red-600" />
                        <div>
                            <div className="text-xs text-gray-500">Échouées</div>
                            <div className="text-sm font-semibold text-red-600">{failed}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
