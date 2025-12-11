import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CallList, CallListItem, Property, CallOutcome, CallItemStatus } from '@/types';
import { toast } from 'sonner';

// Transform database row to CallList
const transformCallList = (row: any): CallList => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// Transform database row to CallListItem
const transformCallListItem = (row: any): CallListItem => ({
  id: row.id,
  callListId: row.call_list_id,
  propertyId: row.property_id,
  companyId: row.company_id,
  ownerIndex: row.owner_index,
  phoneIndex: row.phone_index,
  status: row.status as CallItemStatus,
  callOutcome: row.call_outcome as CallOutcome | null,
  notes: row.notes,
  lastCalledAt: row.last_called_at,
  callCount: row.call_count,
  callbackDate: row.callback_date,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
});

// Fetch all call lists with counts
export const useCallLists = () => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['callLists', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data: lists, error } = await supabase
        .from('call_lists')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get counts for each list
      const listsWithCounts = await Promise.all(
        (lists || []).map(async (list) => {
          const { count: totalCount } = await supabase
            .from('call_list_items')
            .select('*', { count: 'exact', head: true })
            .eq('call_list_id', list.id);
          
          const { count: completedCount } = await supabase
            .from('call_list_items')
            .select('*', { count: 'exact', head: true })
            .eq('call_list_id', list.id)
            .eq('status', 'completed');
          
          const { count: pendingCount } = await supabase
            .from('call_list_items')
            .select('*', { count: 'exact', head: true })
            .eq('call_list_id', list.id)
            .eq('status', 'pending');
          
          return {
            ...transformCallList(list),
            totalCount: totalCount || 0,
            completedCount: completedCount || 0,
            pendingCount: pendingCount || 0,
          };
        })
      );
      
      return listsWithCounts;
    },
    enabled: !!company?.id,
  });
};

// Fetch items for a specific call list with property data
export const useCallListItems = (listId: string | null) => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['callListItems', listId],
    queryFn: async () => {
      if (!listId || !company?.id) return [];
      
      // Get call list items
      const { data: items, error } = await supabase
        .from('call_list_items')
        .select('*')
        .eq('call_list_id', listId)
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      
      // Get unique property IDs
      const propertyIds = [...new Set((items || []).map(item => item.property_id))];
      
      if (propertyIds.length === 0) return [];
      
      // Fetch properties with owners
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('*')
        .in('id', propertyIds);
      
      if (propError) throw propError;
      
      // Fetch owners for these properties
      const { data: owners, error: ownerError } = await supabase
        .from('owners')
        .select('*')
        .in('property_id', propertyIds);
      
      if (ownerError) throw ownerError;
      
      // Map owners to properties
      const ownerMap = new Map();
      owners?.forEach(owner => {
        ownerMap.set(owner.property_id, owner);
      });
      
      // Transform properties
      const propertyMap = new Map<string, Property>();
      properties?.forEach(prop => {
        const owner = ownerMap.get(prop.id);
        propertyMap.set(prop.id, {
          id: prop.id,
          companyId: prop.company_id,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          zip: prop.zip,
          bedrooms: prop.bedrooms,
          bathrooms: Number(prop.bathrooms),
          guests: prop.guests,
          squareFeet: prop.square_feet,
          yearBuilt: prop.year_built,
          lotSize: prop.lot_size ? Number(prop.lot_size) : undefined,
          propertyType: prop.property_type,
          latitude: prop.latitude,
          longitude: prop.longitude,
          image: prop.image || '',
          stageId: prop.stage_id || '',
          tags: prop.tags || [],
          marketData: (prop.market_data as any) || {},
          customFields: prop.custom_fields as Record<string, any> || {},
          airbnbUrl: prop.airbnb_url,
          zillowUrl: prop.zillow_url,
          propertyUrl: prop.property_url,
          listingTitle: prop.listing_title,
          roomType: prop.room_type,
          propertyManager: prop.property_manager,
          host: prop.host,
          activities: [],
          owner: owner ? {
            name: owner.name || '',
            email: owner.email || '',
            phone: owner.phone || '',
            owners: (owner.owners as any[]) || [],
            phones: (owner.phones as any[]) || [],
            emails: (owner.emails as any[]) || [],
            mailingAddress: owner.mailing_address,
            mailingCity: owner.mailing_city,
            mailingState: owner.mailing_state,
            mailingZip: owner.mailing_zip,
            ownershipLengthMonths: owner.ownership_length_months,
            ownerType: owner.owner_type,
            ownerOccupied: owner.owner_occupied,
            litigator: owner.litigator,
            contactName: owner.contact_name,
            age: owner.age,
            notes: owner.notes,
          } : {
            name: '',
            email: '',
            phone: '',
          },
        });
      });
      
      // Attach properties to items
      return (items || []).map(item => ({
        ...transformCallListItem(item),
        property: propertyMap.get(item.property_id),
      }));
    },
    enabled: !!listId && !!company?.id,
  });
};

// Create a new call list
export const useCreateCallList = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();
  
  return useMutation({
    mutationFn: async (name: string) => {
      if (!company?.id) throw new Error('No company');
      
      const { data, error } = await supabase
        .from('call_lists')
        .insert({
          company_id: company.id,
          name,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return transformCallList(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callLists'] });
    },
  });
};

// Add properties to a call list
export const useAddToCallList = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      listId, 
      properties,
      phoneFilter,
    }: { 
      listId: string; 
      properties: Property[];
      phoneFilter: 'all' | 'mobile' | 'first';
    }) => {
      if (!company?.id) throw new Error('No company');
      
      const items: any[] = [];
      let sortOrder = 0;
      
      properties.forEach(property => {
        const owner = property.owner;
        const phones = owner.phones || [];
        const legacyPhone = owner.phone;
        
        // Determine which phones to add
        let phonesToAdd: { index: number | null; phone: any }[] = [];
        
        if (phones.length > 0) {
          phones.forEach((phone, idx) => {
            if (phoneFilter === 'all') {
              phonesToAdd.push({ index: idx, phone });
            } else if (phoneFilter === 'mobile' && phone.type === 'mobile') {
              phonesToAdd.push({ index: idx, phone });
            } else if (phoneFilter === 'first' && idx === 0) {
              phonesToAdd.push({ index: idx, phone });
            }
          });
        } else if (legacyPhone) {
          // Use legacy phone field
          if (phoneFilter !== 'mobile') {
            phonesToAdd.push({ index: null, phone: { number: legacyPhone, type: 'unknown', doNotCall: false } });
          }
        }
        
        // If no phones match filter, still add entry with null phone
        if (phonesToAdd.length === 0) {
          phonesToAdd.push({ index: null, phone: null });
        }
        
        // Create items for each phone
        phonesToAdd.forEach(({ index }) => {
          items.push({
            call_list_id: listId,
            property_id: property.id,
            company_id: company.id,
            owner_index: 0, // For now, use first owner
            phone_index: index,
            status: 'pending',
            sort_order: sortOrder++,
          });
        });
      });
      
      if (items.length === 0) {
        throw new Error('No items to add');
      }
      
      const { error } = await supabase
        .from('call_list_items')
        .insert(items);
      
      if (error) throw error;
      
      return items.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['callLists'] });
      queryClient.invalidateQueries({ queryKey: ['callListItems'] });
      toast.success(`Added ${count} contacts to call list`);
    },
    onError: (error) => {
      toast.error(`Failed to add to call list: ${error.message}`);
    },
  });
};

// Update a call list item
export const useUpdateCallListItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      updates 
    }: { 
      id: string; 
      updates: Partial<{
        status: CallItemStatus;
        call_outcome: CallOutcome;
        notes: string;
        last_called_at: string;
        call_count: number;
        callback_date: string | null;
      }>
    }) => {
      const { error } = await supabase
        .from('call_list_items')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callListItems'] });
      queryClient.invalidateQueries({ queryKey: ['callLists'] });
    },
  });
};

// Delete a call list
export const useDeleteCallList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('call_lists')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['callLists'] });
      toast.success('Call list deleted');
    },
    onError: () => {
      toast.error('Failed to delete call list');
    },
  });
};

// Log a call as an activity
export const useLogCallActivity = () => {
  const { company, user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      propertyId,
      ownerName,
      phoneNumber,
      phoneType,
      outcome,
      notes,
    }: {
      propertyId: string;
      ownerName: string;
      phoneNumber: string;
      phoneType: string;
      outcome: CallOutcome;
      notes?: string;
    }) => {
      if (!company?.id) throw new Error('No company');
      
      const outcomeLabels: Record<CallOutcome, string> = {
        answered: 'Answered',
        voicemail: 'Left voicemail',
        no_answer: 'No answer',
        wrong_number: 'Wrong number',
        callback: 'Scheduled callback',
        dnc_skipped: 'DNC - Skipped',
      };
      
      const content = `Called ${ownerName} at ${phoneNumber} (${phoneType})`;
      
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          property_id: propertyId,
          company_id: company.id,
          created_by: user?.id,
          type: 'call',
          content: notes ? `${content}\n\nNotes: ${notes}` : content,
          outcome: outcomeLabels[outcome],
        });
      
      if (error) throw error;
    },
  });
};
