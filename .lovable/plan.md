

# Handle Incomplete/Partial Canadian Postal Codes

## Problem

A Canadian address is not being parsed correctly because the postal code is incomplete:

| Field | Raw Data | Current Display | Expected |
|-------|----------|-----------------|----------|
| Address | `1359 DICKIE SETTLEMENT RD CAMBRIDGE ONTARIO N3H 4R` | `1359 Dickie Settlement Rd Cambridge Ontario N3h 4r` | `1359 Dickie Settlement Rd` |
| City | (null) | `Cocoa Beach` (property city fallback) | `Cambridge` |
| State | `XX` | `XX` | `ON` |
| ZIP | (null) | `32931` (property ZIP fallback) | `N3H 4R?` |

The postal code `N3H 4R` is **incomplete** - missing the final digit (should be 6 characters like `N3H 4R5`).

The current regex requires a complete 6-character postal code:
```regex
/\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/i
```
This fails to match `N3H 4R` because it only has 5 characters.

## Solution

Add a fallback pattern to detect **partial/incomplete** Canadian postal codes (5 characters) when province name is present. This allows parsing to proceed with best-effort extraction.

## Technical Implementation

### File: `src/lib/canadianAddressParser.ts`

Add a partial postal code pattern:

```typescript
// Partial postal code: A1A 1A (5 chars - missing final digit)
const CANADIAN_POSTAL_PARTIAL = /\b([A-Z]\d[A-Z])\s?(\d[A-Z])\b/i;
```

Update `parseCanadianAddress()` to:
1. First try complete postal code match (6 chars)
2. If that fails, try partial match (5 chars) when province keyword is detected
3. Mark partial postal codes with a `?` suffix to indicate incomplete data

### Detection Logic

```typescript
// Step 2: Extract postal code
let postalMatch = working.match(CANADIAN_POSTAL_REGEX);
if (!postalMatch) {
  postalMatch = working.match(CANADIAN_POSTAL_REGEX_LENIENT);
}
if (!postalMatch) {
  // Try partial postal code if address contains province indicator
  if (containsProvinceKeyword(working)) {
    postalMatch = working.match(CANADIAN_POSTAL_PARTIAL);
    if (postalMatch) {
      // Mark as partial with ? suffix
      result.postalCode = normalizePostalCode(postalMatch[1] + postalMatch[2]) + '?';
      isPartialPostal = true;
    }
  }
}
if (!postalMatch) return result;
```

### Helper Function

```typescript
/**
 * Check if string contains a province keyword (name or abbreviation)
 */
function containsProvinceKeyword(str: string): boolean {
  const upper = str.toUpperCase();
  // Check abbreviations
  for (const abbr of validProvinceAbbrs) {
    if (new RegExp(`\\b${abbr}\\b`).test(upper)) return true;
  }
  // Check full names
  for (const name of Object.keys(canadianProvinces)) {
    if (upper.toLowerCase().includes(name)) return true;
  }
  return false;
}
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/lib/canadianAddressParser.ts` | Add partial postal code detection with province keyword requirement |

### Test Cases

| Input Address | Expected Street | Expected City | Expected Province | Expected Postal |
|---------------|-----------------|---------------|-------------------|-----------------|
| `1359 DICKIE SETTLEMENT RD CAMBRIDGE ONTARIO N3H 4R` | `1359 Dickie Settlement Rd` | `Cambridge` | `ON` | `N3H 4R?` |
| `6 SCARTH RD TORONTO ON M4W 2S6` | `6 Scarth Rd` | `Toronto` | `ON` | `M4W 2S6` (complete) |

### Edge Cases

1. **False positives avoided**: Only triggers partial match when province keyword is present - prevents matching random 5-character patterns in US addresses
2. **Visual indicator**: The `?` suffix signals incomplete data that may need correction
3. **Backward compatible**: Complete postal codes continue to work as before

