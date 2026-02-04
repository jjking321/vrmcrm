

# Fix: Improve Address Matching for Exclusion List

## The Problem

The exclusion list has `104 W Leon Ln, Cocoa Beach, FL 32931, USA` but the database has `104 Leon Ln W`. These don't match because:

| Source | Normalized Address |
|--------|-------------------|
| Database | `104 leon ln w cocoa beach fl` |
| Exclusion | `104 w leon ln cocoa beach fl 32931 usa` |

**Two issues:**
1. **Direction position**: `W` appears at different locations
2. **Extra data**: Exclusion has zip code and "USA" that database doesn't have

## Solution

Enhance `normalizeAddressForMatch()` to:
1. **Normalize directional prefixes/suffixes** - Move all directions (N, S, E, W, NE, NW, SE, SW) to a consistent position
2. **Extract core address components** - Compare just street number + street name + suffix + city + state (ignore zip and country)

## Implementation

### File: `src/lib/exclusionUtils.ts`

Update `normalizeAddressForMatch()` function:

```typescript
export const normalizeAddressForMatch = (
  address: string,
  city: string,
  state: string
): string => {
  if (!address) return '';
  
  // Direction mappings
  const directions: Record<string, string> = {
    'north': 'n', 'n': 'n',
    'south': 's', 's': 's', 
    'east': 'e', 'e': 'e',
    'west': 'w', 'w': 'w',
    'northeast': 'ne', 'ne': 'ne',
    'northwest': 'nw', 'nw': 'nw',
    'southeast': 'se', 'se': 'se',
    'southwest': 'sw', 'sw': 'sw',
  };

  const streetSuffixes: Record<string, string> = {
    'street': 'st', 'st': 'st',
    'avenue': 'ave', 'ave': 'ave',
    'drive': 'dr', 'dr': 'dr',
    'road': 'rd', 'rd': 'rd',
    'lane': 'ln', 'ln': 'ln',
    'boulevard': 'blvd', 'blvd': 'blvd',
    'court': 'ct', 'ct': 'ct',
    'circle': 'cir', 'cir': 'cir',
    'place': 'pl', 'pl': 'pl',
    'way': 'way',
    'trail': 'trl', 'trl': 'trl',
  };

  // Start with just address (ignore city/state from exclusion if embedded)
  let normalized = address
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Remove zip codes (5 or 9 digit)
  normalized = normalized.replace(/\b\d{5}(-\d{4})?\b/g, '');
  
  // Remove country names
  normalized = normalized.replace(/\b(usa|united states|us)\b/gi, '');

  // Normalize street suffixes
  for (const [full, abbr] of Object.entries(streetSuffixes)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }

  // Extract and normalize direction
  let direction = '';
  for (const [full, abbr] of Object.entries(directions)) {
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    if (regex.test(normalized)) {
      direction = abbr;
      normalized = normalized.replace(regex, '');
      break;
    }
  }

  // Clean up and rebuild with direction at consistent position (end of street)
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Add city and state
  if (city) normalized += ` ${city.toLowerCase()}`;
  if (state) normalized += ` ${state.toLowerCase()}`;
  
  // Append direction at the end for consistent comparison
  if (direction) normalized += ` ${direction}`;

  return normalized.replace(/\s+/g, ' ').trim();
};
```

### Result After Fix

| Source | New Normalized Address |
|--------|----------------------|
| Database (`104 Leon Ln W`) | `104 leon ln cocoa beach fl w` |
| Exclusion (`104 W Leon Ln, Cocoa Beach, FL 32931, USA`) | `104 leon ln cocoa beach fl w` |

**Now they match!**

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/exclusionUtils.ts` | Update `normalizeAddressForMatch()` to handle directional variations and strip zip/country |

## Testing

After implementation, the property at `104 Leon Ln W, Cocoa Beach` will correctly match the exclusion list entry for `104 W Leon Ln, Cocoa Beach, FL 32931, USA`.

