
# Fix Mailing Addresses Tool

## Problem

Mailing addresses imported from CSV data often have the complete address stuffed into the `mailingAddress` field while `mailingCity`, `mailingState`, and `mailingZip` contain incorrect values (often duplicated from the property address). Examples from your data:

| mailingAddress | city | state | zip | (expected) |
|----------------|------|-------|-----|------------|
| 135 E 54TH ST APT 9K NEW YORK, NY 10022 | Cocoa Beach | FL | 32931 | New York, NY 10022 |
| 1800 MINUTEMEN CSWY APT 12 COCOA BEACH, FL 32931 | Cocoa Beach | FL | 32931 | (parse correctly) |
| 84773 A OLD | HWY ISLAMORADA | FL | 33036 | (needs Geocodio) |

## Solution

Add a new **"Fix Mailing Addresses"** tab to the Data Cleanup Tool that:

1. **Detects malformed mailing addresses** - Scans for owners where the mailing address field contains a parseable full address (has city/state/zip embedded)
2. **Local parsing first** - Uses the existing `parseFullAddress()` function to extract components
3. **Geocodio fallback** - For unparseable addresses, sends to Geocodio for standardization
4. **Title Case normalization** - Converts ALL CAPS addresses to proper casing
5. **Manual edit option** - Allow editing individual addresses that can't be auto-fixed

## Technical Implementation

### New Hook: `useMailingAddressFixer.ts`

```typescript
interface MalformedMailingAddress {
  propertyId: string;
  ownerId?: string;
  mailingAddress: string;
  mailingCity: string;
  mailingState: string;
  mailingZip: string;
}

// Query to find addresses where mailingAddress contains full address pattern
// (has state abbreviation + zip embedded in the address field)
function useMalformedMailingAddresses() {
  // Fetch all properties
  // Filter where mailingAddress matches pattern like "... NY 10022" or ", City, ST ZIP"
  // and mailingCity/mailingState/mailingZip appear wrong
}
```

### Detection Logic

An address is considered malformed if:
1. `mailingAddress` contains a ZIP code pattern at the end (5 digits)
2. `mailingAddress` contains a state abbreviation before the ZIP
3. OR the existing `mailingCity/State/Zip` don't match what's embedded in `mailingAddress`

### Data Cleanup Tool Tab

Add new tab to existing tool at `src/components/crm/DataCleanupTool.tsx`:

```text
Tabs: [CSV Cleanup] [Fix Addresses] [Verify Addresses] [Fix Mailing Addresses] [Duplicates] [Fix Owner Names]
```

UI will show:
- Count of malformed mailing addresses found
- Preview table with current values vs. parsed values
- "Fix All" button for batch processing
- Individual row actions: Parse, Geocodio, Edit

### Update Flow

When fixing an address like `135 E 54TH ST APT 9K NEW YORK, NY 10022`:

1. Parse extracts: `street: "135 E 54th St Apt 9K"`, `city: "New York"`, `state: "NY"`, `zip: "10022"`
2. Apply Title Case to street and city
3. Update database: `owner.mailingAddress`, `owner.mailingCity`, `owner.mailingState`, `owner.mailingZip`

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/hooks/useMailingAddressFixer.ts` | Create | Hook to detect and fix malformed mailing addresses |
| `src/components/crm/DataCleanupTool.tsx` | Modify | Add new "Fix Mailing Addresses" tab |

## Implementation Steps

1. Create the `useMailingAddressFixer` hook with detection logic
2. Add query to find properties with malformed mailing addresses
3. Create mutation to update owner mailing fields
4. Add new tab UI to DataCleanupTool
5. Wire up Parse/Geocodio/Edit actions using existing patterns
