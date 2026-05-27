# Gmail Sync — Per-User Inbox, Auto-Match, Send/Reply

## Overview

Each team member connects their own Gmail account via OAuth. Incoming/outgoing emails sync into the CRM, get auto-matched to Owners and Realtors by email address, and appear both in a central Inbox view and on the contact/property detail pages. Users can reply and compose new emails from inside the CRM; sent mail goes through their own Gmail account so it appears in their Sent folder normally.

Scope: **forward-only sync** (no historical backfill), Phase 1.

---

## Prerequisites (one-time, done by you)

You'll need to create a Google Cloud OAuth app — Lovable's built-in Gmail connector authorizes one builder account, which doesn't fit per-user. Steps:

1. Create a project at https://console.cloud.google.com
2. Enable the **Gmail API**
3. Configure the **OAuth consent screen** (External, add your `*.lovable.app` and custom domain as authorized domains)
4. Request these scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
   - `openid`, `email`, `profile`
5. Create **OAuth 2.0 Client ID** (Web application)
6. Add the redirect URI we'll generate (an edge function URL)
7. Hand me the **Client ID** and **Client Secret** — I'll store them as Lovable Cloud secrets

Until Google verifies the consent screen (a separate review process), only test users you add can authorize. That's fine for early use.

---

## What gets built

### Database

New tables (all company-scoped, RLS on):

- **`gmail_accounts`** — one row per connected user
  - user_id, company_id, email_address, access_token (encrypted), refresh_token (encrypted), token_expires_at, last_history_id, last_synced_at, is_active
- **`email_threads`** — one row per Gmail thread, deduped per account
  - gmail_thread_id, gmail_account_id, subject, participants (jsonb), last_message_at, snippet, is_read, company_id
- **`email_messages`** — individual messages
  - gmail_message_id, thread_id (FK to email_threads), gmail_account_id, from_email, from_name, to_emails (jsonb), cc_emails (jsonb), subject, body_text, body_html, sent_at, direction (inbound/outbound), is_read, owner_id (nullable), realtor_id (nullable), property_id (nullable), match_status (matched/unmatched/manual), company_id

RLS: users see threads/messages from any `gmail_account` belonging to their company (so the team has visibility into shared correspondence). Optionally restrict to own account — TBD; defaults to company-wide.

### Edge functions

- **`gmail-oauth-start`** — generates auth URL with state token, returns to frontend
- **`gmail-oauth-callback`** — exchanges code for tokens, creates `gmail_accounts` row, starts initial watch
- **`gmail-sync`** — polled every 3 min by `pg_cron`. For each active account: refresh access token if needed, call Gmail `users.history.list` with `last_history_id`, fetch new/changed messages, upsert into `email_threads` + `email_messages`, run matcher
- **`gmail-match`** — invoked inline by sync. For each new message: look up sender + recipients in `owners` (legacy `email` + `emails` jsonb) and `realtors.email`; set `owner_id`/`realtor_id`; if matched owner has properties, optionally link to most recent property. Writes an `activity_logs` entry of type `email`.
- **`gmail-send`** — accepts to/cc/subject/body/replyToThreadId; constructs RFC 2822, base64url-encodes, posts to Gmail `users.messages.send`; on success, inserts outbound `email_messages` row
- **`gmail-mark-read`** — toggles UNREAD label via Gmail `messages.modify` and updates DB

`pg_cron` schedules `gmail-sync` every 3 minutes.

### Frontend

- **Settings → Email Accounts** tab: "Connect Gmail" button, list of connected accounts with disconnect, last-synced timestamp
- **New sidebar item: "Inbox"** with thread list (Gmail-style), filters: All / Unread / Matched / Unmatched / By Owner / By Realtor; thread detail pane on the right showing the message chain with reply box
- **Email tab on Owner detail, Realtor detail, Property detail**: chronological message list filtered by `owner_id` / `realtor_id` / `property_id`, with "Compose" and inline "Reply" buttons
- **Compose modal**: to (autocompletes from owners/realtors), cc, subject, body (plain text + basic HTML), uses sender's connected Gmail
- **Unmatched assignment**: in the Inbox, an unmatched message has a "Link to contact" dropdown to manually attach an owner/realtor

### Activity log integration

Each inbound/outbound email writes an `activity_logs` row (`type='email'`, `content=subject`, `owner_name=matched name`, `property_id` when applicable). Keeps the existing timeline cohesive.

---

## Out of scope (Phase 1)

- Attachments (display/store) — Phase 2
- Historical backfill — explicitly skipped per your choice
- Real-time push via Gmail Pub/Sub — Phase 3 (polling every 3 min is fine to start)
- Email templates, snippets, signatures, scheduling
- Open/click tracking
- Permanent delete (only archive/trash supported)

---

## Technical notes

- **Token storage**: refresh tokens stored in `gmail_accounts`. We rely on Postgres + RLS to protect them; for stronger protection we could add a `pgsodium`/vault layer later.
- **Token refresh**: handled inside `gmail-sync` and `gmail-send` — check `token_expires_at`, refresh with `refresh_token` if within 5 min of expiry.
- **Matching logic** reuses your existing `owners.email` + `owners.emails[]` jsonb and `realtors.email`. Case-insensitive exact match on address.
- **Quotas**: Gmail API allows ~1B units/day per OAuth project. Polling 50 users every 3 min using history.list is well under 1% of that.
- **Sync state**: `last_history_id` per account makes incremental sync cheap — only the delta is fetched.
- **Initial value of `last_history_id`**: set to the current mailbox `historyId` at connect time, so only emails *after* connection are pulled (matches your "only new emails going forward" choice).

---

## What I need from you to start building

1. Confirm you'll create the Google OAuth app and provide Client ID + Secret (I'll prompt for them as secrets at the right moment).
2. Confirm **company-wide visibility** for the shared inbox (any team member sees threads from any connected account in the company), vs strictly per-user private. Default in this plan: company-wide, since you asked for a "central inbox."

Once you approve this plan I'll set up the database first, then the OAuth edge functions, then the UI.
