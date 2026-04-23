# Promotion Sequence & Skip Logic - Implementation Guide

## Overview

The promotion system uses two critical fields to control promotion evaluation order and stacking behavior:

1. **`sequence`** - Determines evaluation order (lower = higher priority)
2. **`skip_to_sequence`** - Controls which subsequent promotions are blocked

## How It Works

### Evaluation Flow

```
1. Fetch all active promotions ordered by sequence ASC
2. Initialize skipToSequence = 0
3. For each promotion:
   a. If promotion.sequence < skipToSequence → SKIP (don't evaluate)
   b. Otherwise, evaluate promotion conditions
   c. If promotion APPLIES → update skipToSequence = promotion.skip_to_sequence
   d. Continue to next promotion
```

### Key Rules

- **Sequence**: Lower number = Higher priority (evaluated first)
- **Skip Updates**: Only when promotion **actually applies** (not just evaluated)
- **Skip Value 0**: No skip, allow all subsequent promotions
- **Skip Value > 0**: Skip all promotions with sequence < skip_to_sequence

## UI Implementation

### Form Fields

**Location**: `PromotionFormRedesigned.tsx` - General Section

```tsx
{/* Sequence Field */}
<input
    type="number"
    {...register('sequence', { valueAsNumber: true, required: true })}
    placeholder="10"
    min="1"
/>
// Help text: Plus petit = Plus prioritaire (1-10: VIP, 11-20: Premium, 21-30: Standard, 100+: Toujours actif)

{/* Skip to Sequence Field */}
<input
    type="number"
    {...register('skip_to_sequence', { valueAsNumber: true })}
    placeholder="0"
    min="0"
/>
// Help text explains: 0 = No skip, >0 = Block, 999 = Exclusive
```

## Recommended Sequence Ranges

| Range | Purpose | Example Use Cases |
|-------|---------|-------------------|
| 1-10 | Exclusive/VIP | VIP-only promotions that block everything |
| 11-20 | Premium Tier | Premium customer promotions |
| 21-30 | Standard Tier | Regular customer promotions |
| 31-40 | Clearance | Special clearance offers |
| 41-50 | Category-specific | Product category promotions |
| 51-99 | General | General promotions |
| 100+ | Always-apply | Loyalty points, always-active programs |

## Common Scenarios

### Scenario 1: Exclusive VIP Promotion

**Business Rule**: "VIP customers get 30% off and cannot combine with other promotions"

```json
{
    "code": "VIP_EXCLUSIVE",
    "sequence": 10,
    "skip_to_sequence": 999,
    "partner_families": ["VIP_PARTNERS"],
    "lines": [{
        "paid_based_on_product": "cart",
        "details": [{
            "promo_type": 1,
            "minimum_value": 1,
            "amount": -30
        }]
    }]
}
```

**Result**:
- VIP customer: Gets 30%, all other promos (seq 11-998) are skipped ✅
- Regular customer: VIP promo doesn't apply, other promos work normally ✅

### Scenario 2: Tiered Promotions

**Business Rule**: "Premium tier blocks standard tier, but both allow clearance"

```json
// Premium (blocks Standard)
{
    "code": "PREMIUM_TIER",
    "sequence": 10,
    "skip_to_sequence": 30,
    "partner_families": ["PREMIUM_PARTNERS"]
}

// Standard (would be skipped if Premium applies)
{
    "code": "STANDARD_TIER",
    "sequence": 20,
    "skip_to_sequence": 0,
    "partner_families": ["STANDARD_PARTNERS"]
}

// Clearance (always evaluated)
{
    "code": "CLEARANCE",
    "sequence": 30,
    "skip_to_sequence": 0
}
```

**Execution Flow**:

**Premium Customer**:
```
1. Premium (seq=10) → Applies ✅ → skipToSequence = 30
2. Standard (seq=20) → 20 < 30 → SKIP ❌
3. Clearance (seq=30) → 30 >= 30 → Applies ✅
Result: Premium + Clearance
```

**Standard Customer**:
```
1. Premium (seq=10) → Doesn't qualify ❌ → skipToSequence = 0
2. Standard (seq=20) → Applies ✅ → skipToSequence = 0
3. Clearance (seq=30) → Applies ✅
Result: Standard + Clearance
```

### Scenario 3: Stackable Promotions

**Business Rule**: "Allow multiple promotions to stack"

```json
{
    "code": "PROMO_STACK_1",
    "sequence": 10,
    "skip_to_sequence": 0  // ← Key: No skip
}

{
    "code": "PROMO_STACK_2",
    "sequence": 20,
    "skip_to_sequence": 0  // ← Key: No skip
}
```

**Result**: Both promotions apply and stack

### Scenario 4: Black Friday Special

**Business Rule**: "Black Friday blocks regular promos but allows loyalty"

```json
// Black Friday
{
    "code": "BLACK_FRIDAY",
    "sequence": 5,
    "skip_to_sequence": 100  // Skip everything except loyalty
}

// Regular promos (seq 6-99) would be skipped

// Loyalty (always applies)
{
    "code": "LOYALTY_POINTS",
    "sequence": 100,
    "skip_to_sequence": 0
}
```

## Skip Strategy Table

| Scenario | Sequence | Skip To | Effect |
|----------|----------|---------|--------|
| Exclusive promo | 10 | 999 | Blocks everything |
| Tier-based | 10 | 30 | Blocks same tier |
| Stackable | 10 | 0 | Allows all |
| Category block | 20 | 50 | Blocks category promos |
| No restriction | Any | 0 | Normal flow |

## Testing Checklist

### Test Case 1: VIP vs Regular
- [ ] Create VIP promo (seq=10, skip=999)
- [ ] Create Regular promo (seq=20, skip=0)
- [ ] Test with VIP partner → Should get VIP only
- [ ] Test with Regular partner → Should get Regular only

### Test Case 2: Verify Skip Only on Apply
- [ ] Create promo with minimum_value=100, seq=10, skip=50
- [ ] Test with cart total 50 → Promo doesn't apply → Other promos work
- [ ] Test with cart total 150 → Promo applies → Promos 11-49 are skipped

### Test Case 3: Tiered Promotions
- [ ] Create Premium (seq=10, skip=30)
- [ ] Create Standard (seq=20, skip=0)
- [ ] Create Clearance (seq=30, skip=0)
- [ ] Test with Premium partner → Premium + Clearance
- [ ] Test with Standard partner → Standard + Clearance

### Test Case 4: Stackable Promotions
- [ ] Create Promo1 (seq=10, skip=0)
- [ ] Create Promo2 (seq=20, skip=0)
- [ ] Test → Both should apply and stack

## Common Pitfalls

### ❌ Don't Do This

1. **Don't set skip_to_sequence = own sequence**
   ```json
   { "sequence": 10, "skip_to_sequence": 10 }  // ❌ Will skip itself
   ```

2. **Don't use same sequence for conflicting promos**
   ```json
   { "code": "PROMO_A", "sequence": 10 }
   { "code": "PROMO_B", "sequence": 10 }  // ❌ Unpredictable order
   ```

3. **Don't forget to test skip logic**
   - Always test with different partner types
   - Verify skip only happens when promo applies

### ✅ Do This

1. **Plan sequence ranges before implementation**
   - Document your sequence strategy
   - Reserve ranges for different tiers

2. **Use 0 for stackable promotions**
   ```json
   { "sequence": 10, "skip_to_sequence": 0 }  // ✅ Allows stacking
   ```

3. **Use 999 for exclusive promotions**
   ```json
   { "sequence": 10, "skip_to_sequence": 999 }  // ✅ Blocks everything
   ```

4. **Document your skip strategy**
   - Add comments explaining why certain skip values are used
   - Maintain a sequence allocation table

## API Payload Example

```json
{
    "code": "VIP_WINTER_2026",
    "name": "VIP Winter Exclusive",
    "description": "Exclusive VIP promotion - blocks all other promotions",
    "start_date": "2026-01-01",
    "end_date": "2026-03-31",
    "sequence": 10,
    "skip_to_sequence": 999,
    "breakpoint_type": 1,
    "scale_method": 2,
    "partner_families": ["VIP_PARTNERS"],
    "lines": [{
        "name": "VIP Rule",
        "paid_based_on_product": "cart",
        "assortment_type": "none",
        "details": [{
            "promo_type": 1,
            "minimum_value": 1,
            "amount": -30,
            "repeating": true
        }]
    }]
}
```

## Backend Implementation Notes

The backend should implement the skip logic in the promotion evaluation engine:

```php
// Pseudo-code
$skipToSequence = 0;
foreach ($promotions->orderBy('sequence') as $promo) {
    if ($promo->sequence < $skipToSequence) {
        continue; // Skip this promotion
    }
    
    if ($this->evaluatePromotion($promo, $cart)) {
        $this->applyPromotion($promo, $cart);
        $skipToSequence = $promo->skip_to_sequence ?? 0;
    }
}
```

## Summary

The `skip_to_sequence` field is **CRITICAL** for:
- ✅ Creating exclusive VIP promotions
- ✅ Implementing tiered promotion systems
- ✅ Controlling promotion stacking behavior
- ✅ Managing special event promotions (Black Friday, etc.)
- ✅ Preventing unwanted promotion combinations

**Without this field, you cannot create complex promotion scenarios that are common in real-world business requirements.**
