

# Fix: Import Integer Type Handling

## Problem

The import failed with:
```
invalid input syntax for type integer: "80.60961834040972"
```

This is a longitude value being inserted into the `guests` column (which is type `integer` in PostgreSQL).

## Root Causes

1. **Type Mismatch**: The `parseNumericField` helper uses `parseFloat()` which returns decimals, but `guests` and `bedrooms` are integer columns in the database

2. **Possible Mapping Issue**: A column containing coordinate data may be incorrectly mapped to `guests` in the Import Wizard UI

## Solution

### 1. Fix Numeric Parsing for Integer Fields

Update `useImportProperties.ts` to use proper integer parsing for integer columns:

```text
// Current (problematic):
guests: parseNumericField(row.guests) || null,
bedrooms: parseNumericField(row.bedrooms),

// Fixed:
guests: row.guests ? Math.floor(parseNumericField(row.guests)) : null,
bedrooms: Math.floor(parseNumericField(row.bedrooms)),
```

This ensures:
- Floats are converted to integers before database insert
- Values like "2.0 bathrooms" become `2` not `2.0`
- If a longitude accidentally gets mapped, it will at least not cause a type error

### 2. Add parseIntegerField Helper

Create a dedicated helper for integer columns:

```text
const parseIntegerField = (value: any): number => {
  if (!value) return 0;
  if (typeof value === 'number') return Math.floor(value);
  const str = String(value);
  const match = str.match(/[\d.]+/);
  return match ? Math.floor(parseFloat(match[0])) : 0;
};
```

### 3. Apply to All Integer Fields

| Field | Current | Fixed |
|-------|---------|-------|
| `bedrooms` | `parseNumericField` | `parseIntegerField` |
| `guests` | `parseNumericField` | `parseIntegerField` |
| `bathrooms` | `parseNumericField` | Keep as-is (numeric type supports decimals) |

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useImportProperties.ts` | Add `parseIntegerField` helper and use it for `bedrooms` and `guests` |

## Recommendation

Before re-importing, please also **verify your column mappings** in the Import Wizard preview step. Check that:
- `coordinates/longitude` maps to **Longitude** (not Guests)
- `subDescription/items/0` maps to **Max Guests** 

This ensures the correct data goes to the correct fields.

