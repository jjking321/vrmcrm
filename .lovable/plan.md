
# Fix Highway Suffix Extraction from City Field

## Problem

A new malformed data pattern was discovered where:
- **Street address**: `84773 Old` (incomplete - missing highway suffix)
- **City field**: `Hwy Islamorada` (highway suffix + actual city)

The full address should be "84773 Old Hwy" with city "Islamorada".

### Current Behavior

```text
Input:   Address: "84773 Old", City: "Hwy Islamorada"
Output:  Address: "84773 Old", City: "Hwy Islamorada" (unchanged - bug)
```

### Expected Behavior

```text
Input:   Address: "84773 Old", City: "Hwy Islamorada"
Output:  Address: "84773 Old Hwy", City: "Islamorada"
```

## Solution

Add a new pattern to detect when the **city field starts with a highway-related suffix** (HWY, HIGHWAY, RTE, ROUTE) followed by a space and city name. When detected, move the suffix to the end of the street address.

This is similar to the existing directional pattern (NE, SW, etc.) but specifically for highway suffixes.

## Technical Implementation

### File: `src/lib/mailingAddress.ts`

Add a new pattern after `DIRECTIONAL_IN_CITY_PATTERN`:

```typescript
/**
 * Pattern to detect highway/route suffix at start of city field
 * Matches: "Hwy Islamorada", "Highway Tampa", "Rte Boston"
 * Captures: [1] highway suffix, [2] remaining city name
 */
const HIGHWAY_IN_CITY_PATTERN = /^(HIGHWAY|HWY|ROUTE|RTE)\s+(.+)$/i;
```

Add extraction logic after the directional check in `deriveMailingFields()`:

```typescript
// Check for highway suffix in city: "Hwy Islamorada" -> "Islamorada"
const highwayMatch = mailingCity.match(HIGHWAY_IN_CITY_PATTERN);
if (highwayMatch) {
  const [, highwaySuffix, cleanCityName] = highwayMatch;
  // Append highway suffix to street address
  mailingAddress = `${mailingAddress} ${highwaySuffix.charAt(0).toUpperCase() + highwaySuffix.slice(1).toLowerCase()}`;
  mailingCity = toTitleCase(cleanCityName.trim());
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/mailingAddress.ts` | Add highway suffix detection pattern and extraction logic |

### Test Cases

| Street Input | City Input | Expected Address | Expected City |
|--------------|------------|------------------|---------------|
| `84773 Old` | `Hwy Islamorada` | `84773 Old Hwy` | `Islamorada` |
| `100 State` | `Highway Tampa` | `100 State Highway` | `Tampa` |
| `500 County` | `Rte Boston` | `500 County Rte` | `Boston` |
| `200 Main St` | `Miami` | `200 Main St` | `Miami` (no change) |

### Processing Order (Updated)

The extraction checks will run in this order:
1. Unit/PO Box prefix in city (e.g., `"PMB 1033 Fort Worth"`)
2. Split PO Box number in city (e.g., Address: `"PO Box"`, City: `"2699 Springfield"`)
3. Directional prefix in city (e.g., `"NE Minneapolis"`)
4. Highway suffix in city (e.g., `"Hwy Islamorada"`) - **NEW**
5. Apply title case if no extraction happened
