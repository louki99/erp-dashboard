import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { WorkflowForm } from '@/components/workflow/WorkflowForm';
import { workflowEngineApi } from '@/services/api/workflowEngineApi';
import { ArrowLeft } from 'lucide-react';
import type { WorkflowDefinition } from '@/types/workflowEngine.types';

export function WorkflowCreatePage() {
    const navigate = useNavigate();

    const handleSubmit = async (data: Partial<WorkflowDefinition>) => {
        const workflow = await workflowEngineApi.createWorkflow(data);
        navigate(`/workflows/${workflow.id}`);
    };

    return (
        <MasterLayout
            mainContent={
                <div className="h-full overflow-y-auto">
                    <div className="p-6">
                        <button
                            onClick={() => navigate('/workflows')}
                            className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Workflows
                        </button>

                        <WorkflowForm
                            onSubmit={handleSubmit}
                            onCancel={() => navigate('/workflows')}
                        />
                    </div>
                </div>
            }
        />
    );
}
