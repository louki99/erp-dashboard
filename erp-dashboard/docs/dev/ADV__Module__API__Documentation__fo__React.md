# ADV Module API Documentation for React Developers

## Base Configuration

**Base URL**: `/backend/adv`  
**Authentication**: Required - Bearer Token (Sanctum)  
**Content-Type**: `application/json`  
**Accept**: `application/json`

### Authentication Header
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

---

## 📊 Dashboard

### GET `/backend/adv/dashboard`

Get ADV dashboard statistics and alerts.

**Request:**
```javascript
const response = await fetch('/backend/adv/dashboard', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

**Response (200 OK):**
```json
{
  "stats": {
    "pending_partners": 15,
    "pending_credit_approvals": 3,
    "pending_derogations": 5,
    "blocked_partners": 2,
    "overdue_payments": 8,
    "pending_bc": 42,
    "total_credit_exposure": 1250000.00,
    "available_credit": 750000.00
  },
  "recentPartners": [
    {
      "id": 123,
      "code": "PART001",
      "name": "Partner Name",
      "status": "PENDING",
      "credit_limit": 50000.00,
      "created_at": "2025-12-13T10:30:00.000000Z",
      "workflowInstance": {...},
      "geoArea": {...},
      "paymentTerm": {...}
    }
  ],
  "creditAlerts": [
    {
      "id": 456,
      "code": "PART002",
      "name": "High Risk Partner",
      "credit_limit": 100000.00,
      "credit_used": 95000.00,
      "credit_available": 5000.00,
      "status": "ACTIVE"
    }
  ]
}
```

**React Example:**
```typescript
interface DashboardStats {
  pending_partners: number;
  pending_credit_approvals: number;
  pending_derogations: number;
  blocked_partners: number;
  overdue_payments: number;
  pending_bc: number;
  total_credit_exposure: number;
  available_credit: number;
}

interface Partner {
  id: number;
  code: string;
  name: string;
  status: string;
  credit_limit: number;
  credit_used?: number;
  credit_available?: number;
  created_at: string;
}

const fetchDashboard = async (): Promise<{
  stats: DashboardStats;
  recentPartners: Partner[];
  creditAlerts: Partner[];
}> => {
  const response = await fetch('/backend/adv/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
};
```

---

## 👥 Partner Management

### 1. GET `/backend/adv/partners/pending`

Get list of pending partners awaiting validation.

**Query Parameters:**
- `page` (optional): Page number for pagination

**Request:**
```javascript
const response = await fetch('/backend/adv/partners/pending?page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

**Response (200 OK):**
```json
{
  "current_page": 1,
  "data": [
    {
      "id": 123,
      "code": "PART001",
      "name": "New Partner Ltd",
      "email": "contact@partner.com",
      "phone": "+212600000000",
      "status": "PENDING",
      "credit_limit": null,
      "partner_type": "B2B",
      "channel": "Direct",
      "created_at": "2025-12-13T10:30:00.000000Z",
      "workflowInstance": {
        "id": 1,
        "status": "pending",
        "currentStep": {
          "code": "pending_approval",
          "name": "Pending ADV Approval"
        }
      },
      "geoArea": {
        "code": "CASA",
        "name": "Casablanca"
      },
      "paymentTerm": null
    }
  ],
  "first_page_url": "http://api.example.com/backend/adv/partners/pending?page=1",
  "from": 1,
  "last_page": 2,
  "last_page_url": "http://api.example.com/backend/adv/partners/pending?page=2",
  "next_page_url": "http://api.example.com/backend/adv/partners/pending?page=2",
  "path": "http://api.example.com/backend/adv/partners/pending",
  "per_page": 20,
  "prev_page_url": null,
  "to": 20,
  "total": 35
}
```

### 2. GET `/backend/adv/partners/{id}`

Get detailed information about a specific partner.

**Path Parameters:**
- `id` (required): Partner ID

**Request:**
```javascript
const partnerId = 123;
const response = await fetch(`/backend/adv/partners/${partnerId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  }
});
```

**Response (200 OK):**
```json
{
  "partner": {
    "id": 123,
    "code": "PART001",
    "name": "Partner Name",
    "email": "contact@partner.com",
    "phone": "+212600000000",
    "whatsapp": "+212600000000",
    "status": "PENDING",
    "credit_limit": null,
    "credit_used": 0.00,
    "credit_available": 0.00,
    "partner_type": "B2B",
    "channel": "Direct",
    "tax_number_ice": "000000000000000",
    "tax_number_if": "12345678",
    "address_line1": "123 Street",
    "city": "Casablanca",
    "country": "Morocco",
    "workflowInstance": {
      "id": 1,
      "status": "pending",
      "currentStep": {...},
      "approvals": []
    },
    "geoArea": {...},
    "paymentTerm": null,
    "bonCommandes": [],
    "bonLivraisons": []
  },
  "creditHistory": [
    {
      "id": 1,
      "partner_id": 123,
      "old_limit": 0.00,
      "new_limit": 50000.00,
      "changed_by": 1,
      "justification": "Initial credit limit",
      "created_at": "2025-12-13T10:30:00.000000Z"
    }
  ],
  "paymentHistory": [
    {
      "id": 1,
      "order_number": "BC-2025-001",
      "total_amount": 15000.00,
      "bc_status": "delivered",
      "created_at": "2025-12-10T14:20:00.000000Z"
    }
  ]
}
```

### 3. POST `/backend/adv/partners/{id}/validate`

Validate and approve a pending partner.

**Path Parameters:**
- `id` (required): Partner ID

**Request Body:**
```json
{
  "credit_limit": 50000.00,
  "payment_term_id": 2,
  "notes": "Approved based on financial documents review"
}
```

**Validation Rules:**
- `credit_limit`: required, numeric, min:0
- `payment_term_id`: required, exists in payment_terms table
- `notes`: optional, string

**Request:**
```javascript
const validatePartner = async (partnerId: number, data: {
  credit_limit: number;
  payment_term_id: number;
  notes?: string;
}) => {
  const response = await fetch(`/backend/adv/partners/${partnerId}/validate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Partner validated successfully"
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "credit_limit": ["The credit limit field is required."],
    "payment_term_id": ["The selected payment term id is invalid."]
  }
}
```

### 4. POST `/backend/adv/partners/{id}/reject`

Reject a pending partner.

**Path Parameters:**
- `id` (required): Partner ID

**Request Body:**
```json
{
  "rejection_reason": "Incomplete documentation and high risk profile"
}
```

**Validation Rules:**
- `rejection_reason`: required, string, max:500

**Request:**
```javascript
const rejectPartner = async (partnerId: number, reason: string) => {
  const response = await fetch(`/backend/adv/partners/${partnerId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ rejection_reason: reason })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Partner rejected"
}
```

---

## 💳 Credit Management

### 1. GET `/backend/adv/credit`

Get list of active partners with credit information.

**Query Parameters:**
- `page` (optional): Page number

**Request:**
```javascript
const response = await fetch('/backend/adv/credit?page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "partners": {
    "current_page": 1,
    "data": [
      {
        "id": 456,
        "code": "PART002",
        "name": "Active Partner",
        "credit_limit": 100000.00,
        "credit_used": 75000.00,
        "available_credit": 25000.00,
        "status": "ACTIVE",
        "geoArea": {...},
        "paymentTerm": {...}
      }
    ],
    "per_page": 50,
    "total": 120
  },
  "totalExposure": 5000000.00,
  "totalLimit": 8000000.00,
  "utilizationRate": 62.5
}
```

### 2. POST `/backend/adv/credit/{id}/update-limit`

Update partner's credit limit.

**Path Parameters:**
- `id` (required): Partner ID

**Request Body:**
```json
{
  "new_credit_limit": 150000.00,
  "justification": "Increased due to consistent payment history and business growth"
}
```

**Validation Rules:**
- `new_credit_limit`: required, numeric, min:0
- `justification`: required, string, max:500

**Request:**
```javascript
const updateCreditLimit = async (partnerId: number, data: {
  new_credit_limit: number;
  justification: string;
}) => {
  const response = await fetch(`/backend/adv/credit/${partnerId}/update-limit`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Credit limit updated successfully"
}
```

**Note:** If the change exceeds 50,000, it requires supervisor approval and returns:
```json
{
  "success": true,
  "message": "Credit limit change request sent for supervisor approval"
}
```

### 3. POST `/backend/adv/credit/{id}/block`

Block a partner from placing orders.

**Path Parameters:**
- `id` (required): Partner ID

**Request Body:**
```json
{
  "block_reason": "Overdue payments exceeding 90 days",
  "blocked_until": "2025-12-31"
}
```

**Validation Rules:**
- `block_reason`: required, string, max:500
- `blocked_until`: optional, date, after:today

**Request:**
```javascript
const blockPartner = async (partnerId: number, data: {
  block_reason: string;
  blocked_until?: string;
}) => {
  const response = await fetch(`/backend/adv/credit/${partnerId}/block`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Partner blocked successfully"
}
```

### 4. POST `/backend/adv/credit/{id}/unblock`

Unblock a previously blocked partner.

**Path Parameters:**
- `id` (required): Partner ID

**Request:**
```javascript
const unblockPartner = async (partnerId: number) => {
  const response = await fetch(`/backend/adv/credit/${partnerId}/unblock`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Partner unblocked successfully"
}
```

---

## 📅 Echeances (Due Dates)

### GET `/backend/adv/echeances`

Get overdue invoices and payment tracking.

**Query Parameters:**
- `page` (optional): Page number

**Request:**
```javascript
const response = await fetch('/backend/adv/echeances?page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "current_page": 1,
  "data": [
    {
      "id": 789,
      "order_number": "BC-2025-123",
      "partner_name": "Partner Name",
      "partner_code": "PART001",
      "payment_term": "Net 30",
      "total_amount": 25000.00,
      "bc_status": "confirmed",
      "created_at": "2025-11-01T10:00:00.000000Z",
      "due_date": "2025-12-01T10:00:00.000000Z",
      "days_overdue": 12
    }
  ],
  "per_page": 50,
  "total": 8
}
```

---

## 📋 BC (Bon de Commande) Validation

### 1. GET `/backend/adv/bc`

Get BC list with master-detail split view (NEW).

**Query Parameters:**
- `status` (optional): Filter by status (submitted, adv_review, adv_on_hold, pending_credit_derogation)
- `search` (optional): Search by BC number or partner name
- `page` (optional): Page number

**Request:**
```javascript
const response = await fetch('/backend/adv/bc?status=adv_review&search=PART001&page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "bcs": {
    "current_page": 1,
    "data": [
      {
        "id": 1001,
        "order_number": "BC-2025-001",
        "partner_id": 123,
        "total_amount": 45000.00,
        "bc_status": "adv_review",
        "created_at": "2025-12-13T09:00:00.000000Z",
        "is_overdue": false,
        "is_urgent": false,
        "items_count": 15,
        "partner": {
          "id": 123,
          "code": "PART001",
          "name": "Partner Name",
          "credit_limit": 100000.00,
          "credit_used": 60000.00
        },
        "orderProducts": [...],
        "paymentTerm": {...},
        "workflowInstance": {...}
      }
    ],
    "per_page": 50,
    "total": 42
  },
  "stats": {
    "pending_review": 25,
    "on_hold": 10,
    "pending_derogation": 5,
    "approved_today": 12,
    "overdue": 7
  }
}
```

### 2. GET `/backend/adv/bc/pending`

Get pending BCs (Classic list view).

**Query Parameters:**
- `status` (optional): Filter by status
- `partner` (optional): Filter by partner name
- `bc_number` (optional): Filter by BC number
- `page` (optional): Page number

**Request:**
```javascript
const response = await fetch('/backend/adv/bc/pending?status=submitted&partner=Partner&page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "bcs": {
    "current_page": 1,
    "data": [...]
  },
  "stats": {
    "pending_review": 25,
    "on_hold": 10,
    "pending_derogation": 5,
    "approved_today": 12,
    "overdue": 7
  },
  "partners": [
    {
      "id": 123,
      "name": "Partner Name"
    }
  ]
}
```

### 3. GET `/backend/adv/bc/{id}`

Get detailed BC information.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request:**
```javascript
const bcId = 1001;
const response = await fetch(`/backend/adv/bc/${bcId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "bc": {
    "id": 1001,
    "order_number": "BC-2025-001",
    "partner_id": 123,
    "total_amount": 45000.00,
    "sub_total": 42000.00,
    "tax_amount": 3000.00,
    "bc_status": "adv_review",
    "created_at": "2025-12-13T09:00:00.000000Z",
    "partner": {
      "id": 123,
      "code": "PART001",
      "name": "Partner Name",
      "credit_limit": 100000.00,
      "credit_used": 60000.00,
      "credit_available": 40000.00,
      "paymentTerm": {
        "id": 2,
        "name": "Net 30",
        "days_number": 30
      }
    },
    "orderProducts": [
      {
        "id": 1,
        "product_id": 50,
        "quantity": 100,
        "price": 420.00,
        "product": {
          "id": 50,
          "name": "Product Name",
          "sku": "PROD-001",
          "total_available_stock": 150,
          "stocks": [...]
        }
      }
    ],
    "paymentTerm": {...},
    "workflowInstance": {
      "id": 10,
      "status": "in_progress",
      "transitions": [
        {
          "id": 1,
          "from_step": "submitted",
          "to_step": "adv_review",
          "performed_at": "2025-12-13T09:05:00.000000Z",
          "performedBy": {
            "id": 5,
            "name": "ADV User"
          }
        }
      ]
    }
  },
  "stockAvailable": true,
  "creditOk": false,
  "creditExceeded": true,
  "excessAmount": 5000.00,
  "pendingDerogation": {
    "id": 1,
    "status": "pending",
    "justification": "Partner has excellent payment history",
    "requested_by": 5,
    "created_at": "2025-12-13T09:10:00.000000Z",
    "requestedBy": {
      "id": 5,
      "name": "ADV User"
    }
  },
  "partnerStats": {
    "total_orders": 45,
    "pending_bcs": 3,
    "avg_order_value": 38500.00,
    "overdue_payments": 0
  }
}
```

### 4. POST `/backend/adv/bc/{id}/approve`

Approve a BC.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request Body:**
```json
{
  "comment": "Approved - all checks passed",
  "approval_mode": "standard",
  "quantities": {
    "50": 100,
    "51": 50
  },
  "auto_adjust_stock": false
}
```

**Validation Rules:**
- `comment`: optional, string, max:1000
- `approval_mode`: optional, enum: standard, manual, forced
- `quantities`: optional, object (product_id: quantity)
- `auto_adjust_stock`: optional, boolean

**Approval Modes:**
- `standard`: Normal approval (default)
- `manual`: Custom quantities adjustment
- `forced`: Force approve despite stock shortage

**Request:**
```javascript
const approveBC = async (bcId: number, data: {
  comment?: string;
  approval_mode?: 'standard' | 'manual' | 'forced';
  quantities?: Record<number, number>;
  auto_adjust_stock?: boolean;
}) => {
  const response = await fetch(`/backend/adv/bc/${bcId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "BC approved successfully"
}
```

### 5. POST `/backend/adv/bc/{id}/reject`

Reject a BC.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request Body:**
```json
{
  "reason": "Partner credit limit exceeded and derogation not approved"
}
```

**Validation Rules:**
- `reason`: required, string, max:1000

**Request:**
```javascript
const rejectBC = async (bcId: number, reason: string) => {
  const response = await fetch(`/backend/adv/bc/${bcId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "BC rejected successfully"
}
```

### 6. POST `/backend/adv/bc/{id}/hold`

Put BC on hold.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request Body:**
```json
{
  "reason": "Waiting for additional documentation from partner"
}
```

**Validation Rules:**
- `reason`: required, string, max:1000

**Request:**
```javascript
const holdBC = async (bcId: number, reason: string) => {
  const response = await fetch(`/backend/adv/bc/${bcId}/hold`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "BC put on hold successfully"
}
```

### 7. POST `/backend/adv/bc/{id}/request-info`

Request additional information from partner.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request Body:**
```json
{
  "info_needed": "Please provide updated tax certificate and bank statement",
  "put_on_hold": true
}
```

**Validation Rules:**
- `info_needed`: required, string, max:1000
- `put_on_hold`: optional, boolean

**Request:**
```javascript
const requestBCInfo = async (bcId: number, data: {
  info_needed: string;
  put_on_hold?: boolean;
}) => {
  const response = await fetch(`/backend/adv/bc/${bcId}/request-info`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Information request sent successfully"
}
```

### 8. GET `/backend/adv/bc/{id}/balance-check`

Perform stock balance check for BC.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request:**
```javascript
const checkBCBalance = async (bcId: number) => {
  const response = await fetch(`/backend/adv/bc/${bcId}/balance-check`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Balance check completed - Some items have shortages",
  "data": {
    "success": true,
    "all_ok": false,
    "items": [
      {
        "product_id": 50,
        "product_name": "Product Name",
        "requested_quantity": 100,
        "available_stock": 150,
        "status": "ok"
      },
      {
        "product_id": 51,
        "product_name": "Another Product",
        "requested_quantity": 200,
        "available_stock": 50,
        "shortage": 150,
        "status": "shortage"
      }
    ]
  }
}
```

### 9. POST `/backend/adv/bc/batch-approve`

Approve multiple BCs at once.

**Request Body:**
```json
{
  "bc_ids": [1001, 1002, 1003],
  "comment": "Batch approval for standard orders"
}
```

**Validation Rules:**
- `bc_ids`: required, array
- `bc_ids.*`: exists in orders table
- `comment`: optional, string, max:1000

**Request:**
```javascript
const batchApproveBC = async (bcIds: number[], comment?: string) => {
  const response = await fetch('/backend/adv/bc/batch-approve', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ bc_ids: bcIds, comment })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "3 BCs approved successfully"
}
```

**Partial Success Response:**
```json
{
  "success": true,
  "message": "2 BCs approved successfully. Failed: BC-2025-003"
}
```

---

## 🔓 Credit Derogation Management

### 1. GET `/backend/adv/derogations`

Get list of credit derogations.

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected) - Default: pending
- `page` (optional): Page number

**Request:**
```javascript
const response = await fetch('/backend/adv/derogations?status=pending&page=1', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "derogations": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "order_id": 1001,
        "partner_id": 123,
        "partner_credit_limit": 100000.00,
        "partner_credit_used": 60000.00,
        "order_amount": 45000.00,
        "total_exposure": 105000.00,
        "excess_amount": 5000.00,
        "justification": "Partner has excellent payment history and this is a seasonal order",
        "derogation_type": "credit_ceiling_exceeded",
        "status": "pending",
        "created_at": "2025-12-13T09:10:00.000000Z",
        "order": {
          "id": 1001,
          "order_number": "BC-2025-001",
          "partner": {
            "id": 123,
            "code": "PART001",
            "name": "Partner Name"
          }
        },
        "requestedBy": {
          "id": 5,
          "name": "ADV User"
        }
      }
    ],
    "per_page": 20,
    "total": 5
  },
  "stats": {
    "pending": 5,
    "approved_today": 2,
    "rejected_today": 1
  }
}
```

### 2. GET `/backend/adv/derogations/{derogationId}`

Get detailed derogation information.

**Path Parameters:**
- `derogationId` (required): Derogation ID

**Request:**
```javascript
const derogationId = 1;
const response = await fetch(`/backend/adv/derogations/${derogationId}`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**Response (200 OK):**
```json
{
  "success": true,
  "derogation": {
    "id": 1,
    "order_id": 1001,
    "partner_id": 123,
    "partner_credit_limit": 100000.00,
    "partner_credit_used": 60000.00,
    "order_amount": 45000.00,
    "total_exposure": 105000.00,
    "excess_amount": 5000.00,
    "justification": "Partner has excellent payment history and this is a seasonal order",
    "derogation_type": "credit_ceiling_exceeded",
    "status": "pending",
    "reviewed_by": null,
    "reviewed_at": null,
    "review_comment": null,
    "metadata": {
      "partner_name": "Partner Name",
      "partner_code": "PART001",
      "bc_number": "BC-2025-001",
      "request_date": "2025-12-13 09:10:00"
    },
    "created_at": "2025-12-13T09:10:00.000000Z",
    "order": {
      "id": 1001,
      "order_number": "BC-2025-001",
      "total_amount": 45000.00,
      "bc_status": "pending_credit_derogation",
      "partner": {...},
      "orderProducts": [...]
    },
    "partner": {...},
    "requestedBy": {
      "id": 5,
      "name": "ADV User",
      "email": "adv@example.com"
    },
    "reviewedBy": null
  }
}
```

### 3. POST `/backend/adv/derogations/{id}/request`

Request credit derogation for a BC.

**Path Parameters:**
- `id` (required): BC/Order ID

**Request Body:**
```json
{
  "justification": "Partner has excellent payment history over 2 years with zero late payments. This is a seasonal order for Ramadan period with expected high turnover. Partner's business has grown 30% this year."
}
```

**Validation Rules:**
- `justification`: required, string, min:20, max:1000

**Request:**
```javascript
const requestDerogation = async (bcId: number, justification: string) => {
  const response = await fetch(`/backend/adv/derogations/${bcId}/request`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ justification })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Credit derogation request submitted successfully",
  "derogation": {
    "id": 1,
    "order_id": 1001,
    "partner_id": 123,
    "excess_amount": 5000.00,
    "status": "pending",
    "created_at": "2025-12-13T09:10:00.000000Z"
  }
}
```

**Error Responses:**

**400 Bad Request - No partner:**
```json
{
  "success": false,
  "message": "BC must have a partner to request credit derogation"
}
```

**400 Bad Request - Credit not exceeded:**
```json
{
  "success": false,
  "message": "Credit limit is not exceeded. No derogation needed."
}
```

**400 Bad Request - Duplicate request:**
```json
{
  "success": false,
  "message": "A pending derogation request already exists for this BC"
}
```

### 4. POST `/backend/adv/derogations/{derogationId}/approve`

Approve a credit derogation (Admin/Chef ADV only).

**Path Parameters:**
- `derogationId` (required): Derogation ID

**Request Body:**
```json
{
  "comment": "Approved based on partner's excellent track record and business growth"
}
```

**Validation Rules:**
- `comment`: optional, string, max:500

**Request:**
```javascript
const approveDerogation = async (derogationId: number, comment?: string) => {
  const response = await fetch(`/backend/adv/derogations/${derogationId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ comment })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Credit derogation approved and BC approved successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "This derogation has already been processed"
}
```

### 5. POST `/backend/adv/derogations/{derogationId}/reject`

Reject a credit derogation (Admin/Chef ADV only).

**Path Parameters:**
- `derogationId` (required): Derogation ID

**Request Body:**
```json
{
  "reason": "Partner has overdue payments exceeding 60 days and high risk score. Cannot approve additional credit exposure at this time."
}
```

**Validation Rules:**
- `reason`: required, string, min:10, max:500

**Request:**
```javascript
const rejectDerogation = async (derogationId: number, reason: string) => {
  const response = await fetch(`/backend/adv/derogations/${derogationId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason })
  });
  return response.json();
};
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Credit derogation rejected and BC rejected"
}
```

---

## 🔐 Authentication & Error Handling

### Authentication

All endpoints require authentication using Laravel Sanctum bearer token:

```javascript
// Login first to get token
const loginResponse = await fetch('/backend/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password'
  })
});

const { token } = await loginResponse.json();

// Use token in subsequent requests
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};
```

### Common Error Responses

**401 Unauthorized:**
```json
{
  "message": "Unauthenticated."
}
```

**403 Forbidden:**
```json
{
  "message": "This action is unauthorized."
}
```

**404 Not Found:**
```json
{
  "message": "No query results for model [App\\Models\\Order] 1001"
}
```

**422 Unprocessable Entity (Validation Error):**
```json
{
  "message": "The given data was invalid.",
  "errors": {
    "credit_limit": [
      "The credit limit field is required."
    ],
    "justification": [
      "The justification must be at least 20 characters."
    ]
  }
}
```

**500 Internal Server Error:**
```json
{
  "success": false,
  "message": "Failed to approve BC: Database connection error"
}
```

---

## 📦 TypeScript Interfaces

```typescript
// Partner
interface Partner {
  id: number;
  code: string;
  name: string;
  email: string;
  phone: string;
  status: 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REJECTED';
  credit_limit: number;
  credit_used: number;
  credit_available: number;
  partner_type: string;
  channel: string;
  created_at: string;
  geoArea?: GeoArea;
  paymentTerm?: PaymentTerm;
}

// BC/Order
interface BonCommande {
  id: number;
  order_number: string;
  partner_id: number;
  total_amount: number;
  sub_total: number;
  tax_amount: number;
  bc_status: BcStatus;
  created_at: string;
  partner: Partner;
  orderProducts: OrderProduct[];
  paymentTerm: PaymentTerm;
  workflowInstance?: WorkflowInstance;
}

// BC Status
type BcStatus = 
  | 'draft'
  | 'submitted'
  | 'adv_review'
  | 'adv_on_hold'
  | 'pending_credit_derogation'
  | 'adv_approved'
  | 'adv_rejected'
  | 'confirmed'
  | 'converted_to_bl'
  | 'in_preparation'
  | 'prepared'
  | 'in_transit'
  | 'delivered'
  | 'returned'
  | 'cancelled';

// Order Product
interface OrderProduct {
  id: number;
  product_id: number;
  quantity: number;
  price: number;
  product: Product;
}

// Product
interface Product {
  id: number;
  name: string;
  sku: string;
  total_available_stock: number;
}

// Credit Derogation
interface CreditDerogation {
  id: number;
  order_id: number;
  partner_id: number;
  partner_credit_limit: number;
  partner_credit_used: number;
  order_amount: number;
  total_exposure: number;
  excess_amount: number;
  justification: string;
  derogation_type: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: number;
  reviewed_at?: string;
  review_comment?: string;
  created_at: string;
  order?: BonCommande;
  partner?: Partner;
  requestedBy?: User;
  reviewedBy?: User;
}

// Payment Term
interface PaymentTerm {
  id: number;
  name: string;
  days_number: number;
}

// Geo Area
interface GeoArea {
  code: string;
  name: string;
}

// User
interface User {
  id: number;
  name: string;
  email: string;
}

// Pagination
interface PaginatedResponse<T> {
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
```

---

## 🎯 React Hooks Examples

### useDashboard Hook
```typescript
import { useState, useEffect } from 'react';

interface DashboardData {
  stats: DashboardStats;
  recentPartners: Partner[];
  creditAlerts: Partner[];
}

export const useDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const response = await fetch('/backend/adv/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Accept': 'application/json'
          }
        });
        
        if (!response.ok) throw new Error('Failed to fetch dashboard');
        
        const data = await response.json();
        setData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return { data, loading, error };
};
```

### useBCList Hook
```typescript
import { useState, useEffect } from 'react';

export const useBCList = (status?: string, search?: string) => {
  const [bcs, setBCs] = useState<PaginatedResponse<BonCommande> | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBCs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (search) params.append('search', search);

        const response = await fetch(`/backend/adv/bc?${params}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });

        const data = await response.json();
        setBCs(data.bcs);
        setStats(data.stats);
      } catch (err) {
        console.error('Failed to fetch BCs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBCs();
  }, [status, search]);

  return { bcs, stats, loading };
};
```

### useDerogations Hook
```typescript
export const useDerogations = (status: string = 'pending') => {
  const [derogations, setDerogations] = useState<PaginatedResponse<CreditDerogation> | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDerogations = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/backend/adv/derogations?status=${status}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();
      setDerogations(data.derogations);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to fetch derogations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDerogations();
  }, [status]);

  return { derogations, stats, loading, refetch: fetchDerogations };
};
```

---

## 📝 Notes

1. **Pagination**: All list endpoints support pagination with 20-50 items per page
2. **Timestamps**: All timestamps are in ISO 8601 format (UTC)
3. **Decimal Values**: All monetary values are decimal with 2 decimal places
4. **Status Values**: Use exact string values as shown in enums
5. **Validation**: Always handle 422 validation errors on the frontend
6. **Loading States**: Implement loading states for better UX
7. **Error Handling**: Implement proper error handling and user feedback
8. **Token Refresh**: Implement token refresh logic for expired tokens

---

**Version**: 1.0  
**Last Updated**: December 13, 2025  
**Base URL**: `/backend/adv`  
**Authentication**: Laravel Sanctum Bearer Token
