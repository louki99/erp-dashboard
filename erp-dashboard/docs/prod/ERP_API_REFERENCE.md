# ERP Workflow System - Complete API Reference

**Version:** 1.0  
**Base URL:** `/api/backend`  
**Authentication:** Bearer Token Required

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Task Management APIs](#task-management-apis)
3. [BC (Order) APIs](#bc-order-apis)
4. [Dispatcher APIs](#dispatcher-apis)
5. [Magasinier APIs](#magasinier-apis)
6. [Workflow Template APIs](#workflow-template-apis)
7. [Common Response Formats](#common-response-formats)
8. [Error Codes](#error-codes)

---

## 🔐 Authentication

All endpoints require Bearer token authentication:

```bash
Authorization: Bearer {your_access_token}
```

**Get Token:**
```bash
POST /api/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}

Response:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": 26,
    "name": "John Doe",
    "email": "user@example.com",
    "roles": ["adv"]
  }
}
```

---

## 📋 Task Management APIs

### Get My Tasks

**Endpoint:** `GET /tasks/my-tasks`

**Description:** Get all tasks assigned to authenticated user

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | string | No | Filter by status: `pending`, `ready`, `in_progress`, `completed` |
| workflow_type | string | No | Filter by workflow: `bc`, `bl`, `bch`, `bp` |
| page | integer | No | Page number (default: 1) |
| per_page | integer | No | Items per page (default: 20) |

**Example Request:**
```bash
GET /api/backend/tasks/my-tasks?status=ready&workflow_type=bc
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "tasks": {
    "current_page": 1,
    "data": [
      {
        "id": 5,
        "code": "validate_bc_BC_2025_12_22_0001",
        "name": "Validate Bon de Commande",
        "description": "ADV validation: check stock, credit limit, partner status",
        "task_type": "validation",
        "workflow_type": "bc",
        "status": "ready",
        "order": 2,
        "timeout_minutes": 30,
        "can_start": true,
        "started_at": null,
        "completed_at": null,
        "taskable": {
          "type": "App\\Models\\Order",
          "id": 123,
          "bc_number": "BC-2025-12-22-0001",
          "total_amount": 15000.00,
          "partner": {
            "id": 5,
            "name": "Partner ABC",
            "code": "P001"
          }
        },
        "assignments": [
          {
            "id": 10,
            "assignment_type": "role",
            "role_name": "adv",
            "user_id": null,
            "status": "pending"
          }
        ],
        "validation_rules": [
          {
            "id": 1,
            "rule_code": "check_order_data",
            "rule_name": "Check Order Data",
            "is_required": true,
            "order": 1
          }
        ],
        "dependencies": [],
        "created_at": "2025-12-22T10:30:00Z"
      }
    ],
    "total": 5,
    "per_page": 20,
    "last_page": 1
  }
}
```

---

### Get Available Tasks

**Endpoint:** `GET /tasks/available`

**Description:** Get tasks available for user's role (not yet claimed)

**Response:** Same structure as "Get My Tasks"

---

### Claim Task

**Endpoint:** `POST /tasks/{taskId}/claim`

**Description:** Claim a task for yourself

**Example Request:**
```bash
POST /api/backend/tasks/5/claim
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Task claimed successfully",
  "task": {
    "id": 5,
    "status": "ready",
    "assignments": [
      {
        "id": 10,
        "user_id": 26,
        "user_name": "John Doe",
        "status": "claimed",
        "claimed_at": "2025-12-22T11:00:00Z"
      }
    ]
  }
}
```

---

### Start Task

**Endpoint:** `POST /tasks/{taskId}/start`

**Description:** Start working on a task

**Response:**
```json
{
  "success": true,
  "message": "Task started successfully",
  "task": {
    "id": 5,
    "status": "in_progress",
    "started_at": "2025-12-22T11:05:00Z"
  }
}
```

---

### Execute Task

**Endpoint:** `POST /tasks/{taskId}/execute`

**Description:** Execute task with validation

**Request Body:**
```json
{
  "action": "validate",
  "data": {
    "stock_check": "passed",
    "credit_check": "passed"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task executed successfully",
  "validation_results": [
    {
      "rule_code": "check_order_data",
      "passed": true,
      "message": "Order data is valid"
    },
    {
      "rule_code": "check_stock",
      "passed": true,
      "message": "All products in stock",
      "details": [
        {
          "product_id": 53,
          "product_name": "Product XYZ",
          "requested": 100,
          "available": 150,
          "status": "ok"
        }
      ]
    }
  ],
  "all_passed": true
}
```

---

### Complete Task

**Endpoint:** `POST /tasks/{taskId}/complete`

**Request Body:**
```json
{
  "output_data": {
    "validation_status": "approved",
    "notes": "All checks passed"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task completed successfully",
  "task": {
    "id": 5,
    "status": "completed",
    "completed_at": "2025-12-22T11:15:00Z"
  },
  "dependent_tasks_updated": [
    {
      "id": 6,
      "code": "convert_to_bl",
      "status": "ready",
      "message": "Task is now ready to start"
    }
  ]
}
```

---

### Get Workflow Progress

**Endpoint:** `GET /tasks/workflow/{workflowType}/{taskableType}/{taskableId}/progress`

**Example:**
```bash
GET /api/backend/tasks/workflow/bc/App\Models\Order/123/progress
```

**Response:**
```json
{
  "success": true,
  "progress": {
    "total": 3,
    "completed": 2,
    "in_progress": 0,
    "failed": 0,
    "pending": 1,
    "progress_percentage": 66.67,
    "tasks": [
      {
        "id": 4,
        "code": "create_bc",
        "name": "Create Bon de Commande",
        "status": "completed",
        "order": 1
      },
      {
        "id": 5,
        "code": "validate_bc",
        "name": "Validate Bon de Commande",
        "status": "completed",
        "order": 2
      },
      {
        "id": 6,
        "code": "convert_to_bl",
        "name": "Convert to BL",
        "status": "ready",
        "order": 3
      }
    ]
  }
}
```

---

## 📦 BC (Order) APIs

### Get Pending BCs (ADV)

**Endpoint:** `GET /adv/pending-bc`

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by BC status |
| partner_id | integer | Filter by partner |
| date_from | date | Filter from date (YYYY-MM-DD) |
| date_to | date | Filter to date |
| search | string | Search BC number or partner name |

**Response:**
```json
{
  "success": true,
  "orders": {
    "data": [
      {
        "id": 123,
        "bc_number": "BC-2025-12-22-0001",
        "bc_status": "submitted",
        "order_date": "2025-12-22T10:30:00Z",
        "total_amount": 15000.00,
        "partner": {
          "id": 5,
          "name": "Partner ABC",
          "code": "P001",
          "credit_limit": 100000.00,
          "credit_used": 45000.00,
          "credit_available": 55000.00
        },
        "orderProducts": [
          {
            "product_id": 53,
            "product_name": "Product XYZ",
            "quantity": 100,
            "unit_price": 150.00,
            "total": 15000.00
          }
        ]
      }
    ]
  }
}
```

---

### Validate BC (Approve)

**Endpoint:** `POST /adv/validate-bc/{orderId}`

**Request Body:**
```json
{
  "action": "approve",
  "notes": "All validations passed"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BC validated and approved successfully",
  "order": {
    "id": 123,
    "bc_status": "adv_approved",
    "validated_at": "2025-12-22T11:15:00Z"
  }
}
```

---

### Reject BC

**Endpoint:** `POST /adv/reject-bc/{orderId}`

**Request Body:**
```json
{
  "reason": "Insufficient stock",
  "details": {
    "product_id": 53,
    "requested": 100,
    "available": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "BC rejected",
  "order": {
    "id": 123,
    "bc_status": "adv_rejected",
    "rejection_reason": "Insufficient stock"
  }
}
```

---

## 🚚 Dispatcher APIs

### Get Pending Orders

**Endpoint:** `GET /dispatcher/pending-orders`

**Response:**
```json
{
  "success": true,
  "orders": {
    "data": [
      {
        "id": 123,
        "bc_number": "BC-2025-12-22-0001",
        "bc_status": "adv_approved",
        "partner": {...},
        "can_convert_to_bl": true
      }
    ]
  }
}
```

---

### Convert BC to BL

**Endpoint:** `POST /dispatcher/convert-to-bl/{orderId}`

**Request Body:**
```json
{
  "delivery_date": "2025-12-23",
  "notes": "Urgent delivery"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BC converted to BL successfully",
  "bon_livraison": {
    "id": 45,
    "bl_number": "BL-PARTNER-2025-12-22-0001",
    "status": "draft",
    "delivery_date": "2025-12-23"
  }
}
```

---

### Get Draft BLs

**Endpoint:** `GET /dispatcher/draft-bls`

**Response:**
```json
{
  "success": true,
  "bls": {
    "data": [
      {
        "id": 45,
        "bl_number": "BL-001",
        "status": "draft",
        "partner": {...},
        "total_amount": 15000.00
      }
    ]
  }
}
```

---

### Create BCH (Group BLs)

**Endpoint:** `POST /dispatcher/create-bch`

**Request Body:**
```json
{
  "bl_ids": [45, 46, 47],
  "livreur_id": 15,
  "notes": "Route A - Morning delivery"
}
```

**Response:**
```json
{
  "success": true,
  "message": "BCH created successfully",
  "bon_chargement": {
    "id": 12,
    "bch_number": "BCH-2025-12-22-001",
    "status": "pending",
    "livreur": {
      "id": 15,
      "name": "Driver John"
    },
    "bonLivraisons": [
      {"id": 45, "bl_number": "BL-001"},
      {"id": 46, "bl_number": "BL-002"}
    ]
  },
  "bon_preparation": {
    "id": 8,
    "bp_number": "BP-BCH001-2025-12-22",
    "status": "pending"
  }
}
```

---

## 📦 Magasinier APIs

### Get Approved Orders

**Endpoint:** `GET /magasinier/approved-orders`

**Description:** Get ADV-approved BCs ready for preparation

**Response:**
```json
{
  "success": true,
  "orders": {
    "data": [
      {
        "id": 123,
        "bc_number": "BC-2025-12-22-0001",
        "bc_status": "adv_approved",
        "bon_preparation_id": null,
        "partner": {...}
      }
    ]
  }
}
```

---

### Create BP from Orders

**Endpoint:** `POST /magasinier/create-bp-from-orders`

**Request Body:**
```json
{
  "order_ids": [123, 124, 125]
}
```

**Response:**
```json
{
  "success": true,
  "message": "BP created successfully",
  "bon_preparation": {
    "id": 9,
    "bp_number": "BP-2025-12-22-001",
    "status": "pending",
    "orders": [
      {"id": 123, "bc_number": "BC-001"}
    ],
    "items": [
      {
        "product_id": 53,
        "requested_quantity": 300,
        "prepared_quantity": 0
      }
    ]
  }
}
```

---

### Get Pending Preparations

**Endpoint:** `GET /magasinier/pending-preparations`

**Response:**
```json
{
  "success": true,
  "preparations": {
    "data": [
      {
        "id": 8,
        "bp_number": "BP-BCH001-2025-12-22",
        "status": "pending",
        "items": [
          {
            "product_id": 53,
            "product_name": "Product XYZ",
            "requested_quantity": 100,
            "prepared_quantity": 0,
            "location": "A-12-03"
          }
        ]
      }
    ]
  }
}
```

---

### Start Preparation

**Endpoint:** `POST /magasinier/start-preparation/{bpId}`

**Response:**
```json
{
  "success": true,
  "message": "Preparation started",
  "bon_preparation": {
    "id": 8,
    "status": "in_progress",
    "started_at": "2025-12-22T12:00:00Z"
  }
}
```

---

### Update Prepared Quantities

**Endpoint:** `POST /magasinier/update-quantities/{bpId}`

**Request Body:**
```json
{
  "items": [
    {
      "item_id": 50,
      "prepared_quantity": 95,
      "shortage": 5,
      "notes": "5 units damaged"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Quantities updated",
  "bon_preparation": {
    "id": 8,
    "items": [
      {
        "item_id": 50,
        "requested_quantity": 100,
        "prepared_quantity": 95,
        "shortage": 5,
        "completion_rate": 95.0
      }
    ]
  }
}
```

---

### Complete Preparation

**Endpoint:** `POST /magasinier/complete-preparation/{bpId}`

**Response:**
```json
{
  "success": true,
  "message": "Preparation completed",
  "bon_preparation": {
    "id": 8,
    "status": "completed",
    "prepared_at": "2025-12-22T14:00:00Z"
  },
  "stock_movements": [
    {
      "product_id": 53,
      "quantity": -95,
      "type": "preparation"
    }
  ]
}
```

---

## 🔧 Workflow Template APIs

### Get All Workflows

**Endpoint:** `GET /workflow-templates`

**Response:**
```json
{
  "success": true,
  "workflows": [
    {
      "id": 1,
      "code": "BC",
      "name": "Bon de Commande Workflow",
      "version": 1,
      "is_active": true,
      "templates": [...]
    }
  ]
}
```

---

### Get Workflow Details

**Endpoint:** `GET /workflow-templates/{id}`

**Response:**
```json
{
  "success": true,
  "workflow": {
    "id": 1,
    "code": "BC",
    "templates": [
      {
        "id": 2,
        "code": "validate_bc",
        "name": "Validate BC",
        "dependencies": [...],
        "validation_rules": [...]
      }
    ]
  }
}
```

---

### Create Task Template

**Endpoint:** `POST /workflow-templates/{workflowId}/templates`

**Request Body:**
```json
{
  "code": "fraud_check",
  "name": "Fraud Detection",
  "task_type": "validation",
  "order": 1.5,
  "timeout_minutes": 10,
  "assignment_type": "role",
  "assignment_target": "security"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Template created",
  "template": {
    "id": 4,
    "code": "fraud_check"
  },
  "workflow_version": 2
}
```

---

### Get Workflow Statistics

**Endpoint:** `GET /workflow-templates/{id}/statistics`

**Response:**
```json
{
  "success": true,
  "statistics": {
    "templates": {
      "total": 3,
      "active": 3
    },
    "usage": {
      "total_instances": 150,
      "by_status": {
        "completed": 50,
        "in_progress": 10
      }
    }
  }
}
```

---

## 📊 Common Response Formats

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {...}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "error_code": "ERROR_CODE",
  "errors": {
    "field": ["Validation error message"]
  }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [...],
    "total": 100,
    "per_page": 20,
    "last_page": 5
  }
}
```

---

## ⚠️ Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_STATUS` | 400 | Invalid document status |
| `MISSING_PARTNER` | 400 | Partner not assigned |
| `ALREADY_IN_PREPARATION` | 400 | Already being prepared |
| `VALIDATION_FAILED` | 422 | Input validation failed |
| `TASK_NOT_READY` | 400 | Task dependencies not satisfied |
| `TASK_ALREADY_CLAIMED` | 400 | Task claimed by another user |

---

**Next:** See [Frontend Integration Guide](./ERP_FRONTEND_GUIDE.md) for implementation examples.
