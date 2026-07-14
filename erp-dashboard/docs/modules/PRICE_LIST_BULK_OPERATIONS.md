# Price Lists — Bulk Operations (Frontend Contracts)

> **Status:** Frontend hooks & API layer are ready. Backend endpoints must be implemented.

This document describes the three bulk endpoints the frontend expects for the new **Full-Screen Grid / Excel-like** Price Lists UI.

---

## 1. `POST /api/backend/pricing/price-lists/{id}/bulk-update`

Applies a mass formula on `price_list_line_details`.

### Frontend hook

```ts
const { bulkUpdatePriceList, loading, error } = useBulkUpdatePriceList();

await bulkUpdatePriceList({
  priceListId: 1,
  data: {
    line_number: 10,
    operation: 'increase_rate',
    field: 'sales_price',
    value: 5.0,
    scope: 'all',
  },
});
```

### Request body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `line_number` | `number` | no | Target line. If omitted, applies to all active lines of the price list. |
| `operation` | `string` | yes | `increase_rate`, `decrease_rate`, `increase_amount`, `decrease_amount`, `set_value`, `multiply`, `copy_from_list` |
| `field` | `string` | yes | `sales_price`, `return_price`, `min_sales_price`, `max_sales_price`, `discount_rate`, `discount_amount` |
| `value` | `number` | yes | Value to apply (percentage, amount, coefficient, etc.). |
| `scope` | `string` | no | `all` (default) or `selected`. |
| `filters.product_ids` | `number[]` | no | Restrict to specific products. |
| `filters.min_price` | `number` | no | Restrict by current price floor. |
| `filters.max_price` | `number` | no | Restrict by current price ceiling. |
| `source_price_list_id` | `number` | no | Required when `operation = copy_from_list`. |
| `source_line_number` | `number` | no | Required when `operation = copy_from_list`. |

### Expected response

```json
{
  "success": true,
  "message": "245 lignes mises à jour",
  "data": {
    "updated_count": 245,
    "line_number": 10
  }
}
```

---

## 2. `POST /api/backend/pricing/price-lists/{id}/import`

Mass import via Excel/CSV on a whole price list.

### Frontend hook

```ts
const { importPriceList, loading, error } = useImportPriceList();

await importPriceList({
  priceListId: 1,
  params: {
    file: fileInput.files[0],
    line_number: 10,
    mode: 'merge',
    has_header: true,
    product_identifier: 'code',
  },
});
```

### Request body (`multipart/form-data`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | `File` | yes | `.csv` or `.xlsx` file. |
| `line_number` | `number` | no | Target line. If omitted, backend should use the active line or create one. |
| `mode` | `string` | yes | `merge` or `replace`. |
| `has_header` | `string` | yes | `"1"` or `"0"`. |
| `product_identifier` | `string` | yes | `"code"` or `"id"`. |
| `sheet_index` | `string` | no | For Excel files, zero-based sheet index. |

### Expected file columns

```
product_code | product_id | line_number | sales_price | return_price | min_sales_price | max_sales_price | discount_rate | discount_amount
```

At least one of `product_code` or `product_id` must be present.

### Expected response

```json
{
  "success": true,
  "message": "Import terminé",
  "data": {
    "imported": 200,
    "updated": 15,
    "errors": 3,
    "line_number": 10
  }
}
```

---

## 3. `GET /api/backend/pricing/price-lists/{id}/export`

Exports the full price list (or one line) to CSV/Excel.

### Frontend hook

```ts
const { exportPriceList, loading, error } = useExportPriceList();

const blob = await exportPriceList({
  priceListId: 1,
  params: {
    line_number: 10,
    format: 'xlsx',
  },
});

// Trigger download
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'price-list-C01-line-10.xlsx';
a.click();
```

### Query parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `line_number` | `number` | no | Filter to one line. If omitted, export all lines. |
| `format` | `string` | yes | `csv` or `xlsx`. |

### Expected response

- `Content-Type: text/csv` or `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Binary file download.

### Expected columns

```
product_id, product_code, product_name, line_number, sales_price, return_price, min_sales_price, max_sales_price, discount_rate, discount_amount
```

---

## Backend controller requirements

The Laravel controller must:

1. Load the `PriceList` with its `lines.details` and `details.product`.
2. Target the `price_list_line_details` table for updates.
3. For `bulk-update`, run the operation inside a database transaction and return the count.
4. For `import`, parse CSV/Excel, match products by `code` or `id`, then upsert details.
5. For `export`, stream a generated file with the columns above.
6. Respect the existing `{ success, message, data }` envelope for JSON responses.

---

## Files modified in the frontend

- `src/types/pricing.types.ts` — added `BulkUpdateRequest`, `BulkUpdateResponse`, `ImportPriceListParams`, `ImportPriceListResponse`, `ExportPriceListParams`, `ExportFormat`.
- `src/services/api/pricingApi.ts` — added `bulkUpdatePriceList`, `importPriceList`, `exportPriceList`.
- `src/hooks/pricing/usePricing.ts` — added `useBulkUpdatePriceList`, `useImportPriceList`, `useExportPriceList`.
