import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowAction {
    action: string;
    label: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    icon?: React.ReactNode;
    requiresConfirmation?: boolean;
}

interface WorkflowActionButtonsProps {
    actions: WorkflowAction[];
    allowedActions: string[];
    onAction: (action: string) => void | Promise<void>;
    isLoading?: boolean;
    className?: string;
}

export function WorkflowActionButtons({
    actions,
    allowedActions,
    onAction,
    isLoading = false,
    className,
}: WorkflowActionButtonsProps) {
    const handleAction = async (action: string, requiresConfirmation?: boolean) => {
        if (requiresConfirmation) {
            const confirmed = window.confirm(`Are you sure you want to perform this action?`);
            if (!confirmed) return;
        }
        await onAction(action);
    };

    const availableActions = actions.filter(action => allowedActions.includes(action.action));

    if (availableActions.length === 0) {
        return null;
    }

    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            {availableActions.map(({ action, label, variant = 'default', icon, requiresConfirmation }) => (
                <Button
                    key={action}
                    variant={variant}
                    onClick={() => handleAction(action, requiresConfirmation)}
                    disabled={isLoading}
                    className="min-w-[100px]"
                >
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : icon ? (
                        <span className="mr-2">{icon}</span>
                    ) : null}
                    {label}
                </Button>
            ))}
        </div>
    );
}
