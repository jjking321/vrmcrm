import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Activity } from '@/types';

// Fetch activities for a specific owner name
export const useOwnerActivities = (ownerName: string | null) => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['ownerActivities', ownerName, company?.id],
    queryFn: async (): Promise<Activity[]> => {
      if (!ownerName || !company?.id) return [];
      
      // Fetch activities by owner_name
      const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', company.id)
        .eq('owner_name', ownerName)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      if (!activities?.length) return [];
      
      // Get unique property IDs to fetch addresses
      const propertyIds = [...new Set(activities.map(a => a.property_id))];
      
      // Fetch property addresses
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, address, city, state')
        .in('id', propertyIds);
      
      if (propError) throw propError;
      
      // Create property address map
      const propertyMap = new Map<string, string>();
      properties?.forEach(p => {
        propertyMap.set(p.id, `${p.address}, ${p.city}, ${p.state}`);
      });
      
      // Fetch profiles for attribution
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('company_id', company.id);
      
      const profilesMap = new Map<string, string>();
      profiles?.forEach(p => profilesMap.set(p.id, p.name));
      
      return activities.map(a => ({
        id: a.id,
        type: a.type as Activity['type'],
        date: a.date,
        content: a.content,
        outcome: a.outcome || undefined,
        createdBy: a.created_by || undefined,
        createdByName: a.created_by ? profilesMap.get(a.created_by) : undefined,
        ownerName: a.owner_name || undefined,
        propertyId: a.property_id,
        propertyAddress: propertyMap.get(a.property_id) || undefined,
      }));
    },
    enabled: !!ownerName && !!company?.id,
  });
};

// Fetch activities for all owners of a property
export const usePropertyOwnerActivities = (ownerNames: string[]) => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['propertyOwnerActivities', ownerNames, company?.id],
    queryFn: async (): Promise<Activity[]> => {
      if (!ownerNames.length || !company?.id) return [];
      
      // Fetch activities for all owner names associated with this property
      const { data: activities, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('company_id', company.id)
        .in('owner_name', ownerNames)
        .order('date', { ascending: false });
      
      if (error) throw error;
      
      if (!activities?.length) return [];
      
      // Get unique property IDs
      const propertyIds = [...new Set(activities.map(a => a.property_id))];
      
      // Fetch property addresses
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, address, city, state')
        .in('id', propertyIds);
      
      if (propError) throw propError;
      
      const propertyMap = new Map<string, string>();
      properties?.forEach(p => {
        propertyMap.set(p.id, `${p.address}, ${p.city}, ${p.state}`);
      });
      
      // Fetch profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('company_id', company.id);
      
      const profilesMap = new Map<string, string>();
      profiles?.forEach(p => profilesMap.set(p.id, p.name));
      
      return activities.map(a => ({
        id: a.id,
        type: a.type as Activity['type'],
        date: a.date,
        content: a.content,
        outcome: a.outcome || undefined,
        createdBy: a.created_by || undefined,
        createdByName: a.created_by ? profilesMap.get(a.created_by) : undefined,
        ownerName: a.owner_name || undefined,
        propertyId: a.property_id,
        propertyAddress: propertyMap.get(a.property_id) || undefined,
      }));
    },
    enabled: ownerNames.length > 0 && !!company?.id,
  });
};
