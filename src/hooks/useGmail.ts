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

export interface EmailAttachment {
  id: string;
  message_id: string;
  company_id: string;
  filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  created_at: string;
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

export const useThreadsByIds = (threadIds: string[]) => {
  const sorted = [...threadIds].sort();
  return useQuery({
    queryKey: ['email-threads-by-ids', sorted.join(',')],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_threads')
        .select('*')
        .in('id', sorted)
        .order('last_message_at', { ascending: false });
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
  propertyIds?: string[];
  ownerIds?: string[];
}) => {
  const { ownerId, realtorId, propertyId, propertyIds, ownerIds } = params;
  const key = ownerId
    ? `owner:${ownerId}`
    : realtorId
    ? `realtor:${realtorId}`
    : propertyId
    ? `property:${propertyId}`
    : ownerIds && ownerIds.length
    ? `owners:${[...ownerIds].sort().join(',')}`
    : propertyIds && propertyIds.length
    ? `properties:${[...propertyIds].sort().join(',')}`
    : 'none';
  return useQuery({
    queryKey: ['email-messages-entity', key],
    enabled: !!(ownerId || realtorId || propertyId || (ownerIds && ownerIds.length) || (propertyIds && propertyIds.length)),
    queryFn: async () => {
      let q = supabase.from('email_messages').select('*').order('sent_at', { ascending: false }).limit(200);
      if (ownerId) q = q.eq('owner_id', ownerId);
      else if (realtorId) q = q.eq('realtor_id', realtorId);
      else if (propertyId) q = q.eq('property_id', propertyId);
      else if (ownerIds && ownerIds.length) q = q.in('owner_id', ownerIds);
      else if (propertyIds && propertyIds.length) q = q.in('property_id', propertyIds);
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
      attachments?: { storage_path: string; filename: string; mime_type?: string }[];
    }) => {
      const { data, error } = await supabase.functions.invoke('gmail-send', { body: payload });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-threads'] });
      qc.invalidateQueries({ queryKey: ['email-messages'] });
      qc.invalidateQueries({ queryKey: ['email-messages-entity'] });
      qc.invalidateQueries({ queryKey: ['email-attachments'] });
    },
  });
};

/** Fetch attachments for a set of message ids. */
export const useAttachmentsForMessages = (messageIds: string[]) => {
  const sorted = [...messageIds].sort();
  return useQuery({
    queryKey: ['email-attachments', sorted.join(',')],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_attachments')
        .select('*')
        .in('message_id', sorted)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmailAttachment[];
    },
  });
};

/** Generate a short-lived signed URL for an attachment. */
export async function getAttachmentUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('email-attachments')
    .createSignedUrl(storagePath, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not sign URL');
  return data.signedUrl;
}

export interface ThreadContact {
  label: string;
  kind: 'owner' | 'realtor' | 'property' | 'unmatched';
}

/** Resolve a contact label per thread by inspecting matched messages. */
export const useThreadContacts = (threadIds: string[]) => {
  const sorted = [...threadIds].sort();
  return useQuery({
    queryKey: ['email-thread-contacts', sorted.join(',')],
    enabled: sorted.length > 0,
    queryFn: async () => {
      const { data: msgs, error } = await supabase
        .from('email_messages')
        .select('thread_id, owner_id, realtor_id, property_id')
        .in('thread_id', sorted);
      if (error) throw error;

      const ownerIds = new Set<string>();
      const realtorIds = new Set<string>();
      const propertyIds = new Set<string>();
      (msgs ?? []).forEach((m: any) => {
        if (m.owner_id) ownerIds.add(m.owner_id);
        if (m.realtor_id) realtorIds.add(m.realtor_id);
        if (m.property_id) propertyIds.add(m.property_id);
      });

      const [owners, realtors, properties] = await Promise.all([
        ownerIds.size
          ? supabase.from('owners').select('id, name, contact_name, property_id').in('id', Array.from(ownerIds))
          : Promise.resolve({ data: [] as any[], error: null }),
        realtorIds.size
          ? supabase.from('realtors').select('id, name').in('id', Array.from(realtorIds))
          : Promise.resolve({ data: [] as any[], error: null }),
        propertyIds.size
          ? supabase.from('properties').select('id, address').in('id', Array.from(propertyIds))
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const ownerMap = new Map<string, any>((owners.data ?? []).map((o: any) => [o.id, o]));
      const realtorMap = new Map<string, any>((realtors.data ?? []).map((r: any) => [r.id, r]));
      const propMap = new Map<string, any>((properties.data ?? []).map((p: any) => [p.id, p]));

      const result = new Map<string, ThreadContact>();
      (msgs ?? []).forEach((m: any) => {
        if (result.has(m.thread_id)) return;
        if (m.owner_id && ownerMap.has(m.owner_id)) {
          const o = ownerMap.get(m.owner_id);
          const name = o.contact_name || o.name || 'Owner';
          const prop = o.property_id ? propMap.get(o.property_id) : null;
          result.set(m.thread_id, {
            label: prop?.address ? `${name} · ${prop.address}` : name,
            kind: 'owner',
          });
        } else if (m.realtor_id && realtorMap.has(m.realtor_id)) {
          result.set(m.thread_id, { label: realtorMap.get(m.realtor_id).name || 'Realtor', kind: 'realtor' });
        } else if (m.property_id && propMap.has(m.property_id)) {
          result.set(m.thread_id, { label: propMap.get(m.property_id).address || 'Property', kind: 'property' });
        }
      });
      return result;
    },
  });
};

/** Quick multi-entity search for the "link thread" picker. */
export type EntitySearchHit =
  | { kind: 'owner'; id: string; label: string; sublabel?: string }
  | { kind: 'realtor'; id: string; label: string; sublabel?: string }
  | { kind: 'property'; id: string; label: string; sublabel?: string };

export const useEntitySearch = (query: string) => {
  const { company } = useAuth();
  const q = query.trim();
  return useQuery({
    queryKey: ['entity-search', company?.id, q],
    enabled: !!company?.id && q.length >= 2,
    queryFn: async (): Promise<EntitySearchHit[]> => {
      const like = `%${q}%`;
      const [owners, realtors, properties] = await Promise.all([
        supabase
          .from('owners')
          .select('id, name, contact_name, email, phone')
          .or(`name.ilike.${like},contact_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(8),
        supabase
          .from('realtors')
          .select('id, name, email, phone')
          .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
          .limit(8),
        supabase
          .from('properties')
          .select('id, address, city, state')
          .or(`address.ilike.${like},city.ilike.${like}`)
          .limit(8),
      ]);
      const hits: EntitySearchHit[] = [];
      (owners.data ?? []).forEach((o: any) => hits.push({
        kind: 'owner', id: o.id,
        label: o.contact_name || o.name || 'Owner',
        sublabel: o.email || o.phone || undefined,
      }));
      (realtors.data ?? []).forEach((r: any) => hits.push({
        kind: 'realtor', id: r.id,
        label: r.name || 'Realtor',
        sublabel: r.email || r.phone || undefined,
      }));
      (properties.data ?? []).forEach((p: any) => hits.push({
        kind: 'property', id: p.id,
        label: p.address || 'Property',
        sublabel: [p.city, p.state].filter(Boolean).join(', ') || undefined,
      }));
      return hits;
    },
  });
};

/** Link or relink every message in a thread to the chosen entity. */
export const useLinkThread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { threadId: string; target: { kind: 'owner' | 'realtor' | 'property'; id: string } | null }) => {
      const patch: Record<string, any> = {
        owner_id: null,
        realtor_id: null,
        property_id: null,
        match_status: input.target ? 'matched' : 'unmatched',
      };
      if (input.target) {
        if (input.target.kind === 'owner') patch.owner_id = input.target.id;
        if (input.target.kind === 'realtor') patch.realtor_id = input.target.id;
        if (input.target.kind === 'property') patch.property_id = input.target.id;
      }
      const { error } = await supabase
        .from('email_messages')
        .update(patch)
        .eq('thread_id', input.threadId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-thread-contacts'] });
      qc.invalidateQueries({ queryKey: ['email-messages'] });
      qc.invalidateQueries({ queryKey: ['email-messages-entity'] });
      qc.invalidateQueries({ queryKey: ['email-threads'] });
    },
  });
};