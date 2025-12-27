import { useCallback, useMemo } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    MarkerType,
    Position,
} from 'reactflow';
import type { Node, Edge } from 'reactflow';
import 'reactflow/dist/style.css';
import type { WorkflowTaskTemplate, WorkflowTask } from '@/types/task.types';
import { CheckCircle, Clock, AlertCircle, Circle, XCircle } from 'lucide-react';

interface WorkflowVisualizationProps {
    templates?: WorkflowTaskTemplate[];
    tasks?: WorkflowTask[];
    mode: 'template' | 'execution';
    onNodeClick?: (nodeId: string) => void;
}

const getStatusColor = (status?: string) => {
    switch (status) {
        case 'completed':
            return { bg: '#10b981', border: '#059669', text: '#ffffff' };
        case 'in_progress':
            return { bg: '#f59e0b', border: '#d97706', text: '#ffffff' };
        case 'ready':
            return { bg: '#3b82f6', border: '#2563eb', text: '#ffffff' };
        case 'failed':
            return { bg: '#ef4444', border: '#dc2626', text: '#ffffff' };
        case 'cancelled':
            return { bg: '#6b7280', border: '#4b5563', text: '#ffffff' };
        case 'pending':
        default:
            return { bg: '#e5e7eb', border: '#9ca3af', text: '#374151' };
    }
};

const getStatusIcon = (status?: string) => {
    switch (status) {
        case 'completed':
            return <CheckCircle className="w-4 h-4" />;
        case 'in_progress':
            return <Clock className="w-4 h-4" />;
        case 'failed':
            return <XCircle className="w-4 h-4" />;
        case 'ready':
            return <AlertCircle className="w-4 h-4" />;
        default:
            return <Circle className="w-4 h-4" />;
    }
};

const getTaskTypeColor = (taskType: string) => {
    const colors: Record<string, string> = {
        creation: '#8b5cf6',
        validation: '#3b82f6',
        conversion: '#06b6d4',
        approval: '#10b981',
        dispatch: '#f59e0b',
        preparation: '#ec4899',
        delivery: '#14b8a6',
        control: '#6366f1',
        notification: '#a855f7',
        processing: '#64748b',
    };
    return colors[taskType] || '#6b7280';
};

export function WorkflowVisualization({
    templates,
    tasks,
    mode,
    onNodeClick,
}: WorkflowVisualizationProps) {
    const data = mode === 'template' ? templates : tasks;

    const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
        if (!data || data.length === 0) {
            return { nodes: [], edges: [] };
        }

        const sortedData = [...data].sort((a, b) => a.order - b.order);
        const nodes: Node[] = [];
        const edges: Edge[] = [];

        const VERTICAL_SPACING = 150;
        const HORIZONTAL_SPACING = 300;
        const NODE_WIDTH = 250;

        let maxNodesInRow = 3;
        let currentRow = 0;
        let currentCol = 0;

        sortedData.forEach((item, index) => {
            const isTask = 'status' in item;
            const status = isTask ? (item as WorkflowTask).status : undefined;
            const colors = getStatusColor(status);
            const taskType = item.task_type;
            const typeColor = getTaskTypeColor(taskType);

            if (currentCol >= maxNodesInRow) {
                currentCol = 0;
                currentRow++;
            }

            const x = currentCol * HORIZONTAL_SPACING + 50;
            const y = currentRow * VERTICAL_SPACING + 50;

            nodes.push({
                id: item.id.toString(),
                type: 'default',
                position: { x, y },
                data: {
                    label: (
                        <div className="p-3 min-w-[220px]">
                            <div className="flex items-center gap-2 mb-2">
                                <div
                                    className="p-1.5 rounded"
                                    style={{ backgroundColor: typeColor + '20', color: typeColor }}
                                >
                                    {getStatusIcon(status)}
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold text-sm text-gray-900 leading-tight">
                                        {item.name}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                        {item.task_type}
                                    </div>
                                </div>
                            </div>

                            {isTask && (
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div
                                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                                        style={{
                                            backgroundColor: colors.bg,
                                            color: colors.text,
                                        }}
                                    >
                                        {status}
                                    </div>
                                </div>
                            )}

                            {item.timeout_minutes && (
                                <div className="text-xs text-gray-500 mt-2">
                                    ⏱️ {item.timeout_minutes}min
                                </div>
                            )}

                            <div className="text-xs text-gray-400 mt-1">
                                Order: {item.order}
                            </div>
                        </div>
                    ),
                },
                style: {
                    background: '#ffffff',
                    border: `2px solid ${colors.border}`,
                    borderRadius: '8px',
                    padding: 0,
                    width: NODE_WIDTH,
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                },
                sourcePosition: Position.Right,
                targetPosition: Position.Left,
            });

            currentCol++;

            const dependencies = isTask
                ? (item as WorkflowTask).dependencies
                : (item as WorkflowTaskTemplate).dependencies;

            if (dependencies && dependencies.length > 0) {
                dependencies.forEach((dep) => {
                    const sourceId = isTask
                        ? ('depends_on_task_id' in dep ? dep.depends_on_task_id?.toString() : undefined)
                        : ('depends_on_template_id' in dep ? dep.depends_on_template_id?.toString() : undefined);

                    if (sourceId) {
                        const edgeType = dep.dependency_type;
                        const edgeColor =
                            edgeType === 'blocking'
                                ? '#ef4444'
                                : edgeType === 'soft'
                                ? '#f59e0b'
                                : '#10b981';

                        edges.push({
                            id: `e-${sourceId}-${item.id}`,
                            source: sourceId,
                            target: item.id.toString(),
                            type: 'smoothstep',
                            animated: edgeType === 'blocking',
                            style: {
                                stroke: edgeColor,
                                strokeWidth: 2,
                            },
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                color: edgeColor,
                            },
                            label: edgeType,
                            labelStyle: {
                                fill: edgeColor,
                                fontSize: 10,
                                fontWeight: 600,
                            },
                            labelBgStyle: {
                                fill: '#ffffff',
                                fillOpacity: 0.9,
                            },
                        });
                    }
                });
            } else if (index > 0) {
                const prevItem = sortedData[index - 1];
                edges.push({
                    id: `e-${prevItem.id}-${item.id}`,
                    source: prevItem.id.toString(),
                    target: item.id.toString(),
                    type: 'smoothstep',
                    animated: false,
                    style: {
                        stroke: '#9ca3af',
                        strokeWidth: 2,
                        strokeDasharray: '5,5',
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: '#9ca3af',
                    },
                });
            }
        });

        return { nodes, edges };
    }, [data, mode]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onNodeClickHandler = useCallback(
        (event: React.MouseEvent, node: Node) => {
            if (onNodeClick) {
                onNodeClick(node.id);
            }
        },
        [onNodeClick]
    );

    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                <div className="text-center">
                    <Circle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No workflow data available</p>
                    <p className="text-sm text-gray-500 mt-1">
                        {mode === 'template'
                            ? 'Create templates to visualize the workflow'
                            : 'No tasks have been created yet'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[600px] bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClickHandler}
                fitView
                attributionPosition="bottom-left"
                minZoom={0.5}
                maxZoom={1.5}
            >
                <Background color="#e5e7eb" gap={16} />
                <Controls />
                <MiniMap
                    nodeColor={(node) => {
                        const isTask = tasks && tasks.length > 0;
                        if (isTask) {
                            const task = tasks?.find((t) => t.id.toString() === node.id);
                            return getStatusColor(task?.status).bg;
                        }
                        return '#e5e7eb';
                    }}
                    maskColor="rgba(0, 0, 0, 0.1)"
                />
            </ReactFlow>

            <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3 border border-gray-200">
                <div className="text-xs font-semibold text-gray-700 mb-2">Legend</div>
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-red-500"></div>
                        <span className="text-gray-600">Blocking</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-orange-500"></div>
                        <span className="text-gray-600">Soft</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-green-500"></div>
                        <span className="text-gray-600">Parallel</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 bg-gray-400 border-dashed border-t"></div>
                        <span className="text-gray-600">Sequential</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
