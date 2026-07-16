# Custom Fields API (Backend) – Frontend manual

This document describes how to manage **custom field definitions** and how to **read/write custom field values** on **Partners**, **Products**, **Visit Actions**, **Orders**, **Warehouses**, **Delivery Notes**, and **Delivery Missions** via the Backend API.

> **2026-07-17 update:** extended from Partner/Product only to 7 entity types total (§1), fixed a bug where Visit Action custom fields were write-only (§9), `entity_type` on a definition is now validated against the real known list instead of accepted as free text, and a new generic endpoint (§10) covers entities without a dedicated admin edit form.

## Base URL and auth

- **Base URL:** `http://localhost:8000/api/backend`
- **Auth:** All endpoints require `Authorization: Bearer <token>`.
- **Headers:** `Accept: application/json`, `Content-Type: application/json` (where applicable).

---

## 1. Entity types and concepts

- **Custom field (definition):** A reusable field configuration (label, type, options, validation, etc.) attached to an **entity type**.
- **Custom field value:** The value of one custom field for one specific entity instance (e.g. one partner, one product). Stored in `custom_field_values`; keys are **custom field id** → value.

**Entity types** (this is the authoritative, enforced list — `POST`/`PUT /custom-fields` now rejects anything outside it):

| `entity_type`      | Use case                              | Values read/written via |
|---------------------|----------------------------------------|--------------------------|
| `partner`           | Partner forms                          | §4 (embedded in partner create/update/show) |
| `product`           | Product forms                          | §5 (embedded in product create/update/show) |
| `visit_action`      | Salesperson visit micro-task forms (SALE, COLLECTION, AUDIT, …) | §9 (dedicated visit-action endpoints) |
| `order`             | Order annotations                      | §10 (generic endpoint) + embedded in order show |
| `warehouse`         | Warehouse metadata                     | §10 (generic endpoint) + embedded in warehouse create/update/list |
| `delivery_note`     | BL (bon de livraison) annotations      | §10 (generic endpoint) + embedded in BL show |
| `delivery_mission`  | Delivery mission annotations           | §10 (generic endpoint) — no dedicated show/update endpoint exists for a single mission, this is the only access point |

---

## 2. Custom field definitions (CRUD)

All paths are under `/custom-fields`.

### 2.1 List custom fields

`GET /custom-fields`

**Query (optional):**

| Param         | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `entity_type` | string | `partner`, `product`, `visit_action`, `order`, `warehouse`, `delivery_note`, `delivery_mission`, or `all` |
| `page`        | int    | Pagination (default per_page: 15)    |

**Example:**

```http
GET /custom-fields?entity_type=partner
```

**Response (simplified):**

```json
{
  "customFields": {
    "data": [
      {
        "id": 1,
        "field_name": "partner_tax_id",
        "field_label": "Tax ID",
        "field_type": "text",
        "entity_type": "partner",
        "is_required": false,
        "default_value": null,
        "options": null,
        "validation_rules": ["max:50"],
        "placeholder": "Enter tax ID",
        "help_text": null,
        "order": 1,
        "is_active": true,
        "is_searchable": false,
        "is_visible": true
      }
    ],
    "current_page": 1,
    "per_page": 15,
    "total": 1
  },
  "entityTypes": {
    "partner": "Partner",
    "product": "Product",
    "visit_action": "Visit Action",
    "order": "Order",
    "warehouse": "Warehouse",
    "delivery_note": "Delivery Note",
    "delivery_mission": "Delivery Mission"
  },
  "currentEntityType": "partner"
}
```

---

### 2.2 Create form (field types & entity types)

`GET /custom-fields/create`

Use this to get field types and entity types when building the “create custom field” form.

**Response:**

```json
{
  "fieldTypes": {
    "text": "Text Input",
    "textarea": "Text Area",
    "number": "Number",
    "email": "Email",
    "date": "Date",
    "datetime": "Date Time",
    "select": "Select Dropdown",
    "radio": "Radio Buttons",
    "checkbox": "Checkbox",
    "file": "File Upload"
  },
  "entityTypes": {
    "partner": "Partner",
    "product": "Product",
    "visit_action": "Visit Action",
    "order": "Order",
    "warehouse": "Warehouse",
    "delivery_note": "Delivery Note",
    "delivery_mission": "Delivery Mission"
  }
}
```

---

### 2.3 Create a custom field

`POST /custom-fields`

**Body:**

| Field              | Type    | Required | Description |
|--------------------|---------|----------|-------------|
| `field_label`      | string  | yes      | Display label (e.g. "Tax ID") |
| `field_type`       | string  | yes      | One of: `text`, `textarea`, `number`, `email`, `date`, `datetime`, `select`, `radio`, `checkbox`, `file` |
| `entity_type`       | string  | yes      | One of the 7 keys in §1's table — **now strictly validated**; an unknown value is rejected with a 422 rather than silently accepted (before 2026-07-17 any string was accepted and would just never render/save anywhere) |
| `is_required`      | boolean | no       | Default false |
| `default_value`    | string  | no       | Default value |
| `placeholder`      | string  | no       | Input placeholder |
| `help_text`        | string  | no       | Help text |
| `options`          | string  | no       | For select/radio: comma-separated (e.g. `"Option A, Option B"`) |
| `validation_rules` | string  | no       | Laravel rules, pipe-separated (e.g. `"max:100|nullable"`) |
| `order`            | integer | no       | Display order (auto if omitted) |
| `is_active`        | boolean | no       | Default true |
| `is_searchable`    | boolean | no       | Default false |

**Note:** `field_name` is generated from `entity_type` and `field_label` (slug). It must be unique.

**Example:**

```json
{
  "field_label": "Tax ID",
  "field_type": "text",
  "entity_type": "partner",
  "is_required": false,
  "placeholder": "Enter tax ID",
  "options": "",
  "validation_rules": "max:50",
  "order": 1,
  "is_active": true,
  "is_searchable": false
}
```

**Response (201):**

```json
{
  "success": true,
  "message": "Custom field created successfully!",
  "customField": { "id": 1, "field_name": "partner_tax_id", ... }
}
```

---

### 2.4 Get one custom field (show)

`GET /custom-fields/{id}`

Returns the custom field resource (same shape as in the list).

---

### 2.5 Edit form (load one field)

`GET /custom-fields/{id}/edit`

Returns the field plus `options_string` and `validation_rules_string` for the form (comma- and pipe-separated).

**Response:**

```json
{
  "customField": { "id": 1, "field_label": "Tax ID", "options": null, "validation_rules": ["max:50"], ... },
  "fieldTypes": { ... },
  "entityTypes": { ... }
}
```

Appended for form use:

- `customField.options_string`: e.g. `"A, B, C"`
- `customField.validation_rules_string`: e.g. `"max:50"`

---

### 2.6 Update a custom field

`PUT /custom-fields/{id}`  
`PATCH /custom-fields/{id}`

**Body:** Same as create (all fields that can be updated). `field_label`, `field_type`, `entity_type` are required.

**Response:**

```json
{
  "success": true,
  "message": "Custom field updated successfully!",
  "customField": { ... }
}
```

---

### 2.7 Delete a custom field

`DELETE /custom-fields/{id}`

**Response:**

```json
{
  "success": true,
  "message": "Custom field deleted successfully!"
}
```

Deleting a custom field removes its definitions and all stored values (cascade).

---

### 2.8 Toggle active status

`PATCH /custom-fields/{id}/toggle`

**Response:**

```json
{
  "success": true,
  "is_active": false,
  "message": "Status updated successfully!"
}
```

---

### 2.9 Reorder custom fields

`POST /custom-fields/reorder`

**Body:**

```json
{
  "items": [
    { "id": 2, "order": 0 },
    { "id": 1, "order": 1 }
  ]
}
```

- `id`: custom field id  
- `order`: new position (integer ≥ 0)

**Response:**

```json
{
  "success": true,
  "message": "Order updated successfully!"
}
```

---

## 3. Using custom fields on entities

Values are **not** managed by the custom-fields resource. They are:

- **Returned** when you load a partner or product (see below).
- **Saved** by sending a `custom_fields` object in the partner/product create/update payload.

### 3.1 Payload shape for values

Always an object: **keys = custom field IDs**, **values = field value** (string or number; checkbox can be `"1"`/`"0"` or boolean).

```json
{
  "custom_fields": {
    "1": "FR123456789",
    "2": "Option A",
    "3": "1"
  }
}
```

- Omit a key to leave that field unchanged (on update) or use default (on create).
- To clear a value, send `null` or empty string for that key (if the API allows it).

---

## 4. Partners and custom fields

### 4.1 Partner create form – get field definitions

`GET /partners/create`

**Response** includes definitions for partner custom fields:

```json
{
  "priceLists": [...],
  "customers": [...],
  "paymentTerms": [...],
  "vatTaxes": [...],
  "geoAreas": [...],
  "custom_fields": [
    {
      "id": 1,
      "field_name": "partner_tax_id",
      "field_label": "Tax ID",
      "field_type": "text",
      "entity_type": "partner",
      "is_required": false,
      "default_value": null,
      "options": null,
      "placeholder": "Enter tax ID",
      "order": 1,
      "is_active": true
    }
  ]
}
```

Use this list to render one input per custom field; use `id` as the key in `custom_fields` when submitting.

### 4.2 Create partner (with custom field values)

`POST /partners`

Include `custom_fields` in the body (same shape as in §3.1):

```json
{
  "name": "Acme Corp",
  "code": "CL001",
  "price_list_id": 1,
  "email": "contact@acme.com",
  "custom_fields": {
    "1": "FR123456789"
  }
}
```

Values are stored in `custom_field_values` for the new partner.

### 4.3 Get partner (with custom field values)

`GET /partners/{id}`

Response includes a **customFields** object (by field name) with label, value, formatted value, and type:

```json
{
  "partner": { "id": 1, "name": "Acme Corp", ... },
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

Use this to display values and to prefill the edit form (using `field.id` as keys for `custom_fields`).

### 4.4 Update partner (with custom field values)

`PUT /partners/{id}`  
`PATCH /partners/{id}`

Send `custom_fields` with the same shape (field id → value). Only keys present in the payload are updated; other fields are unchanged.

```json
{
  "name": "Acme Corp Updated",
  "custom_fields": {
    "1": "FR987654321"
  }
}
```

---

## 5. Products and custom fields

Products already support custom fields in the Backend API.

- **Create/Edit form:** Use the product create/edit endpoints that return `custom_fields` (definitions).
- **Store/Update:** Include `custom_fields` in the product create/update body (same id → value shape).
- **Show:** Product show/edit responses include `custom_fields` (e.g. from `getCustomFieldsArray()`).

Same payload rules as partners: keys = custom field IDs, values = string/number/checkbox value.

---

## 9. Visit Actions and custom fields (Salesperson mobile API)

Visit actions (`visit_action` entity type, `scope_key` = the action type code — e.g. `SALE`, `COLLECTION`, `AUDIT`) are managed through a **dedicated pair of endpoints** under `/api/salesperson`, not the generic partner/product pattern. Base URL for this section is `http://localhost:8000/api/salesperson` (not `/api/backend`).

> **Fixed 2026-07-17:** before this, only the save endpoint existed — nothing let the mobile app re-fetch previously entered values (e.g. after reopening the app). Both endpoints below are new/fixed.

### 9.1 Get custom fields for a visit action

`GET /visit-actions/{visitActionId}/custom-fields`

Returns field definitions scoped to that action's type, merged with any previously saved values (same shape as partner's `customFields`, §4.3).

```json
{
  "message": "Custom fields",
  "data": {
    "visit_action_id": 42,
    "custom_fields": {
      "shelf_photo_note": {
        "label": "Shelf Note",
        "value": "Facing improved on aisle 3",
        "formatted_value": "Facing improved on aisle 3",
        "type": "text",
        "field": { "id": 11, "field_label": "Shelf Note", "entity_type": "visit_action", "scope_key": "AUDIT", ... }
      }
    }
  }
}
```

Also call this right after `POST /visits/{visit}/activity-status` with `status: "OPENED"` — that response now embeds the same `custom_fields` object under `activity.custom_fields`, so you can render the form immediately without a second request.

### 9.2 Save custom fields for a visit action

`POST /visit-actions/{visitActionId}/custom-fields`

**Body:**

```json
{
  "custom_fields": {
    "shelf_photo_note": "Facing improved on aisle 3"
  }
}
```

Keys may be the numeric `id` or the `field_name`. Only fields matching `entity_type=visit_action` **and** the visit action's own `scope_key` (action type code) are accepted — anything else returns a validation error naming the offending key. Response now echoes back the full merged `custom_fields` (same shape as §9.1), not just an id.

---

## 10. Order / Warehouse / Delivery Note / Delivery Mission

These 4 entity types don't have a dedicated backend "create/edit form" the way Partner/Product do — orders come from the SFA app, delivery notes/missions come from dispatcher decisions, warehouses have a small admin CRUD screen but no single-field-per-form pattern. Two ways to reach their custom field values:

### 10.1 Embedded in existing detail/list responses (read-only convenience)

| Entity | Where | Response key |
|---|---|---|
| Order | `GET /orders/{id}` (show) | `customFields` (top-level, alongside `order`) |
| Warehouse | `GET /warehouses` (list) and `POST`/`PUT /warehouses[/{id}]` | `warehouse.customFieldValues` (list) or `customFields` (create/update response) |
| Delivery Note | `GET /dispatcher/bon-livraisons/{id}` (showBl) | `custom_fields` (top-level, alongside the BL's own fields) |

`Warehouse` create/update also **accept** an optional `custom_fields` array in the request body (same id/field_name → value shape as §3.1) and save it in the same call — no separate round-trip needed for warehouses specifically.

### 10.2 Generic read/write endpoint (all 4, and the only access point for Delivery Mission)

`GET /custom-field-values/{entityType}/{entityId}`
`POST /custom-field-values/{entityType}/{entityId}`

`entityType` ∈ `order`, `warehouse`, `delivery_note`, `delivery_mission`. `entityId` is the numeric primary key.

**GET response:**

```json
{
  "success": true,
  "entity_type": "warehouse",
  "entity_id": 14,
  "custom_fields": {
    "internal_reference": {
      "label": "Internal Reference",
      "value": "WH-CASA-01",
      "formatted_value": "WH-CASA-01",
      "type": "text",
      "field": { "id": 13, "field_label": "Internal Reference", "entity_type": "warehouse", ... }
    }
  }
}
```

**POST body:**

```json
{
  "custom_fields": {
    "internal_reference": "WH-CASA-01"
  }
}
```

**POST response:** same shape as GET, echoing the values just saved. No per-field type validation beyond what the field definition itself enforces client-side — unlike Visit Actions (§9.2), this endpoint doesn't reject unknown keys, it just ignores anything that doesn't resolve to a real `CustomField` for that entity type.

`Delivery Mission` has no dedicated show/update endpoint at all today — this generic endpoint is its **only** custom-field access point.

---

## 11. Field types and frontend behavior

| `field_type` | Input control        | Value format (API)   |
|--------------|----------------------|----------------------|
| `text`       | Single-line input    | string               |
| `textarea`   | Textarea             | string               |
| `number`     | Number input         | number or string     |
| `email`      | Email input          | string               |
| `date`       | Date picker          | `YYYY-MM-DD`         |
| `datetime`   | Date/time picker     | `YYYY-MM-DD HH:mm`   |
| `select`     | Dropdown             | string (one of `options`) |
| `radio`      | Radio group          | string (one of `options`) |
| `checkbox`   | Single checkbox      | `"1"`/`"0"` or boolean |
| `file`       | File upload          | string (path/URL as stored) |

- For **select/radio**, use the field’s `options` array (from the definition) for choices.
- **Checkbox:** send a value the backend accepts (e.g. `"1"` or `true` for checked).

---

## 12. Quick reference – Custom field definition endpoints

Base `/api/backend`, unless noted.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/custom-fields` | List (optional `?entity_type=partner\|product\|visit_action\|order\|warehouse\|delivery_note\|delivery_mission\|all`) |
| GET    | `/custom-fields/create` | Create form metadata (field types, entity types) |
| POST   | `/custom-fields` | Create definition (`entity_type` now strictly validated) |
| GET    | `/custom-fields/{id}` | Show one |
| GET    | `/custom-fields/{id}/edit` | Edit form (field + options_string, validation_rules_string) |
| PUT/PATCH | `/custom-fields/{id}` | Update definition |
| DELETE | `/custom-fields/{id}` | Delete definition |
| PATCH  | `/custom-fields/{id}/toggle` | Toggle is_active |
| POST   | `/custom-fields/reorder` | Reorder (body: `{ "items": [ { "id", "order" } ] }`) |
| GET/POST | `/custom-field-values/{entityType}/{entityId}` | §10.2 — order/warehouse/delivery_note/delivery_mission values |

**Salesperson API** (base `/api/salesperson`, §9):

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/visit-actions/{id}/custom-fields` | Definitions + saved values, scoped to the action's type |
| POST | `/visit-actions/{id}/custom-fields` | Save values (strict: rejects fields outside the action's entity_type+scope) |

---

## 13. Notes

- **Entity type:** Stored as singular in definitions — see §1's table for the full, enforced list. Values are stored with table name internally (`partners`, `products`, `visit_actions`, `orders`, `warehouses`, `delivery_notes`, `delivery_missions`); the API always uses the singular form from §1.
- **Validation:** Backend validates definition payloads, including `entity_type` against the known list (§2.3). Entity create/update may validate custom field values per definition (e.g. required, max length) where implemented — Visit Actions (§9.2) do this most strictly, rejecting unknown/out-of-scope keys outright.
- **Order (display):** Use the `order` field from definitions for display order; use the reorder endpoint to change it.
- **Deactivate vs delete:** Use **toggle** to hide a field without losing data; use **delete** to remove the definition and all its values.
- **This is not a real polymorphic relation** — `entity_type`/`entity_id` are plain strings/integers maintained by hand in the backend, not an Eloquent morph. Every entity type has to be explicitly wired in; you can't just pass an arbitrary `entity_type` and expect it to work (see the validation note above).

If you need more detail on a specific endpoint or error format, we can extend this doc or add examples for your stack (e.g. axios/fetch).
