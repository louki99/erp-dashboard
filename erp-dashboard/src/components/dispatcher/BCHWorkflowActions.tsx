import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Package, Loader2, CheckCircle, Ban, Clock } from 'lucide-react';
import { useDispatcherBCHWorkflow } from '@/hooks/dispatcher/useDispatcherWorkflow';
import { WorkflowStateIndicator } from '@/components/workflow/WorkflowStateIndicator';
import type { WorkflowAction } from '@/services/api/workflowStateApi';

interface BCHWorkflowActionsProps {
    bchId: number;
    onSuccess?: () => void;
}

interface ActionConfig {
    icon: any;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
    className?: string;
    requiresComment?: boolean;
    dialogTitle: string;
    dialogDescription: string;
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
    pending_supervisor_approval: {
        icon: Clock,
        variant: 'outline',
        requiresComment: false,
        dialogTitle: 'Request Supervisor Approval',
        dialogDescription: 'Send this BCH to supervisor for approval.',
    },
    in_preparation: {
        icon: Package,
        variant: 'default',
        requiresComment: false,
        dialogTitle: 'Send to Warehouse',
        dialogDescription: 'Send this BCH to warehouse for preparation.',
    },
    ready: {
        icon: CheckCircle,
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700',
        requiresComment: false,
        dialogTitle: 'Mark as Ready',
        dialogDescription: 'Mark this BCH as ready for loading.',
    },
    cancelled: {
        icon: Ban,
        variant: 'destructive',
        requiresComment: true,
        dialogTitle: 'Cancel BCH',
        dialogDescription: 'Please provide a reason for cancelling this BCH.',
    },
};

export function BCHWorkflowActions({ bchId, onSuccess }: BCHWorkflowActionsProps) {
    const { workflowState, isTransitioning, actions } = useDispatcherBCHWorkflow(bchId);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
    const [comment, setComment] = useState('');

    const handleOpenDialog = (action: WorkflowAction) => {
        setSelectedAction(action);
        setComment('');
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedAction) return;

        const config = ACTION_CONFIGS[selectedAction.action];
        if (config?.requiresComment && !comment.trim()) {
            alert(`Please provide a comment for ${selectedAction.label}`);
            return;
        }

        try {
            await actions.transition({
                action: selectedAction.action,
                comment: comment || undefined,
            });
            setDialogOpen(false);
            onSuccess?.();
        } catch (error) {
            console.error('Action failed:', error);
        }
    };

    if (!workflowState) {
        return null;
    }

    const getActionLabel = (action: string): string => {
        const labels: Record<string, string> = {
            pending_supervisor_approval: 'Request Approval',
            in_preparation: 'Send to Warehouse',
            ready: 'Mark as Ready',
            cancelled: 'Cancel BCH',
        };
        return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const renderActionButton = (action: WorkflowAction) => {
        const config = ACTION_CONFIGS[action.action];
        if (!config) return null;

        const Icon = config.icon;
        const canExecute = action.metadata?.can_execute ?? false;
        const reason = action.metadata?.reason;

        return (
            <Button
                key={action.action}
                onClick={() => handleOpenDialog(action)}
                disabled={isTransitioning || !canExecute}
                variant={config.variant}
                className={config.className}
                title={!canExecute && reason ? reason : undefined}
            >
                {isTransitioning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Icon className="mr-2 h-4 w-4" />
                )}
                {getActionLabel(action.action)}
            </Button>
        );
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Current State</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <WorkflowStateIndicator state={workflowState.current_state} />
                        <span className="text-xs text-muted-foreground">({workflowState.current_step_name})</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                {workflowState.actions?.map(action => renderActionButton(action))}
                {(!workflowState.actions || workflowState.actions.length === 0) && (
                    <p className="text-sm text-muted-foreground">No actions available for current state</p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {selectedAction && ACTION_CONFIGS[selectedAction.action]?.dialogTitle}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedAction && ACTION_CONFIGS[selectedAction.action]?.dialogDescription}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="comment">
                                Comment {selectedAction && ACTION_CONFIGS[selectedAction.action]?.requiresComment && <span className="text-destructive">*</span>}
                            </Label>
                            <Textarea
                                id="comment"
                                placeholder={
                                    selectedAction && ACTION_CONFIGS[selectedAction.action]?.requiresComment
                                        ? 'Provide a reason...'
                                        : 'Optional: Add a comment...'
                                }
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isTransitioning}
                            variant={selectedAction && ACTION_CONFIGS[selectedAction.action]?.variant}
                        >
                            {isTransitioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedAction && getActionLabel(selectedAction.action)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
