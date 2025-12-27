// Task Workflow System - TypeScript Type Definitions
// Based on ERP Workflow Documentation v1.0

// ========== Enums & Constants ==========

export type TaskStatus = 'pending' | 'ready' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export type TaskType = 
    | 'creation' 
    | 'validation' 
    | 'conversion' 
    | 'dispatch' 
    | 'preparation' 
    | 'delivery' 
    | 'control' 
    | 'approval'
    | 'notification'
    | 'processing';

export type WorkflowType = 'bc' | 'bl' | 'bch' | 'bp';

export type AssignmentType = 'system' | 'role' | 'user' | 'pool';

export type DependencyType = 'blocking' | 'soft' | 'parallel';

// ========== Core Entities ==========

export interface WorkflowTask {
    id: number;
    code: string;
    name: string;
    description: string;
    task_type: TaskType;
    workflow_type: WorkflowType;
    status: TaskStatus;
    order: number;
    timeout_minutes: number | null;
    can_start: boolean;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    taskable_type: string;
    taskable_id: number;
    taskable?: TaskableEntity;
    template_id: number | null;
    template_version: number | null;
    input_data: Record<string, any> | null;
    output_data: Record<string, any> | null;
    error_message: string | null;
    assignments: TaskAssignment[];
    validation_rules: ValidationRule[];
    dependencies: TaskDependency[];
    created_at: string;
    updated_at: string;
}

export interface TaskAssignment {
    id: number;
    task_id: number;
    assignment_type: AssignmentType;
    role_name: string | null;
    user_id: number | null;
    user_name: string | null;
    pool_name: string | null;
    status: 'pending' | 'claimed' | 'completed';
    claimed_at: string | null;
    completed_at: string | null;
}

export interface ValidationRule {
    id: number;
    task_id: number;
    rule_code: string;
    rule_name: string;
    description: string | null;
    validator_class: string;
    order: number;
    is_required: boolean;
    stop_on_failure: boolean;
    parameters: Record<string, any> | null;
    last_execution_result: ValidationResult | null;
}

export interface ValidationResult {
    rule_code: string;
    rule_name: string;
    passed: boolean;
    message: string;
    executed_at: string;
    details?: Record<string, any>;
}

export interface TaskDependency {
    id: number;
    task_id: number;
    depends_on_task_id: number;
    dependency_type: DependencyType;
    depends_on_task?: WorkflowTask;
}

export interface TaskableEntity {
    type: string;
    id: number;
    bc_number?: string;
    order_number?: string;
    total_amount?: number | string;
    partner?: {
        id: number;
        name: string;
        code: string;
    };
    [key: string]: any;
}

// ========== Workflow Progress ==========

export interface WorkflowProgress {
    total: number;
    completed: number;
    failed: number;
    in_progress: number;
    pending: number;
    ready: number;
    progress_percentage: number;
    tasks: WorkflowTask[];
}

// ========== Workflow Template System ==========

export interface WorkflowDefinition {
    id: number;
    code: string;
    name: string;
    description: string | null;
    is_active: boolean;
    version: number;
    metadata: Record<string, any> | null;
    templates?: WorkflowTaskTemplate[];
    created_at: string;
    updated_at: string;
}

export interface WorkflowTaskTemplate {
    id: number;
    workflow_definition_id: number;
    code: string;
    name: string;
    description: string | null;
    task_type: TaskType;
    order: number;
    timeout_minutes: number | null;
    auto_complete: boolean;
    assignment_type: AssignmentType;
    assignment_target: string | null;
    metadata: Record<string, any> | null;
    is_active: boolean;
    dependencies?: TemplateDependency[];
    validation_rules?: TemplateValidationRule[];
    created_at: string;
    updated_at: string;
}

export interface TemplateDependency {
    id: number;
    template_id: number;
    depends_on_template_id: number;
    dependency_type: DependencyType;
    metadata: Record<string, any> | null;
}

export interface TemplateValidationRule {
    id: number;
    template_id: number;
    rule_code: string;
    rule_name: string;
    description: string | null;
    validator_class: string;
    order: number;
    is_required: boolean;
    stop_on_failure: boolean;
    parameters: Record<string, any> | null;
}

// ========== Statistics ==========

export interface TaskStatistics {
    total_tasks: number;
    by_status: {
        pending: number;
        ready: number;
        in_progress: number;
        completed: number;
        failed: number;
        cancelled: number;
    };
    by_workflow: {
        bc: number;
        bl: number;
        bch: number;
        bp: number;
    };
    by_type: Record<TaskType, number>;
    avg_completion_time_minutes: number | null;
    overdue_tasks: number;
}

export interface WorkflowStatistics {
    workflow: WorkflowDefinition;
    templates: {
        total: number;
        active: number;
        by_type: Record<TaskType, number>;
    };
    dependencies: number;
    validation_rules: number;
    usage: {
        total_instances: number;
        by_status: {
            completed: number;
            in_progress: number;
            ready: number;
            pending: number;
            failed: number;
        };
    };
}

// ========== API Request Types ==========

export interface TaskClaimRequest {
    notes?: string;
}

export interface TaskStartRequest {
    notes?: string;
}

export interface TaskExecuteRequest {
    action?: string;
    parameters?: Record<string, any>;
}

export interface TaskCompleteRequest {
    output_data?: Record<string, any>;
    notes?: string;
}

export interface TaskFailRequest {
    error_message: string;
    error_details?: Record<string, any>;
}

export interface TaskCancelRequest {
    reason: string;
}

export interface WorkflowTemplateCreateRequest {
    code: string;
    name: string;
    description?: string;
    is_active?: boolean;
}

export interface TaskTemplateCreateRequest {
    code: string;
    name: string;
    description?: string;
    task_type: TaskType;
    order: number;
    timeout_minutes?: number;
    auto_complete?: boolean;
    assignment_type: AssignmentType;
    assignment_target?: string;
    is_active?: boolean;
}

export interface TemplateDependencyCreateRequest {
    depends_on_template_id: number;
    dependency_type: DependencyType;
}

export interface TemplateValidationRuleCreateRequest {
    rule_code: string;
    rule_name: string;
    description?: string;
    validator_class: string;
    order: number;
    is_required: boolean;
    stop_on_failure: boolean;
    parameters?: Record<string, any>;
}

// ========== API Response Types ==========

export interface ApiSuccessResponse<T = any> {
    success: true;
    message: string;
    data?: T;
}

export interface ApiErrorResponse {
    success: false;
    message: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface TaskListResponse {
    success: boolean;
    tasks: PaginatedResponse<WorkflowTask> | WorkflowTask[];
}

export interface TaskDetailResponse {
    success: boolean;
    task: WorkflowTask;
}

export interface TaskExecuteResponse {
    success: boolean;
    message: string;
    task: WorkflowTask;
    validation_results?: ValidationResult[];
}

export interface WorkflowProgressResponse {
    success: boolean;
    progress: WorkflowProgress;
}

export interface WorkflowTemplateListResponse {
    success: boolean;
    workflows: WorkflowDefinition[];
}

export interface WorkflowTemplateDetailResponse {
    success: boolean;
    workflow: WorkflowDefinition;
}

export interface WorkflowStatisticsResponse {
    success: boolean;
    statistics: WorkflowStatistics;
}

// ========== Filter & Query Types ==========

export interface TaskFilters {
    status?: TaskStatus | TaskStatus[];
    workflow_type?: WorkflowType | WorkflowType[];
    task_type?: TaskType | TaskType[];
    assigned_to_me?: boolean;
    available?: boolean;
    overdue?: boolean;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface WorkflowTemplateFilters {
    is_active?: boolean;
    workflow_type?: WorkflowType;
}

// ========== UI State Types ==========

export interface TaskCardProps {
    task: WorkflowTask;
    onClaim?: (taskId: number) => void;
    onStart?: (taskId: number) => void;
    onComplete?: (taskId: number) => void;
    onView?: (taskId: number) => void;
}

export interface TaskListProps {
    tasks: WorkflowTask[];
    loading?: boolean;
    onTaskAction?: (taskId: number, action: string) => void;
}

export interface WorkflowProgressProps {
    workflowType: WorkflowType;
    entityType: string;
    entityId: number;
}
