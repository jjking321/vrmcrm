

# Add Webhook URL to Settings - Integrations Tab

## What We'll Build

A new "Postalytics" card in the Integrations tab of Settings that displays your webhook URL with a one-click copy button. You can also optionally append a campaign name via an input field, making it easy to generate the right URL for each Postalytics campaign.

## Changes

### File: `src/components/crm/Settings.tsx`

1. **Add Postalytics to the integrations list** with a description like "Direct mail PURL scan tracking"

2. **Add a dedicated Postalytics webhook section** below the integrations cards (or as an expanded section within the Postalytics card) containing:
   - The base webhook URL displayed in a read-only input
   - A "Copy" button that copies the URL to clipboard and shows a confirmation toast
   - An optional campaign name text input -- when filled, it appends `?campaign=...` to the URL so you can copy campaign-specific URLs
   - A brief instruction: "Paste this URL into the webhook configuration for each Postalytics campaign"

## Technical Details

- The webhook URL will be constructed using the environment variable `VITE_SUPABASE_URL`:
  ```
  ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/postalytics-webhook
  ```
- The copy button will use `navigator.clipboard.writeText()` and trigger a `toast.success("Webhook URL copied!")`
- The campaign input will URL-encode the campaign name when appending it as a query parameter
- Import the `Copy` and `Link` icons from `lucide-react`

