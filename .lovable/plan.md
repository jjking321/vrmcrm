

# Fix PO Box/PMB Parsing in Mailing Addresses

## Problem

The database contains records where PO Box or PMB (Private Mailbox) numbers are incorrectly stored in the `mailing_city` field instead of the street address. For example:

| Field | Current Value | Should Be |
|-------|---------------|-----------|
| Street | 1660 S UNIVERSITY DR | 1660 S University Dr, PMB 1033 |
| City | PMB 1033 FORT WORTH | Fort Worth |
| State | TX | TX |
| ZIP | 76107 | 76107 |

This causes mailing list exports and displays to show malformed city names.

## Solution

Add detection and correction logic that:
1. Identifies PO Box/PMB prefixes in the city field
2. Appends the PO Box/PMB to the street address
3. Cleans the city field to just the city name
4. Flags these records in the Fix Mailing Addresses cleanup tool

## Technical Implementation

### 1. Update `src/lib/mailingAddress.ts`

Add a helper function to detect and fix PO Box/PMB in city field:

```text
Patterns to detect:
- "PMB 1033 FORT WORTH" -> PMB 1033 / Fort Worth
- "PO BOX 456 DALLAS" -> PO Box 456 / Dallas
- "P.O. BOX 789 AUSTIN" -> P.O. Box 789 / Austin
- "APT 5 NEW YORK" -> Apt 5 / New York
- "UNIT 12 CHICAGO" -> Unit 12 / Chicago
- "STE 100 HOUSTON" -> Ste 100 / Houston
- "# 22 PHOENIX" -> # 22 / Phoenix
```

Update `deriveMailingFields()` to:
1. Check if `mailingCity` starts with a unit/PO Box prefix
2. Extract the prefix and number
3. Append to `mailingAddress` (e.g., "1660 S University Dr, PMB 1033")
4. Set `mailingCity` to the remaining city name

### 2. Update `src/hooks/useMailingAddressFixer.ts`

Extend `hasEmbeddedAddressData()` to also detect PO Box/PMB in city field:
- Flag records where `mailing_city` starts with PMB, PO BOX, APT, UNIT, STE, or #
- Mark as malformed so they appear in the cleanup tool

Extend `tryLocalMailingParse()` to handle this case:
- When parsing, extract the PO Box/PMB from city
- Return corrected street and city values

### 3. Files to Modify

| File | Changes |
|------|---------|
| `src/lib/mailingAddress.ts` | Add PO Box detection/extraction logic in `deriveMailingFields()` |
| `src/hooks/useMailingAddressFixer.ts` | Add PO Box detection to `hasEmbeddedAddressData()` and fix logic to `tryLocalMailingParse()` |

## Implementation Details

### PO Box/Unit Detection Pattern

```typescript
// Matches patterns like "PMB 1033", "PO BOX 456", "APT 5A", "UNIT 12-B", "STE 100", "# 22"
const UNIT_PREFIX_PATTERN = /^(PMB|P\.?O\.?\s*BOX|APT\.?|APARTMENT|UNIT|STE\.?|SUITE|#)\s*(\d+[A-Z]?[-]?\d*)\s+(.+)$/i;
```

### Parsing Flow

```text
Input:
  street: "1660 S UNIVERSITY DR"
  city: "PMB 1033 FORT WORTH"

1. Detect unit prefix in city -> matches "PMB 1033"
2. Extract unit -> "PMB 1033"
3. Extract remaining city -> "FORT WORTH"
4. Append unit to street -> "1660 S University Dr, PMB 1033"
5. Apply Title Case to city -> "Fort Worth"

Output:
  street: "1660 S University Dr, PMB 1033"
  city: "Fort Worth"
```

### Display vs Persistence

- **Display/Export**: `deriveMailingFields()` will automatically show corrected values in Mailing Lists table and CSV exports
- **Cleanup Tool**: Records will appear in "Fix Mailing Addresses" tab where users can click "Parse" then "Apply" to persist the corrected values to the database

