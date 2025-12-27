# ERP Workflow System - Real-World Scenarios & Examples

**Version:** 1.0  
**Target Audience:** Frontend Developers

---

## 📋 Table of Contents

1. [Scenario 1: Partner Places Order](#scenario-1-partner-places-order)
2. [Scenario 2: ADV Validates BC](#scenario-2-adv-validates-bc)
3. [Scenario 3: Dispatcher Converts BC to BL](#scenario-3-dispatcher-converts-bc-to-bl)
4. [Scenario 4: Dispatcher Groups BLs into BCH](#scenario-4-dispatcher-groups-bls-into-bch)
5. [Scenario 5: Magasinier Prepares Orders](#scenario-5-magasinier-prepares-orders)
6. [Scenario 6: Handling Shortages](#scenario-6-handling-shortages)
7. [Scenario 7: Delivery Process](#scenario-7-delivery-process)
8. [Scenario 8: Adding New Task to Workflow](#scenario-8-adding-new-task-to-workflow)

---

## Scenario 1: Partner Places Order

### Business Context
Partner "ABC Distribution" places an order for 100 units of Product XYZ worth 15,000 DZD.

### What Happens Automatically

1. **Order Created** → BC-2025-12-22-0001
2. **3 Workflow Tasks Auto-Created from Templates:**
   - ✅ Create BC (completed immediately)
   - ⏳ Validate BC (ready for ADV)
   - ⏸️ Convert to BL (pending validation)

### API Flow

```javascript
// 1. Partner places order
const response = await axios.post('/api/place-order', {
  shop_ids: [1],
  address_id: 5,
  items: [
    {
      product_id: 53,
      quantity: 100,
      unit_price: 150.00
    }
  ]
}, {
  headers: { 'Authorization': 'Bearer {partner_token}' }
});

// Response includes workflow info
console.log(response.data);
/*
{
  "success": true,
  "order": {
    "id": 123,
    "bc_number": "BC-2025-12-22-0001",
    "bc_status": "submitted",
    "total_amount": 15000.00
  },
  "workflow": {
    "status": "created",
    "message": "Your order is pending ADV validation",
    "next_step": "ADV will validate stock, credit limit, and partner status",
    "tasks": [
      {
        "name": "Create Bon de Commande",
        "status": "completed",
        "assigned_to": "system"
      },
      {
        "name": "Validate Bon de Commande",
        "status": "ready",
        "assigned_to": "adv"
      },
      {
        "name": "Convert to BL",
        "status": "pending",
        "assigned_to": "dispatcher"
      }
    ]
  }
}
*/
```

### Frontend Display

```jsx
// OrderConfirmation.jsx
function OrderConfirmation({ order, workflow }) {
  return (
    <div className="order-confirmation">
      <h2>✅ Order Placed Successfully!</h2>
      
      <div className="order-info">
        <p><strong>BC Number:</strong> {order.bc_number}</p>
        <p><strong>Total:</strong> {formatCurrency(order.total_amount)}</p>
        <p><strong>Status:</strong> {order.bc_status}</p>
      </div>

      <div className="workflow-status">
        <h3>📋 Order Processing Status</h3>
        <p>{workflow.message}</p>
        
        <div className="workflow-steps">
          {workflow.tasks.map((task, index) => (
            <div key={index} className={`step step-${task.status}`}>
              <span className="step-number">{index + 1}</span>
              <div className="step-content">
                <h4>{task.name}</h4>
                <span className="badge">{task.status}</span>
                <p>Assigned to: {task.assigned_to}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="next-steps">
        <h4>🔔 What's Next?</h4>
        <p>{workflow.next_step}</p>
        <p>You will be notified once your order is validated.</p>
      </div>
    </div>
  );
}
```

---

## Scenario 2: ADV Validates BC

### Business Context
ADV user "Marie" needs to validate BC-2025-12-22-0001. She checks stock, credit limit, and partner status.

### Step-by-Step Process

#### Step 1: ADV Sees Task in Dashboard

```javascript
// Get my tasks
const response = await axios.get('/api/backend/tasks/my-tasks?status=ready');

/*
{
  "tasks": {
    "data": [
      {
        "id": 5,
        "name": "Validate Bon de Commande",
        "taskable": {
          "bc_number": "BC-2025-12-22-0001",
          "partner": {
            "name": "ABC Distribution",
            "credit_available": 55000.00
          }
        },
        "validation_rules": [
          {"rule_code": "check_order_data", "rule_name": "Check Order Data"},
          {"rule_code": "check_partner_status", "rule_name": "Check Partner Status"},
          {"rule_code": "check_stock", "rule_name": "Check Stock Availability"},
          {"rule_code": "check_credit_limit", "rule_name": "Check Credit Limit"}
        ]
      }
    ]
  }
}
*/
```

#### Step 2: Claim Task

```javascript
await axios.post('/api/backend/tasks/5/claim');
// Task now assigned to Marie
```

#### Step 3: Start Task

```javascript
await axios.post('/api/backend/tasks/5/start');
// Task status: in_progress
```

#### Step 4: Run Validations

```javascript
// Execute validation
const validationResponse = await axios.post('/api/backend/tasks/5/execute', {
  action: 'validate'
});

/*
{
  "validation_results": [
    {
      "rule_code": "check_order_data",
      "passed": true,
      "message": "Order data is valid"
    },
    {
      "rule_code": "check_partner_status",
      "passed": true,
      "message": "Partner is active and not blocked"
    },
    {
      "rule_code": "check_stock",
      "passed": true,
      "message": "All products available",
      "details": [
        {
          "product_id": 53,
          "product_name": "Product XYZ",
          "requested": 100,
          "available": 150,
          "status": "ok"
        }
      ]
    },
    {
      "rule_code": "check_credit_limit",
      "passed": true,
      "message": "Credit limit OK",
      "details": {
        "order_amount": 15000.00,
        "credit_used": 45000.00,
        "credit_limit": 100000.00,
        "credit_after_order": 60000.00,
        "credit_available": 40000.00
      }
    }
  ],
  "all_passed": true
}
*/
```

#### Step 5: Approve BC

```javascript
// Approve BC
await axios.post('/api/backend/adv/validate-bc/123', {
  action: 'approve',
  notes: 'All validations passed'
});

// Complete task
await axios.post('/api/backend/tasks/5/complete', {
  output_data: {
    validation_status: 'approved',
    validated_at: new Date().toISOString()
  }
});

/*
{
  "success": true,
  "message": "BC validated and approved",
  "order": {
    "bc_status": "adv_approved"
  },
  "dependent_tasks_updated": [
    {
      "id": 6,
      "code": "convert_to_bl",
      "status": "ready",
      "message": "Task is now ready for dispatcher"
    }
  ]
}
*/
```

### Frontend Component

```vue
<template>
  <div class="bc-validation">
    <h2>Validate BC: {{ order.bc_number }}</h2>
    
    <!-- Validation Checklist -->
    <div class="validation-checklist">
      <div v-for="rule in validationRules" 
           :key="rule.rule_code"
           class="validation-item">
        <div class="rule-header">
          <h4>{{ rule.rule_name }}</h4>
          <span :class="['badge', getStatus(rule.rule_code)]">
            {{ getStatus(rule.rule_code) }}
          </span>
        </div>
        
        <!-- Show details if available -->
        <div v-if="results[rule.rule_code]" class="rule-details">
          <p>{{ results[rule.rule_code].message }}</p>
          
          <!-- Stock details -->
          <table v-if="rule.rule_code === 'check_stock' && results[rule.rule_code].details">
            <tr v-for="item in results[rule.rule_code].details" :key="item.product_id">
              <td>{{ item.product_name }}</td>
              <td>Requested: {{ item.requested }}</td>
              <td>Available: {{ item.available }}</td>
              <td><span :class="['badge', item.status]">{{ item.status }}</span></td>
            </tr>
          </table>
          
          <!-- Credit details -->
          <div v-if="rule.rule_code === 'check_credit_limit' && results[rule.rule_code].details">
            <p>Order Amount: {{ formatCurrency(results[rule.rule_code].details.order_amount) }}</p>
            <p>Current Credit Used: {{ formatCurrency(results[rule.rule_code].details.credit_used) }}</p>
            <p>Credit After Order: {{ formatCurrency(results[rule.rule_code].details.credit_after_order) }}</p>
            <p>Remaining Available: {{ formatCurrency(results[rule.rule_code].details.credit_available) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="actions">
      <button @click="approveBC" 
              :disabled="!allPassed"
              class="btn btn-success">
        ✅ Approve BC
      </button>
      <button @click="rejectBC" class="btn btn-danger">
        ❌ Reject BC
      </button>
    </div>
  </div>
</template>
```

---

## Scenario 3: Dispatcher Converts BC to BL

### Business Context
Dispatcher "Ahmed" converts approved BC to delivery note (BL).

### API Flow

```javascript
// 1. Get approved BCs ready for conversion
const response = await axios.get('/api/backend/dispatcher/pending-orders');

// 2. Convert BC to BL
const blResponse = await axios.post('/api/backend/dispatcher/convert-to-bl/123', {
  delivery_date: '2025-12-23',
  notes: 'Standard delivery'
});

/*
{
  "success": true,
  "message": "BC converted to BL successfully",
  "order": {
    "id": 123,
    "bc_status": "converted_to_bl"
  },
  "bon_livraison": {
    "id": 45,
    "bl_number": "BL-ABC-2025-12-22-0001",
    "status": "draft",
    "partner": {
      "name": "ABC Distribution"
    },
    "items": [
      {
        "product_id": 53,
        "product_name": "Product XYZ",
        "requested_quantity": 100,
        "unit_price": 150.00
      }
    ]
  }
}
*/

// 3. Complete conversion task
await axios.post('/api/backend/tasks/6/complete', {
  output_data: {
    bl_id: 45,
    bl_number: 'BL-ABC-2025-12-22-0001'
  }
});
```

---

## Scenario 4: Dispatcher Groups BLs into BCH

### Business Context
Dispatcher groups 3 BLs for the same route into one BCH for driver "Karim".

### API Flow

```javascript
// 1. Get draft BLs
const blsResponse = await axios.get('/api/backend/dispatcher/draft-bls');

// 2. Select BLs to group (same route, same branch)
const selectedBLs = [45, 46, 47];

// 3. Create BCH
const bchResponse = await axios.post('/api/backend/dispatcher/create-bch', {
  bl_ids: selectedBLs,
  livreur_id: 15,
  notes: 'Route A - Morning delivery'
});

/*
{
  "success": true,
  "message": "BCH created successfully",
  "bon_chargement": {
    "id": 12,
    "bch_number": "BCH-2025-12-22-001",
    "status": "pending",
    "livreur": {
      "id": 15,
      "name": "Karim Benali"
    },
    "bonLivraisons": [
      {"id": 45, "bl_number": "BL-001", "partner": "ABC Distribution"},
      {"id": 46, "bl_number": "BL-002", "partner": "XYZ Trading"},
      {"id": 47, "bl_number": "BL-003", "partner": "DEF Company"}
    ],
    "total_bls": 3,
    "total_amount": 45000.00
  },
  "bon_preparation": {
    "id": 8,
    "bp_number": "BP-BCH001-2025-12-22",
    "status": "pending",
    "message": "BP created automatically for warehouse preparation"
  }
}
*/
```

### Frontend Component

```jsx
function BLGrouping() {
  const [draftBLs, setDraftBLs] = useState([]);
  const [selectedBLs, setSelectedBLs] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);

  const handleSelectBL = (blId) => {
    setSelectedBLs(prev => 
      prev.includes(blId) 
        ? prev.filter(id => id !== blId)
        : [...prev, blId]
    );
  };

  const createBCH = async () => {
    try {
      const response = await axios.post('/api/backend/dispatcher/create-bch', {
        bl_ids: selectedBLs,
        livreur_id: selectedDriver,
        notes: document.getElementById('notes').value
      });
      
      alert(`BCH ${response.data.bon_chargement.bch_number} created successfully!`);
      // Redirect to BCH details
      window.location.href = `/dispatcher/bch/${response.data.bon_chargement.id}`;
    } catch (error) {
      alert('Error creating BCH: ' + error.response.data.message);
    }
  };

  return (
    <div className="bl-grouping">
      <h2>Group BLs into BCH</h2>
      
      {/* BL Selection */}
      <div className="bl-list">
        {draftBLs.map(bl => (
          <div key={bl.id} 
               className={`bl-card ${selectedBLs.includes(bl.id) ? 'selected' : ''}`}
               onClick={() => handleSelectBL(bl.id)}>
            <input type="checkbox" 
                   checked={selectedBLs.includes(bl.id)} 
                   readOnly />
            <div className="bl-info">
              <h4>{bl.bl_number}</h4>
              <p>Partner: {bl.partner.name}</p>
              <p>Amount: {formatCurrency(bl.total_amount)}</p>
              <p>Items: {bl.items_count}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Driver Selection */}
      <div className="driver-selection">
        <label>Select Driver:</label>
        <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)}>
          <option value="">-- Select Driver --</option>
          {drivers.map(driver => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="summary">
        <h3>Summary</h3>
        <p>Selected BLs: {selectedBLs.length}</p>
        <p>Total Amount: {formatCurrency(
          draftBLs
            .filter(bl => selectedBLs.includes(bl.id))
            .reduce((sum, bl) => sum + bl.total_amount, 0)
        )}</p>
      </div>

      {/* Create Button */}
      <button onClick={createBCH} 
              disabled={selectedBLs.length === 0 || !selectedDriver}
              className="btn btn-primary">
        Create BCH
      </button>
    </div>
  );
}
```

---

## Scenario 5: Magasinier Prepares Orders

### Business Context
Magasinier "Hassan" prepares BP-BCH001-2025-12-22 containing 3 orders.

### API Flow

```javascript
// 1. Get pending preparations
const response = await axios.get('/api/backend/magasinier/pending-preparations');

// 2. Start preparation
await axios.post('/api/backend/magasinier/start-preparation/8');

// 3. Update quantities as items are picked
await axios.post('/api/backend/magasinier/update-quantities/8', {
  items: [
    {
      item_id: 50,
      prepared_quantity: 100,
      shortage: 0,
      notes: 'All items picked'
    },
    {
      item_id: 51,
      prepared_quantity: 95,
      shortage: 5,
      notes: '5 units damaged'
    }
  ]
});

// 4. Complete preparation
const completeResponse = await axios.post('/api/backend/magasinier/complete-preparation/8');

/*
{
  "success": true,
  "message": "Preparation completed",
  "bon_preparation": {
    "id": 8,
    "status": "completed",
    "prepared_at": "2025-12-22T14:00:00Z",
    "overall_completion": 97.5
  },
  "stock_movements": [
    {
      "product_id": 53,
      "quantity": -100,
      "type": "preparation",
      "reference": "BP-BCH001-2025-12-22"
    }
  ],
  "bon_chargement": {
    "id": 12,
    "status": "prepared",
    "message": "BCH ready for loading"
  }
}
*/
```

---

## Scenario 6: Handling Shortages

### Business Context
During preparation, magasinier discovers shortage of 10 units.

### API Flow

```javascript
// Update with shortage
await axios.post('/api/backend/magasinier/update-quantities/8', {
  items: [
    {
      item_id: 50,
      prepared_quantity: 90,  // Requested: 100
      shortage: 10,
      notes: 'Only 90 units available in stock'
    }
  ]
});

// System automatically:
// 1. Records shortage
// 2. Updates stock
// 3. Notifies dispatcher
// 4. Creates shortage report
```

### Frontend Handling

```jsx
function PreparationItem({ item, onUpdate }) {
  const [preparedQty, setPreparedQty] = useState(item.prepared_quantity);
  const [notes, setNotes] = useState('');

  const handleUpdate = () => {
    const shortage = item.requested_quantity - preparedQty;
    
    if (shortage > 0) {
      const confirmed = confirm(
        `Shortage detected: ${shortage} units missing. Continue?`
      );
      if (!confirmed) return;
    }

    onUpdate({
      item_id: item.id,
      prepared_quantity: preparedQty,
      shortage: shortage,
      notes: notes
    });
  };

  return (
    <div className="prep-item">
      <h4>{item.product_name}</h4>
      <p>Location: {item.location}</p>
      <p>Requested: {item.requested_quantity}</p>
      
      <div className="quantity-input">
        <label>Prepared Quantity:</label>
        <input 
          type="number" 
          value={preparedQty}
          onChange={e => setPreparedQty(parseInt(e.target.value))}
          max={item.requested_quantity}
        />
      </div>

      {preparedQty < item.requested_quantity && (
        <div className="shortage-warning">
          ⚠️ Shortage: {item.requested_quantity - preparedQty} units
        </div>
      )}

      <textarea 
        placeholder="Notes (required for shortages)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      <button onClick={handleUpdate}>Update</button>
    </div>
  );
}
```

---

## Scenario 7: Delivery Process

### Business Context
Driver "Karim" delivers BCH-2025-12-22-001 with 3 BLs.

### Mobile App Flow

```javascript
// 1. Driver sees assigned BCH
const response = await axios.get('/api/backend/livreur/my-deliveries');

// 2. Start delivery
await axios.post('/api/backend/livreur/start-delivery/12');

// 3. For each BL, update status
await axios.post('/api/backend/livreur/update-bl-status/45', {
  status: 'delivered',
  signature: 'base64_signature_image',
  proof_photo: 'base64_photo',
  delivered_at: new Date().toISOString(),
  notes: 'Delivered to warehouse manager'
});

// 4. Complete BCH delivery
await axios.post('/api/backend/livreur/complete-delivery/12');
```

---

## Scenario 8: Adding New Task to Workflow

### Business Context
Management wants to add fraud detection check before ADV validation.

### API Flow

```javascript
// 1. Create new task template
const templateResponse = await axios.post('/api/backend/workflow-templates/1/templates', {
  code: 'fraud_check',
  name: 'Fraud Detection Check',
  description: 'Check order for fraud indicators',
  task_type: 'validation',
  order: 1.5,  // Between create (1) and validate (2)
  timeout_minutes: 10,
  auto_complete: false,
  assignment_type: 'role',
  assignment_target: 'security',
  is_active: true
});

// 2. Add dependency
await axios.post(`/api/backend/workflow-templates/1/templates/${templateResponse.data.template.id}/dependencies`, {
  depends_on_template_id: 1,  // Create BC
  dependency_type: 'blocking'
});

// 3. Add validation rule
await axios.post(`/api/backend/workflow-templates/1/templates/${templateResponse.data.template.id}/validation-rules`, {
  rule_code: 'check_fraud_score',
  rule_name: 'Check Fraud Score',
  validator_class: 'App\\Validators\\FraudDetectionValidator',
  order: 1,
  is_required: true,
  stop_on_failure: true,
  parameters: {
    threshold: 0.7
  }
});

// ✅ Done! Next order will automatically include fraud check task
```

---

## 🎯 Key Takeaways

1. **Automatic Task Creation** - Tasks created from templates when order placed
2. **Dependency Management** - Tasks wait for dependencies automatically
3. **Role-Based Assignment** - Tasks assigned to correct roles
4. **Validation Rules** - Business rules enforced automatically
5. **Progress Tracking** - Real-time workflow progress
6. **Flexible Workflows** - Add/modify tasks without code changes

---

**Next:** See [Troubleshooting Guide](./ERP_TROUBLESHOOTING.md) for common issues and solutions.
