
# Fix Route/Highway Number Extraction from City Field

## Problem

**3 records** have highway/route addresses where the route number is incorrectly stored in the city field:

| Name | Current Address | Current City | Expected Address | Expected City |
|------|-----------------|--------------|------------------|---------------|
| Joel Althoff | `21998 BUSINESS HIGHWAY` | `151 MONTICELLO` | `21998 Business Highway 151` | `Monticello` |
| Michael Leach | `11988 STATE ROUTE` | `23 WINDHAM` | `11988 State Route 23` | `Windham` |
| Tiffany Sharp | `420 COUNTY ROAD` | `793 BROOKLAND` | `420 County Road 793` | `Brookland` |

The existing split PO Box logic only handles unit prefixes (PO BOX, PMB, etc.), not highway/road suffixes.

## Solution

Extend the split detection logic to also handle addresses ending with road-type suffixes (HIGHWAY, ROUTE, ROAD, STREET, etc.) when the city starts with a number.

## Technical Implementation

### File: `src/lib/mailingAddress.ts`

**Add new pattern after `STREET_ENDS_WITH_UNIT_PATTERN` (line 27):**

```typescript
/**
 * Pattern to check if street address ends with a road suffix (without route number)
 * Matches: "420 County Road", "11988 State Route", "21998 Business Highway"
 */
const STREET_ENDS_WITH_ROAD_SUFFIX_PATTERN = /(HIGHWAY|HWY|ROUTE|RTE|ROAD|RD|STREET|ST)\s*$/i;
```

**Update the extraction logic (around lines 185-202):**

Add handling for the road suffix case alongside the existing unit prefix case:

```typescript
// Check for split PO Box: street ends with prefix, city starts with number
// e.g., Address: "PO Box", City: "2699 Springfield"
const streetEndsWithUnit = mailingAddress.match(STREET_ENDS_WITH_UNIT_PATTERN);
const cityStartsWithNumber = mailingCity.match(NUMBER_IN_CITY_PATTERN);

if (streetEndsWithUnit && cityStartsWithNumber) {
  const [, unitNumber, cleanCityName] = cityStartsWithNumber;
  mailingAddress = `${toTitleCase(mailingAddress)} ${unitNumber}`;
  mailingCity = toTitleCase(cleanCityName.trim());
} else {
  // Check for split route/road: street ends with road suffix, city starts with number
  // e.g., Address: "420 COUNTY ROAD", City: "793 BROOKLAND"
  const streetEndsWithRoadSuffix = mailingAddress.match(STREET_ENDS_WITH_ROAD_SUFFIX_PATTERN);
  if (streetEndsWithRoadSuffix && cityStartsWithNumber) {
    const [, routeNumber, cleanCityName] = cityStartsWithNumber;
    mailingAddress = `${toTitleCase(mailingAddress)} ${routeNumber}`;
    mailingCity = toTitleCase(cleanCityName.trim());
  } else {
    // Apply title case if no extraction happened
    mailingAddress = toTitleCase(mailingAddress);
    if (mailingCity) {
      mailingCity = toTitleCase(mailingCity);
    }
  }
}
```

### Processing Order (Updated)

1. Unit/PO Box prefix in city (e.g., `"PMB 1033 Fort Worth"`)
2. Split PO Box number in city (e.g., Address: `"PO Box"`, City: `"2699 Springfield"`)
3. **Split Route number in city** (e.g., Address: `"420 County Road"`, City: `"793 Brookland"`) - **NEW**
4. Directional prefix in city (e.g., `"NE Minneapolis"`)
5. Highway suffix in city (e.g., `"Hwy Islamorada"`)
6. Apply title case if no extraction happened

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/mailingAddress.ts` | Add road suffix pattern and extraction logic |

### Test Cases

| Street Input | City Input | Expected Address | Expected City |
|--------------|------------|------------------|---------------|
| `21998 BUSINESS HIGHWAY` | `151 MONTICELLO` | `21998 Business Highway 151` | `Monticello` |
| `11988 STATE ROUTE` | `23 WINDHAM` | `11988 State Route 23` | `Windham` |
| `420 COUNTY ROAD` | `793 BROOKLAND` | `420 County Road 793` | `Brookland` |
| `PO BOX` | `2699 SPRINGFIELD` | `PO Box 2699` | `Springfield` (existing) |
| `200 Main St` | `Miami` | `200 Main St` | `Miami` (no change) |

### Bonus: Cleanup Debug Logs

The plan also includes removing the `console.log` debug statements added for directional and highway suffix detection (lines 207, 213, 224) once the fix is verified.
