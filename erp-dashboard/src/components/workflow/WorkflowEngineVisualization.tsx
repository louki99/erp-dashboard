import { useCallback, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    type Node,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { WorkflowStepNode } from './nodes/WorkflowStepNode';
import { useWorkflowEngine } from '@/hooks/workflow/useWorkflowEngine';
import { useWorkflowLayout } from '@/hooks/workflow/useWorkflowLayout';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const nodeTypes = {
    workflowStep: WorkflowStepNode,
};

export interface WorkflowEngineVisualizationProps {
    workflowId?: number;
    workflowCode?: string;
    instanceId?: number;
    modelType?: string;
    modelId?: number;
    height?: string;
    className?: string;
    onNodeClick?: (stepCode: string) => void;
    showMiniMap?: boolean;
    showControls?: boolean;
}

/**
 * Main Workflow Engine Visualization Component
 * Displays workflow graph with current state highlighting
 */
export function WorkflowEngineVisualization({
    workflowId,
    workflowCode,
    instanceId,
    modelType,
    modelId,
    height = '600px',
    className,
    onNodeClick,
    showMiniMap = true,
    showControls = true,
}: WorkflowEngineVisualizationProps) {
    // Use workflow engine hook
    const {
        graph,
        currentStep,
        isLoading,
        error,
    } = useWorkflowEngine({
        workflowId,
        workflowCode,
        instanceId,
        modelType,
        modelId,
        autoFetch: true,
    });

    // Enhance nodes with current step information
    const enhancedNodes = useMemo(() => {
        if (!graph?.nodes) return [];

        return graph.nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                isCurrent: currentStep?.code === node.id,
            },
        }));
    }, [graph?.nodes, currentStep]);

    // Calculate layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = useWorkflowLayout(
        enhancedNodes,
        graph?.edges || [],
        { autoDirection: true }
    );

    // Convert to React Flow format with custom node type
    const reactFlowNodes = useMemo(() => {
        return layoutedNodes.map(node => ({
            ...node,
            type: 'workflowStep',
        }));
    }, [layoutedNodes]);

    // Enhance edges with styling
    const reactFlowEdges = useMemo(() => {
        return layoutedEdges.map(edge => ({
            ...edge,
            type: 'smoothstep',
            animated: false,
            style: {
                stroke: '#9ca3af',
                strokeWidth: 2,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: '#9ca3af',
            },
            labelStyle: {
                fill: '#374151',
                fontSize: 11,
                fontWeight: 600,
            },
            labelBgStyle: {
                fill: '#ffffff',
                fillOpacity: 0.9,
            },
        }));
    }, [layoutedEdges]);

    const [nodes, setNodes, onNodesChange] = useNodesState(reactFlowNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);

    // Update nodes when layout changes
    useMemo(() => {
        setNodes(reactFlowNodes);
    }, [reactFlowNodes, setNodes]);

    // Update edges when layout changes
    useMemo(() => {
        setEdges(reactFlowEdges);
    }, [reactFlowEdges, setEdges]);

    const handleNodeClick = useCallback(
        (_event: React.MouseEvent, node: Node) => {
            if (onNodeClick) {
                onNodeClick(node.id);
            }
        },
        [onNodeClick]
    );

    // Loading state
    if (isLoading) {
        return (
            <div
                className={cn(
                    'flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700',
                    className
                )}
                style={{ height }}
            >
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-sage-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Loading workflow...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div
                className={cn(
                    'flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800',
                    className
                )}
                style={{ height }}
            >
                <div className="text-center max-w-md px-4">
                    <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                    <p className="text-sm font-medium text-red-900 dark:text-red-200 mb-1">
                        Failed to load workflow
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300">
                        {error.message}
                    </p>
                </div>
            </div>
        );
    }

    // Empty state
    if (!graph || nodes.length === 0) {
        return (
            <div
                className={cn(
                    'flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700',
                    className
                )}
                style={{ height }}
            >
                <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        No workflow data available
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={cn(
                'bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden',
                className
            )}
            style={{ height }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                minZoom={0.3}
                maxZoom={1.5}
                defaultEdgeOptions={{
                    type: 'smoothstep',
                }}
            >
                <Background color="#e5e7eb" gap={16} />
                {showControls && <Controls />}
                {showMiniMap && (
                    <MiniMap
                        nodeColor={(node) => {
                            const data = node.data as any;
                            if (data.isCurrent) return '#00b06b';
                            if (data.is_initial) return '#3b82f6';
                            if (data.is_final) return '#10b981';
                            return '#e5e7eb';
                        }}
                        maskColor="rgba(0, 0, 0, 0.1)"
                        style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                        }}
                    />
                )}
            </ReactFlow>

            {/* Current Step Indicator */}
            {currentStep && (
                <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-4 py-2 border border-gray-200 dark:border-gray-700">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Current Step
                    </div>
                    <div className="text-sm font-bold text-sage-600 dark:text-sage-400">
                        {currentStep.name}
                    </div>
                </div>
            )}
        </div>
    );
}
