# Partner Management API (Backend) – Frontend manual

This document describes all Backend API endpoints for **Partner** management so the frontend can implement list, create, update, delete, status, credit, payment terms, and custom fields.

## Base URL and auth

- **Base URL:** `http://localhost:8000/api/backend`
- **Auth:** All endpoints require `Authorization: Bearer <token>`.
- **Headers:** `Accept: application/json`, `Content-Type: application/json` (where applicable).

---

## 1. Partner resource overview

Partners have:

- **Core:** code, name, customer link, price list, payment terms, status, type, channel
- **Credit:** credit_limit, credit_used, credit_available (read-only)
- **Tax:** tax_number_ice, tax_number_if, tax_exempt, vat_group_code
- **Contact:** phone, whatsapp, email, website
- **Address:** address_line1/2, city, region, country, postal_code, geo_area_code, geo_lat, geo_lng
- **Ops:** opening_hours, delivery_instructions, min_order_amount, delivery_zone
- **Hierarchy:** parent_partner_id, salesperson_id
- **Blocking:** blocked_until, block_reason
- **Discounts:** default_discount_rate, default_discount_amount, max_discount_rate
- **Custom fields:** stored per partner via `custom_fields` (see Custom Fields doc).

**Status values:** `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED`.

---

## 2. List and search

### 2.1 List partners (paginated, with filters)

`GET /partners`

**Query (optional):**

| Param           | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| `q`             | string | Search by name, code, phone, email   |
| `status`        | string | ACTIVE, ON_HOLD, BLOCKED, CLOSED     |
| `partner_type`  | string | Filter by type                       |
| `channel`       | string | Filter by channel                    |
| `price_list_id` | int    | Filter by price list                 |
| `per_page`      | int    | Page size (default 20)               |
| `page`          | int    | Page number                          |

**Response:**

```json
{
  "partners": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "code": "CL001",
        "name": "Acme Corp",
        "customer_id": null,
        "price_list_id": 1,
        "status": "ACTIVE",
        "partner_type": "CUSTOMER",
        "channel": "OTHER",
        "email": "contact@acme.com",
        "phone": "+33123456789",
        "credit_limit": 10000,
        "credit_used": 0,
        "credit_available": 10000,
        "price_list": { "id": 1, "code": "PL1", "name": "Retail" },
        "custom_field_values": []
      }
    ],
    "per_page": 20,
    "total": 42
  },
  "filters": { "q": "", "status": "", "partner_type": "", "channel": "", "price_list_id": 0 },
  "priceLists": [{ "id": 1, "code": "PL1", "name": "Retail" }]
}
```

---

### 2.2 List all partners (optional full list)

`GET /partners/list/all`

**Query (optional):** Same filters as list, plus:

| Param              | Type    | Description              |
|--------------------|---------|--------------------------|
| `search`           | string  | Search term              |
| `status`           | string  | Status filter            |
| `partner_type`     | string  | Type filter              |
| `channel`          | string  | Channel filter           |
| `price_list_id`    | int     | Price list filter        |
| `city`             | string  | City (LIKE)              |
| `region`           | string  | Region (LIKE)            |
| `is_b2b`           | bool    | B2B filter               |
| `min_credit_limit` | number  | Min credit limit         |
| `max_credit_limit` | number  | Max credit limit         |
| `blocked`          | bool    | Currently blocked        |
| `sort_by`          | string  | name, code, etc.         |
| `sort_order`       | asc/desc| Sort direction           |
| `per_page`         | int     | Page size                |
| `all`              | bool    | If true, return all rows (no pagination) |

**Response (paginated):**

```json
{
  "success": true,
  "data": [ { "id": 1, "code": "CL001", "name": "Acme Corp", ... } ],
  "pagination": {
    "current_page": 1,
    "per_page": 20,
    "total": 42,
    "last_page": 3,
    "from": 1,
    "to": 20
  }
}
```

**Response (all=true):**

```json
{
  "success": true,
  "data": [ ... ],
  "total": 42
}
```

---

### 2.3 Search partners (autocomplete)

`GET /partners/search?q=acme`

Returns up to 20 partners: `id`, `code`, `name`, `email`, `phone`, `status`.

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "CL001", "name": "Acme Corp", "email": "contact@acme.com", "phone": "+33123456789", "status": "ACTIVE" }
  ]
}
```

---

### 2.4 Partners nearby (geo)

`GET /partners/nearby?lat=33.5&lng=-7.6&radius=10`

**Query:**

| Param    | Type   | Required | Description        |
|----------|--------|----------|--------------------|
| `lat`    | number | yes      | Latitude           |
| `lng`    | number | yes      | Longitude          |
| `radius` | number | no       | Km radius (default 10, max 100) |

**Response:**

```json
{
  "success": true,
  "data": [
    { "id": 1, "code": "CL001", "name": "Acme Corp", "distance": 2.5, ... }
  ]
}
```

---

## 3. Create and edit forms

### 3.1 Create form (metadata)

`GET /partners/create`

Returns dropdowns and options to build the create form (no partner data).

**Response:**

```json
{
  "priceLists": [{ "id": 1, "code": "PL1", "name": "Retail" }],
  "customers": [{ "id": 1, "name": "John", "email": "john@example.com" }],
  "paymentTerms": [{ "id": 1, "name": "30 days", "description": "...", "is_credit": true, "is_cash": false, "is_bank_transfer": false }],
  "vatTaxes": [{ "id": 1, "type": "...", "name": "VAT 20%", "percentage": 20, "deduction": 0 }],
  "geoAreas": [{ "id": 1, "code": "AREA1", "name": "North", "name_ar": null, "geo_area_type_id": 1 }],
  "regions": [{ "id": 1, "region": "Casablanca" }],
  "villes": [{ "id": 1, "ville": "Casablanca" }],
  "custom_fields": [
    { "id": 1, "field_name": "partner_tax_id", "field_label": "Tax ID", "field_type": "text", "entity_type": "partner", "is_required": false, "order": 1 }
  ]
}
```

---

### 3.2 Create partner

`POST /partners`

**Body:** Either **flat** (root-level fields) or **nested** (`partner` + optional `auth`).

**Flat example:**

```json
{
  "name": "Acme Corp",
  "code": "CL001",
  "price_list_id": 1,
  "email": "contact@acme.com",
  "phone": "+33123456789",
  "status": "ACTIVE",
  "partner_type": "CUSTOMER",
  "channel": "OTHER",
  "credit_limit": 10000,
  "payment_term_id": 1,
  "address_line1": "123 Main St",
  "city": "Casablanca",
  "country": "Morocco",
  "custom_fields": {
    "1": "FR123456789"
  }
}
```

**Nested example (with optional user/customer creation):**

```json
{
  "partner": {
    "name": "Acme Corp",
    "code": "CL001",
    "price_list_id": 1,
    "email": "contact@acme.com",
    "phone": "+33123456789",
    "payment_term_id": 1
  },
  "auth": {
    "name": "John",
    "last_name": "Doe",
    "email": "john@acme.com",
    "password": "secret123",
    "phone": "+33987654321"
  },
  "custom_fields": {
    "1": "FR123456789"
  }
}
```

- If `auth` is provided, a **User** and **Customer** are created and linked to the partner (`customer_id`).
- If `partner.code` (or root `code`) is omitted, a code can be auto-generated (e.g. via document numbering).
- `custom_fields`: object key = custom field **id**, value = field value (string/number).

**Response (201):**

```json
{
  "success": true,
  "message": "Partner created successfully",
  "partner": { "id": 1, "code": "CL001", "name": "Acme Corp", ... },
  "data": {
    "partner_id": 1,
    "partner_code": "CL001",
    "customer_id": 2,
    "user_id": 10
  }
}
```

**Errors:** 422 (validation), 409 (e.g. duplicate), 500 (server).

---

### 3.3 Get partner (show)

`GET /partners/{id}`

**Response:**

```json
{
  "partner": {
    "id": 1,
    "code": "CL001",
    "name": "Acme Corp",
    "customer_id": 2,
    "price_list_id": 1,
    "status": "ACTIVE",
    "credit_limit": 10000,
    "credit_used": 0,
    "credit_available": 10000,
    "customer": { "id": 2, "user": { "id": 10, "name": "John", "email": "john@acme.com" } },
    "price_list": { "id": 1, "code": "PL1", "name": "Retail" },
    "parent": null,
    "children": [],
    "salesperson": null,
    "payment_term": { "id": 1, "name": "30 days" },
    "geo_area": null,
    "orders": [],
    "delivery_notes": [],
    "itinerary_partners": []
  },
  "taxId": "FR123456789",
  "customFields": {
    "partner_tax_id": {
      "label": "Tax ID",
      "value": "FR123456789",
      "formatted_value": "FR123456789",
      "type": "text",
      "field": { "id": 1, "field_label": "Tax ID", ... }
    }
  }
}
```

---

### 3.4 Edit form (load partner + metadata)

`GET /partners/{id}/edit`

Returns the same structure as **create** plus the **partner** and **customFields** so the form can be prefilled.

**Response:** Same as create response, plus:

- `partner`: full partner model
- `taxId`: legacy shortcut for one custom field
- `customFields`: same shape as in show (by field name)

---

### 3.5 Update partner

`PUT /partners/{id}` or `PATCH /partners/{id}`

**Body:** Same fields as create (flat or nested). Only send fields that change; backend applies defaults for missing ones.

- To update **custom field values**, send `custom_fields`: `{ "<custom_field_id>": "<value>" }`. Only keys present are updated.

**Example:**

```json
{
  "name": "Acme Corp Updated",
  "status": "ON_HOLD",
  "credit_limit": 15000,
  "custom_fields": {
    "1": "FR987654321"
  }
}
```

**Response:**

```json
{
  "success": true,
  "message": "Partner updated successfully"
}
```

---

### 3.6 Delete partner

`DELETE /partners/{id}`

**Response:**

```json
{
  "success": true,
  "message": "Partner deleted"
}
```

Deleting a partner also removes related custom field values (cascade).

---

## 4. Status and blocking

### 4.1 Toggle status (ACTIVE ↔ ON_HOLD)

`PATCH /partners/{id}/toggle`

No body. Toggles between `ACTIVE` and `ON_HOLD`.

**Response:**

```json
{
  "success": true,
  "message": "Status toggled"
}
```

---

### 4.2 Update status (with reason)

`PATCH /partners/{id}/status`

**Body:**

```json
{
  "new_status": "ON_HOLD",
  "status_change_reason": "Payment delay",
  "notify_partner": false
}
```

- `new_status`: `ACTIVE` | `ON_HOLD` | `BLOCKED` | `CLOSED`
- `status_change_reason`: required string (max 500)
- `notify_partner`: optional boolean

**Response:**

```json
{
  "success": true,
  "message": "Partner status updated successfully"
}
```

---

### 4.3 Block partner

`PATCH /partners/{id}/block`

**Body:**

```json
{
  "blocked_until": "2026-03-01",
  "block_reason": "Overdue payments"
}
```

- `blocked_until`: optional date (future); if omitted, block is indefinite.
- `block_reason`: optional string (max 500).

**Response:**

```json
{
  "success": true,
  "message": "Partner blocked"
}
```

---

### 4.4 Unblock partner

`PATCH /partners/{id}/unblock`

No body. Sets `blocked_until` and `block_reason` to null and status to `ACTIVE`.

**Response:**

```json
{
  "success": true,
  "message": "Partner unblocked"
}
```

---

## 5. Credit

### 5.1 Update credit limit

`PATCH /partners/{id}/credit`

**Body:**

```json
{
  "credit_limit": 20000,
  "reason": "Annual review"
}
```

- `credit_limit`: required, number ≥ 0
- `reason`: optional string (max 500)

**Response:**

```json
{
  "success": true,
  "message": "Credit limit updated successfully",
  "partner": { "id": 1, "credit_limit": 20000, ... }
}
```

---

### 5.2 Credit history / summary

`GET /partners/{id}/credit/history`

**Response:**

```json
{
  "success": true,
  "data": {
    "current_limit": 20000,
    "current_used": 5000,
    "current_available": 15000,
    "orders": [
      { "id": 1, "code": "BC001", "total_amount": 1000, "status": "DELIVERED", "created_at": "2026-02-01T10:00:00.000000Z" }
    ],
    "deliveries": [
      { "id": 1, "code": "BL001", "total_amount": 1000, "status": "DELIVERED", "created_at": "2026-02-01T10:00:00.000000Z" }
    ]
  }
}
```

---

### 5.3 Recalculate credit

`POST /partners/{id}/credit/recalc`

No body. Recomputes `credit_available` (e.g. if DB uses a generated column).

**Response:**

```json
{
  "success": true,
  "message": "Credit recalculated"
}
```

---

## 6. Payment terms (multiple per partner)

### 6.1 List payment terms for partner

`GET /partners/{partnerId}/payment-terms`

**Response:**

```json
{
  "partner": { "id": 1, "code": "CL001", "name": "Acme Corp", "paymentTerms": [ ... ] },
  "availableTerms": [
    { "id": 2, "name": "60 days", "description": "...", "is_credit": true }
  ]
}
```

- `partner.paymentTerms`: terms already attached.
- `availableTerms`: terms that can still be attached.

---

### 6.2 Attach payment term

`POST /partners/{partnerId}/payment-terms`

**Body:**

```json
{
  "payment_term_id": 2,
  "is_default": false
}
```

**Response:**

```json
{
  "success": true,
  "message": "Payment term added successfully"
}
```

---

### 6.3 Detach payment term

`DELETE /partners/{partnerId}/payment-terms/{termId}`

**Response:**

```json
{
  "success": true,
  "message": "Payment term removed successfully"
}
```

---

### 6.4 Set default payment term

`POST /partners/{partnerId}/payment-terms/{termId}/default`

No body. Marks this term as the default for the partner.

**Response:**

```json
{
  "success": true,
  "message": "Default payment term updated successfully"
}
```

---

## 7. Code generation and statistics

### 7.1 Generate next partner code

`GET /partners/generate-code?document_type=CL`

**Query:** `document_type` (optional, default `CL`). Uses document numbering config to suggest the next code.

**Response:**

```json
{
  "success": true,
  "code": "CL00042",
  "sequence": 42
}
```

---

### 7.2 Statistics

`GET /partners/statistics`

**Response:**

```json
{
  "success": true,
  "statistics": {
    "total": 150,
    "active": 120,
    "blocked": 5,
    "on_hold": 25,
    "by_type": [ { "partner_type": "CUSTOMER", "count": 140 } ],
    "by_channel": [ { "channel": "OTHER", "count": 100 } ],
    "total_credit_limit": 1000000,
    "total_credit_used": 200000,
    "with_customer": 80
  }
}
```

---

## 8. Bulk operations

### 8.1 Bulk update status

`POST /partners/bulk/status`

**Body:**

```json
{
  "partner_ids": [ 1, 2, 3 ],
  "status": "ON_HOLD",
  "reason": "Q1 review"
}
```

- `partner_ids`: required array of existing partner ids
- `status`: required, one of ACTIVE, ON_HOLD, BLOCKED, CLOSED
- `reason`: optional string (max 500)

**Response:**

```json
{
  "success": true,
  "message": "3 partners updated successfully"
}
```

---

### 8.2 Bulk delete

`DELETE /partners/bulk/delete`

**Body:**

```json
{
  "partner_ids": [ 1, 2, 3 ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "3 partners deleted successfully"
}
```

---

## 9. Quick reference – All partner endpoints

| Method   | Endpoint                                  | Description                    |
|----------|-------------------------------------------|--------------------------------|
| GET      | `/partners`                               | List (paginated, filters)      |
| GET      | `/partners/list/all`                      | List/search (more filters)     |
| GET      | `/partners/search`                        | Search (autocomplete)          |
| GET      | `/partners/nearby`                        | By geo location                |
| GET      | `/partners/create`                        | Create form metadata            |
| POST     | `/partners`                               | Create partner                 |
| GET      | `/partners/{id}`                          | Show partner                   |
| GET      | `/partners/{id}/edit`                     | Edit form (partner + metadata)  |
| PUT/PATCH| `/partners/{id}`                          | Update partner                 |
| DELETE   | `/partners/{id}`                          | Delete partner                 |
| PATCH    | `/partners/{id}/toggle`                   | Toggle ACTIVE/ON_HOLD          |
| PATCH    | `/partners/{id}/status`                   | Set status + reason            |
| PATCH    | `/partners/{id}/block`                     | Block partner                  |
| PATCH    | `/partners/{id}/unblock`                  | Unblock partner                |
| PATCH    | `/partners/{id}/credit`                   | Update credit limit            |
| GET      | `/partners/{id}/credit/history`           | Credit history                 |
| POST     | `/partners/{id}/credit/recalc`            | Recalc credit                  |
| GET      | `/partners/{partnerId}/payment-terms`    | List payment terms             |
| POST     | `/partners/{partnerId}/payment-terms`    | Attach payment term            |
| DELETE   | `/partners/{partnerId}/payment-terms/{termId}` | Detach payment term   |
| POST     | `/partners/{partnerId}/payment-terms/{termId}/default` | Set default term |
| GET      | `/partners/generate-code`                | Next partner code              |
| GET      | `/partners/statistics`                    | Dashboard statistics           |
| POST     | `/partners/bulk/status`                    | Bulk status update             |
| DELETE   | `/partners/bulk/delete`                   | Bulk delete                    |

---

## 10. Validation and payload notes

- **Create/Update:** Request is validated by `PartnerRequest`. Supports both **root-level** fields and **nested** `partner` (and optional `auth`). Use one style consistently (e.g. flat for simple forms, nested when creating user/customer).
- **Status:** Always sent and stored in **uppercase**: `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED`.
- **Discount rates:** In the request they can be sent as 0–100; backend may convert to 0–1 for storage (see `PartnerRequest::prepareForValidation`).
- **Custom fields:** Key = custom field **id** (integer), value = string/number. Omit keys to leave values unchanged on update.
- **Code uniqueness:** Enforced on create and update (unique per partner on update).

For custom field **definitions** and entity types, see `docs/CUSTOM_FIELDS_API.md`.
