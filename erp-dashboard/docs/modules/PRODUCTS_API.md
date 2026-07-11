# Products Domain — Complete API Reference

> **Audience:** UI / frontend developers  
> **Base path:** `/api/backend/`  
> **Auth:** Bearer token — `Authorization: Bearer {token}` on every request  
> **Format:** All responses are JSON

---

## Role matrix

| Role | Products (read) | Products (write) | Pricing | Flags / Marketing | Master data (brands, units…) |
|------|:-:|:-:|:-:|:-:|:-:|
| root | ✅ | ✅ | ✅ | ✅ | ✅ |
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| manager | ✅ | ✅ | ✅ | ✅ | ✅ |
| salesRep | ✅ | ❌ | ✅ (read) | ✅ (read) | ✅ (read) |
| magasinier | ✅ | ❌ | ❌ | ❌ | ✅ (read) |

---

## Quick-start: product form init calls

When opening the Create Product or Edit Product form, make these calls in parallel to populate every dropdown:

```
GET /api/backend/products/create         → brands, categories, units, vat_taxes, suppliers, custom_fields
GET /api/backend/products/{id}/edit      → same + current product with all relations
GET /api/backend/vat-taxes               → VAT tax list (for tax selector)
GET /api/backend/units                   → units of measure
GET /api/backend/brands                  → brand list
GET /api/backend/categories              → category list
GET /api/backend/subcategories           → sub-category list
GET /api/backend/suppliers               → supplier list (for supplier selector)
GET /api/backend/product-sales-groups    → sales group list (FDP, CLN, SFD…)
GET /api/backend/product-pages           → product page hierarchy
```

---

## 1. Products

### GET `/products`

Paginated product list.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `search` | string | Searches name, code |
| `category` | integer | Filter by category_id |
| `brand` | integer | Filter by brand_id |
| `min_price` | numeric | Filter by retail price_ht ≥ |
| `max_price` | numeric | Filter by retail price_ht ≤ |
| `has_colisage` | boolean | Only products with colisage |
| `is_active` | boolean | Active/inactive filter |
| `per_page` | integer | Default 20 |

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "name": "Coca-Cola 33cl",
      "code": "CC-033",
      "barcode": "5449000214911",
      "has_colisage": true,
      "productpage_code": "cc033",
      "product_sales_group_code": "FDP",
      "is_active": true,
      "brand": { "id": 2, "name": "Coca-Cola" },
      "retailPrice": { "price_ht": "12.500", "price_ttc": "15.00", "discount_price": null }
    }
  ],
  "meta": { "current_page": 1, "last_page": 5, "total": 98 }
}
```

---

### GET `/products/create`

Returns all form data needed to render the Create Product form.

```json
{
  "success": true,
  "data": {
    "brands":        [ { "id": 2, "name": "Coca-Cola" } ],
    "categories":    [ { "id": 3, "name": "Boissons" } ],
    "units":         [ { "id": 1, "name": "Pièce" }, { "id": 3, "name": "Carton" } ],
    "vat_taxes":     [ { "id": 1, "name": "TVA 19%", "percentage": 19 } ],
    "suppliers":     [ { "id": 4, "name": "FoodPlus SARL" } ],
    "custom_fields": []
  }
}
```

---

### GET `/products/{id}`

Full product detail. Eager-loads: `brand`, `categories`, `flags`, `marketing`, `retailPrice`, `packagings.unit`, `vatTaxes`, `suppliers`, `logisticsProfile.packagingLevels`, `translations`.

---

### GET `/products/{id}/edit`

Same as `show` but also returns the form option lists (brands, categories, units, vat_taxes, suppliers) for the edit form.

```json
{
  "success": true,
  "data": {
    "product": { ... },
    "brands": [...],
    "categories": [...],
    "units": [...],
    "vat_taxes": [...],
    "suppliers": [...]
  }
}
```

---

### POST `/products`

Create a product.

```json
{
  "name": "Pepsi 50cl",
  "code": "PP-050",
  "barcode": "0012000008926",
  "brand_id": 5,
  "unit_id": 1,
  "category_ids": [3, 7],
  "vat_tax_ids": [1],
  "supplier_ids": [4],
  "product_sales_group_code": "FDP",
  "productpage_code": "pp050",
  "has_colisage": true,
  "is_active": true
}
```

---

### PUT `/products/{id}`

Full update. Accepts same payload as `store`. All fields optional.

---

### DELETE `/products/{id}`

Soft-delete. Also detaches categories, VAT taxes, and suppliers.

---

### POST `/products/{id}/approve`

Toggle product approval status (admin/root only).

---

### PATCH `/products/{id}/toggle-status`

Flip `is_active`. Returns `{ success, is_active }`.

---

### GET `/products/search`

Fast search by name or code for typeahead.

**Query:** `?q=coca&per_page=10`

---

### GET `/products/statistics`

Returns product count by status, brand, category.

---

### POST `/products/bulk-update`

Bulk update multiple product fields in one call. Body: `{ ids: [1,2,3], data: { is_active: false } }`.

---

### GET `/products/{id}/barcode`

Generate / retrieve product barcode image URL.

---

### GET `/products/{id}/stock`

All stock entries for this product across all warehouses.

```json
{
  "stock": [
    {
      "warehouse_code": "ALGER-CENTRAL-001",
      "location_code": "LOC-SELL-0001",
      "quantity": 240,
      "reserved_quantity": 10,
      "available_quantity": 230
    }
  ]
}
```

---

### POST `/products/{id}/images`

Upload product images (multipart/form-data, field: `images[]`).

### POST `/products/{id}/main-image`

Set the main/thumbnail image.

### DELETE `/products/{id}/thumbnails/{media}`

Delete a product image.

---

## 2. Product Packagings

A packaging defines **how many units fit in a selling container** (e.g., 24 cans per carton). No price stored here — pricing lives in `price_list_line_details`.

### GET `/product-packagings`

All packagings (paginated).

### GET `/product-packagings/{id}`

Single packaging with `unit` and `packagingLevel`.

### GET `/products/{id}/packagings`

All packagings for one product — use this on the product form.

**Response:**
```json
{
  "packagings": [
    {
      "id": 14,
      "product_id": 1,
      "unit_id": 3,
      "unit": { "id": 3, "name": "Carton" },
      "quantity": 24,
      "is_default": true,
      "packaging_level_id": 2,
      "packagingLevel": { "packaging_level": "CARTON", "units_per_package": 24 }
    }
  ]
}
```

### POST `/product-packagings`

```json
{
  "product_id": 1,
  "unit_id": 3,
  "quantity": 24,
  "is_default": true,
  "packaging_level_id": 2
}
```

> **Never send `price`** — that column was removed.

### PUT `/product-packagings/{id}`

```json
{ "unit_id": 4, "quantity": 12, "is_default": false, "packaging_level_id": 3 }
```

### DELETE `/product-packagings/{id}`

---

## 3. VAT Taxes

### GET `/vat-taxes`

Paginated list (20 per page). Returns both active and inactive.

```json
{
  "vatTaxes": {
    "data": [
      { "id": 1, "name": "TVA 19%", "percentage": 19, "type": "order_base", "deduction": "EXCLUSIVE", "is_active": true }
    ]
  }
}
```

> **Field names:** use `percentage` (not `rate` — the model was fixed).

### POST `/vat-taxes`

```json
{ "name": "TVA 9%", "percentage": 9 }
```

### PUT `/vat-taxes/{id}`

```json
{ "name": "TVA 9% réduit", "percentage": 9 }
```

### DELETE `/vat-taxes/{id}`

### PATCH `/vat-taxes/{id}/toggle`

Flip `is_active`. Returns `{ success, is_active }`.

---

## 4. Product Flags

Controls **inventory behaviour, ordering rules, and physical handling**. Business rules are **auto-enforced server-side** — always re-read the response after save.

| Auto-rule | Trigger | Server enforces |
|-----------|---------|----------------|
| Decimal lock | `decimal_quantity_allowed = false` | `decimal_precision = 0` |
| Expiry needs batch | `is_expirable = true` | `is_batch_managed = true` |
| Serialized is integer | `is_serialized = true` | `decimal_quantity_allowed = false`, `min_quantity_order = 1` |
| Weight needs decimals | `is_weight_managed = true` | `decimal_quantity_allowed = true`, `decimal_precision ≥ 2` |

### GET `/products/{id}/flags`

```json
{
  "product_id": 1,
  "flags": {
    "decimal_quantity_allowed": false,
    "decimal_precision": 0,
    "decimal_step": "1.0000",
    "min_quantity_order": "1.000",
    "is_backorder_allowed": false,
    "is_batch_managed": false,
    "is_consignment": false,
    "is_discountable": true,
    "is_expirable": false,
    "is_returnable": true,
    "is_salable": true,
    "is_serialized": false,
    "is_weight_managed": false,
    "requires_preparation": false,
    "delivery_unit": null,
    "allow_partial_delivery": true,
    "requires_refrigeration": false
  }
}
```

Returns default nulls if no record exists — always safe to render.

### PUT `/products/{id}/flags`

Send only the fields to change:

```json
{ "is_expirable": true, "is_discountable": true, "requires_refrigeration": true }
```

---

## 5. Product Marketing

Visibility and merchandising flags.

### GET `/products/{id}/marketing`

```json
{
  "product_id": 1,
  "marketing": {
    "is_featured": false,
    "is_free_good": false,
    "is_ideal_orderable": true,
    "is_quotation_required": false,
    "is_slow_moving": false,
    "is_sold_separately": true,
    "is_visible_individually": true,
    "requires_login_to_view": false
  }
}
```

### PUT `/products/{id}/marketing`

```json
{ "is_featured": true, "is_visible_individually": true }
```

---

## 6. Product Retail Price (B2C / POS)

> B2B partner prices live in `price_list_line_details`, not here.

### GET `/products/{id}/retail-price`

```json
{
  "product_id": 1,
  "retail_price": {
    "price_ht": "12.500",
    "price_ttc": "15.00",
    "ttc_pricing": false,
    "discount_price": "10.000"
  }
}
```

Returns nulls if no price set yet.

### PUT `/products/{id}/retail-price`

| Field | Required | Rule |
|-------|----------|------|
| `price_ht` | Yes | numeric, min 0 |
| `price_ttc` | No | numeric, min 0 |
| `ttc_pricing` | No | boolean |
| `discount_price` | No | numeric, must be < `price_ht` |

```json
{ "price_ht": 12.5, "price_ttc": 15.0, "discount_price": 10.0 }
```

---

## 7. Product Logistics Profile

Shipping dimensions and constraints used by the load planner.

### GET `/products/{id}/logistics`

```json
{
  "logistics": {
    "shipping_level": "CARTON",
    "stackable": true,
    "fragile": false,
    "temperature_controlled": false,
    "packagingLevels": [
      {
        "packaging_level": "CARTON",
        "units_per_package": 24,
        "length_m": 0.40,
        "width_m": 0.30,
        "height_m": 0.20,
        "gross_weight_kg": 10.5,
        "volume_m3": 0.024
      }
    ]
  }
}
```

### PUT `/products/{id}/logistics`

```json
{
  "shipping_level": "PALLET",
  "fragile": true,
  "temperature_controlled": true,
  "packaging_levels": [
    { "packaging_level": "CARTON", "units_per_package": 24, "gross_weight_kg": 10.5 }
  ]
}
```

---

## 8. Product Translations

### GET `/products/{id}/translations`

```json
{
  "translations": [
    { "lang": "fr", "name": "Coca-Cola 33cl", "short_description": "Boisson gazeuse", "description": null },
    { "lang": "ar", "name": "كوكا كولا 33سل", "short_description": null, "description": null }
  ]
}
```

### POST `/products/{id}/translations`

Upsert by `lang` — creates or replaces.

```json
{ "lang": "fr", "name": "Coca-Cola 33cl", "short_description": "Boisson gazeuse" }
```

### PUT `/products/{id}/translations/{lang}`

Partial update of an existing translation.

### DELETE `/products/{id}/translations/{lang}`

---

## 9. Product Suppliers

Manage the many-to-many product ↔ supplier link with per-link procurement data.

### GET `/products/{id}/suppliers`

```json
{
  "suppliers": [
    {
      "id": 3,
      "name": "FoodPlus SARL",
      "pivot": { "cost_price": "8.500", "min_order_qty": 12, "lead_time_days": 3, "preferred": true }
    }
  ]
}
```

### POST `/products/{id}/suppliers`

Attach (or update if already linked). Setting `preferred: true` demotes all others.

```json
{ "supplier_id": 3, "cost_price": 8.5, "min_order_qty": 12, "lead_time_days": 3, "preferred": true }
```

### PUT `/products/{id}/suppliers/{supplier}`

Update pivot data.

### DELETE `/products/{id}/suppliers/{supplier}`

Detach supplier from product.

---

## 10. Product Sales Groups

Master data — groups products into business lines.

### GET `/product-sales-groups`

| Param | Type | Default |
|-------|------|---------|
| `active_only` | boolean | false |
| `search` | string | — |
| `paginate` | boolean | false |

```json
{
  "groups": [
    { "code": "FDP", "name": "FoodPlus", "is_active": true },
    { "code": "CLN", "name": "Cleaning", "is_active": true },
    { "code": "SFD", "name": "Seafood", "is_active": true }
  ]
}
```

### POST `/product-sales-groups`

```json
{ "code": "BEV", "name": "Beverages" }
```

Code max 16 chars, auto-uppercased.

### PUT `/product-sales-groups/{code}`

```json
{ "name": "Beverages & Drinks", "is_active": true }
```

### PATCH `/product-sales-groups/{code}/toggle`

Flips `is_active`.

---

## 11. Product Pages

Hierarchical product catalogue pages (used in field sales app).

### GET `/product-pages`

Returns the full hierarchy with children and product counts.

```json
{
  "pages": [
    {
      "id": 1,
      "code": "BOISSONS",
      "name": "Boissons",
      "rank": 1,
      "is_salable": true,
      "children": [
        { "id": 5, "code": "GAZEUSES", "name": "Gazeuses" }
      ]
    }
  ]
}
```

### GET `/product-pages/{code}`

Single page detail.

### GET `/product-pages/{code}/products`

All products assigned to this page.

### POST `/product-pages`

```json
{
  "code": "LAITIER",
  "name": "Produits Laitiers",
  "rank": 5,
  "is_salable": true,
  "parent_id": null
}
```

### PUT `/product-pages/{code}`

Update page metadata.

### DELETE `/product-pages/{code}`

### POST `/product-pages/move-products`

Move products from one page to another.

```json
{ "product_ids": [1, 2, 3], "target_page_code": "GAZEUSES" }
```

---

## 12. Categories / Sub-categories / Brands / Units

| Resource | Base endpoint | Extra actions |
|----------|--------------|---------------|
| Brands | `GET/POST/PUT/DELETE /brands` | `GET /brands/{id}/toggle` |
| Categories | `GET/POST/PUT/DELETE /categories` | `GET /categories/{id}/toggle` |
| Sub-categories | `GET/POST/PUT/DELETE /subcategories` | `GET /subcategories/{id}/toggle` |
| Units | `GET/POST/PUT/DELETE /units` | `GET /units/{id}/toggle` |

Toggle endpoints flip `is_active` and return `{ success, is_active }`.

**Brand payload:**
```json
{ "name": "Coca-Cola", "is_active": true }
```

**Category payload:**
```json
{ "name": "Boissons", "parent_id": null, "media_id": null }
```

**Unit payload:**
```json
{ "name": "Carton", "allow_decimal": false, "is_active": true }
```

---

## 13. Suppliers (master data)

Needed for the product form supplier dropdown and procurement management.

### GET `/suppliers`

| Param | Type | Default |
|-------|------|---------|
| `search` | string | — |
| `active_only` | boolean | false |
| `paginate` | boolean | true |
| `per_page` | integer | 20 |

### POST `/suppliers`

```json
{
  "name": "FoodPlus SARL",
  "contact_name": "Ahmed Benali",
  "contact_email": "ahmed@foodplus.dz",
  "phone": "+213 555 123 456",
  "address": "Zone Industrielle, Alger"
}
```

### GET `/suppliers/{id}`

Returns supplier with linked products.

### PUT `/suppliers/{id}`

### DELETE `/suppliers/{id}`

Guard: returns 422 if supplier is still linked to products.

---

## 14. TypeScript types

```typescript
interface ProductSummary {
  id: number;
  name: string;
  code: string;
  barcode: string | null;
  has_colisage: boolean;
  productpage_code: string | null;
  product_sales_group_code: string | null;
  is_active: boolean;
  brand: { id: number; name: string } | null;
  retailPrice: ProductRetailPrice | null;
}

interface ProductPackaging {
  id: number;
  product_id: number;
  unit_id: number;
  unit: { id: number; name: string } | null;
  quantity: number;
  is_default: boolean;
  packaging_level_id: number | null;
  packagingLevel: PackagingLevel | null;
}

interface PackagingLevel {
  id: number;
  packaging_level: 'UNIT' | 'CARTON' | 'PALLET';
  units_per_package: number;
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  gross_weight_kg: number | null;
  net_weight_kg: number | null;
  volume_m3: number | null;
}

interface VatTax {
  id: number;
  name: string;
  percentage: number;        // NOT "rate"
  type: string;
  deduction: string;
  is_active: boolean;
}

interface ProductRetailPrice {
  id: number;
  product_id: number;
  price_ht: string;
  price_ttc: string | null;
  ttc_pricing: boolean;
  discount_price: string | null;
}

interface ProductFlags {
  decimal_quantity_allowed: boolean;
  decimal_precision: number;
  decimal_step: string;
  min_quantity_order: string;
  is_backorder_allowed: boolean;
  is_batch_managed: boolean;
  is_consignment: boolean;
  is_discountable: boolean;
  is_expirable: boolean;
  is_returnable: boolean;
  is_salable: boolean;
  is_serialized: boolean;
  is_weight_managed: boolean;
  requires_preparation: boolean;
  delivery_unit: string | null;
  allow_partial_delivery: boolean;
  requires_refrigeration: boolean;
}

interface ProductMarketing {
  is_featured: boolean;
  is_free_good: boolean;
  is_ideal_orderable: boolean;
  is_quotation_required: boolean;
  is_slow_moving: boolean;
  is_sold_separately: boolean;
  is_visible_individually: boolean;
  requires_login_to_view: boolean;
}

interface ProductTranslation {
  id: number;
  lang: string;
  name: string;
  short_description: string | null;
  description: string | null;
}

interface SupplierPivot {
  cost_price: string;
  min_order_qty: number;
  lead_time_days: number | null;
  preferred: boolean;
  extra: Record<string, unknown> | null;
}

interface ProductSupplier {
  id: number;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  pivot: SupplierPivot;
}

interface ProductSalesGroup {
  code: string;          // primary key — max 16 chars
  name: string;
  is_active: boolean;
}

interface ProductPage {
  id: number;
  code: string;
  name: string;
  rank: number;
  is_salable: boolean;
  parent_id: number | null;
  children: ProductPage[];
}

interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  address: string | null;
}
```

---

## 15. Common error responses

| HTTP | When |
|------|------|
| 401 | Missing / invalid token |
| 403 | Authenticated but role not allowed |
| 404 | Resource not found |
| 422 | Validation failed — body has `errors` object |

```json
{
  "message": "The given data was invalid.",
  "errors": {
    "unit_id": ["The unit id field is required."]
  }
}
```

---

## 16. Complete route summary

```
─── PRODUCTS ───────────────────────────────────────────────────────────────────
GET    /api/backend/products                             List (paginated)
GET    /api/backend/products/create                      Form init data
GET    /api/backend/products/search                      Typeahead search
GET    /api/backend/products/statistics                  Counts by status/brand
POST   /api/backend/products                             Create
GET    /api/backend/products/{id}                        Detail
GET    /api/backend/products/{id}/edit                   Edit form data
PUT    /api/backend/products/{id}                        Update
DELETE /api/backend/products/{id}                        Soft-delete
POST   /api/backend/products/{id}/approve                Toggle approval
PATCH  /api/backend/products/{id}/toggle-status          Toggle is_active
GET    /api/backend/products/{id}/barcode                Get barcode image
GET    /api/backend/products/{id}/stock                  Stock across warehouses
POST   /api/backend/products/{id}/images                 Upload images
POST   /api/backend/products/{id}/main-image             Set main image
DELETE /api/backend/products/{id}/thumbnails/{media}     Delete image
POST   /api/backend/products/bulk-update                 Bulk field update

─── PACKAGINGS ─────────────────────────────────────────────────────────────────
GET    /api/backend/product-packagings                   All packagings
POST   /api/backend/product-packagings                   Create
GET    /api/backend/product-packagings/{id}              Get one
PUT    /api/backend/product-packagings/{id}              Update
DELETE /api/backend/product-packagings/{id}              Delete
GET    /api/backend/products/{id}/packagings             By product

─── VAT TAXES ──────────────────────────────────────────────────────────────────
GET    /api/backend/vat-taxes                            List (paginated)
POST   /api/backend/vat-taxes                            Create
PUT    /api/backend/vat-taxes/{id}                       Update
DELETE /api/backend/vat-taxes/{id}                       Delete
PATCH  /api/backend/vat-taxes/{id}/toggle                Toggle is_active

─── PRODUCT SUB-RESOURCES ──────────────────────────────────────────────────────
GET    /api/backend/products/{id}/flags                  Get flags
PUT    /api/backend/products/{id}/flags                  Upsert flags

GET    /api/backend/products/{id}/marketing              Get marketing
PUT    /api/backend/products/{id}/marketing              Upsert marketing

GET    /api/backend/products/{id}/retail-price           Get B2C price
PUT    /api/backend/products/{id}/retail-price           Upsert B2C price

GET    /api/backend/products/{id}/logistics              Get logistics profile
PUT    /api/backend/products/{id}/logistics              Upsert logistics profile

GET    /api/backend/products/{id}/translations           List translations
POST   /api/backend/products/{id}/translations           Create/replace by lang
PUT    /api/backend/products/{id}/translations/{lang}    Update one lang
DELETE /api/backend/products/{id}/translations/{lang}    Delete one lang

GET    /api/backend/products/{id}/suppliers              Linked suppliers
POST   /api/backend/products/{id}/suppliers              Attach supplier
PUT    /api/backend/products/{id}/suppliers/{sid}        Update pivot
DELETE /api/backend/products/{id}/suppliers/{sid}        Detach supplier

─── MASTER DATA ────────────────────────────────────────────────────────────────
GET    /api/backend/brands                               List
POST   /api/backend/brands                               Create
PUT    /api/backend/brands/{id}                          Update
DELETE /api/backend/brands/{id}                          Delete
GET    /api/backend/brands/{id}/toggle                   Toggle active

GET    /api/backend/categories                           List
POST   /api/backend/categories                           Create
PUT    /api/backend/categories/{id}                      Update
DELETE /api/backend/categories/{id}                      Delete
GET    /api/backend/categories/{id}/toggle               Toggle active

GET    /api/backend/subcategories                        List
POST   /api/backend/subcategories                        Create
PUT    /api/backend/subcategories/{id}                   Update
DELETE /api/backend/subcategories/{id}                   Delete
GET    /api/backend/subcategories/{id}/toggle            Toggle active

GET    /api/backend/units                                List
POST   /api/backend/units                                Create
PUT    /api/backend/units/{id}                           Update
DELETE /api/backend/units/{id}                           Delete
GET    /api/backend/units/{id}/toggle                    Toggle active

GET    /api/backend/suppliers                            List all suppliers
POST   /api/backend/suppliers                            Create supplier
GET    /api/backend/suppliers/{id}                       Get one
PUT    /api/backend/suppliers/{id}                       Update
DELETE /api/backend/suppliers/{id}                       Delete (guard: no linked products)

GET    /api/backend/product-sales-groups                 List (FDP, CLN, SFD…)
POST   /api/backend/product-sales-groups                 Create
PUT    /api/backend/product-sales-groups/{code}          Update
PATCH  /api/backend/product-sales-groups/{code}/toggle   Toggle active

─── PRODUCT PAGES ──────────────────────────────────────────────────────────────
GET    /api/backend/product-pages                        Full hierarchy
POST   /api/backend/product-pages                        Create page
GET    /api/backend/product-pages/{code}                 Get one
PUT    /api/backend/product-pages/{code}                 Update
DELETE /api/backend/product-pages/{code}                 Delete
GET    /api/backend/product-pages/{code}/products        Products on page
POST   /api/backend/product-pages/move-products          Move products to page
```
