import { useParams, useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { WorkflowProgressBar } from '@/components/tasks';
import { useTaskDetail, useTaskActions, useWorkflowProgress } from '@/hooks/tasks';
import { 
    ArrowLeft, 
    Clock, 
    User, 
    CheckCircle, 
    PlayCircle, 
    XCircle,
    AlertCircle,
    FileText
} from 'lucide-react';
import { useState } from 'react';

export const TaskDetailPage = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const { task, loading, refresh } = useTaskDetail(Number(taskId));
    const { claimTask, startTask, completeTask, executeTask, loading: actionLoading } = useTaskActions();
    const [executionResults, setExecutionResults] = useState<any>(null);

    const { progress } = useWorkflowProgress(
        task?.workflow_type || 'bc',
        task?.taskable_type || '',
        task?.taskable_id || 0,
        !!task
    );

    const handleClaim = async () => {
        if (!task) return;
        try {
            await claimTask(task.id);
            refresh();
        } catch (error) {
            console.error('Failed to claim task:', error);
        }
    };

    const handleStart = async () => {
        if (!task) return;
        try {
            await startTask(task.id);
            refresh();
        } catch (error) {
            console.error('Failed to start task:', error);
        }
    };

    const handleExecute = async () => {
        if (!task) return;
        try {
            const result = await executeTask(task.id, { action: 'validate' });
            setExecutionResults(result);
            refresh();
        } catch (error) {
            console.error('Failed to execute task:', error);
        }
    };

    const handleComplete = async () => {
        if (!task) return;
        try {
            await completeTask(task.id);
            navigate('/tasks');
        } catch (error) {
            console.error('Failed to complete task:', error);
        }
    };

    if (loading) {
        return (
            <MasterLayout
                mainContent={
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                }
            />
        );
    }

    if (!task) {
        return (
            <MasterLayout
                mainContent={
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                            <h2 className="text-xl font-semibold text-gray-900 mb-2">Tâche introuvable</h2>
                            <button
                                onClick={() => navigate('/tasks')}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Retour aux tâches
                            </button>
                        </div>
                    </div>
                }
            />
        );
    }

    const statusConfig = {
        pending: { color: 'bg-gray-100 text-gray-700', icon: Clock, label: 'En attente' },
        ready: { color: 'bg-blue-100 text-blue-700', icon: PlayCircle, label: 'Prêt' },
        in_progress: { color: 'bg-yellow-100 text-yellow-700', icon: Clock, label: 'En cours' },
        completed: { color: 'bg-green-100 text-green-700', icon: CheckCircle, label: 'Terminé' },
        failed: { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Échoué' },
        cancelled: { color: 'bg-gray-100 text-gray-700', icon: XCircle, label: 'Annulé' },
    };

    const statusInfo = statusConfig[task.status];
    const StatusIcon = statusInfo.icon;
    const isAssignedToMe = task.assignments.some(a => a.status === 'claimed');

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        <button
                            onClick={() => navigate('/tasks')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Retour aux tâches
                        </button>

                        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h1 className="text-2xl font-bold text-gray-900">{task.name}</h1>
                                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
                                            <StatusIcon className="w-4 h-4 inline mr-1" />
                                            {statusInfo.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 mb-2">{task.code}</p>
                                    <p className="text-gray-700">{task.description}</p>
                                </div>
                            </div>

                            {task.taskable && (
                                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations de l'entité</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-sm text-gray-600">Numéro:</span>
                                            <p className="font-medium text-gray-900">
                                                {task.taskable.bc_number || task.taskable.order_number || 'N/A'}
                                            </p>
                                        </div>
                                        {task.taskable.partner && (
                                            <div>
                                                <span className="text-sm text-gray-600">Partenaire:</span>
                                                <p className="font-medium text-gray-900">{task.taskable.partner.name}</p>
                                            </div>
                                        )}
                                        {task.taskable.total_amount && (
                                            <div>
                                                <span className="text-sm text-gray-600">Montant:</span>
                                                <p className="font-medium text-gray-900">
                                                    {Number(task.taskable.total_amount).toLocaleString('fr-FR')} DH
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>Créé le {new Date(task.created_at).toLocaleDateString('fr-FR')}</span>
                                </div>
                                {task.timeout_minutes && (
                                    <div className="flex items-center gap-2 text-orange-600">
                                        <Clock className="w-4 h-4" />
                                        <span>Timeout: {task.timeout_minutes} minutes</span>
                                    </div>
                                )}
                            </div>

                            {isAssignedToMe && (
                                <div className="flex items-center gap-2 text-blue-600 bg-blue-50 rounded-lg p-3 mb-4">
                                    <User className="w-4 h-4" />
                                    <span className="text-sm font-medium">Cette tâche vous est assignée</span>
                                </div>
                            )}

                            <div className="flex gap-3">
                                {task.status === 'ready' && !isAssignedToMe && (
                                    <button
                                        onClick={handleClaim}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                                    >
                                        Réclamer la tâche
                                    </button>
                                )}
                                {task.status === 'ready' && isAssignedToMe && (
                                    <button
                                        onClick={handleStart}
                                        disabled={actionLoading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                    >
                                        Démarrer la tâche
                                    </button>
                                )}
                                {task.status === 'in_progress' && (
                                    <>
                                        {task.validation_rules && task.validation_rules.length > 0 && (
                                            <button
                                                onClick={handleExecute}
                                                disabled={actionLoading}
                                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                                            >
                                                Exécuter les validations
                                            </button>
                                        )}
                                        <button
                                            onClick={handleComplete}
                                            disabled={actionLoading}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                                        >
                                            Terminer la tâche
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {task.validation_rules && task.validation_rules.length > 0 && (
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Règles de validation</h3>
                                <div className="space-y-3">
                                    {task.validation_rules.map((rule) => (
                                        <div key={rule.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                                            <FileText className="w-5 h-5 text-gray-600 mt-0.5" />
                                            <div className="flex-1">
                                                <h4 className="font-medium text-gray-900">{rule.rule_name}</h4>
                                                {rule.description && (
                                                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                                                )}
                                                <div className="flex items-center gap-3 mt-2 text-xs">
                                                    <span className={`px-2 py-0.5 rounded ${rule.is_required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                                        {rule.is_required ? 'Obligatoire' : 'Optionnel'}
                                                    </span>
                                                    {rule.stop_on_failure && (
                                                        <span className="text-orange-600">Arrêt en cas d'échec</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {executionResults && executionResults.validation_results && (
                            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Résultats de validation</h3>
                                <div className="space-y-3">
                                    {executionResults.validation_results.map((result: any, index: number) => (
                                        <div
                                            key={index}
                                            className={`flex items-start gap-3 p-3 rounded-lg ${
                                                result.passed ? 'bg-green-50' : 'bg-red-50'
                                            }`}
                                        >
                                            {result.passed ? (
                                                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                                            )}
                                            <div className="flex-1">
                                                <h4 className={`font-medium ${result.passed ? 'text-green-900' : 'text-red-900'}`}>
                                                    {result.rule_name}
                                                </h4>
                                                <p className={`text-sm mt-1 ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                                                    {result.message}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {progress && (
                            <WorkflowProgressBar progress={progress} showDetails={true} />
                        )}
                    </div>
                </div>
            }
        />
    );
};
