import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface GmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  display_name: string | null;
  signature: string | null;
  last_synced_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface EmailThread {
  id: string;
  gmail_account_id: string;
  gmail_thread_id: string;
  subject: string | null;
  snippet: string | null;
  participants: any;
  last_message_at: string | null;
  is_read: boolean;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  gmail_account_id: string;
  gmail_message_id: string;
  from_email: string | null;
  from_name: string | null;
  to_emails: any;
  cc_emails: any;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  snippet: string | null;
  sent_at: string | null;
  direction: string;
  is_read: boolean;
  owner_id: string | null;
  realtor_id: string | null;
  property_id: string | null;
}

export const useGmailAccounts = () => {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['gmail-accounts', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_accounts')
        .select('id, user_id, email_address, display_name, signature, last_synced_at, is_active, created_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as GmailAccount[];
    },
  });
};

export const useUpdateGmailAccount = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; display_name?: string | null; signature?: string | null }) => {
      const { id, ...updates } = payload;
      const { error } = await supabase.from('gmail_accounts').update(updates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-accounts'] }),
  });
};

export const useDisconnectGmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gmail_accounts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmail-accounts'] }),
  });
};

export const useConnectGmail = () => {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-oauth-start', {
        body: { redirectOrigin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.authUrl) throw new Error('No auth URL returned');
      window.location.href = data.authUrl;
    },
  });
};

export const useSyncGmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-sync', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-threads'] });
      qc.invalidateQueries({ queryKey: ['email-messages'] });
      qc.invalidateQueries({ queryKey: ['gmail-accounts'] });
    },
  });
};

export const useEmailThreads = (filter?: 'all' | 'unread') => {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['email-threads', company?.id, filter ?? 'all'],
    enabled: !!company?.id,
    queryFn: async () => {
      let q = supabase
        .from('email_threads')
        .select('*')
        .order('last_message_at', { ascending: false })
        .limit(200);
      if (filter === 'unread') q = q.eq('is_read', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EmailThread[];
    },
  });
};

export const useThreadMessages = (threadId: string | null) => {
  return useQuery({
    queryKey: ['email-messages', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_messages')
        .select('*')
        .eq('thread_id', threadId!)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmailMessage[];
    },
  });
};

export const useMessagesForEntity = (params: {
  ownerId?: string | null;
  realtorId?: string | null;
  propertyId?: string | null;
}) => {
  const { ownerId, realtorId, propertyId } = params;
  const key = ownerId ? `owner:${ownerId}` : realtorId ? `realtor:${realtorId}` : propertyId ? `property:${propertyId}` : 'none';
  return useQuery({
    queryKey: ['email-messages-entity', key],
    enabled: !!(ownerId || realtorId || propertyId),
    queryFn: async () => {
      let q = supabase.from('email_messages').select('*').order('sent_at', { ascending: false }).limit(100);
      if (ownerId) q = q.eq('owner_id', ownerId);
      else if (realtorId) q = q.eq('realtor_id', realtorId);
      else if (propertyId) q = q.eq('property_id', propertyId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as EmailMessage[];
    },
  });
};

export const useSendEmail = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      to: string | string[];
      cc?: string | string[];
      subject: string;
      body: string;
      threadId?: string;
      accountId?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('gmail-send', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-threads'] });
      qc.invalidateQueries({ queryKey: ['email-messages'] });
      qc.invalidateQueries({ queryKey: ['email-messages-entity'] });
    },
  });
};