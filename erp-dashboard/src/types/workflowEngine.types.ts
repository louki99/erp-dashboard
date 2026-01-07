/**
 * Workflow Engine Types
 * Based on the Workflow Engine API specification
 */

// ============================================================================
// Graph Types (for visualization)
// ============================================================================

export interface WorkflowNodePosition {
    x: number;
    y: number;
}

export interface WorkflowNodeData {
    label: string;
    is_initial?: boolean;
    is_final?: boolean;
    role_code?: string | null;
    description?: string;
}

export interface WorkflowNode {
    id: string; // step code
    type: 'default' | 'input' | 'output';
    position: WorkflowNodePosition;
    data: WorkflowNodeData;
}

export interface WorkflowEdgeData {
    action: string;
    label?: string;
    condition?: string;
}

export interface WorkflowEdge {
    id: string;
    source: string; // source step code
    target: string; // target step code
    label?: string;
    data?: WorkflowEdgeData;
}

export interface WorkflowGraph {
    id: number;
    code: string;
    name?: string;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
}

// ============================================================================
// Instance Types (for state management)
// ============================================================================

export interface WorkflowStep {
    id: number;
    code: string;
    name: string;
    description?: string;
    role_code?: string | null;
    is_initial?: boolean;
    is_final?: boolean;
}

export interface AllowedActionMetadata {
    can_execute: boolean;
    reason?: string;
    requires_permission?: string;
    [key: string]: any;
}

export interface AllowedAction {
    action: string;
    label: string;
    metadata: AllowedActionMetadata;
    icon?: string;
    variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning';
}

export interface WorkflowInstance {
    id: number;
    workflow_definition_id: number; // Backend uses this instead of workflow_id
    workflowable_type: string; // Backend uses this instead of model_type
    workflowable_id: number; // Backend uses this instead of model_id
    current_step_id: number;
    status: 'in_progress' | 'completed' | 'cancelled' | 'failed';
    initiated_by: number;
    initiated_at: string;
    completed_at?: string | null;
    metadata?: any;
    created_at: string;
    updated_at: string;

    // Computed properties for compatibility
    workflow_id?: number; // Alias for workflow_definition_id
    model_type?: string; // Alias for workflowable_type
    model_id?: number; // Alias for workflowable_id
}

export interface WorkflowInstanceDetail {
    instance: WorkflowInstance;
    current_step: WorkflowStep;
    allowed_actions: AllowedAction[];
}

// ============================================================================
// Transition Types
// ============================================================================

export interface TransitionRequest {
    action: string;
    notes?: string;
    metadata?: Record<string, any>;
}

export interface TransitionResponse {
    success: boolean;
    message: string;
    instance: WorkflowInstance;
    previous_step?: WorkflowStep;
    current_step?: WorkflowStep;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface WorkflowGraphResponse {
    success: boolean;
    graph: WorkflowGraph;
}

export interface WorkflowInstanceResponse {
    success: boolean;
    data: WorkflowInstanceDetail;
}

export interface WorkflowInstanceByModelResponse {
    // Backend returns the instance directly, not wrapped in a response object
    id: number;
    workflow_definition_id: number;
    workflowable_type: string;
    workflowable_id: number;
    current_step_id: number;
    status: string;
    initiated_by: number;
    initiated_at: string;
    completed_at: string | null;
    metadata: any;
    created_at: string;
    updated_at: string;
    current_step: any;
    workflow_definition: any;
}

export interface CreateWorkflowInstanceRequest {
    workflow_id: number;
    model_type: string;
    model_id: number;
    initial_data?: Record<string, any>;
}

export interface CreateWorkflowInstanceResponse {
    // Backend can return instance directly or wrapped
    id?: number; // Direct instance ID
    success?: boolean;
    message?: string;
    instance?: WorkflowInstance;
    data?: any; // Allow for nested data structures from backend
}

// ============================================================================
// Workflow Definition Types (for admin/configuration)
// ============================================================================

export interface WorkflowDefinition {
    id: number;
    code: string;
    name: string;
    description?: string;
    model_type: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface WorkflowStepDefinition {
    id: number;
    workflow_id: number;
    code: string;
    name: string;
    description?: string;
    role_code?: string | null;
    is_initial: boolean;
    is_final: boolean;
    position_x?: number;
    position_y?: number;
    created_at: string;
    updated_at: string;
}

export interface WorkflowTransitionDefinition {
    id: number;
    workflow_id: number;
    from_step_id: number;
    to_step_id: number;
    action: string;
    label: string;
    condition?: string;
    requires_permission?: string;
    created_at: string;
    updated_at: string;
}

// ============================================================================
// History Types
// ============================================================================

export interface WorkflowHistoryEntry {
    id: number;
    instance_id: number;
    from_step_id: number | null;
    to_step_id: number;
    action: string;
    notes?: string;
    user_id: number;
    user_name?: string;
    created_at: string;
    metadata?: Record<string, any>;
}

export interface WorkflowHistoryResponse {
    success: boolean;
    history: WorkflowHistoryEntry[];
}
