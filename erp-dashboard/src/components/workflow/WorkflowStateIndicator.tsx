import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface WorkflowStateIndicatorProps {
    state: string;
    className?: string;
}

const stateConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' }> = {
    submitted: { label: 'Submitted', variant: 'default' },
    adv_review: { label: 'ADV Review', variant: 'warning' },
    adv_approved: { label: 'ADV Approved', variant: 'success' },
    adv_rejected: { label: 'ADV Rejected', variant: 'destructive' },
    adv_on_hold: { label: 'On Hold', variant: 'secondary' },
    confirmed: { label: 'Confirmed', variant: 'success' },
    converted_to_bl: { label: 'Converted to BL', variant: 'success' },
    draft: { label: 'Draft', variant: 'outline' },
    grouped: { label: 'Grouped', variant: 'default' },
    pending: { label: 'Pending', variant: 'warning' },
    in_preparation: { label: 'In Preparation', variant: 'warning' },
    in_progress: { label: 'In Progress', variant: 'warning' },
    prepared: { label: 'Prepared', variant: 'success' },
    loaded: { label: 'Loaded', variant: 'default' },
    in_transit: { label: 'In Transit', variant: 'default' },
    delivered: { label: 'Delivered', variant: 'success' },
    returned: { label: 'Returned', variant: 'destructive' },
    completed: { label: 'Completed', variant: 'success' },
    cancelled: { label: 'Cancelled', variant: 'destructive' },
    paused: { label: 'Paused', variant: 'secondary' },
};

export function WorkflowStateIndicator({ state, className }: WorkflowStateIndicatorProps) {
    const config = stateConfig[state] || { label: state, variant: 'default' as const };

    return (
        <Badge variant={config.variant} className={cn('font-medium', className)}>
            {config.label}
        </Badge>
    );
}
