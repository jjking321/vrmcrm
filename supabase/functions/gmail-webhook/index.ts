import { admin } from '../_shared/gmail.ts';

// Pub/Sub push endpoint. Verifies a shared token from the query string,
// decodes the notification, finds the matching gmail account by email,
// and triggers gmail-sync for that account.
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const expected = Deno.env.get('GMAIL_PUBSUB_TOKEN');
    if (!expected || token !== expected) {
      return new Response('unauthorized', { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const dataB64 = body?.message?.data;
    if (!dataB64) return new Response('ok', { status: 200 }); // ack silently

    const decoded = new TextDecoder().decode(
      Uint8Array.from(atob(dataB64), (c) => c.charCodeAt(0))
    );
    const payload = JSON.parse(decoded) as { emailAddress?: string; historyId?: string | number };
    const email = payload.emailAddress?.toLowerCase();
    if (!email) return new Response('ok', { status: 200 });

    const db = admin();
    const { data: account } = await db
      .from('gmail_accounts')
      .select('id')
      .ilike('email_address', email)
      .eq('is_active', true)
      .maybeSingle();

    if (!account) return new Response('ok', { status: 200 });

    // Fire-and-forget sync for this account
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    fetch(`${supabaseUrl}/functions/v1/gmail-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ account_id: account.id }),
    }).catch((e) => console.error('sync trigger failed', e));

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('gmail-webhook error', e);
    // Always 200 so Pub/Sub doesn't retry endlessly on parse errors
    return new Response('ok', { status: 200 });
  }
});