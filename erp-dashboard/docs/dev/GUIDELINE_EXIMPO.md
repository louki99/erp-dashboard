# Complete Import/Export System Guide (EXIMPO)

**Professional Enterprise-Grade Dynamic Import/Export System**  
*Inspired by Sage X3 Data Management Capabilities*

---

## 📚 Table of Contents

### Part 1: System Overview
1. [Introduction](#1-introduction)
2. [Core Concepts](#2-core-concepts)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)

### Part 2: Template System
5. [Template Management](#5-template-management)
6. [Field Configuration](#6-field-configuration)
7. [Relationship Mapping](#7-relationship-mapping)
8. [Validation Rules](#8-validation-rules)

### Part 3: Operations
9. [Import Process](#9-import-process)
10. [Export Process](#10-export-process)
11. [Batch Management](#11-batch-management)
12. [Error Handling](#12-error-handling)

### Part 4: REST API Reference
13. [Authentication](#13-authentication)
14. [Template API](#14-template-api)
15. [Import API](#15-import-api)
16. [Export API](#16-export-api)
17. [Metadata API](#17-metadata-api)
18. [Statistics API](#18-statistics-api)

### Part 5: Practical Guide
19. [Quick Start](#19-quick-start)
20. [cURL Examples](#20-curl-examples)
21. [Real-World Scenarios](#21-real-world-scenarios)
22. [Best Practices](#22-best-practices)
23. [Troubleshooting](#23-troubleshooting)

---

# Part 1: System Overview

## 1. Introduction

### 1.1 What is EXIMPO?

EXIMPO is a **professional, enterprise-grade dynamic import/export system** that provides a **flexible, template-based approach** for managing data across **any database table** without writing custom code.

### 1.2 The Problem It Solves

**Traditional Import/Export Challenges:**

❌ **Hardcoded Solutions**
- Each entity requires separate import code
- Developers must write new code for each entity
- Changes require code deployment

❌ **Limited Flexibility**
- Fixed column mappings
- No support for different file formats
- Cannot handle related tables
- Difficult to customize

❌ **Poor Error Handling**
- All-or-nothing imports
- No detailed error tracking
- Difficult to identify failed records
- No recovery mechanism

❌ **Scalability Issues**
- Timeouts on large files
- No background processing
- Memory limitations

### 1.3 EXIMPO Solution

✅ **Template-Based Configuration**
- Configure once, use forever
- Business users can create templates
- Works with any table structure
- Dynamic field mapping

✅ **Multi-Table Operations**
- Import related data in single operation
- Automatic relationship handling
- Cascade updates support

✅ **Comprehensive Error Tracking**
- Record-level error logging
- Detailed error messages
- Downloadable error reports
- Partial success handling

✅ **Enterprise Features**
- Asynchronous processing
- Queue-based architecture
- Real-time status tracking
- Audit trail

### 1.4 Key Capabilities

**1. Universal Data Management**
- Import/export **any database table** without coding
- Support for **multiple file formats** (CSV, Excel, Text)
- **Multi-table operations** in single import
- **Relationship management** between entities

**2. Flexible Template System**
- Define field mappings visually
- Support for data transformations
- Value mapping (e.g., "Yes" → 1)
- Conditional logic

**3. Professional Error Handling**
- Record-level error tracking
- Continue on error (skip failed records)
- Detailed error reports
- Validation before import

**4. Performance & Scalability**
- Asynchronous queue processing
- Handles large files (millions of records)
- Progress tracking
- Batch processing

**5. Audit & Compliance**
- Complete audit trail
- User tracking
- Timestamp tracking
- Change history

---

## 2. Core Concepts

### 2.1 Templates

A **template** is a reusable configuration that defines:
- Which table(s) to import/export
- Which fields to include
- How to map CSV columns to database columns
- Validation rules
- Relationships between tables

**Example:** Product Import Template
```
Template Code: IMPPRODUCT
Primary Table: products
Fields:
  - A: Product Code → products.code
  - B: Product Name → products.name
  - C: Price → products.price
  - D: Brand ID → products.brand_id
Relationships:
  - stocks (hasMany)
  - product_flags (hasOne)
```

### 2.2 Batches

A **batch** represents a single import/export operation:
- Unique batch ID
- Status tracking (queued, processing, completed, failed)
- Statistics (total records, successful, failed)
- Execution time
- File path

### 2.3 Batch Logs

**Batch logs** track individual record processing:
- Record number
- Record identifier (e.g., product code)
- Status (success, failed, skipped, warning)
- Error messages
- Affected tables and records

### 2.4 Field Mapping

**Field mapping** connects CSV columns to database columns:
- **Indicator**: Column letter (A, B, C...)
- **Table Name**: Target database table
- **Field Name**: Target column name
- **Label**: Human-readable name
- **Data Type**: string, integer, decimal, boolean, date
- **Required**: Whether field is mandatory
- **Identifier**: Whether field uniquely identifies record

### 2.5 Relationships

**Relationships** define how to handle related tables:
- **hasMany**: One-to-many (e.g., product → stocks)
- **hasOne**: One-to-one (e.g., product → product_flags)
- **belongsTo**: Many-to-one (e.g., product → brand)
- **Cascade Update**: Whether to update related records

### 2.6 Value Mapping

**Value mapping** transforms CSV values to database values:
```json
{
  "Yes": 1,
  "No": 0,
  "Y": 1,
  "N": 0,
  "Active": true,
  "Inactive": false
}
```

---

## 3. System Architecture

### 3.1 High-Level Architecture

```
┌─────────────────┐
│   Client/UI     │
│  (Web/Mobile)   │
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│   Controllers   │
│  (API Layer)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Services     │
│  (Business      │
│   Logic)        │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ Queue  │ │Database│
│ Jobs   │ │ Models │
└────────┘ └────────┘
```

### 3.2 Component Breakdown

**1. Controllers**
- `DynamicImportExportController`: Main API endpoints
- Handle HTTP requests/responses
- Validation
- Authentication

**2. Services**
- `DynamicImportService`: Import logic
- `DynamicExportService`: Export logic
- `TemplateManagerService`: Template management

**3. Jobs**
- `ProcessDynamicImport`: Async import processing
- `ProcessDynamicExport`: Async export processing

**4. Models**
- `ImportExportTemplate`: Template configuration
- `ImportExportBatch`: Batch tracking
- `BatchLog`: Record-level logs
- `TemplateField`: Field definitions
- `TemplateRelationship`: Relationship definitions

### 3.3 Processing Flow

**Import Flow:**
```
1. Upload File → Store in storage
2. Create Batch → Initialize tracking
3. Dispatch Job → Queue for processing
4. Read File → Parse CSV/Excel
5. Process Records → Loop through rows
   a. Validate data
   b. Map fields
   c. Insert/Update database
   d. Log results
6. Complete Batch → Update statistics
7. Notify User → Send notification
```

**Export Flow:**
```
1. Create Batch → Initialize tracking
2. Dispatch Job → Queue for processing
3. Query Data → Fetch records with filters
4. Map Fields → Database → CSV columns
5. Generate File → Write to storage
6. Complete Batch → Update statistics
7. Provide Download → Return file URL
```

### 3.4 Queue Architecture

```
┌──────────────┐
│ Web Request  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Create Batch │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Dispatch Job │
│  to Queue    │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Queue Worker  │
│  Processes   │
│     Job      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Update Batch  │
│   Status     │
└──────────────┘
```

---

## 4. Database Schema

### 4.1 import_export_templates

**Purpose:** Store template configurations

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| code | varchar(50) | Unique template code (e.g., IMPPRODUCT) |
| name | varchar(255) | Template name |
| type | varchar(20) | import, export, both |
| object_code | varchar(50) | Object identifier |
| object_name | varchar(255) | Object display name |
| primary_table | varchar(100) | Main database table |
| module | varchar(50) | Module name (catalog, sales, etc.) |
| description | text | Template description |
| file_type | varchar(10) | csv, xlsx, txt |
| field_separator | varchar(5) | CSV separator (;, ,, \t) |
| allow_import | boolean | Enable import |
| allow_update | boolean | Enable update existing |
| allow_export | boolean | Enable export |
| is_system | boolean | System template (cannot delete) |
| is_active | boolean | Active status |
| version | integer | Version number |
| created_by | integer | User ID |
| updated_by | integer | User ID |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Update time |
| deleted_at | timestamp | Soft delete |

**Indexes:**
- Unique: code
- Index: primary_table, module, type

### 4.2 template_fields

**Purpose:** Define field mappings

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| template_id | integer | Foreign key to templates |
| indicator | varchar(10) | Column indicator (A, B, C...) |
| table_name | varchar(100) | Target table |
| field_name | varchar(100) | Target column |
| label | varchar(255) | Display label |
| sequence | integer | Field order |
| data_type | varchar(50) | string, integer, decimal, boolean, date |
| max_length | integer | Maximum length |
| is_required | boolean | Required field |
| is_identifier | boolean | Unique identifier |
| is_readonly | boolean | Read-only (export only) |
| default_value | text | Default value |
| value_mapping | json | Value transformation map |
| validation_rules | json | Validation rules |
| help_text | text | Help text |

**Indexes:**
- Foreign key: template_id
- Index: table_name, field_name

### 4.3 template_relationships

**Purpose:** Define table relationships

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| template_id | integer | Foreign key to templates |
| relationship_name | varchar(100) | Relationship name |
| related_table | varchar(100) | Related table name |
| foreign_key | varchar(100) | Foreign key column |
| relationship_type | varchar(50) | hasMany, hasOne, belongsTo |
| cascade_update | boolean | Update related records |
| cascade_delete | boolean | Delete related records |

### 4.4 import_export_batches

**Purpose:** Track import/export operations

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| batch_id | uuid | Unique batch identifier |
| template_id | integer | Foreign key to templates |
| operation_type | varchar(20) | import, export |
| status | varchar(50) | queued, processing, completed, failed |
| filename | varchar(255) | Original filename |
| file_path | varchar(500) | Storage path |
| total_records | integer | Total records |
| processed_records | integer | Processed count |
| successful_records | integer | Success count |
| failed_records | integer | Failed count |
| skipped_records | integer | Skipped count |
| options | json | Operation options |
| started_at | timestamp | Start time |
| completed_at | timestamp | Completion time |
| execution_time | integer | Duration in seconds |
| error_summary | text | Error summary |
| user_id | integer | User who initiated |
| created_at | timestamp | Creation time |
| updated_at | timestamp | Update time |

**Indexes:**
- Unique: batch_id
- Foreign key: template_id, user_id
- Index: status, operation_type, created_at

### 4.5 batch_logs

**Purpose:** Record-level processing logs

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| batch_id | integer | Foreign key to batches |
| record_number | integer | Row number in file |
| record_identifier | varchar(255) | Record unique ID |
| status | varchar(50) | success, failed, skipped, warning, updated, created |
| message | text | Status message |
| errors | json | Error details |
| warnings | json | Warning messages |
| record_data | json | Original record data |
| affected_tables | json | Modified tables |
| affected_records | json | Modified record IDs |
| processing_time | integer | Processing time (ms) |
| created_at | timestamp | Log time |

**Indexes:**
- Foreign key: batch_id
- Index: status, record_number

**Check Constraint:**
```sql
CHECK (status IN ('success', 'failed', 'skipped', 'warning', 'updated', 'created'))
```

---

## 5. Template Management

### 5.1 Creating a Template

**Manual Creation (Database):**

```php
use App\Services\TemplateManagerService;

$templateManager = new TemplateManagerService();

$template = $templateManager->createTemplate([
    'code' => 'IMPPRODUCT',
    'name' => 'Product Import/Export',
    'type' => 'both',
    'object_code' => 'PRODUCT',
    'object_name' => 'Products',
    'primary_table' => 'products',
    'module' => 'catalog',
    'description' => 'Import and export products with all attributes',
    'file_type' => 'csv',
    'field_separator' => ';',
    'allow_import' => true,
    'allow_update' => true,
    'allow_export' => true,
    'is_system' => true,
    'fields' => [
        [
            'indicator' => 'A',
            'table_name' => 'products',
            'field_name' => 'code',
            'label' => 'Product Code',
            'sequence' => 0,
            'data_type' => 'string',
            'is_required' => true,
            'is_identifier' => true
        ],
        [
            'indicator' => 'B',
            'table_name' => 'products',
            'field_name' => 'name',
            'label' => 'Product Name',
            'sequence' => 1,
            'data_type' => 'string',
            'is_required' => true
        ],
        [
            'indicator' => 'C',
            'table_name' => 'products',
            'field_name' => 'price',
            'label' => 'Price',
            'sequence' => 2,
            'data_type' => 'decimal',
            'is_required' => true
        ]
    ],
    'relationships' => [
        [
            'relationship_name' => 'stocks',
            'related_table' => 'stocks',
            'foreign_key' => 'product_id',
            'relationship_type' => 'hasMany',
            'cascade_update' => true
        ]
    ]
]);
```

### 5.2 Template via API

**Create Template:**
```bash
POST /api/backend/templates
```

**Request Body:**
```json
{
  "code": "IMPPRODUCT",
  "name": "Product Import",
  "type": "import",
  "primary_table": "products",
  "file_type": "csv",
  "field_separator": ";",
  "fields": [
    {
      "indicator": "A",
      "table_name": "products",
      "field_name": "code",
      "label": "Product Code",
      "data_type": "string",
      "is_required": true,
      "is_identifier": true
    }
  ]
}
```

### 5.3 Template Best Practices

**1. Naming Conventions**
- Code: `IMP` + TABLE_NAME (e.g., IMPPRODUCT, IMPCUSTOMER)
- Name: Descriptive (e.g., "Product Import with Stock")

**2. Field Organization**
- Order fields logically
- Group related fields
- Put required fields first
- Use clear labels

**3. Identifier Fields**
- Always have at least one identifier
- Use unique fields (code, email, etc.)
- Required for update operations

**4. Relationships**
- Define all related tables
- Use cascade_update carefully
- Consider data integrity

---

## 6. Field Configuration

### 6.1 Data Types

**Supported Types:**

| Type | Description | Example |
|------|-------------|---------|
| string | Text data | "Product Name" |
| integer | Whole numbers | 100 |
| decimal | Decimal numbers | 99.99 |
| boolean | True/False | true, false, 1, 0, Yes, No |
| date | Date values | 2024-12-20, 20/12/2024 |
| datetime | Date with time | 2024-12-20 14:30:00 |
| json | JSON data | {"key": "value"} |

### 6.2 Value Mapping

Transform CSV values to database values:

```json
{
  "value_mapping": {
    "Yes": 1,
    "No": 0,
    "Y": 1,
    "N": 0,
    "Active": true,
    "Inactive": false,
    "Oui": 1,
    "Non": 0
  }
}
```

**Usage Example:**
```
CSV: Active
Database: true (boolean)

CSV: Yes
Database: 1 (integer)
```

### 6.3 Validation Rules

**Available Rules:**

```json
{
  "validation_rules": {
    "required": true,
    "min": 0,
    "max": 999999,
    "min_length": 3,
    "max_length": 50,
    "regex": "^[A-Z0-9]+$",
    "in": ["option1", "option2"],
    "unique": true,
    "exists": "brands,id"
  }
}
```

**Examples:**

**Product Code Validation:**
```json
{
  "required": true,
  "min_length": 3,
  "max_length": 20,
  "regex": "^[A-Z0-9-]+$",
  "unique": true
}
```

**Price Validation:**
```json
{
  "required": true,
  "min": 0,
  "max": 999999.99
}
```

**Brand ID Validation:**
```json
{
  "required": false,
  "exists": "brands,id"
}
```

### 6.4 Default Values

Set default values for optional fields:

```json
{
  "default_value": "0"
}
```

**Examples:**
- `is_active`: Default to `true`
- `quantity`: Default to `0`
- `discount_price`: Default to `0.00`

---

## 7. Relationship Mapping

### 7.1 Relationship Types

**1. hasMany (One-to-Many)**

Example: Product → Stocks

```json
{
  "relationship_name": "stocks",
  "related_table": "stocks",
  "foreign_key": "product_id",
  "relationship_type": "hasMany",
  "cascade_update": true
}
```

**CSV Structure:**
```csv
Product Code;Product Name;Stock Branch;Stock Quantity
PROD001;Product 1;A0001;100
```

**Result:**
- Creates product record
- Creates stock record with `product_id` = product.id

**2. hasOne (One-to-One)**

Example: Product → Product Flags

```json
{
  "relationship_name": "product_flags",
  "related_table": "product_flags",
  "foreign_key": "product_id",
  "relationship_type": "hasOne",
  "cascade_update": true
}
```

**3. belongsTo (Many-to-One)**

Example: Product → Brand

```json
{
  "relationship_name": "brand",
  "related_table": "brands",
  "foreign_key": "brand_id",
  "relationship_type": "belongsTo"
}
```

### 7.2 Multi-Table Import

**Example: Product with Related Tables**

**Template Configuration:**
```
Primary Table: products
Related Tables:
  - product_flags (hasOne)
  - product_marketing (hasOne)
  - stocks (hasMany)
```

**CSV Structure:**
```csv
Code;Name;Price;Featured;Promotion;Stock Branch;Stock Qty
PROD001;Product 1;99.99;Yes;No;A0001;100
```

**Field Mapping:**
```
A (Code) → products.code
B (Name) → products.name
C (Price) → products.price
D (Featured) → product_flags.is_featured
E (Promotion) → product_marketing.is_on_promotion
F (Stock Branch) → stocks.branch_code
G (Stock Qty) → stocks.quantity
```

**Processing:**
1. Insert into `products` → Get product_id
2. Insert into `product_flags` with product_id
3. Insert into `product_marketing` with product_id
4. Insert into `stocks` with product_id

### 7.3 Cascade Operations

**cascade_update: true**
- Updates related records if they exist
- Creates if they don't exist

**cascade_update: false**
- Only creates new related records
- Skips if related record exists

---

## 8. Validation Rules

### 8.1 Field-Level Validation

**Required Fields:**
```json
{
  "is_required": true
}
```

**Data Type Validation:**
- Automatic based on `data_type`
- Converts values to correct type
- Validates format

**Length Validation:**
```json
{
  "max_length": 255
}
```

**Range Validation:**
```json
{
  "validation_rules": {
    "min": 0,
    "max": 999999
  }
}
```

### 8.2 Unique Validation

**Check for Duplicates:**
```json
{
  "validation_rules": {
    "unique": true
  }
}
```

**Composite Unique:**
```json
{
  "validation_rules": {
    "unique": "table_name,column1,column2"
  }
}
```

### 8.3 Foreign Key Validation

**Validate Reference Exists:**
```json
{
  "validation_rules": {
    "exists": "brands,id"
  }
}
```

**Example:**
- Field: `brand_id`
- Validation: Check if brand with this ID exists in `brands` table

### 8.4 Custom Validation

**Regex Pattern:**
```json
{
  "validation_rules": {
    "regex": "^[A-Z]{3}[0-9]{3}$"
  }
}
```

**Enum Values:**
```json
{
  "validation_rules": {
    "in": ["active", "inactive", "pending"]
  }
}
```

---

# Part 3: Operations

## 9. Import Process

### 9.1 Import Workflow

**Step-by-Step Process:**

```
1. File Upload
   ↓
2. Validation (file type, size, template)
   ↓
3. Batch Creation (initialize tracking)
   ↓
4. Queue Job (async processing)
   ↓
5. File Reading (parse CSV/Excel)
   ↓
6. Record Processing Loop:
   a. Read row
   b. Map fields
   c. Validate data
   d. Check identifier (update vs create)
   e. Insert/Update primary table
   f. Process relationships
   g. Log result
   ↓
7. Batch Completion (update statistics)
   ↓
8. Notification (email/webhook)
```

### 9.2 Import Options

**Available Options:**

```json
{
  "update_existing": true,
  "skip_errors": true,
  "validate_only": false,
  "batch_size": 100,
  "notify_on_completion": true
}
```

**Option Details:**

| Option | Type | Description |
|--------|------|-------------|
| update_existing | boolean | Update records if identifier exists |
| skip_errors | boolean | Continue processing on errors |
| validate_only | boolean | Validate without importing |
| batch_size | integer | Records per batch |
| notify_on_completion | boolean | Send notification when done |

### 9.3 Update vs Create Logic

**Identifier-Based Logic:**

```php
// Check if record exists
$existingRecord = DB::table($primaryTable)
    ->where($identifierField, $identifierValue)
    ->first();

if ($existingRecord && $options['update_existing']) {
    // Update existing record
    DB::table($primaryTable)
        ->where('id', $existingRecord->id)
        ->update($data);
    $status = 'updated';
} else if (!$existingRecord) {
    // Create new record
    $id = DB::table($primaryTable)->insertGetId($data);
    $status = 'created';
} else {
    // Skip (exists but update not allowed)
    $status = 'skipped';
}
```

### 9.4 Error Handling During Import

**Record-Level Errors:**
- Validation failures
- Database constraints
- Missing required fields
- Invalid data types

**Handling Strategy:**

```php
try {
    // Process record
    $this->processRecord($row);
    $log->update(['status' => 'success']);
} catch (\Exception $e) {
    $log->update([
        'status' => 'failed',
        'message' => $e->getMessage(),
        'errors' => ['exception' => $e->getMessage()]
    ]);
    
    if (!$options['skip_errors']) {
        throw $e; // Stop processing
    }
    // Continue to next record
}
```

### 9.5 Relationship Processing

**Stock Example:**

```php
// After creating product
$productId = DB::table('products')->insertGetId($productData);

// Process stock relationship
$stockData = $mappedData['stocks'] ?? [];
if (!empty($stockData)) {
    // Check if stock exists for this product + branch
    $existingStock = DB::table('stocks')
        ->where('product_id', $productId)
        ->where('branch_code', $stockData['branch_code'])
        ->first();
    
    if ($existingStock) {
        // Update existing stock
        DB::table('stocks')
            ->where('id', $existingStock->id)
            ->update($stockData);
    } else {
        // Create new stock
        $stockData['product_id'] = $productId;
        DB::table('stocks')->insert($stockData);
    }
}
```

---

## 10. Export Process

### 10.1 Export Workflow

```
1. Export Request
   ↓
2. Batch Creation
   ↓
3. Queue Job
   ↓
4. Query Data (with filters)
   ↓
5. Map Fields (database → CSV)
   ↓
6. Generate File
   ↓
7. Store File
   ↓
8. Provide Download URL
```

### 10.2 Export Options

```json
{
  "format": "csv",
  "include_headers": true,
  "field_separator": ";",
  "filters": {
    "is_active": true,
    "created_at": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    }
  }
}
```

### 10.3 Filtering

**Simple Filters:**
```json
{
  "filters": {
    "is_active": true,
    "brand_id": 5
  }
}
```

**Range Filters:**
```json
{
  "filters": {
    "price": {
      "min": 10,
      "max": 100
    },
    "created_at": {
      "from": "2024-01-01",
      "to": "2024-12-31"
    }
  }
}
```

**Array Filters:**
```json
{
  "filters": {
    "brand_id": [1, 2, 3, 5]
  }
}
```

---

## 11. Batch Management

### 11.1 Batch Statuses

| Status | Description |
|--------|-------------|
| queued | Job dispatched to queue |
| processing | Currently processing |
| completed | Successfully completed |
| failed | Failed with errors |
| cancelled | Manually cancelled |

### 11.2 Batch Statistics

**Tracked Metrics:**
- Total records
- Processed records
- Successful records
- Failed records
- Skipped records
- Execution time

### 11.3 Monitoring Batches

**Get Batch Status:**
```bash
GET /api/backend/dynamic-import-export/import/{batchId}/status
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "uuid-here",
    "status": "processing",
    "total_records": 1000,
    "processed_records": 450,
    "successful_records": 440,
    "failed_records": 10,
    "progress_percentage": 45
  }
}
```

---

## 12. Error Handling

### 12.1 Error Types

**1. Validation Errors**
```json
{
  "record_number": 5,
  "status": "failed",
  "errors": {
    "code": ["The code field is required"],
    "price": ["The price must be a number"]
  }
}
```

**2. Database Errors**
```json
{
  "record_number": 10,
  "status": "failed",
  "errors": {
    "database": "Unique constraint violation on products.code"
  }
}
```

**3. Relationship Errors**
```json
{
  "record_number": 15,
  "status": "failed",
  "errors": {
    "brand_id": "Brand with ID 999 does not exist"
  }
}
```

### 12.2 Error Reports

**Download Error Report:**
```bash
GET /api/backend/dynamic-import-export/import/{batchId}/error-report
```

**CSV Format:**
```csv
Record Number,Identifier,Status,Errors,Message
5,PROD005,failed,"{'code': ['Required field missing']}","Validation failed"
10,PROD010,failed,"{'database': 'Unique violation'}","Duplicate code"
```

### 12.3 Error Recovery

**Strategy 1: Fix and Re-import**
1. Download error report
2. Fix errors in CSV
3. Create new import with only failed records

**Strategy 2: Skip Errors**
- Use `skip_errors: true` option
- Failed records logged but processing continues
- Review errors after completion

---

# Part 4: REST API Reference

## 13. Authentication

### 13.1 Bearer Token

All API requests require authentication:

```bash
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 13.2 Getting Token

**Login Request:**
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## 14. Template API

### 14.1 List Templates

**Endpoint:**
```
GET /api/backend/templates
```

**Query Parameters:**
- `type`: Filter by type (import, export, both)
- `module`: Filter by module
- `is_active`: Filter by status

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "id": 1,
      "code": "IMPPRODUCT",
      "name": "Product Import",
      "type": "import",
      "primary_table": "products",
      "is_active": true
    }
  ]
}
```

### 14.2 Get Template Details

**Endpoint:**
```
GET /api/backend/templates/{id}
```

**Response:**
```json
{
  "success": true,
  "template": {
    "id": 1,
    "code": "IMPPRODUCT",
    "name": "Product Import",
    "fields": [...],
    "relationships": [...]
  }
}
```

### 14.3 Create Template

**Endpoint:**
```
POST /api/backend/templates
```

**Request Body:**
```json
{
  "code": "IMPPRODUCT",
  "name": "Product Import",
  "type": "import",
  "primary_table": "products",
  "file_type": "csv",
  "fields": [...]
}
```

### 14.4 Update Template

**Endpoint:**
```
PUT /api/backend/templates/{id}
```

### 14.5 Delete Template

**Endpoint:**
```
DELETE /api/backend/templates/{id}
```

---

## 15. Import API

### 15.1 Upload File

**Endpoint:**
```
POST /api/backend/dynamic-import-export/upload
```

**Request (multipart/form-data):**
```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/upload' \
  --header 'Authorization: Bearer TOKEN' \
  --form 'template_code=IMPPRODUCT' \
  --form 'file=@/path/to/file.csv'
```

**Response:**
```json
{
  "success": true,
  "file_path": "imports/templates/IMPPRODUCT/1734618000_file.csv",
  "filename": "1734618000_file.csv",
  "size": 12345,
  "message": "File uploaded successfully"
}
```

### 15.2 Start Import

**Endpoint:**
```
POST /api/backend/dynamic-import-export/import/start
```

**Request Body:**
```json
{
  "template_code": "IMPPRODUCT",
  "file_path": "imports/templates/IMPPRODUCT/1734618000_file.csv",
  "options": {
    "update_existing": true,
    "skip_errors": true
  },
  "use_queue": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Import queued for processing",
  "batch_id": "uuid-here",
  "status": "queued"
}
```

### 15.3 Get Import Status

**Endpoint:**
```
GET /api/backend/dynamic-import-export/import/{batchId}/status
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "uuid",
    "status": "completed",
    "total_records": 100,
    "successful_records": 95,
    "failed_records": 5,
    "execution_time": 45
  }
}
```

### 15.4 Get Import Logs

**Endpoint:**
```
GET /api/backend/dynamic-import-export/import/{batchId}/logs?status=failed
```

**Query Parameters:**
- `status`: Filter by status (success, failed, skipped)
- `per_page`: Records per page (default: 50)

**Response:**
```json
{
  "success": true,
  "logs": {
    "data": [
      {
        "record_number": 5,
        "record_identifier": "PROD005",
        "status": "failed",
        "message": "Validation failed",
        "errors": {...}
      }
    ],
    "total": 5,
    "per_page": 50,
    "current_page": 1
  }
}
```

### 15.5 Download Error Report

**Endpoint:**
```
GET /api/backend/dynamic-import-export/import/{batchId}/error-report
```

**Response:** CSV file download

---

## 16. Export API

### 16.1 Start Export

**Endpoint:**
```
POST /api/backend/dynamic-import-export/export/start
```

**Request Body:**
```json
{
  "template_code": "EXPPRODUCT",
  "filters": {
    "is_active": true,
    "brand_id": [1, 2, 3]
  },
  "options": {
    "format": "csv"
  },
  "use_queue": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Export queued for processing",
  "batch_id": "uuid",
  "status": "queued"
}
```

### 16.2 Get Export Status

**Endpoint:**
```
GET /api/backend/dynamic-import-export/export/{batchId}/status
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "uuid",
    "status": "completed",
    "total_records": 500,
    "download_url": "/api/backend/dynamic-import-export/export/uuid/download"
  }
}
```

### 16.3 Download Export File

**Endpoint:**
```
GET /api/backend/dynamic-import-export/export/{batchId}/download
```

**Response:** File download

---

## 17. Metadata API

### 17.1 Get All Tables

**Endpoint:**
```
GET /api/backend/dynamic-import-export/metadata/tables
```

**Response:**
```json
{
  "success": true,
  "database": "foodsolution",
  "total_tables": 85,
  "tables": [
    {
      "name": "products",
      "row_count": 1250,
      "size": "2048 kB",
      "has_timestamps": true
    },
    {
      "name": "partners",
      "row_count": 450,
      "size": "512 kB",
      "has_timestamps": true
    }
  ]
}
```

**Use Cases:**
- Dynamic template builder
- Database schema explorer
- Table selection UI

### 17.2 Get Table Columns

**Endpoint:**
```
GET /api/backend/dynamic-import-export/metadata/tables/{tableName}/columns
```

**Example:**
```bash
GET /api/backend/dynamic-import-export/metadata/tables/products/columns
```

**Response:**
```json
{
  "success": true,
  "table": "products",
  "total_columns": 15,
  "columns": [
    {
      "name": "id",
      "type": "integer",
      "laravel_type": "integer",
      "nullable": false,
      "is_primary_key": true,
      "is_foreign_key": false
    },
    {
      "name": "code",
      "type": "character varying",
      "laravel_type": "string",
      "max_length": 50,
      "nullable": false,
      "is_unique": true
    },
    {
      "name": "brand_id",
      "type": "integer",
      "laravel_type": "integer",
      "nullable": true,
      "is_foreign_key": true,
      "foreign_key": {
        "references_table": "brands",
        "references_column": "id"
      }
    }
  ],
  "primary_keys": ["id"],
  "foreign_keys": {
    "brand_id": {
      "references_table": "brands",
      "references_column": "id"
    }
  },
  "unique_columns": ["code"],
  "indexes": [...]
}
```

**Use Cases:**
- Auto-generate template fields
- Validate CSV headers
- Discover relationships
- Build dynamic forms

---

## 18. Statistics API

### 18.1 Get Overall Statistics

**Endpoint:**
```
GET /api/backend/dynamic-import-export/statistics
```

**Query Parameters:**
- `template_id`: Filter by template

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

# Part 5: Practical Guide

## 19. Quick Start

### 19.1 Complete Import Example

**Step 1: Prepare CSV File**

Create `products.csv`:
```csv
Code;Name;Price;Brand ID;Active
PROD001;Product 1;99.99;1;Yes
PROD002;Product 2;149.99;2;Yes
PROD003;Product 3;79.99;1;No
```

**Step 2: Upload File**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/upload' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --form 'template_code=IMPPRODUCT' \
  --form 'file=@/path/to/products.csv'
```

**Response:**
```json
{
  "success": true,
  "file_path": "imports/templates/IMPPRODUCT/1734618000_products.csv"
}
```

**Step 3: Start Import**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/import/start' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "template_code": "IMPPRODUCT",
    "file_path": "imports/templates/IMPPRODUCT/1734618000_products.csv",
    "options": {
      "update_existing": true,
      "skip_errors": true
    },
    "use_queue": true
  }'
```

**Response:**
```json
{
  "success": true,
  "batch_id": "abc-123-def",
  "status": "queued"
}
```

**Step 4: Check Status**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/import/abc-123-def/status' \
  --header 'Authorization: Bearer YOUR_TOKEN'
```

**Response:**
```json
{
  "success": true,
  "batch": {
    "batch_id": "abc-123-def",
    "status": "completed",
    "total_records": 3,
    "successful_records": 3,
    "failed_records": 0
  }
}
```

### 19.2 Complete Export Example

**Step 1: Start Export**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/export/start' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --header 'Content-Type: application/json' \
  --data '{
    "template_code": "EXPPRODUCT",
    "filters": {
      "is_active": true
    },
    "use_queue": true
  }'
```

**Step 2: Check Status**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/export/xyz-456-abc/status' \
  --header 'Authorization: Bearer YOUR_TOKEN'
```

**Step 3: Download File**

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/export/xyz-456-abc/download' \
  --header 'Authorization: Bearer YOUR_TOKEN' \
  --output products_export.csv
```

---

## 20. cURL Examples

### 20.1 Common Issues

**Issue: "The file field is required"**

❌ **Wrong:**
```bash
--form 'template_code="IMPPRODUCT"'  # Quotes around value
--form 'file=@"/path/to/file.csv"'   # Quotes around path
```

✅ **Correct:**
```bash
--form 'template_code=IMPPRODUCT'    # No quotes
--form 'file=@/path/to/file.csv'     # No quotes around path
```

**Issue: "File not found"**

✅ **Use absolute path:**
```bash
--form 'file=@D:/project/file.csv'   # Windows
--form 'file=@/home/user/file.csv'   # Linux
```

**Issue: "Unauthorized"**

✅ **Include Bearer token:**
```bash
--header 'Authorization: Bearer YOUR_ACTUAL_TOKEN'
```

### 20.2 Windows PowerShell

```powershell
curl.exe --location 'http://localhost:8000/api/backend/dynamic-import-export/upload' `
  --header 'Authorization: Bearer TOKEN' `
  --form 'template_code=IMPPRODUCT' `
  --form 'file=@D:\path\to\file.csv'
```

### 20.3 Linux/Mac Bash

```bash
curl --location 'http://localhost:8000/api/backend/dynamic-import-export/upload' \
  --header 'Authorization: Bearer TOKEN' \
  --form 'template_code=IMPPRODUCT' \
  --form 'file=@/path/to/file.csv'
```

### 20.4 Postman

**Upload File:**
1. Method: POST
2. URL: `http://localhost:8000/api/backend/dynamic-import-export/upload`
3. Headers:
   - `Authorization: Bearer TOKEN`
4. Body → form-data:
   - `template_code`: IMPPRODUCT (Text)
   - `file`: Select file (File)

---

## 21. Real-World Scenarios

### 21.1 Product Import with Stock

**CSV Structure:**
```csv
Product Code;Product Name;Price;Stock Branch;Stock Quantity;Min Stock;Max Stock
PROD001;Product 1;99.99;A0001;100;10;500
PROD002;Product 2;149.99;A0001;50;5;200
```

**Template Configuration:**
- Primary Table: `products`
- Related Table: `stocks` (hasMany)

**Field Mapping:**
```
A → products.code (identifier)
B → products.name
C → products.price
D → stocks.branch_code
E → stocks.quantity
F → stocks.minimum_quantity
G → stocks.maximum_quantity
```

**Import Process:**
1. Create/Update product
2. Create/Update stock for branch A0001

### 21.2 Customer Import

**CSV Structure:**
```csv
Code;Name;Email;Phone;Address;City;Active
CUST001;John Doe;john@example.com;+1234567890;123 Main St;New York;Yes
```

**Template:** IMPCUSTOMER

**Features:**
- Email validation
- Phone format validation
- Duplicate check on email
- Value mapping (Yes → true)

### 21.3 Bulk Price Update

**CSV Structure:**
```csv
Product Code;New Price;Discount Price
PROD001;109.99;99.99
PROD002;159.99;149.99
```

**Template:** IMPPRODUCT_PRICE

**Options:**
```json
{
  "update_existing": true,
  "skip_errors": false
}
```

**Result:**
- Updates only price fields
- Fails if product doesn't exist

### 21.4 Multi-Branch Stock Import

**CSV Structure:**
```csv
Product Code;Branch A Qty;Branch B Qty;Branch C Qty
PROD001;100;50;75
PROD002;200;100;150
```

**Challenge:** Multiple stock records per product

**Solution:** Use separate rows or custom processing

**Alternative CSV:**
```csv
Product Code;Branch Code;Quantity
PROD001;A0001;100
PROD001;B0001;50
PROD001;C0001;75
PROD002;A0001;200
```

---

## 22. Best Practices

### 22.1 CSV File Preparation

**1. Encoding**
- Use UTF-8 encoding
- Save with BOM for Excel compatibility
- Test with accented characters (é, à, ñ)

**2. Separators**
- Semicolon (;) recommended for European locales
- Comma (,) for US/UK locales
- Avoid separators in data values

**3. Headers**
- First row must be headers
- Match template field labels exactly
- No special characters in headers

**4. Data Quality**
- Remove empty rows
- Trim whitespace
- Consistent date formats
- Validate required fields before import

### 22.2 Template Design

**1. Field Organization**
```
✅ Good Order:
- Identifiers first (code, email)
- Required fields next
- Optional fields last
- Related table fields grouped
```

**2. Naming Conventions**
```
Template Code: IMP + TABLE + PURPOSE
Examples:
- IMPPRODUCT (general product import)
- IMPPRODUCT_PRICE (price update only)
- IMPPRODUCT_STOCK (stock update only)
```

**3. Validation Strategy**
```
✅ Add validation for:
- Required fields
- Unique constraints
- Foreign key references
- Data type formats
- Value ranges
```

### 22.3 Performance Optimization

**1. Batch Size**
- Default: 100 records per batch
- Large files: 50 records per batch
- Small files: 200 records per batch

**2. Queue Workers**
```bash
# Run multiple workers for parallel processing
php artisan queue:work --queue=default --tries=3 &
php artisan queue:work --queue=default --tries=3 &
php artisan queue:work --queue=default --tries=3 &
```

**3. Database Indexes**
- Index identifier fields
- Index foreign keys
- Index frequently filtered fields

**4. File Size Limits**
- Recommended: < 10MB per file
- Maximum: 20MB
- Split large files into smaller chunks

### 22.4 Error Handling Strategy

**1. Use skip_errors for bulk imports**
```json
{
  "skip_errors": true
}
```
- Processes all valid records
- Logs errors for review
- Download error report after completion

**2. Use validate_only for testing**
```json
{
  "validate_only": true
}
```
- Checks all records without importing
- Identifies all errors upfront
- Fix errors before actual import

**3. Monitor progress**
- Check status periodically
- Review logs for warnings
- Download error reports

### 22.5 Security Best Practices

**1. File Validation**
- Validate file type
- Check file size
- Scan for malicious content

**2. Access Control**
- Require authentication
- Role-based permissions
- Audit trail logging

**3. Data Validation**
- Sanitize input data
- Validate foreign keys
- Check data integrity

---

## 23. Troubleshooting

### 23.1 Common Errors

**Error: "File not found"**

**Cause:** File path incorrect or file not uploaded

**Solution:**
1. Verify file was uploaded successfully
2. Use exact `file_path` from upload response
3. Check file exists in storage

**Error: "Template not found"**

**Cause:** Invalid template code

**Solution:**
1. List available templates: `GET /api/backend/templates`
2. Use exact template code
3. Check template is active

**Error: "Validation failed"**

**Cause:** CSV data doesn't match validation rules

**Solution:**
1. Check required fields are present
2. Verify data types match
3. Review validation rules in template
4. Use `validate_only: true` to test

**Error: "Unique constraint violation"**

**Cause:** Duplicate identifier in CSV or database

**Solution:**
1. Check for duplicates in CSV
2. Use `update_existing: true` to update instead of create
3. Review unique constraints on table

**Error: "Foreign key constraint violation"**

**Cause:** Referenced record doesn't exist

**Solution:**
1. Import parent records first (e.g., brands before products)
2. Verify foreign key values exist
3. Add validation rule: `exists:table,column`

### 23.2 Import Not Processing

**Symptoms:**
- Status stuck on "queued"
- No progress after several minutes

**Diagnosis:**
```bash
# Check queue workers
php artisan queue:work --once

# Check failed jobs
php artisan queue:failed
```

**Solutions:**
1. Start queue worker:
```bash
php artisan queue:work
```

2. Restart queue workers:
```bash
php artisan queue:restart
```

3. Check logs:
```bash
tail -f storage/logs/laravel.log
```

### 23.3 Encoding Issues

**Symptoms:**
- Accented characters display incorrectly (é → Ã©)
- Special characters corrupted

**Solution:**
1. Save CSV as UTF-8 with BOM
2. In Excel: Save As → CSV UTF-8
3. In Notepad++: Encoding → UTF-8 with BOM

### 23.4 Performance Issues

**Symptoms:**
- Import takes too long
- Timeouts
- High memory usage

**Solutions:**

**1. Reduce batch size:**
```json
{
  "batch_size": 50
}
```

**2. Split large files:**
- Break into smaller files
- Import separately

**3. Optimize database:**
```sql
-- Add indexes
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_stocks_product_id ON stocks(product_id);
```

**4. Increase PHP limits:**
```ini
; php.ini
max_execution_time = 300
memory_limit = 512M
```

### 23.5 Debugging Tips

**1. Enable debug mode:**
```env
APP_DEBUG=true
```

**2. Check logs:**
```bash
tail -f storage/logs/laravel.log
```

**3. Test with small file:**
- Create test CSV with 5-10 records
- Verify template works
- Scale up gradually

**4. Use validate_only:**
```json
{
  "validate_only": true
}
```
- Identifies errors without importing
- Faster than full import

**5. Review batch logs:**
```bash
GET /api/backend/dynamic-import-export/import/{batchId}/logs
```

---

## Appendix A: Data Type Reference

### PostgreSQL → Laravel Type Mapping

| PostgreSQL Type | Laravel Type | Example |
|----------------|--------------|---------|
| integer | integer | 100 |
| bigint | bigInteger | 9999999999 |
| smallint | smallInteger | 32767 |
| numeric | decimal | 99.99 |
| real | float | 99.99 |
| double precision | double | 99.999999 |
| character varying | string | "Product Name" |
| character | char | "A" |
| text | text | "Long description..." |
| boolean | boolean | true, false |
| date | date | 2024-12-20 |
| timestamp without time zone | timestamp | 2024-12-20 14:30:00 |
| timestamp with time zone | timestampTz | 2024-12-20T14:30:00Z |
| time without time zone | time | 14:30:00 |
| json | json | {"key": "value"} |
| jsonb | jsonb | {"key": "value"} |
| uuid | uuid | 550e8400-e29b-41d4-a716 |
| bytea | binary | Binary data |

---

## Appendix B: API Endpoints Summary

### Template Management
```
GET    /api/backend/templates
GET    /api/backend/templates/{id}
POST   /api/backend/templates
PUT    /api/backend/templates/{id}
DELETE /api/backend/templates/{id}
```

### Import Operations
```
POST   /api/backend/dynamic-import-export/upload
POST   /api/backend/dynamic-import-export/import/start
GET    /api/backend/dynamic-import-export/import/{batchId}/status
GET    /api/backend/dynamic-import-export/import/{batchId}/logs
GET    /api/backend/dynamic-import-export/import/{batchId}/error-report
```

### Export Operations
```
POST   /api/backend/dynamic-import-export/export/start
GET    /api/backend/dynamic-import-export/export/{batchId}/status
GET    /api/backend/dynamic-import-export/export/{batchId}/download
```

### Batch Management
```
GET    /api/backend/dynamic-import-export/batches
DELETE /api/backend/dynamic-import-export/batches/{batchId}
```

### Metadata (Database Introspection)
```
GET    /api/backend/dynamic-import-export/metadata/tables
GET    /api/backend/dynamic-import-export/metadata/tables/{tableName}/columns
```

### Statistics
```
GET    /api/backend/dynamic-import-export/statistics
```

---

## Appendix C: Queue Commands

### Start Queue Worker
```bash
php artisan queue:work
```

### Start with Options
```bash
php artisan queue:work --queue=default --tries=3 --timeout=300
```

### Restart Queue Workers
```bash
php artisan queue:restart
```

### List Failed Jobs
```bash
php artisan queue:failed
```

### Retry Failed Job
```bash
php artisan queue:retry {job-id}
```

### Retry All Failed Jobs
```bash
php artisan queue:retry all
```

### Clear Failed Jobs
```bash
php artisan queue:flush
```

---

## Appendix D: Configuration

### Queue Configuration
```env
# .env
QUEUE_CONNECTION=database
```

### File Storage Configuration
```env
FILESYSTEM_DISK=local
```

### Import/Export Limits
```php
// config/import-export.php
return [
    'max_file_size' => 20480, // 20MB in KB
    'allowed_extensions' => ['csv', 'xlsx', 'xls', 'txt'],
    'batch_size' => 100,
    'timeout' => 300, // seconds
];
```

---

## Appendix E: Glossary

**Batch**: A single import/export operation instance

**Batch Log**: Record-level processing log within a batch

**Cascade Update**: Automatically update related records

**Field Mapping**: Connection between CSV column and database column

**Identifier**: Field that uniquely identifies a record (for updates)

**Indicator**: Column letter in CSV (A, B, C...)

**Primary Table**: Main table for import/export operation

**Relationship**: Connection between tables (hasMany, hasOne, belongsTo)

**Template**: Reusable configuration for import/export

**Value Mapping**: Transformation of CSV values to database values

---

## Support & Resources

**Documentation Files:**
- This guide: `GUIDELINE_EXIMPO.md`
- Quick reference: `REST_API_COMPLETE_REFERENCE.md`
- Metadata guide: `METADATA_API_GUIDE.md`

**System Files:**
- Controller: `app/Http/Controllers/Backend/DynamicImportExportController.php`
- Services: `app/Services/DynamicImportService.php`, `DynamicExportService.php`
- Models: `app/Models/ImportExportTemplate.php`, `ImportExportBatch.php`, `BatchLog.php`

**Database:**
- Migrations: `database/migrations/*_create_import_export_*`
- Seeders: `database/seeders/SystemTemplatesSeeder.php`

---

**Version:** 1.0  
**Last Updated:** December 20, 2024  
**System:** EXIMPO - Enterprise Import/Export Management System
