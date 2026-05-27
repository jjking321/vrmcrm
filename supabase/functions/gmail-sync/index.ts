import { admin, refreshAccessTokenIfNeeded, parseAddressHeader, extractBodyParts } from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function gmailFetch(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gmail ${path} -> ${res.status}: ${t}`);
  }
  return res.json();
}

// Build a lookup of email -> { ownerId?, realtorId?, propertyId? } for a company.
async function buildContactIndex(companyId: string) {
  const db = admin();
  const map = new Map<string, { ownerId?: string; realtorId?: string; propertyId?: string }>();

  const { data: owners } = await db
    .from('owners')
    .select('id, property_id, email, emails')
    .eq('company_id', companyId);

  (owners ?? []).forEach((o: any) => {
    const set = (email?: string | null) => {
      if (!email) return;
      const k = email.toLowerCase().trim();
      if (!k.includes('@')) return;
      if (!map.has(k)) map.set(k, { ownerId: o.id, propertyId: o.property_id });
    };
    set(o.email);
    if (Array.isArray(o.emails)) o.emails.forEach((e: any) => set(typeof e === 'string' ? e : e?.address));
  });

  const { data: realtors } = await db
    .from('realtors')
    .select('id, email')
    .eq('company_id', companyId);

  (realtors ?? []).forEach((r: any) => {
    if (!r.email) return;
    const k = r.email.toLowerCase().trim();
    const cur = map.get(k) ?? {};
    map.set(k, { ...cur, realtorId: r.id });
  });

  return map;
}

function findMatch(
  emails: string[],
  index: Map<string, { ownerId?: string; realtorId?: string; propertyId?: string }>
) {
  for (const e of emails) {
    const m = index.get(e.toLowerCase().trim());
    if (m) return m;
  }
  return null;
}

async function syncAccount(account: any) {
  const db = admin();
  const accessToken = await refreshAccessTokenIfNeeded(account);
  const index = await buildContactIndex(account.company_id);

  // Get all new message IDs since last_history_id
  let messageIds: string[] = [];
  let newHistoryId: string | undefined;

  try {
    let pageToken: string | undefined;
    do {
      const qs = new URLSearchParams({ startHistoryId: account.last_history_id ?? '' });
      if (pageToken) qs.set('pageToken', pageToken);
      const data = await gmailFetch(`/history?${qs.toString()}`, accessToken);
      newHistoryId = data.historyId ?? newHistoryId;
      (data.history ?? []).forEach((h: any) => {
        (h.messagesAdded ?? []).forEach((m: any) => messageIds.push(m.message.id));
      });
      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (e) {
    // If history ID is too old (404), reset to current
    console.warn(`History fetch failed for ${account.email_address}:`, e instanceof Error ? e.message : e);
    const profile = await gmailFetch('/profile', accessToken);
    newHistoryId = profile.historyId;
  }

  messageIds = [...new Set(messageIds)];
  let matchedCount = 0;

  for (const msgId of messageIds) {
    try {
      const msg = await gmailFetch(`/messages/${msgId}?format=full`, accessToken);
      const headers: any[] = msg.payload?.headers ?? [];
      const getH = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value;

      const from = parseAddressHeader(getH('From'))[0];
      const to = parseAddressHeader(getH('To'));
      const cc = parseAddressHeader(getH('Cc'));
      const subject = getH('Subject') ?? '';
      const dateHeader = getH('Date');
      const sentAt = dateHeader ? new Date(dateHeader).toISOString() : new Date(parseInt(msg.internalDate ?? '0')).toISOString();

      const allAddrs = [from?.email, ...to.map((x) => x.email), ...cc.map((x) => x.email)].filter(Boolean) as string[];
      const match = findMatch(allAddrs, index);
      if (!match) continue; // only store emails matching CRM contacts

      const direction = from?.email?.toLowerCase() === account.email_address.toLowerCase() ? 'outbound' : 'inbound';
      const isRead = !(msg.labelIds ?? []).includes('UNREAD');

      // Upsert thread
      const { data: threadRow, error: threadErr } = await db
        .from('email_threads')
        .upsert({
          gmail_account_id: account.id,
          company_id: account.company_id,
          gmail_thread_id: msg.threadId,
          subject,
          snippet: msg.snippet,
          participants: allAddrs,
          last_message_at: sentAt,
          is_read: isRead,
        }, { onConflict: 'gmail_account_id,gmail_thread_id' })
        .select('id')
        .single();

      if (threadErr || !threadRow) {
        console.error('thread upsert failed', threadErr);
        continue;
      }

      const { text: bodyText, html: bodyHtml } = extractBodyParts(msg.payload);

      await db.from('email_messages').upsert({
        thread_id: threadRow.id,
        gmail_account_id: account.id,
        company_id: account.company_id,
        gmail_message_id: msg.id,
        from_email: from?.email,
        from_name: from?.name,
        to_emails: to,
        cc_emails: cc,
        subject,
        body_text: bodyText,
        body_html: bodyHtml,
        snippet: msg.snippet,
        sent_at: sentAt,
        direction,
        is_read: isRead,
        owner_id: match.ownerId ?? null,
        realtor_id: match.realtorId ?? null,
        property_id: match.propertyId ?? null,
        match_status: 'matched',
      }, { onConflict: 'gmail_account_id,gmail_message_id' });

      // Activity log entry
      const ownerName = from?.name || from?.email || 'Email contact';
      await db.from('activity_logs').insert({
        company_id: account.company_id,
        type: 'email',
        content: subject || msg.snippet || '(no subject)',
        owner_name: ownerName,
        property_id: match.propertyId ?? null,
        realtor_id: match.realtorId ?? null,
        date: sentAt,
      });

      matchedCount++;
    } catch (e) {
      console.error('message process failed', msgId, e);
    }
  }

  await db.from('gmail_accounts').update({
    last_history_id: newHistoryId ?? account.last_history_id,
    last_synced_at: new Date().toISOString(),
  }).eq('id', account.id);

  return { account: account.email_address, scanned: messageIds.length, matched: matchedCount };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const db = admin();
    const { data: accounts, error } = await db
      .from('gmail_accounts')
      .select('*')
      .eq('is_active', true);
    if (error) throw error;

    const results = [];
    for (const acc of accounts ?? []) {
      try {
        results.push(await syncAccount(acc));
      } catch (e) {
        results.push({ account: acc.email_address, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return new Response(JSON.stringify({ results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});