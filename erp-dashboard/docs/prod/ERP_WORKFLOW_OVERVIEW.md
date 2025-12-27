# ERP Workflow System - Overview & Architecture

**Version:** 1.0  
**Last Updated:** December 22, 2025  
**Status:** Production Ready  
**Target Audience:** Frontend Developers, API Consumers

---

## 🎯 System Overview

### What is This System?

A **comprehensive ERP workflow management system** for B2B distribution operations managing the complete lifecycle from order to delivery.

### Key Components

1. **Order Management** (Bon de Commande - BC)
2. **Delivery Notes** (Bon de Livraison - BL)
3. **Loading Documents** (Bon de Chargement - BCH)
4. **Preparation Orders** (Bon de Préparation - BP)
5. **Task Orchestration** (Automated workflows)
6. **Template System** (Dynamic task creation)

### Key Features

✅ **Template-Based Workflows** - Define once, clone automatically  
✅ **Task Dependencies** - Automatic sequencing  
✅ **Role-Based Assignments** - ADV, Dispatcher, Magasinier, Livreur  
✅ **Validation Rules** - Stock, credit, partner checks  
✅ **Real-Time Progress** - Track completion  
✅ **Audit Trail** - Complete history  
✅ **Multi-Branch Support** - Branch-specific operations  

---

## 🏗️ Architecture

### System Layers

```
┌─────────────────────────────────────────────────┐
│           FRONTEND LAYER                         │
│  (React/Vue/Angular - API Consumer)             │
└──────────────────┬──────────────────────────────┘
                   │ REST API
                   ▼
┌─────────────────────────────────────────────────┐
│           BACKEND API LAYER                      │
│  Controllers: ADV, Dispatcher, Magasinier, Task │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           SERVICE LAYER                          │
│  - WorkflowTemplateService                      │
│  - TaskOrchestrationService                     │
│  - TaskAssignmentService                        │
│  - TaskValidationService                        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           DATA LAYER                             │
│  Models: Order, BonLivraison, WorkflowTask      │
└─────────────────────────────────────────────────┘
```

### Complete Workflow Flow

```
Partner Places Order
        │
        ▼
┌──────────────────────────────────────────────────┐
│ 1. BC WORKFLOW (Order)                           │
│  Create BC → Validate BC → Convert to BL        │
│  (System)    (ADV)         (Dispatcher)         │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 2. BL WORKFLOW (Delivery Note)                   │
│  Group BL (Dispatcher)                           │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 3. BCH WORKFLOW (Loading Document)               │
│  Prepare → Load → Deliver                       │
│  (Magasin) (Disp) (Livreur)                     │
└──────────────────┬───────────────────────────────┘
                   ▼
┌──────────────────────────────────────────────────┐
│ 4. BP WORKFLOW (Preparation)                     │
│  Pick Items → Validate Prep                     │
│  (Magasinier)  (Magasinier)                     │
└──────────────────────────────────────────────────┘
```

---

## 📦 Document Types

### 1. BC (Bon de Commande) - Order

**Table:** `orders`  
**Model:** `App\Models\Order`  
**Created By:** Partner or Televendeur

**Status Flow:**
```
submitted → adv_review → adv_approved → converted_to_bl
     ↓           ↓
adv_rejected  adv_on_hold
```

### 2. BL (Bon de Livraison) - Delivery Note

**Table:** `delivery_notes`  
**Model:** `App\Models\BonLivraison`  
**Created By:** Dispatcher

**Status Flow:**
```
draft → grouped → submitted_to_magasinier → prepared → 
loaded → in_transit → delivered
```

### 3. BCH (Bon de Chargement) - Loading Document

**Table:** `shipments`  
**Model:** `App\Models\BonChargement`  
**Created By:** Dispatcher

**Status Flow:**
```
pending → in_preparation → loaded → in_transit → completed
```

### 4. BP (Bon de Préparation) - Preparation Order

**Table:** `preparation_orders`  
**Model:** `App\Models\BonPreparation`  
**Created By:** Magasinier

**Status Flow:**
```
pending → in_progress → completed
```

---

## 🔄 Task Orchestration

### Task Lifecycle

```
pending → ready → in_progress → completed
   ↓        ↓          ↓
   └────────┴─────────→ failed → cancelled
```

### Task States

| State | Description | Can Start? |
|-------|-------------|------------|
| `pending` | Waiting for dependencies | ❌ |
| `ready` | Dependencies satisfied | ✅ |
| `in_progress` | Currently executing | ❌ |
| `completed` | Successfully finished | ❌ |
| `failed` | Execution failed | ❌ |
| `cancelled` | Manually cancelled | ❌ |

### Task Types

- `creation` - Creating documents
- `validation` - Validating data
- `conversion` - Converting documents
- `dispatch` - Dispatching/grouping
- `preparation` - Warehouse picking
- `delivery` - Delivery operations
- `control` - Quality control
- `approval` - Approval workflows

---

## 🎭 User Roles

### ADV (Administration des Ventes)
- Validates BCs
- Checks stock, credit, partner status
- Approves/rejects orders

### Dispatcher
- Converts BC to BL
- Groups BLs into BCH
- Assigns drivers
- Manages loading

### Magasinier (Warehouse Manager)
- Creates BP from BCs or BCH
- Picks items from warehouse
- Updates prepared quantities
- Handles shortages

### Livreur (Driver)
- Delivers BCH
- Updates delivery status
- Collects signatures
- Reports issues

---

## 📊 Key Metrics

### Workflow Progress
- Total tasks
- Completed tasks
- In progress tasks
- Failed tasks
- Progress percentage

### Performance Indicators
- Average completion time per task
- Task failure rate
- Workflow bottlenecks
- User productivity

---

## 🔐 Security

- **Authentication:** Bearer token required
- **Authorization:** Role-based access control
- **Audit Trail:** All actions logged
- **Data Validation:** Input sanitization
- **SQL Injection Protection:** Eloquent ORM

---

## 📚 Related Documentation

- [API Reference](./ERP_API_REFERENCE.md)
- [Frontend Integration](./ERP_FRONTEND_GUIDE.md)
- [Scenarios & Examples](./ERP_SCENARIOS.md)
- [Troubleshooting](./ERP_TROUBLESHOOTING.md)
- [Template System](./WORKFLOW_TEMPLATE_SYSTEM.md)

---

**Next:** Read [API Reference](./ERP_API_REFERENCE.md) for detailed endpoint documentation.
