import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateRaw = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    let redirectOrigin = '';
    let userId = '';
    if (stateRaw) {
      try {
        const parsed = JSON.parse(atob(stateRaw));
        userId = parsed.userId;
        redirectOrigin = parsed.redirectOrigin || '';
      } catch (_) {}
    }

    const finishRedirect = (status: string, message?: string) => {
      const target = redirectOrigin
        ? `${redirectOrigin}/?gmail_connected=${status}${message ? `&msg=${encodeURIComponent(message)}` : ''}`
        : 'https://vrmcrm.lovable.app/?gmail_connected=' + status;
      return new Response(null, { status: 302, headers: { Location: target } });
    };

    if (error) return finishRedirect('error', error);
    if (!code || !userId) return finishRedirect('error', 'missing code or state');

    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error('Token exchange failed', tokens);
      return finishRedirect('error', tokens.error || 'token exchange failed');
    }

    // Fetch the user's email address
    const profileRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();
    if (!profileRes.ok) {
      console.error('Profile fetch failed', profile);
      return finishRedirect('error', 'failed to fetch gmail profile');
    }

    const emailAddress = profile.emailAddress as string;
    const initialHistoryId = profile.historyId as string;

    // service-role client to write account
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Look up the user's company
    const { data: prof, error: profErr } = await admin
      .from('profiles').select('company_id').eq('id', userId).maybeSingle();
    if (profErr || !prof?.company_id) return finishRedirect('error', 'profile/company not found');

    const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();

    const { error: upsertErr } = await admin
      .from('gmail_accounts')
      .upsert({
        user_id: userId,
        company_id: prof.company_id,
        email_address: emailAddress,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        last_history_id: initialHistoryId,
        last_synced_at: new Date().toISOString(),
        is_active: true,
      }, { onConflict: 'user_id,email_address' });

    if (upsertErr) {
      console.error('Upsert failed', upsertErr);
      return finishRedirect('error', upsertErr.message);
    }

    return finishRedirect('success', emailAddress);
  } catch (e) {
    console.error(e);
    return new Response('error: ' + (e instanceof Error ? e.message : 'unknown'), { status: 500 });
  }
});