## Goal
Make the **Unmatched** tab meaningful by ingesting non-contact emails from real people while filtering out bulk/marketing mail.

## Changes

### 1. `supabase/functions/gmail-sync/index.ts`
Replace the `if (!match) continue;` early-return with bulk-mail detection, then insert as unmatched.

- Add `isBulkMail(headers, from)` helper. Returns true if any of:
  - `List-Unsubscribe` header present
  - `List-ID` header present
  - `Precedence` header equals `bulk`, `list`, or `junk`
  - `Auto-Submitted` header present and not `no`
  - From local-part matches `/^(no-?reply|do-?not-?reply|noreply|donotreply|notifications?|mailer-daemon|postmaster|bounce|alerts?|updates?|news(letter)?|info|support|hello|team|marketing)@/i`
  - Subject matches obvious marketing patterns (optional, conservative)
- When `!match && isBulkMail(...)` → `continue` (skip entirely, same as today)
- When `!match && !isBulkMail(...)` → insert thread + message with:
  - `owner_id`, `realtor_id`, `property_id` all `null`
  - `match_status: 'unmatched'`
- When `match` exists → unchanged (`match_status: 'matched'`)

Keep attachment ingestion as-is — it runs off `msgRow.id` regardless of match.

### 2. `src/components/crm/Inbox.tsx`
Already filters unmatched client-side via `contactMap`. No changes needed — once unmatched rows exist, the tab populates automatically. Verify the tab label still reads "Unmatched" and the `LinkThreadPicker` opens with empty `currentKind='unmatched'` (it already does).

### 3. No DB migration required
`match_status` column already exists with default `'matched'`; we just start writing `'unmatched'` for the new rows.

## Out of scope
- Bulk-unmatched cleanup of historical messages (none exist yet, since sync was matched-only)
- Auto-creating owner/realtor records from unmatched senders — that's a separate "promote to contact" flow

## Files
- `supabase/functions/gmail-sync/index.ts` (only file edited)
