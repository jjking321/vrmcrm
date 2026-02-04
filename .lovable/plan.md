
# Add Canadian Address Parsing

## Problem

Canadian mailing addresses cannot be parsed by the current US-only address parser or verified by Geocodio (US-only service). These addresses sit in the database with `mailing_state: XX` or `null` values, and the full address crammed into `mailing_address`.

**Examples from your data:**
| mailing_address | Current State |
|-----------------|---------------|
| 6 SCARTH ROAD TORONTO ON M4W 2S6 CANADA | XX |
| 206 WESTMINSTER AVE TORONTO M6R 1P1 ON CANADA | null |
| 41 WARDEN LN STOUFFVILLE ON L4A 7X5 CANADA | null |
| 331 PARKWOOD CIRCLE DORVAL QC H9S 3A4 CANADA | null |

## Solution

Extend the address parser to recognize Canadian provinces and postal codes, enabling local parsing without Geocodio.

## Technical Implementation

### 1. Update `addressParser.ts`

Add Canadian province mappings and postal code pattern:

```text
Province Abbreviations:
AB (Alberta), BC (British Columbia), MB (Manitoba), NB (New Brunswick),
NL (Newfoundland), NS (Nova Scotia), NT (Northwest Territories),
NU (Nunavut), ON (Ontario), PE (Prince Edward Island), QC (Quebec),
SK (Saskatchewan), YT (Yukon)

Postal Code Pattern: A1A 1A1 or A1A1A1
```

**New detection logic:**
1. Check for Canadian postal code pattern at end (before optional "CANADA")
2. Strip "CANADA" suffix
3. Find province code (2-letter) or full name
4. Handle varying order: `CITY PROV POSTAL` or `CITY POSTAL PROV`
5. Extract city and street components

### 2. Update `useMailingAddressFixer.ts`

Add Canadian detection to `hasEmbeddedAddressData()`:
- Detect Canadian postal code pattern in `mailing_address`
- Flag as malformed if postal code embedded but `mailing_zip` differs or is empty

Add Canadian parsing to `tryLocalMailingParse()`:
- Call new `parseCanadianAddress()` function
- Return parsed components if successful

### 3. UI Enhancement

In the Fix Mailing Addresses tab, show a badge for Canadian addresses so users know Geocodio won't work for those (local parse only).

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/addressParser.ts` | Add Canadian provinces, postal code regex, `parseCanadianAddress()` function |
| `src/hooks/useMailingAddressFixer.ts` | Update detection and parsing to handle Canadian addresses |
| `src/components/crm/DataCleanupTool.tsx` | Add visual indicator for Canadian vs US addresses |

## Implementation Details

### Canadian Province Mappings

```typescript
const canadianProvinces: Record<string, string> = {
  'alberta': 'AB', 'british columbia': 'BC', 'manitoba': 'MB',
  'new brunswick': 'NB', 'newfoundland': 'NL', 'nova scotia': 'NS',
  'northwest territories': 'NT', 'nunavut': 'NU', 'ontario': 'ON',
  'prince edward island': 'PE', 'quebec': 'QC', 'saskatchewan': 'SK', 'yukon': 'YT',
};
const validProvinceAbbrs = new Set(['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT']);
```

### Canadian Postal Code Regex

```typescript
// Matches "M4W 2S6" or "M4W2S6" at end of string (before optional CANADA)
const canadianPostalPattern = /\b([A-Z]\d[A-Z])\s?(\d[A-Z]\d)\b/i;
```

### Parsing Flow

```text
Input: "6 SCARTH ROAD TORONTO ON M4W 2S6 CANADA"

1. Strip "CANADA" suffix -> "6 SCARTH ROAD TORONTO ON M4W 2S6"
2. Find postal code -> "M4W 2S6"
3. Find province -> "ON"
4. Extract city (word before province) -> "TORONTO"  
5. Remaining = street -> "6 SCARTH ROAD"
6. Apply Title Case -> "6 Scarth Road", "Toronto", "ON", "M4W 2S6"
```

## Edge Cases Handled

- Postal code before province: `TORONTO M6R 1P1 ON` 
- Province spelled out: `STOUFFVILLE, ONTARIO L4A 7X5`
- Missing spaces in postal: `I4Y0B3` (normalize to `I4Y 0B3`)
- Trailing CANADA with typos: `CANAD`, `CANDA`
