

# Postalytics Webhook Integration: PURL Scan Tracking

## Overview

When you send direct mail through Postalytics, each piece has a personalized URL (PURL). When a recipient scans/visits that PURL, Postalytics fires a webhook. We'll catch that webhook and automatically log a "mail" activity note on the corresponding owner/property in the CRM.

## Unique Contact ID Strategy

Since you upload CSVs to Postalytics, the best approach is to use the **owner record's UUID** (`owners.id`) as a unique contact identifier. Postalytics supports custom variable fields (`var_field_1` through `var_field_30`) on each contact.

**How it works:**
1. When you export your mailing list CSV, we'll add a new column called `ContactID` containing the owner's database UUID
2. You map that column to `var_field_1` in Postalytics when uploading
3. When someone scans the PURL, the webhook payload includes `var_field_1` with the UUID
4. Our webhook handler uses that UUID to instantly find the right owner and log the activity

This is the most reliable approach because:
- No fuzzy address matching needed -- it's an exact UUID lookup
- Works even if the owner has multiple properties
- No new database columns required (the `owners.id` already exists)

## Implementation

### Step 1: Add ContactID to Mailing List CSV Export

Update `src/components/crm/MailingListsView.tsx` to include the owner's UUID in the exported CSV as a `ContactID` column.

**Before:** `Name, Address, City, State, ZIP, Property_Address`
**After:** `Name, Address, City, State, ZIP, Property_Address, ContactID`

The `ContactID` value will be the `owners.id` UUID for each record. When uploading to Postalytics, you'll map this column to `var_field_1`.

### Step 2: Create Webhook Edge Function

**File:** `supabase/functions/postalytics-webhook/index.ts`

A public endpoint (no JWT required) that:
1. Receives POST requests from Postalytics when a PURL is scanned
2. Extracts `var_field_1` (the owner UUID) from the payload
3. Looks up the owner record using the service role key (bypasses RLS since this is a server-to-server call)
4. Creates an activity log entry with type `mail` and content like "PURL scanned by recipient" along with event metadata
5. Returns 200 OK to acknowledge the webhook

The function will handle the Postalytics event payload which includes fields like:
- `event_name` (e.g., "pURL Opened", "purl Completed")
- `first_name`, `last_name`, `address`, `city`, `state`, `zip`
- `var_field_1` (our ContactID / owner UUID)
- `metadata` (contains the visited URL for online events)
- `event_date`

### Step 3: Update config.toml

Add the new function with `verify_jwt = false` since Postalytics can't send auth tokens.

### Step 4: Webhook Security

Since this is a public endpoint, we'll add basic security:
- Validate that `var_field_1` contains a valid UUID
- Validate that the owner exists before creating an activity
- Log but ignore unrecognized event types
- Optionally support a shared secret via query parameter or header that you configure in Postalytics

## Webhook URL

After deployment, your webhook URL to configure in Postalytics will be:

```text
https://csizkmiplkjyawbscrlx.supabase.co/functions/v1/postalytics-webhook
```

You'll set this as the `url` field when creating a webhook in the Postalytics dashboard.

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `supabase/functions/postalytics-webhook/index.ts` | Create | Webhook handler edge function |
| `supabase/config.toml` | Modify | Add function config with `verify_jwt = false` |
| `src/components/crm/MailingListsView.tsx` | Modify | Add `ContactID` column to CSV export |

## What You'll Need To Do

1. After I build this, export a mailing list CSV (it will now include the `ContactID` column)
2. When uploading to Postalytics, map the `ContactID` column to `var_field_1`
3. In the Postalytics dashboard, create a webhook pointing to the URL above
4. Enable the webhook events you want to track (at minimum "pURL Opened")

## Technical Details

### Activity Log Entry Format

When a PURL scan is detected, the activity will be logged as:

| Field | Value |
|-------|-------|
| type | `mail` |
| content | "PURL scanned: [event details]" |
| outcome | Event name (e.g., "pURL Opened") |
| owner_name | Looked up from owner record |
| property_id | Looked up from owner record |
| company_id | Looked up from owner record |
| created_by | null (system-generated) |

### Edge Function Pseudocode

```text
1. Parse POST body from Postalytics
2. Extract var_field_1 (owner UUID)
3. Validate UUID format
4. Query owners table by id (using service role)
5. If not found, return 200 with "owner not found" (don't retry)
6. Get property_id and company_id from owner
7. Get owner display name
8. Insert into activity_logs
9. Return 200 OK
```

