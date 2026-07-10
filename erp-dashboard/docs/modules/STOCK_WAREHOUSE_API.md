# Stock, Warehouses & Preparation Bills — API Reference

> **Audience:** UI / Frontend team  
> **Base URL:** `https://<host>/api/backend`  
> **Auth:** Bearer token — `Authorization: Bearer {token}` on every request  
> **Content-Type:** `application/json`

---

## Table of Contents

1. [Quick overview](#1-quick-overview)
2. [Role matrix](#2-role-matrix)
3. [Warehouses](#3-warehouses)
4. [Storage Locations (nested under warehouse)](#4-storage-locations)
5. [Stock — read-only consultation](#5-stock)
6. [Preparation Bills](#6-preparation-bills)
7. [Common error shapes](#7-common-error-shapes)
8. [Business rules & UI guards](#8-business-rules--ui-guards)
9. [TypeScript types](#9-typescript-types)

---

## 1. Quick overview

| Domain | Key concept |
|---|---|
| **Warehouse** | A logical depot (`central`) or mobile van (`delivery_van`). One branch can have several warehouses. |
| **StorageLocation** | Physical zone inside a warehouse: aisle, shelf, cold zone, damaged rack… Typed by `StorageLocationType` enum. |
| **Stock** | One row per (product × `warehouse_code`). Read-only from the dispatcher — mutations come from Sage X3 sync. |
| **PreparationBill (BP)** | Collective picking order the dispatcher creates from a multi-selection of sales orders. Sent to the magasinier. |

---

## 2. Role matrix

| Endpoint group | `admin` | `dispatcher` | `magasinier` |
|---|:---:|:---:|:---:|
| GET warehouses / locations | ✅ | ✅ | ✅ |
| POST / PUT warehouse | ✅ | ❌ | ❌ |
| POST / PUT location | ✅ | ❌ | ❌ |
| GET stock | ✅ | ✅ | ✅ |
| GET / POST / PUT preparation-bills | ✅ | ✅ | ✅ |

---

## 3. Warehouses

### 3.1 List warehouses

```
GET /warehouses
```

**Query params**

| Param | Type | Description |
|---|---|---|
| `branch_id` | integer | Filter by branch (recommended — integer FK) |
| `branch_code` | string | Alternative legacy filter |
| `type` | string | `central` \| `delivery_van` \| `system_virtual` |
| `active_only` | boolean | `true` → only active warehouses |
| `search` | string | Partial match on `name` or `code` |
| `per_page` | integer | Default 20 |

**Response 200**

```json
{
  "warehouses": {
    "data": [
      {
        "id": 1,
        "code": "CASA-CENTRAL-20260101120000",
        "name": "Dépôt Central Casablanca",
        "type": "central",
        "branch_code": "CASA",
        "is_active": true,
        "storage_locations_count": 6,
        "created_at": "2026-01-01T12:00:00Z",
        "updated_at": "2026-06-01T08:30:00Z"
      }
    ],
    "current_page": 1,
    "per_page": 20,
    "total": 4,
    "last_page": 1
  }
}
```

---

### 3.2 Create warehouse

```
POST /warehouses
```

> Role: `admin` only

**Body**

```json
{
  "branch_id": 3,
  "name": "Dépôt Nord Casablanca",
  "type": "central",
  "code": "CASA-NORD",
  "is_active": true
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `branch_id` | ✅ | integer | Resolves to `branch_code` internally |
| `name` | ✅ | string (max 191) | |
| `type` | ❌ | `central` \| `system_virtual` | Default `central`. **`delivery_van` is rejected** — vans are created via vehicle assignment |
| `code` | ❌ | string (max 100, unique) | Auto-generated as `{BRANCH}-{TYPE}-{TIMESTAMP}` if omitted |
| `is_active` | ❌ | boolean | Default `true` |

**Response 201**

```json
{
  "success": true,
  "message": "Warehouse created successfully.",
  "warehouse": {
    "id": 5,
    "code": "CASA-NORD",
    "name": "Dépôt Nord Casablanca",
    "type": "central",
    "branch_code": "CASA",
    "is_active": true,
    "storage_locations_count": 0
  }
}
```

---

### 3.3 Update / deactivate warehouse

```
PUT  /warehouses/{id}
PATCH /warehouses/{id}
```

> Role: `admin` only

**Body** — all fields optional

```json
{
  "name": "Dépôt Nord Casablanca (Rénovation)",
  "is_active": false
}
```

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `is_active` | boolean | Setting `false` **blocked** if warehouse holds physical stock |
| `branch_id` | integer | Reassigns the warehouse to another branch |
| `code` | string | Rename the warehouse code (must remain unique) |

**Guard — 422 when deactivating with stock**

```json
{
  "message": "Cannot deactivate warehouse: it still holds physical stock. Transfer or clear stock first."
}
```

**Response 200**

```json
{
  "success": true,
  "message": "Warehouse updated.",
  "warehouse": { "id": 5, "is_active": false, ... }
}
```

---

### 3.4 List locations of a warehouse

```
GET /warehouses/{id}/locations
```

> Role: admin, dispatcher, magasinier

**Response 200**

```json
{
  "warehouse": {
    "id": 1,
    "code": "CASA-CENTRAL",
    "name": "Dépôt Central Casablanca",
    "type": "central",
    "is_active": true
  },
  "locations": [
    {
      "id": 10,
      "warehouse_id": 1,
      "branch_code": "CASA",
      "location_code": "CASA-DEPOT-01",
      "location_name": "Zone Dépôt Principal",
      "location_type": "DEPOT",
      "description": null,
      "capacity": 500,
      "current_count": 312,
      "is_active": true,
      "requires_supervisor": false,
      "metadata": null
    }
  ]
}
```

---

## 4. Storage Locations

### 4.1 Add a location to a warehouse

```
POST /warehouses/{id}/locations
```

> Role: `admin` only

**Body**

```json
{
  "location_type": "SELLABLE",
  "location_name": "Allée A — Étagère 3",
  "location_code": "CASA-A3",
  "capacity": 200,
  "description": "Produits secs et conserves"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `location_type` | ✅ | enum (see below) | `DELIVERY_VAN` is rejected — managed by vehicle flow |
| `location_name` | ✅ | string (max 191) | |
| `location_code` | ❌ | string (unique) | Auto-generated as `{BRANCH}-{TYPE}-{SEQ}` if omitted |
| `description` | ❌ | string | |
| `capacity` | ❌ | integer ≥ 1 | Max items in this location |
| `requires_supervisor` | ❌ | boolean | Default derived from `location_type` (see §8) |
| `is_active` | ❌ | boolean | Default `true` |

**`location_type` enum values**

| Value | Label | Requires supervisor |
|---|---|---|
| `SELLABLE` | Normal shelf — sellable products | No |
| `DEPOT` | Main depot / source for delivery | No |
| `DAMAGED` | Damaged products awaiting disposal | **Yes** |
| `EXPIRED` | Expired products | **Yes** |
| `QUARANTINE` | Pending inspection | No |
| `SCRAP` | To be destroyed | **Yes** |
| `RETURN_TO_SUPPLIER` | Awaiting return | No |
| `VIRTUAL` | Logical zone (no physical stock row) | No |

**Response 201**

```json
{
  "success": true,
  "message": "Storage location created.",
  "location": {
    "id": 42,
    "warehouse_id": 1,
    "branch_code": "CASA",
    "location_code": "CASA-A3",
    "location_name": "Allée A — Étagère 3",
    "location_type": "SELLABLE",
    "capacity": 200,
    "current_count": 0,
    "is_active": true,
    "requires_supervisor": false
  }
}
```

---

### 4.2 Update a location

```
PUT   /warehouses/locations/{locationId}
PATCH /warehouses/locations/{locationId}
```

> Role: `admin` only

**Body** — all fields optional

```json
{
  "location_type": "QUARANTINE",
  "location_name": "Zone Quarantaine — Allée A",
  "is_active": true,
  "capacity": 50
}
```

**Guards**

| Condition | Response |
|---|---|
| Location type is `DELIVERY_VAN` | 422 — use vehicle management endpoints |
| `is_active: false` with stock > 0 | 422 — empty the location first |
| `location_type` changed with stock > 0 | 422 — empty the location first |
| Type changed without `requires_supervisor` | Auto-syncs `requires_supervisor` to new type default |

**Response 200**

```json
{
  "success": true,
  "message": "Storage location updated.",
  "location": { "id": 42, "location_type": "QUARANTINE", ... }
}
```

---

## 5. Stock

### 5.1 Paginated stock consultation

```
GET /stock
```

> Also available as `GET /stocks` (same controller, same filters)  
> Role: admin, dispatcher, magasinier

**Query params**

| Param | Type | Description |
|---|---|---|
| `branch_id` | integer | Filter by branch |
| `warehouse_code` | string | Filter by specific warehouse (= `location_code` of the storage location) |
| `product_id` | integer | Filter by product |
| `location_type` | string | `SELLABLE`, `DEPOT`, `DAMAGED`… (joins `storage_locations`) |
| `per_page` | integer | Default 50 |

**Response 200**

```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": 100,
        "warehouse_code": "CASA-DEPOT-01",
        "branch_id": 3,
        "product_id": 55,
        "quantity": "24.000",
        "reserved_quantity": "6.000",
        "available_quantity": "18.000",
        "minimum_quantity": "5.000",
        "maximum_quantity": "100.000",
        "product": {
          "id": 55,
          "name": "Huile Olive 1L",
          "reference": "HO-001",
          "barcode": "6111245600123"
        }
      }
    ],
    "total": 340,
    "per_page": 50
  }
}
```

---

### 5.2 Stock by product

```
GET /stocks/{product_id}
```

Returns all locations that hold this product (useful for the "where is this SKU?" UI).

---

### 5.3 Stock by warehouse location

```
GET /stocks/location/{location_code}
```

Returns all products in a specific storage location.

---

### 5.4 Low-stock alert list

```
GET /stocks/low-stock?branch_id=3
```

Returns products where `available_quantity < minimum_quantity`.

---

### 5.5 Stock KPI summary

```
GET /stocks/summary?branch_id=3
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "total_quantity": 4820.5,
    "total_reserved": 312.0,
    "total_available": 4508.5,
    "distinct_products": 187,
    "estimated_value": 1254300.00
  }
}
```

---

## 6. Preparation Bills

### 6.1 List preparation bills

```
GET /stock/preparation-bills
```

**Query params**

| Param | Type | Description |
|---|---|---|
| `status` | string | `pending` \| `in_progress` \| `completed` \| `rejected` |
| `magasinier_id` | integer | Filter by assigned warehouse staff |
| `delivery_mission_id` | integer | Filter by linked delivery mission |
| `from_date` | date | Created from date (`YYYY-MM-DD`) |
| `to_date` | date | Created until date |
| `search` | string | Partial match on `bp_number` |
| `per_page` | integer | Default 20 |

**Response 200**

```json
{
  "preparation_bills": {
    "data": [
      {
        "id": 7,
        "bp_number": "BP-20260710-00003",
        "status": "pending",
        "priority_level": 4,
        "deadline": "2026-07-11T00:00:00Z",
        "notes": "Commandes urgentes export Marrakech",
        "total_items": 14,
        "prepared_items": 0,
        "items_count": 14,
        "magasinier": { "id": 22, "name": "Ahmed Benali" },
        "delivery_mission": null,
        "created_at": "2026-07-10T09:15:00Z"
      }
    ],
    "total": 12,
    "per_page": 20
  }
}
```

---

### 6.2 Get a preparation bill (with items)

```
GET /stock/preparation-bills/{id}
```

**Response 200**

```json
{
  "preparation_bill": {
    "id": 7,
    "bp_number": "BP-20260710-00003",
    "status": "pending",
    "priority_level": 4,
    "deadline": "2026-07-11T00:00:00Z",
    "notes": "Commandes urgentes export Marrakech",
    "total_items": 14,
    "prepared_items": 0,
    "magasinier": { "id": 22, "name": "Ahmed Benali", "email": "a.benali@co.ma" },
    "delivery_mission": null,
    "items": [
      {
        "id": 201,
        "bon_preparation_id": 7,
        "order_id": 1042,
        "product_id": 55,
        "requested_quantity": "12.000",
        "prepared_quantity": "0.000",
        "shortage_quantity": "0.000",
        "product": {
          "id": 55,
          "reference": "HO-001",
          "name": "Huile Olive 1L",
          "barcode": "6111245600123"
        }
      }
    ]
  }
}
```

---

### 6.3 Create a preparation bill (dispatcher multi-select)

```
POST /stock/preparation-bills
```

This is the **core dispatcher endpoint**. The UI sends the IDs of all orders selected in the order grid (checkbox or lasso selection). The backend creates one BP with one picking item per order-product line.

**Body**

```json
{
  "order_ids": [1042, 1043, 1044, 1051],
  "magasinier_id": 22,
  "delivery_mission_id": null,
  "priority_level": 4,
  "deadline": "2026-07-11",
  "notes": "Commandes urgentes export Marrakech"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `order_ids` | ✅ | integer[] (1–200 items) | All IDs must exist in `orders` |
| `magasinier_id` | ❌ | integer | Can be assigned later via PUT |
| `delivery_mission_id` | ❌ | integer | Links BP to an existing delivery mission |
| `priority_level` | ❌ | integer 1–5 | Default 3. 5 = highest urgency |
| `deadline` | ❌ | date `YYYY-MM-DD` | |
| `notes` | ❌ | string (max 2000) | |

**BP number** is auto-generated: `BP-{YYYYMMDD}-{00001}` (daily sequence, 5 digits).

**Guard — 422 if any order already belongs to a BP**

```json
{
  "message": "Some orders are already linked to a preparation bill.",
  "order_ids": [1043, 1051]
}
```

> **UI tip:** Show a warning dialog listing the conflicting order numbers. Let the user deselect them and retry.

**Response 201**

```json
{
  "success": true,
  "preparation_bill": {
    "id": 7,
    "bp_number": "BP-20260710-00003",
    "status": "pending",
    "total_items": 14,
    "magasinier": { "id": 22, "name": "Ahmed Benali" },
    "items": [ ... ]
  }
}
```

---

### 6.4 Update a preparation bill

```
PUT /stock/preparation-bills/{id}
```

Use this to fine-tune the BP **before or during** preparation. Blocked on `completed` and `rejected` BPs.

**Body** — all fields optional

```json
{
  "magasinier_id": 25,
  "priority_level": 5,
  "deadline": "2026-07-10",
  "status": "in_progress",
  "notes": "Priorité absolue — client VIP",
  "items": [
    { "id": 201, "requested_quantity": 8 },
    { "id": 202, "requested_quantity": 4 }
  ],
  "add_order_ids": [1060, 1061]
}
```

| Field | Type | Description |
|---|---|---|
| `magasinier_id` | integer \| null | Reassign / clear the picker |
| `priority_level` | integer 1–5 | |
| `deadline` | date \| null | |
| `estimated_completion` | date \| null | |
| `notes` | string \| null | |
| `status` | `pending` \| `in_progress` | Use `in_progress` to formally submit to the magasinier |
| `items[].id` | integer | Must belong to this BP |
| `items[].requested_quantity` | number > 0 | Adjust the requested qty (partial dispatch) |
| `add_order_ids[]` | integer[] | Append new orders to the existing BP (adds new items) |

**Guard — 422 on completed / rejected**

```json
{
  "message": "Cannot edit a completed preparation bill."
}
```

**Response 200**

```json
{
  "success": true,
  "preparation_bill": { "id": 7, "status": "in_progress", ... }
}
```

---

## 7. Common error shapes

### 404

```json
{ "message": "Warehouse not found." }
```

### 422 — Validation

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "branch_id": ["The branch id field is required."],
    "location_type": ["The selected location type is invalid."]
  }
}
```

### 422 — Business guard

```json
{
  "message": "Cannot deactivate this location: it currently holds physical stock."
}
```

### 401

```json
{ "message": "Unauthenticated." }
```

### 403

```json
{ "message": "This action is unauthorized." }
```

---

## 8. Business rules & UI guards

### Warehouses

| Rule | What to show in UI |
|---|---|
| `type: delivery_van` cannot be created via POST | Hide "Delivery Van" from the type selector in the create form |
| Deactivating with stock > 0 → 422 | Show error: "Ce dépôt contient encore du stock physique. Transférez le stock avant de le désactiver." |

### Storage Locations

| Rule | What to show in UI |
|---|---|
| `DELIVERY_VAN` type cannot be created/edited here | Remove from the location_type dropdown |
| `DAMAGED`, `EXPIRED`, `SCRAP` auto-set `requires_supervisor: true` | Show a badge "Superviseur requis" after type selection |
| Cannot deactivate or retype a location with stock > 0 | Show inline error with current stock count if possible |

### Preparation Bills

| Rule | What to show in UI |
|---|---|
| Order already linked to a BP → 422 with `order_ids` array | Highlight the conflicting rows in the order grid, show toast with order numbers |
| `completed` or `rejected` BP → cannot edit | Disable all form inputs, show read-only badge |
| `status: in_progress` = submitted to magasinier | Show confirmation dialog: "Envoyer au magasinier ?" before setting status |
| `priority_level: 5` = highest urgency | Display red "URGENT" badge |

---

## 9. TypeScript types

```typescript
// ─── Warehouse ────────────────────────────────────────────────────────────────

export type WarehouseType = 'central' | 'delivery_van' | 'system_virtual';

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: WarehouseType;
  branch_code: string;
  is_active: boolean;
  storage_locations_count?: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseListResponse {
  warehouses: PaginatedResponse<Warehouse>;
}

// ─── Storage Location ─────────────────────────────────────────────────────────

export type StorageLocationType =
  | 'SELLABLE'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'QUARANTINE'
  | 'SCRAP'
  | 'RETURN_TO_SUPPLIER'
  | 'DEPOT'
  | 'DELIVERY_VAN'
  | 'VIRTUAL';

export interface StorageLocation {
  id: number;
  warehouse_id: number;
  branch_code: string;
  location_code: string;
  location_name: string;
  location_type: StorageLocationType;
  description: string | null;
  capacity: number | null;
  current_count: number;
  is_active: boolean;
  requires_supervisor: boolean;
  metadata: Record<string, unknown> | null;
}

export interface WarehouseLocationsResponse {
  warehouse: Pick<Warehouse, 'id' | 'code' | 'name' | 'type' | 'is_active'>;
  locations: StorageLocation[];
}

// ─── Stock ────────────────────────────────────────────────────────────────────

export interface StockRow {
  id: number;
  warehouse_code: string;   // = location_code of the StorageLocation
  branch_id: number;
  product_id: number;
  quantity: string;          // decimal string — parse with parseFloat()
  reserved_quantity: string;
  available_quantity: string;
  minimum_quantity: string;
  maximum_quantity: string;
  product?: {
    id: number;
    name: string;
    reference: string;
    barcode: string | null;
  };
}

export interface StockSummary {
  total_quantity: number;
  total_reserved: number;
  total_available: number;
  distinct_products: number;
  estimated_value: number;
}

// ─── Preparation Bill (BP) ────────────────────────────────────────────────────

export type BPStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface PreparationBillItem {
  id: number;
  bon_preparation_id: number;
  order_id: number;
  product_id: number;
  requested_quantity: string;
  prepared_quantity: string;
  shortage_quantity: string;
  product?: {
    id: number;
    reference: string;
    name: string;
    barcode: string | null;
  };
}

export interface PreparationBill {
  id: number;
  bp_number: string;          // format: BP-YYYYMMDD-00001
  status: BPStatus;
  priority_level: number;     // 1–5
  deadline: string | null;
  estimated_completion: string | null;
  notes: string | null;
  total_items: number;
  prepared_items: number;
  items_count?: number;       // from withCount — available on list
  magasinier: { id: number; name: string; email?: string } | null;
  delivery_mission: { id: number; code: string } | null;
  items?: PreparationBillItem[];
  created_at: string;
  updated_at: string;
}

// ─── API payloads ─────────────────────────────────────────────────────────────

export interface CreatePreparationBillPayload {
  order_ids: number[];
  magasinier_id?: number | null;
  delivery_mission_id?: number | null;
  priority_level?: number;   // 1–5, default 3
  deadline?: string | null;  // YYYY-MM-DD
  notes?: string | null;
}

export interface UpdatePreparationBillPayload {
  magasinier_id?: number | null;
  priority_level?: number;
  deadline?: string | null;
  estimated_completion?: string | null;
  notes?: string | null;
  status?: 'pending' | 'in_progress';
  items?: { id: number; requested_quantity: number }[];
  add_order_ids?: number[];
}

export interface CreateWarehousePayload {
  branch_id: number;
  name: string;
  type?: 'central' | 'system_virtual';
  code?: string;
  is_active?: boolean;
}

export interface CreateLocationPayload {
  location_type: Exclude<StorageLocationType, 'DELIVERY_VAN'>;
  location_name: string;
  location_code?: string;
  description?: string | null;
  capacity?: number | null;
  requires_supervisor?: boolean;
  is_active?: boolean;
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  message?: string;
  data?: T;
}

export interface ApiErrorResponse {
  message: string;
  errors?: Record<string, string[]>;
  order_ids?: number[];  // only on BP conflict 422
}
```

---

## Route summary table

| Method | Path | Controller method | Min role |
|---|---|---|---|
| `GET` | `/warehouses` | `WarehouseController@index` | magasinier |
| `POST` | `/warehouses` | `WarehouseController@store` | admin |
| `PUT/PATCH` | `/warehouses/{id}` | `WarehouseController@update` | admin |
| `GET` | `/warehouses/{id}/locations` | `WarehouseController@locations` | magasinier |
| `POST` | `/warehouses/{id}/locations` | `WarehouseController@storeLocation` | admin |
| `PUT/PATCH` | `/warehouses/locations/{locationId}` | `WarehouseController@updateLocation` | admin |
| `GET` | `/stock` | `StockApiController@index` | magasinier |
| `GET` | `/stocks/summary` | `StockApiController@summary` | magasinier |
| `GET` | `/stocks/low-stock` | `StockApiController@lowStock` | magasinier |
| `GET` | `/stocks/{product_id}` | `StockApiController@showByProduct` | magasinier |
| `GET` | `/stocks/location/{location_code}` | `StockApiController@showByLocation` | magasinier |
| `GET` | `/stock/preparation-bills` | `PreparationBillController@index` | magasinier |
| `POST` | `/stock/preparation-bills` | `PreparationBillController@store` | dispatcher |
| `GET` | `/stock/preparation-bills/{id}` | `PreparationBillController@show` | magasinier |
| `PUT` | `/stock/preparation-bills/{id}` | `PreparationBillController@update` | dispatcher |
