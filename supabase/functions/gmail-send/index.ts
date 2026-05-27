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

// Encode a display name for an email header. If it contains non-ASCII or
// special characters, use RFC 2047 encoded-word; otherwise wrap in quotes.
function formatFromHeader(email: string, name?: string | null): string {
  if (!name || !name.trim()) return email;
  const trimmed = name.trim();
  // eslint-disable-next-line no-control-regex
  const needsEncoding = /[^\x20-\x7E]/.test(trimmed);
  if (needsEncoding) {
    const b64 = btoa(unescape(encodeURIComponent(trimmed)));
    return `=?UTF-8?B?${b64}?= <${email}>`;
  }
  const escaped = trimmed.replace(/"/g, '\\"');
  return `"${escaped}" <${email}>`;
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

    // Append signature if configured. Signatures are stored as plain text and
    // sent in the plain-text body (separated by the standard "-- " delimiter).
    const sig = (account.signature ?? '').trim();
    const finalBody = sig ? `${body.replace(/\s+$/, '')}\r\n\r\n-- \r\n${sig}` : body;

    const headers: Record<string, string> = {
      To: Array.isArray(to) ? to.join(', ') : to,
      Subject: subject,
      From: formatFromHeader(account.email_address, account.display_name),
    };
    if (cc) headers.Cc = Array.isArray(cc) ? cc.join(', ') : cc;

    const raw = encodeRaw(headers, finalBody);
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

    // Persist outbound message + thread so it appears immediately in the UI
    try {
      const toArr = Array.isArray(to) ? to : [to];
      const ccArr = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
      const toObjs = toArr.map((e: string) => ({ email: e }));
      const ccObjs = ccArr.map((e: string) => ({ email: e }));
      const participants = [account.email_address, ...toArr, ...ccArr];
      const sentAt = new Date().toISOString();

      // Match against owners/realtors for this company
      const recipients = [...toArr, ...ccArr].map((e: string) => e.toLowerCase().trim());
      let ownerId: string | null = null;
      let realtorId: string | null = null;
      let propertyId: string | null = null;
      if (recipients.length) {
        const { data: ownerMatches } = await db
          .from('owners')
          .select('id, property_id, email')
          .eq('company_id', account.company_id)
          .in('email', recipients)
          .limit(1);
        if (ownerMatches && ownerMatches[0]) {
          ownerId = ownerMatches[0].id;
          propertyId = ownerMatches[0].property_id;
        }
        const { data: realtorMatches } = await db
          .from('realtors')
          .select('id, email')
          .eq('company_id', account.company_id)
          .in('email', recipients)
          .limit(1);
        if (realtorMatches && realtorMatches[0]) realtorId = realtorMatches[0].id;
      }

      const { data: threadRow } = await db
        .from('email_threads')
        .upsert({
          gmail_account_id: account.id,
          company_id: account.company_id,
          gmail_thread_id: data.threadId,
          subject,
          snippet: finalBody.slice(0, 200),
          participants,
          last_message_at: sentAt,
          is_read: true,
        }, { onConflict: 'gmail_account_id,gmail_thread_id' })
        .select('id')
        .single();

      if (threadRow) {
        await db.from('email_messages').upsert({
          thread_id: threadRow.id,
          gmail_account_id: account.id,
          company_id: account.company_id,
          gmail_message_id: data.id,
          from_email: account.email_address,
          from_name: null,
          to_emails: toObjs,
          cc_emails: ccObjs,
          subject,
          body_text: finalBody,
          body_html: null,
          snippet: finalBody.slice(0, 200),
          sent_at: sentAt,
          direction: 'outbound',
          is_read: true,
          owner_id: ownerId,
          realtor_id: realtorId,
          property_id: propertyId,
          match_status: ownerId || realtorId ? 'matched' : 'unmatched',
        }, { onConflict: 'gmail_account_id,gmail_message_id' });

        await db.from('activity_logs').insert({
          company_id: account.company_id,
          type: 'email',
          content: subject || body.slice(0, 80),
          owner_name: account.email_address,
          property_id: propertyId,
          realtor_id: realtorId,
          date: sentAt,
        });
      }
    } catch (e) {
      console.error('Failed to persist outbound message', e);
    }

    return new Response(JSON.stringify({ ok: true, messageId: data.id, threadId: data.threadId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});