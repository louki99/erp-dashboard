# General Settings REST API Documentation

## Overview
Complete REST API documentation for the ERP General Settings system. This API manages application-wide configurations including branding, theme, business rules, and AI settings.

**Base URL:** `/backend`  
**Authentication:** Bearer Token (Sanctum) - except public endpoints  
**Content-Type:** `application/json`

---

## Table of Contents
1. [Public Endpoints](#public-endpoints)
2. [Main Settings](#main-settings)
3. [Theme Settings](#theme-settings)
4. [Business Settings](#business-settings)
5. [Withdraw Settings](#withdraw-settings)
6. [AI Settings](#ai-settings)
7. [Data Models](#data-models)
8. [Error Handling](#error-handling)

---

## Public Endpoints

### Get Public Settings
Retrieve public-facing settings (no authentication required).

**Endpoint:** `GET /backend/settings/public`  
**Authentication:** None  
**Cache:** 1 hour

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "name": "My ERP System",
    "title": "ERP Management",
    "email": "contact@erp.com",
    "mobile": "+1234567890",
    "address": "123 Business St",
    "logo": "https://domain.com/storage/logo.png",
    "app_logo": "https://domain.com/storage/app-logo.png",
    "favicon": "https://domain.com/storage/favicon.png",
    "footer_logo": "https://domain.com/storage/footer-logo.png",
    "footer_qr": "https://domain.com/storage/qr-code.png",
    "currency": "$",
    "currency_position": "left",
    "direction": "ltr",
    "primary_color": "#8b5cf6",
    "secondary_color": "#ede9fe",
    "show_footer": true,
    "footer_phone": "+1234567890",
    "footer_email": "footer@erp.com",
    "footer_text": "© 2024 ERP System",
    "footer_description": "Your trusted business partner",
    "show_download_app": true,
    "google_playstore_url": "https://play.google.com/...",
    "app_store_url": "https://apps.apple.com/..."
  }
}
```

---

## Main Settings

### Get All Settings
Retrieve complete general settings with media relationships.

**Endpoint:** `GET /backend/generale-setting`  
**Authentication:** Required  
**Permissions:** Admin/Settings Manager

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "setting": {
      "id": 1,
      "name": "My ERP System",
      "title": "ERP Management",
      "email": "contact@erp.com",
      "mobile": "+1234567890",
      "address": "123 Business St",
      "currency": "$",
      "currency_id": 1,
      "currency_position": "left",
      "direction": "ltr",
      "primary_color": "#8b5cf6",
      "secondary_color": "#ede9fe",
      "business_based_on": "commission",
      "commission": 10,
      "commission_type": "percentage",
      "commission_charge": "per_order",
      "shop_type": "multi",
      "shop_pos": true,
      "shop_register": true,
      "new_product_approval": true,
      "update_product_approval": true,
      "cash_on_delivery": true,
      "online_payment": true,
      "default_delivery_charge": 5.00,
      "return_order_within_days": 3,
      "min_withdraw": 50,
      "max_withdraw": 5000,
      "withdraw_request": 7,
      "show_footer": true,
      "footer_phone": "+1234567890",
      "footer_email": "footer@erp.com",
      "footer_text": "© 2024",
      "footer_description": "Description",
      "show_download_app": true,
      "google_playstore_url": "https://...",
      "app_store_url": "https://...",
      "show_sku": false,
      "product_description": "AI prompt for products",
      "page_description": "AI prompt for pages",
      "blog_description": "AI prompt for blogs",
      "logo": "https://domain.com/storage/logo.png",
      "app_logo": "https://domain.com/storage/app-logo.png",
      "favicon": "https://domain.com/storage/favicon.png",
      "footer_logo": "https://domain.com/storage/footer-logo.png",
      "footer_qr": "https://domain.com/storage/qr.png",
      "created_at": "2024-01-01T00:00:00.000000Z",
      "updated_at": "2024-12-16T10:00:00.000000Z"
    },
    "currencies": [
      {
        "id": 1,
        "name": "US Dollar",
        "code": "USD",
        "symbol": "$",
        "is_default": true
      }
    ]
  },
  "message": "Settings retrieved successfully"
}
```

### Update General Settings
Update main application settings including branding and contact info.

**Endpoint:** `POST /backend/generale-setting`  
**Authentication:** Required  
**Content-Type:** `multipart/form-data`

#### Request Body
```json
{
  "name": "My ERP System",
  "title": "ERP Management Platform",
  "email": "contact@erp.com",
  "mobile": "+1234567890",
  "address": "123 Business Street, City",
  "currency": 1,
  "currency_position": "left",
  "direction": "ltr",
  "show_download_app": true,
  "google_playstore_url": "https://play.google.com/store/apps/...",
  "app_store_url": "https://apps.apple.com/app/...",
  "show_footer": true,
  "footer_phone": "+1234567890",
  "footer_email": "footer@erp.com",
  "footer_text": "© 2024 ERP System",
  "footer_description": "Your trusted business partner",
  "return_order_within_days": 7
}
```

#### File Uploads (Optional)
- `logo`: Image file (png, jpg, jpeg, svg) - Max 2MB
- `favicon`: Image file (png, jpg, jpeg, svg, webp) - Max 2MB
- `app_logo`: Image file (png, jpg, jpeg, svg) - Max 2MB
- `footer_logo`: Image file (png, jpg, jpeg, svg) - Max 2MB
- `footer_qrcode`: Image file (png, jpg, jpeg, gif) - Max 2MB

#### Validation Rules
- `name`: nullable, string, max 255
- `title`: nullable, string, max 255
- `email`: nullable, email, max 255
- `mobile`: nullable, string
- `address`: nullable, string, max 255
- `currency`: nullable, string, max 4
- `currency_position`: nullable, string (left/right)
- `direction`: nullable, string (ltr/rtl)
- `return_order_within_days`: nullable, numeric

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Generale settings updated successfully",
  "data": {
    "id": 1,
    "name": "My ERP System",
    "logo": "https://domain.com/storage/logo.png",
    ...
  }
}
```

---

## Theme Settings

### Get Theme Settings
Retrieve only theme-related settings (colors, direction).

**Endpoint:** `GET /backend/generale-setting/theme`  
**Authentication:** Required  
**Cache:** 1 hour

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "primary_color": "#8b5cf6",
    "secondary_color": "#ede9fe",
    "direction": "ltr"
  }
}
```

### Update Theme Settings
Update theme colors.

**Endpoint:** `POST /backend/generale-setting/theme`  
**Authentication:** Required

#### Request Body
```json
{
  "primary_color": "#8b5cf6",
  "secondary_color": "#ede9fe"
}
```

#### Validation Rules
- `primary_color`: required, string, hex color format (#RGB or #RRGGBB)
- `secondary_color`: required, string, hex color format (#RGB or #RRGGBB)

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Theme settings updated successfully",
  "data": {
    "primary_color": "#8b5cf6",
    "secondary_color": "#ede9fe"
  }
}
```

---

## Business Settings

### Get Business Settings
Retrieve business configuration including commission, shop type, and approvals.

**Endpoint:** `GET /backend/generale-setting/business`  
**Authentication:** Required

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "business_based_on": "commission",
    "commission": 10,
    "commission_type": "percentage",
    "commission_charge": "per_order",
    "shop_type": "multi",
    "shop_pos": true,
    "shop_register": true,
    "new_product_approval": true,
    "update_product_approval": true,
    "cash_on_delivery": true,
    "online_payment": true,
    "default_delivery_charge": 5.00,
    "return_order_within_days": 3,
    "min_withdraw": 50,
    "max_withdraw": 5000,
    "withdraw_request": 7
  }
}
```

### Update Business Settings
Update business configuration.

**Endpoint:** `POST /backend/generale-setting/business`  
**Authentication:** Required

#### Request Body
```json
{
  "business_based_on": "commission",
  "commission": 10,
  "commission_type": "percentage",
  "commission_charge": "per_order",
  "shop_type": "multi",
  "new_product_approval": true,
  "update_product_approval": false
}
```

#### Validation Rules
- `business_based_on`: nullable, string, in: commission, subscription
- `commission`: nullable, numeric, min: 0, max: 100
- `commission_type`: nullable, string, in: percentage, fixed
- `commission_charge`: nullable, string, in: per_order, per_product
- `shop_type`: nullable, string, in: multi, single
- `new_product_approval`: nullable, boolean
- `update_product_approval`: nullable, boolean

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Business settings updated successfully",
  "data": {
    "id": 1,
    "business_based_on": "commission",
    "commission": 10,
    ...
  }
}
```

---

## Withdraw Settings

### Get Withdraw Settings
Retrieve withdrawal configuration.

**Endpoint:** `GET /backend/generale-setting/withdraw`  
**Authentication:** Required

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "min_withdraw": 50,
    "max_withdraw": 5000,
    "withdraw_request": 7
  }
}
```

### Update Withdraw Settings
Update withdrawal limits and request days.

**Endpoint:** `POST /backend/generale-setting/withdraw`  
**Authentication:** Required

#### Request Body
```json
{
  "min_withdraw": 50,
  "max_withdraw": 5000,
  "withdraw_request": 7
}
```

#### Validation Rules
- `min_withdraw`: required, numeric, min: 0
- `max_withdraw`: required, numeric, min: 0, gte: min_withdraw
- `withdraw_request`: required, integer, min: 1

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Withdraw settings updated successfully",
  "data": {
    "min_withdraw": 50,
    "max_withdraw": 5000,
    "withdraw_request": 7
  }
}
```

---

## AI Settings

### Get AI Prompt Settings
Retrieve AI prompt templates for content generation.

**Endpoint:** `GET /backend/ai-prompts`  
**Authentication:** Required

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "product_description": "Generate a compelling product description...",
    "page_description": "Create an engaging page description...",
    "blog_description": "Write an informative blog post..."
  }
}
```

### Update AI Prompt Settings
Update AI prompt templates.

**Endpoint:** `POST /backend/ai-prompts/update`  
**Authentication:** Required

#### Request Body
```json
{
  "product_description": "Generate a compelling product description with features and benefits...",
  "page_description": "Create an engaging page description that highlights key points...",
  "blog_description": "Write an informative blog post about the topic..."
}
```

#### Validation Rules
- `product_description`: required, max: 550
- `page_description`: required, max: 550
- `blog_description`: required, max: 550

#### Response (200 OK)
```json
{
  "success": true,
  "message": "AI Prompt updated successfully",
  "data": {
    "product_description": "Generate a compelling...",
    "page_description": "Create an engaging...",
    "blog_description": "Write an informative..."
  }
}
```

### Get AI Configuration Status
Check if OpenAI API keys are configured.

**Endpoint:** `GET /backend/ai-prompts/configure`  
**Authentication:** Required

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "api_key_configured": true,
    "organization_configured": true
  }
}
```

### Update AI Configuration
Configure OpenAI API credentials.

**Endpoint:** `POST /backend/ai-prompts/configure`  
**Authentication:** Required  
**Permissions:** Admin only

#### Request Body
```json
{
  "api_key": "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx",
  "organization": "org-xxxxxxxxxxxxxxxx"
}
```

#### Validation Rules
- `api_key`: required, string, min: 20
- `organization`: required, string

#### Response (200 OK)
```json
{
  "success": true,
  "message": "AI configuration updated successfully"
}
```

---

## Data Models

### GeneraleSetting Model
```typescript
interface GeneraleSetting {
  id: number;
  
  // Branding
  name: string | null;
  title: string | null;
  logo_id: number | null;
  favicon_id: number | null;
  app_logo_id: number | null;
  footer_logo_id: number | null;
  footer_qrcode_id: number | null;
  
  // Contact Info
  email: string | null;
  mobile: string | null;
  address: string | null;
  
  // Currency
  currency: string | null;
  currency_id: number | null;
  currency_position: 'left' | 'right' | null;
  
  // Theme
  primary_color: string;        // Default: #8b5cf6
  secondary_color: string;      // Default: #ede9fe
  direction: 'ltr' | 'rtl' | null;
  
  // Business Settings
  business_based_on: 'commission' | 'subscription';
  commission: number;           // Default: 10
  commission_type: 'percentage' | 'fixed';
  commission_charge: 'per_order' | 'per_product';
  shop_type: 'multi' | 'single';
  shop_pos: boolean;
  shop_register: boolean;
  new_product_approval: boolean;
  update_product_approval: boolean;
  
  // Payment & Delivery
  cash_on_delivery: boolean;
  online_payment: boolean;
  default_delivery_charge: number;
  return_order_within_days: number;
  
  // Withdraw
  min_withdraw: number | null;
  max_withdraw: number | null;
  withdraw_request: number | null;
  
  // Footer
  show_footer: boolean;
  footer_phone: string | null;
  footer_email: string | null;
  footer_text: string | null;
  footer_description: string | null;
  
  // App Download
  show_download_app: boolean;
  google_playstore_url: string | null;
  app_store_url: string | null;
  
  // Display Options
  show_sku: boolean;
  
  // AI Prompts
  product_description: string | null;
  page_description: string | null;
  blog_description: string | null;
  
  // Computed Attributes
  logo: string;
  app_logo: string;
  favicon: string;
  footer_logo: string;
  footer_qr: string | null;
  
  // Timestamps
  created_at: string;
  updated_at: string;
}
```

### Currency Model
```typescript
interface Currency {
  id: number;
  name: string;
  code: string;
  symbol: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "message": "Error message description",
  "error": "Detailed error information (only in development)"
}
```

### HTTP Status Codes
- `200 OK` - Request successful
- `404 Not Found` - Settings not configured
- `422 Unprocessable Entity` - Validation failed
- `500 Internal Server Error` - Server error

### Validation Error Response (422)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "primary_color": [
      "The primary color field must be a valid hex color."
    ],
    "commission": [
      "The commission must be between 0 and 100."
    ]
  }
}
```

---

## Frontend Integration Examples

### React/Vue Example - Get Public Settings
```javascript
// Fetch public settings on app load
async function loadPublicSettings() {
  try {
    const response = await fetch('/backend/settings/public');
    const data = await response.json();
    
    if (data.success) {
      // Apply theme colors
      document.documentElement.style.setProperty('--primary-color', data.data.primary_color);
      document.documentElement.style.setProperty('--secondary-color', data.data.secondary_color);
      
      // Set app title
      document.title = data.data.title;
      
      // Set favicon
      const favicon = document.querySelector('link[rel="icon"]');
      favicon.href = data.data.favicon;
      
      return data.data;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
}
```

### React Example - Update Theme
```javascript
async function updateTheme(primaryColor, secondaryColor) {
  try {
    const response = await fetch('/backend/generale-setting/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        primary_color: primaryColor,
        secondary_color: secondaryColor
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Update CSS variables
      document.documentElement.style.setProperty('--primary-color', data.data.primary_color);
      document.documentElement.style.setProperty('--secondary-color', data.data.secondary_color);
      
      toast.success(data.message);
    } else {
      toast.error(data.message);
    }
  } catch (error) {
    console.error('Failed to update theme:', error);
    toast.error('Failed to update theme settings');
  }
}
```

### Vue Example - Update Settings with File Upload
```javascript
async function updateGeneralSettings(formData) {
  try {
    // Create FormData for file uploads
    const data = new FormData();
    
    // Add text fields
    data.append('name', formData.name);
    data.append('email', formData.email);
    data.append('mobile', formData.mobile);
    
    // Add files if selected
    if (formData.logo) {
      data.append('logo', formData.logo);
    }
    if (formData.favicon) {
      data.append('favicon', formData.favicon);
    }
    
    const response = await fetch('/backend/generale-setting', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: data
    });
    
    const result = await response.json();
    
    if (result.success) {
      toast.success(result.message);
      return result.data;
    } else {
      toast.error(result.message);
    }
  } catch (error) {
    console.error('Failed to update settings:', error);
  }
}
```

### Angular Example - Get Business Settings
```typescript
import { HttpClient } from '@angular/common/http';

export class SettingsService {
  constructor(private http: HttpClient) {}
  
  getBusinessSettings() {
    return this.http.get<{
      success: boolean;
      data: BusinessSettings;
    }>('/backend/generale-setting/business');
  }
  
  updateBusinessSettings(settings: Partial<BusinessSettings>) {
    return this.http.post<{
      success: boolean;
      message: string;
      data: BusinessSettings;
    }>('/backend/generale-setting/business', settings);
  }
}
```

---

## Cache Management

The API uses Laravel cache for performance optimization:

- **Public Settings**: Cached for 1 hour (`generale_setting_public`)
- **Theme Settings**: Cached for 1 hour (`theme_settings`)
- **Default Currency**: Cached (`default_currency`)
- **General Settings**: Cached (`generale_setting`)

Cache is automatically cleared when settings are updated.

---

## Logging

All settings updates are logged with:
- User ID
- Action performed
- Timestamp
- Request data (excluding sensitive files)

Check logs at: `storage/logs/laravel.log`

---

## Security Considerations

1. **Authentication**: All endpoints except `/backend/settings/public` require authentication
2. **File Upload**: Validate file types and sizes on frontend before upload
3. **API Keys**: Never expose OpenAI API keys in frontend code
4. **CORS**: Configure CORS properly for your frontend domain
5. **Rate Limiting**: Apply rate limiting to prevent abuse

---

## Testing Endpoints

### Using cURL

```bash
# Get public settings
curl -X GET https://your-domain.com/backend/settings/public

# Get all settings (authenticated)
curl -X GET https://your-domain.com/backend/generale-setting \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Accept: application/json"

# Update theme
curl -X POST https://your-domain.com/backend/generale-setting/theme \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"primary_color":"#8b5cf6","secondary_color":"#ede9fe"}'
```

### Using Postman

1. Import the collection from this documentation
2. Set environment variable `BASE_URL` = `https://your-domain.com`
3. Set environment variable `TOKEN` = Your Bearer token
4. Test each endpoint

---

## Support & Contact

For API issues or questions:
- Email: dev@erp.com
- Documentation: https://docs.erp.com
- GitHub: https://github.com/your-repo

**Version:** 1.0.0  
**Last Updated:** December 16, 2024


