import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeSubscription } from './useRealtimeSubscription';
import { normalizeAddressForMatch, normalizePhoneForMatch } from '@/lib/exclusionUtils';

export type BadDataType = 'mailing_address' | 'phone' | 'email';
export type BadDataReason =
  | 'returned_to_sender'
  | 'bounced'
  | 'wrong_number'
  | 'disconnected'
  | 'do_not_contact'
  | 'other';

export interface BadContactDataRow {
  id: string;
  company_id: string;
  data_type: BadDataType;
  value: string;
  normalized_value: string;
  owner_id: string | null;
  property_id: string | null;
  source: string | null;
  reason: BadDataReason;
  notes: string | null;
  batch_id: string | null;
  mailing_list_id: string | null;
  flagged_by: string | null;
  flagged_at: string;
  created_at: string;
}

export interface BadDataBatchRow {
  id: string;
  company_id: string;
  data_type: BadDataType;
  source_label: string;
  uploaded_file_name: string | null;
  mailing_list_id: string | null;
  total_rows: number;
  matched_count: number;
  unmatched_count: number;
  created_by: string | null;
  created_at: string;
}

export function normalizeValue(type: BadDataType, value: string): string {
  if (type === 'mailing_address') return normalizeAddressForMatch(value, '', '');
  if (type === 'phone') return normalizePhoneForMatch(value);
  return value.toLowerCase().trim();
}

export function useBadContactData() {
  const { company } = useAuth();
  useRealtimeSubscription('bad_contact_data', ['bad_contact_data', company?.id]);

  return useQuery({
    queryKey: ['bad_contact_data', company?.id],
    enabled: !!company?.id,
    queryFn: async (): Promise<BadContactDataRow[]> => {
      const { data, error } = await supabase
        .from('bad_contact_data')
        .select('*')
        .eq('company_id', company!.id)
        .order('flagged_at', { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });
}

export function useBadDataBatches() {
  const { company } = useAuth();
  useRealtimeSubscription('bad_data_batches', ['bad_data_batches', company?.id]);

  return useQuery({
    queryKey: ['bad_data_batches', company?.id],
    enabled: !!company?.id,
    queryFn: async (): Promise<BadDataBatchRow[]> => {
      const { data, error } = await supabase
        .from('bad_data_batches')
        .select('*')
        .eq('company_id', company!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as any) || [];
    },
  });
}

/**
 * Returns a Set of normalized values that are flagged as bad, for fast lookup.
 */
export function useBadDataIndex() {
  const { data = [] } = useBadContactData();
  const addresses = new Set<string>();
  const phones = new Set<string>();
  const emails = new Set<string>();
  for (const row of data) {
    if (row.data_type === 'mailing_address') addresses.add(row.normalized_value);
    else if (row.data_type === 'phone') phones.add(row.normalized_value);
    else if (row.data_type === 'email') emails.add(row.normalized_value);
  }
  return { addresses, phones, emails, all: data };
}

export interface FlagInput {
  data_type: BadDataType;
  value: string;
  owner_id?: string | null;
  property_id?: string | null;
  source?: string | null;
  reason: BadDataReason;
  notes?: string | null;
  batch_id?: string | null;
  mailing_list_id?: string | null;
}

export function useFlagBadData() {
  const { company, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (inputs: FlagInput | FlagInput[]) => {
      const rows = (Array.isArray(inputs) ? inputs : [inputs]).map(i => ({
        company_id: company!.id,
        data_type: i.data_type,
        value: i.value,
        normalized_value: normalizeValue(i.data_type, i.value),
        owner_id: i.owner_id ?? null,
        property_id: i.property_id ?? null,
        source: i.source ?? null,
        reason: i.reason,
        notes: i.notes ?? null,
        batch_id: i.batch_id ?? null,
        mailing_list_id: i.mailing_list_id ?? null,
        flagged_by: user?.id ?? null,
      }));
      const { data, error } = await supabase
        .from('bad_contact_data')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bad_contact_data', company?.id] });
    },
  });
}

export function useUnflagBadData() {
  const { company } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bad_contact_data').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bad_contact_data', company?.id] });
    },
  });
}

export function useCreateBadDataBatch() {
  const { company, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      data_type: BadDataType;
      source_label: string;
      uploaded_file_name?: string | null;
      mailing_list_id?: string | null;
      total_rows: number;
      matched_count: number;
      unmatched_count: number;
    }) => {
      const { data, error } = await supabase
        .from('bad_data_batches')
        .insert({
          company_id: company!.id,
          data_type: input.data_type,
          source_label: input.source_label,
          uploaded_file_name: input.uploaded_file_name ?? null,
          mailing_list_id: input.mailing_list_id ?? null,
          total_rows: input.total_rows,
          matched_count: input.matched_count,
          unmatched_count: input.unmatched_count,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BadDataBatchRow;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bad_data_batches', company?.id] });
    },
  });
}