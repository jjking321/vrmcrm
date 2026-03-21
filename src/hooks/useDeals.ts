import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Deal } from '@/types';

const mapRow = (row: any): Deal => ({
  id: row.id,
  companyId: row.company_id,
  stageId: row.stage_id,
  propertyId: row.property_id || undefined,
  realtorId: row.realtor_id || undefined,
  contactName: row.contact_name,
  contactPhone: row.contact_phone || undefined,
  contactEmail: row.contact_email || undefined,
  notes: row.notes || undefined,
  dealValue: row.deal_value != null ? Number(row.deal_value) : undefined,
  createdBy: row.created_by || undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function useDeals() {
  const { company } = useAuth();
  return useQuery({
    queryKey: ['deals', company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapRow);
    },
    enabled: !!company?.id,
  });
}

export function useAddDeal() {
  const qc = useQueryClient();
  const { company, user } = useAuth();
  return useMutation({
    mutationFn: async (deal: {
      contactName: string;
      contactPhone?: string;
      contactEmail?: string;
      notes?: string;
      dealValue?: number;
      stageId: string;
    }) => {
      const { error } = await supabase.from('deals').insert({
        company_id: company!.id,
        stage_id: deal.stageId,
        contact_name: deal.contactName,
        contact_phone: deal.contactPhone || null,
        contact_email: deal.contactEmail || null,
        notes: deal.notes || null,
        deal_value: deal.dealValue ?? null,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<{ stageId: string; contactName: string; contactPhone: string; contactEmail: string; notes: string; dealValue: number; propertyId: string }> }) => {
      const mapped: any = {};
      if (updates.stageId !== undefined) mapped.stage_id = updates.stageId;
      if (updates.contactName !== undefined) mapped.contact_name = updates.contactName;
      if (updates.contactPhone !== undefined) mapped.contact_phone = updates.contactPhone;
      if (updates.contactEmail !== undefined) mapped.contact_email = updates.contactEmail;
      if (updates.notes !== undefined) mapped.notes = updates.notes;
      if (updates.dealValue !== undefined) mapped.deal_value = updates.dealValue;
      if (updates.propertyId !== undefined) mapped.property_id = updates.propertyId;
      const { error } = await supabase.from('deals').update(mapped).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}

export function useDeleteDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deals'] }),
  });
}
