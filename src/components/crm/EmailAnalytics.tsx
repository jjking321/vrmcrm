import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Loader2, MailOpen, MousePointerClick, Send, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

type RangeKey = '7d' | '30d' | '90d';
const RANGES: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
];

interface OutboundRow {
  id: string;
  sent_at: string | null;
  to_emails: any;
  subject: string | null;
  open_count: number | null;
  click_count: number | null;
  opened_at: string | null;
  first_clicked_at: string | null;
  replied_at: string | null;
}

const Stat = ({
  label, value, sub, icon: Icon, accent,
}: { label: string; value: string; sub?: string; icon: any; accent: string }) => (
  <Card className="p-4">
    <div className="flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-md flex items-center justify-center', accent)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold leading-tight">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  </Card>
);

export const EmailAnalytics: React.FC = () => {
  const { company } = useAuth();
  const [range, setRange] = useState<RangeKey>('30d');
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;
  const since = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, [days]);

  const { data, isLoading } = useQuery({
    queryKey: ['email-analytics', company?.id, since],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_messages')
        .select('id, sent_at, to_emails, subject, open_count, click_count, opened_at, first_clicked_at, replied_at')
        .eq('company_id', company!.id)
        .eq('direction', 'outbound')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as OutboundRow[];
    },
  });

  const rows = data ?? [];
  const sent = rows.length;
  const opened = rows.filter((r) => (r.open_count ?? 0) > 0).length;
  const clicked = rows.filter((r) => (r.click_count ?? 0) > 0).length;
  const replied = rows.filter((r) => !!r.replied_at).length;
  const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');

  // Build a per-day series
  const series = useMemo(() => {
    const map = new Map<string, { date: string; sent: number; opened: number; clicked: number; replied: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, { date: key, sent: 0, opened: 0, clicked: 0, replied: 0 });
    }
    rows.forEach((r) => {
      if (!r.sent_at) return;
      const key = r.sent_at.slice(0, 10);
      const e = map.get(key);
      if (!e) return;
      e.sent += 1;
      if ((r.open_count ?? 0) > 0) e.opened += 1;
      if ((r.click_count ?? 0) > 0) e.clicked += 1;
      if (r.replied_at) e.replied += 1;
    });
    return Array.from(map.values());
  }, [rows, days]);

  const recent = rows.slice(0, 25);

  const recipientLabel = (to: any) => {
    if (!Array.isArray(to) || to.length === 0) return '—';
    const first = to[0];
    return typeof first === 'string' ? first : (first?.email ?? '—');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Email Analytics</h1>
          <p className="text-sm text-muted-foreground">Opens, clicks and replies on outbound email.</p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden text-sm">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn(
                'px-3 py-1.5 border-l border-border first:border-l-0',
                range === r.key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading analytics…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Sent" value={String(sent)} icon={Send} accent="bg-primary/10 text-primary" />
            <Stat label="Open rate" value={pct(opened, sent)} sub={`${opened} of ${sent}`} icon={MailOpen} accent="bg-teal-500/10 text-teal-600" />
            <Stat label="Click rate" value={pct(clicked, sent)} sub={`${clicked} of ${sent}`} icon={MousePointerClick} accent="bg-amber-500/10 text-amber-600" />
            <Stat label="Reply rate" value={pct(replied, sent)} sub={`${replied} of ${sent}`} icon={Reply} accent="bg-violet-500/10 text-violet-600" />
          </div>

          <Card className="p-4">
            <div className="text-sm font-medium mb-3">Daily activity</div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="opened" stroke="#0d9488" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="clicked" stroke="#d97706" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="replied" stroke="#7c3aed" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="px-4 py-3 border-b border-border text-sm font-medium">Recent sends</div>
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">No outbound emails in this range.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-2">Sent</th>
                    <th className="text-left font-medium px-4 py-2">To</th>
                    <th className="text-left font-medium px-4 py-2">Subject</th>
                    <th className="text-right font-medium px-4 py-2">Opens</th>
                    <th className="text-right font-medium px-4 py-2">Clicks</th>
                    <th className="text-left font-medium px-4 py-2">Replied</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                        {r.sent_at ? new Date(r.sent_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2 truncate max-w-[220px]">{recipientLabel(r.to_emails)}</td>
                      <td className="px-4 py-2 truncate max-w-[320px]">{r.subject || <span className="text-muted-foreground">(no subject)</span>}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.open_count ?? 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.click_count ?? 0}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {r.replied_at ? new Date(r.replied_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <p className="text-xs text-muted-foreground">
            Open tracking ignores Gmail's image-proxy prefetch, but mail clients that block remote images
            won't register an open. Reply rate counts the first inbound message in each thread.
          </p>
        </>
      )}
    </div>
  );
};

export default EmailAnalytics;