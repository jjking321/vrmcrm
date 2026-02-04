
# Backend Update: Populate Contact Names from CSV

## Overview

Create a backend function to batch update ~500 property records with contact names from your CSV. The matching will use **Address** + **Owner 1 Last Name** to find the correct property, then set the **Name 1** value as `contact_name`.

## Matching Logic

| CSV Column | Database Match |
|------------|----------------|
| `Address` | `properties.address` (case-insensitive, fuzzy match on unit numbers) |
| `Owner 1 Last Name` | `owners.owners[0].lastName` (case-insensitive) |
| `Name 1` | → `owners.contact_name` |

### Example Matches

| CSV Address | CSV Owner 1 Last Name | Name 1 → contact_name |
|------------|----------------------|----------------------|
| 410 STRAND DR | PROPERTY INVESTMENTS LEGACY CORP | Aleksej Bockar |
| 7520 RIDGEWOOD AVE APT 909 | PITKANEN,MOSES FAMILY LAND TRUST | Alison Moses |
| 5200 OCEAN BEACH BLVD # 22C | NEWPORT FINANCIAL GROUP LLC | Amanda Francoeur |

## Implementation

### Step 1: Create Edge Function

**File:** `supabase/functions/batch-update-contact-names/index.ts`

The function will:
1. Accept CSV data as JSON array in the request body
2. Loop through each row
3. Match property by normalized address + owner last name
4. Update the `contact_name` field in the `owners` table
5. Return a summary of matched/updated/skipped records

```text
Request Body Structure:
{
  "records": [
    { "address": "8600 RIDGEWOOD AVE # 1205", "ownerLastName": "MATHEWS", "contactName": "Alan Mathews" },
    { "address": "410 STRAND DR", "ownerLastName": "PROPERTY INVESTMENTS LEGACY CORP", "contactName": "Aleksej Bockar" },
    ...
  ]
}

Response:
{
  "total": 499,
  "matched": 485,
  "updated": 485,
  "skipped": 14,
  "errors": [...]
}
```

### Step 2: Call the Function

After the function is deployed, I'll parse your CSV and call the function with the data to update all records.

## Technical Details

### Address Normalization

The function will normalize addresses for matching:
- Remove commas, extra spaces
- Handle unit variations: `# 1205` = `APT 1205` = `UNIT 1205`
- Case-insensitive comparison

### Database Query

```sql
UPDATE owners 
SET contact_name = $contactName
WHERE property_id IN (
  SELECT p.id FROM properties p
  WHERE UPPER(REPLACE(p.address, ',', '')) LIKE UPPER($normalizedAddress || '%')
)
AND (
  UPPER(owners.owners->0->>'lastName') = UPPER($ownerLastName)
  OR UPPER(owners.name) LIKE UPPER('%' || $ownerLastName || '%')
)
```

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/functions/batch-update-contact-names/index.ts` | Edge function to batch update records |

## Expected Results

After running this update:
- **~485+ records** will have their `contact_name` populated
- Properties owned by LLCs/Trusts will now display the individual contact name for mailing
- The priority logic (already updated) will use `contact_name` first

## Next Steps After Approval

1. I'll create the edge function
2. Parse your uploaded CSV into the required format
3. Call the function to update all matching records
4. Report back with the results (matched, updated, skipped)
