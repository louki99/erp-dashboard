# Import/Export Pages - ADV Commands Pattern Redesign

## Summary
All import/export pages have been redesigned to use the ADV Commands interface pattern with:
- **Left Panel**: DataGrid component for list/grid view
- **Main Panel**: Detail view with SageTabs (Données | Détails | Actions)
- **Right Panel**: Action panel with vertical icon menu

## Completed Pages

### ✅ ImportExportPage (Dashboard)
- **Status**: Complete
- **Pattern**: ADV Commands with DataGrid
- **Features**:
  - Left: Operations list with filters (Type, Status)
  - Main: Selected operation details with tabs
  - Right: Action panel (New Import, New Export, Refresh)

## Pages to Update

### 🔄 ImportPage
- **Current**: Sage X3 tabbed interface only
- **Target**: Keep current workflow but ensure consistency
- **Note**: This page is a wizard-style workflow, keeping current design

### 🔄 ExportPage
- **Current**: Sage X3 tabbed interface only
- **Target**: Keep current workflow but ensure consistency
- **Note**: This page is a wizard-style workflow, keeping current design

### 🔄 BatchHistoryPage
- **Current**: Sage X3 tabbed interface only
- **Target**: ADV Commands pattern with DataGrid
- **Changes Needed**:
  - Left: Batch history grid with filters
  - Main: Selected batch details with tabs
  - Right: Action panel

### ✅ TemplateDetailPage
- **Status**: Complete
- **Pattern**: Sage X3 tabbed interface (Entête | Champs | Actions)
- **Note**: This is a detail page, current design is appropriate

## Design Decisions

1. **Dashboard/List Pages**: Use ADV Commands pattern
   - ImportExportPage ✅
   - BatchHistoryPage (to update)

2. **Wizard/Workflow Pages**: Keep Sage X3 tabbed interface
   - ImportPage (keep current)
   - ExportPage (keep current)

3. **Detail Pages**: Use Sage X3 tabbed interface
   - TemplateDetailPage ✅

## Conclusion

The ImportPage and ExportPage are workflow pages (upload → configure → process), so they should keep their current Sage X3 tabbed design. Only BatchHistoryPage needs to be updated to match the ADV Commands pattern since it's a list/grid page like ImportExportPage.
