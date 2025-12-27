import { useState } from 'react';
import { Filter } from 'lucide-react';
import type { TaskFilters as TaskFiltersType, TaskStatus, WorkflowType, TaskType } from '@/types/task.types';

interface TaskFiltersProps {
    filters: TaskFiltersType;
    onFiltersChange: (filters: TaskFiltersType) => void;
    onReset: () => void;
}

const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'pending', label: 'En attente' },
    { value: 'ready', label: 'Prêt' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'completed', label: 'Terminé' },
    { value: 'failed', label: 'Échoué' },
    { value: 'cancelled', label: 'Annulé' },
];

const workflowOptions: { value: WorkflowType; label: string }[] = [
    { value: 'bc', label: 'Bon de Commande' },
    { value: 'bl', label: 'Bon de Livraison' },
    { value: 'bch', label: 'Bon de Chargement' },
    { value: 'bp', label: 'Bon de Préparation' },
];

const taskTypeOptions: { value: TaskType; label: string }[] = [
    { value: 'creation', label: 'Création' },
    { value: 'validation', label: 'Validation' },
    { value: 'conversion', label: 'Conversion' },
    { value: 'dispatch', label: 'Dispatch' },
    { value: 'preparation', label: 'Préparation' },
    { value: 'delivery', label: 'Livraison' },
    { value: 'control', label: 'Contrôle' },
    { value: 'approval', label: 'Approbation' },
];

export const TaskFilters: React.FC<TaskFiltersProps> = ({ filters, onFiltersChange, onReset }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleFilterChange = (key: keyof TaskFiltersType, value: any) => {
        onFiltersChange({ ...filters, [key]: value });
    };

    const activeFiltersCount = Object.values(filters).filter((v) => v !== undefined && v !== '').length;

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
                <Filter className="w-4 h-4" />
                <span>Filtres</span>
                {activeFiltersCount > 0 && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                        {activeFiltersCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">Filtres</h3>
                            <button
                                onClick={() => {
                                    onReset();
                                    setIsOpen(false);
                                }}
                                className="text-sm text-blue-600 hover:text-blue-700"
                            >
                                Réinitialiser
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
                                <select
                                    value={filters.status as string || ''}
                                    onChange={(e) => handleFilterChange('status', e.target.value || undefined)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Tous les statuts</option>
                                    {statusOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type de workflow</label>
                                <select
                                    value={filters.workflow_type as string || ''}
                                    onChange={(e) => handleFilterChange('workflow_type', e.target.value || undefined)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Tous les workflows</option>
                                    {workflowOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Type de tâche</label>
                                <select
                                    value={filters.task_type as string || ''}
                                    onChange={(e) => handleFilterChange('task_type', e.target.value || undefined)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Tous les types</option>
                                    {taskTypeOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Recherche</label>
                                <input
                                    type="text"
                                    value={filters.search || ''}
                                    onChange={(e) => handleFilterChange('search', e.target.value || undefined)}
                                    placeholder="Rechercher..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="overdue"
                                    checked={filters.overdue || false}
                                    onChange={(e) => handleFilterChange('overdue', e.target.checked || undefined)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <label htmlFor="overdue" className="text-sm text-gray-700">
                                    Tâches en retard uniquement
                                </label>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-200">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                Appliquer les filtres
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
