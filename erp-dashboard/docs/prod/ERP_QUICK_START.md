# ERP Workflow System - Quick Start Guide

**Version:** 1.0  
**Time to Complete:** 15 minutes

---

## 🚀 Quick Start

### Prerequisites

- ✅ Backend API running
- ✅ Database migrated and seeded
- ✅ Authentication token obtained
- ✅ User with appropriate role (ADV, Dispatcher, Magasinier, or Livreur)

---

## 📦 Step 1: Get Authentication Token

```bash
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "adv@example.com",
    "password": "password"
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "user": {
    "id": 26,
    "name": "Marie ADV",
    "roles": ["adv"]
  }
}
```

**Save the token:**
```javascript
localStorage.setItem('token', response.data.access_token);
```

---

## 📋 Step 2: Get Your Tasks

```javascript
const response = await axios.get('/api/backend/tasks/my-tasks?status=ready', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

console.log(response.data.tasks.data);
```

**You'll see:**
```json
[
  {
    "id": 5,
    "name": "Validate Bon de Commande",
    "status": "ready",
    "can_start": true,
    "taskable": {
      "bc_number": "BC-2025-12-22-0001",
      "partner": {
        "name": "ABC Distribution"
      }
    }
  }
]
```

---

## ✅ Step 3: Claim and Start Task

```javascript
// Claim task
await axios.post('/api/backend/tasks/5/claim', {}, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Start task
await axios.post('/api/backend/tasks/5/start', {}, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 🔍 Step 4: Execute Task (ADV Validation Example)

```javascript
// Run validations
const validationResponse = await axios.post('/api/backend/tasks/5/execute', {
  action: 'validate'
}, {
  headers: { 'Authorization': `Bearer ${token}` }
});

console.log(validationResponse.data.validation_results);
/*
[
  {
    "rule_code": "check_order_data",
    "passed": true,
    "message": "Order data is valid"
  },
  {
    "rule_code": "check_stock",
    "passed": true,
    "message": "All products available"
  }
]
*/
```

---

## ✔️ Step 5: Complete Task

```javascript
// If all validations passed, approve BC
await axios.post('/api/backend/adv/validate-bc/123', {
  action: 'approve',
  notes: 'All checks passed'
}, {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Complete the task
await axios.post('/api/backend/tasks/5/complete', {
  output_data: {
    validation_status: 'approved'
  }
}, {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 📊 Step 6: Check Workflow Progress

```javascript
const progress = await axios.get(
  '/api/backend/tasks/workflow/bc/App\\Models\\Order/123/progress',
  {
    headers: { 'Authorization': `Bearer ${token}` }
  }
);

console.log(progress.data.progress);
/*
{
  "total": 3,
  "completed": 2,
  "in_progress": 0,
  "pending": 1,
  "progress_percentage": 66.67
}
*/
```

---

## 🎨 Frontend Integration Example

### React Component

```jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function TaskDashboard() {
  const [tasks, setTasks] = useState([]);
  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    const response = await axios.get('/api/backend/tasks/my-tasks?status=ready', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    setTasks(response.data.tasks.data);
  };

  const handleTask = async (taskId) => {
    try {
      // Claim
      await axios.post(`/api/backend/tasks/${taskId}/claim`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Start
      await axios.post(`/api/backend/tasks/${taskId}/start`, {}, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Redirect to task execution page
      window.location.href = `/tasks/${taskId}/execute`;
    } catch (error) {
      alert('Error: ' + error.response.data.message);
    }
  };

  return (
    <div className="task-dashboard">
      <h2>My Tasks</h2>
      {tasks.map(task => (
        <div key={task.id} className="task-card">
          <h3>{task.name}</h3>
          <p>{task.description}</p>
          <p><strong>Order:</strong> {task.taskable.bc_number}</p>
          <button onClick={() => handleTask(task.id)}>
            Start Task
          </button>
        </div>
      ))}
    </div>
  );
}

export default TaskDashboard;
```

---

## 🔄 Complete Workflow Example

### Partner → ADV → Dispatcher → Magasinier → Driver

```javascript
// 1. PARTNER: Place order
const orderResponse = await axios.post('/api/place-order', {
  shop_ids: [1],
  address_id: 5
});
// ✅ BC created, 3 tasks auto-created

// 2. ADV: Validate BC
await axios.post('/api/backend/tasks/5/claim');
await axios.post('/api/backend/tasks/5/start');
await axios.post('/api/backend/tasks/5/execute', { action: 'validate' });
await axios.post('/api/backend/adv/validate-bc/123', { action: 'approve' });
await axios.post('/api/backend/tasks/5/complete');
// ✅ BC approved, convert task now ready

// 3. DISPATCHER: Convert to BL
await axios.post('/api/backend/tasks/6/claim');
await axios.post('/api/backend/tasks/6/start');
await axios.post('/api/backend/dispatcher/convert-to-bl/123');
await axios.post('/api/backend/tasks/6/complete');
// ✅ BL created

// 4. DISPATCHER: Group BLs into BCH
await axios.post('/api/backend/dispatcher/create-bch', {
  bl_ids: [45, 46, 47],
  livreur_id: 15
});
// ✅ BCH created, BP auto-created

// 5. MAGASINIER: Prepare orders
await axios.post('/api/backend/magasinier/start-preparation/8');
await axios.post('/api/backend/magasinier/update-quantities/8', {
  items: [{ item_id: 50, prepared_quantity: 100 }]
});
await axios.post('/api/backend/magasinier/complete-preparation/8');
// ✅ Preparation complete, BCH ready for loading

// 6. DRIVER: Deliver
await axios.post('/api/backend/livreur/start-delivery/12');
await axios.post('/api/backend/livreur/update-bl-status/45', {
  status: 'delivered',
  signature: 'base64...'
});
await axios.post('/api/backend/livreur/complete-delivery/12');
// ✅ Delivery complete
```

---

## 🛠️ Common API Patterns

### Pattern 1: List → Claim → Start → Execute → Complete

```javascript
// Get tasks
GET /tasks/my-tasks

// Claim task
POST /tasks/{id}/claim

// Start task
POST /tasks/{id}/start

// Execute task
POST /tasks/{id}/execute

// Complete task
POST /tasks/{id}/complete
```

### Pattern 2: Check Progress

```javascript
// Get workflow progress
GET /tasks/workflow/{type}/{model}/{id}/progress

// Get task statistics
GET /tasks/statistics
```

### Pattern 3: Role-Specific Actions

```javascript
// ADV
POST /adv/validate-bc/{id}
POST /adv/reject-bc/{id}

// Dispatcher
POST /dispatcher/convert-to-bl/{id}
POST /dispatcher/create-bch

// Magasinier
POST /magasinier/create-bp-from-orders
POST /magasinier/start-preparation/{id}
POST /magasinier/complete-preparation/{id}
```

---

## 📚 Next Steps

1. ✅ **Read Full Documentation:**
   - [System Overview](./ERP_WORKFLOW_OVERVIEW.md)
   - [API Reference](./ERP_API_REFERENCE.md)
   - [Real-World Scenarios](./ERP_SCENARIOS.md)

2. ✅ **Explore Template System:**
   - [Workflow Templates](./WORKFLOW_TEMPLATE_SYSTEM.md)

3. ✅ **Build Frontend:**
   - Use provided React/Vue/Angular examples
   - Implement task dashboard
   - Add workflow progress visualization

4. ✅ **Test Thoroughly:**
   - Test each role's workflow
   - Test error scenarios
   - Test concurrent users

---

## 🆘 Need Help?

- **Documentation:** Check [Troubleshooting Guide](./ERP_TROUBLESHOOTING.md)
- **API Issues:** Review [API Reference](./ERP_API_REFERENCE.md)
- **Examples:** See [Scenarios](./ERP_SCENARIOS.md)

---

**🎉 You're ready to integrate the ERP workflow system!**
