import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { EnhancedWorkflowForm } from '@/components/workflow/EnhancedWorkflowForm';
import { workflowApi } from '@/services/api/workflowApi';
import { ArrowLeft } from 'lucide-react';
import type { WorkflowTemplateCreateRequest } from '@/types/task.types';

export function WorkflowCreatePage() {
    const navigate = useNavigate();

    const handleSubmit = async (data: WorkflowTemplateCreateRequest) => {
        const workflow = await workflowApi.create(data);
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

                        <EnhancedWorkflowForm
                            onSubmit={handleSubmit}
                            onCancel={() => navigate('/workflows')}
                        />
                    </div>
                </div>
            }
        />
    );
}
