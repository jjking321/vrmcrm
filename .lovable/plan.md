

# Filter Bulk Enrichment to Missing Data Only

## Overview

This update modifies the bulk Zillow and Airbnb enrichment actions in the selection toolbar to automatically skip properties that have already been enriched. This saves API calls and avoids unnecessary updates.

---

## Current Behavior

When you select properties and click "Zillow" or "Airbnb", the system enriches **all** selected properties—even those already enriched.

## New Behavior

The enrichment will only target properties **missing key data**:

| Enrichment | Skip If Property Has |
|------------|---------------------|
| **Zillow** | `image` AND `zillowUrl` AND `marketData.propertyValue` |
| **Airbnb** | `marketData.adr` > 0 OR `marketData.projectedRevenue` > 0 |

---

## Implementation

### Update `BulkActionsBar.tsx`

#### 1. Add Filter Helper Functions

```text
// Check if property needs Zillow enrichment
const needsZillowEnrichment = (property: Property): boolean => {
  return !property.image || 
         !property.zillowUrl || 
         !property.marketData?.propertyValue;
};

// Check if property needs Airbnb enrichment  
const needsAirbnbEnrichment = (property: Property): boolean => {
  const adr = property.marketData?.adr || 0;
  const revenue = property.marketData?.projectedRevenue || 0;
  return adr === 0 && revenue === 0;
};
```

#### 2. Modify `handleBulkZillow`

Filter selected properties to only those needing enrichment:

```text
const handleBulkZillow = async () => {
  const propertiesToEnrich = selectedProperties.filter(needsZillowEnrichment);
  
  if (propertiesToEnrich.length === 0) {
    toast.info('All selected properties already have Zillow data');
    return;
  }
  
  // ... existing enrichment loop using propertiesToEnrich instead of selectedProperties
  
  toast.success(`Enriched ${successCount} of ${propertiesToEnrich.length} properties (${selectedCount - propertiesToEnrich.length} already had data)`);
};
```

#### 3. Modify `handleBulkAirROI`

Filter selected properties to only those needing enrichment:

```text
const handleBulkAirROI = async () => {
  const propertiesToEnrich = selectedProperties.filter(needsAirbnbEnrichment);
  
  if (propertiesToEnrich.length === 0) {
    toast.info('All selected properties already have Airbnb data');
    return;
  }
  
  // ... existing batch call using propertiesToEnrich
  
  toast.success(`Enriched ${successCount} of ${propertiesToEnrich.length} properties (${selectedCount - propertiesToEnrich.length} already had data)`);
};
```

#### 4. Update Button Labels (Optional Enhancement)

Show count of properties needing enrichment in the button:

```text
// Calculate counts
const zillowNeeded = selectedProperties.filter(needsZillowEnrichment).length;
const airbnbNeeded = selectedProperties.filter(needsAirbnbEnrichment).length;

// In button labels:
Zillow ({zillowNeeded})
Airbnb ({airbnbNeeded})
```

---

## File to Modify

| File | Changes |
|------|---------|
| `src/components/crm/BulkActionsBar.tsx` | Add filter helpers, filter properties before enrichment, update toast messages |

---

## User Experience

1. Select 10 properties
2. Click "Zillow" button (shows "Zillow (3)" if only 3 need data)
3. Only 3 properties are enriched
4. Toast shows: "Enriched 3 of 3 properties (7 already had data)"

If all selected properties already have data:
- Toast shows: "All selected properties already have Zillow data"
- No API calls made

---

## Summary

This change adds two filter functions and applies them before bulk enrichment runs. Properties that already have key data fields populated are automatically skipped, reducing API usage and preventing unnecessary database updates.

