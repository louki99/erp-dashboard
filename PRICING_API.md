# Pricing Management API (Backend)

This document provides endpoints and ready-to-use examples for frontend integration.

## Base URL
- `http://localhost:8000/api/backend`

## Auth
All endpoints require `Authorization: Bearer <token>`.

## Common Headers
- `Authorization: Bearer <token>`
- `Accept: application/json`
- `Content-Type: application/json` (except CSV import = `multipart/form-data`)

---

## Price Lists

### List price lists
`GET /pricing`

**Query params (optional)**
- `q` (string) search by code/name
- `rank_min` (int)
- `rank_max` (int)
- `per_page` (int)

**Example (curl)**
```bash
curl --location 'http://localhost:8000/api/backend/pricing?q=retail&per_page=20' \
  --header 'Authorization: Bearer <token>' \
  --header 'Accept: application/json'
```

---

### Create price list
`POST /pricing`

**Body**
```json
{
  "code": "PL001",
  "name": "Retail",
  "rank": 1,
  "redirect_to_lines": true
}
```

---

### Get price list
`GET /pricing/{id}`

---

### Update price list
`PUT /pricing/{id}`

**Body**
```json
{
  "code": "PL001",
  "name": "Retail (Updated)",
  "rank": 2
}
```

---

### Delete price list
`DELETE /pricing/{id}`

---

### Search products (for lines)
`GET /pricing/products/search?q=milk`

---

### Get product packagings
`GET /pricing/products/{productId}/packagings`

---

## Price List Lines (Versions)

### Create line
`POST /pricing/{priceListId}/lines`

**Body**
```json
{
  "line_number": 1,
  "name": "Q1 2026",
  "start_date": "2026-02-01",
  "end_date": "2026-03-31",
  "closed": false
}
```

---

### Edit line (load details)
`GET /pricing/{priceListId}/lines/{lineNumber}/edit`

---

### Update line (metadata)
`PUT /pricing/{priceListId}/lines/{lineNumber}`

**Body**
```json
{
  "name": "Q1 2026 - Final",
  "start_date": "2026-02-01",
  "end_date": "2026-03-31",
  "closed": false
}
```

---

### Upsert line details (prices)
`PUT /pricing/{priceListId}/lines/{lineNumber}`

**Body**
```json
{
  "action": "upsert_details",
  "details": [
    {
      "product_id": 123,
      "sales_price": 10.500,
      "return_price": 9.000,
      "min_sales_price": 0,
      "max_sales_price": 0,
      "discount_amount": 0,
      "discount_rate": 0
    }
  ]
}
```

---

### Clear line details
`PUT /pricing/{priceListId}/lines/{lineNumber}`

**Body**
```json
{
  "action": "clear_details"
}
```

---

### Duplicate line
`POST /pricing/{priceListId}/lines/duplicate`

**Body**
```json
{
  "from_line": 1,
  "to_line": 2,
  "name": "Q2 2026",
  "start_date": "2026-04-01",
  "end_date": "2026-06-30",
  "closed": false
}
```

---

### Import CSV (line details)
`POST /pricing/{priceListId}/lines/{lineNumber}/import`

**Form-data fields**
- `csv` (file)
- `mode` (merge|replace)
- `has_header` (true|false)
- `product_identifier` (id|code)

**CSV example**
```csv
product_id,sales_price,return_price,min_sales_price,max_sales_price,discount_amount,discount_rate
123,10.5,9.0,0,0,0,0
456,15.2,13.0,0,0,0.5,0
```

---

### Create line detail (single row)
`POST /pricing/{priceListId}/lines/{lineNumber}/details`

**Body**
```json
{
  "product_id": 123,
  "unit_id": 1,
  "sales_price": 10.500,
  "return_price": 9.000,
  "min_sales_price": 0,
  "max_sales_price": 0,
  "sales_discount": 0,
  "discount_amount": 0,
  "discount_rate": 0
}
```

---

### Get line detail
`GET /pricing/{priceListId}/lines/{lineNumber}/details/{detailId}`

---

### Update line detail
`PUT /pricing/{priceListId}/lines/{lineNumber}/details/{detailId}`

**Body** (any subset of fields)
```json
{
  "product_id": 123,
  "unit_id": 1,
  "sales_price": 11.000,
  "return_price": 9.500,
  "min_sales_price": 0,
  "max_sales_price": 0,
  "sales_discount": 0,
  "discount_amount": 0,
  "discount_rate": 0
}
```

---

### Delete line detail
`DELETE /pricing/{priceListId}/lines/{lineNumber}/details/{detailId}`

---

## Partner Price Overrides

### List overrides
`GET /pricing/overrides`

**Query params (optional)**
- `q` (string)
- `partner_id` (int)
- `product_id` (int)
- `active` (bool)
- `per_page` (int)

---

### Create override
`POST /pricing/overrides`

**Body**
```json
{
  "partner_id": 10,
  "product_id": 123,
  "fixed_price": 9.5,
  "discount_rate": 0,
  "discount_amount": 0,
  "valid_from": "2026-02-01",
  "valid_to": "2026-03-31",
  "active": true,
  "priority": 10
}
```

---

### Preview effective price
`POST /pricing/overrides/preview`

**Body**
```json
{
  "partner_id": 10,
  "product_id": 123,
  "at": "2026-02-10"
}
```

---

### Toggle override
`PATCH /pricing/overrides/{id}/toggle`

---

### Update override
`PUT /pricing/overrides/{id}`

**Body** (same as create)

---

### Delete override
`DELETE /pricing/overrides/{id}`

---

## Packaging Prices

### List packaging prices
`GET /pricing/packaging-prices?price_list_id=1`

---

### Create packaging price
`POST /pricing/packaging-prices`

**Body**
```json
{
  "line_detail_id": 50,
  "packaging_id": 7,
  "sales_price": 25.000,
  "return_price": 23.000,
  "min_sales_price": 0,
  "max_sales_price": 0,
  "sales_discount": 0,
  "discount_amount": 0,
  "discount_rate": 0
}
```

---

### Update packaging price
`PUT /pricing/packaging-prices/{packagingPrice}`

**Body** (same as create)

---

### Delete packaging price
`DELETE /pricing/packaging-prices/{packagingPrice}`

---

### Get packagings for product (AJAX)
`GET /pricing/packaging-prices/ajax/packagings?product_id=123`

---

## Notes
- Dates are in `YYYY-MM-DD`.
- Numeric prices support decimals.
- For CSV import, set `Content-Type` automatically as `multipart/form-data`.
