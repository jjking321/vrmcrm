import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EmailTemplate {
  id: string;
  company_id: string;
  created_by?: string | null;
  name: string;
  subject: string;
  body: string;
  is_html: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface MergeContext {
  owner?: {
    name?: string | null;
    first_name?: string | null;
    email?: string | null;
    phone?: string | null;
    mailing_address?: string | null;
  };
  property?: {
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  realtor?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  };
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

/** Available merge tag keys, surfaced in the Compose UI for one-click insertion. */
export const MERGE_TAGS: { label: string; token: string; scope: keyof MergeContext }[] = [
  { label: 'Owner first name', token: '{{owner.first_name}}', scope: 'owner' },
  { label: 'Owner full name', token: '{{owner.name}}', scope: 'owner' },
  { label: 'Owner email', token: '{{owner.email}}', scope: 'owner' },
  { label: 'Property address', token: '{{property.address}}', scope: 'property' },
  { label: 'Property city', token: '{{property.city}}', scope: 'property' },
  { label: 'Property state', token: '{{property.state}}', scope: 'property' },
  { label: 'Realtor name', token: '{{realtor.name}}', scope: 'realtor' },
  { label: 'My name', token: '{{user.name}}', scope: 'user' },
  { label: 'My email', token: '{{user.email}}', scope: 'user' },
];

/** Replace `{{path.to.value}}` tokens with values from MergeContext. */
export function applyMergeTags(input: string, ctx: MergeContext): string {
  if (!input) return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => {
    const parts = path.split('.');
    let cur: any = ctx;
    for (const p of parts) {
      if (cur == null) return '';
      cur = cur[p];
    }
    if (cur == null) return '';
    return String(cur);
  });
}

/** Derive `{ first_name }` from a full name for convenience. */
export function withDerivedOwner(ctx: MergeContext): MergeContext {
  const o = ctx.owner;
  if (!o || o.first_name || !o.name) return ctx;
  const first = o.name.trim().split(/\s+/)[0] ?? '';
  return { ...ctx, owner: { ...o, first_name: first } };
}

export const useEmailTemplates = () => {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['email-templates', company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
  });
};

export const useSaveEmailTemplate = () => {
  const qc = useQueryClient();
  const { company, profile } = useAuth();
  return useMutation({
    mutationFn: async (input: Partial<EmailTemplate> & { name: string; subject: string; body: string }) => {
      if (!company?.id) throw new Error('No company');
      const payload = {
        ...input,
        company_id: company.id,
        created_by: input.created_by ?? profile?.id ?? null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from('email_templates')
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data as EmailTemplate;
      }
      const { data, error } = await supabase
        .from('email_templates')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as EmailTemplate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
};

export const useDeleteEmailTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['email-templates'] }),
  });
};