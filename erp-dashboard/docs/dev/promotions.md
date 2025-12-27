# Promotion System - Complete Developer Guide

## 📋 Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Promotion Types](#promotion-types)
4. [API Endpoints](#api-endpoints)
5. [Request/Response Examples](#requestresponse-examples)
6. [Promotion Configuration](#promotion-configuration)
7. [Calculation Engine](#calculation-engine)
8. [Frontend Integration](#frontend-integration)
9. [Testing Guide](#testing-guide)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

The ERP Promotion System is a comprehensive, flexible engine for managing complex promotional campaigns. It supports multiple discount types, breakpoint-based pricing, product/family targeting, partner segmentation, and automatic calculation.

### Key Features

✅ **7 Promotion Types** - Percentage, Fixed Amount, Free Goods, Best Price, Replace Price, etc.  
✅ **Flexible Targeting** - By product, product family, or entire cart  
✅ **Breakpoint System** - Value-based (MAD) or Quantity-based thresholds  
✅ **Partner Segmentation** - Target specific customer groups  
✅ **Assortment Rules** - Require product mix (AND/OR logic)  
✅ **Payment Term Dependent** - Promotions based on payment conditions  
✅ **Automatic Calculation** - Real-time discount computation  
✅ **Repeating Promotions** - Apply discount multiple times  
✅ **Analytics & Tracking** - Usage statistics and performance metrics  

---

## 🏗️ System Architecture

### Database Schema

```
promotions
├── promotion_lines (conditions)
│   ├── promotion_line_details (breakpoints/rules)
│   └── promotion_line_assortments (product mix requirements)
├── partner_family_promotions (customer targeting)
└── promotion_payment_terms (payment conditions)

product_families
└── product_family_products (product grouping)

partner_families
└── partner_family_partners (customer grouping)
```

### Core Models

- **Promotion** - Main promotion entity
- **PromotionLine** - Condition/rule container
- **PromotionLineDetail** - Breakpoint with discount type
- **PromotionLineAssortment** - Product mix requirement
- **ProductFamily** - Product grouping for targeting
- **PartnerFamily** - Customer grouping for eligibility

### Services

- **PromotionEngine** - Core calculation logic
- **PromotionService** - Business logic layer
- **PromotionAnalyticsService** - Statistics and reporting

---

## 💰 Promotion Types

### Type 1: Percentage Discount
**Description:** Apply a percentage discount to qualifying products  
**Amount Field:** Percentage value (e.g., 10 = 10%)  
**Example:** Buy 1000 MAD worth of products, get 10% off

```json
{
  "promo_type": 1,
  "minimum_value": 1000,
  "amount": 10,
  "repeating": false
}
```

### Type 2: Fixed Amount Discount
**Description:** Subtract a fixed amount from the total  
**Amount Field:** Discount amount in MAD  
**Example:** Buy 5 units, get 50 MAD off

```json
{
  "promo_type": 2,
  "minimum_value": 5,
  "amount": 50,
  "repeating": true
}
```

### Type 3: Best Price
**Description:** Set a maximum price per unit  
**Amount Field:** Best price per unit  
**Example:** Buy 10+ units, pay maximum 45 MAD per unit

```json
{
  "promo_type": 3,
  "minimum_value": 10,
  "amount": 45,
  "repeating": false
}
```

### Type 4: Amount Per Unit
**Description:** Discount per unit purchased  
**Amount Field:** Discount per unit  
**Example:** Buy 20+ units, get 5 MAD off per unit

```json
{
  "promo_type": 4,
  "minimum_value": 20,
  "amount": 5,
  "repeating": false
}
```

### Type 5: Free Promo Unit (Different Product)
**Description:** Get free units of a different product  
**Amount Field:** Number of free units  
**Example:** Buy 10 Product A, get 2 free Product B

```json
{
  "promo_type": 5,
  "minimum_value": 10,
  "amount": 2,
  "repeating": false
}
```

### Type 6: Flat Amount Discount
**Description:** Fixed discount regardless of quantity  
**Amount Field:** Total discount amount  
**Example:** Buy 1000 MAD worth, get 100 MAD off

```json
{
  "promo_type": 6,
  "minimum_value": 1000,
  "amount": 100,
  "repeating": false
}
```

### Type 7: Replace/Special Price
**Description:** Replace unit price with special price  
**Amount Field:** New price per unit  
**Example:** Buy 50+ units, pay only 40 MAD per unit

```json
{
  "promo_type": 7,
  "minimum_value": 50,
  "amount": 40,
  "repeating": false
}
```

---

## 🔌 API Endpoints

### Backend Management (Admin)

#### 1. List All Promotions
```http
GET /api/backend/promotions
Authorization: Bearer {token}
```

**Query Parameters:**
- `status` - Filter by status (active, upcoming, expired)
- `breakpoint_type` - Filter by type (1=value, 2=quantity, 3=promo-unit)
- `search` - Search by name/code/description
- `start_date` - Filter by start date
- `end_date` - Filter by end date
- `page` - Pagination page number

**Response:**
```json
{
  "promotions": {
    "data": [...],
    "current_page": 1,
    "total": 50
  },
  "statistics": {
    "total": 50,
    "active": 12,
    "upcoming": 8,
    "expired": 30
  },
  "productFamilies": [...],
  "partnerFamilies": [...]
}
```

#### 2. Get Promotion Details
```http
GET /api/backend/promotions/{id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "promotion": {
    "id": 1,
    "code": "PROMO2024",
    "name": "Winter Sale",
    "description": "Special winter promotion",
    "start_date": "2024-01-01",
    "end_date": "2024-03-31",
    "breakpoint_type": 1,
    "lines": [
      {
        "line_number": 0,
        "name": "Main Discount",
        "paid_based_on_product": false,
        "paid_product_family_code": "FAMILY001",
        "assortment_type": 0,
        "details": [
          {
            "detail_number": 0,
            "promo_type": 1,
            "minimum_value": 1000,
            "amount": 10,
            "repeating": false
          }
        ],
        "assortments": []
      }
    ],
    "partnerFamilies": [...],
    "paymentTerms": [...]
  },
  "usageStats": {
    "invoice_count": 150,
    "total_discount": 45000,
    "avg_discount": 300
  }
}
```

#### 3. Create Promotion
```http
POST /api/backend/promotions
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "PROMO2024",
  "name": "Winter Sale",
  "description": "Special winter promotion",
  "start_date": "2024-01-01",
  "end_date": "2024-03-31",
  "breakpoint_type": 1,
  "sequence": 10,
  "scale_method": 2,
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": ["FAMILY001", "FAMILY002"],
  "payment_terms": ["NET30", "NET60"],
  "lines": [
    {
      "name": "Main Discount",
      "paid_based_on_product": "family",
      "paid_code": "FAMILY001",
      "assortment_type": "none",
      "details": [
        {
          "promo_type": 1,
          "minimum_value": 1000,
          "amount": 10,
          "repeating": false
        },
        {
          "promo_type": 1,
          "minimum_value": 2000,
          "amount": 15,
          "repeating": false
        }
      ]
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Promotion created successfully",
  "promotion": {...}
}
```

#### 4. Update Promotion
```http
PUT /api/backend/promotions/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:** Same as Create

#### 5. Delete Promotion
```http
DELETE /api/backend/promotions/{id}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Promotion deleted successfully"
}
```

#### 6. Clone Promotion
```http
POST /api/backend/promotions/{id}/clone
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Promotion cloned successfully",
  "clone": {...}
}
```

---

### Calculation API (Frontend/Mobile)

#### 7. Calculate Promotions
```http
POST /api/promotions/calculate
Content-Type: application/json
```

**Request Body:**
```json
{
  "partner_code": "PARTNER001",
  "payment_term_code": "NET30",
  "branch_code": "BRANCH001",
  "date": "2024-12-16",
  "save_to_document": false,
  "document_code": "INV-2024-001",
  "document_type": "invoice",
  "line_items": [
    {
      "product_code": "PROD001",
      "quantity": 10,
      "price": 150
    },
    {
      "product_code": "PROD002",
      "quantity": 5,
      "price": 200
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Promotions calculated successfully",
  "data": {
    "promotions": [
      {
        "promotion_id": 1,
        "promotion_code": "PROMO2024",
        "promotion_name": "Winter Sale",
        "applied": true,
        "total_discount": 250,
        "lines": [
          {
            "line_number": 0,
            "name": "Main Discount",
            "applied": true,
            "discount": 250,
            "details": [
              {
                "detail_number": 0,
                "minimum_value": 1000,
                "promo_type": 1,
                "amount": 10,
                "discount": 250,
                "breakpoint_value": 2500
              }
            ]
          }
        ]
      }
    ],
    "total_discount": 250,
    "applied_count": 1,
    "document_code": "INV-2024-001",
    "saved_to_document": false
  }
}
```

#### 8. Get My Promotions (Authenticated Partner)
```http
GET /api/my-promotions
Authorization: Bearer {token}
```

**Query Parameters:**
- `payment_term_code` - Filter by payment term
- `date` - Check eligibility for specific date

**Response:**
```json
{
  "success": true,
  "message": "Promotions retrieved successfully",
  "data": {
    "partner": {
      "code": "PARTNER001",
      "name": "ABC Company",
      "city": "Casablanca",
      "is_b2b": true
    },
    "promotions": [
      {
        "id": 1,
        "code": "PROMO2024",
        "name": "Winter Sale",
        "description": "Special winter promotion",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "breakpoint_type": "value_based",
        "breakpoint_type_label": "Value Based (MAD)",
        "is_active": true,
        "rules": [
          {
            "line_number": 0,
            "name": "Main Discount",
            "product_family_code": "FAMILY001",
            "tiers": [
              {
                "tier_number": 0,
                "minimum_value": 1000,
                "discount_type": "Percentage Discount",
                "discount_type_code": 1,
                "amount": 10,
                "repeating": false
              }
            ]
          }
        ]
      }
    ],
    "total_count": 5,
    "date_checked": "2024-12-16 10:00:00"
  }
}
```

#### 9. Test Promotion (Dry Run)
```http
POST /api/promotions/test
Content-Type: application/json
```

**Request Body:**
```json
{
  "partner_code": "PARTNER001",
  "payment_term_code": "NET30",
  "line_items": [
    {
      "product_code": "PROD001",
      "quantity": 10,
      "price": 150
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Eligible promotions retrieved",
  "data": {
    "eligible_promotions": [
      {
        "id": 1,
        "code": "PROMO2024",
        "name": "Winter Sale",
        "description": "Special winter promotion",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "lines_count": 1
      }
    ],
    "count": 1
  }
}
```

---

### Product & Partner Family Management

#### 10. List Product Families
```http
GET /api/backend/promotions/product-families
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "ELECTRONICS",
      "name": "Electronics Products",
      "description": "All electronic devices",
      "products_count": 15
    }
  ]
}
```

#### 11. Create Product Family
```http
POST /api/backend/promotions/product-families
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "FAMILY001",
  "name": "Electronics",
  "description": "Electronic products",
  "products": ["PROD001", "PROD002", "PROD003"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Product family created successfully",
  "data": {...}
}
```

#### 12. Get Product Family Details
```http
GET /api/backend/promotions/product-families/{id}
Authorization: Bearer {token}
```

#### 13. Update Product Family
```http
PUT /api/backend/promotions/product-families/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

#### 14. Delete Product Family
```http
DELETE /api/backend/promotions/product-families/{id}
Authorization: Bearer {token}
```

---

#### 15. List Partner Families
```http
GET /api/backend/promotions/partner-families
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "code": "PREMIUM",
      "name": "Premium Customers",
      "partner_condition": "credit_limit > 50000",
      "partners_count": 25
    }
  ]
}
```

#### 16. Create Partner Family
```http
POST /api/backend/promotions/partner-families
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "code": "FAMILY001",
  "name": "Premium Customers",
  "partner_condition": "credit_limit > 50000",
  "partners": ["PARTNER001", "PARTNER002"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Partner family created successfully",
  "data": {...}
}
```

#### 17. Get Partner Family Details
```http
GET /api/backend/promotions/partner-families/{id}
Authorization: Bearer {token}
```

#### 18. Update Partner Family
```http
PUT /api/backend/promotions/partner-families/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

#### 19. Delete Partner Family
```http
DELETE /api/backend/promotions/partner-families/{id}
Authorization: Bearer {token}
```

---

### Boosts Management (Product Family × Partner Family)

#### 20. List Boosts
```http
GET /api/backend/promotions/boosts
Authorization: Bearer {token}
```

**Description:** Manage promotional boosts that link product families with partner families for targeted promotions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "product_family_code": "ELECTRONICS",
      "partner_family_code": "PREMIUM",
      "boost_percentage": 10,
      "is_active": true
    }
  ]
}
```

#### 21. Create Boost
```http
POST /api/backend/promotions/boosts
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "product_family_code": "ELECTRONICS",
  "partner_family_code": "PREMIUM",
  "boost_percentage": 10,
  "is_active": true
}
```

#### 22. Bulk Sync Boosts
```http
POST /api/backend/promotions/boosts/bulk-sync
Authorization: Bearer {token}
Content-Type: application/json
```

**Description:** Synchronize multiple boosts at once.

**Request Body:**
```json
{
  "boosts": [
    {
      "product_family_code": "ELECTRONICS",
      "partner_family_code": "PREMIUM",
      "boost_percentage": 10
    },
    {
      "product_family_code": "FOOD",
      "partner_family_code": "WHOLESALE",
      "boost_percentage": 5
    }
  ]
}
```

#### 23. Get Boost Details
```http
GET /api/backend/promotions/boosts/{id}
Authorization: Bearer {token}
```

#### 24. Update Boost
```http
PUT /api/backend/promotions/boosts/{id}
Authorization: Bearer {token}
Content-Type: application/json
```

#### 25. Delete Boost
```http
DELETE /api/backend/promotions/boosts/{id}
Authorization: Bearer {token}
```

---

## 📝 Promotion Configuration

### Breakpoint Types

#### Type 1: Value-Based (MAD)
Promotions trigger based on total purchase amount in currency.

**Example:** Buy 1000 MAD worth of products, get 10% off

```json
{
  "breakpoint_type": 1,
  "lines": [{
    "details": [{
      "minimum_value": 1000,
      "promo_type": 1,
      "amount": 10
    }]
  }]
}
```

#### Type 2: Quantity-Based (Units)
Promotions trigger based on total number of units.

**Example:** Buy 50 units, get 100 MAD off

```json
{
  "breakpoint_type": 2,
  "lines": [{
    "details": [{
      "minimum_value": 50,
      "promo_type": 2,
      "amount": 100
    }]
  }]
}
```

#### Type 3: Promo-Unit-Based
Promotions trigger based on standardized promo units (for products with different sizes).

**Example:** Buy 100 promo units, get 15% off

```json
{
  "breakpoint_type": 3,
  "lines": [{
    "details": [{
      "minimum_value": 100,
      "promo_type": 1,
      "amount": 15
    }]
  }]
}
```

### Discount Targets

#### Entire Cart
Apply discount to all products in cart.

```json
{
  "paid_based_on_product": null,
  "paid_product_code": null,
  "paid_product_family_code": null
}
```

#### Product Family
Apply discount to specific product family.

```json
{
  "paid_based_on_product": false,
  "paid_product_family_code": "FAMILY001"
}
```

#### Specific Product
Apply discount to specific product only.

```json
{
  "paid_based_on_product": true,
  "paid_product_code": "PROD001"
}
```

### Assortment Types

#### Type 0: None
No product mix requirement.

```json
{
  "assortment_type": 0,
  "assortments": []
}
```

#### Type 1: Multiple (AND Logic)
ALL assortments must meet minimum.

**Example:** Must buy at least 5 of Product A AND 3 of Product B

```json
{
  "assortment_type": 1,
  "assortments": [
    {
      "based_on_product": true,
      "product_code": "PROD_A",
      "minimum": 5
    },
    {
      "based_on_product": true,
      "product_code": "PROD_B",
      "minimum": 3
    }
  ]
}
```

#### Type 2: Cart Amount
Minimum cart amount required.

```json
{
  "assortment_type": 2,
  "minimum_cart_amount": 1000
}
```

#### Type 3: Both (AND + Cart Amount)
Both assortment AND cart amount required.

```json
{
  "assortment_type": 3,
  "minimum_cart_amount": 1000,
  "assortments": [...]
}
```

### Repeating Promotions

When `repeating: true`, the discount applies multiple times based on how many times the threshold is met.

**Example:** Buy 10 units, get 50 MAD off (repeating)
- 10 units = 50 MAD off
- 20 units = 100 MAD off
- 30 units = 150 MAD off

```json
{
  "promo_type": 2,
  "minimum_value": 10,
  "amount": 50,
  "repeating": true
}
```

---

## ⚙️ Calculation Engine

### How It Works

1. **Get Eligible Promotions**
   - Check date range (start_date <= now <= end_date)
   - Check partner eligibility (partner families)
   - Check payment term dependency
   - Order by sequence

2. **Apply Each Promotion**
   - For each promotion line:
     - Get qualifying products
     - Check assortment requirements
     - Calculate total value (based on breakpoint type)
     - Apply matching details/breakpoints

3. **Calculate Discount**
   - Based on promo_type
   - Apply repeating logic if enabled
   - Sum all discounts

4. **Save Results** (if requested)
   - Save to invoice_promotion_details or order_promotion_details

### Eligibility Logic

```javascript
// Partner Eligibility
1. No partner restriction (available to all)
   OR
2. Specific partner (partner_precondition = partner_code)
   OR
3. Partner in partner family

// Payment Term Eligibility
1. Not payment term dependent
   OR
2. Payment term in promotion_payment_terms

// Date Eligibility
start_date <= current_date <= end_date AND is_closed = false
```

### Calculation Examples

#### Example 1: Percentage Discount
```
Cart:
- Product A: 10 units × 150 MAD = 1500 MAD
- Product B: 5 units × 200 MAD = 1000 MAD
Total: 2500 MAD

Promotion:
- Breakpoint: 2000 MAD
- Type: Percentage (10%)

Calculation:
2500 MAD × 10% = 250 MAD discount
```

#### Example 2: Fixed Amount with Repeating
```
Cart:
- Product A: 25 units × 100 MAD = 2500 MAD

Promotion:
- Breakpoint: 10 units
- Type: Fixed Amount (50 MAD)
- Repeating: true

Calculation:
25 units ÷ 10 = 2 (floor)
2 × 50 MAD = 100 MAD discount
```

#### Example 3: Replace Price
```
Cart:
- Product A: 50 units × 60 MAD = 3000 MAD

Promotion:
- Breakpoint: 50 units
- Type: Replace Price (45 MAD per unit)

Calculation:
Current: 50 × 60 = 3000 MAD
New: 50 × 45 = 2250 MAD
Discount: 3000 - 2250 = 750 MAD
```

---

## 🎨 Frontend Integration

### React Example

```jsx
import { useState, useEffect } from 'react';

function PromotionCalculator() {
  const [cart, setCart] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [totalDiscount, setTotalDiscount] = useState(0);

  const calculatePromotions = async () => {
    const response = await fetch('/api/promotions/calculate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        partner_code: partnerCode,
        payment_term_code: paymentTerm,
        save_to_document: false,
        line_items: cart.map(item => ({
          product_code: item.code,
          quantity: item.quantity,
          price: item.price
        }))
      })
    });

    const data = await response.json();
    if (data.success) {
      setPromotions(data.data.promotions);
      setTotalDiscount(data.data.total_discount);
    }
  };

  useEffect(() => {
    if (cart.length > 0) {
      calculatePromotions();
    }
  }, [cart]);

  return (
    <div>
      <h2>Cart Total: {cartTotal} MAD</h2>
      <h3>Promotions Applied: {promotions.length}</h3>
      <h3>Total Discount: {totalDiscount} MAD</h3>
      <h2>Final Total: {cartTotal - totalDiscount} MAD</h2>

      {promotions.map(promo => (
        <div key={promo.promotion_id} className="promo-badge">
          <strong>{promo.promotion_name}</strong>
          <span>-{promo.total_discount} MAD</span>
        </div>
      ))}
    </div>
  );
}
```

### Vue Example

```vue
<template>
  <div class="promotion-calculator">
    <div class="cart-summary">
      <h2>Cart Total: {{ cartTotal }} MAD</h2>
      <h3>Promotions: {{ appliedPromotions.length }}</h3>
      <h3>Discount: {{ totalDiscount }} MAD</h3>
      <h2>Final: {{ finalTotal }} MAD</h2>
    </div>

    <div v-for="promo in appliedPromotions" :key="promo.promotion_id" class="promo-badge">
      <strong>{{ promo.promotion_name }}</strong>
      <span>-{{ promo.total_discount }} MAD</span>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      cart: [],
      appliedPromotions: [],
      totalDiscount: 0
    };
  },
  computed: {
    cartTotal() {
      return this.cart.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    },
    finalTotal() {
      return this.cartTotal - this.totalDiscount;
    }
  },
  watch: {
    cart: {
      handler() {
        this.calculatePromotions();
      },
      deep: true
    }
  },
  methods: {
    async calculatePromotions() {
      const response = await fetch('/api/promotions/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          partner_code: this.partnerCode,
          line_items: this.cart.map(item => ({
            product_code: item.code,
            quantity: item.quantity,
            price: item.price
          }))
        })
      });

      const data = await response.json();
      if (data.success) {
        this.appliedPromotions = data.data.promotions;
        this.totalDiscount = data.data.total_discount;
      }
    }
  }
};
</script>
```

### Display Promotion Badge

```jsx
function PromotionBadge({ promotion }) {
  return (
    <div className="promotion-badge">
      <div className="badge-header">
        <span className="badge-icon">🎁</span>
        <strong>{promotion.promotion_name}</strong>
      </div>
      <div className="badge-discount">
        -{promotion.total_discount} MAD
      </div>
      {promotion.lines.map(line => (
        <div key={line.line_number} className="badge-detail">
          {line.name}: {line.discount} MAD
        </div>
      ))}
    </div>
  );
}
```

---

## 🧪 Testing Guide

### Test Scenarios

#### 1. Simple Percentage Discount
```bash
curl -X POST http://localhost:8000/api/promotions/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "partner_code": "PARTNER001",
    "line_items": [
      {"product_code": "PROD001", "quantity": 10, "price": 150}
    ]
  }'
```

#### 2. Multi-Tier Promotion
```bash
curl -X POST http://localhost:8000/api/promotions/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "partner_code": "PARTNER001",
    "line_items": [
      {"product_code": "PROD001", "quantity": 50, "price": 100}
    ]
  }'
```

#### 3. Assortment Requirement
```bash
curl -X POST http://localhost:8000/api/promotions/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "partner_code": "PARTNER001",
    "line_items": [
      {"product_code": "PROD_A", "quantity": 10, "price": 100},
      {"product_code": "PROD_B", "quantity": 5, "price": 150}
    ]
  }'
```

### Validation Tests

```javascript
// Test 1: Minimum value not met
{
  "line_items": [{"product_code": "PROD001", "quantity": 1, "price": 100}]
}
// Expected: No promotions applied

// Test 2: Exact minimum value
{
  "line_items": [{"product_code": "PROD001", "quantity": 10, "price": 100}]
}
// Expected: Promotion applied

// Test 3: Multiple promotions
{
  "line_items": [
    {"product_code": "PROD001", "quantity": 20, "price": 100},
    {"product_code": "PROD002", "quantity": 15, "price": 150}
  ]
}
// Expected: Multiple promotions may apply
```

---

## 🔧 Troubleshooting

### Common Issues

#### Issue 1: Promotion Not Applying
**Symptoms:** Eligible promotion doesn't show in calculation

**Checklist:**
- ✅ Check date range (start_date <= now <= end_date)
- ✅ Verify promotion is not closed (is_closed = false)
- ✅ Check partner eligibility (partner families)
- ✅ Verify payment term dependency
- ✅ Check product/family targeting
- ✅ Verify minimum value threshold

**Debug:**
```bash
# Check eligible promotions
curl -X POST http://localhost:8000/api/promotions/test \
  -H "Content-Type: application/json" \
  -d '{"partner_code": "PARTNER001", "line_items": [...]}'
```

#### Issue 2: Wrong Discount Amount
**Symptoms:** Calculated discount doesn't match expected

**Checklist:**
- ✅ Verify promo_type (1-7)
- ✅ Check amount field value
- ✅ Verify breakpoint_type (value vs quantity)
- ✅ Check repeating flag
- ✅ Verify qualifying products

**Debug:**
```php
// Enable detailed logging
\Log::info('Promotion calculation', [
    'promotion_id' => $promotion->id,
    'total_value' => $totalValue,
    'minimum_value' => $detail->minimum_value,
    'promo_type' => $detail->promo_type,
    'amount' => $detail->amount,
    'calculated_discount' => $discount
]);
```

#### Issue 3: Assortment Not Working
**Symptoms:** Promotion requires product mix but doesn't apply

**Checklist:**
- ✅ Verify assortment_type (0, 1, 2, 3)
- ✅ Check assortment minimum values
- ✅ Verify product codes in assortments
- ✅ Check AND vs OR logic

**Debug:**
```php
// Check assortment calculation
foreach ($line->assortments as $assortment) {
    $qty = $this->calculateAssortmentQuantity($assortment, $qualifyingItems);
    \Log::info('Assortment check', [
        'product_code' => $assortment->product_code,
        'minimum' => $assortment->minimum,
        'actual_qty' => $qty,
        'met' => $qty >= $assortment->minimum
    ]);
}
```

### Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| `Validation failed` | Invalid request format | Check API documentation |
| `Promotion not found` | Invalid promotion ID | Verify promotion exists |
| `Partner not eligible` | Partner not in target group | Check partner families |
| `No qualifying products` | Products don't match criteria | Verify product/family codes |
| `Minimum not met` | Cart value/quantity too low | Check breakpoint thresholds |

---

## 📊 Analytics & Reporting

### Usage Statistics

```php
// Get promotion usage stats
$stats = DB::table('invoice_promotion_details')
    ->where('promotion_id', $promotionId)
    ->select(
        DB::raw('COUNT(DISTINCT invoice_code) as invoice_count'),
        DB::raw('SUM(discount) as total_discount'),
        DB::raw('AVG(discount) as avg_discount'),
        DB::raw('MAX(discount) as max_discount'),
        DB::raw('MIN(discount) as min_discount')
    )
    ->first();
```

### Top Performing Promotions

```php
$topPromotions = DB::table('invoice_promotion_details')
    ->join('promotions', 'promotions.id', '=', 'invoice_promotion_details.promotion_id')
    ->select(
        'promotions.code',
        'promotions.name',
        DB::raw('COUNT(DISTINCT invoice_code) as usage_count'),
        DB::raw('SUM(discount) as total_discount')
    )
    ->groupBy('promotions.id', 'promotions.code', 'promotions.name')
    ->orderByDesc('total_discount')
    ->limit(10)
    ->get();
```

---

## 🎯 Best Practices

### 1. Promotion Naming
- Use clear, descriptive names
- Include date range in name (e.g., "Winter Sale 2024")
- Use consistent code format (e.g., PROMO_YYYY_MM)

### 2. Sequence Management
- Lower sequence = higher priority
- Leave gaps (10, 20, 30) for future insertions
- Document sequence logic

### 3. Testing
- Always test with `save_to_document: false` first
- Test edge cases (exact minimum, just below minimum)
- Test with multiple products
- Test repeating logic

### 4. Performance
- Use product families instead of individual products when possible
- Limit number of active promotions
- Archive expired promotions
- Index frequently queried fields

### 5. Partner Communication
- Clearly communicate promotion rules
- Provide examples of discount calculation
- Show breakpoint tiers visually
- Display eligible products

---

## 📚 Additional Resources

- **Database Schema:** `database/migrations/2025_11_15_235539_create_promotions_table.php`
- **Promotion Engine:** `app/Services/PromotionEngine.php`
- **API Controller:** `app/Http/Controllers/API/PromotionCalculationController.php`
- **Backend Controller:** `app/Http/Controllers/Backend/PromotionController.php`
- **Models:** `app/Models/Promotion*.php`

---

**Version:** 1.0.0  
**Last Updated:** December 16, 2024  
**Status:** ✅ Production Ready
