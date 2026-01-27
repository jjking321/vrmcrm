

# Import Support for Cocoa Beach CSV Format

## Overview

This plan adds auto-mapping patterns and parsing logic to seamlessly import your Cocoa Beach vacation rental data. The file has a unique format with scraped Airbnb/VRBO data, owner information, and contact details.

---

## What Your File Contains

| Column | Maps To | Notes |
|--------|---------|-------|
| `title` | Listing Title | Property name from Airbnb |
| `airbnb_url` | Airbnb URL | Already supported |
| `vrbo_url` | Booking Link | **NEW: Add mapping** |
| `subDescription/items/0` | Guests | **NEW: Parse number** |
| `subDescription/items/1` | Bedrooms | **NEW: Parse number** |
| `subDescription/items/2` | Bathrooms | **NEW: Parse number** |
| `subDescription/items/3` | Property Type | **NEW: Add field** |
| `host/name` | Host Name | Already supported |
| `coordinates/latitude` | Latitude | **NEW: Add mapping** |
| `coordinates/longitude` | Longitude | **NEW: Add mapping** |
| `location` | (Skip) | General area, not needed |
| `propertyType` | Property Type | Duplicate of subDescription/items/3 |
| `Full Address` | Address (full) | Auto-parsed to components |
| `GIS Coordinates` | GIS Coordinates | Already supported |
| `Owner` | (Skip per your choice) | Using Contact Person instead |
| `Owner's Address` | Mailing Address (full) | **NEW: Parse to components** |
| `Contact Person` | Contact Name | Then parse first/last |
| `Owner Contact 1` | Phone 1 | Already supported |
| `Owner Contact 2` | Phone 2 | Already supported |
| `Email 1` | Email 1 | Already supported |
| `Email 2` | Email 2 | Already supported |
| `price/price` | Market Data ADR | **NEW: Map to ADR field** |

---

## Implementation Steps

### 1. Add New Auto-Map Patterns

Update the `AUTO_MAP_PATTERNS` in `ImportWizard.tsx` to recognize your column names:

```text
vrboUrl:           ['vrbo_url', 'vrbo url', 'vrbo link', 'vrbo']
guests:            ['guests', 'subDescription/items/0', 'max guests', 'sleeps']
latitude:          ['latitude', 'coordinates/latitude', 'lat']
longitude:         ['longitude', 'coordinates/longitude', 'long', 'lng']
adr:               ['adr', 'price/price', 'average daily rate', 'nightly rate']
contactPerson:     ['contact person', 'contact name', 'primary contact']
```

### 2. Add Contact Person Parsing

When `contactPerson` is mapped but individual owner names aren't, automatically split into first/last name:
- "Charles Evers" -> firstName: "Charles", lastName: "Evers"
- "Patricia Eldridge" -> firstName: "Patricia", lastName: "Eldridge"

Update `transformImportToOwner` in `ownerUtils.ts`:

```text
// If contactName provided but no owner names, split it
if (data.contactPerson && !data.owner1FirstName) {
  const parts = data.contactPerson.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  owners.push({ firstName, lastName, source, addedAt: now });
}
```

### 3. Add Mailing Address Parsing

When `Owner's Address` contains a full address like "1008 CAMPBELL ST ORLANDO FL 32806", parse it into components using existing `parseFullAddress` function.

Update `transformImportToOwner`:

```text
// Parse full mailing address if components not provided
if (data.mailingAddress && !data.mailingCity && !data.mailingState) {
  const parsed = parseFullAddress(data.mailingAddress);
  if (parsed.isValid) {
    mailingAddress = parsed.street;
    mailingCity = parsed.city;
    mailingState = parsed.state;
    mailingZip = parsed.zip;
  }
}
```

### 4. Add Number Parsing for Guests/Beds/Baths

Handle formats like "5 guests", "2 bedrooms", "2.0 bathrooms" by extracting the numeric portion:

```text
// In useImportProperties.ts
const parseNumericField = (value: string): number => {
  if (!value) return 0;
  const match = value.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
};

bedrooms: parseNumericField(row.bedrooms),
bathrooms: parseNumericField(row.bathrooms),
guests: parseNumericField(row.guests),
```

### 5. Add ADR to Market Data

When `adr` or `price/price` is mapped, use it to populate initial market data:

```text
market_data: {
  adr: parseFloat(row.adr) || 0,
  occupancyRate: 0,
  projectedRevenue: 0,
  propertyValue: 0,
},
```

### 6. Add Target Fields to Import Wizard

Add new field options to the mapping dropdown:

| Field ID | Label | Group |
|----------|-------|-------|
| `vrboUrl` | VRBO URL | Airbnb |
| `guests` | Max Guests | Property |
| `latitude` | Latitude | Property |
| `longitude` | Longitude | Property |
| `propertyType` | Property Type | Property |
| `contactPerson` | Contact Person | Contact |
| `adr` | Nightly Rate (ADR) | Market Data |

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/crm/ImportWizard.tsx` | Add new auto-map patterns and target fields |
| `src/lib/ownerUtils.ts` | Add contact person parsing and mailing address parsing |
| `src/hooks/useImportProperties.ts` | Add number extraction for beds/baths/guests, handle latitude/longitude mapping, handle ADR |

---

## Import Flow Preview

When you upload this CSV:

1. **Auto-Mapping** detects columns like `vrbo_url`, `Contact Person`, `Owner Contact 1`
2. **Address Parsing** splits "Full Address" into street/city/state/zip
3. **Mailing Address Parsing** splits "Owner's Address" via Geocodio (per your choice)
4. **Contact Person** becomes Owner 1 with first/last name split
5. **Phones/Emails** import with source tracking (list name you provide)
6. **ADR** populates initial market data
7. **Duplicate Check** matches against existing properties by normalized address

---

## Example Result

For row 2 of your CSV:

```text
Property:
  Address: 1050 N Atlantic Ave #404
  City: Cocoa Beach
  State: FL
  ZIP: 32931
  Bedrooms: 2
  Bathrooms: 2.0
  Guests: 5
  VRBO URL: https://www.vrbo.com/751735
  Listing Title: "Sandcastles 404 - Come for the Launches..."
  Host: Kathleen Evers
  ADR: $269.10

Owner:
  Name: Charles Evers (from Contact Person)
  Phone 1: (407) 421-1664 [Source: "Cocoa Beach Import"]
  Phone 2: (407) 473-9683 [Source: "Cocoa Beach Import"]
  Email: daniel@voltacuts.com [Source: "Cocoa Beach Import"]
  Mailing: 1008 CAMPBELL ST, ORLANDO, FL 32806 (parsed via Geocodio)
```

---

## Summary

This update requires changes to 3 files to add:
- 7 new auto-map patterns for your column names
- Contact person to first/last name splitting
- Mailing address parsing via existing Geocodio flow
- Numeric extraction for "X guests", "X bedrooms" formats
- ADR mapping to market data
- New target field options in the mapping dropdown

After implementation, your Cocoa Beach CSV will import with minimal manual mapping needed.

