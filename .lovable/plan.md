

# Add Host Name Column to Property Table

## Overview

Add "Host" as a selectable column in the properties table. The data already exists in the database (`host` column) and in the Property type - we just need to register it as a system field and add rendering logic.

## Technical Changes

### 1. Add Host to System Fields

Update `src/data/mockData.ts` to include the host field in `SYSTEM_FIELDS`:

```typescript
{ id: 'host', label: 'Host', type: 'text', isSystem: true },
```

### 2. Add Column Rendering (Optional Enhancement)

The PropertyTable already has default rendering for unknown columns (line 260-261):
```typescript
const value = (property as any)[colId];
return <td className={cellClass}>{value ?? '-'}</td>;
```

This will work automatically. However, for consistency with other columns, we could add explicit rendering if needed.

## Files to Modify

| File | Change |
|------|--------|
| `src/data/mockData.ts` | Add `host` to `SYSTEM_FIELDS` array |

## Result

After this change:
- "Host" will appear in the column selector dropdown
- Users can enable/disable the Host column as needed
- The column will display the host name or "-" if empty

