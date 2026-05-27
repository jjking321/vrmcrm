import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EmailDraft {
  id: string;
  company_id: string;
  thread_id: string;
  gmail_account_id: string | null;
  to_emails: any;
  cc_emails: any;
  subject: string;
  body: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailNote {
  id: string;
  company_id: string;
  thread_id: string | null;
  owner_id: string | null;
  realtor_id: string | null;
  property_id: string | null;
  body: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Shared draft for a thread (one per thread). */
export const useThreadDraft = (threadId: string | null) => {
  return useQuery({
    queryKey: ['email-draft', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_drafts')
        .select('*')
        .eq('thread_id', threadId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as EmailDraft | null;
    },
  });
};

export const useUpsertThreadDraft = () => {
  const qc = useQueryClient();
  const { company, user } = useAuth();
  return useMutation({
    mutationFn: async (payload: { threadId: string; body: string; subject?: string; to?: string[]; cc?: string[] }) => {
      if (!company?.id || !user?.id) throw new Error('Not authenticated');
      const { data: existing } = await supabase
        .from('email_drafts')
        .select('id, created_by')
        .eq('thread_id', payload.threadId)
        .maybeSingle();
      if (existing) {
        const { error } = await supabase
          .from('email_drafts')
          .update({
            body: payload.body,
            ...(payload.subject !== undefined ? { subject: payload.subject } : {}),
            ...(payload.to !== undefined ? { to_emails: payload.to } : {}),
            ...(payload.cc !== undefined ? { cc_emails: payload.cc } : {}),
            updated_by: user.id,
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_drafts').insert({
          company_id: company.id,
          thread_id: payload.threadId,
          body: payload.body,
          subject: payload.subject ?? '',
          to_emails: payload.to ?? [],
          cc_emails: payload.cc ?? [],
          created_by: user.id,
          updated_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['email-draft', vars.threadId] });
    },
  });
};

export const useDeleteThreadDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (threadId: string) => {
      const { error } = await supabase.from('email_drafts').delete().eq('thread_id', threadId);
      if (error) throw error;
    },
    onSuccess: (_d, threadId) => {
      qc.invalidateQueries({ queryKey: ['email-draft', threadId] });
    },
  });
};

/** Notes for any entity (thread / owner / realtor / property). */
export const useEmailNotes = (target: {
  threadId?: string | null;
  ownerId?: string | null;
  realtorId?: string | null;
  propertyId?: string | null;
}) => {
  const { threadId, ownerId, realtorId, propertyId } = target;
  const key = threadId ? `thread:${threadId}` : ownerId ? `owner:${ownerId}` : realtorId ? `realtor:${realtorId}` : propertyId ? `property:${propertyId}` : 'none';
  return useQuery({
    queryKey: ['email-notes', key],
    enabled: !!(threadId || ownerId || realtorId || propertyId),
    queryFn: async () => {
      let q = supabase.from('email_notes').select('*').order('created_at', { ascending: false });
      if (threadId) q = q.eq('thread_id', threadId);
      else if (ownerId) q = q.eq('owner_id', ownerId);
      else if (realtorId) q = q.eq('realtor_id', realtorId);
      else if (propertyId) q = q.eq('property_id', propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EmailNote[];
    },
  });
};

export const useCreateEmailNote = () => {
  const qc = useQueryClient();
  const { company, user } = useAuth();
  return useMutation({
    mutationFn: async (payload: {
      body: string;
      threadId?: string | null;
      ownerId?: string | null;
      realtorId?: string | null;
      propertyId?: string | null;
    }) => {
      if (!company?.id || !user?.id) throw new Error('Not authenticated');
      const { error } = await supabase.from('email_notes').insert({
        company_id: company.id,
        thread_id: payload.threadId ?? null,
        owner_id: payload.ownerId ?? null,
        realtor_id: payload.realtorId ?? null,
        property_id: payload.propertyId ?? null,
        body: payload.body,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-notes'] }),
  });
};

export const useDeleteEmailNote = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-notes'] }),
  });
};

/** Resolve user names for a list of user ids (company profiles). */
export const useProfileNames = (userIds: string[]) => {
  const sorted = Array.from(new Set(userIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ['profile-names', sorted.join(',')],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, name').in('id', sorted);
      if (error) throw error;
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => m.set(p.id, p.name));
      return m;
    },
  });
};