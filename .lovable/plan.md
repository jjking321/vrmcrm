
# Fix PO Box Number Extraction from City Field

## Problem

A new malformed data pattern was discovered where:
- **Street address**: `"PO Box"` (just the prefix, no number)
- **City field**: `"2699 Springfield"` (the PO Box number + actual city)

The current `UNIT_IN_CITY_PATTERN` regex only matches when the city **starts with** a recognized prefix (PMB, PO BOX, APT, etc.). It doesn't handle the case where the street address already contains the prefix and the city contains the number.

### Current Pattern Limitation

```text
Current regex: /^(PMB|P\.?O\.?\s*BOX|APT\.?|...)\s*([A-Z0-9]+)\s+(.+)$/i

Matches:     "PMB 1033 FORT WORTH"  → ✓ Extracts PMB 1033
Matches:     "PO BOX 456 ORLANDO"   → ✓ Extracts PO Box 456
Does NOT:    "2699 Springfield"     → ✗ No prefix detected
```

## Solution

Add logic to detect when the **street address ends with a unit prefix** and the **city starts with a number**. In this case, extract the number from the city and append it to the street address.

### Detection Pattern

```text
Street ends with: "PO Box", "PO BOX", "PMB", "Apt", "Suite", "Unit", "#"
City starts with: Number followed by space and remaining city name
```

### Example Fix

| Before | After |
|--------|-------|
| Address: `PO Box`, City: `2699 Springfield` | Address: `PO Box 2699`, City: `Springfield` |

## Technical Implementation

### File: `src/lib/mailingAddress.ts`

Add a new pattern and extraction function:

```typescript
/**
 * Pattern to detect number at start of city when street ends with unit prefix
 * Matches: "2699 Springfield", "123 Main City Name"
 * Captures: [1] number, [2] remaining city name
 */
const NUMBER_IN_CITY_PATTERN = /^(\d+)\s+(.+)$/;

/**
 * Pattern to check if street address ends with a unit prefix (without number)
 */
const STREET_ENDS_WITH_UNIT_PATTERN = /(PO\s*BOX|P\.?O\.?\s*BOX|PMB|APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*$/i;
```

Update `deriveMailingFields()` to handle this case:

```typescript
// After existing unit extraction logic, add:

// Check for split PO Box: street ends with prefix, city starts with number
if (!unitExtraction) {
  const streetEndsWithUnit = mailingAddress.match(STREET_ENDS_WITH_UNIT_PATTERN);
  const cityStartsWithNumber = mailingCity.match(NUMBER_IN_CITY_PATTERN);
  
  if (streetEndsWithUnit && cityStartsWithNumber) {
    const [, unitNumber, cleanCityName] = cityStartsWithNumber;
    // Append number to street address
    mailingAddress = `${toTitleCase(mailingAddress)} ${unitNumber}`;
    mailingCity = toTitleCase(cleanCityName.trim());
  }
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/mailingAddress.ts` | Add split PO Box detection pattern and extraction logic |

### Test Cases

| Street Input | City Input | Expected Address | Expected City |
|--------------|------------|------------------|---------------|
| `PO Box` | `2699 Springfield` | `PO Box 2699` | `Springfield` |
| `PO BOX` | `123 Orlando` | `PO Box 123` | `Orlando` |
| `PMB` | `456 Fort Worth` | `PMB 456` | `Fort Worth` |
| `123 Main St` | `Springfield` | `123 Main St` | `Springfield` (no change) |

### Edge Cases

1. **Street has complete PO Box**: If street is `"PO Box 123"` and city is `"456 Springfield"`, don't extract - the PO Box already has a number
2. **City is just a number**: If city is `"12345"` (a ZIP code in wrong field), don't extract
3. **Preserves existing logic**: The new check only runs if the existing `extractUnitFromCity()` didn't find anything
