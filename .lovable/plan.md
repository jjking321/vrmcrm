

# Fix Directional Suffix Extraction from City Field

## Problem

A new malformed data pattern was discovered where:
- **Street address**: `125 121st Ave` (missing directional suffix)
- **City field**: `NE Minneapolis` (directional + actual city)

The directional suffix "NE" should be part of the address (`125 121st Ave NE`), but it got incorrectly placed at the start of the city field.

### Current Behavior

```text
Input:   Address: "125 121st Ave", City: "NE Minneapolis"
Output:  Address: "125 121st Ave", City: "NE Minneapolis" (unchanged - bug)
```

### Expected Behavior

```text
Input:   Address: "125 121st Ave", City: "NE Minneapolis"
Output:  Address: "125 121st Ave NE", City: "Minneapolis"
```

## Solution

Add logic to detect when the **city field starts with a directional prefix** (N, S, E, W, NE, NW, SE, SW) followed by a space and city name. When detected, move the directional to the end of the street address.

### Detection Pattern

```text
City starts with: N, S, E, W, NE, NW, SE, SW (case-insensitive)
Followed by: Space and remaining city name
```

## Technical Implementation

### File: `src/lib/mailingAddress.ts`

Add a new pattern to detect directional prefixes in city:

```typescript
/**
 * Pattern to detect directional prefix at start of city field
 * Matches: "NE Minneapolis", "SW Portland", "N Chicago"
 * Captures: [1] directional, [2] remaining city name
 */
const DIRECTIONAL_IN_CITY_PATTERN = /^(NE|NW|SE|SW|N|S|E|W)\s+(.+)$/i;
```

Update `deriveMailingFields()` to handle this case after the existing extraction logic:

```typescript
// Check for directional prefix in city: "NE Minneapolis" -> "Minneapolis"
const directionalMatch = mailingCity.match(DIRECTIONAL_IN_CITY_PATTERN);
if (directionalMatch) {
  const [, directional, cleanCityName] = directionalMatch;
  // Append directional to street address
  mailingAddress = `${mailingAddress} ${directional.toUpperCase()}`;
  mailingCity = toTitleCase(cleanCityName.trim());
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/mailingAddress.ts` | Add directional detection pattern and extraction logic |

### Test Cases

| Street Input | City Input | Expected Address | Expected City |
|--------------|------------|------------------|---------------|
| `125 121st Ave` | `NE Minneapolis` | `125 121st Ave NE` | `Minneapolis` |
| `500 Main St` | `SW Portland` | `500 Main St SW` | `Portland` |
| `100 Oak Dr` | `N Chicago` | `100 Oak Dr N` | `Chicago` |
| `200 Elm St` | `Minneapolis` | `200 Elm St` | `Minneapolis` (no change) |

### Edge Cases

1. **City name starts with directional-like word**: Need to ensure we don't incorrectly match cities like "Newport" or "Easton" - the pattern requires a space after the directional
2. **Already has directional in address**: If address is `"125 121st Ave NE"` and city is `"NE Minneapolis"`, we should still extract to avoid duplication (will result in `"125 121st Ave NE NE"` which is a data quality issue upstream)
3. **Works with other fixes**: This check runs after the PO Box and unit extraction logic

### Processing Order

The extraction checks will run in this order:
1. Unit/PO Box prefix in city (e.g., `"PMB 1033 Fort Worth"`)
2. Split PO Box number in city (e.g., Address: `"PO Box"`, City: `"2699 Springfield"`)
3. Directional prefix in city (e.g., `"NE Minneapolis"`) - **NEW**
4. Apply title case if no extraction happened

