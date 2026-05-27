## Goal
Track bad contact data (returned-to-sender addresses, dead phones, bounced emails) with full paper trail and per-source quality reporting, so future mailings and outreach automatically skip known-bad data.

## Approach
One unified "bad data" system across addresses, phones, and emails — same schema, same UX patterns. Built around two new tables: `bad_contact_data` (the flags + paper trail) and a derived view powering the source quality dashboard.

### 1. Database

**New table `bad_contact_data`** — one row per flagged piece of data:
- `data_type` — `'mailing_address' | 'phone' | 'email'`
- `value` — the actual bad value (normalized address string, phone digits, or email)
- `normalized_value` — for matching (uses existing `normalizeAddressForMatch` / `normalizePhoneForMatch`)
- `owner_id`, `property_id` — link back to the contact when known
- `source` — the import source that originally supplied this data (pulled from owner phone/email `source` field or owner-level source)
- `reason` — `'returned_to_sender' | 'bounced' | 'wrong_number' | 'disconnected' | 'do_not_contact' | 'other'`
- `notes`, `flagged_by` (user id), `flagged_at`, `batch_id` (groups bulk uploads)
- `mailing_list_id` (nullable) — links RTS flag back to the mailing that triggered it
- RLS scoped to `company_id`

**New table `bad_data_batches`** — paper trail header:
- `id`, `company_id`, `data_type`, `source_label` (e.g. "March 2026 Postcard Mailing"), `uploaded_file_name`, `total_rows`, `matched_count`, `unmatched_count`, `created_by`, `created_at`

### 2. Bulk upload flow

New view: **Data Quality → Bad Data Upload** (also reachable from Mailing List detail via "Mark returned addresses" button).

Wizard steps:
1. Pick data type: Returned addresses / Bounced emails / Bad phones
2. Paste or CSV upload (auto-detects columns; for addresses uses existing `normalizeAddressForMatch`)
3. Match preview: shows which rows matched a known owner/property, which didn't, and which source each match came from
4. Optional: tie to a specific mailing list (for RTS) so the paper trail says "returned from X mailing"
5. Confirm → writes `bad_data_batches` row + `bad_contact_data` rows

### 3. Auto-exclusion

- **Mailing list builder** (`useMailingListFiltering` + bulk "Add to Mailing List"): filter out properties whose owner's mailing address has an active `bad_contact_data` row with `data_type='mailing_address'`.
- **Call list builder**: filter out phones flagged as bad.
- **Email sending** (`gmail-send`, Compose): warn + block flagged emails.
- Show counts in the UI: "12 addresses excluded as returned-to-sender" with a link to review.

### 4. Inline UI badges

- `MailingListTable`, `OwnerDetail`, `PropertyDetail`: red strikethrough + amber "Returned" badge on flagged mailing addresses, with hover showing reason/date/source.
- Phone rows in `OwnerDetail`: existing DNC amber pattern extended with a "Bad" state.
- Email rows: "Bounced" badge.
- Each badge clickable → opens a small panel with full history (when flagged, by whom, which mailing, source attribution) and an "Unflag" action.

### 5. Source Quality Dashboard

New tab in the More panel: **Data Quality**.
- Top-level table, one row per source (e.g. "Cocoa Beach Import Mar 2026", "Manual", "Zillow enrichment"):
  - Total addresses contributed / # bad / % bad
  - Total phones contributed / # bad / % bad
  - Total emails contributed / # bad / % bad
  - Overall quality score
- Click a source → drill-down: list every bad record from that source with reason + flagged date
- Sort by worst source so the user can decide to stop buying from a vendor
- Uses the existing `source` field already tracked on phones/emails plus a new owner-level `source` capture for mailing addresses

### 6. Paper trail surfaces

- Activity log entry written on every flag/unflag (uses existing `activity_logs` table) so it appears on the owner/property timeline
- Batch upload history page under Data Quality showing each upload, its file name, who ran it, and how many records were affected
- Per-record history visible in the badge popover

## Out of scope
- Auto-pulling RTS data from a Postalytics API (manual upload only for v1)
- Auto-detecting bounces from Gmail (separate webhook work)
- Re-verification workflow (marking previously-bad data as good again is just the manual "Unflag" button)

## Files (new)
- Migration: `bad_contact_data`, `bad_data_batches` tables + RLS + grants
- `src/hooks/useBadContactData.ts`
- `src/hooks/useDataQualityStats.ts`
- `src/components/crm/DataQualityView.tsx` (dashboard)
- `src/components/crm/BadDataUploadWizard.tsx`
- `src/components/crm/BadDataBadge.tsx` (shared badge + popover)

## Files (edited)
- `src/components/crm/MainApp.tsx` + `Sidebar.tsx` (or More panel): add Data Quality entry
- `src/hooks/useMailingListFiltering.ts`, `useCallLists.ts`: auto-exclude flagged
- `src/components/crm/MailingListTable.tsx`, `OwnerDetail.tsx`, `PropertyDetail.tsx`: badges
- `src/components/crm/ComposeModal.tsx`, `supabase/functions/gmail-send/index.ts`: bounce-email block
- `src/lib/exclusionUtils.ts`: reuse normalizers (no change needed, just import)

## Technical notes
- Matching uses existing normalizers in `src/lib/exclusionUtils.ts` (`normalizeAddressForMatch`, `normalizePhoneForMatch`, `emailsMatch`) so behavior is consistent with the existing exclusion list.
- `bad_contact_data` is intentionally separate from `exclusion_list`: exclusions are "never contact this person", bad data is "this specific channel is dead — try a different one for the same person".
- Realtime enabled so flagging from one teammate immediately greys out the row for everyone.
