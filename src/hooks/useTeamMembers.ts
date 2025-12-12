import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  created_at: string;
}

export const useTeamMembers = () => {
  const { company, session } = useAuth();
  const queryClient = useQueryClient();

  // Fetch team members (profiles in the same company with their roles)
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ['team-members', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];

      // Fetch profiles in the company
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, created_at')
        .eq('company_id', company.id);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        throw profilesError;
      }

      // Fetch roles for all users
      const userIds = profiles.map(p => p.id);
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);

      if (rolesError) {
        console.error('Error fetching roles:', rolesError);
        throw rolesError;
      }

      // Fetch user emails from auth (we need to get this from our stored data or user metadata)
      // Since we can't directly query auth.users, we'll use the profiles and assume email is stored elsewhere
      // For now, we'll fetch the current user's email from session and mark others as needing email lookup
      
      const roleMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);

      const members: TeamMember[] = profiles.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: '', // Will be populated if we add email to profiles
        role: (roleMap.get(profile.id) as 'admin' | 'member') || 'member',
        created_at: profile.created_at || '',
      }));

      return members;
    },
    enabled: !!company?.id,
  });

  // Create team member mutation
  const createTeamMember = useMutation({
    mutationFn: async ({ name, email, password }: { name: string; email: string; password: string }) => {
      const { data, error } = await supabase.functions.invoke('create-team-member', {
        body: { name, email, password },
      });

      if (error) {
        throw new Error(error.message || 'Failed to create team member');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member added successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add team member');
    },
  });

  // Delete team member mutation (admin only)
  const deleteTeamMember = useMutation({
    mutationFn: async (userId: string) => {
      // Note: Deleting users requires admin API, would need another edge function
      // For now, we can only remove their access by deleting their profile
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success('Team member removed');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove team member');
    },
  });

  return {
    teamMembers,
    isLoading,
    createTeamMember,
    deleteTeamMember,
  };
};
