
# Mailing List Contact Detail Modal

## Overview

Add the ability to click on a contact row in the mailing list table to open a popup modal that displays full contact details, allows editing of addresses and contact information, shows all owners/contacts for that property, displays the source of information, and shows the property manager if applicable.

## UI/UX Flow

1. User clicks anywhere on a contact row in the MailingListTable
2. A Dialog modal opens showing the full contact details
3. Modal has two modes: View and Edit (toggle with button)
4. In Edit mode, user can modify mailing address and contact details
5. Save button persists changes, Cancel discards

## Modal Content Structure

```text
+------------------------------------------------------------------+
| Contact Details                                           [Edit] |
+------------------------------------------------------------------+
|                                                                  |
| CONTACT NAME                                                     |
| John Smith                                         [SourceBadge] |
|                                                                  |
| MAILING ADDRESS                                                  |
| 123 Main Street                                                  |
| Orlando, FL 32801                                  [SourceBadge] |
|                                                                  |
| ALL OWNERS (2)                              Section if multiple  |
| +----------------------------------------------------------+    |
| | 1. John Smith           [SourceBadge: absentee]          |    |
| |    (407) 555-1234       [SourceBadge: propwire]          |    |
| |    john@example.com     [SourceBadge: manual]            |    |
| +----------------------------------------------------------+    |
| | 2. Jane Smith           [SourceBadge: absentee]          |    |
| |    (407) 555-5678       [SourceBadge: propwire]          |    |
| +----------------------------------------------------------+    |
|                                                                  |
| PROPERTY MANAGER (if applicable)                                 |
| Vacation Rentals Inc.                                            |
|                                                                  |
| PROPERTY REFERENCE                                               |
| 226 Magnolia Ave, Orlando, FL 32801                              |
|                                                                  |
+------------------------------------------------------------------+
|                                              [Cancel]   [Save]   |
+------------------------------------------------------------------+
```

## Technical Implementation

### New Component: `MailingContactDetailModal.tsx`

```typescript
interface MailingContactDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: MailingListItem & { property?: Property };
  onSave: (propertyId: string, ownerUpdates: Partial<Owner>) => void;
}
```

**Features:**
- Display mode: Shows all contact info with source badges
- Edit mode: Form inputs for mailing address fields
- Shows all owners from `owner.owners[]` with their phones and emails
- Shows source badges next to each piece of data
- Shows property manager from `property.propertyManager`
- Property address as reference (not editable here)

### MailingListTable Changes

- Make each row clickable (cursor-pointer styling)
- Add state to track selected item
- Render the modal when an item is selected

### Hook Integration

Use existing `useUpdateProperty` mutation to save owner changes:
```typescript
const updateProperty = useUpdateProperty();

const handleSave = (propertyId: string, ownerUpdates: Partial<Owner>) => {
  updateProperty.mutate({
    id: propertyId,
    updates: { owner: ownerUpdates }
  });
};
```

## File Structure

| File | Action | Description |
|------|--------|-------------|
| `src/components/crm/MailingContactDetailModal.tsx` | Create | New modal component |
| `src/components/crm/MailingListTable.tsx` | Modify | Add click handler and modal state |

## Data Sources for Display

| Field | Source | Editable |
|-------|--------|----------|
| Contact Name | `getBestMailingName(owner)` | No (read from owners array) |
| Mailing Address | `owner.mailingAddress` | Yes |
| Mailing City | `owner.mailingCity` | Yes |
| Mailing State | `owner.mailingState` | Yes |
| Mailing ZIP | `owner.mailingZip` | Yes |
| All Owners | `owner.owners[]` array | View only |
| All Phones | `owner.phones[]` with source badges | View only |
| All Emails | `owner.emails[]` with source badges | View only |
| Property Manager | `property.propertyManager` | View only |
| Property Address | `property.address, city, state, zip` | View only |

## Source Badge Display

Each piece of contact data will show its source using the existing `SourceBadge` component:
- Owner names: `owner.owners[].source`
- Phone numbers: `owner.phones[].source`
- Emails: `owner.emails[].source`

Example display:
```text
(407) 555-1234  [mobile]  [propwire]
```

## Edit Mode Fields

When in edit mode, user can modify:
1. **Mailing Address** - Text input
2. **Mailing City** - Text input
3. **Mailing State** - Text input (2-letter code)
4. **Mailing ZIP** - Text input

These map to the existing owner mailing fields that are already supported by `useUpdateProperty`.

## Modal Behavior

1. Click row -> Opens modal in view mode
2. Click Edit button -> Switches to edit mode with form inputs
3. Cancel -> Reverts to view mode (or closes if was view mode)
4. Save -> Calls `useUpdateProperty`, shows toast, closes modal
5. Click outside or X -> Closes modal
