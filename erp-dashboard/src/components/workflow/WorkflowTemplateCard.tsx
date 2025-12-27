import type { WorkflowDefinition } from '@/types/task.types';
import { FileText, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WorkflowTemplateCardProps {
    workflow: WorkflowDefinition;
}

const workflowIcons: Record<string, any> = {
    BC: FileText,
    BL: FileText,
    BCH: FileText,
    BP: FileText,
};

const workflowColors: Record<string, { bg: string; text: string; border: string }> = {
    BC: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    BL: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    BCH: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    BP: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
};

export function WorkflowTemplateCard({ workflow }: WorkflowTemplateCardProps) {
    const navigate = useNavigate();
    const Icon = workflowIcons[workflow.code] || FileText;
    const colors = workflowColors[workflow.code] || workflowColors.BC;

    const templateCount = workflow.templates?.length || 0;
    const activeTemplates = workflow.templates?.filter((t) => t.is_active).length || 0;

    return (
        <div
            className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all cursor-pointer hover:shadow-lg"
            onClick={() => navigate(`/workflows/${workflow.id}`)}
        >
            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-lg ${colors.bg}`}>
                        <Icon className={`w-6 h-6 ${colors.text}`} />
                    </div>
                    <div className="flex items-center gap-2">
                        {workflow.is_active ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                            </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            v{workflow.version}
                        </span>
                    </div>
                </div>

                <div className="mb-4">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{workflow.name}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">
                        {workflow.description || 'No description provided'}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                    <div>
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Templates</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {activeTemplates}/{templateCount}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Active</div>
                    </div>

                    <div>
                        <div className="flex items-center gap-1.5 text-gray-500 text-xs mb-1">
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>Usage</span>
                        </div>
                        <div className="text-2xl font-bold text-gray-900">
                            {workflow.metadata?.usage_count || 0}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">Instances</div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
                <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Code: {workflow.code}</span>
                    <span>Updated: {new Date(workflow.updated_at).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
}
