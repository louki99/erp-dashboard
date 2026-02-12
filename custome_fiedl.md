# Custom Fields API (Backend) – Frontend manual

This document describes how to manage **custom field definitions** and how to **read/write custom field values** on **Partners** and **Products** via the Backend API.

## Base URL and auth

- **Base URL:** `http://localhost:8000/api/backend`
- **Auth:** All endpoints require `Authorization: Bearer <token>`.
- **Headers:** `Accept: application/json`, `Content-Type: application/json` (where applicable).

---

## 1. Entity types and concepts

- **Custom field (definition):** A reusable field configuration (label, type, options, validation, etc.) attached to an **entity type** (`partner` or `product`).
- **Custom field value:** The value of one custom field for one specific entity instance (e.g. one partner, one product). Stored in `custom_field_values`; keys are **custom field id** → value.

**Entity types:**

| `entity_type` | Use case        |
|---------------|-----------------|
| `partner`     | Partner forms   |
| `product`     | Product forms   |

---

## 2. Custom field definitions (CRUD)

All paths are under `/custom-fields`.

### 2.1 List custom fields

`GET /custom-fields`

**Query (optional):**

| Param         | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `entity_type` | string | `partner`, `product`, or `all`      |
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
  "entityTypes": { "partner": "Partner", "product": "Product" },
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
    "product": "Product"
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
| `entity_type`       | string  | yes      | `partner` or `product` |
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
  "regions": [...],
  "villes": [...],
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

## 6. Field types and frontend behavior

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

## 7. Quick reference – Custom field definition endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/custom-fields` | List (optional `?entity_type=partner\|product\|all`) |
| GET    | `/custom-fields/create` | Create form metadata (field types, entity types) |
| POST   | `/custom-fields` | Create definition |
| GET    | `/custom-fields/{id}` | Show one |
| GET    | `/custom-fields/{id}/edit` | Edit form (field + options_string, validation_rules_string) |
| PUT/PATCH | `/custom-fields/{id}` | Update definition |
| DELETE | `/custom-fields/{id}` | Delete definition |
| PATCH  | `/custom-fields/{id}/toggle` | Toggle is_active |
| POST   | `/custom-fields/reorder` | Reorder (body: `{ "items": [ { "id", "order" } ] }`) |

---

## 8. Notes

- **Entity type:** Stored as singular in definitions: `partner`, `product`. Values are stored with table name (`partners`, `products`) internally; the API uses the same entity types as in the list/create responses.
- **Validation:** Backend validates definition payloads; entity create/update may validate custom field values per definition (e.g. required, max length) where implemented.
- **Order:** Use the `order` field from definitions for display order; use the reorder endpoint to change it.
- **Deactivate vs delete:** Use **toggle** to hide a field without losing data; use **delete** to remove the definition and all its values.

If you need more detail on a specific endpoint or error format, we can extend this doc or add examples for your stack (e.g. axios/fetch).
