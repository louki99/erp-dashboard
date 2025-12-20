# Metadata API Integration Test

## ✅ Implementation Status: COMPLETE

### What Was Implemented

1. **Secure API Integration**
   - Uses encoded table IDs (e.g., `YmFua3M` for `banks`)
   - Displays user-friendly names (e.g., "Banks" instead of "banks")
   - Decodes IDs client-side to get actual table names

2. **Enhanced Column Selection**
   - Shows column metadata in dropdown: `code (string) [UNIQUE, REQUIRED, max:30]`
   - Auto-populates field properties from column metadata:
     - `is_required` from `nullable`
     - `is_identifier` from `is_unique` or `is_primary_key`
     - `max_length` from column metadata
     - `default_value` from column default
     - `data_type` from `laravel_type`

3. **Smart Display Names**
   - Converts snake_case to Title Case
   - Example: `account_number` → "Account Number"

## Test Scenarios

### Scenario 1: Select Banks Table
**Steps:**
1. Navigate to `/import-export/templates/new`
2. In General tab, select "Banks" from table dropdown
3. Verify:
   - ✅ Template `primary_table` = "banks" (decoded)
   - ✅ Template `object_name` = "Banks" (display name)
   - ✅ Shows "Table réelle: banks" below dropdown

### Scenario 2: Add Column from Banks
**Steps:**
1. Go to Fields tab
2. Click "Ajouter un champ"
3. Select "Banks" table
4. Select "code" column from dropdown
5. Verify auto-populated values:
   - ✅ `field_name` = "code"
   - ✅ `display_name` = "Code"
   - ✅ `field_type` = "string"
   - ✅ `is_required` = true (not nullable)
   - ✅ `is_identifier` = true (unique)
   - ✅ `max_length` = 30

### Scenario 3: Column Metadata Display
**Expected dropdown options:**
```
id (bigInteger) [PK, REQUIRED]
code (string) [UNIQUE, REQUIRED, max:30]
name (string) [REQUIRED, max:100]
swift_code (string) [max:20]
account_number (string) [max:50]
iban (string) [max:50]
branch_name (string) [max:100]
branch_code (string) [max:30]
address (text)
phone (string) [max:20]
is_active (boolean) [REQUIRED]
created_at (timestamp)
updated_at (timestamp)
```

## API Response Compatibility

### Tables Endpoint Response
```json
{
  "success": true,
  "database": "food",
  "schema": "public",
  "total_tables": 85,
  "tables": [
    {
      "id": "YmFua3M",              // ✅ Used for selection
      "display_name": "Banks",      // ✅ Shown to user
      "row_count": 100,
      "size": "2048 kB",
      "has_timestamps": true
    }
  ]
}
```

### Columns Endpoint Response
```json
{
  "success": true,
  "table_id": "YmFua3M",           // ✅ Encoded ID
  "table_name": "Banks",           // ✅ Display name
  "total_columns": 13,
  "columns": [
    {
      "name": "code",              // ✅ Used for field_name
      "laravel_type": "string",    // ✅ Used for data_type
      "nullable": false,           // ✅ Used for is_required
      "is_unique": true,           // ✅ Used for is_identifier
      "max_length": 30             // ✅ Used for max_length
    }
  ]
}
```

## Security Features

✅ **Table Name Obfuscation**
- Real table names never exposed in URLs
- Uses base64 URL-safe encoding
- Example: `banks` → `YmFua3M`

✅ **Client-Side Decoding**
- `importExportApi.metadata.decodeTableId()` helper
- Validates decoded names
- Stores actual table name in template

✅ **User-Friendly Display**
- Shows "Banks" instead of "banks"
- Shows "Import Export Batches" instead of "import_export_batches"

## Files Modified

1. **`src/services/api/importExportApi.ts`**
   - Updated `getTables()` response type
   - Updated `getTableColumns()` to use `tableId`
   - Added `decodeTableId()` helper

2. **`src/pages/import-export/TemplateDetailPage.tsx`**
   - GeneralTab: Uses encoded IDs for table selection
   - FieldEditModal: Enhanced column selection with metadata
   - Auto-populates field properties from column metadata

3. **`src/types/importExport.types.ts`**
   - Added optional fields: `column_index`, `display_name`, `field_type`, etc.

## Expected Behavior

### When User Selects Table:
1. Dropdown shows: "Banks (100 lignes, 2048 kB)"
2. On selection:
   - Decodes `YmFua3M` → `banks`
   - Sets `primary_table` = "banks"
   - Sets `object_name` = "Banks"
3. Info box shows: "Table réelle: banks"

### When User Selects Column:
1. Dropdown shows: "code (string) [UNIQUE, REQUIRED, max:30]"
2. On selection:
   - Sets `field_name` = "code"
   - Sets `display_name` = "Code"
   - Sets `field_type` = "string"
   - Sets `is_required` = true
   - Sets `is_identifier` = true
   - Sets `max_length` = 30

## Manual Testing Checklist

- [ ] Tables load correctly in General tab dropdown
- [ ] Table selection updates template fields
- [ ] Columns load when table is selected in field modal
- [ ] Column metadata displays correctly in dropdown
- [ ] Field properties auto-populate from column metadata
- [ ] Manual input still works as fallback
- [ ] Loading spinners show during API calls
- [ ] Error handling works if API fails
- [ ] Template saves with correct table names

## Status: ✅ READY FOR TESTING

All components are updated and compatible with the secure metadata API format!
