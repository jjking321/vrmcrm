import { admin, refreshAccessTokenIfNeeded } from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Registers (or renews) a Gmail watch on the configured Pub/Sub topic for every active account.
// Gmail watches expire after 7 days, so this should be re-run regularly (manually for now).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const topic = Deno.env.get('GMAIL_PUBSUB_TOPIC');
    if (!topic) throw new Error('GMAIL_PUBSUB_TOPIC not configured');

    let accountId: string | undefined;
    if (req.method === 'POST') {
      try { accountId = (await req.json())?.account_id; } catch (_) {}
    }

    const db = admin();
    let q = db.from('gmail_accounts').select('*').eq('is_active', true);
    if (accountId) q = q.eq('id', accountId);
    const { data: accounts, error } = await q;
    if (error) throw error;

    const results: any[] = [];
    for (const account of accounts ?? []) {
      try {
        const accessToken = await refreshAccessTokenIfNeeded(account);
        const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            topicName: topic,
            labelIds: ['INBOX', 'SENT'],
            labelFilterBehavior: 'INCLUDE',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          results.push({ account: account.email_address, error: data });
          continue;
        }

        await db.from('gmail_accounts').update({
          last_history_id: data.historyId ?? account.last_history_id,
        }).eq('id', account.id);

        results.push({
          account: account.email_address,
          historyId: data.historyId,
          expiration: data.expiration,
        });
      } catch (e) {
        results.push({ account: account.email_address, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});