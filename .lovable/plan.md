

# Fix Duplicate Detection Timing - Check After Standardization

## Problem Identified

The import flow checks for duplicates **twice**, but at the wrong time:

| Step | Location | What It Does | Problem |
|------|----------|--------------|---------|
| 1 | ImportWizard (frontend) | Checks RAW CSV addresses against DB | Misses duplicates due to format differences |
| 2 | useImportProperties (backend) | Checks AFTER standardization | User already bypassed the modal |

**Example scenario:**
- CSV row: `"123 Main Street, Orlando, FL"` (full address in one field)
- DB has: `"123 Main St, Orlando, FL"` (standardized)
- Frontend says "no duplicate" → user proceeds
- Backend standardizes and silently updates existing record

## Solution

Move the duplicate detection to happen AFTER address standardization but BEFORE confirming the import.

### New Flow

```text
User uploads CSV
       ↓
Map fields (current step)
       ↓
Click "Import"
       ↓
[NEW] Call Geocodio to standardize addresses FIRST
       ↓
[NEW] Check duplicates against standardized addresses
       ↓
Show duplicate modal (if any found)
       ↓
User reviews duplicates with accurate matching
       ↓
Proceed with import
```

## Technical Changes

### 1. Create Pre-Import Standardization Function

Extract the Geocodio batch standardization logic into a reusable function that can be called before duplicate detection.

### 2. Update ImportWizard Flow

When user clicks "Import":
1. If standardization is enabled, call Geocodio batch API first
2. Apply standardized addresses to import data
3. THEN run duplicate detection against standardized addresses
4. Show duplicate modal with accurate matches

### 3. Update Backend to Skip Re-Standardization

If frontend already standardized, backend should not re-standardize (pass a flag).

## Files to Modify

| File | Change |
|------|--------|
| `src/lib/enrichment.ts` | Ensure `verifyAddressBatch` is exported and usable from frontend |
| `src/components/crm/ImportWizard.tsx` | Add pre-import standardization step before duplicate check |
| `src/hooks/useImportProperties.ts` | Add flag to skip standardization if already done |

## Detailed Implementation

### ImportWizard.tsx Changes

```tsx
const handleImport = async () => {
  // Parse data from CSV
  const parsedData = /* ... existing parsing ... */;
  
  // NEW: Pre-standardize addresses if option enabled
  if (standardizeAddresses) {
    setImportStatus('standardizing');
    const addressesToVerify = parsedData
      .filter(row => row.address)
      .map((row, idx) => ({
        address: row.address,
        city: row.city || '',
        state: row.state || '',
        zip: row.zip || '',
        index: idx,
      }));
    
    const results = await verifyAddressBatch(addressesToVerify);
    
    // Apply standardized addresses to parsedData
    parsedData.forEach((row, idx) => {
      const result = results.get(idx);
      if (result?.success && result.standardized) {
        row.address = result.standardized.street;
        row.city = result.standardized.city;
        row.state = result.standardized.state;
        row.zip = result.standardized.zip;
        row._alreadyStandardized = true;
      }
    });
  }
  
  // NOW run duplicate detection on standardized data
  processParsedData(parsedData);
};
```

### useImportProperties.ts Changes

```tsx
// Add to ImportOptions interface
interface ImportOptions {
  // ... existing options
  alreadyStandardized?: boolean;
}

// In the mutation, check the flag
if (options.standardize && !options.alreadyStandardized) {
  // Run standardization
} else {
  // Skip - already done by frontend
}
```

## User Experience After Fix

1. User uploads CSV
2. User maps fields and enables "Standardize addresses"
3. User clicks "Import"
4. **NEW: Loading state: "Standardizing addresses..."**
5. Addresses are standardized via Geocodio
6. Duplicate check runs against standardized addresses
7. If duplicates found, modal shows accurate matches
8. User can make informed decisions about each duplicate
9. Import proceeds without missed duplicates

## Edge Cases Handled

- If Geocodio fails/quota exceeded: Fall back to local normalization
- If standardization disabled: Use existing local normalization
- Already standardized data from re-import: Skip double standardization

