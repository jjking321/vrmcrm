import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { normalizeAddressForMatch, normalizePhoneForMatch } from '@/lib/exclusionUtils';

export type OptOutChannel = 'mail' | 'phone' | 'email';

export interface MarketingOptOutRow {
  id: string;
  company_id: string;
  channel: OptOutChannel;
  value: string;
  normalized_value: string;
  owner_id: string | null;
  property_id: string | null;
  source: string | null;
  notes: string | null;
  flagged_by: string | null;
  flagged_at: string;
  created_at: string;
}

export function normalizeOptOutValue(channel: OptOutChannel, value: string): string {
  if (channel === 'mail') return normalizeAddressForMatch(value, '', '');
  if (channel === 'phone') return normalizePhoneForMatch(value);
  return value.toLowerCase().trim();
}

export function useMarketingOptOuts() {
  const { company } = useAuth();
  useRealtimeSubscription('marketing_opt_outs', ['marketing_opt_outs', company?.id]);

  return useQuery({
    queryKey: ['marketing_opt_outs', company?.id],
    enabled: !!company?.id,
    queryFn: async (): Promise<MarketingOptOutRow[]> => {
      const { data, error } = await supabase
        .from('marketing_opt_outs' as any)
        .select('*')
        .eq('company_id', company!.id)
        .order('flagged_at', { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });
}

/** Returns Sets of normalized opt-out values per channel for fast lookup. */
export function useOptOutIndex() {
  const { data = [] } = useMarketingOptOuts();
  const mail = new Set<string>();
  const phone = new Set<string>();
  const email = new Set<string>();
  for (const row of data) {
    if (row.channel === 'mail') mail.add(row.normalized_value);
    else if (row.channel === 'phone') phone.add(row.normalized_value);
    else if (row.channel === 'email') email.add(row.normalized_value);
  }
  return { mail, phone, email, all: data };
}

export interface OptOutInput {
  channel: OptOutChannel;
  value: string;
  owner_id?: string | null;
  property_id?: string | null;
  source?: string | null;
  notes?: string | null;
}

export function useAddOptOut() {
  const { company, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inputs: OptOutInput | OptOutInput[]) => {
      const rows = (Array.isArray(inputs) ? inputs : [inputs]).map(i => ({
        company_id: company!.id,
        channel: i.channel,
        value: i.value,
        normalized_value: normalizeOptOutValue(i.channel, i.value),
        owner_id: i.owner_id ?? null,
        property_id: i.property_id ?? null,
        source: i.source ?? null,
        notes: i.notes ?? null,
        flagged_by: user?.id ?? null,
      }));
      const { data, error } = await supabase
        .from('marketing_opt_outs' as any)
        .insert(rows as any)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing_opt_outs', company?.id] }),
  });
}

export function useRemoveOptOut() {
  const { company } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_opt_outs' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing_opt_outs', company?.id] }),
  });
}