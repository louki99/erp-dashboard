# Magasinier (Backend API)

Base path:
- `{{BASE_URL}}/api/backend/magasinier`

Auth:
- `Authorization: Bearer {{TOKEN}}`
- `Accept: application/json`
- `Content-Type: application/json`

Postman collection:
- `docs/Magasinier_Backend_API.postman_collection.json`

---

## 1) Dashboard

### GET `/dashboard`

Returns counters and a small list of pending BPs.

Response (example):
```json
{
  "pendingPreparations": 3,
  "inProgress": 1,
  "completedToday": 2,
  "lowStockItems": 5,
  "pendingBps": [
    {
      "id": 10,
      "bp_number": "BP-CASA-00010",
      "status": "pending"
    }
  ],
  "readyToPrepare": 7
}
```

---

## 2) Preparations (BP)

### GET `/preparations/pending`
Query (optional):
- `status` (default: `pending,in_progress`)
- `search` (bp_number or bch_number)

Response:
- Laravel pagination JSON of `BonPreparation` with relations.

---

### GET `/preparations/{id}`
Returns BP details.

Response:
- BP JSON with:
  - `bonChargement.livreur`
  - `bonChargement.bonLivraisons.partner`
  - `items.product`
  - `magasinier`

---

### GET `/preparations/{id}/prepare`
Opens a BP for preparation:
- If BP is `pending`, moves to `in_progress` and sets `magasinier_id`.
- Refreshes each BP item `available_quantity` from current stock.

Response:
- BP JSON.

---

### PUT `/preparations/{id}/save`
Completes a BP and applies stock deductions.

Body:
```json
{
  "prepared_quantities": {
    "12": 5,
    "13": 2
  },
  "notes": "Prepared by morning team"
}
```

Rules:
- Prepared quantity is clamped to `available_quantity` per BP item.

Response (example):
```json
{
  "success": true,
  "message": "Preparation completed successfully",
  "redirect": "..."
}
```

Effects:
- Updates BP: `status=completed`, `prepared_at=now()`.
- If BP belongs to a BCH:
  - BCH `status=prepared`
  - BLs `status=prepared`
- If BP is standalone (orders -> BP):
  - Converts orders to BL and immediately marks BL `prepared`.

---

### POST `/preparations/{id}/reject`
Rejects BP.

Body:
```json
{
  "rejection_reason": "Stock mismatch. Need review."
}
```

Response (example):
```json
{
  "success": true,
  "message": "BP rejected successfully",
  "redirect": "..."
}
```

Effects (legacy BCH flow):
- BP: `status=rejected`
- BCH: `status=cancelled`
- BLs: `status=cancelled`
- Releases stock reservations
- Puts affected orders on hold (`adv_on_hold`)

---

## 3) Orders ready for preparation (new flow)

### GET `/orders/approved`
Lists approved orders ready to be assigned to a new BP.

Query (optional):
- `search` (bc_number or partner name)

Response:
- Laravel pagination JSON of orders.

---

### POST `/preparations/from-orders`
Creates a standalone BP from selected orders.

Body:
```json
{
  "order_ids": [1, 2, 3]
}
```

Response (example):
```json
{
  "success": true,
  "message": "Bon de Preparation created successfully",
  "bp_id": 99
}
```

---

## 4) Stock

### GET `/stock`
Query (optional):
- `search` (product name/code)
- `low_stock` (any truthy value)
- `out_of_stock` (any truthy value)

Response:
- Laravel pagination JSON of stock rows with `product`.

---

### GET `/stock/low-stock`
Returns only low stock items.

---

### GET `/stock/movements`
Query (optional):
- `type`
- `product_id`
- `date_from` (YYYY-MM-DD)
- `date_to` (YYYY-MM-DD)

Response:
- Laravel pagination JSON of stock movements with `product` and `user`.

---

### POST `/stock/adjust`
Manual stock adjustment.

Body:
```json
{
  "product_id": 12,
  "adjustment_type": "add",
  "quantity": 3,
  "notes": "Inventory correction"
}
```

Response:
```json
{
  "success": true,
  "message": "Stock adjusted successfully"
}
```

---

## 5) Batch picking

### GET `/batch-picking`
Returns available BLs for batch picking (draft/preparing).

Response:
- Array of BLs with items.

---

### POST `/batch-picking/generate`
Creates a `BatchPickingSession` from selected BLs.

Body:
```json
{
  "bl_ids": [12, 13]
}
```

Response:
```json
{
  "session": { "id": 1 },
  "mergedProducts": {},
  "bls": []
}
```

---

### GET `/batch-picking/{id}/distribute`
Loads the batch session with BLs and stock status.

Response:
```json
{
  "session": { "id": 1 },
  "bls": [],
  "stockStatus": {}
}
```

---

### POST `/batch-picking/{id}/save`
Saves prepared quantities per BL per product and marks BLs prepared.

Body:
```json
{
  "prepared": {
    "12": { "5": 2, "6": 1 },
    "13": { "5": 1 }
  }
}
```

Response:
```json
{
  "success": true,
  "message": "Batch preparation completed: 2 BLs",
  "redirect": "..."
}
```
