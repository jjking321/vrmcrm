# Source Tracking & Quality Management for Contacts

## Status: ✅ IMPLEMENTED

This plan has been implemented. See the changes below.

## Overview

This plan extends the source tracking system to cover **phones, emails, and owner contacts**, and ensures the **merge wizard** properly handles source metadata during duplicate resolution.

---

## Part 1: Enhanced Contact Interfaces

### PhoneContact Updates

```text
Current:        number, type, doNotCall

Proposed:       number, type, doNotCall
                + source (list name or "manual")
                + addedAt (ISO timestamp)
                + status ("unknown" | "verified" | "wrong_number" | "disconnected" | "no_answer")
                + lastCalledAt (ISO timestamp)
                + callCount (number)
                + notes (optional string)
```

### EmailContact Updates

```text
Current:        address, type, optedOut

Proposed:       address, type, optedOut
                + source (list name or "manual")
                + addedAt (ISO timestamp)
                + status ("unknown" | "verified" | "bounced" | "unsubscribed")
                + lastVerifiedAt (ISO timestamp)
```

### OwnerContact Updates

```text
Current:        firstName, lastName

Proposed:       firstName, lastName
                + source (list name or "manual")
                + addedAt (ISO timestamp)
```

---

## Part 2: Import Flow Updates

When importing a list, the **list name** flows through to each contact:

1. User enters list name in Import Wizard (existing field)
2. `transformImportToOwner` receives the list name and stamps it on each phone, email, and owner contact
3. `addedAt` is set to the current timestamp
4. New phones/emails default to `status: 'unknown'`

### Stacking Logic Changes

When contacts are stacked during import or merge:

- If the same phone number exists from a **different source**, both entries are kept (different sources = different context)
- If the same phone number exists from the **same source**, dedupe normally
- Source badges in UI show where each contact came from

---

## Part 3: Merge Wizard Integration

The merge wizard already handles contact stacking vs. override. Source tracking enhances this:

### Visual Enhancements

1. **Phone/Email lists show source badges** in the merge preview
2. **Combined result preview** shows deduplicated contacts with their sources preserved
3. Users can see at a glance: "3 phones from PropWire, 1 from Airbnb Scrape"

### Stacking Behavior

When "Combine all contacts" is selected:

- All phones from all duplicate records are collected
- Deduplication by number, but **source is preserved from first occurrence**
- If same number appears from different sources, first source wins (preserves data provenance)

### Override Behavior

When "Use primary only" is selected:

- Only contacts from the selected primary record are kept
- Source metadata on those contacts remains intact

### Display Changes in Merge Modal

```text
PHONES (Combined: 4)
┌────────────────────────────────────────────────────┐
│ (321) 555-1234   Mobile    [PropWire Q1]          │
│ (321) 555-5678   Landline  [Airbnb Scrape]        │
│ (321) 555-9999   Mobile    [PropWire Q1]          │
│ (321) 555-0000   Unknown   [Happy Palms List]    │
└────────────────────────────────────────────────────┘

EMAILS (Combined: 2)
┌────────────────────────────────────────────────────┐
│ john@email.com             [PropWire Q1]          │
│ jsmith@work.com            [Airbnb Scrape]        │
└────────────────────────────────────────────────────┘
```

---

## Part 4: UI Display Updates

### PropertyDetail Phone Section

```text
PHONES
┌────────────────────────────────────────────────────────────┐
│ ✓ (321) 555-1234   Mobile    [PropWire Q1] Verified       │
│   Last called: Jan 15 • 3 attempts                         │
├────────────────────────────────────────────────────────────┤
│ ? (321) 555-5678   Landline  [Airbnb Scrape] Unknown      │
│   Never called                                             │
├────────────────────────────────────────────────────────────┤
│ ✗ (321) 555-9999   Mobile    [Old List] Wrong Number      │
│   Marked bad: Jan 10                                       │
└────────────────────────────────────────────────────────────┘
```

### PropertyDetail Email Section

```text
EMAILS
┌────────────────────────────────────────────────────────────┐
│ ✓ john@email.com           [PropWire Q1] Verified         │
├────────────────────────────────────────────────────────────┤
│ ? jsmith@work.com          [Airbnb Scrape] Unknown        │
├────────────────────────────────────────────────────────────┤
│ ⚠ old@email.com            [Old List] Bounced            │
└────────────────────────────────────────────────────────────┘
```

### Quick Actions

- Click phone/email to see full metadata (source, added date, call history)
- "Mark Verified" / "Mark Bad" buttons for quick status updates
- Status persists and syncs with dialer outcomes

---

## Part 5: Dialer Integration

When a call outcome is logged:

1. The phone's `status` is updated based on outcome:
   - "Answered" -> optionally prompt to mark as `verified`
   - "Wrong Number" -> automatically set to `wrong_number`
   - "Voicemail" / "No Answer" -> increment `callCount`, track `lastCalledAt`
   
2. Phones with `wrong_number` or `disconnected` status:
   - Shown with warning in dialer
   - Optionally skipped automatically
   - Dimmed/strikethrough in property detail

---

## Implementation Summary

| File | Changes |
|------|---------|
| `src/types/index.ts` | Add source/status/addedAt fields to PhoneContact, EmailContact, OwnerContact |
| `src/lib/ownerUtils.ts` | Update `transformImportToOwner` to accept and apply source; update dedupe functions to preserve source |
| `src/hooks/useImportProperties.ts` | Pass list name to owner transform; ensure source stamps on new contacts |
| `src/components/crm/ImportWizard.tsx` | Ensure list name flows through import options |
| `src/components/crm/DuplicateMergeModal.tsx` | Display source badges on PhoneList/EmailList; show combined sources in preview |
| `src/components/crm/DuplicateWizard.tsx` | Same source badge display as merge modal |
| `src/hooks/useDuplicateDetection.ts` | Preserve source when stacking contacts during merge |
| `src/components/crm/PropertyDetail.tsx` | Display source badges and status indicators; add quick mark actions |
| `src/components/crm/CallDialer.tsx` | Update phone status on call outcomes; show source in dialer view |
| `src/hooks/useProperties.ts` | Add `useUpdatePhoneStatus` hook for individual contact updates |

---

## Technical Details

### Updated TypeScript Interfaces

```typescript
export interface PhoneContact {
  number: string;
  type: 'mobile' | 'landline' | 'unknown';
  doNotCall: boolean;
  // New fields
  source?: string;
  addedAt?: string;
  status?: 'unknown' | 'verified' | 'wrong_number' | 'disconnected' | 'no_answer';
  lastCalledAt?: string;
  callCount?: number;
  notes?: string;
}

export interface EmailContact {
  address: string;
  type: 'personal' | 'work' | 'unknown';
  optedOut: boolean;
  // New fields
  source?: string;
  addedAt?: string;
  status?: 'unknown' | 'verified' | 'bounced' | 'unsubscribed';
  lastVerifiedAt?: string;
}

export interface OwnerContact {
  firstName: string;
  lastName: string;
  // New fields
  source?: string;
  addedAt?: string;
}
```

### Dedupe Logic with Source Preservation

```typescript
export function dedupePhones(phones: PhoneContact[]): PhoneContact[] {
  const seen = new Map<string, PhoneContact>();
  for (const phone of phones) {
    if (!phone.number) continue;
    const key = normalizePhone(phone.number);
    if (key.length >= 7 && !seen.has(key)) {
      // First occurrence wins - preserves original source
      seen.set(key, phone);
    }
  }
  return Array.from(seen.values());
}
```

---

## Migration Path

- Existing contacts without `source` display as "Unknown source"
- Existing contacts without `status` default to `unknown`
- No database migration required (JSONB columns accept new fields)
- Gradual enrichment as new imports add source metadata

---

## Benefits

1. **Data provenance** - Know exactly where each phone/email came from
2. **Quality tracking** - Don't waste time on bad numbers, track verification
3. **Merge clarity** - See sources during duplicate resolution
4. **Sustainable stacking** - Add lists indefinitely without losing context
5. **Dialer efficiency** - Skip bad numbers, prioritize verified ones
6. **Email accuracy** - Track bounces and opt-outs per source

