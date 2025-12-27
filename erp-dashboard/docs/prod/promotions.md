# Promotion System - Complete Developer Guide

## 📋 Table of Contents

1. [Overview](#-overview)
2. [System Architecture](#-system-architecture)
3. [Promotion Types & Logic](#-promotion-types--logic)
4. [New: Burning Promotions (Points)](#-new-burning-promotions-points-redemption)
5. [API Quick Reference](#-api-quick-reference)
6. [Detailed API Endpoints](#-detailed-api-endpoints)
7. [Request & Payload Examples](#-request--payload-examples)
8. [Calculation Engine](#-calculation-engine)
9. [Frontend Integration](#-frontend-integration)
10. [Testing & Troubleshooting](#-testing--troubleshooting)

---

## 🎯 Overview

The ERP Promotion System is a comprehensive, flexible engine for managing complex promotional campaigns. It supports multiple discount types, breakpoint-based pricing, product/family targeting, partner segmentation, automatic calculation, and **Points Redemption (Burning)**.

### Key Features

✅ **7 Promotion Types** - Percentage, Fixed Amount, Free Goods, Best Price, Replace Price, etc.  
✅ **Flexible Targeting** - By product, product family, or entire cart  
✅ **Breakpoint System** - Value-based (MAD) or Quantity-based thresholds  
✅ **Partner Segmentation** - Target specific customer groups via Partner Families  
✅ **Assortment Rules** - Require product mix (AND/OR logic)  
✅ **Burning/Points** - Redeem partner balances for rewards  
✅ **Payment Term Dependent** - Promotions based on payment conditions  
✅ **Automatic Calculation** - Real-time discount computation  
✅ **Repeating Promotions** - Apply discount multiple times  

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

partner_balances (New)
└── Used for Burning Promotions (Points/Budget)
```

---

## 💳 Managing Partner Balances

The Burning Promotion logic relies on the `partner_balances` table. This table tracks the available "currency" for each partner.

### Schema Structure
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | INT | Primary Key |
| `partner_code` | VARCHAR | Link to Partner |
| `balance_code` | VARCHAR | Type of balance (e.g., 'POINTS', 'BUDGET') |
| `amount` | DECIMAL | Current available amount |
| `updated_at` | DATETIME | Last modification |

### Balance Types (Standard)
- **POINTS**: Loyalty points earned from purchases.
- **BUDGET**: Marketing budget allocated to the partner.
- **WALLET**: Prepaid wallet or credit notes.

### API Endpoints
- `GET /api/partners/{code}/balances`: Get all balances for a partner.
- `POST /api/partners/{code}/balances`: Credit/Debit a balance (manual adjustment).

---

## 💰 Promotion Types & Logic

### Promotion Types (`promo_type`)

| Type | ID | Description | C# Equivalent |
| :--- | :--- | :--- | :--- |
| **Percentage** | 1 | Discount a percentage of the line amount. | `cstDTPerc` |
| **Amount (Fixed)** | 2 | Discount a fixed amount per unit/line. | `cstDTAmount` |
| **Free Unit** | 3 | Give free goods (same product). | `cstDTFree` |
| **Amount Per Unit** | 4 | Discount amount per unit. | `cstDTAmountPerUnit` |
| **Promo Unit** | 5 | Give different product as free good. | `cstBPTPromoUnit` |
| **Flat Amount** | 6 | Fixed global discount amount. | `cstDTFlatAmount` |
| **Replace Price** | 7 | Force unit price to a specific value. | `cstDTSpecialPrice` |

### Breakpoint Types (`breakpoint_type`)
Determines how the "level" is reached.
- **Value-Based (1)**: Based on total monetary value (Price * Qty) of eligible products.
- **Quantity-Based (2)**: Based on total quantity of eligible products.
- **Promo-Unit-Based (3)**: Custom unit calculation.

### Scale Methods (`scale_method`)
- **Cumulative (1)**: "Every X units". Example: Buy 10 get 1 free. Buy 20 get 2 free. (Logic: `floor(qty / min)`)
- **Bracket (2)**: Tiered. Example: Buy 10-19 get 5%, Buy 20+ get 10%. Only the highest matched tier applies.

---

## 🔥 New: Burning Promotions (Points Redemption)

Allows partners to "spend" a balance (e.g., Points, Budget, Wallet) to get a reward.

### Configuration
1.  **`is_burning_promo`**: Set to `true`.
2.  **`based_on_burned`**: The code of the balance to burn (e.g., `"POINTS"`, `"BUDGET"`).
3.  **Logic**:
    *   The system checks `partner_balances` for availability.
    *   It calculates the **Consumed Quantity** (Cost) based on the rule.
        *   *Cumulative*: Burns `Cost` * `Multiples`.
        *   *Bracket*: Burns `Cost` of the tier.
    *   It **deducts** the cost from the partner's balance.
    *   It **grants** the reward (Discount/Free Item).

### Example JSON
```json
{
  "code": "BURN_POINTS_DISCOUNT",
  "name": "Redeem 100 Points for 50 MAD Off",
  "is_burning_promo": true,
  "based_on_burned": "POINTS",
  "breakpoint_type": 2, 
  "lines": [{
    "details": [{
      "minimum_value": 100,
      "promo_type": 2, 
      "amount": 50,
      "repeating": true 
    }]
  }]
}
```
*Effect: For every 100 items (points) in `breakpoint_quantity`, burn 100 points and give 50 MAD.*

---

## ⚡ API Quick Reference

### Base URL: `http://localhost:8000/api`
**Auth**: `Authorization: Bearer {token}`

#### Backend Management (`/api/backend/promotions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/promotions` | List all promotions |
| GET | `/promotions/{id}` | Get details |
| POST | `/promotions` | Create promotion |
| PUT | `/promotions/{id}` | Update promotion |
| DELETE | `/promotions/{id}` | Delete promotion |
| POST | `/promotions/{id}/clone` | Clone promotion |

#### Families & Boosts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/product-families` | Manage product groups |
| GET/POST | `/partner-families` | Manage partner groups |
| GET/POST | `/boosts` | Manage logic boosts |
| POST | `/boosts/bulk-sync` | Sync boosts in bulk |

#### Calculation (Public/Frontend) (`/api/promotions`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calculate` | Calculate cart discounts (Cart/Checkout) |
| GET | `/my-promotions` | List active promos for user |
| POST | `/test` | Dry-run test |

---

## 📝 Request & Payload Examples

### 1. Create Complex Promotion (Partner Family + Assortment)
```json
{
  "code": "VIP_MIX_MATCH",
  "name": "VIP Mix & Match",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  "breakpoint_type": 2,
  "partner_families": ["VIP_CUSTOMERS"],
  "lines": [{
    "name": "Buy 5 A + 3 B get 20% off",
    "assortment_type": "multiple",
    "assortments": [
      {"based_on_product": true, "product_code": "PROD_A", "minimum": 5},
      {"based_on_product": true, "product_code": "PROD_B", "minimum": 3}
    ],
    "details": [{
      "promo_type": 1,
      "minimum_value": 1, 
      "amount": 20
    }]
  }]
}
```

### 2. Create Partner Family (Dynamic Condition)
```json
{
  "code": "CASABLANCA_HIGH_LIMIT",
  "name": "Casa High Credit",
  "partner_condition": "city = 'Casablanca' AND credit_limit > 50000",
  "partners": ["MANUAL_OVERRIDE_PARTNER"]
}
```

### 3. Calculate Promotions (Checkout with Persistence)
**Endpoint**: `POST /api/promotions/calculate`
```json
{
  "partner_code": "CUST001",
  "payment_term_code": "PT30",
  "date": "2025-01-01",
  "save_to_document": true, 
  "document_code": "INV-10023",
  "document_type": "invoice",
  "line_items": [
    { "product_code": "PROD_A", "quantity": 10, "price": 100 },
    { "product_code": "PROD_B", "quantity": 5, "price": 50 }
  ]
}
```
*Note: Setting `save_to_document: true` will save the detailed breakdown to `order_promotion_details` table.*

---

## 💻 Frontend Integration

### Best Practices
1.  **Cart Page**: Call `/calculate` with `save_to_document: false` every time the cart is updated (debounce: 500ms). Display `total_discount` and individual line discounts.
2.  **Checkout**: Call `/calculate` with `save_to_document: true` only when the user clicks "Place Order".
3.  **Banners**: Use `/my-promotions` to fetch active deals and display them on the dashboard.

### Response Handling
```javascript
// Example API Response handling
const result = await api.post('/promotions/calculate', cartData);
if (result.success) {
    const { total_discount, promotions } = result.data;
    // Show total discount
    updateCartTotal(cartTotal - total_discount);
    
    // Show applied promos
    promotions.forEach(promo => {
        showToast(`Applied: ${promo.promotion_name}`);
    });
}
```

---

## 🧪 Testing & Troubleshooting

### Postman Collection
Import `docs/PROMOTIONS_POSTMAN_COLLECTION.json` for a pre-configured suite of 25+ requests covering all scenarios.

### Common Issues
1.  **Promotion Not Applying?**
    *   Check `start_date` and `end_date`.
    *   Check `partner_families` - is the partner in the group?
    *   Check `payment_term_dependent` - did you send the correct `payment_term_code`?
    *   Check `is_closed` flag.
2.  **Burning Not Working?**
    *   Ensure partner has entries in `partner_balances`.
    *   Ensure `based_on_burned` matches the code in DB.
3.  **Wrong Amount?**
    *   Check `scale_method`. Cumulative vs Bracket behaves differently for repeating rules.

---
**Version:** 1.5.0 (Production Ready)  
**Last Updated:** December 27, 2025  
