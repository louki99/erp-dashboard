import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Package, Truck, Send, Loader2, CheckCircle, XCircle, Ban, Scissors, FileCheck } from 'lucide-react';
import { useDispatcherBLWorkflow } from '@/hooks/dispatcher/useDispatcherWorkflow';
import { WorkflowStateIndicator } from '@/components/workflow/WorkflowStateIndicator';
import type { WorkflowAction } from '@/services/api/workflowStateApi';

interface BLWorkflowActionsProps {
    blId: number;
    onSuccess?: () => void;
}

interface ActionConfig {
    icon: any;
    variant: 'default' | 'destructive' | 'outline' | 'secondary';
    className?: string;
    requiresComment?: boolean;
    requiresBCH?: boolean;
    requiresVehicle?: boolean;
    dialogTitle: string;
    dialogDescription: string;
}

const ACTION_CONFIGS: Record<string, ActionConfig> = {
    split: {
        icon: Scissors,
        variant: 'outline',
        requiresComment: false,
        dialogTitle: 'Split BL',
        dialogDescription: 'Split this BL into multiple BLs.',
    },
    submitted: {
        icon: Send,
        variant: 'default',
        requiresComment: false,
        dialogTitle: 'Submit BL',
        dialogDescription: 'Submit this BL for grouping in a BCH.',
    },
    grouped: {
        icon: Package,
        variant: 'default',
        requiresComment: false,
        requiresBCH: true,
        dialogTitle: 'Group in BCH',
        dialogDescription: 'Group this BL in a Bon de Chargement for warehouse preparation.',
    },
    submitted_to_magasinier: {
        icon: FileCheck,
        variant: 'default',
        requiresComment: false,
        dialogTitle: 'Submit to Warehouse',
        dialogDescription: 'Submit this BL to warehouse for preparation.',
    },
    prepared: {
        icon: CheckCircle,
        variant: 'outline',
        requiresComment: false,
        dialogTitle: 'Mark as Prepared',
        dialogDescription: 'Mark this BL as prepared and ready for loading.',
    },
    loaded: {
        icon: Truck,
        variant: 'default',
        requiresComment: false,
        requiresVehicle: true,
        dialogTitle: 'Load on Vehicle',
        dialogDescription: 'Assign vehicle and driver for delivery.',
    },
    in_transit: {
        icon: Truck,
        variant: 'default',
        className: 'bg-blue-600 hover:bg-blue-700',
        requiresComment: false,
        dialogTitle: 'Start Transit',
        dialogDescription: 'Start delivery transit for this BL.',
    },
    delivered: {
        icon: CheckCircle,
        variant: 'default',
        className: 'bg-green-600 hover:bg-green-700',
        requiresComment: false,
        dialogTitle: 'Mark as Delivered',
        dialogDescription: 'Confirm delivery to customer.',
    },
    returned: {
        icon: XCircle,
        variant: 'destructive',
        requiresComment: true,
        dialogTitle: 'Return BL',
        dialogDescription: 'Please provide a reason for returning this BL.',
    },
    cancelled: {
        icon: Ban,
        variant: 'destructive',
        requiresComment: true,
        dialogTitle: 'Cancel BL',
        dialogDescription: 'Please provide a reason for cancelling this BL.',
    },
};

export function BLWorkflowActions({ blId, onSuccess }: BLWorkflowActionsProps) {
    const { workflowState, isTransitioning, actions } = useDispatcherBLWorkflow(blId);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);
    const [comment, setComment] = useState('');
    const [bchId, setBchId] = useState<string>('');
    const [createNewBch, setCreateNewBch] = useState(true);
    const [vehicleId, setVehicleId] = useState<string>('');
    const [driverId, setDriverId] = useState<string>('');

    const handleOpenDialog = (action: WorkflowAction) => {
        setSelectedAction(action);
        setComment('');
        setCreateNewBch(true);
        setBchId('');
        setVehicleId('');
        setDriverId('');
        setDialogOpen(true);
    };

    const handleSubmit = async () => {
        if (!selectedAction) return;

        const config = ACTION_CONFIGS[selectedAction.action];
        if (config?.requiresComment && !comment.trim()) {
            alert(`Please provide a comment for ${selectedAction.label}`);
            return;
        }

        if (config?.requiresVehicle && (!vehicleId || !driverId)) {
            alert('Please select vehicle and driver');
            return;
        }

        try {
            const metadata: any = {};
            
            if (selectedAction.action === 'grouped') {
                metadata.bch_id = createNewBch ? null : parseInt(bchId);
                metadata.create_new_bch = createNewBch;
                metadata.bl_ids = [blId.toString()];
            } else if (selectedAction.action === 'loaded') {
                metadata.vehicle_id = parseInt(vehicleId);
                metadata.driver_id = parseInt(driverId);
            }

            await actions.transition({
                action: selectedAction.action,
                comment: comment || undefined,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
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
            split: 'Split BL',
            submitted: 'Submit BL',
            grouped: 'Group in BCH',
            submitted_to_magasinier: 'Submit to Warehouse',
            prepared: 'Mark as Prepared',
            loaded: 'Load on Vehicle',
            in_transit: 'Start Transit',
            delivered: 'Mark as Delivered',
            returned: 'Return BL',
            cancelled: 'Cancel BL',
        };
        return labels[action] || action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const renderActionButton = (action: WorkflowAction) => {
        const config = ACTION_CONFIGS[action.action];
        
        // If no config, create a default one
        const actionConfig = config || {
            icon: Send,
            variant: 'outline' as const,
            requiresComment: false,
            dialogTitle: getActionLabel(action.action),
            dialogDescription: `Execute ${getActionLabel(action.action)} action.`,
        };

        const Icon = actionConfig.icon;
        const canExecute = action.metadata?.can_execute ?? false;
        const reason = action.metadata?.reason;

        return (
            <Button
                key={action.action}
                onClick={() => handleOpenDialog(action)}
                disabled={isTransitioning || !canExecute}
                variant={actionConfig.variant}
                className={actionConfig.className}
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
                        {selectedAction && ACTION_CONFIGS[selectedAction.action]?.requiresBCH && (
                            <>
                                <div className="space-y-2">
                                    <Label>BCH Selection</Label>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="new-bch"
                                            checked={createNewBch}
                                            onChange={() => setCreateNewBch(true)}
                                        />
                                        <Label htmlFor="new-bch">Create New BCH</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <input
                                            type="radio"
                                            id="existing-bch"
                                            checked={!createNewBch}
                                            onChange={() => setCreateNewBch(false)}
                                        />
                                        <Label htmlFor="existing-bch">Add to Existing BCH</Label>
                                    </div>
                                </div>

                                {!createNewBch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="bch">Select BCH</Label>
                                        <Select value={bchId} onValueChange={setBchId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a BCH" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">BCH-001</SelectItem>
                                                <SelectItem value="2">BCH-002</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </>
                        )}

                        {selectedAction && ACTION_CONFIGS[selectedAction.action]?.requiresVehicle && (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="vehicle">Vehicle <span className="text-destructive">*</span></Label>
                                    <Select value={vehicleId} onValueChange={setVehicleId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select vehicle" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Vehicle 1 - ABC123</SelectItem>
                                            <SelectItem value="2">Vehicle 2 - DEF456</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="driver">Driver <span className="text-destructive">*</span></Label>
                                    <Select value={driverId} onValueChange={setDriverId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select driver" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">Driver 1</SelectItem>
                                            <SelectItem value="2">Driver 2</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </>
                        )}

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
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSubmit} disabled={isTransitioning}>
                            {isTransitioning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
