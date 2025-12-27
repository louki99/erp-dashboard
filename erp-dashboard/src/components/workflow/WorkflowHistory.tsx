import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Clock, User, MessageSquare } from 'lucide-react';
import type { WorkflowHistory as WorkflowHistoryType } from '@/services/api/workflowStateApi';

interface WorkflowHistoryProps {
    history: WorkflowHistoryType[];
    isLoading?: boolean;
}

export function WorkflowHistory({ history, isLoading }: WorkflowHistoryProps) {
    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Workflow History</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!history || history.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Workflow History</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No history available</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Workflow History</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {history.map((entry, index) => (
                        <div
                            key={entry.id}
                            className="relative flex gap-4 pb-4 border-b last:border-b-0 last:pb-0"
                        >
                            {index !== history.length - 1 && (
                                <div className="absolute left-[11px] top-[28px] h-full w-0.5 bg-border" />
                            )}
                            
                            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background">
                                <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>

                            <div className="flex-1 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">{entry.from_step}</Badge>
                                        <span className="text-muted-foreground">→</span>
                                        <Badge>{entry.to_step}</Badge>
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{entry.user}</span>
                                    <span className="text-muted-foreground">performed</span>
                                    <Badge variant="secondary" className="text-xs">
                                        {entry.action}
                                    </Badge>
                                </div>

                                {entry.comment && (
                                    <div className="flex gap-2 text-sm text-muted-foreground">
                                        <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" />
                                        <p>{entry.comment}</p>
                                    </div>
                                )}

                                {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                                    <details className="text-xs">
                                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                            View metadata
                                        </summary>
                                        <pre className="mt-2 rounded bg-muted p-2 overflow-auto">
                                            {JSON.stringify(entry.metadata, null, 2)}
                                        </pre>
                                    </details>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
