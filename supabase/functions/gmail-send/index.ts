import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, refreshAccessTokenIfNeeded } from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function encodeRaw(headers: Record<string, string>, body: string): string {
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"', '', body);
  const raw = lines.join('\r\n');
  // base64url
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace('Bearer ', '');
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const userId = claims.claims.sub;

    const { to, cc, subject, body, threadId, accountId } = await req.json();
    if (!to || !subject || !body) return new Response(JSON.stringify({ error: 'to, subject, body required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const db = admin();
    // Pick the sender's account (user must own it)
    const accountQuery = db.from('gmail_accounts').select('*').eq('user_id', userId).eq('is_active', true);
    const { data: account } = accountId
      ? await accountQuery.eq('id', accountId).maybeSingle()
      : await accountQuery.limit(1).maybeSingle();
    if (!account) return new Response(JSON.stringify({ error: 'No connected Gmail account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const accessToken = await refreshAccessTokenIfNeeded(account);

    const headers: Record<string, string> = {
      To: Array.isArray(to) ? to.join(', ') : to,
      Subject: subject,
      From: account.email_address,
    };
    if (cc) headers.Cc = Array.isArray(cc) ? cc.join(', ') : cc;

    const raw = encodeRaw(headers, body);
    const sendBody: any = { raw };
    if (threadId) sendBody.threadId = threadId;

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(sendBody),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('Send failed', data);
      return new Response(JSON.stringify({ error: data }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, messageId: data.id, threadId: data.threadId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});