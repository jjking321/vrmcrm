import { createClient } from 'npm:@supabase/supabase-js@2';

function safeRedirect(target: string | null): Response {
  // Default fallback if no/invalid target
  if (!target) return new Response('Missing url', { status: 400 });
  try {
    const u = new URL(target);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return new Response('Invalid scheme', { status: 400 });
    }
    return Response.redirect(u.toString(), 302);
  } catch {
    return new Response('Invalid url', { status: 400 });
  }
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  return atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get('t');
  const encoded = url.searchParams.get('u');

  let target: string | null = null;
  if (encoded) {
    try { target = b64urlDecode(encoded); } catch { target = null; }
  }

  // Log click (best-effort) then redirect.
  if (trackingId && target) {
    try {
      const db = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      const { data: msg } = await db
        .from('email_messages')
        .select('id, company_id, click_count, first_clicked_at, direction')
        .eq('tracking_id', trackingId)
        .maybeSingle();
      if (msg && msg.direction === 'outbound') {
        const ua = req.headers.get('user-agent') ?? null;
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
        await db.from('email_events').insert({
          message_id: msg.id,
          company_id: msg.company_id,
          type: 'click',
          url: target,
          user_agent: ua,
          ip,
        });
        await db
          .from('email_messages')
          .update({
            click_count: (msg.click_count ?? 0) + 1,
            first_clicked_at: msg.first_clicked_at ?? new Date().toISOString(),
          })
          .eq('id', msg.id);
      }
    } catch (e) {
      console.error('track-click error', e);
    }
  }

  return safeRedirect(target);
});