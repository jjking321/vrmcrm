import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { admin, refreshAccessTokenIfNeeded, parseAddressHeader, extractBodyParts, extractAttachments, fetchAttachmentBytes } from '../_shared/gmail.ts';

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

// Heuristic: is this message bulk/marketing/automated mail we should drop entirely
// (rather than surface in the Unmatched triage queue)?
const BULK_LOCAL_PART = /^(no-?reply|donot-?reply|notifications?|mailer-daemon|postmaster|bounce|alerts?|updates?|news(letter)?|marketing|hello|team|info|support|billing|receipts?)@/i;
function isBulkMail(headers: any[], from?: { email?: string; name?: string } | null): boolean {
  const getH = (n: string) => headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value;
  if (getH('List-Unsubscribe')) return true;
  if (getH('List-ID') || getH('List-Id')) return true;
  const prec = (getH('Precedence') || '').toLowerCase();
  if (prec === 'bulk' || prec === 'list' || prec === 'junk') return true;
  const auto = (getH('Auto-Submitted') || '').toLowerCase();
  if (auto && auto !== 'no') return true;
  if (getH('X-Mailer-Daemon') || getH('Feedback-ID')) return true;
  const fromEmail = from?.email?.toLowerCase() ?? '';
  if (fromEmail && BULK_LOCAL_PART.test(fromEmail)) return true;
  return false;
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

      const ownEmail = account.email_address.toLowerCase();
      const allAddrs = [from?.email, ...to.map((x) => x.email), ...cc.map((x) => x.email)]
        .filter(Boolean)
        .map((e) => (e as string).toLowerCase()) as string[];
      // Exclude the connected mailbox itself — otherwise every newsletter sent TO us
      // would "match" if our own address is also recorded as an owner/realtor email.
      const externalAddrs = allAddrs.filter((e) => e !== ownEmail);
      const match = findMatch(externalAddrs, index);
      if (!match && isBulkMail(headers, from)) continue; // skip newsletters / no-reply / list mail

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

      const { data: msgRow } = await db.from('email_messages').upsert({
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
        match_status: match ? 'matched' : 'unmatched',
      }, { onConflict: 'gmail_account_id,gmail_message_id' })
        .select('id')
        .single();

      // Reply tracking: when an inbound message lands, mark the most recent
      // outbound message in the same thread as replied (first reply only).
      if (direction === 'inbound' && msgRow?.id) {
        const { data: prevOutbound } = await db
          .from('email_messages')
          .select('id, replied_at')
          .eq('thread_id', threadRow.id)
          .eq('direction', 'outbound')
          .is('replied_at', null)
          .lt('sent_at', sentAt)
          .order('sent_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (prevOutbound?.id) {
          await db.from('email_messages')
            .update({ replied_at: sentAt })
            .eq('id', prevOutbound.id);
        }
      }

      // Attachments: download + upload to storage + insert metadata.
      // Skip if we already have attachments for this message (idempotent re-sync).
      if (msgRow?.id) {
        const attRefs = extractAttachments(msg.payload);
        if (attRefs.length > 0) {
          const { count: existing } = await db
            .from('email_attachments')
            .select('id', { count: 'exact', head: true })
            .eq('message_id', msgRow.id);
          if (!existing || existing === 0) {
            for (const att of attRefs) {
              try {
                const bytes = await fetchAttachmentBytes(msg.id, att.attachmentId, accessToken);
                const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
                const path = `${account.company_id}/${msgRow.id}/${att.attachmentId}/${safeName}`;
                const { error: upErr } = await db.storage
                  .from('email-attachments')
                  .upload(path, bytes, {
                    contentType: att.mimeType,
                    upsert: true,
                  });
                if (upErr) {
                  console.error('attachment upload failed', att.filename, upErr);
                  continue;
                }
                await db.from('email_attachments').insert({
                  message_id: msgRow.id,
                  company_id: account.company_id,
                  filename: att.filename,
                  mime_type: att.mimeType,
                  size_bytes: att.size,
                  storage_path: path,
                  gmail_attachment_id: att.attachmentId,
                });
              } catch (e) {
                console.error('attachment process failed', att.filename, e);
              }
            }
          }
        }
      }

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
    // Require either the service-role bearer (internal/webhook calls) or an authenticated user.
    // Authenticated users may only sync gmail_accounts within their own company.
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    let isService = !!token && token === serviceKey;
    let callerCompanyId: string | null = null;
    if (!isService) {
      if (!token) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: prof } = await admin()
        .from('profiles').select('company_id').eq('id', userData.user.id).maybeSingle();
      callerCompanyId = prof?.company_id ?? null;
      if (!callerCompanyId) {
        return new Response(JSON.stringify({ error: 'No company' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    let accountId: string | undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json();
        accountId = body?.account_id;
      } catch (_) {}
    }
    const db = admin();
    let q = db.from('gmail_accounts').select('*').eq('is_active', true);
    if (accountId) q = q.eq('id', accountId);
    if (!isService && callerCompanyId) q = q.eq('company_id', callerCompanyId);
    const { data: accounts, error } = await q;
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