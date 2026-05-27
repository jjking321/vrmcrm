import { createClient } from 'npm:@supabase/supabase-js@2';

// 1x1 transparent GIF
const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

const pixelHeaders = {
  'Content-Type': 'image/gif',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const trackingId = url.searchParams.get('t');

  // Always respond with the pixel — never block the recipient's mail client.
  const respondPixel = () => new Response(PIXEL, { headers: pixelHeaders });

  if (!trackingId) return respondPixel();

  try {
    const db = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: msg } = await db
      .from('email_messages')
      .select('id, company_id, open_count, opened_at, direction')
      .eq('tracking_id', trackingId)
      .maybeSingle();

    if (msg && msg.direction === 'outbound') {
      const ua = req.headers.get('user-agent') ?? null;
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

      // Skip Gmail's prefetch proxy — it fires immediately on send.
      const isGoogleProxy = ua?.includes('GoogleImageProxy') || ua?.includes('ggpht');
      if (!isGoogleProxy) {
        await db.from('email_events').insert({
          message_id: msg.id,
          company_id: msg.company_id,
          type: 'open',
          user_agent: ua,
          ip,
        });
        await db
          .from('email_messages')
          .update({
            open_count: (msg.open_count ?? 0) + 1,
            opened_at: msg.opened_at ?? new Date().toISOString(),
          })
          .eq('id', msg.id);
      }
    }
  } catch (e) {
    console.error('track-open error', e);
  }

  return respondPixel();
});