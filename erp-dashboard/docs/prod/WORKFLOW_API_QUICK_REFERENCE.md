# Workflow & Task System - API Quick Reference

**For React Flow Frontend Integration**

---

## 🎯 Admin Monitoring Endpoints

### Get Workflow Progress (Real-Time Monitoring)
```http
GET /backend/tasks/workflow/{workflowType}/{taskableType}/{taskableId}/progress

Example:
GET /backend/tasks/workflow/bc/Order/45/progress

Response:
{
  "success": true,
  "progress": {
    "total": 5,
    "completed": 3,
    "in_progress": 1,
    "failed": 0,
    "pending": 1,
    "progress_percentage": 60.0,
    "tasks": [
      {
        "id": 101,
        "code": "ADV_REVIEW_BC001",
        "name": "ADV Review",
        "status": "completed",
        "order": 1,
        "can_start": false,
        "assigned_to": [...]
      }
    ]
  }
}
```

### Get All Workflows
```http
GET /backend/workflow-templates

Response:
{
  "success": true,
  "workflows": [
    {
      "id": 1,
      "code": "BC",
      "name": "Bon de Commande Workflow",
      "version": 3,
      "is_active": true,
      "templates": [...]
    }
  ]
}
```

### Get Workflow Preview (For React Flow Visualization)
```http
GET /backend/workflow-templates/{id}/preview

Response:
{
  "success": true,
  "preview": {
    "workflow": {...},
    "tasks": [...],
    "dependencies": [
      {
        "task": "CONVERT_TO_BL",
        "depends_on": "ADV_REVIEW",
        "type": "blocking"
      }
    ],
    "validation_rules": [...]
  }
}
```

### Get Workflow Statistics
```http
GET /backend/workflow-templates/{id}/statistics

Response:
{
  "success": true,
  "statistics": {
    "workflow": {...},
    "templates": {
      "total": 5,
      "active": 5,
      "by_type": {...}
    },
    "usage": {
      "total_instances": 1523,
      "by_status": {...}
    }
  }
}
```

### Get Task Statistics
```http
GET /backend/tasks/statistics?workflow_type=bc

Response:
{
  "success": true,
  "statistics": {
    "total": 1523,
    "pending": 45,
    "ready": 23,
    "in_progress": 12,
    "completed": 1400,
    "failed": 23,
    "cancelled": 20
  }
}
```

---

## 👤 User Task Management

### Get My Tasks
```http
GET /backend/tasks/my-tasks?status=in_progress

Query Params:
- status: pending, ready, in_progress, completed, failed (optional)

Response:
{
  "success": true,
  "tasks": [
    {
      "id": 123,
      "code": "ADV_REVIEW_BC001",
      "name": "ADV Review",
      "status": "in_progress",
      "can_start": false,
      "remaining_minutes": 15,
      "taskable": {
        "type": "Order",
        "id": 45
      }
    }
  ]
}
```

### Get Available Tasks (To Claim)
```http
GET /backend/tasks/available

Response:
{
  "success": true,
  "tasks": [
    {
      "assignment_id": 456,
      "task": {
        "id": 789,
        "code": "ADV_REVIEW_BC002",
        "status": "ready",
        "can_start": true
      },
      "assignment_type": "role",
      "role_name": "adv"
    }
  ]
}
```

### Get Task Details
```http
GET /backend/tasks/{taskId}

Response:
{
  "success": true,
  "task": {
    "id": 123,
    "code": "ADV_REVIEW_BC001",
    "name": "ADV Review",
    "status": "in_progress",
    "dependencies": [...],
    "assignments": [...],
    "validation_rules": [...],
    "execution_logs": [...]
  }
}
```

### Claim Task
```http
POST /backend/tasks/{taskId}/claim

Response:
{
  "success": true,
  "message": "Task claimed successfully",
  "assignment": {
    "id": 456,
    "status": "accepted",
    "accepted_at": "2025-12-24T10:00:00Z"
  }
}
```

### Start Task
```http
POST /backend/tasks/{taskId}/start

Response:
{
  "success": true,
  "message": "Task started successfully",
  "task": {
    "id": 123,
    "status": "in_progress",
    "started_at": "2025-12-24T10:00:00Z",
    "remaining_minutes": 30
  }
}
```

### Execute Task (With Validation)
```http
POST /backend/tasks/{taskId}/execute

Response:
{
  "success": true,
  "message": "Task executed successfully",
  "task": {
    "id": 123,
    "status": "in_progress"
  },
  "validation_results": [...]
}
```

### Complete Task
```http
POST /backend/tasks/{taskId}/complete

Request:
{
  "output_data": {
    "result": "approved",
    "notes": "All checks passed"
  }
}

Response:
{
  "success": true,
  "message": "Task completed successfully",
  "task": {
    "id": 123,
    "status": "completed",
    "completed_at": "2025-12-24T10:30:00Z"
  }
}
```

### Update Task
```http
PUT /backend/tasks/{taskId}

Request:
{
  "name": "Updated Name",
  "description": "Updated description",
  "timeout_minutes": 60,
  "metadata": {},
  "input_data": {}
}

Response:
{
  "success": true,
  "message": "Task updated successfully",
  "task": {...}
}
```

### Move/Reorder Task
```http
PUT /backend/tasks/{taskId}/move

Request:
{
  "new_order": 3
}

Response:
{
  "success": true,
  "message": "Task moved successfully",
  "task": {
    "id": 123,
    "code": "ADV_REVIEW_BC001",
    "name": "ADV Review",
    "order": 3
  }
}
```

### Bulk Complete Tasks
```http
POST /backend/tasks/bulk/complete

Request:
{
  "task_ids": [123, 124, 125],
  "output_data": {
    "result": "approved",
    "notes": "Batch approval"
  }
}

Response:
{
  "success": true,
  "message": "3 task(s) completed successfully",
  "results": {
    "success": [
      {
        "task_id": 123,
        "code": "ADV_REVIEW_BC001",
        "name": "ADV Review"
      }
    ],
    "failed": []
  }
}
```

### Bulk Cancel Tasks
```http
POST /backend/tasks/bulk/cancel

Request:
{
  "task_ids": [126, 127, 128],
  "reason": "Workflow cancelled by admin"
}

Response:
{
  "success": true,
  "message": "3 task(s) cancelled successfully",
  "results": {
    "success": [...],
    "failed": []
  }
}
```

### Bulk Reassign Tasks
```http
POST /backend/tasks/bulk/reassign

Request:
{
  "task_ids": [129, 130],
  "new_user_id": 15,
  "reason": "User on vacation"
}

Response:
{
  "success": true,
  "message": "2 task(s) reassigned successfully",
  "results": {
    "success": [...],
    "failed": []
  }
}
```

---

## 🔧 Workflow Template Management

### Create Workflow Definition
```http
POST /backend/workflow-templates

Request:
{
  "code": "NEW_WORKFLOW",
  "name": "New Workflow",
  "description": "Description",
  "is_active": true,
  "metadata": {}
}

Response:
{
  "success": true,
  "message": "Workflow definition created successfully",
  "workflow": {...}
}
```

### Update Workflow Definition
```http
PUT /backend/workflow-templates/{id}

Request:
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": false
}

Response:
{
  "success": true,
  "message": "Workflow definition updated successfully",
  "workflow": {...}
}
```

### Get Workflow Templates
```http
GET /backend/workflow-templates/{workflowId}/templates

Response:
{
  "success": true,
  "workflow": {...},
  "templates": [
    {
      "id": 1,
      "code": "ADV_REVIEW",
      "name": "ADV Review",
      "order": 1,
      "dependencies": [...],
      "validationRules": [...]
    }
  ]
}
```

### Create Task Template
```http
POST /backend/workflow-templates/{workflowId}/templates

Request:
{
  "code": "NEW_TASK",
  "name": "New Task",
  "description": "Task description",
  "task_type": "validation",
  "order": 3,
  "timeout_minutes": 30,
  "auto_complete": false,
  "assignment_type": "role",
  "assignment_target": "adv",
  "metadata": {},
  "is_active": true
}

Response:
{
  "success": true,
  "message": "Task template created successfully",
  "template": {...},
  "workflow_version": 4
}
```

### Update Task Template
```http
PUT /backend/workflow-templates/{workflowId}/templates/{templateId}

Request:
{
  "name": "Updated Name",
  "order": 5,
  "timeout_minutes": 60
}

Response:
{
  "success": true,
  "message": "Task template updated successfully",
  "template": {...},
  "workflow_version": 5
}
```

### Delete Task Template
```http
DELETE /backend/workflow-templates/{workflowId}/templates/{templateId}

Response:
{
  "success": true,
  "message": "Task template deleted successfully",
  "workflow_version": 6
}

Error (if used):
{
  "success": false,
  "message": "Cannot delete template. It has been used 150 times.",
  "usage_count": 150
}
```

### Add Dependency
```http
POST /backend/workflow-templates/{workflowId}/templates/{templateId}/dependencies

Request:
{
  "depends_on_template_id": 5,
  "dependency_type": "blocking",
  "metadata": {}
}

Response:
{
  "success": true,
  "message": "Dependency added successfully",
  "dependency": {...},
  "workflow_version": 7
}
```

### Add Validation Rule
```http
POST /backend/workflow-templates/{workflowId}/templates/{templateId}/validation-rules

Request:
{
  "rule_code": "CHECK_CREDIT",
  "rule_name": "Check Credit Limit",
  "description": "Validate partner credit",
  "validator_class": "App\\Validators\\CreditValidator",
  "order": 1,
  "is_required": true,
  "stop_on_failure": true,
  "parameters": {}
}

Response:
{
  "success": true,
  "message": "Validation rule added successfully",
  "rule": {...},
  "workflow_version": 8
}
```

---

## 🚀 Workflow Initialization

### Initialize BC Workflow
```http
POST /backend/tasks/bc/{orderId}/initialize

Request:
{
  "force_recreate": false
}

Response:
{
  "success": true,
  "message": "BC workflow initialized successfully",
  "tasks": [
    {
      "id": 101,
      "code": "ADV_REVIEW_BC001",
      "name": "ADV Review",
      "status": "pending",
      "template_id": 1,
      "template_version": 3
    }
  ]
}
```

### Check Task Exists
```http
GET /backend/tasks/check/{code}

Example:
GET /backend/tasks/check/ADV_REVIEW_BC001

Response:
{
  "success": true,
  "exists": true,
  "task": {
    "id": 123,
    "code": "ADV_REVIEW_BC001",
    "status": "completed",
    "created_at": "2025-12-24T09:00:00Z"
  }
}
```

---

## 📊 Task Status Values

```javascript
const TASK_STATUS = {
  PENDING: 'pending',           // Waiting for dependencies
  READY: 'ready',               // Ready to start
  IN_PROGRESS: 'in_progress',   // Currently executing
  COMPLETED: 'completed',       // Successfully completed
  FAILED: 'failed',             // Failed validation/execution
  CANCELLED: 'cancelled'        // Manually cancelled
};
```

## 🔗 Dependency Types

```javascript
const DEPENDENCY_TYPES = {
  BLOCKING: 'blocking',   // Must complete before dependent can start
  SOFT: 'soft',          // Recommended but not required
  PARALLEL: 'parallel'   // Can run simultaneously
};
```

## 👥 Assignment Types

```javascript
const ASSIGNMENT_TYPES = {
  SYSTEM: 'system',  // Auto-completed
  ROLE: 'role',      // Assigned to role (e.g., 'adv')
  USER: 'user',      // Assigned to specific user
  POOL: 'pool'       // Assigned to multiple users (first-come)
};
```

## 📝 Task Types

```javascript
const TASK_TYPES = {
  CREATION: 'creation',
  VALIDATION: 'validation',
  CONVERSION: 'conversion',
  DISPATCH: 'dispatch',
  PREPARATION: 'preparation',
  DELIVERY: 'delivery',
  CONTROL: 'control',
  APPROVAL: 'approval'
};
```

## 🔄 Workflow Types

```javascript
const WORKFLOW_TYPES = {
  BC: 'bc',   // Bon de Commande
  BL: 'bl',   // Bon de Livraison
  BCH: 'bch', // Bon de Chargement
  BP: 'bp'    // Bon de Préparation
};
```

---

## 🎨 React Flow Integration Examples

### Fetch and Render Workflow
```javascript
const fetchWorkflow = async (workflowId) => {
  const { data } = await axios.get(
    `/backend/workflow-templates/${workflowId}/preview`
  );
  
  const nodes = data.preview.tasks.map((task, index) => ({
    id: task.code,
    type: 'taskNode',
    position: { x: index * 250, y: 0 },
    data: {
      label: task.name,
      type: task.type,
      assignment: task.assignment,
      autoComplete: task.auto_complete,
      timeout: task.timeout_minutes
    }
  }));
  
  const edges = data.preview.dependencies.map(dep => ({
    id: `${dep.depends_on}-${dep.task}`,
    source: dep.depends_on,
    target: dep.task,
    type: dep.type === 'blocking' ? 'default' : 'smoothstep',
    animated: dep.type === 'parallel',
    label: dep.type
  }));
  
  return { nodes, edges };
};
```

### Monitor Live Workflow Progress
```javascript
const monitorWorkflow = async (workflowType, entityType, entityId) => {
  const { data } = await axios.get(
    `/backend/tasks/workflow/${workflowType}/${entityType}/${entityId}/progress`
  );
  
  // Update node colors based on status
  data.progress.tasks.forEach(task => {
    const node = nodes.find(n => n.id === task.code);
    if (node) {
      node.data.status = task.status;
      node.style = {
        backgroundColor: getStatusColor(task.status),
        border: task.can_start ? '2px solid #4caf50' : '1px solid #ccc'
      };
    }
  });
  
  return data.progress;
};

const getStatusColor = (status) => {
  const colors = {
    completed: '#4caf50',
    in_progress: '#2196f3',
    failed: '#f44336',
    ready: '#ff9800',
    pending: '#9e9e9e',
    cancelled: '#757575'
  };
  return colors[status] || '#9e9e9e';
};
```

### Task Interaction
```javascript
const handleTaskClick = async (taskId) => {
  const { data } = await axios.get(`/backend/tasks/${taskId}`);
  
  // Show task details modal
  setSelectedTask(data.task);
  setModalOpen(true);
};

const handleClaimTask = async (taskId) => {
  await axios.post(`/backend/tasks/${taskId}/claim`);
  toast.success('Task claimed successfully');
  refreshWorkflow();
};

const handleCompleteTask = async (taskId, outputData) => {
  await axios.post(`/backend/tasks/${taskId}/complete`, {
    output_data: outputData
  });
  toast.success('Task completed successfully');
  refreshWorkflow();
};
```

---

## 🔍 Error Handling

```javascript
const handleApiError = (error) => {
  if (error.response) {
    switch (error.response.status) {
      case 400:
        toast.error(error.response.data.message || 'Invalid request');
        break;
      case 403:
        toast.error('You do not have permission to perform this action');
        break;
      case 404:
        toast.error('Resource not found');
        break;
      case 422:
        // Validation errors
        const errors = error.response.data.errors;
        Object.values(errors).forEach(err => toast.error(err[0]));
        break;
      case 500:
        toast.error('Server error. Please try again later.');
        break;
      default:
        toast.error('An unexpected error occurred');
    }
  } else {
    toast.error('Network error. Please check your connection.');
  }
};
```

---

## 📌 Best Practices

1. **Always check `can_start`** before allowing users to start tasks
2. **Poll workflow progress** every 5-10 seconds for real-time updates
3. **Use task codes** as React Flow node IDs for consistency
4. **Handle errors gracefully** with user-friendly messages
5. **Show loading states** during API calls
6. **Cache workflow templates** to reduce API calls
7. **Use optimistic updates** for better UX
8. **Implement retry logic** for failed requests
9. **Log all task actions** for audit trail
10. **Validate user permissions** before showing actions

---

**Document Version:** 1.0  
**Last Updated:** December 24, 2025
