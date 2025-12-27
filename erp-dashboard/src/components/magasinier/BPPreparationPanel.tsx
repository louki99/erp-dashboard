import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, CheckCircle, Loader2, Package } from 'lucide-react';
import { useMagasinierBPWorkflow, useMagasinierRealtimeProgress } from '@/hooks/magasinier/useMagasinierWorkflow';
import { WorkflowStateIndicator } from '@/components/workflow/WorkflowStateIndicator';
import toast from 'react-hot-toast';

interface BPItem {
    id: number;
    product_id: number;
    product_name: string;
    product_code: string;
    quantity: number;
    prepared_quantity: number;
    unit: string;
}

interface BPPreparationPanelProps {
    bpId: number;
    items: BPItem[];
    onSuccess?: () => void;
}

export function BPPreparationPanel({ bpId, items: initialItems, onSuccess }: BPPreparationPanelProps) {
    const { workflowState, isTransitioning, canPerformAction, actions, isUpdatingItems } = useMagasinierBPWorkflow(bpId);
    const { progress } = useMagasinierRealtimeProgress(bpId);
    const [items, setItems] = useState<BPItem[]>(initialItems);
    const [editingItemId, setEditingItemId] = useState<number | null>(null);
    const [tempQuantity, setTempQuantity] = useState<string>('');

    useEffect(() => {
        setItems(initialItems);
    }, [initialItems]);

    const handleStartEdit = (item: BPItem) => {
        setEditingItemId(item.id);
        setTempQuantity(item.prepared_quantity.toString());
    };

    const handleSaveQuantity = async (item: BPItem) => {
        const quantity = parseFloat(tempQuantity);
        if (isNaN(quantity) || quantity < 0) {
            toast.error('Invalid quantity');
            return;
        }

        if (quantity > item.quantity) {
            toast.error('Prepared quantity cannot exceed ordered quantity');
            return;
        }

        try {
            await actions.updateSingleItem(item.product_id, quantity);
            setItems(prev =>
                prev.map(i =>
                    i.id === item.id ? { ...i, prepared_quantity: quantity } : i
                )
            );
            setEditingItemId(null);
            toast.success('Quantity updated');
        } catch (error) {
            toast.error('Failed to update quantity');
        }
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setTempQuantity('');
    };

    const handleQuickAdd = async (item: BPItem, amount: number) => {
        const newQuantity = Math.min(item.prepared_quantity + amount, item.quantity);
        try {
            await actions.updateSingleItem(item.product_id, newQuantity);
            setItems(prev =>
                prev.map(i =>
                    i.id === item.id ? { ...i, prepared_quantity: newQuantity } : i
                )
            );
        } catch (error) {
            toast.error('Failed to update quantity');
        }
    };

    if (!workflowState) {
        return null;
    }

    const progressPercentage = progress?.progress || 0;
    const isInProgress = workflowState.current_state === 'in_progress';
    const isCompleted = workflowState.current_state === 'completed';

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle>Preparation Progress</CardTitle>
                        <WorkflowStateIndicator state={workflowState.current_state} />
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Overall Progress</span>
                            <span className="font-medium">{progressPercentage.toFixed(0)}%</span>
                        </div>
                        <Progress value={progressPercentage} className="h-2" />
                    </div>

                    {progress && (
                        <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Total Items</p>
                                <p className="text-2xl font-bold">{progress.total_items}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Prepared</p>
                                <p className="text-2xl font-bold text-green-600">{progress.prepared_items}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Remaining</p>
                                <p className="text-2xl font-bold text-orange-600">{progress.remaining_items}</p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4">
                        {canPerformAction('in_progress') && !isInProgress && (
                            <Button
                                onClick={() => actions.startPreparation()}
                                disabled={isTransitioning}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                {isTransitioning ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Play className="mr-2 h-4 w-4" />
                                )}
                                Start Preparation
                            </Button>
                        )}

                        {canPerformAction('paused') && isInProgress && (
                            <Button
                                onClick={() => actions.pausePreparation('Taking a break')}
                                disabled={isTransitioning}
                                variant="outline"
                            >
                                {isTransitioning ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Pause className="mr-2 h-4 w-4" />
                                )}
                                Pause
                            </Button>
                        )}

                        {canPerformAction('completed') && isInProgress && (
                            <Button
                                onClick={() => actions.completePreparation()}
                                disabled={isTransitioning || progressPercentage < 100}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {isTransitioning ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Complete Preparation
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Items to Prepare</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {items.map((item) => {
                            const isEditing = editingItemId === item.id;
                            const isFullyPrepared = item.prepared_quantity >= item.quantity;
                            const progressPercent = (item.prepared_quantity / item.quantity) * 100;

                            return (
                                <div
                                    key={item.id}
                                    className={`border rounded-lg p-4 space-y-3 ${
                                        isFullyPrepared ? 'bg-green-50 dark:bg-green-950' : ''
                                    }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                <h4 className="font-medium">{item.product_name}</h4>
                                                {isFullyPrepared && (
                                                    <Badge variant="default" className="bg-green-600">
                                                        Complete
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Code: {item.product_code}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">Progress</span>
                                            <span className="font-medium">
                                                {item.prepared_quantity} / {item.quantity} {item.unit}
                                            </span>
                                        </div>
                                        <Progress value={progressPercent} className="h-2" />
                                    </div>

                                    {isInProgress && !isCompleted && (
                                        <div className="flex items-center gap-2">
                                            {isEditing ? (
                                                <>
                                                    <Input
                                                        type="number"
                                                        value={tempQuantity}
                                                        onChange={(e) => setTempQuantity(e.target.value)}
                                                        className="w-32"
                                                        min="0"
                                                        max={item.quantity}
                                                        step="0.1"
                                                        disabled={isUpdatingItems}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleSaveQuantity(item)}
                                                        disabled={isUpdatingItems}
                                                    >
                                                        {isUpdatingItems ? (
                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                        ) : (
                                                            'Save'
                                                        )}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleCancelEdit}
                                                        disabled={isUpdatingItems}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleQuickAdd(item, 1)}
                                                        disabled={isFullyPrepared || isUpdatingItems}
                                                    >
                                                        +1
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleQuickAdd(item, 5)}
                                                        disabled={isFullyPrepared || isUpdatingItems}
                                                    >
                                                        +5
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleQuickAdd(item, 10)}
                                                        disabled={isFullyPrepared || isUpdatingItems}
                                                    >
                                                        +10
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleStartEdit(item)}
                                                        disabled={isFullyPrepared || isUpdatingItems}
                                                    >
                                                        Edit
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="default"
                                                        onClick={() => actions.updateSingleItem(item.product_id, item.quantity)}
                                                        disabled={isFullyPrepared || isUpdatingItems}
                                                        className="bg-green-600 hover:bg-green-700"
                                                    >
                                                        Mark Complete
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
