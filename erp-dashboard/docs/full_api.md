# B2B ERP API (ADV / Dispatcher / Magasinier / Livreur)

## 1) Postman Environment

### Variables
- `BASE_URL`: ex `http://localhost:8000`
- `TOKEN`: token Sanctum d’un user backend (ADV/Dispatcher/Magasinier)
- `DRIVER_TOKEN`: token Sanctum d’un livreur
- `BC_ID`, `BL_ID`, `BCH_ID`, `BP_ID`, `TRANSFER_ID`: ids de test

### Headers communs
- `Accept: application/json`
- `Content-Type: application/json`
- `Authorization: Bearer {{TOKEN}}` (backend)
- `Authorization: Bearer {{DRIVER_TOKEN}}` (driver)

---

## 2) Auth Backend

### POST `{{BASE_URL}}/api/backend/login`
Body:
```json
{ "email": "admin@demo.com", "password": "password" }
```
Response (exemple):
```json
{ "token": "..." }
```

### POST `{{BASE_URL}}/api/backend/logout`
Headers:
- `Authorization: Bearer {{TOKEN}}`

---

## 3) ADV (Administration des ventes)

Base: `{{BASE_URL}}/api/backend/adv`

### GET `/dashboard`
Headers:
- `Authorization: Bearer {{TOKEN}}`

### BC Validation

#### GET `/bc`
Headers:
- `Authorization: Bearer {{TOKEN}}`

#### GET `/bc/pending`
Headers:
- `Authorization: Bearer {{TOKEN}}`

#### GET `/bc/{id}`
Headers:
- `Authorization: Bearer {{TOKEN}}`

#### POST `/bc/{id}/approve`
Headers:
- `Authorization: Bearer {{TOKEN}}`
Body:
```json
{
  "comment": "OK",
  "approval_mode": "standard",
  "quantities": {"12": 5},
  "auto_adjust_stock": true
}
```
Response:
```json
{ "success": true, "message": "..." }
```

#### POST `/bc/{id}/reject`
Body:
```json
{ "reason": "Credit issue" }
```

#### POST `/bc/{id}/hold`
Body:
```json
{ "reason": "Need confirmation" }
```

#### POST `/bc/batch-approve`
Body:
```json
{ "bc_ids": [1,2,3], "comment": "Batch ok" }
```

### Credit Derogations

#### GET `/derogations`
Query:
- `status` (optional): `pending|approved|rejected`

#### GET `/derogations/{derogationId}`

#### POST `/derogations/{bcId}/request`
Body:
```json
{ "justification": "Partner strategic, approve despite exceeded limit..." }
```

#### POST `/derogations/{derogationId}/approve`
Body:
```json
{ "comment": "Approved by Chef ADV" }
```

#### POST `/derogations/{derogationId}/reject`
Body:
```json
{ "reason": "Too risky" }
```

---

## 4) Dispatcher

Base: `{{BASE_URL}}/api/backend/dispatcher`

### GET `/dashboard`

### Orders (BC)

#### GET `/orders/pending`
Query (optional):
- `search`
- `date_from`
- `date_to`

#### GET `/orders/{id}`

#### POST `/orders/{id}/convert-to-bl`
Response:
```json
{ "success": true, "message": "...", "bl_id": 123 }
```

### BL

#### GET `/bon-livraisons/draft`
Response:
```json
{ "draftBls": [], "livreurs": [] }
```

#### GET `/bon-livraisons`

#### GET `/bon-livraisons/{id}`

#### GET `/bon-livraisons/{id}/edit`

#### PUT `/bon-livraisons/{id}`
Body:
```json
{
  "delivery_date": "2025-12-13",
  "livreur_id": 55,
  "notes": "Call partner before arrival",
  "items": [
    { "id": 999, "allocated_quantity": 10, "unit_price": 12.5 }
  ]
}
```

### BCH

#### POST `/bon-chargements`
Body:
```json
{
  "bl_ids": "12,13,14",
  "livreur_id": 55,
  "notes": "Morning route"
}
```

#### GET `/bon-chargements`
Query (optional):
- `status`
- `livreur_id`
- `search`

#### GET `/bon-chargements/{id}`

#### POST `/bon-chargements/{id}/validate`

#### GET `/bon-chargements/{id}/balance`

#### PUT `/bon-chargements/{id}/balance`
Body:
```json
{
  "allocations": {
    "12": {"5": 2.5, "8": 1},
    "13": {"5": 2.5, "8": 0}
  }
}
```

---

## 5) Magasinier

Base (API backend minimal): `{{BASE_URL}}/api/backend/magasinier`

### GET `/dashboard`

Notes: la majorité des endpoints magasinier est actuellement exposée via `routes/admin.php` (UI). Si tu veux tout en API backend, il faut exposer ces routes dans `routes/backend.php`.

---

## 6) Livreur (Driver) — Rider API (Warehouse Transfer workflow)

Base: `{{BASE_URL}}/api/rider` (middleware driver)

### POST `/bch/{bchId}/accept`
Headers:
- `Authorization: Bearer {{DRIVER_TOKEN}}`

### GET `/warehouse-transfers`

### GET `/warehouse-transfers/{transferId}`

### POST `/warehouse-transfers/{transferId}/complete-delivery`
Body:
```json
{
  "bl_id": 12,
  "items": [
    { "product_id": 5, "delivered_quantity": 8, "returned_quantity": 0 },
    { "product_id": 8, "delivered_quantity": 0, "returned_quantity": 1, "return_reason": "Damaged" }
  ],
  "delivery_notes": "Partner received with remark"
}
```
Response (exemple):
```json
{
  "success": true,
  "message": "Delivery processed successfully",
  "bl_status": "partially_delivered",
  "warehouse_transfer_id": 100,
  "reliquat_bl_id": 200,
  "reliquat_bl_number": "BL_...",
  "strategy": "reliquat_bl"
}
```

---

## 7) Notes de configuration

### Livraison partielle
Config:
- `config/erp.php`
Env:
- `ERP_DELIVERY_PARTIAL_STRATEGY=reliquat_bl` (default)
- `ERP_DELIVERY_PARTIAL_STRATEGY=return_docs`
