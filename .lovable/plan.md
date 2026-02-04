

# Fix PO Box/PMB Parsing in Mailing Addresses

## Status: ✅ COMPLETED

## Problem

The database contains records where PO Box or PMB (Private Mailbox) numbers are incorrectly stored in the `mailing_city` field instead of the street address.

## Solution Implemented

1. **Display/Export Fix** (`src/lib/mailingAddress.ts`):
   - Added `extractUnitFromCity()` to detect and extract PO Box/PMB/Unit from city field
   - Updated `deriveMailingFields()` to auto-correct display values
   - Patterns detected: PMB, PO BOX, APT, UNIT, STE, SUITE, #

2. **Cleanup Tool Detection** (`src/hooks/useMailingAddressFixer.ts`):
   - Extended `hasEmbeddedAddressData()` to flag unit-in-city records
   - Extended `tryLocalMailingParse()` to fix these records when "Parse" is clicked
   - Added `hasUnitInCity` flag to `MalformedMailingAddress` interface

---

# Fix Contact Name LLC Preference

## Status: ✅ COMPLETED

## Problem

Contact name selection was showing LLC/corporate names instead of individual owner names when both were available.

## Solution Implemented

1. **Improved Name Selection** (`src/lib/ownerUtils.ts`):
   - Added `isCorporateName()` to detect LLC/corporate entities
   - Updated `getBestMailingName()` to scan all owners and prefer individuals over corporate
   - Added `getAllMailingNameOptions()` to get all available names for manual selection

2. **Manual Contact Name Editing** (`src/components/crm/MailingContactDetailModal.tsx`):
   - Added contact name editing in Edit mode
   - Shows dropdown selector when multiple names available
   - Highlights if an LLC is selected when individual names exist
   - Saves chosen name to `contactName` field for persistence

