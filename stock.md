# Stock Management API (Admin)

This document describes the admin endpoints for managing provisional stock and reading projected availability.

Base URL:

```
/api/backend/stock-management
```

Auth:

- `Authorization: Bearer <token>`
- Protected by `auth:sanctum` + `force.json`

---

## 1) List Stocks (Projected Availability)

`GET /stocks`

Query params:

- `branch_code` (required)
- `search` (optional)
- `low_stock` (optional, boolean)
- `out_of_stock` (optional, boolean)

Example:

```
GET /api/backend/stock-management/stocks?branch_code=A0001&search=COLA&low_stock=1
```

Response (simplified):

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 12,
        "branch_code": "A0001",
        "product_id": 123,
        "quantity": "50.000",
        "reserved_quantity": "5.000",
        "available_quantity": "45.000",
        "effective_available": 55,
        "product": {
          "id": 123,
          "code": "PRD-001",
          "name": "Cola 33cl"
        }
      }
    ],
    "current_page": 1,
    "last_page": 3
  }
}
```

---

## 2) List Stock Movements (Ledger)

`GET /movements`

Query params:

- `branch_code` (required)
- `type` (optional): `purchase|sale|adjustment|transfer_in|transfer_out|return`
- `movement_status` (optional): `CONFIRMED|PROVISIONAL|REVERSED`
- `source_system` (optional): `X3|POS|MOBILE|ADJUSTMENT`
- `product_id` (optional)
- `date_from` (optional, `YYYY-MM-DD`)
- `date_to` (optional, `YYYY-MM-DD`)

Example:

```
GET /api/backend/stock-management/movements?branch_code=A0001&movement_status=PROVISIONAL&date_from=2026-02-01
```

---

## 3) Effective Stock Breakdown (Single Product)

`GET /effective`

Query params:

- `product_id` (required)
- `branch_code` (optional)

Example:

```
GET /api/backend/stock-management/effective?product_id=123&branch_code=A0001
```

Response:

```json
{
  "success": true,
  "data": {
    "confirmed": 45,
    "provisional": 10,
    "reserved": 5,
    "effective": 55
  }
}
```

---

## 4) Create Provisional Movement (Local Reception / Adjustment)

`POST /provisional`

Body:

```json
{
  "branch_code": "A0001",
  "product_id": 123,
  "quantity": 10,
  "type": "purchase",
  "reference_type": "ManualProvisional",
  "reference_id": null,
  "external_reference": "POS-REC-0001",
  "notes": "Local reception"
}
```

Notes:

- `type` allowed: `purchase|adjustment|transfer_in|transfer_out|return`
- Movement is stored as `PROVISIONAL` and **does not update** the `stocks` snapshot.

---

## 5) Reconcile From X3 (Confirm + Reverse Provisional)

`POST /reconcile-x3`

Body:

```json
{
  "branch_code": "A0001",
  "product_id": 123,
  "quantity": 10,
  "type": "purchase",
  "external_reference": "X3-REC-2026-001",
  "notes": "X3 sync receipt"
}
```

Behavior:

- Inserts a `CONFIRMED` movement from X3
- Attempts to match and mark provisional movements as `REVERSED`
- Matching is by product, branch, optional external reference, and time window

---

## Frontend Usage Notes

- Always display `effective_available` for POS decisions.
- Use `movement_status=PROVISIONAL` to show pending local receptions.
- Use `/effective` for quick popups or detail views.

