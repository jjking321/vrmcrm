

# Fix Mailing List Deduplication by Address

## Problem

The mailing list deduplication is creating duplicate entries for the same physical mailing address. For example, two "6 Scarth Road" entries appear in the list despite having the same address.

**Root cause**: The deduplication key is built from raw database fields without:
1. Applying the `deriveMailingFields()` correction (which fixes PMB/PO Box in city field)
2. Normalizing addresses (stripping punctuation, abbreviating suffixes like "Road" → "Rd")

### Example of Bug

| Property | Raw City | Dedupe Key Generated |
|----------|----------|---------------------|
| 6 Scarth Road | PMB 1033 FORT WORTH | `6 scarth road-pmb 1033 fort worth-tx-12345` |
| 6 Scarth Road | FORT WORTH | `6 scarth road-fort worth-tx-12345` |

These keys are different, so both records are added to the mailing list.

## Solution

Update `useAddToMailingList` in `src/hooks/useMailingLists.ts` to:

1. Use `deriveMailingFields()` to get corrected address components before building the dedupe key
2. Apply address normalization (similar to property duplicate detection)

### Technical Changes

**File: `src/hooks/useMailingLists.ts`**

Add a normalization function for mailing addresses:
```typescript
function normalizeMailingAddress(
  street: string,
  city: string,
  state: string,
  zip: string
): string {
  return `${street} ${city} ${state} ${zip}`
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|...)\b/g, abbreviate)
    .trim();
}
```

Update the deduplication logic:
```typescript
// Instead of raw fields:
const key = `${owner.mailing_address}-${owner.mailing_city}-...`

// Use derived + normalized:
const derived = deriveMailingFields(owner, null);
const key = normalizeMailingAddress(
  derived.mailingAddress,
  derived.mailingCity,
  derived.mailingState,
  derived.mailingZip
);
```

This ensures:
- PMB/PO Box extracted from city before comparison
- "Road" and "Rd" match as the same
- Case-insensitive matching
- Punctuation ignored

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useMailingLists.ts` | Add normalization function, update dedupe logic in `useAddToMailingList` |

