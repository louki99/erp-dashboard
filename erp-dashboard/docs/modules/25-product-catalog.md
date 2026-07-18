# Module 25 — Product Catalog ("Fiche Produit") — Full API Reference

*Created: 2026-07-18 — deep dive ahead of the admin "fiche produit" (product detail sheet) UI refactor. Updated same day: added master-data/dropdown source endpoints and per-business-concern edit endpoints (brand, unit) after UI team feedback.*

This is the complete map of every table that makes up a product, and every endpoint that reads or writes it — written for the UI team rebuilding the product detail screen. Read §1–§4 first; they explain the shape of the domain. §5 is the main "show me everything about this product" endpoint. §7 is organized **by business concern** — one block per facet (categories, VAT, supplier, product page, …), each with the "what's currently attached" GET, the "change just this" PUT, and the "list of all valid options for the dropdown" GET, so an admin can edit any single facet without touching the rest of the product.

## 1. Strategy — how a "product" is actually structured

A product is **not** one table. `products` holds identity/description/media/brand/unit fields and four classification pointers (`brand_id`, `unit_id`, `productpage_code`, `product_sales_group_code`) — everything else (pricing, tax, logistics, marketing flags, translations, supplier sourcing) lives in one of **17 satellite tables**, each with a narrow, specific purpose. There is no single table you can `SELECT *` from to get "the product" — the full picture only exists by joining across all of them, which is exactly what the full-detail endpoint (§5) does.

**Two parallel product systems coexist in this codebase**, and both are live — don't assume one is legacy without checking:
- **The ERP/B2B system** (newer, 2025-2026): `product_flags`, `product_marketing`, `product_retail_prices`, `product_logistics_profiles`, `product_packaging_levels`, `product_pricing_tiers`, `product_pages`, `product_sales_groups`. This is what the admin "fiche produit" screen is mostly about.
- **The storefront/POS-cart variant system** (older): `product_colors`, `product_sizes`, `product_thumbnails`, `product_subcategories`. **Confirmed still live** (wired into `ProductRepository`, cart/order pricing, import/export, and multiple API resource classes) — despite looking legacy, removing or ignoring them would break the storefront and POS cart pricing flows. Treat them as first-class, not cruft.

**Two schema facts to know before touching pricing fields:**
- `products.price`, `products.discount_price`, `products.quantity`, `products.min_order_quantity`, `products.price_ttc` **were dropped** from the `products` table (migration `2026_04_24_110000_product_schema_cleanup_retail_prices_and_flags`) and moved into `product_retail_prices` / `product_flags`. B2C/shelf pricing is `product_retail_prices`; B2B pricing is `price_list_line_details` (a different domain, price-list-scoped) with tiered breakpoints in `product_pricing_tiers`.
- `product_vat_taxes` is schema-wise N:N (a product can have multiple VAT rates), but **every pricing helper on the model (`getVatRate()`, `getCalculatedTtcPrice()`, etc.) only ever uses the first attached row**. If the UI ever needs true multi-VAT support, that's a backend change, not just a UI one.

**A messy but important fact: several master-data types have 2–3 parallel CRUD locations** (categories, sub-categories, units, brands, suppliers, VAT taxes, product-pages, product-sales-groups all exist both as "legacy direct routes" and under `/master-data/*`, and VAT taxes has a third read-only spot too). §6 explains exactly which one to use and why — **don't pick one at random**, they're gated by different permissions and a normal product-editing role can't reach some of them.

**A pre-existing, unrelated bug worth knowing about, not fixed here**: `App\Models\CustomField.php:56` calls `json_decode()` on a value that can be `null`, producing a PHP 8.1+ deprecation warning on every request that touches custom fields (which is most product reads). Harmless today, but noisy in logs.

## 2. The 17 tables — reference

| Table | Purpose | Model | Relation on `Product` | Cardinality |
|---|---|---|---|---|
| `products` | Core identity: name, description, media, brand/unit FKs, code, slug, barcode, classification pointers | `Product` | — (the root) | — |
| `product_flags` | Inventory/ordering behavior rules (batch-managed, expirable, serialized, decimal qty, refrigeration…) | `ProductFlag` | `flags()` | 1:1 |
| `product_pages` | Hierarchical merchandising classification (X3-style "product page" tree, distinct from categories) | `ProductPage` | `productPage()` | N:1 (via `productpage_code`) |
| `product_supplier` | Sourcing info per supplier: cost price, MOQ, lead time, preferred flag | `ProductSupplier` (pivot) | `suppliers()` | N:N |
| `product_categories` | Storefront category tagging | — (pure pivot) | `categories()` | N:N |
| `product_packagings` | Packaging/unit conversions (e.g. "1 carton = 12 units"), theoretical weight | `ProductPackaging` | `packagings()`, `defaultPackaging()` | 1:N |
| `product_logistics_profiles` | Shipping/handling constraints: stackable, fragile, temperature-controlled, min ship qty | `ProductLogisticsProfile` | `logisticsProfile()` | 1:1 |
| `product_translations` | Per-language name/description overrides | `ProductTranslation` | `translations()` | 1:N |
| `product_sales_groups` | Master-data grouping (e.g. FDP=FoodPlus, CLN=Cleaning, SFD=Seafood) | `ProductSalesGroup` | `productSalesGroup()` | N:1 (via `product_sales_group_code`) |
| `product_packaging_levels` | Physical dims/weights per packaging level (UNIT/CARTON/PALLET), child of a logistics profile | `ProductPackagingLevel` | via `logisticsProfile.packagingLevels` | 1:N (of logistics profile) |
| `product_marketing` | Visibility/merchandising flags (featured, free good, quotation-required, sold-separately…) | `ProductMarketing` | `marketing()` | 1:1 |
| `product_vat_taxes` | VAT rate association | — (pure pivot) | `vatTaxes()` | N:N (but see §1 — only first is used for pricing) |
| `product_retail_prices` | B2C/POS shelf price (HT/TTC + promo) — **not** the B2B price authority | `ProductRetailPrice` | `retailPrice()` | 1:1 |
| `product_pricing_tiers` | B2B quantity-tiered pricing breakpoints, tied to a price-list line + packaging | `ProductPricingTier` | `pricingTiers()` | 1:N |
| `product_thumbnails` | Legacy image-gallery pivot — **live**, distinct from the newer Spatie MediaLibrary collections | `ProductThumbnail` (unused directly; only the pivot table name matters) | `medias()` | N:N |
| `product_sizes` | Storefront/POS-cart size variant + per-variant price delta | `ProductSize` (unused directly) | `sizes()` | N:N (pivot carries `price`) |
| `product_colors` | Storefront/POS-cart color variant + per-variant price delta | `ProductColor` (unused directly) | `colors()` | N:N (pivot carries `price`) |
| `product_subcategories` | Storefront subcategory tagging | — (pure pivot) | `subcategories()` | N:N |

## 3. Product model — quick relationship index

`app/Models/Product.php`. Traits: `Auditable`, `BelongsToCompany`, `HasDataScoping`, `HasCustomFields`, `HasDmsMedia`, implements `HasMedia` (Spatie). `$guarded = ['id']` — everything else mass-assignable. No soft deletes.

All 17-table relations are listed in §2. Besides those: `shop()`, `brand()`, `unit()`, `categories()`, `subcategories()`, `stocks()`, `priceListDetails()` (B2B pricing, separate domain), `reviews()`, `favorites()`, `orders()`, `flashSales()`, `videoMedia()`, `units()` (distinct-units-across-packagings helper).

Useful computed attributes: `thumbnail`, `requiresRefrigeration` (proxies `flags->requires_refrigeration`), `getUnitVolumeM3Attribute()` / `getUnitWeightKgAttribute()` (from `logisticsProfile` + `packagingLevels`), `getPosPriceAttribute()`, `getTotalStockAttribute()` / `getTotalAvailableStockAttribute()` / `getTotalReservedStockAttribute()`.

Pricing helpers (built on `retailPrice` + `vatTaxes()->first()`, **not** `price_lists`/`product_pricing_tiers`): `getPosPrice()`, `getCalculatedTtcPrice()`, `retailPriceHt()`, `retailDiscountPriceHt()`, `retailShelfUnitPriceHt()`, `getVatRate()`, `getCalculatedHtPrice()`, `getVatAmount()`.

## 4. Custom fields

Wired in via `HasCustomFields` trait. Entity type is `'product'` (singular) when querying `CustomField`, but `'products'` (table name, plural) when querying `CustomFieldValue.entity_type` — don't conflate the two. `$product->getCustomFieldsArray()` gives `{field_name: {label, value, formatted_value, type, field}}`; already included in §5's response. To save values, POST/PUT a `custom_fields` object in the basic product update body (§7.13).

## 5. `GET /api/backend/products/{product}` — full product detail

Permission: `browse-products`. `ProductApiController::show()` — covers all 17 tables.

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123" \
  -H "Authorization: Bearer {TOKEN}" -H "Accept: application/json"
```

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 123, "name": "...", "code": "SKU-001", "slug": "...", "barcode": "...",
      "brand_id": 5, "unit_id": 2, "productpage_code": "SCOAA", "product_sales_group_code": "SFD",
      "is_active": true, "is_approve": true, "is_new": false, "is_featured": false,
      "brand": { "...": "..." }, "unit": { "...": "..." },
      "units": [ "...distinct units across packagings..." ],
      "categories": [ { "id": 1, "name": "..." } ],
      "subcategories": [ { "id": 3, "name": "..." } ],
      "colors": [ { "id": 2, "name": "Red", "pivot": { "price": "0.00" } } ],
      "sizes": [ { "id": 1, "name": "L", "pivot": { "price": "0.00" } } ],
      "vat_taxes": [ { "id": 1, "name": "TVA 20%", "percentage": "20", "pivot": { "...": "..." } } ],
      "suppliers": [ { "id": 4, "name": "...", "pivot": { "cost_price": "...", "min_order_qty": 1, "lead_time_days": 3, "preferred": true } } ],
      "flags": { "is_batch_managed": true, "is_expirable": false, "...": "..." },
      "marketing": { "is_featured": false, "is_free_good": false, "...": "..." },
      "stocks": [ { "branch_id": 1, "available_quantity": 42, "...": "..." } ],
      "packagings": [ { "id": 10, "unit_id": 2, "quantity": 12, "is_default": true, "theoretical_weight": "0.500", "packaging_level": { "...": "..." } } ],
      "video_media": { "...": "..." },
      "medias": [ "...legacy thumbnail gallery, product_thumbnails pivot..." ],
      "product_page": { "code": "SCOAA", "name": "Condiments & Assaisonnements", "loadable": true, "salable": true, "...": "..." },
      "product_sales_group": { "code": "SFD", "name": "Seafood", "is_active": true },
      "logistics_profile": { "shipping_level": "UNIT", "stackable": true, "fragile": false, "packaging_levels": [ { "packaging_level": "CARTON", "units_per_package": 12, "gross_weight_kg": "...", "volume_m3": "..." } ] },
      "translations": [ { "lang": "ar", "name": "...", "description": "...", "short_description": "..." } ],
      "retail_price": { "price_ht": "10.00", "price_ttc": "12.00", "ttc_pricing": true, "discount_price": null },
      "pricing_tiers": [ { "price_list_id": 2, "min_qty": "10.000", "max_qty": "49.999", "tier_price": "9.500", "price_list": { "...": "..." }, "packaging": { "...": "..." } } ]
    },
    "custom_fields": { "field_name": { "label": "...", "value": "...", "formatted_value": "...", "type": "text" } },
    "stock_summary": { "total_stock": 100, "available_stock": 80, "reserved_stock": 20, "by_branch": [ "..." ] },
    "price_lists": [ { "price_list": { "id": 1, "code": "...", "name": "...", "rank": 1 }, "pricing_details": [ "...B2B price_list_line_details rows..." ] } ],
    "thumbnails": [ "...legacy gallery URLs..." ],
    "additional_thumbnails": [ "..." ]
  }
}
```

**UI notes:** camelCase relation names serialize as `snake_case` keys (`productPage` → `product_page`). `data.price_lists` (B2B base price per line) and `data.product.pricing_tiers` (quantity breakpoints on top of a line) are different things — don't conflate in the UI. `retail_price`/`logistics_profile`/`flags`/`marketing` can all be `null` (1:1, optional) — handle gracefully.

## 6. Master-data / dropdown source endpoints — pick the right one

Several master-data types have **2–3 parallel places** they can be listed from. They are gated by **different permissions**, so picking the wrong one can 403 for a role that should legitimately be able to edit products. Use this table — it's the single source of truth for "which endpoint do I call to populate this dropdown."

| Type | ✅ Recommended for product-form dropdowns | Also exists (don't use for this) |
|---|---|---|
| Brands | `GET /brands` (`manage-products`) | `GET /master-data/brands` (`manage-master-data` — stricter, for managing the brand list itself) |
| Categories | `GET /categories` (`manage-products`) | `GET /master-data/categories` (`manage-master-data`) |
| Subcategories | `GET /subcategories` (`manage-products`) | `GET /master-data/sub-categories` (`manage-master-data`) |
| Units | `GET /units` (`manage-products`) | `GET /master-data/units` (`manage-master-data`) |
| VAT taxes | `GET /vat-taxes` (`manage-products`) | `GET /master-data/vat-taxes` (`manage-master-data`), `GET /masterdata/vat-taxes` (generic app-wide dropdown bootstrap, no CUD) |
| Suppliers | `GET /suppliers` (`manage-products`) | `GET /master-data/suppliers` (`manage-master-data`) |
| Product pages | `GET /product-pages` (`manage-products`) — supports `?tree=1` for the hierarchical picker | `GET /master-data/product-pages` (`manage-master-data`) |
| Product sales groups | `GET /product-sales-groups` (`manage-products`) — supports `?active_only=1`, `?search=`, unpaginated by default (`?paginate=1` to page it) | `GET /master-data/product-sales-groups` (`manage-master-data`) |

**Why:** the `/master-data/*` prefix is explicitly documented in `routes/backend.php` as *"Access: root | admin only"* — it's meant for managing the reference data itself (creating a new brand, renaming a VAT rate), not for populating a dropdown while editing a product. A `manager`/`directeur_commercial` role can edit products (`manage-products`) but does **not** have `manage-master-data` — if the product-edit screen calls a `/master-data/*` endpoint for its dropdowns, those roles get a 403 on a screen they're otherwise fully allowed to use. The plain (non-`/master-data`) endpoints carry the same `manage-products` permission the rest of the product-edit screen already requires, so they're the correct fit.

**Bonus — two endpoints that bundle several dropdowns in one call:**
- `GET /products/create` (`browse-products`) → `{ brands, categories, units, vat_taxes, suppliers, custom_fields, shop }` in one response. Good for the "new product" form.
- `GET /products/{id}/edit` (`manage-products` — stricter than `create`, note the mismatch) → same bundle, plus the product itself pre-loaded with `flags, marketing, categories, vatTaxes, units, suppliers, medias, customFieldValues`. Good for the "edit product" form's initial load.
- Neither of these two bundles includes subcategories, product pages, or sales groups — call those separately (table above) if your form needs them.

## 7. Editing a product — by business concern

Every block below follows the same shape: **what it is**, **GET current state**, **PUT to change it**, and **where to get the list of valid options**. Permission is `manage-products` on every write and every product-scoped read below, unless noted.

### 7.1 Categories (N:N)

```bash
# Current state
curl -X GET "https://api.omni360.cloud/api/backend/products/123/categories" -H "Authorization: Bearer {TOKEN}"
# → { "product_id": 123, "categories": [ { "id": 1, "name": "Épicerie" } ] }

# Change it (full sync — send the complete desired set)
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/categories" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "category_ids": [1, 4] }'
# → { "success": true, "message": "Product categories updated.", "product_id": 123, "categories": [...] }

# Options list (for the picker)
curl -X GET "https://api.omni360.cloud/api/backend/categories" -H "Authorization: Bearer {TOKEN}"
```

### 7.2 Subcategories (N:N)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/subcategories" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/subcategories" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "subcategory_ids": [7] }'
curl -X GET "https://api.omni360.cloud/api/backend/subcategories" -H "Authorization: Bearer {TOKEN}"
```

### 7.3 VAT taxes (N:N — but see §1, only the first attached is used for pricing)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/vat-taxes" -H "Authorization: Bearer {TOKEN}"
# → { "product_id": 123, "vat_taxes": [ { "id": 1, "name": "TVA 20%", "percentage": "20" } ] }

curl -X PUT "https://api.omni360.cloud/api/backend/products/123/vat-taxes" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "vat_tax_ids": [1] }'

curl -X GET "https://api.omni360.cloud/api/backend/vat-taxes" -H "Authorization: Bearer {TOKEN}"
```

### 7.4 Supplier sourcing (N:N pivot with cost/MOQ/lead-time)

This one isn't a simple sync — each linked supplier carries its own cost price, min order qty, lead time, and a "preferred" flag, so it's attach/update/detach per supplier rather than one full-set PUT.

```bash
# Current suppliers linked to this product
curl -X GET "https://api.omni360.cloud/api/backend/products/123/suppliers" -H "Authorization: Bearer {TOKEN}"

# Link a new supplier (or update if already linked)
curl -X POST "https://api.omni360.cloud/api/backend/products/123/suppliers" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "supplier_id": 4, "cost_price": 8.50, "min_order_qty": 10, "lead_time_days": 3, "preferred": true }'

# Update pivot data for an existing link
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/suppliers/4" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "cost_price": 9.00 }'

# Unlink
curl -X DELETE "https://api.omni360.cloud/api/backend/products/123/suppliers/4" -H "Authorization: Bearer {TOKEN}"

# Options list (for "add a supplier" picker)
curl -X GET "https://api.omni360.cloud/api/backend/suppliers" -H "Authorization: Bearer {TOKEN}"
```
Setting `"preferred": true` automatically demotes every other linked supplier's `preferred` flag to `false` server-side — only one preferred supplier per product at a time.

### 7.5 Product page (single FK — `products.productpage_code`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/page" -H "Authorization: Bearer {TOKEN}"
# → { "product_id": 123, "product_page": { "code": "SCOAA", "name": "Condiments & Assaisonnements", "...": "..." } }

curl -X PUT "https://api.omni360.cloud/api/backend/products/123/page" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "code": "SCOAA" }'
# send { "code": null } to clear it

curl -X GET "https://api.omni360.cloud/api/backend/product-pages" -H "Authorization: Bearer {TOKEN}"
curl -X GET "https://api.omni360.cloud/api/backend/product-pages?tree=1" -H "Authorization: Bearer {TOKEN}"  # hierarchical, for a tree picker
```

### 7.6 Sales group (single FK — `products.product_sales_group_code`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/sales-group" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/sales-group" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "code": "SFD" }'
curl -X GET "https://api.omni360.cloud/api/backend/product-sales-groups?active_only=1" -H "Authorization: Bearer {TOKEN}"
```

### 7.7 Brand (single FK — `products.brand_id`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/brand" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/brand" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "brand_id": 5 }'
curl -X GET "https://api.omni360.cloud/api/backend/brands" -H "Authorization: Bearer {TOKEN}"
```

### 7.8 Unit (single FK — `products.unit_id`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/unit" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/unit" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "unit_id": 2 }'
curl -X GET "https://api.omni360.cloud/api/backend/units" -H "Authorization: Bearer {TOKEN}"
```

### 7.9 Inventory/ordering flags (1:1 — `product_flags`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/flags" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/flags" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "is_batch_managed": true, "is_expirable": true, "is_serialized": false }'
```
No options list needed — every field is a plain boolean/number, not a reference to another table. Full field list: `decimal_quantity_allowed`, `decimal_precision`, `decimal_step`, `min_quantity_order`, `is_backorder_allowed`, `is_batch_managed`, `is_consignment`, `is_discountable`, `is_expirable`, `is_returnable`, `is_salable`, `is_serialized`, `is_weight_managed`, `requires_preparation`, `delivery_unit`, `allow_partial_delivery`, `requires_refrigeration`. Business rules are auto-enforced server-side on save (e.g. expirable ⇒ batch-managed) — don't duplicate that validation client-side, just let the API reject/adjust.

### 7.10 Marketing/visibility flags (1:1 — `product_marketing`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/marketing" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/marketing" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "is_featured": true, "is_visible_individually": true }'
```
Fields: `is_featured`, `is_free_good`, `is_ideal_orderable`, `is_quotation_required`, `is_slow_moving`, `is_sold_separately`, `is_visible_individually`, `requires_login_to_view`. Note `products.is_featured` also exists as a separate column on the base product — the two are not synced with each other; treat them as two independent flags with the same name, don't assume setting one sets the other.

### 7.11 B2C/POS shelf price (1:1 — `product_retail_prices`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/retail-price" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/retail-price" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "price_ht": 10.00, "price_ttc": 12.00, "ttc_pricing": true, "discount_price": 9.00 }'
```
If `ttc_pricing: true`, `price_ttc` is the reference and `price_ht` is informational/computed — and vice versa. `discount_price` must be `< price_ht`. This is **not** B2B pricing — that's price lists (`GET /masterdata/price-lists` for the list, managed through the separate price-list admin screens, out of scope for this doc).

### 7.12 Logistics profile + packaging levels (1:1 + nested 1:N)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/logistics" -H "Authorization: Bearer {TOKEN}"
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/logistics" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{
    "stackable": true, "fragile": false, "temperature_controlled": true,
    "packaging_levels": [
      { "packaging_level": "UNIT", "units_per_package": 1, "gross_weight_kg": 0.5, "length_m": 0.1, "width_m": 0.1, "height_m": 0.2 },
      { "packaging_level": "CARTON", "units_per_package": 12, "gross_weight_kg": 6.2, "length_m": 0.4, "width_m": 0.3, "height_m": 0.25 }
    ]
  }'
```
This is a nested upsert — the `packaging_levels` array is written together with the profile in one call. `volume_m3` on each level is a **PostgreSQL generated column** (`length_m * width_m * height_m`) — don't send it, it's computed automatically and read-only.

### 7.13 Translations (1:N — `product_translations`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/translations" -H "Authorization: Bearer {TOKEN}"
curl -X POST "https://api.omni360.cloud/api/backend/products/123/translations" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "lang": "ar", "name": "...", "short_description": "...", "description": "..." }'
curl -X PUT "https://api.omni360.cloud/api/backend/products/123/translations/ar" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "name": "..." }'
curl -X DELETE "https://api.omni360.cloud/api/backend/products/123/translations/ar" -H "Authorization: Bearer {TOKEN}"
```

### 7.14 Packagings (1:N — `product_packagings`)

```bash
curl -X GET "https://api.omni360.cloud/api/backend/products/123/packagings" -H "Authorization: Bearer {TOKEN}"
# Full CRUD also available via the generic resource (create/update/delete individual packaging rows):
curl -X POST "https://api.omni360.cloud/api/backend/product-packagings" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" \
  -d '{ "product_id": 123, "unit_id": 2, "quantity": 12, "is_default": false, "packaging_level_id": 5 }'
curl -X PUT "https://api.omni360.cloud/api/backend/product-packagings/10" \
  -H "Authorization: Bearer {TOKEN}" -H "Content-Type: application/json" -d '{ "quantity": 24 }'
curl -X DELETE "https://api.omni360.cloud/api/backend/product-packagings/10" -H "Authorization: Bearer {TOKEN}"
```

### 7.15 Pricing tiers, colors, sizes, thumbnails — no dedicated per-product edit endpoint yet

- **`product_pricing_tiers`** — read-only from the product side (§5's `pricing_tiers`). These rows are managed through the **price-list admin screens** (tier breakpoints belong to a price list line, not to the product directly) — there is no `products/{id}/pricing-tiers` write endpoint, and adding one wouldn't make sense without also picking which price list/line it belongs to. If the UI needs to edit tiers from the product screen, that's a new feature to scope with backend, not something already exposed.
- **`product_colors`** / **`product_sizes`** — currently only editable via the big product form (§7.16's `color`/`size` fields), no dedicated micro-endpoint. These are legacy storefront variant pricing — low priority for the ERP-focused "fiche produit" redesign, but flag to backend if the UI needs standalone editing.
- **`product_thumbnails`** (legacy gallery) — has its own upload/delete endpoints, not a sync: `POST /products/{id}/images` (upload), `DELETE /products/{id}/thumbnails/{media}` (remove one), `POST /products/{id}/main-image` (replace the primary photo). These aren't classification data so they don't follow the GET/PUT pattern above.

### 7.16 The basic product fields + everything-in-one-request form

`POST /api/backend/products` (create) / `PUT /api/backend/products/{product}` (update) — `ProductRepository::storeByRequest()` / `updateByRequest()`, validated by `ProductRequest`. This is the "big form" endpoint: one request can set the core product row **and** several related tables in one transaction, useful for the initial create flow or a full-page save; the per-concern endpoints above are the preferred way to change just one thing afterward.

| What it sets | Table(s) | Notes |
|---|---|---|
| `name`, `description`, `short_description`, `brand`, `unit`, `code`, `buy_price`, `has_colisage`, `meta_title`, `meta_description`, `meta_keywords` | `products` | Core fields |
| `names[lang]`, `descriptions[lang]`, `short_descriptions[lang]` | `product_translations` | Keyed by language code |
| `category` / `categories` (array) | `product_categories` | Synced |
| `sub_category` (array) | `product_subcategories` | Synced |
| `color` (array of `{id, price}` or plain ids on API) | `product_colors` | Synced |
| `size` (array of `{id, price}` or plain ids on API) | `product_sizes` | Synced |
| `price`, `discount_price`, `ttc_pricing` | `product_retail_prices` | Upserted — **not** a `products` column despite the field name |
| flag fields (§7.9's list) | `product_flags` | Patched/created |
| `vat_taxes` (array) | `product_vat_taxes` | **Fixed in this pass** — previously only synced on create, never on update |
| `units_multi` (array) | packaging-derived units pivot | **Fixed in this pass**, same bug |
| `suppliers` (array) + `supplier_cost_{id}`/`supplier_min_qty_{id}`/`supplier_lead_time_{id}`/`supplier_preferred_{id}` | `product_supplier` | **Fixed in this pass**, same bug |
| `custom_fields` (object) | `custom_field_values` | Via `HasCustomFields::saveCustomFields()` |
| `thumbnail` / `photo` / `image` (file) | Spatie `product_photos` collection | Main product image (DMS/MinIO) |
| `additionThumbnail[]` (files, non-API) / `previousThumbnail[]` (API) | `product_thumbnails` + Spatie | Legacy gallery |

**Not settable through this endpoint**: `productpage_code`, `product_sales_group_code`, `barcode`, `name_ar`/`short_description_ar`/`description_ar`, `promo_unit` — use §7.5/§7.6 for the first two; the rest have no write path anywhere in the API yet (flag to backend if needed).

## 8. What changed in this pass (backend changelog, for context)

1. **`ProductApiController::show()`** now eager-loads `productPage`, `productSalesGroup`, `logisticsProfile.packagingLevels`, `translations`, `retailPrice`, `pricingTiers.priceList`, `pricingTiers.packaging`, and `packagings.packagingLevel` — closing a 6-table gap (§5).
2. **`Product::pricingTiers()`** relation added — didn't exist before.
3. **`ProductRepository::updateByRequest()` bug fix** — VAT taxes, multi-units, and supplier sync were only ever applied on product *creation*; a product's VAT/suppliers/units could never be changed via the main edit form after creation. Now synced on update too.
4. **New `ProductClassificationController`** — categories, subcategories, VAT taxes, sales-group, page, brand, and unit each got a dedicated `GET`/`PUT` pair (§7.1–7.8). Before this, categories/subcategories/vat could only be changed by resubmitting the *entire* product form; sales-group/page/brand/unit-as-a-standalone-edit couldn't be changed at all outside the big form.
5. **§6 added** — the master-data/dropdown-source permission mismatch (product-editing roles can't reach `/master-data/*`) was undocumented before; now there's one canonical table telling the UI exactly which endpoint to call per type.

## 9. Permissions

Only two permission keys gate the entire products domain — there is no finer per-sub-resource split (editing `product_flags` uses the same gate as editing the base product):

| Permission | Roles | Gates |
|---|---|---|
| `browse-products` | `root`, `admin`, `manager`, `directeur_commercial`, `technicien_commercial`, `adv_agent`, `dispatcher`, `magasinier`, `pos_manager` | `GET /products`, `GET /products/{id}` |
| `manage-products` | `root`, `admin`, `manager`, `directeur_commercial` | Everything else in this doc except `/master-data/*` |
| `manage-master-data` | `root`, `admin` only | `/master-data/*` — reference-data CRUD, not product-form dropdowns (see §6) |

Note: all product classification sub-resource GET endpoints (§7.1–7.8) are gated `manage-products`, **not** the lighter `browse-products` — consistent with the existing flags/marketing/retail-price/logistics pattern, but means a read-only `browse-products`-only role can see the main product but not its per-facet panels. Flag to backend if that's not the intended UX.
