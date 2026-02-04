
# Mailing Lists Feature

## Overview

Create a dedicated Mailing Lists feature similar to Call Lists, optimized for exporting to mailing services like Click2Mail or Postalytics. The system will persist lists for tracking what was mailed and when, display a clean table view without images, and intelligently select the best contact name format.

## Database Design

Create two new tables following the Call Lists pattern:

```text
+------------------+     +----------------------+
| mailing_lists    |     | mailing_list_items   |
+------------------+     +----------------------+
| id (uuid PK)     |     | id (uuid PK)         |
| company_id       |<----| mailing_list_id      |
| name             |     | property_id          |
| created_by       |     | company_id           |
| created_at       |     | status (pending/sent)|
| exported_at      |     | created_at           |
+------------------+     +----------------------+
```

Both tables will have RLS policies matching the existing Call Lists pattern.

## Contact Name Logic

Create a smart function to select the best available name:

1. **First choice**: Individual owner names in "First Last" format from the `owners[]` array
2. **Fallback**: The legacy `name` field if no structured owners exist
3. **Normalize**: Always display as "First Last" (never "LAST, FIRST" or company names when individual names are available)

```typescript
function getBestMailingName(owner: Owner): string {
  // Check structured owners array first
  if (owner.owners?.length > 0) {
    const firstOwner = owner.owners[0];
    const firstName = firstOwner.firstName?.trim() || '';
    const lastName = firstOwner.lastName?.trim() || '';
    
    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    }
    if (firstName || lastName) {
      return firstName || lastName;
    }
  }
  
  // Fallback to legacy name field
  if (owner.name) {
    // Check if it's "LAST, FIRST" format and flip it
    const commaMatch = owner.name.match(/^(\w+),\s*(\w+)$/);
    if (commaMatch) {
      return `${commaMatch[2]} ${commaMatch[1]}`;
    }
    return owner.name;
  }
  
  return 'Current Resident';
}
```

## UI Components

### 1. Sidebar Navigation

Add "Mailing Lists" to the sidebar navigation under Call Lists:

```text
- Call Lists
- Mailing Lists  <-- NEW
```

### 2. MailingListsView Component

A dedicated view showing all saved mailing lists with:
- List name and creation date
- Count of addresses in each list
- Export count and last export date
- Actions: Export CSV, View List, Delete

### 3. MailingListTable Component

A specialized table for viewing list contents with mailing-specific columns:

| Column | Source |
|--------|--------|
| Contact Name | Smart getBestMailingName() function |
| Mailing Address | owner.mailingAddress |
| City | owner.mailingCity |
| State | owner.mailingState |
| ZIP | owner.mailingZip |
| Property Address | property.address (reference only) |

Key differences from PropertyTable:
- No property images
- No checkboxes (list is already curated)
- Mailing address fields as separate columns
- Clean, export-ready format

### 4. Add to Mailing List Modal

New modal triggered from BulkActionsBar:
- Select existing mailing list or create new one
- Dedupe option (skip if mailing address already in list)
- Preview count of addresses to add

### 5. Export Functionality

CSV export with columns formatted for mailing services:
- Name, Address, City, State, ZIP
- Optional: Property Address (for internal reference)
- Updates `exported_at` timestamp on list

## File Structure

```text
src/
  components/crm/
    MailingListsView.tsx       (main view)
    MailingListTable.tsx       (specialized table)
    AddToMailingListModal.tsx  (bulk action modal)
  hooks/
    useMailingLists.ts         (CRUD operations)
  lib/
    ownerUtils.ts              (add getBestMailingName)
```

## Workflow

1. **Create List**: Select properties in PropertyTable, click "Mailing List" in bulk actions, name the list
2. **View Lists**: Navigate to Mailing Lists in sidebar, see all lists with stats
3. **Review**: Click a list to see the mailing-optimized table view
4. **Export**: Click "Export CSV" to download formatted file for mailing service
5. **Track**: List shows export history (when exported, how many times)

## Technical Changes Summary

| Area | Change |
|------|--------|
| Database | Create `mailing_lists` and `mailing_list_items` tables with RLS |
| Types | Add `MailingList` and `MailingListItem` types |
| Sidebar | Add "Mailing Lists" navigation item |
| ViewMode | Add `'mailingLists'` to ViewMode type |
| BulkActionsBar | Add "Mailing List" button and modal |
| MainApp | Add routing for mailing lists view |
| ownerUtils | Add `getBestMailingName()` function |
| New components | MailingListsView, MailingListTable, AddToMailingListModal |
| New hooks | useMailingLists (following useCallLists pattern) |

## Export CSV Format

Standard format compatible with most mailing services:

```csv
Name,Address,City,State,ZIP,Property_Address
John Smith,8797 Atwater Loop,Oviedo,FL,32765,226 Magnolia Ave
Charles Grentner,401 S ATLANTIC AVE,COCOA BEACH,FL,32931,449 S Atlantic Ave
```
