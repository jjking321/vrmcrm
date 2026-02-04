

# Update Contact Names & Fix Priority Logic

## What We're Doing

**Two changes:**
1. **Update 500 existing records** - Populate the `contactName` field from your CSV's "Name 1" column
2. **Fix the priority logic** - Make `contactName` the #1 choice for mailing addresses when it exists

## Current vs. New Behavior

| Scenario | Current Result | New Result |
|----------|----------------|------------|
| Property owned by "Friling M Elaine Tr" with contactName "John Friling" | Uses trust name | Uses **John Friling** |
| Property owned by "Property Investments Legacy Corp" with contactName "Aleksej Bockar" | Uses LLC name | Uses **Aleksej Bockar** |

The legal owner (Trust/LLC) stays in the database - we're just adding a **preferred contact person** for mailing.

## Implementation Steps

### Step 1: Update Database Records

Match each property from your CSV using the property address and populate the `contactName` field:

| CSV Column | Database Field |
|------------|----------------|
| Address + City | → Match property |
| Name 1 | → `owner.contactName` |

**Sample mappings from your CSV:**

| Property Address | Name 1 → contactName |
|-----------------|----------------------|
| 410 STRAND DR, MELBOURNE BEACH | Aleksej Bockar |
| 7520 RIDGEWOOD AVE APT 909, CAPE CANAVERAL | Alison Moses |
| 5200 OCEAN BEACH BLVD # 22C, COCOA BEACH | Amanda Francoeur |

### Step 2: Update Priority Logic

**File:** `src/lib/ownerUtils.ts`

Change `getBestMailingName()` to check `contactName` FIRST:

```text
Current Priority:
1. Individual from owners[] array
2. Corporate from owners[] array
3. Legacy name field
4. contactName  ← Currently LAST
5. "Current Resident"

New Priority:
1. contactName  ← Move to FIRST when set
2. Individual from owners[] array
3. Corporate from owners[] array
4. Legacy name field
5. "Current Resident"
```

### Step 3: Update Import Wizard (for future imports)

**File:** `src/components/crm/ImportWizard.tsx`

Add "name 1", "name one", "name1" to the `contactPerson` field mappings so future imports auto-detect this column.

## Technical Details

### Database Update Query

We'll use a backend function to batch update properties:

```sql
-- For each property matching address/city:
UPDATE properties 
SET owner = jsonb_set(owner, '{contactName}', '"John Friling"')
WHERE address ILIKE '123 Main St%' AND city ILIKE 'Miami%';
```

### Code Change: `src/lib/ownerUtils.ts`

```typescript
export function getBestMailingName(owner: Owner): string {
  // NEW: Check contactName FIRST - this is the explicit preferred contact
  if (owner.contactName) {
    return normalizeOwnerName(owner.contactName);
  }
  
  // Then check structured owners array - prefer individual over corporate
  if (owner.owners && owner.owners.length > 0) {
    // ... existing logic unchanged
  }
  
  // ... rest of existing logic
}
```

### Code Change: `src/components/crm/ImportWizard.tsx`

Add to `fieldNameMappings`:

```typescript
contactPerson: [
  'contact person', 'contact name', 'primary contact',
  'name 1', 'name one', 'name1',  // ← NEW
  'name 2', 'name two', 'name2',  // ← NEW
],
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/ownerUtils.ts` | Move `contactName` check to top of `getBestMailingName()` |
| `src/components/crm/ImportWizard.tsx` | Add "name 1" patterns to `contactPerson` mappings |
| Database | Batch update 500 properties with contactName values |

## Result

After this change:
- **John Friling** will appear on mail for the Friling Trust property
- **Aleksej Bockar** will appear on mail for Property Investments Legacy Corp
- Legal owners remain unchanged in the database
- Future imports will auto-detect "Name 1" columns

