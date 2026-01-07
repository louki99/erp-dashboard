import { useMemo } from 'react';
import type { Node, Edge } from 'reactflow';
import { calculateWorkflowLayout, getRecommendedDirection } from '@/lib/workflow/layoutEngine';
import type { WorkflowNode, WorkflowEdge } from '@/types/workflowEngine.types';

export interface UseWorkflowLayoutOptions {
    direction?: 'TB' | 'LR' | 'BT' | 'RL';
    nodeWidth?: number;
    nodeHeight?: number;
    autoDirection?: boolean;
}

export interface UseWorkflowLayoutReturn {
    nodes: Node[];
    edges: Edge[];
    direction: 'TB' | 'LR' | 'BT' | 'RL';
}

/**
 * Hook for calculating workflow layout using dagre
 * @param workflowNodes - Nodes from workflow graph API
 * @param workflowEdges - Edges from workflow graph API
 * @param options - Layout options
 * @returns Layouted nodes and edges for React Flow
 */
export function useWorkflowLayout(
    workflowNodes: WorkflowNode[],
    workflowEdges: WorkflowEdge[],
    options: UseWorkflowLayoutOptions = {}
): UseWorkflowLayoutReturn {
    const {
        direction: userDirection,
        nodeWidth = 250,
        nodeHeight = 100,
        autoDirection = true,
    } = options;

    const layout = useMemo(() => {
        if (!workflowNodes || workflowNodes.length === 0) {
            return {
                nodes: [],
                edges: [],
                direction: 'TB' as const,
            };
        }

        // Determine layout direction
        const direction = userDirection || (
            autoDirection
                ? getRecommendedDirection(workflowNodes.length)
                : 'TB'
        );

        // Calculate layout
        const { nodes, edges } = calculateWorkflowLayout(
            workflowNodes,
            workflowEdges,
            {
                direction,
                nodeWidth,
                nodeHeight,
            }
        );

        return {
            nodes,
            edges,
            direction,
        };
    }, [workflowNodes, workflowEdges, userDirection, nodeWidth, nodeHeight, autoDirection]);

    return layout;
}
