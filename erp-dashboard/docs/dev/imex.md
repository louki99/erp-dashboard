# Dynamic Import/Export System - Complete REST API Reference

## Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Template Management API](#template-management-api)
4. [Import Operations API](#import-operations-api)
5. [Export Operations API](#export-operations-api)
6. [Batch Management API](#batch-management-api)
7. [Statistics API](#statistics-api)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Complete Examples](#complete-examples)

---

## API Overview

### Base URL

```
Production: https://yourdomain.com/api/backend
Development: http://localhost:8000/api/backend
```

### API Design Principles

- **RESTful** - Standard HTTP methods (GET, POST, PUT, DELETE)
- **JSON** - All requests and responses use JSON format
- **Stateless** - Each request contains all necessary information
- **Versioned** - API version in URL path (future-proof)
- **Consistent** - Uniform response structure across all endpoints

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "errors": {
    "field_name": ["Error message 1", "Error message 2"]
  }
}
```

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST (resource created) |
| 204 | No Content | Successful DELETE (no response body) |
| 400 | Bad Request | Invalid request format |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Authenticated but no permission |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

---

## Authentication

All API endpoints require authentication using Bearer token.

### Obtaining a Token

```http
POST /api/backend/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "your_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "1|abcdef123456...",
  "user": {
    "id": 1,
    "name": "Admin User",
    "email": "admin@example.com"
  }
}
```

### Using the Token

Include the token in the Authorization header for all subsequent requests:

```http
GET /api/backend/templates
Authorization: Bearer 1|abcdef123456...
```

### Token Expiration

Tokens expire after 24 hours. Handle 401 responses by redirecting to login.

---

## Template Management API

### 1. List All Templates

Retrieve a list of all import/export templates.

**Endpoint:**
```http
GET /api/backend/templates
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| type | string | No | Filter by type: `import`, `export`, `both` |
| module | string | No | Filter by module: `catalog`, `crm`, `inventory` |
| object_code | string | No | Filter by object code: `PRODUCT`, `CUSTOMER` |
| is_active | boolean | No | Filter by status: `true`, `false` |
| search | string | No | Search in code or name |

**Example Request:**
```http
GET /api/backend/templates?type=both&module=catalog&is_active=true
Authorization: Bearer {token}
```

**Response:**
```json
{
    "success": true,
    "templates": [
        {
            "id": 18,
            "code": "IMPPRODUCT",
            "name": "Product Import/Export - Complete",
            "type": "both",
            "object_code": "PRODUCT",
            "object_name": "Products",
            "primary_table": "products",
            "module": "catalog",
            "description": "Complete product import with all attributes, flags, marketing, packaging, and stock",
            "file_type": "csv",
            "field_separator": ";",
            "decimal_separator": ".",
            "date_format": "Y-m-d",
            "charset": "UTF-8",
            "record_separator": "\\n",
            "allow_import": true,
            "allow_update": true,
            "allow_workflow": false,
            "is_special_import": false,
            "allow_export": true,
            "export_chrono": 0,
            "is_active": true,
            "is_system": true,
            "created_by": null,
            "updated_by": null,
            "created_at": "2025-12-19T16:03:11.000000Z",
            "updated_at": "2025-12-19T16:03:11.000000Z",
            "deleted_at": null,
            "fields": [
                {
                    "id": 115,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 0,
                    "indicator": "A",
                    "table_name": "products",
                    "field_name": "code",
                    "label": "Product Code",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": true,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 50,
                    "format": null,
                    "transformation": "uppercase",
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 116,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 1,
                    "indicator": "B",
                    "table_name": "products",
                    "field_name": "name",
                    "label": "Product Name",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 255,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 117,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 2,
                    "indicator": "C",
                    "table_name": "products",
                    "field_name": "short_description",
                    "label": "Short Description",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 500,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 118,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 3,
                    "indicator": "D",
                    "table_name": "products",
                    "field_name": "description",
                    "label": "Description",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 119,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 4,
                    "indicator": "E",
                    "table_name": "products",
                    "field_name": "price",
                    "label": "Price",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 120,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 5,
                    "indicator": "F",
                    "table_name": "products",
                    "field_name": "discount_price",
                    "label": "Discount Price",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 121,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 6,
                    "indicator": "G",
                    "table_name": "products",
                    "field_name": "quantity",
                    "label": "Quantity",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 122,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 7,
                    "indicator": "H",
                    "table_name": "products",
                    "field_name": "shop_id",
                    "label": "Shop ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 123,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 8,
                    "indicator": "I",
                    "table_name": "products",
                    "field_name": "brand_id",
                    "label": "Brand ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 124,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 9,
                    "indicator": "J",
                    "table_name": "products",
                    "field_name": "unit_id",
                    "label": "Unit ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 125,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 10,
                    "indicator": "K",
                    "table_name": "products",
                    "field_name": "is_active",
                    "label": "Active",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0,
                        "Y": 1,
                        "N": 0,
                        "1": 1,
                        "0": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 126,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 11,
                    "indicator": "L",
                    "table_name": "products",
                    "field_name": "is_approve",
                    "label": "Approved",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0,
                        "Y": 1,
                        "N": 0,
                        "1": 1,
                        "0": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 127,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 12,
                    "indicator": "M",
                    "table_name": "product_flags",
                    "field_name": "decimal_quantity_allowed",
                    "label": "Allow Decimal Qty",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 128,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 13,
                    "indicator": "N",
                    "table_name": "product_flags",
                    "field_name": "is_backorder_allowed",
                    "label": "Allow Backorder",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 129,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 14,
                    "indicator": "O",
                    "table_name": "product_flags",
                    "field_name": "is_discountable",
                    "label": "Discountable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 130,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 15,
                    "indicator": "P",
                    "table_name": "product_flags",
                    "field_name": "is_returnable",
                    "label": "Returnable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 131,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 16,
                    "indicator": "Q",
                    "table_name": "product_flags",
                    "field_name": "is_salable",
                    "label": "Salable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 132,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 17,
                    "indicator": "R",
                    "table_name": "product_marketing",
                    "field_name": "is_featured",
                    "label": "Featured",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 133,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 18,
                    "indicator": "S",
                    "table_name": "product_marketing",
                    "field_name": "is_free_good",
                    "label": "Free Good",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 134,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 19,
                    "indicator": "T",
                    "table_name": "product_marketing",
                    "field_name": "is_slow_moving",
                    "label": "Slow Moving",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 135,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 20,
                    "indicator": "U",
                    "table_name": "stocks",
                    "field_name": "branch_code",
                    "label": "Branch Code",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 136,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 21,
                    "indicator": "V",
                    "table_name": "stocks",
                    "field_name": "quantity",
                    "label": "Stock Quantity",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 137,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 22,
                    "indicator": "W",
                    "table_name": "stocks",
                    "field_name": "minimum_quantity",
                    "label": "Min Stock",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 138,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 23,
                    "indicator": "X",
                    "table_name": "stocks",
                    "field_name": "maximum_quantity",
                    "label": "Max Stock",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                }
            ],
            "creator": null
        }
    ]
}
```

**Use Cases:**
- Display template list in UI
- Filter templates by category
- Search for specific templates

---

### 2. Get Template Details

Retrieve complete details of a specific template including fields and relationships.

**Endpoint:**
```http
GET /api/backend/templates/{id}
```

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| id | integer or string | Template ID or template code |

**Example Requests:**
```http
GET /api/backend/templates/1
GET /api/backend/templates/IMPPRODUCT
Authorization: Bearer {token}
```

**Response:**
```json
{
    "success": true,
    "template": {
        "id": 18,
        "code": "IMPPRODUCT",
        "name": "Product Import/Export - Complete",
        "type": "both",
        "object_code": "PRODUCT",
        "object_name": "Products",
        "primary_table": "products",
        "module": "catalog",
        "description": "Complete product import with all attributes, flags, marketing, packaging, and stock",
        "file_type": "csv",
        "field_separator": ";",
        "decimal_separator": ".",
        "date_format": "Y-m-d",
        "charset": "UTF-8",
        "record_separator": "\\n",
        "allow_import": true,
        "allow_update": true,
        "allow_workflow": false,
        "is_special_import": false,
        "allow_export": true,
        "export_chrono": 0,
        "is_active": true,
        "is_system": true,
        "created_by": null,
        "updated_by": null,
        "created_at": "2025-12-19T16:03:11.000000Z",
        "updated_at": "2025-12-19T16:03:11.000000Z",
        "deleted_at": null,
        "fields": [
            {
                "id": 115,
                "template_id": 18,
                "level": 1,
                "sequence": 0,
                "indicator": "A",
                "table_name": "products",
                "field_name": "code",
                "label": "Product Code",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": true,
                "is_identifier": true,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": 50,
                "format": null,
                "transformation": "uppercase",
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 116,
                "template_id": 18,
                "level": 1,
                "sequence": 1,
                "indicator": "B",
                "table_name": "products",
                "field_name": "name",
                "label": "Product Name",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": true,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": 255,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 117,
                "template_id": 18,
                "level": 1,
                "sequence": 2,
                "indicator": "C",
                "table_name": "products",
                "field_name": "short_description",
                "label": "Short Description",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": 500,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 118,
                "template_id": 18,
                "level": 1,
                "sequence": 3,
                "indicator": "D",
                "table_name": "products",
                "field_name": "description",
                "label": "Description",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 119,
                "template_id": 18,
                "level": 1,
                "sequence": 4,
                "indicator": "E",
                "table_name": "products",
                "field_name": "price",
                "label": "Price",
                "link": null,
                "data_type": "decimal",
                "input_output": "both",
                "is_required": true,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 120,
                "template_id": 18,
                "level": 1,
                "sequence": 5,
                "indicator": "F",
                "table_name": "products",
                "field_name": "discount_price",
                "label": "Discount Price",
                "link": null,
                "data_type": "decimal",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 121,
                "template_id": 18,
                "level": 1,
                "sequence": 6,
                "indicator": "G",
                "table_name": "products",
                "field_name": "quantity",
                "label": "Quantity",
                "link": null,
                "data_type": "integer",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 122,
                "template_id": 18,
                "level": 1,
                "sequence": 7,
                "indicator": "H",
                "table_name": "products",
                "field_name": "shop_id",
                "label": "Shop ID",
                "link": null,
                "data_type": "integer",
                "input_output": "both",
                "is_required": true,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 123,
                "template_id": 18,
                "level": 1,
                "sequence": 8,
                "indicator": "I",
                "table_name": "products",
                "field_name": "brand_id",
                "label": "Brand ID",
                "link": null,
                "data_type": "integer",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 124,
                "template_id": 18,
                "level": 1,
                "sequence": 9,
                "indicator": "J",
                "table_name": "products",
                "field_name": "unit_id",
                "label": "Unit ID",
                "link": null,
                "data_type": "integer",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 125,
                "template_id": 18,
                "level": 1,
                "sequence": 10,
                "indicator": "K",
                "table_name": "products",
                "field_name": "is_active",
                "label": "Active",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0,
                    "Y": 1,
                    "N": 0,
                    "1": 1,
                    "0": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 126,
                "template_id": 18,
                "level": 1,
                "sequence": 11,
                "indicator": "L",
                "table_name": "products",
                "field_name": "is_approve",
                "label": "Approved",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0,
                    "Y": 1,
                    "N": 0,
                    "1": 1,
                    "0": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 127,
                "template_id": 18,
                "level": 1,
                "sequence": 12,
                "indicator": "M",
                "table_name": "product_flags",
                "field_name": "decimal_quantity_allowed",
                "label": "Allow Decimal Qty",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 128,
                "template_id": 18,
                "level": 1,
                "sequence": 13,
                "indicator": "N",
                "table_name": "product_flags",
                "field_name": "is_backorder_allowed",
                "label": "Allow Backorder",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 129,
                "template_id": 18,
                "level": 1,
                "sequence": 14,
                "indicator": "O",
                "table_name": "product_flags",
                "field_name": "is_discountable",
                "label": "Discountable",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 130,
                "template_id": 18,
                "level": 1,
                "sequence": 15,
                "indicator": "P",
                "table_name": "product_flags",
                "field_name": "is_returnable",
                "label": "Returnable",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 131,
                "template_id": 18,
                "level": 1,
                "sequence": 16,
                "indicator": "Q",
                "table_name": "product_flags",
                "field_name": "is_salable",
                "label": "Salable",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 132,
                "template_id": 18,
                "level": 1,
                "sequence": 17,
                "indicator": "R",
                "table_name": "product_marketing",
                "field_name": "is_featured",
                "label": "Featured",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 133,
                "template_id": 18,
                "level": 1,
                "sequence": 18,
                "indicator": "S",
                "table_name": "product_marketing",
                "field_name": "is_free_good",
                "label": "Free Good",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 134,
                "template_id": 18,
                "level": 1,
                "sequence": 19,
                "indicator": "T",
                "table_name": "product_marketing",
                "field_name": "is_slow_moving",
                "label": "Slow Moving",
                "link": null,
                "data_type": "boolean",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": {
                    "Yes": 1,
                    "No": 0
                },
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 135,
                "template_id": 18,
                "level": 1,
                "sequence": 20,
                "indicator": "U",
                "table_name": "stocks",
                "field_name": "branch_code",
                "label": "Branch Code",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 136,
                "template_id": 18,
                "level": 1,
                "sequence": 21,
                "indicator": "V",
                "table_name": "stocks",
                "field_name": "quantity",
                "label": "Stock Quantity",
                "link": null,
                "data_type": "decimal",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 137,
                "template_id": 18,
                "level": 1,
                "sequence": 22,
                "indicator": "W",
                "table_name": "stocks",
                "field_name": "minimum_quantity",
                "label": "Min Stock",
                "link": null,
                "data_type": "decimal",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 138,
                "template_id": 18,
                "level": 1,
                "sequence": 23,
                "indicator": "X",
                "table_name": "stocks",
                "field_name": "maximum_quantity",
                "label": "Max Stock",
                "link": null,
                "data_type": "decimal",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            }
        ],
        "relationships": [
            {
                "id": 10,
                "template_id": 18,
                "relationship_name": "flags",
                "related_table": "product_flags",
                "foreign_key": "product_id",
                "local_key": "id",
                "relationship_type": "hasOne",
                "is_required": false,
                "cascade_delete": true,
                "cascade_update": true,
                "order": 0,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 11,
                "template_id": 18,
                "relationship_name": "marketing",
                "related_table": "product_marketing",
                "foreign_key": "product_id",
                "local_key": "id",
                "relationship_type": "hasOne",
                "is_required": false,
                "cascade_delete": true,
                "cascade_update": true,
                "order": 0,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 13,
                "template_id": 18,
                "relationship_name": "packaging",
                "related_table": "product_packaging",
                "foreign_key": "product_id",
                "local_key": "id",
                "relationship_type": "hasOne",
                "is_required": false,
                "cascade_delete": true,
                "cascade_update": true,
                "order": 0,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            },
            {
                "id": 12,
                "template_id": 18,
                "relationship_name": "stocks",
                "related_table": "stocks",
                "foreign_key": "product_id",
                "local_key": "id",
                "relationship_type": "hasMany",
                "is_required": false,
                "cascade_delete": false,
                "cascade_update": true,
                "order": 0,
                "created_at": "2025-12-19T16:03:11.000000Z",
                "updated_at": "2025-12-19T16:03:11.000000Z"
            }
        ],
        "validation_rules": [],
        "workflow_steps": []
    }
}
```

**Use Cases:**
- Display template configuration
- Edit template settings
- Understand field mappings before import

---

### 3. Create New Template

Create a new import/export template.

**Endpoint:**
```http
POST /api/backend/templates
```

**Request Body:**
```json
{
  "code": "IMPCUSTOM",
  "name": "Custom Product Import",
  "object_code": "CUSTOM",
  "object_name": "Custom Products",
  "primary_table": "custom_products",
  "type": "both",
  "module": "catalog",
  "description": "Custom product import template",
  "file_type": "csv",
  "field_separator": ";",
  "decimal_separator": ".",
  "date_format": "Y-m-d",
  "charset": "UTF-8",
  "allow_import": true,
  "allow_update": true,
  "allow_export": true,
  "is_active": true,
  "fields": [
    {
      "indicator": "A",
      "table_name": "custom_products",
      "field_name": "code",
      "label": "Product Code",
      "sequence": 0,
      "data_type": "string",
      "is_required": true,
      "is_identifier": true,
      "transformation": "uppercase",
      "max_length": 50
    },
    {
      "indicator": "B",
      "table_name": "custom_products",
      "field_name": "name",
      "label": "Product Name",
      "sequence": 1,
      "data_type": "string",
      "is_required": true,
      "max_length": 255
    },
    {
      "indicator": "C",
      "table_name": "custom_products",
      "field_name": "price",
      "label": "Price",
      "sequence": 2,
      "data_type": "decimal",
      "is_required": true
    }
  ],
  "relationships": [
    {
      "relationship_name": "stocks",
      "related_table": "custom_stocks",
      "foreign_key": "product_id",
      "local_key": "id",
      "relationship_type": "hasMany",
      "cascade_update": true
    }
  ]
}
```

**Validation Rules:**

| Field | Rules |
|-------|-------|
| code | required, string, unique, max:50 |
| name | required, string, max:255 |
| object_code | required, string, max:50 |
| object_name | required, string, max:255 |
| primary_table | required, string, max:100 |
| type | nullable, in:import,export,both |
| file_type | nullable, in:csv,xlsx,xls,txt,xml |
| fields | required, array, min:1 |
| fields.*.indicator | required, string, max:10 |
| fields.*.table_name | required, string, max:100 |
| fields.*.field_name | required, string, max:100 |
| fields.*.label | required, string, max:255 |

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Template created successfully",
  "template": {
    "id": 5,
    "code": "IMPCUSTOM",
    "name": "Custom Product Import",
    ...
  }
}
```

**Error Response (422 Unprocessable Entity):**
```json
{
  "success": false,
  "errors": {
    "code": ["The code has already been taken."],
    "fields": ["The fields field is required."]
  }
}
```

**Use Cases:**
- Create template for new entity
- Customize existing template
- Build template from UI

---

### 4. Update Template

Update an existing template.

**Endpoint:**
```http
PUT /api/backend/templates/{id}
```

**Request Body:**
```json
{
  "name": "Updated Product Import",
  "description": "Updated description",
  "file_type": "xlsx",
  "is_active": true,
  "fields": [
    {
      "indicator": "A",
      "table_name": "products",
      "field_name": "code",
      "label": "Product Code",
      "sequence": 0,
      "data_type": "string",
      "is_required": true,
      "is_identifier": true
    }
  ]
}
```

**Note:** System templates (`is_system: true`) can only be updated by administrators.

**Response:**
```json
{
  "success": true,
  "message": "Template updated successfully",
  "template": {
    "id": 1,
    "code": "IMPPRODUCT",
    "name": "Updated Product Import",
    ...
  }
}
```

---

### 5. Delete Template

Delete a template.

**Endpoint:**
```http
DELETE /api/backend/templates/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Template deleted successfully"
}
```

**Error Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Cannot delete system template"
}
```

**Note:** System templates cannot be deleted.

---

### 6. Duplicate Template

Create a copy of an existing template.

**Endpoint:**
```http
POST /api/backend/templates/{id}/duplicate
```

**Request Body:**
```json
{
  "code": "IMPPRODUCT2",
  "name": "Product Import V2"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Template duplicated successfully",
  "template": {
    "id": 6,
    "code": "IMPPRODUCT2",
    "name": "Product Import V2",
    "is_system": false,
    ...
  }
}
```

**Use Cases:**
- Create variant of existing template
- Test template modifications
- Create department-specific templates

---

### 7. Get Template Statistics

Get usage statistics for a template.

**Endpoint:**
```http
GET /api/backend/templates/{id}/statistics
```

**Response:**
```json
{
    "success": true,
    "statistics": {
        "total_batches": 3,
        "total_imports": 3,
        "total_exports": 0,
        "successful_batches": 0,
        "failed_batches": 0,
        "total_records_processed": 0,
        "total_records_successful": 0,
        "total_records_failed": 0,
        "last_execution": null
    }
}
```

---

### 8. Get Template Versions

Retrieve version history of a template.

**Endpoint:**
```http
GET /api/backend/templates/{id}/versions
```

**Response:**
```json
{
    "success": true,
    "versions": [
        {
            "id": 13,
            "template_id": 18,
            "version_number": 1,
            "template_snapshot": {
                "code": "IMPPRODUCT",
                "name": "Product Import/Export - Complete",
                "type": "both",
                "object_code": "PRODUCT",
                "object_name": "Products",
                "primary_table": "products",
                "module": "catalog",
                "description": "Complete product import with all attributes, flags, marketing, packaging, and stock",
                "file_type": "csv",
                "field_separator": ";",
                "decimal_separator": ".",
                "date_format": "Y-m-d",
                "charset": "UTF-8",
                "record_separator": "\\n",
                "allow_import": true,
                "allow_update": true,
                "allow_workflow": false,
                "is_special_import": false,
                "allow_export": true,
                "export_chrono": 0,
                "is_active": true,
                "is_system": true,
                "created_by": null,
                "updated_at": "2025-12-19T16:03:11.000000Z",
                "created_at": "2025-12-19T16:03:11.000000Z",
                "id": 18
            },
            "fields_snapshot": [
                {
                    "id": 115,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 0,
                    "indicator": "A",
                    "table_name": "products",
                    "field_name": "code",
                    "label": "Product Code",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": true,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 50,
                    "format": null,
                    "transformation": "uppercase",
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 116,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 1,
                    "indicator": "B",
                    "table_name": "products",
                    "field_name": "name",
                    "label": "Product Name",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 255,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 117,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 2,
                    "indicator": "C",
                    "table_name": "products",
                    "field_name": "short_description",
                    "label": "Short Description",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": 500,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 118,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 3,
                    "indicator": "D",
                    "table_name": "products",
                    "field_name": "description",
                    "label": "Description",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 119,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 4,
                    "indicator": "E",
                    "table_name": "products",
                    "field_name": "price",
                    "label": "Price",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 120,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 5,
                    "indicator": "F",
                    "table_name": "products",
                    "field_name": "discount_price",
                    "label": "Discount Price",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 121,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 6,
                    "indicator": "G",
                    "table_name": "products",
                    "field_name": "quantity",
                    "label": "Quantity",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 122,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 7,
                    "indicator": "H",
                    "table_name": "products",
                    "field_name": "shop_id",
                    "label": "Shop ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": true,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 123,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 8,
                    "indicator": "I",
                    "table_name": "products",
                    "field_name": "brand_id",
                    "label": "Brand ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 124,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 9,
                    "indicator": "J",
                    "table_name": "products",
                    "field_name": "unit_id",
                    "label": "Unit ID",
                    "link": null,
                    "data_type": "integer",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 125,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 10,
                    "indicator": "K",
                    "table_name": "products",
                    "field_name": "is_active",
                    "label": "Active",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0,
                        "Y": 1,
                        "N": 0,
                        "1": 1,
                        "0": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 126,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 11,
                    "indicator": "L",
                    "table_name": "products",
                    "field_name": "is_approve",
                    "label": "Approved",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0,
                        "Y": 1,
                        "N": 0,
                        "1": 1,
                        "0": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 127,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 12,
                    "indicator": "M",
                    "table_name": "product_flags",
                    "field_name": "decimal_quantity_allowed",
                    "label": "Allow Decimal Qty",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 128,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 13,
                    "indicator": "N",
                    "table_name": "product_flags",
                    "field_name": "is_backorder_allowed",
                    "label": "Allow Backorder",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 129,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 14,
                    "indicator": "O",
                    "table_name": "product_flags",
                    "field_name": "is_discountable",
                    "label": "Discountable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 130,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 15,
                    "indicator": "P",
                    "table_name": "product_flags",
                    "field_name": "is_returnable",
                    "label": "Returnable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 131,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 16,
                    "indicator": "Q",
                    "table_name": "product_flags",
                    "field_name": "is_salable",
                    "label": "Salable",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 132,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 17,
                    "indicator": "R",
                    "table_name": "product_marketing",
                    "field_name": "is_featured",
                    "label": "Featured",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 133,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 18,
                    "indicator": "S",
                    "table_name": "product_marketing",
                    "field_name": "is_free_good",
                    "label": "Free Good",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 134,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 19,
                    "indicator": "T",
                    "table_name": "product_marketing",
                    "field_name": "is_slow_moving",
                    "label": "Slow Moving",
                    "link": null,
                    "data_type": "boolean",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": {
                        "Yes": 1,
                        "No": 0
                    },
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 135,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 20,
                    "indicator": "U",
                    "table_name": "stocks",
                    "field_name": "branch_code",
                    "label": "Branch Code",
                    "link": null,
                    "data_type": "string",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 136,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 21,
                    "indicator": "V",
                    "table_name": "stocks",
                    "field_name": "quantity",
                    "label": "Stock Quantity",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 137,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 22,
                    "indicator": "W",
                    "table_name": "stocks",
                    "field_name": "minimum_quantity",
                    "label": "Min Stock",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                },
                {
                    "id": 138,
                    "template_id": 18,
                    "level": 1,
                    "sequence": 23,
                    "indicator": "X",
                    "table_name": "stocks",
                    "field_name": "maximum_quantity",
                    "label": "Max Stock",
                    "link": null,
                    "data_type": "decimal",
                    "input_output": "both",
                    "is_required": false,
                    "is_identifier": false,
                    "is_readonly": false,
                    "validation_rule": null,
                    "default_value": null,
                    "max_length": null,
                    "format": null,
                    "transformation": null,
                    "value_mapping": null,
                    "is_visible": true,
                    "help_text": null,
                    "created_at": "2025-12-19T16:03:11.000000Z",
                    "updated_at": "2025-12-19T16:03:11.000000Z"
                }
            ],
            "change_description": "Initial version",
            "created_by": null,
            "created_at": "2025-12-19T16:03:11.000000Z",
            "updated_at": "2025-12-19T16:03:11.000000Z",
            "creator": null
        }
    ]
}
```

---

### 9. Toggle Template Status

Activate or deactivate a template.

**Endpoint:**
```http
POST /api/backend/templates/{id}/toggle-status
```

**Response:**
```json
{
  "success": true,
  "message": "Template status updated",
  "is_active": false
}
```

---

### 10. Generate Template from Table

Auto-generate a template from an existing database table.

**Endpoint:**
```http
POST /api/backend/templates/generate-from-table
```

**Request Body:**
```json
{
    "table_name": "branches",
    "code": "IMBRANCHES",
    "name": "Branche Import/Export"
}
```

**Response (201 Created):**
```json
{
    "success": true,
    "message": "Template generated successfully",
    "template": {
        "code": "IMBRANCHES",
        "name": "Branche Import/Export",
        "type": "both",
        "object_code": "BRANCHES",
        "object_name": "Branches",
        "primary_table": "branches",
        "module": "base",
        "description": null,
        "file_type": "csv",
        "field_separator": ";",
        "decimal_separator": ".",
        "date_format": "Y-m-d",
        "charset": "UTF-8",
        "record_separator": "\\n",
        "allow_import": true,
        "allow_update": true,
        "allow_workflow": false,
        "is_special_import": false,
        "allow_export": true,
        "export_chrono": 0,
        "is_active": true,
        "is_system": false,
        "created_by": 2,
        "updated_at": "2025-12-19T17:05:18.000000Z",
        "created_at": "2025-12-19T17:05:18.000000Z",
        "id": 22,
        "fields": [
            {
                "id": 158,
                "template_id": 22,
                "level": 1,
                "sequence": 0,
                "indicator": "C",
                "table_name": "branches",
                "field_name": "code",
                "label": "Code",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 159,
                "template_id": 22,
                "level": 1,
                "sequence": 1,
                "indicator": "N",
                "table_name": "branches",
                "field_name": "name",
                "label": "Name",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 160,
                "template_id": 22,
                "level": 1,
                "sequence": 2,
                "indicator": "N",
                "table_name": "branches",
                "field_name": "name_ar",
                "label": "Name Ar",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 161,
                "template_id": 22,
                "level": 1,
                "sequence": 3,
                "indicator": "G",
                "table_name": "branches",
                "field_name": "geo_area_code",
                "label": "Geo Area Code",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 162,
                "template_id": 22,
                "level": 1,
                "sequence": 4,
                "indicator": "H",
                "table_name": "branches",
                "field_name": "header1",
                "label": "Header1",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 163,
                "template_id": 22,
                "level": 1,
                "sequence": 5,
                "indicator": "H",
                "table_name": "branches",
                "field_name": "header2",
                "label": "Header2",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 164,
                "template_id": 22,
                "level": 1,
                "sequence": 6,
                "indicator": "H",
                "table_name": "branches",
                "field_name": "header3",
                "label": "Header3",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 165,
                "template_id": 22,
                "level": 1,
                "sequence": 7,
                "indicator": "F",
                "table_name": "branches",
                "field_name": "footer1",
                "label": "Footer1",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 166,
                "template_id": 22,
                "level": 1,
                "sequence": 8,
                "indicator": "F",
                "table_name": "branches",
                "field_name": "footer2",
                "label": "Footer2",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 167,
                "template_id": 22,
                "level": 1,
                "sequence": 9,
                "indicator": "F",
                "table_name": "branches",
                "field_name": "footer3",
                "label": "Footer3",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 168,
                "template_id": 22,
                "level": 1,
                "sequence": 10,
                "indicator": "P",
                "table_name": "branches",
                "field_name": "phone",
                "label": "Phone",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 169,
                "template_id": 22,
                "level": 1,
                "sequence": 11,
                "indicator": "E",
                "table_name": "branches",
                "field_name": "email",
                "label": "Email",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 170,
                "template_id": 22,
                "level": 1,
                "sequence": 12,
                "indicator": "A",
                "table_name": "branches",
                "field_name": "address",
                "label": "Address",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 171,
                "template_id": 22,
                "level": 1,
                "sequence": 13,
                "indicator": "A",
                "table_name": "branches",
                "field_name": "address_ar",
                "label": "Address Ar",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 172,
                "template_id": 22,
                "level": 1,
                "sequence": 14,
                "indicator": "L",
                "table_name": "branches",
                "field_name": "latitude",
                "label": "Latitude",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 173,
                "template_id": 22,
                "level": 1,
                "sequence": 15,
                "indicator": "L",
                "table_name": "branches",
                "field_name": "longitude",
                "label": "Longitude",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 174,
                "template_id": 22,
                "level": 1,
                "sequence": 16,
                "indicator": "R",
                "table_name": "branches",
                "field_name": "rc_number",
                "label": "Rc Number",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 175,
                "template_id": 22,
                "level": 1,
                "sequence": 17,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "if_number",
                "label": "If Number",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 176,
                "template_id": 22,
                "level": 1,
                "sequence": 18,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "ice_number",
                "label": "Ice Number",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 177,
                "template_id": 22,
                "level": 1,
                "sequence": 19,
                "indicator": "C",
                "table_name": "branches",
                "field_name": "capital_social",
                "label": "Capital Social",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 178,
                "template_id": 22,
                "level": 1,
                "sequence": 20,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "is_active",
                "label": "Is Active",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 179,
                "template_id": 22,
                "level": 1,
                "sequence": 21,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "is_warehouse",
                "label": "Is Warehouse",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 180,
                "template_id": 22,
                "level": 1,
                "sequence": 22,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "is_agency",
                "label": "Is Agency",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 181,
                "template_id": 22,
                "level": 1,
                "sequence": 23,
                "indicator": "I",
                "table_name": "branches",
                "field_name": "is_depot",
                "label": "Is Depot",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 182,
                "template_id": 22,
                "level": 1,
                "sequence": 24,
                "indicator": "S",
                "table_name": "branches",
                "field_name": "sort_order",
                "label": "Sort Order",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 183,
                "template_id": 22,
                "level": 1,
                "sequence": 25,
                "indicator": "W",
                "table_name": "branches",
                "field_name": "warehouse_code",
                "label": "Warehouse Code",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            },
            {
                "id": 184,
                "template_id": 22,
                "level": 1,
                "sequence": 26,
                "indicator": "C",
                "table_name": "branches",
                "field_name": "company_id",
                "label": "Company Id",
                "link": null,
                "data_type": "string",
                "input_output": "both",
                "is_required": false,
                "is_identifier": false,
                "is_readonly": false,
                "validation_rule": null,
                "default_value": null,
                "max_length": null,
                "format": null,
                "transformation": null,
                "value_mapping": null,
                "is_visible": true,
                "help_text": null,
                "created_at": "2025-12-19T17:05:18.000000Z",
                "updated_at": "2025-12-19T17:05:18.000000Z"
            }
        ],
        "relationships": []
    }
}
```

**Use Cases:**
- Quick template creation
- Reverse engineering existing tables
- Database migration

---

## Import Operations API

### 1. Upload Import File

Upload a file for import.

**Endpoint:**
```http
POST /api/backend/dynamic-import-export/upload
```

**Request:**
```http
Content-Type: multipart/form-data

template_code: IMPPRODUCT
file: [Binary file data]
```

**Supported File Types:**
- `.xlsx` - Excel 2007+
- `.xls` - Excel 97-2003
- `.csv` - Comma/semicolon separated
- `.txt` - Text file

**Max File Size:** 20MB

**Response:**
```json
{
  "success": true,
  "file_path": "imports/templates/IMPPRODUCT/1734518400_products.csv",
  "filename": "1734518400_products.csv",
  "message": "File uploaded successfully"
}
```

**cURL Example:**
```bash
curl -X POST \
  https://yourdomain.com/api/backend/dynamic-import-export/upload \
  -H 'Authorization: Bearer {token}' \
  -F 'template_code=IMPPRODUCT' \
  -F 'file=@/path/to/products.csv'
```

**JavaScript Example:**
```javascript
const formData = new FormData();
formData.append('template_code', 'IMPPRODUCT');
formData.append('file', fileInput.files[0]);

const response = await fetch('/api/backend/dynamic-import-export/upload', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});

const data = await response.json();
console.log('File uploaded:', data.file_path);
```

---

### 2. Start Import Process

Initiate the import process.

**Endpoint:**
```http
POST /api/backend/dynamic-import-export/import/start
```

**Request Body:**
```json
{
  "template_code": "IMPPRODUCT",
  "file_path": "imports/templates/IMPPRODUCT/1734518400_products.csv",
  "options": {
    "update_existing": true,
    "skip_errors": false,
    "validate_only": false,
    "batch_size": 100
  },
  "use_queue": true
}
```

**Options Explained:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| update_existing | boolean | true | Update existing records or skip duplicates |
| skip_errors | boolean | false | Continue on errors or stop immediately |
| validate_only | boolean | false | Only validate, don't import |
| batch_size | integer | 100 | Records per transaction |

**Response (Queued):**
```json
{
  "success": true,
  "message": "Import queued for processing",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

**Response (Synchronous):**
```json
{
  "success": true,
  "message": "Import completed",
  "batch_id": "550e8400-e29b-41d4-a716-446655440000",
  "summary": {
    "batch_id": "550e8400...",
    "template": "Product Import/Export",
    "status": "completed",
    "total_records": 1000,
    "processed_records": 1000,
    "successful_records": 950,
    "failed_records": 30,
    "skipped_records": 20,
    "created_records": 800,
    "updated_records": 150,
    "progress_percentage": 100,
    "success_rate": 95,
    "started_at": "2025-12-18T10:00:00Z",
    "completed_at": "2025-12-18T10:05:30Z",
    "execution_time": 330
  }
}
```

**Complete Example:**
```javascript
// 1. Upload file
const uploadResponse = await fetch('/api/backend/dynamic-import-export/upload', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token },
  body: formData
});
const uploadData = await uploadResponse.json();

// 2. Start import
const importResponse = await fetch('/api/backend/dynamic-import-export/import/start', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    template_code: 'IMPPRODUCT',
    file_path: uploadData.file_path,
    options: {
      update_existing: true,
      skip_errors: false
    },
    use_queue: true
  })
});
const importData = await importResponse.json();
console.log('Import started:', importData.batch_id);
```

---

### 3. Get Import Status

Check the status of an import batch.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/import/{batchId}/status
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "550e8400-e29b-41d4-a716-446655440000",
    "template": "Product Import/Export",
    "operation_type": "import",
    "status": "processing",
    "filename": "products.csv",
    "total_records": 1000,
    "processed_records": 750,
    "successful_records": 700,
    "failed_records": 30,
    "skipped_records": 20,
    "created_records": 600,
    "updated_records": 100,
    "progress_percentage": 75,
    "success_rate": 93.33,
    "started_at": "2025-12-18T10:00:00Z",
    "completed_at": null,
    "execution_time": null,
    "error_summary": null
  }
}
```

**Polling Example:**
```javascript
const pollStatus = setInterval(async () => {
  const response = await fetch(
    `/api/backend/dynamic-import-export/import/${batchId}/status`,
    { headers: { 'Authorization': 'Bearer ' + token } }
  );
  
  const data = await response.json();
  
  // Update progress bar
  updateProgress(data.batch.progress_percentage);
  
  if (data.batch.status === 'completed') {
    clearInterval(pollStatus);
    showSuccess(data.batch);
  } else if (data.batch.status === 'failed') {
    clearInterval(pollStatus);
    showError(data.batch.error_summary);
  }
}, 2000); // Poll every 2 seconds
```

---

### 4. Get Import Logs

Retrieve detailed logs for an import batch.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/import/{batchId}/logs
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: `success`, `failed`, `skipped`, `warning` |
| per_page | integer | Items per page (default: 50, max: 100) |
| page | integer | Page number |

**Example Request:**
```http
GET /api/backend/dynamic-import-export/import/550e8400.../logs?status=failed&per_page=50&page=1
```

**Response:**
```json
{
  "success": true,
  "logs": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "record_number": 5,
        "record_identifier": "PROD001",
        "status": "failed",
        "action": null,
        "product_id": null,
        "record_data": {
          "code": "PROD001",
          "name": "Laptop",
          "price": "invalid_price"
        },
        "processed_data": null,
        "errors": {
          "price": "The price must be a number."
        },
        "warnings": null,
        "message": "Validation failed",
        "affected_tables": null,
        "affected_records": null,
        "created_at": "2025-12-18T10:01:00Z"
      },
      {
        "id": 2,
        "record_number": 10,
        "record_identifier": "PROD002",
        "status": "success",
        "action": "created",
        "product_id": 123,
        "record_data": {
          "code": "PROD002",
          "name": "Mouse",
          "price": "25.00"
        },
        "processed_data": {
          "products": {
            "code": "PROD002",
            "name": "Mouse",
            "price": 25.00
          }
        },
        "errors": null,
        "warnings": {
          "stock": "Stock created for branch: MAIN"
        },
        "message": "Product created successfully",
        "affected_tables": ["products", "stocks"],
        "affected_records": [123, 456],
        "created_at": "2025-12-18T10:01:05Z"
      }
    ],
    "total": 30,
    "per_page": 50,
    "last_page": 1,
    "from": 1,
    "to": 30
  }
}
```

---

### 5. Download Error Report

Download a CSV file containing all failed records.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/import/{batchId}/error-report
```

**Response:** CSV file download

**CSV Format:**
```csv
Record Number,Identifier,Status,Errors,Message
5,PROD001,failed,"{""price"":""The price must be a number.""}","Validation failed"
15,PROD003,failed,"{""code"":""The code has already been taken.""}","Duplicate record"
```

**JavaScript Download:**
```javascript
const downloadErrorReport = (batchId) => {
  window.location.href = `/api/backend/dynamic-import-export/import/${batchId}/error-report`;
};
```

---

## Export Operations API

### 1. Start Export Process

Initiate an export operation.

**Endpoint:**
```http
POST /api/backend/dynamic-import-export/export/start
```

**Request Body:**
```json
{
  "template_code": "IMPPRODUCT",
  "filters": {
    "is_active": true,
    "is_approve": true,
    "brand_id": [1, 2, 3],
    "category_id": [5, 6],
    "price_min": 50,
    "price_max": 500,
    "search": "laptop",
    "has_stock": true,
    "created_from": "2025-01-01",
    "created_to": "2025-12-31"
  },
  "options": {
    "format": "xlsx",
    "include_headers": true,
    "batch_size": 1000
  },
  "use_queue": true
}
```

**Filters Explained:**

| Filter | Type | Description |
|--------|------|-------------|
| is_active | boolean | Active products only |
| is_approve | boolean | Approved products only |
| brand_id | array | Filter by brand IDs |
| category_id | array | Filter by category IDs |
| price_min | number | Minimum price |
| price_max | number | Maximum price |
| search | string | Search in name/code |
| has_stock | boolean | Products with stock |
| created_from | date | Created after date |
| created_to | date | Created before date |

**Response (Queued):**
```json
{
  "success": true,
  "message": "Export queued for processing",
  "batch_id": "660e8400-e29b-41d4-a716-446655440001",
  "status": "queued"
}
```

---

### 2. Get Export Status

Check the status of an export batch.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/export/{batchId}/status
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "660e8400-e29b-41d4-a716-446655440001",
    "template": "Product Import/Export",
    "operation_type": "export",
    "status": "completed",
    "filename": "IMPPRODUCT_20251218_100000.xlsx",
    "format": "xlsx",
    "total_records": 500,
    "processed_records": 500,
    "successful_records": 500,
    "file_path": "exports/templates/IMPPRODUCT_20251218_100000.xlsx",
    "download_url": "/api/backend/dynamic-import-export/export/660e8400.../download",
    "started_at": "2025-12-18T10:00:00Z",
    "completed_at": "2025-12-18T10:02:30Z",
    "execution_time": 150
  }
}
```

---

### 3. Download Export File

Download the exported file.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/export/{batchId}/download
```

**Response:** File download (Excel or CSV)

**JavaScript Example:**
```javascript
const downloadExport = (batchId) => {
  window.location.href = `/api/backend/dynamic-import-export/export/${batchId}/download`;
};
```

---

## Batch Management API

### 1. List All Batches

Retrieve a list of all import/export batches.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/batches
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| operation_type | string | `import` or `export` |
| template_id | integer | Filter by template |
| status | string | `pending`, `processing`, `completed`, `failed` |
| user_id | integer | Filter by user |
| per_page | integer | Items per page (default: 20) |

**Example Request:**
```http
GET /api/backend/dynamic-import-export/batches?operation_type=import&status=completed&per_page=20
```

**Response:**
```json
{
  "success": true,
  "batches": {
    "current_page": 1,
    "data": [
      {
        "id": 1,
        "batch_id": "550e8400...",
        "template": {
          "id": 1,
          "code": "IMPPRODUCT",
          "name": "Product Import/Export"
        },
        "operation_type": "import",
        "filename": "products.csv",
        "status": "completed",
        "total_records": 1000,
        "successful_records": 950,
        "failed_records": 30,
        "user": {
          "id": 1,
          "name": "Admin User"
        },
        "created_at": "2025-12-18T10:00:00Z",
        "completed_at": "2025-12-18T10:05:30Z"
      }
    ],
    "total": 50,
    "per_page": 20,
    "last_page": 3
  }
}
```

---

### 2. Delete Batch

Delete a batch and its associated file.

**Endpoint:**
```http
DELETE /api/backend/dynamic-import-export/batches/{batchId}
```

**Response:**
```json
{
  "success": true,
  "message": "Batch deleted successfully"
}
```

---

## Statistics API

### Get Overall Statistics

Retrieve overall import/export statistics.

**Endpoint:**
```http
GET /api/backend/dynamic-import-export/statistics
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| template_id | integer | Filter by template |

**Response:**
```json
{
  "success": true,
  "statistics": {
    "imports": {
      "total": 50,
      "completed": 45,
      "failed": 3,
      "processing": 2,
      "total_records_processed": 50000,
      "total_records_successful": 48500,
      "total_records_failed": 1500
    },
    "exports": {
      "total": 30,
      "completed": 29,
      "failed": 1,
      "processing": 0,
      "total_records_exported": 75000
    }
  }
}
```

---

## Error Handling

### Validation Errors (422)

```json
{
  "success": false,
  "errors": {
    "template_code": ["The template code field is required."],
    "file": ["The file must be a file of type: xlsx, csv."]
  }
}
```

### Not Found (404)

```json
{
  "success": false,
  "message": "Template not found"
}
```

### Forbidden (403)

```json
{
  "success": false,
  "message": "Cannot delete system template"
}
```

### Server Error (500)

```json
{
  "success": false,
  "message": "Import failed: Unexpected error occurred"
}
```

---

## Rate Limiting

| Endpoint Category | Limit |
|-------------------|-------|
| Template Management | 60 requests/minute |
| File Upload | 10 requests/minute |
| Import/Export Start | 5 requests/minute |
| Status Checks | 120 requests/minute |
| Other Endpoints | 60 requests/minute |

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1734518460
```

---

## Complete Examples

### Full Import Workflow

```javascript
async function importProducts(file) {
  const token = localStorage.getItem('auth_token');
  
  try {
    // 1. Upload file
    const formData = new FormData();
    formData.append('template_code', 'IMPPRODUCT');
    formData.append('file', file);
    
    const uploadResponse = await fetch('/api/backend/dynamic-import-export/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (!uploadResponse.ok) throw new Error('Upload failed');
    const uploadData = await uploadResponse.json();
    
    // 2. Start import
    const importResponse = await fetch('/api/backend/dynamic-import-export/import/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_code: 'IMPPRODUCT',
        file_path: uploadData.file_path,
        options: {
          update_existing: true,
          skip_errors: false
        },
        use_queue: true
      })
    });
    
    if (!importResponse.ok) throw new Error('Import start failed');
    const importData = await importResponse.json();
    const batchId = importData.batch_id;
    
    // 3. Poll for status
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(
          `/api/backend/dynamic-import-export/import/${batchId}/status`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        const statusData = await statusResponse.json();
        
        // Update UI
        updateProgressBar(statusData.batch.progress_percentage);
        
        if (statusData.batch.status === 'completed') {
          clearInterval(pollInterval);
          resolve(statusData.batch);
        } else if (statusData.batch.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error(statusData.batch.error_summary));
        }
      }, 2000);
    });
    
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}

// Usage
const fileInput = document.getElementById('file-input');
importProducts(fileInput.files[0])
  .then(result => {
    console.log('Import completed:', result);
    alert(`Imported ${result.successful_records} products successfully!`);
  })
  .catch(error => {
    console.error('Import failed:', error);
    alert('Import failed: ' + error.message);
  });
```

### Full Export Workflow

```javascript
async function exportProducts(filters) {
  const token = localStorage.getItem('auth_token');
  
  try {
    // 1. Start export
    const exportResponse = await fetch('/api/backend/dynamic-import-export/export/start', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template_code: 'IMPPRODUCT',
        filters: filters,
        options: {
          format: 'xlsx',
          include_headers: true
        },
        use_queue: true
      })
    });
    
    if (!exportResponse.ok) throw new Error('Export start failed');
    const exportData = await exportResponse.json();
    const batchId = exportData.batch_id;
    
    // 2. Poll for completion
    return new Promise((resolve, reject) => {
      const pollInterval = setInterval(async () => {
        const statusResponse = await fetch(
          `/api/backend/dynamic-import-export/export/${batchId}/status`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        
        const statusData = await statusResponse.json();
        
        if (statusData.batch.status === 'completed') {
          clearInterval(pollInterval);
          
          // 3. Download file
          window.location.href = `/api/backend/dynamic-import-export/export/${batchId}/download`;
          
          resolve(statusData.batch);
        } else if (statusData.batch.status === 'failed') {
          clearInterval(pollInterval);
          reject(new Error(statusData.batch.error_summary));
        }
      }, 2000);
    });
    
  } catch (error) {
    console.error('Export error:', error);
    throw error;
  }
}

// Usage
exportProducts({
  is_active: true,
  brand_id: [1, 2, 3],
  price_min: 50,
  price_max: 500
})
  .then(result => {
    console.log('Export completed:', result);
    alert(`Exported ${result.total_records} products successfully!`);
  })
  .catch(error => {
    console.error('Export failed:', error);
    alert('Export failed: ' + error.message);
  });
```

---

**Version:** 1.0.0  
**Last Updated:** December 18, 2025  
**Status:** ✅ Production Ready
