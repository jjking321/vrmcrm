import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Activity } from '@/types';

export const useRealtorActivities = (realtorId: string | null) => {
  const { company } = useAuth();

  return useQuery({
    queryKey: ['realtorActivities', realtorId, company?.id],
    queryFn: async (): Promise<Activity[]> => {
      if (!realtorId || !company?.id) return [];

      const { data: activities, error } = await (supabase as any)
        .from('activity_logs')
        .select('*')
        .eq('company_id', company.id)
        .eq('realtor_id', realtorId)
        .order('date', { ascending: false });

      if (error) throw error;
      if (!activities?.length) return [];

      // Fetch profiles for attribution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('company_id', company.id);

      const profilesMap = new Map<string, string>();
      profiles?.forEach(p => profilesMap.set(p.id, p.name));

      return activities.map((a: any) => ({
        id: a.id,
        type: a.type as Activity['type'],
        date: a.date,
        content: a.content,
        outcome: a.outcome || undefined,
        createdBy: a.created_by || undefined,
        createdByName: a.created_by ? profilesMap.get(a.created_by) : undefined,
        ownerName: a.owner_name || undefined,
        propertyId: a.property_id || undefined,
      }));
    },
    enabled: !!realtorId && !!company?.id,
  });
};

export const useAddRealtorActivity = () => {
  const qc = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async ({ realtorId, type, content }: { realtorId: string; type: string; content: string }) => {
      const { error } = await (supabase as any)
        .from('activity_logs')
        .insert({
          company_id: company!.id,
          realtor_id: realtorId,
          type,
          content,
          date: new Date().toISOString(),
          created_by: user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['realtorActivities', variables.realtorId] });
    },
  });
};

export const useEditRealtorActivity = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { type?: string; content?: string; outcome?: string } }) => {
      const { error } = await (supabase as any)
        .from('activity_logs')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['realtorActivities'] });
    },
  });
};

export const useDeleteRealtorActivity = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['realtorActivities'] });
    },
  });
};
