import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle, XCircle, Pause, AlertCircle, Loader2, Clock, Ban } from 'lucide-react';
import { useAdvWorkflow } from '@/hooks/adv/useAdvWorkflow';
import { WorkflowStateIndicator } from '@/components/workflow/WorkflowStateIndicator';
import type { WorkflowAction } from '@/services/api/workflowStateApi';

interface BCWorkflowActionsProps {
    orderId: number;
    onSuccess?: () => void;
}

interface ActionConfig {
    icon: any;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
    className?: string;
    requiresComment?: boolean;
    showForceOption?: boolean;
    dialogTitle: string;
    dialogDescription: string;
}

// Optional overrides for specific actions - only add here if you need custom styling/behavior
const ACTION_CONFIGS: Partial<Record<string, ActionConfig>> = {
    adv_approved: {
        icon: CheckCircle,
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700',
        requiresComment: false,
        showForceOption: true,
        dialogTitle: 'Approve Order',
        dialogDescription: 'Confirm that stock and credit are available for this order.',
    },
};

// Smart defaults based on action naming patterns
const getDefaultActionConfig = (action: string, label: string): ActionConfig => {
    const lowerAction = action.toLowerCase();
    
    // Destructive actions (require comment)
    if (lowerAction.includes('reject') || lowerAction.includes('cancel') || lowerAction.includes('delete')) {
        return {
            icon: lowerAction.includes('cancel') ? Ban : XCircle,
            variant: 'destructive',
            requiresComment: true,
            dialogTitle: label,
            dialogDescription: `Please provide a reason for this action.`,
        };
    }
    
    // Hold/Pause actions
    if (lowerAction.includes('hold') || lowerAction.includes('pause')) {
        return {
            icon: Pause,
            variant: 'outline',
            requiresComment: true,
            dialogTitle: label,
            dialogDescription: `Please provide a reason for putting this order on hold.`,
        };
    }
    
    // Approval/Success actions
    if (lowerAction.includes('approve') || lowerAction.includes('confirm') || lowerAction.includes('convert')) {
        return {
            icon: CheckCircle,
            variant: 'default',
            className: 'bg-green-600 hover:bg-green-700',
            requiresComment: false,
            dialogTitle: label,
            dialogDescription: `Execute action: ${label}`,
        };
    }
    
    // Review/Pending actions
    if (lowerAction.includes('review') || lowerAction.includes('pending')) {
        return {
            icon: Clock,
            variant: 'outline',
            requiresComment: false,
            dialogTitle: label,
            dialogDescription: `Send for review: ${label}`,
        };
    }
    
    // Default for any other action
    return {
        icon: CheckCircle,
        variant: 'default',
        requiresComment: false,
        dialogTitle: label,
        dialogDescription: `Execute action: ${label}`,
    };
};

export function BCWorkflowActions({ orderId, onSuccess }: BCWorkflowActionsProps) {
    const { workflowState, isTransitioning, actions } = useAdvWorkflow(orderId);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
    const [comment, setComment] = useState('');
    const [forceApprove, setForceApprove] = useState(false);

    const handleOpenDialog = (action: WorkflowAction) => {
        setSelectedAction(action);
        setComment('');
        setForceApprove(false);
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
                force: forceApprove || undefined,
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

    const getActionLabel = (action: WorkflowAction): string => {
        // Use label from API if available, otherwise format the action name
        return action.label || action.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const renderActionButton = (action: WorkflowAction) => {
        const canExecute = action.metadata?.can_execute ?? false;
        
        // Don't show actions that can't be executed
        if (!canExecute) return null;

        const label = getActionLabel(action);
        // Get custom config or use smart defaults
        const config = ACTION_CONFIGS[action.action] || getDefaultActionConfig(action.action, label);
        const Icon = config.icon;

        return (
            <Button
                key={action.action}
                onClick={() => handleOpenDialog(action)}
                disabled={isTransitioning}
                variant={config.variant}
                className={config.className}
            >
                {isTransitioning ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Icon className="mr-2 h-4 w-4" />
                )}
                {label}
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

                        {selectedAction && ACTION_CONFIGS[selectedAction.action]?.showForceOption && (
                            <div className="flex items-center space-x-2 rounded-lg border p-4">
                                <Checkbox
                                    id="force"
                                    checked={forceApprove}
                                    onCheckedChange={(checked) => setForceApprove(checked as boolean)}
                                />
                                <div className="space-y-1">
                                    <Label htmlFor="force" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                        Force Approve
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                        Override stock and credit checks (Admin only)
                                    </p>
                                </div>
                            </div>
                        )}

                        {forceApprove && (
                            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950 p-3 text-sm">
                                <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                                <p className="text-yellow-800 dark:text-yellow-200">
                                    Warning: Force approval will bypass all validation guards. Use this only when necessary.
                                </p>
                            </div>
                        )}
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
                            {selectedAction && getActionLabel(selectedAction)}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
