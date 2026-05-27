// Shared helpers for Gmail edge functions
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function admin(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

export async function refreshAccessTokenIfNeeded(account: any): Promise<string> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 5 * 60 * 1000 && account.access_token) {
    return account.access_token;
  }
  if (!account.refresh_token) throw new Error('No refresh token; reconnect required');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!,
      client_secret: Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);

  const newExpiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();
  await admin().from('gmail_accounts').update({
    access_token: data.access_token,
    token_expires_at: newExpiry,
  }).eq('id', account.id);

  return data.access_token;
}

export function decodeBase64Url(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  } catch {
    return '';
  }
}

export function parseAddressHeader(value: string | undefined): { email: string; name?: string }[] {
  if (!value) return [];
  // very simple parser, splits by comma outside quotes
  const parts: string[] = [];
  let buf = '';
  let inQuote = false;
  for (const ch of value) {
    if (ch === '"') inQuote = !inQuote;
    if (ch === ',' && !inQuote) { parts.push(buf); buf = ''; }
    else buf += ch;
  }
  if (buf.trim()) parts.push(buf);
  return parts.map(p => {
    const m = p.trim().match(/^(?:"?([^"<]*)"?\s*)?<?([^<>\s]+@[^<>\s]+)>?$/);
    if (!m) return { email: p.trim() };
    return { email: m[2].toLowerCase(), name: m[1]?.trim() || undefined };
  });
}

export function extractBodyParts(payload: any): { text: string; html: string } {
  let text = '';
  let html = '';
  function walk(p: any) {
    if (!p) return;
    if (p.mimeType === 'text/plain' && p.body?.data) text += decodeBase64Url(p.body.data);
    else if (p.mimeType === 'text/html' && p.body?.data) html += decodeBase64Url(p.body.data);
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  if (!text && !html && payload?.body?.data) text = decodeBase64Url(payload.body.data);
  return { text, html };
}

export interface GmailAttachmentRef {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
}

/** Walk a Gmail payload and collect attachment parts (parts with a filename + attachmentId). */
export function extractAttachments(payload: any): GmailAttachmentRef[] {
  const out: GmailAttachmentRef[] = [];
  function walk(p: any) {
    if (!p) return;
    if (p.filename && p.body?.attachmentId) {
      out.push({
        filename: p.filename,
        mimeType: p.mimeType || 'application/octet-stream',
        attachmentId: p.body.attachmentId,
        size: p.body.size ?? 0,
      });
    }
    if (Array.isArray(p.parts)) p.parts.forEach(walk);
  }
  walk(payload);
  return out;
}

/** Download an attachment from Gmail and return raw bytes. */
export async function fetchAttachmentBytes(
  messageId: string,
  attachmentId: string,
  accessToken: string,
): Promise<Uint8Array> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Attachment fetch ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const b64 = (data.data as string).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}