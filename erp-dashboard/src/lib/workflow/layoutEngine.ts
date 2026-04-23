import dagre from 'dagre';
import type { Node, Edge } from 'reactflow';
import type { WorkflowNode, WorkflowEdge } from '@/types/workflowEngine.types';

export interface LayoutOptions {
    direction?: 'TB' | 'LR' | 'BT' | 'RL';
    nodeWidth?: number;
    nodeHeight?: number;
    rankSep?: number;
    nodeSep?: number;
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
    direction: 'TB', // Top to Bottom
    nodeWidth: 250,
    nodeHeight: 100,
    rankSep: 100, // Vertical spacing between ranks
    nodeSep: 80, // Horizontal spacing between nodes
};

/**
 * Calculate layout positions for workflow nodes using Dagre
 * @param nodes - Workflow nodes from API
 * @param edges - Workflow edges from API
 * @param options - Layout configuration options
 * @returns Nodes and edges with calculated positions for React Flow
 */
export function calculateWorkflowLayout(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    options: LayoutOptions = {}
): { nodes: Node[]; edges: Edge[] } {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Create a new directed graph
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configure the graph
    dagreGraph.setGraph({
        rankdir: opts.direction,
        ranksep: opts.rankSep,
        nodesep: opts.nodeSep,
    });

    // Add nodes to the graph
    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, {
            width: opts.nodeWidth,
            height: opts.nodeHeight,
        });
    });

    // Add edges to the graph
    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    // Calculate the layout
    dagre.layout(dagreGraph);

    // Map nodes with calculated positions
    const layoutedNodes: Node[] = nodes.map((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);

        return {
            id: node.id,
            type: node.type || 'default',
            position: {
                x: nodeWithPosition.x - opts.nodeWidth / 2,
                y: nodeWithPosition.y - opts.nodeHeight / 2,
            },
            data: node.data,
        };
    });

    // Map edges for React Flow
    const layoutedEdges: Edge[] = edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        type: 'smoothstep',
        animated: false,
        data: edge.data,
    }));

    return {
        nodes: layoutedNodes,
        edges: layoutedEdges,
    };
}

/**
 * Get layout direction based on graph complexity
 * @param nodeCount - Number of nodes in the graph
 * @returns Recommended layout direction
 */
export function getRecommendedDirection(nodeCount: number): 'TB' | 'LR' {
    // For simple workflows (< 5 nodes), use top-to-bottom
    // For complex workflows, use left-to-right for better horizontal space
    return nodeCount < 5 ? 'TB' : 'LR';
}

/**
 * Calculate optimal node dimensions based on content
 * @param label - Node label text
 * @param hasDescription - Whether node has description
 * @returns Width and height for the node
 */
export function calculateNodeDimensions(label: string, hasDescription: boolean = false): {
    width: number;
    height: number;
} {
    const baseWidth = 250;
    const baseHeight = hasDescription ? 120 : 100;

    // Adjust width based on label length
    const labelLength = label.length;
    const width = Math.max(baseWidth, Math.min(labelLength * 8, 400));

    return { width, height: baseHeight };
}

/**
 * Center the graph in the viewport
 * @param nodes - Layouted nodes
 * @param viewportWidth - Viewport width
 * @param viewportHeight - Viewport height
 * @returns Centered nodes
 */
export function centerGraph(
    nodes: Node[],
    viewportWidth: number,
    viewportHeight: number
): Node[] {
    if (nodes.length === 0) return nodes;

    // Find bounding box
    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(...nodes.map((n) => n.position.x + 250)); // assuming node width
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + 100)); // assuming node height

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    const offsetX = (viewportWidth - graphWidth) / 2 - minX;
    const offsetY = (viewportHeight - graphHeight) / 2 - minY;

    return nodes.map((node) => ({
        ...node,
        position: {
            x: node.position.x + offsetX,
            y: node.position.y + offsetY,
        },
    }));
}
