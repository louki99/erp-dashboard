# Product Management API Documentation

## Overview

This document provides comprehensive documentation for the Product Management API endpoints. All products are automatically associated with the current shop (single shop ERP configuration).

**Base URL:** `/backend/products`

**Authentication:** All endpoints require `auth:sanctum` middleware.

---

## Table of Contents

1. [Core CRUD Operations](#core-crud-operations)
2. [Status & Approval](#status--approval)
3. [Media Management](#media-management)
4. [Advanced Features](#advanced-features)
5. [Bulk Operations](#bulk-operations)
6. [Search & AI](#search--ai)
7. [Statistics](#statistics)
8. [Request/Response Examples](#requestresponse-examples)

---

## Core CRUD Operations

### 1. List Products

**Endpoint:** `GET /backend/products`

**Description:** Retrieve a paginated list of products with advanced filtering options.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | Filter by status: `0` (new), `1` (updated), `approve` (approved) |
| `is_active` | boolean | No | Filter by active status |
| `search` | string | No | Search by product name or code |
| `category` | integer | No | Filter by category ID |
| `brand` | integer | No | Filter by brand ID |
| `min_price` | decimal | No | Minimum price filter |
| `max_price` | decimal | No | Maximum price filter |
| `in_stock` | boolean | No | Filter products with available stock |
| `sort_by` | string | No | Sort field (default: `created_at`) |
| `sort_order` | string | No | Sort order: `asc` or `desc` (default: `desc`) |
| `per_page` | integer | No | Items per page (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "name": "Product Name",
        "code": "PRD001",
        "price": 100.00,
        "discount_price": 80.00,
        "is_active": true,
        "is_approve": true,
        "brand": {...},
        "unit": {...},
        "media": {...},
        "categories": [...],
        "flags": {...},
        "marketing": {...},
        "stocks": [...]
      }
    ],
    "total": 50
  },
  "meta": {
    "total": 50,
    "per_page": 20,
    "current_page": 1,
    "last_page": 3
  }
}
```

---

### 2. Get Form Metadata

**Endpoint:** `GET /backend/products/create`

**Description:** Retrieve all necessary data to create a product (brands, categories, units, etc.).

**Response:**

```json
{
  "success": true,
  "data": {
    "brands": [...],
    "categories": [...],
    "units": [...],
    "vat_taxes": [...],
    "suppliers": [...],
    "custom_fields": [...],
    "shop": {...}
  }
}
```

---

### 3. Create Product

**Endpoint:** `POST /backend/products`

**Description:** Create a new product with all related data.

**Request Body:**

```json
{
  "name": "Product Name",
  "code": "PRD001",
  "price": 100.00,
  "discount_price": 80.00,
  "quantity": 50,
  "min_order_quantity": 1,
  "brand": 1,
  "unit": 1,
  "short_description": "Short description",
  "description": "<p>Full HTML description</p>",
  "buy_price": 60.00,
  "has_colisage": false,
  "thumbnail": "file",
  "additionThumbnail": ["file1", "file2"],
  "categories": [1, 2, 3],
  "vat_taxes": [1],
  "units_multi": [1, 2],
  "suppliers": [1, 2],
  "supplier_cost_1": 55.00,
  "supplier_min_qty_1": 10,
  "supplier_lead_time_1": 7,
  "supplier_preferred_1": true,
  "decimal_quantity_allowed": false,
  "decimal_precision": 0,
  "is_backorder_allowed": false,
  "is_batch_managed": false,
  "is_discountable": true,
  "is_expirable": false,
  "is_returnable": true,
  "is_salable": true,
  "is_serialized": false,
  "is_weight_managed": false,
  "is_featured": false,
  "is_free_good": false,
  "is_quotation_required": false,
  "is_visible_individually": true,
  "requires_login_to_view": false,
  "custom_fields": {
    "1": "value1",
    "2": "value2"
  },
  "meta_title": "SEO Title",
  "meta_description": "SEO Description",
  "meta_keywords": ["keyword1", "keyword2"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Product created successfully!",
  "data": {
    "id": 1,
    "name": "Product Name",
    ...
  }
}
```

**Error Response (422):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "code": ["Product code already exists!"]
  }
}
```

---

### 4. Show Product

**Endpoint:** `GET /backend/products/{product}`

**Description:** Retrieve detailed information about a specific product.

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {
      "id": 1,
      "name": "Product Name",
      "code": "PRD001",
      "price": 100.00,
      "brand": {...},
      "unit": {...},
      "categories": [...],
      "flags": {...},
      "marketing": {...},
      "vatTaxes": [...],
      "suppliers": [...],
      "stocks": [...],
      "packagings": [...],
      "customFieldValues": [...]
    },
    "custom_fields": {...},
    "stock_summary": {
      "total_stock": 100,
      "available_stock": 85,
      "reserved_stock": 15,
      "by_branch": [...]
    },
    "thumbnails": [...],
    "additional_thumbnails": [...]
  }
}
```

---

### 5. Edit Product

**Endpoint:** `GET /backend/products/{product}/edit`

**Description:** Get product data and form metadata for editing.

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {...},
    "brands": [...],
    "categories": [...],
    "units": [...],
    "vat_taxes": [...],
    "suppliers": [...],
    "custom_fields": [...]
  }
}
```

---

### 6. Update Product

**Endpoint:** `PUT /backend/products/{product}`

**Description:** Update an existing product.

**Request Body:** Same as Create Product

**Response:**

```json
{
  "success": true,
  "message": "Product updated successfully!",
  "data": {...}
}
```

---

### 7. Delete Product

**Endpoint:** `DELETE /backend/products/{product}`

**Description:** Permanently delete a product and all associated media.

**Response:**

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

---

## Status & Approval

### 8. Approve Product

**Endpoint:** `POST /backend/products/{product}/approve`

**Description:** Approve a pending product (sets `is_approve=true`, `is_active=true`, `is_new=false`).

**Response:**

```json
{
  "success": true,
  "message": "Product approved successfully",
  "data": {...}
}
```

---

### 9. Toggle Product Status

**Endpoint:** `PATCH /backend/products/{product}/toggle-status`

**Description:** Toggle product active/inactive status (requires product to be approved first).

**Response:**

```json
{
  "success": true,
  "message": "Status updated successfully",
  "data": {
    "is_active": true
  }
}
```

**Error Response (403):**

```json
{
  "success": false,
  "message": "Sorry! Your Product is not approved yet!"
}
```

---

## Media Management

### 10. Delete Thumbnail

**Endpoint:** `DELETE /backend/products/{product}/thumbnails/{media}`

**Description:** Delete a specific product thumbnail/image.

**Response:**

```json
{
  "success": true,
  "message": "Thumbnail deleted successfully!"
}
```

---

### 11. Upload Images

**Endpoint:** `POST /backend/products/{product}/images`

**Description:** Upload multiple additional product images.

**Request Body (multipart/form-data):**

```
images[]: file1.jpg
images[]: file2.jpg
images[]: file3.jpg
```

**Validation:**
- Required: array of images
- Each image: jpeg, png, jpg, gif, webp
- Max size: 5MB per image

**Response:**

```json
{
  "success": true,
  "message": "Images uploaded successfully",
  "data": [
    {
      "id": 10,
      "url": "/storage/products/image1.jpg",
      "name": "image1"
    },
    {
      "id": 11,
      "url": "/storage/products/image2.jpg",
      "name": "image2"
    }
  ]
}
```

---

## Advanced Features

### 12. Generate Barcode

**Endpoint:** `GET /backend/products/{product}/barcode`

**Description:** Generate barcode data for a product.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `qty` | integer | No | Number of barcodes to generate (default: 4) |

**Response:**

```json
{
  "success": true,
  "data": {
    "product": {...},
    "code": "PRD001",
    "quantities": 4,
    "barcode_url": "/shop/product/1/barcode?qty=4"
  }
}
```

**Error Response (400):**

```json
{
  "success": false,
  "message": "Sorry! Your Product code is not generated yet!"
}
```

---

### 13. Get Product Stock

**Endpoint:** `GET /backend/products/{product}/stock`

**Description:** Retrieve detailed stock information for a product across all branches.

**Response:**

```json
{
  "success": true,
  "data": {
    "product_id": 1,
    "product_name": "Product Name",
    "total_stock": 100,
    "available_stock": 85,
    "reserved_stock": 15,
    "stocks_by_branch": [
      {
        "id": 1,
        "branch_code": "BR001",
        "quantity": 50,
        "available_quantity": 45,
        "reserved_quantity": 5,
        "branch": {...}
      },
      {
        "id": 2,
        "branch_code": "BR002",
        "quantity": 50,
        "available_quantity": 40,
        "reserved_quantity": 10,
        "branch": {...}
      }
    ]
  }
}
```

---

## Bulk Operations

### 14. Bulk Update Products

**Endpoint:** `POST /backend/products/bulk-update`

**Description:** Perform bulk operations on multiple products.

**Request Body:**

```json
{
  "product_ids": [1, 2, 3, 4, 5],
  "action": "activate"
}
```

**Available Actions:**
- `activate` - Activate products (only if approved)
- `deactivate` - Deactivate products
- `approve` - Approve products (sets active, approved, not new)
- `delete` - Delete products and all media

**Response:**

```json
{
  "success": true,
  "message": "Bulk operation completed successfully",
  "data": {
    "action": "activate",
    "updated_count": 5
  }
}
```

---

## Search & AI

### 15. Search Products

**Endpoint:** `GET /backend/products/search`

**Description:** Advanced product search by name, barcode, SKU, and custom fields.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `q` | string | Yes | Search query |
| `category_id` | integer | No | Filter by category |
| `limit` | integer | No | Max results (default: 20) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Product Name",
      "code": "PRD001",
      "price": 100.00,
      "category": {...},
      "shop": {...},
      "media": {...}
    }
  ]
}
```

---

### 16. Generate AI Description

**Endpoint:** `POST /backend/products/generate-ai-description`

**Description:** Generate product description using AI based on product name and short description.

**Request Body:**

```json
{
  "name": "Premium Wireless Headphones",
  "short_description": "High-quality Bluetooth headphones with noise cancellation"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "description": "<p>Introducing our Premium Wireless Headphones...</p><h2>Features</h2><ul><li>Active noise cancellation</li><li>30-hour battery life</li></ul>"
  }
}
```

**Error Response (500):**

```json
{
  "success": false,
  "message": "Failed to generate AI description",
  "error": "API connection failed"
}
```

---

## Statistics

### 17. Get Product Statistics

**Endpoint:** `GET /backend/products/statistics`

**Description:** Retrieve product statistics for the current shop.

**Response:**

```json
{
  "success": true,
  "data": {
    "total_products": 150,
    "active_products": 120,
    "pending_approval": 10,
    "out_of_stock": 5,
    "low_stock": 15
  }
}
```

---

## Request/Response Examples

### Complete Product Creation Example

**Request:**

```bash
curl -X POST https://your-domain.com/backend/products \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Premium Coffee Beans" \
  -F "code=COFFEE001" \
  -F "price=25.99" \
  -F "discount_price=19.99" \
  -F "quantity=100" \
  -F "brand=1" \
  -F "unit=1" \
  -F "short_description=Arabica beans from Colombia" \
  -F "description=<p>Premium quality coffee beans...</p>" \
  -F "thumbnail=@/path/to/image.jpg" \
  -F "categories[]=1" \
  -F "categories[]=2" \
  -F "vat_taxes[]=1" \
  -F "is_discountable=1" \
  -F "is_salable=1"
```

**Response:**

```json
{
  "success": true,
  "message": "Product created successfully!",
  "data": {
    "id": 45,
    "name": "Premium Coffee Beans",
    "code": "COFFEE001",
    "price": 25.99,
    "discount_price": 19.99,
    "quantity": 100,
    "is_active": true,
    "is_approve": true,
    "created_at": "2024-01-15T10:30:00.000000Z",
    "brand": {
      "id": 1,
      "name": "Premium Brands"
    },
    "unit": {
      "id": 1,
      "name": "Kilogram"
    },
    "media": {
      "id": 100,
      "src": "products/coffee001.jpg"
    },
    "categories": [
      {"id": 1, "name": "Beverages"},
      {"id": 2, "name": "Coffee"}
    ]
  }
}
```

---

## Error Handling

All endpoints follow a consistent error response format:

**Validation Error (422):**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"]
  }
}
```

**Authorization Error (403):**

```json
{
  "success": false,
  "message": "Unauthorized action"
}
```

**Server Error (500):**

```json
{
  "success": false,
  "message": "Failed to perform operation",
  "error": "Detailed error message"
}
```

---

## Notes

1. **Single Shop Configuration:** All products are automatically associated with the current authenticated user's shop. No need to specify `shop_id` in requests.

2. **File Uploads:** Use `multipart/form-data` content type for requests with file uploads (thumbnails, images).

3. **Custom Fields:** Custom fields are dynamically validated based on the field configuration. Check the `custom_fields` array from the `/create` endpoint for available fields and their validation rules.

4. **Stock Management:** Product stock is managed through the `stocks` table with branch-level tracking. Use the stock endpoints for detailed inventory information.

5. **Approval Workflow:** Products created by non-admin users may require approval based on system settings (`new_product_approval` and `update_product_approval`).

6. **Media Cleanup:** When deleting products or thumbnails, associated files are automatically removed from storage.

7. **Relationships:** Products support many-to-many relationships with categories, VAT taxes, units, and suppliers. Use array notation for these fields.

---

## Frontend Integration Example

```javascript
// Fetch products with filters
async function fetchProducts(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await fetch(`/backend/products?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  return await response.json();
}

// Create product
async function createProduct(formData) {
  const response = await fetch('/backend/products', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    body: formData // FormData object with files
  });
  return await response.json();
}

// Bulk update
async function bulkUpdateProducts(productIds, action) {
  const response = await fetch('/backend/products/bulk-update', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      product_ids: productIds,
      action: action
    })
  });
  return await response.json();
}

// Search products
async function searchProducts(query) {
  const response = await fetch(`/backend/products/search?q=${encodeURIComponent(query)}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  return await response.json();
}
```

---

## Changelog

- **v1.0.0** (2024-01-15): Initial comprehensive API documentation
  - Core CRUD operations
  - Status & approval management
  - Media management
  - Advanced features (barcode, stock, AI)
  - Bulk operations
  - Search functionality
  - Statistics endpoint
