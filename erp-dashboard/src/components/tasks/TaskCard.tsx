import { Clock, User, CheckCircle, PlayCircle, XCircle, ExternalLink } from 'lucide-react';
import type { WorkflowTask } from '@/types/task.types';
import { useNavigate } from 'react-router-dom';

interface TaskCardProps {
    task: WorkflowTask;
    onClaim?: (taskId: number) => void;
    onStart?: (taskId: number) => void;
    onView?: (taskId: number) => void;
    compact?: boolean;
}

const statusConfig = {
    pending: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'En attente' },
    ready: { color: 'bg-blue-100 text-blue-700', icon: PlayCircle, label: 'Prêt' },
    in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'En cours' },
    completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Terminé' },
    failed: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Échoué' },
    cancelled: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Annulé' },
};

const taskTypeLabels = {
    creation: 'Création',
    validation: 'Validation',
    conversion: 'Conversion',
    dispatch: 'Dispatch',
    preparation: 'Préparation',
    delivery: 'Livraison',
    control: 'Contrôle',
    approval: 'Approbation',
    notification: 'Notification',
    processing: 'Traitement',
};

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClaim, onStart, onView, compact = false }) => {
    const navigate = useNavigate();
    const statusInfo = statusConfig[task.status];
    const StatusIcon = statusInfo.icon;
    const isAssignedToMe = task.assignments.some(a => a.status === 'claimed');

    return (
        <div
            className={`bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-all cursor-pointer ${
                compact ? 'p-3' : 'p-4'
            }`}
            onClick={() => onView?.(task.id)}
        >
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
                            {task.name}
                        </h3>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{task.code}</p>
                    {!compact && task.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{task.description}</p>
                    )}
                </div>
                <StatusIcon className={`w-5 h-5 ${statusInfo.color.split(' ')[1]}`} />
            </div>

            {task.taskable && (
                <div className="bg-gray-50 rounded p-2 mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-600">
                            {task.taskable.bc_number || task.taskable.order_number || 'N/A'}
                        </span>
                        {task.taskable.partner && (
                            <span className="text-gray-900 font-medium">{task.taskable.partner.name}</span>
                        )}
                    </div>
                    <div className="flex items-center justify-between">
                        {task.taskable.total_amount && (
                            <div className="text-xs text-gray-600">
                                Montant: {Number(task.taskable.total_amount).toLocaleString('fr-FR')} DH
                            </div>
                        )}
                        {task.taskable?.id && task.taskable_type === 'Order' && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/adv/validation?bcId=${task.taskable?.id}`);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded transition-colors"
                                title="Voir le BC"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Voir BC
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(task.created_at).toLocaleDateString('fr-FR')}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700">
                        {taskTypeLabels[task.task_type]}
                    </span>
                </div>
                {task.timeout_minutes && (
                    <span className="text-orange-600">⏱ {task.timeout_minutes}min</span>
                )}
            </div>

            {isAssignedToMe && (
                <div className="flex items-center gap-1 text-xs text-blue-600 mb-3">
                    <User className="w-3 h-3" />
                    <span>Assigné à vous</span>
                </div>
            )}

            {task.validation_rules && task.validation_rules.length > 0 && (
                <div className="text-xs text-gray-500 mb-3">
                    {task.validation_rules.length} règle(s) de validation
                </div>
            )}

            <div className="flex gap-2">
                {task.status === 'ready' && !isAssignedToMe && onClaim && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClaim(task.id);
                        }}
                        className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                        Réclamer
                    </button>
                )}
                {task.status === 'ready' && isAssignedToMe && onStart && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onStart(task.id);
                        }}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                    >
                        Démarrer
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onView?.(task.id);
                    }}
                    className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
                >
                    Voir détails
                </button>
            </div>
        </div>
    );
};
