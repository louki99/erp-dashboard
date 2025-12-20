# Import/Export Module - Production Ready

## Overview

A comprehensive, production-ready import/export system for the ERP dashboard that allows users to import and export data using configurable templates. Built with TypeScript, React, and integrated with a robust backend API.

## Features

### ✅ Core Functionality
- **Template-Based Operations** - Flexible template system for different data types
- **File Upload** - Support for CSV, XLSX, and XLS files (up to 20MB)
- **Real-Time Progress Tracking** - Live updates during import/export operations
- **Batch Processing** - Queue-based processing for large datasets
- **Error Reporting** - Detailed error logs with downloadable reports
- **Export Filtering** - Advanced filtering options for exports
- **Statistics Dashboard** - Comprehensive analytics and monitoring

### 🎯 Import Features
- Upload validation before processing
- Update existing records or create new ones
- Skip errors or stop on first error
- Validation-only mode
- Configurable batch size
- Real-time progress monitoring
- Detailed error reporting with CSV export
- Support for multiple data types (products, customers, etc.)

### 📤 Export Features
- Template-based field selection
- Advanced filtering options
- Multiple format support (XLSX, CSV)
- Optional headers
- Configurable batch size
- Real-time progress tracking
- Direct file download

### 📊 Management Features
- Template management (CRUD operations)
- Batch history with filtering
- Operation statistics
- Template activation/deactivation
- Auto-generate templates from database tables

## File Structure

```
src/pages/import-export/
├── ImportExportPage.tsx      # Main dashboard with statistics
├── ImportPage.tsx             # Import wizard (upload, configure, process)
├── ExportPage.tsx             # Export wizard (configure, export, download)
├── BatchHistoryPage.tsx       # Operation history with filtering
├── TemplatesPage.tsx          # Template management
└── README.md                  # This file

src/services/api/
└── importExportApi.ts         # API service layer

src/types/
└── importExport.types.ts      # TypeScript type definitions

src/routes/
└── importExportRoutes.tsx     # Route configuration
```

## Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/import-export` | ImportExportPage | Dashboard with statistics and recent activity |
| `/import-export/import` | ImportPage | Import data wizard |
| `/import-export/export` | ExportPage | Export data wizard |
| `/import-export/batches` | BatchHistoryPage | Batch operation history |
| `/import-export/templates` | TemplatesPage | Template management |

## API Integration

### Base URL
```
Production: https://yourdomain.com/api/backend
Development: http://localhost:8000/api/backend
```

### Key Endpoints

#### Templates
- `GET /templates` - List all templates
- `GET /templates/{id}` - Get template details
- `POST /templates` - Create template
- `PUT /templates/{id}` - Update template
- `DELETE /templates/{id}` - Delete template
- `POST /templates/{id}/toggle-status` - Toggle active status
- `POST /templates/generate-from-table` - Auto-generate template

#### Import
- `POST /dynamic-import-export/upload` - Upload file
- `POST /dynamic-import-export/import/start` - Start import
- `GET /dynamic-import-export/import/{batchId}/status` - Get status
- `GET /dynamic-import-export/import/{batchId}/logs` - Get logs
- `GET /dynamic-import-export/import/{batchId}/error-report` - Download errors

#### Export
- `POST /dynamic-import-export/export/start` - Start export
- `GET /dynamic-import-export/export/{batchId}/status` - Get status
- `GET /dynamic-import-export/export/{batchId}/download` - Download file

#### Batches
- `GET /dynamic-import-export/batches` - List batches
- `DELETE /dynamic-import-export/batches/{batchId}` - Delete batch

#### Statistics
- `GET /dynamic-import-export/statistics` - Get statistics

## Usage Examples

### Import Workflow

```typescript
// 1. Upload file
const uploadData = await importExportApi.import.uploadFile('IMPPRODUCT', file);

// 2. Start import
const importData = await importExportApi.import.startImport({
  template_code: 'IMPPRODUCT',
  file_path: uploadData.file_path,
  options: {
    update_existing: true,
    skip_errors: false,
    validate_only: false,
    batch_size: 100
  },
  use_queue: true
});

// 3. Poll for status
const statusData = await importExportApi.import.getStatus(importData.batch_id);

// 4. Download error report if needed
if (statusData.batch.failed_records > 0) {
  importExportApi.import.downloadErrorReport(importData.batch_id);
}
```

### Export Workflow

```typescript
// 1. Start export
const exportData = await importExportApi.export.startExport({
  template_code: 'IMPPRODUCT',
  filters: {
    is_active: true,
    brand_id: [1, 2, 3],
    price_min: 50,
    price_max: 500
  },
  options: {
    format: 'xlsx',
    include_headers: true,
    batch_size: 1000
  },
  use_queue: true
});

// 2. Poll for completion
const statusData = await importExportApi.export.getStatus(exportData.batch_id);

// 3. Download file
if (statusData.batch.status === 'completed') {
  importExportApi.export.downloadFile(exportData.batch_id);
}
```

## Configuration Options

### Import Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| update_existing | boolean | true | Update existing records or skip duplicates |
| skip_errors | boolean | false | Continue on errors or stop immediately |
| validate_only | boolean | false | Only validate, don't import |
| batch_size | integer | 100 | Records per transaction |

### Export Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| format | string | 'xlsx' | Export format: 'xlsx' or 'csv' |
| include_headers | boolean | true | Include column headers |
| batch_size | integer | 1000 | Records per batch |

## Template Structure

```typescript
interface Template {
  id: number;
  code: string;                    // Unique identifier
  name: string;                    // Display name
  type: 'import' | 'export' | 'both';
  object_code: string;             // Object type (e.g., 'PRODUCT')
  object_name: string;             // Display name
  primary_table: string;           // Main database table
  module: string;                  // Module category
  file_type: 'csv' | 'xlsx' | 'xls';
  field_separator: string;         // CSV separator
  allow_import: boolean;
  allow_export: boolean;
  is_active: boolean;
  is_system: boolean;              // System templates can't be deleted
  fields: TemplateField[];         // Field definitions
}
```

## Error Handling

### Client-Side Validation
- File type validation (CSV, XLSX, XLS only)
- File size validation (max 20MB)
- Template selection validation
- Required field validation

### Server-Side Validation
- Data type validation
- Required field validation
- Unique constraint validation
- Foreign key validation
- Custom business rules

### Error Reporting
- Real-time error display during import
- Downloadable CSV error report
- Detailed error messages with field names
- Record number tracking

## Performance Optimization

### Batch Processing
- Configurable batch sizes
- Queue-based processing
- Progress tracking
- Memory-efficient streaming

### Polling Strategy
- 2-second intervals for status checks
- Automatic cleanup on completion
- Efficient state management

### File Handling
- Chunked file uploads
- Server-side validation
- Temporary file cleanup

## Security

### Authentication
- All endpoints require Bearer token authentication
- Token included in Authorization header
- 24-hour token expiration

### Authorization
- Protected routes with ProtectedRoute component
- Permission-based access control
- Template ownership validation

### File Upload Security
- File type validation
- File size limits
- Virus scanning (backend)
- Secure file storage

## Best Practices

### Import Best Practices
1. **Validate First** - Use validate_only mode before actual import
2. **Batch Size** - Use smaller batches (100-500) for complex data
3. **Error Handling** - Review error reports before re-importing
4. **Backup** - Always backup data before large imports
5. **Testing** - Test with small datasets first

### Export Best Practices
1. **Filters** - Use filters to export only needed data
2. **Format** - Use XLSX for Excel compatibility, CSV for simplicity
3. **Batch Size** - Larger batches (1000-5000) for exports
4. **Scheduling** - Export during off-peak hours for large datasets

### Template Best Practices
1. **Naming** - Use clear, descriptive names
2. **Fields** - Only include necessary fields
3. **Validation** - Add validation rules to prevent errors
4. **Testing** - Test templates with sample data
5. **Documentation** - Document custom templates

## Troubleshooting

### Common Issues

**Import fails immediately**
- Check file format and encoding
- Verify template is active
- Check required fields are present
- Review file size limits

**Progress stuck at 0%**
- Check queue is running
- Verify backend connectivity
- Check server logs for errors

**Export produces empty file**
- Verify filters aren't too restrictive
- Check template field configuration
- Ensure data exists in database

**Template not found**
- Verify template is active
- Check template code spelling
- Ensure template type matches operation

## Production Checklist

- [x] API service layer implemented
- [x] TypeScript types defined
- [x] All UI components created
- [x] Routes configured
- [x] Error handling implemented
- [x] Progress tracking working
- [x] File upload validation
- [x] Real-time status updates
- [x] Statistics dashboard
- [x] Batch history
- [x] Template management
- [x] Responsive design
- [x] Loading states
- [x] Toast notifications
- [x] Documentation complete

## Future Enhancements

- [ ] Scheduled imports/exports
- [ ] Email notifications on completion
- [ ] Advanced filtering UI
- [ ] Template versioning
- [ ] Data transformation rules
- [ ] Multi-file import
- [ ] Export to multiple formats
- [ ] Template marketplace
- [ ] Import preview
- [ ] Rollback functionality

## Support

For issues or questions:
1. Check this documentation
2. Review API documentation in `/docs/imex.md`
3. Check server logs for errors
4. Contact development team

## Version History

**v1.0.0** (December 19, 2025)
- Initial production release
- Complete import/export functionality
- Template management
- Batch processing
- Statistics dashboard
- Error reporting

---

**Status:** ✅ Production Ready
**Last Updated:** December 19, 2025
**Maintained By:** Development Team
