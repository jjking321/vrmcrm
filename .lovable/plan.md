
# Duplicate Property Check Before Creating a New Deal

## What Will Change

When a user fills out the "New Property" form in the New Deal modal and clicks "Create & Add to Pipeline", the system will first check the database for existing properties with the same or similar address. If a match is found, the user will see a warning with the matching property details and can choose to either use the existing property or proceed with creating a new one anyway.

## How It Works

1. User fills in the address fields on the "New Property" tab
2. On submit, before creating anything, a query runs against the `properties` table looking for matches on address (case-insensitive)
3. If matches are found, a warning panel appears showing the matching properties with their details (address, city/state, owner name, pipeline status)
4. The user can either:
   - **Use existing property** -- adds that property to the selected pipeline stage (same as the Search tab flow)
   - **Create anyway** -- proceeds to create a new property despite the match

## Technical Details

### Changes to `NewDealModal.tsx`

- Add state for `duplicateMatches` (array of matching properties) and `duplicateChecked` (boolean)
- Modify `handleCreateProperty` to:
  1. Query `properties` table for address matches using `ilike` before creating
  2. If matches found, set `duplicateMatches` state and show warning UI instead of creating
  3. If no matches, proceed with creation as before
- Add a `handleForceCreate` function that bypasses the check and creates the property
- Add a `handleUseExisting` function that calls `onAddToPipeline` with the selected existing property
- Render a warning section when `duplicateMatches` has entries, showing each match with address, owner, and pipeline status
- Add a "Use This Property" button on each match and a "Create Anyway" button at the bottom

### No database or schema changes needed

The duplicate check uses a simple `SELECT` query against the existing `properties` table filtered by `company_id` and address similarity.
