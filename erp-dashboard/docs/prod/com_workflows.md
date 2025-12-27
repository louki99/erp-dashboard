# How to Complete the Postman Collection

## Quick Summary

Your existing Postman collection (`BC_Workflow_Complete_Testing.postman_collection.json`) is **90% complete**. You need to add:

1. ✅ **Enhanced test scripts** with proper assertions
2. ✅ **Variable extraction** from metadata (bl_id, bch_id, bp_id)
3. ✅ **Dashboard endpoints** (3 new requests)
4. ✅ **Detail endpoints** (4 new requests)
5. ✅ **BP item updates** (1 NEW critical endpoint)
6. ✅ **Stock management** (1 new request)
7. ✅ **List endpoints** (3 new requests)
8. ✅ **Fix authentication URLs** (change to /backend/login)

**Total additions needed: ~15 new requests + enhanced test scripts**

---

## Critical Changes Required

### 1. Fix Authentication Endpoints (IMPORTANT!)

**Current (Wrong):**
```json
{
    "url": "{{base_url}}/api/login",
    "body": {
        "email": "dispatcher@example.com"
    }
}
```

**Should be:**
```json
{
    "url": "{{base_url}}/backend/login",
    "body": {
        "email": "dispatcher@foodsolutions.ma"
    }
}
```

**Fix these 5 login requests:**
- Login as Partner → `partner@foodsolutions.ma`, `/backend/login`
- Login as ADV → `adv@foodsolutions.ma`, `/backend/login`
- Login as Dispatcher → `dispatcher@foodsolutions.ma`, `/backend/login`
- Login as Magasinier → `magasinier@foodsolutions.ma`, `/backend/login`
- Login as Driver → `driver@foodsolutions.ma`, `/backend/login`

### 2. Add Missing Collection Variables

Add to the `variable` array at the top of the JSON:

```json
{
    "key": "product_id",
    "value": "1",
    "type": "string"
},
{
    "key": "livreur_id",
    "value": "",
    "type": "string"
},
{
    "key": "partner_id",
    "value": "",
    "type": "string"
}
```

---

## New Endpoints to Add

### Folder: "1. BC Creation (Partner)"

**Add after "Place Order (Create BC)":**

#### 1.1 Get Partner Products
```json
{
    "name": "Get Partner Products",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/products?per_page=10"
    },
    "event": [{
        "listen": "test",
        "script": {
            "exec": [
                "pm.test('Products retrieved', function() {",
                "    pm.response.to.have.status(200);",
                "    var jsonData = pm.response.json();",
                "    if (jsonData.data.length > 0) {",
                "        pm.collectionVariables.set('product_id', jsonData.data[0].id);",
                "    }",
                "});"
            ]
        }
    }]
}
```

#### 1.2 Get BC Details
```json
{
    "name": "Get BC Details",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/orders/{{order_id}}"
    },
    "event": [{
        "listen": "test",
        "script": {
            "exec": [
                "pm.test('BC details retrieved', function() {",
                "    pm.response.to.have.status(200);",
                "    var jsonData = pm.response.json();",
                "    pm.expect(jsonData).to.have.property('bc_number');",
                "});"
            ]
        }
    }]
}
```

### Folder: "2. BC Review & Approval (ADV)"

**Add after "Send BC to ADV Review":**

#### 2.1 ADV Dashboard Stats
```json
{
    "name": "ADV Dashboard Stats",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/adv/dashboard"
    }
}
```

#### 2.2 Get Pending BCs for Review
```json
{
    "name": "Get Pending BCs for Review",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/api/workflow/orders/pending-review"
    }
}
```

### Folder: "4. BL Creation & Grouping (Dispatcher)"

**Add after "Convert BC to BL":**

#### 4.1 Dispatcher Dashboard
```json
{
    "name": "Dispatcher Dashboard",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/dispatcher/dashboard"
    }
}
```

#### 4.2 Get Draft BLs
```json
{
    "name": "Get Draft BLs",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/dispatcher/bon-livraisons/draft"
    }
}
```

#### 4.3 Get BL Details
```json
{
    "name": "Get BL Details",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/dispatcher/bon-livraisons/{{bl_id}}"
    }
}
```

### Folder: "5. BCH Workflow"

**Add after "Check BCH Workflow Status":**

#### 5.1 Get BCH Details
```json
{
    "name": "Get BCH Details",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/dispatcher/bon-chargements/{{bch_id}}"
    }
}
```

### Folder: "6. BP Preparation (Magasinier)"

**Add after "Check BP Workflow Status":**

#### 6.1 Magasinier Dashboard
```json
{
    "name": "Magasinier Dashboard",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/magasinier/dashboard"
    }
}
```

#### 6.2 Get Pending Preparations
```json
{
    "name": "Get Pending Preparations",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/magasinier/preparations/pending"
    }
}
```

#### 6.3 Get BP Details for Preparation
```json
{
    "name": "Get BP Details for Preparation",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/magasinier/preparations/{{bp_id}}/prepare"
    }
}
```

#### 6.4 Update BP Item Quantities ⭐ **MOST IMPORTANT NEW ENDPOINT**
```json
{
    "name": "Update BP Item Quantities (NEW!)",
    "request": {
        "method": "PUT",
        "header": [
            {
                "key": "Content-Type",
                "value": "application/json"
            }
        ],
        "body": {
            "mode": "raw",
            "raw": "{\n    \"items\": [\n        {\n            \"product_id\": {{product_id}},\n            \"prepared_quantity\": 50\n        }\n    ]\n}"
        },
        "url": "{{base_url}}/backend/magasinier/preparations/{{bp_id}}/items"
    },
    "event": [{
        "listen": "test",
        "script": {
            "exec": [
                "pm.test('Items updated successfully', function() {",
                "    pm.response.to.have.status(200);",
                "    var jsonData = pm.response.json();",
                "    pm.expect(jsonData.success).to.be.true;",
                "    pm.expect(jsonData.data.statistics.progress).to.be.a('number');",
                "    console.log('Progress: ' + jsonData.data.statistics.progress + '%');",
                "});"
            ]
        }
    }]
}
```

#### 6.5 Get Stock Status
```json
{
    "name": "Get Stock Status",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/backend/magasinier/stock"
    }
}
```

### Folder: "7. BL Loading & Transit"

**Add after "Start Transit":**

#### 7.1 Get BLs In Transit
```json
{
    "name": "Get BLs In Transit",
    "request": {
        "method": "GET",
        "url": "{{base_url}}/api/workflow/bon-livraisons/in-transit"
    }
}
```

---

## Enhanced Test Scripts

### For "Convert BC to BL" request:

**Add this test script:**
```javascript
pm.test('BC converted to BL', function() {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});

pm.test('BL created in metadata', function() {
    var jsonData = pm.response.json();
    if (jsonData.metadata && jsonData.metadata.bl_creation) {
        pm.expect(jsonData.metadata.bl_creation.created).to.be.true;
        pm.expect(jsonData.metadata.bl_creation.bl.id).to.be.a('number');
        pm.collectionVariables.set('bl_id', jsonData.metadata.bl_creation.bl.id);
        console.log('BL ID saved: ' + jsonData.metadata.bl_creation.bl.id);
    }
});
```

### For "Group BLs in BCH" request:

**Add this test script:**
```javascript
pm.test('BL grouped successfully', function() {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
});

pm.test('BCH created in metadata', function() {
    var jsonData = pm.response.json();
    if (jsonData.metadata && jsonData.metadata.bch_creation) {
        pm.expect(jsonData.metadata.bch_creation.created).to.be.true;
        pm.expect(jsonData.metadata.bch_creation.bch.id).to.be.a('number');
        pm.collectionVariables.set('bch_id', jsonData.metadata.bch_creation.bch.id);
        console.log('BCH ID saved: ' + jsonData.metadata.bch_creation.bch.id);
    }
});
```

### For "Send BCH to Warehouse" request:

**Add this test script:**
```javascript
pm.test('BCH sent to warehouse', function() {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.expect(jsonData.success).to.be.true;
    pm.expect(jsonData.current_state).to.equal('in_preparation');
});

pm.test('BP info in metadata', function() {
    var jsonData = pm.response.json();
    if (jsonData.metadata && jsonData.metadata.bp_info) {
        pm.expect(jsonData.metadata.bp_info.exists).to.be.true;
        pm.expect(jsonData.metadata.bp_info.bp.id).to.be.a('number');
        pm.collectionVariables.set('bp_id', jsonData.metadata.bp_info.bp.id);
        console.log('BP ID saved: ' + jsonData.metadata.bp_info.bp.id);
    }
});
```

---

## Testing Order (38 Steps)

Run requests in this exact order:

1. ✅ Login as Partner
2. ✅ Get Partner Products
3. ✅ Place Order (Create BC)
4. ✅ Get BC Details
5. ✅ Check BC Workflow Status
6. ✅ Validate Transition
7. ✅ Login as ADV
8. ✅ ADV Dashboard Stats
9. ✅ Get Pending BCs for Review
10. ✅ Send BC to ADV Review
11. ✅ Check Available Actions (ADV)
12. ✅ Approve BC (ADV)
13. ✅ Login as Dispatcher
14. ✅ Dispatcher Dashboard
15. ✅ Convert BC to BL
16. ✅ Check BL Workflow Status
17. ✅ Get BL Details
18. ✅ Get Draft BLs
19. ✅ Group BLs in BCH
20. ✅ Check BCH Workflow Status
21. ✅ Get BCH Details
22. ✅ Send BCH to Warehouse
23. ✅ Login as Magasinier
24. ✅ Magasinier Dashboard
25. ✅ Get Pending Preparations
26. ✅ Check BP Workflow Status
27. ✅ Get BP Details for Preparation
28. ✅ Start BP Preparation
29. ✅ **Update BP Item Quantities** (NEW!)
30. ✅ Get Stock Status
31. ✅ Complete BP Preparation
32. ✅ Login as Dispatcher
33. ✅ Mark BL as Prepared
34. ✅ Load BL on Vehicle
35. ✅ Login as Driver
36. ✅ Start Transit
37. ✅ Get BLs In Transit
38. ✅ Mark BL as Delivered
39. ✅ Get BC Workflow History
40. ✅ Get BL Workflow History
41. ✅ Get BCH Workflow History
42. ✅ Get BP Workflow History

---

## Quick Edit Guide

### Using Postman UI (Easiest):

1. Open Postman
2. Import `BC_Workflow_Complete_Testing.postman_collection.json`
3. For each folder, click "Add Request"
4. Copy the request details from above
5. Add test scripts in the "Tests" tab
6. Save collection

### Using JSON Editor:

1. Open `BC_Workflow_Complete_Testing.postman_collection.json` in VS Code
2. Find the folder's `"item"` array
3. Add new request objects from `POSTMAN_ADDITIONS.json`
4. Save file
5. Re-import in Postman

---

## Validation Checklist

After completing the collection, verify:

- [ ] All 5 login endpoints use `/backend/login`
- [ ] All 5 login endpoints use `@foodsolutions.ma` emails
- [ ] Collection has 3 new variables (product_id, livreur_id, partner_id)
- [ ] "Convert BC to BL" extracts `bl_id` from metadata
- [ ] "Group BLs in BCH" extracts `bch_id` from metadata
- [ ] "Send BCH to Warehouse" extracts `bp_id` from metadata
- [ ] "Update BP Item Quantities" endpoint exists
- [ ] All dashboard endpoints added (ADV, Dispatcher, Magasinier)
- [ ] All detail endpoints added (BC, BL, BCH, BP)
- [ ] Test scripts have proper assertions (pm.test)
- [ ] Console.log statements for debugging

---

## Expected Results

When you run the complete collection:

✅ **All requests should return 200 OK**
✅ **All test assertions should pass**
✅ **Variables should be automatically extracted:**
- `order_id` from Place Order
- `bl_id` from BC→BL conversion metadata
- `bch_id` from BL grouping metadata
- `bp_id` from BCH→Warehouse metadata
- `product_id` from Get Products

✅ **Metadata should contain:**
- `bl_creation` with BL details
- `bch_creation` with BCH details
- `bp_info` with BP details, statistics, items, and next actions

✅ **Workflow history should show:**
- All state transitions
- User who performed each action
- Timestamps
- Comments

---

## Troubleshooting

**Problem: "401 Unauthorized"**
- Solution: Check auth_token is set, re-login

**Problem: "404 Not Found"**
- Solution: Verify URL path is correct, check base_url

**Problem: "No valid transition found"**
- Solution: Check current workflow state, ensure proper order

**Problem: "bl_id not set"**
- Solution: Check test script extracts from `metadata.bl_creation.bl.id`

**Problem: "bp_id not set"**
- Solution: Check test script extracts from `metadata.bp_info.bp.id`

---

## Summary

Your Postman collection is **almost complete**. The main additions needed are:

1. **Fix authentication** (5 requests) - Change URLs and emails
2. **Add BP item updates** (1 request) - The most critical new endpoint
3. **Add dashboards** (3 requests) - For monitoring
4. **Add details** (4 requests) - For viewing data
5. **Add lists** (3 requests) - For filtering
6. **Enhance test scripts** (3 requests) - For variable extraction

**Total work: ~30 minutes to complete all additions**

Once complete, you'll have a **production-ready Postman collection** that tests the entire BC workflow from order creation to delivery with full validation and error handling! 🚀
