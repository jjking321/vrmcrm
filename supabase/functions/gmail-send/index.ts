import { createClient } from 'npm:@supabase/supabase-js@2';
import { admin, refreshAccessTokenIfNeeded } from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function b64urlEncode(s: string): string {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Convert plain text body to HTML with auto-linked URLs wrapped in tracking redirects.
function plainBodyToTrackedHtml(text: string, trackingBase: string, trackingId: string): string {
  const escaped = escapeHtml(text);
  // Match http(s) URLs (no surrounding whitespace). Stops at common trailing punctuation.
  const urlRe = /(https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]])/g;
  const linked = escaped.replace(urlRe, (m) => {
    const tracked = `${trackingBase}/email-track-click?t=${trackingId}&u=${b64urlEncode(m)}`;
    return `<a href="${tracked}" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:underline">${m}</a>`;
  });
  return linked;
}

// Rewrite href attributes inside an existing HTML fragment.
function rewriteHtmlLinks(html: string, trackingBase: string, trackingId: string): string {
  return html.replace(/href="(https?:\/\/[^"]+)"/gi, (_m, url) => {
    const tracked = `${trackingBase}/email-track-click?t=${trackingId}&u=${b64urlEncode(url)}`;
    return `href="${tracked}"`;
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(\n)?/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function encodeRawPlain(headers: Record<string, string>, body: string): string {
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"', '', body);
  return b64url(lines.join('\r\n'));
}

function encodeRawMultipart(headers: Record<string, string>, textBody: string, htmlBody: string): string {
  const boundary = `=_lov_${crypto.randomUUID().replace(/-/g, '')}`;
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  lines.push(
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlBody,
    '',
    `--${boundary}--`,
    '',
  );
  return b64url(lines.join('\r\n'));
}

interface OutboundAttachment {
  filename: string;
  mime_type: string;
  storage_path: string;
  bytes: Uint8Array;
}

function bytesToBase64Wrapped(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin);
  // Wrap at 76 chars per RFC 2045
  return b64.replace(/(.{76})/g, '$1\r\n');
}

function encodeRawWithAttachments(
  headers: Record<string, string>,
  textBody: string,
  htmlBody: string | null,
  attachments: OutboundAttachment[],
): string {
  const outer = `=_lov_mixed_${crypto.randomUUID().replace(/-/g, '')}`;
  const alt = `=_lov_alt_${crypto.randomUUID().replace(/-/g, '')}`;
  const lines = Object.entries(headers).map(([k, v]) => `${k}: ${v}`);
  lines.push(
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${outer}"`,
    '',
    `--${outer}`,
  );
  if (htmlBody) {
    lines.push(
      `Content-Type: multipart/alternative; boundary="${alt}"`,
      '',
      `--${alt}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      textBody,
      '',
      `--${alt}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      htmlBody,
      '',
      `--${alt}--`,
    );
  } else {
    lines.push(
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
      '',
      textBody,
    );
  }
  for (const att of attachments) {
    const safeName = att.filename.replace(/"/g, '');
    lines.push(
      '',
      `--${outer}`,
      `Content-Type: ${att.mime_type || 'application/octet-stream'}; name="${safeName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${safeName}"`,
      '',
      bytesToBase64Wrapped(att.bytes),
    );
  }
  lines.push('', `--${outer}--`, '');
  return b64url(lines.join('\r\n'));
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

    const { to, cc, subject, body, threadId, accountId, attachments: attRefs } = await req.json();
    if (!to || !subject || !body) return new Response(JSON.stringify({ error: 'to, subject, body required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const db = admin();
    // Pick the sender's account (user must own it)
    const accountQuery = db.from('gmail_accounts').select('*').eq('user_id', userId).eq('is_active', true);
    const { data: account } = accountId
      ? await accountQuery.eq('id', accountId).maybeSingle()
      : await accountQuery.limit(1).maybeSingle();
    if (!account) return new Response(JSON.stringify({ error: 'No connected Gmail account' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const accessToken = await refreshAccessTokenIfNeeded(account);

    // Resolve attachments — must already be uploaded to email-attachments bucket
    // under <company_id>/... by the client. Download bytes here so we can attach them.
    const attachments: OutboundAttachment[] = [];
    if (Array.isArray(attRefs) && attRefs.length > 0) {
      for (const a of attRefs) {
        if (!a?.storage_path || !a?.filename) continue;
        if (!a.storage_path.startsWith(`${account.company_id}/`)) {
          console.warn('Attachment outside company scope skipped', a.storage_path);
          continue;
        }
        const { data: blob, error: dlErr } = await db.storage
          .from('email-attachments')
          .download(a.storage_path);
        if (dlErr || !blob) {
          console.error('Attachment download failed', a.storage_path, dlErr);
          continue;
        }
        const buf = new Uint8Array(await blob.arrayBuffer());
        attachments.push({
          filename: a.filename,
          mime_type: a.mime_type || blob.type || 'application/octet-stream',
          storage_path: a.storage_path,
          bytes: buf,
        });
      }
    }

    // Signatures are stored as HTML. Build a multipart/alternative message so
    // recipients see the rich signature, with a plain-text fallback.
    const sigHtml = (account.signature ?? '').trim();
    const bodyTrimmed = body.replace(/\s+$/, '');
    const textBody = sigHtml
      ? `${bodyTrimmed}\r\n\r\n-- \r\n${stripHtml(sigHtml)}`
      : body;

    // Generate tracking ID for opens/clicks. Always send HTML so the pixel works.
    const trackingId = crypto.randomUUID();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const trackingBase = `${supabaseUrl}/functions/v1`;

    const htmlBodyText = plainBodyToTrackedHtml(bodyTrimmed, trackingBase, trackingId);
    const htmlBodyInner = `<div style="white-space:pre-wrap;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111">${htmlBodyText}</div>`;
    const htmlSignature = sigHtml
      ? `<div style="color:#888;font-size:12px;margin-top:16px">-- </div><div>${rewriteHtmlLinks(sigHtml, trackingBase, trackingId)}</div>`
      : '';
    const trackingPixel = `<img src="${trackingBase}/email-track-open?t=${trackingId}" width="1" height="1" alt="" style="display:none;border:0;outline:0;width:1px;height:1px" />`;
    const htmlBody = `<!doctype html><html><body>${htmlBodyInner}${htmlSignature}${trackingPixel}</body></html>`;

    const headers: Record<string, string> = {
      To: Array.isArray(to) ? to.join(', ') : to,
      Subject: subject,
      From: formatFromHeader(account.email_address, account.display_name),
    };
    if (cc) headers.Cc = Array.isArray(cc) ? cc.join(', ') : cc;

    // Always include HTML part so tracking pixel and links work.
    const raw = attachments.length > 0
      ? encodeRawWithAttachments(headers, textBody, htmlBody, attachments)
      : encodeRawMultipart(headers, textBody, htmlBody);
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
          snippet: textBody.slice(0, 200),
          participants,
          last_message_at: sentAt,
          is_read: true,
        }, { onConflict: 'gmail_account_id,gmail_thread_id' })
        .select('id')
        .single();

      if (threadRow) {
        const { data: outMsg } = await db.from('email_messages').upsert({
          thread_id: threadRow.id,
          gmail_account_id: account.id,
          company_id: account.company_id,
          gmail_message_id: data.id,
          from_email: account.email_address,
          from_name: null,
          to_emails: toObjs,
          cc_emails: ccObjs,
          subject,
          body_text: textBody,
          body_html: sigHtml ? htmlBody : null,
          snippet: textBody.slice(0, 200),
          sent_at: sentAt,
          direction: 'outbound',
          is_read: true,
          owner_id: ownerId,
          realtor_id: realtorId,
          property_id: propertyId,
          match_status: ownerId || realtorId ? 'matched' : 'unmatched',
        }, { onConflict: 'gmail_account_id,gmail_message_id' })
          .select('id')
          .single();

        // Move outbound attachments to a permanent path under the message id,
        // and record metadata so they appear in the thread view.
        if (outMsg?.id && attachments.length > 0) {
          for (const att of attachments) {
            try {
              const safeName = att.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
              const newPath = `${account.company_id}/${outMsg.id}/${crypto.randomUUID()}/${safeName}`;
              const { error: mvErr } = await db.storage
                .from('email-attachments')
                .move(att.storage_path, newPath);
              const finalPath = mvErr ? att.storage_path : newPath;
              if (mvErr) console.warn('attachment move failed; keeping temp path', mvErr);
              await db.from('email_attachments').insert({
                message_id: outMsg.id,
                company_id: account.company_id,
                filename: att.filename,
                mime_type: att.mime_type,
                size_bytes: att.bytes.length,
                storage_path: finalPath,
              });
            } catch (e) {
              console.error('persist outbound attachment failed', e);
            }
          }
        }

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