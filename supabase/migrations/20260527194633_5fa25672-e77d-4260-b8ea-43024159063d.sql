
-- Revoke broad column access and re-grant only non-sensitive columns to authenticated users.
-- Service role retains full access (used by edge functions for sync/send).
REVOKE SELECT, INSERT, UPDATE ON public.gmail_accounts FROM authenticated;

GRANT SELECT (
  id, user_id, company_id, email_address, display_name, signature,
  last_synced_at, last_history_id, is_active, token_expires_at, created_at, updated_at
) ON public.gmail_accounts TO authenticated;

GRANT INSERT (
  id, user_id, company_id, email_address, display_name, signature,
  access_token, refresh_token, token_expires_at, last_history_id, last_synced_at, is_active
) ON public.gmail_accounts TO authenticated;

GRANT UPDATE (
  display_name, signature, is_active
) ON public.gmail_accounts TO authenticated;

GRANT DELETE ON public.gmail_accounts TO authenticated;
GRANT ALL ON public.gmail_accounts TO service_role;
