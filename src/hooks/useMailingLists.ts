import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MailingList, MailingListItem, Property } from '@/types';
import { toast } from 'sonner';
import { deriveMailingFields } from '@/lib/mailingAddress';

// Street suffix abbreviation map for normalization
const SUFFIX_MAP: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', drive: 'dr', lane: 'ln',
  court: 'ct', circle: 'cir', boulevard: 'blvd', place: 'pl', way: 'way',
  terrace: 'ter', trail: 'trl', parkway: 'pkwy', highway: 'hwy',
};

/**
 * Normalize a mailing address for deduplication.
 * - Lowercases everything
 * - Strips punctuation
 * - Abbreviates street suffixes
 * - Collapses whitespace
 */
function normalizeMailingAddress(
  street: string,
  city: string,
  state: string,
  zip: string
): string {
  const combined = `${street} ${city} ${state} ${zip}`.toLowerCase();
  
  // Remove punctuation and special chars
  let normalized = combined.replace(/[.,#\-']/g, '');
  
  // Abbreviate street suffixes
  for (const [full, abbr] of Object.entries(SUFFIX_MAP)) {
    normalized = normalized.replace(new RegExp(`\\b${full}\\b`, 'g'), abbr);
  }
  
  // Collapse whitespace
  return normalized.replace(/\s+/g, ' ').trim();
}

// Transform database row to MailingList
const transformMailingList = (row: any): MailingList => ({
  id: row.id,
  companyId: row.company_id,
  name: row.name,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  exportedAt: row.exported_at,
  exportCount: row.export_count || 0,
});

// Transform database row to MailingListItem
const transformMailingListItem = (row: any): MailingListItem => ({
  id: row.id,
  mailingListId: row.mailing_list_id,
  propertyId: row.property_id,
  companyId: row.company_id,
  status: row.status as 'pending' | 'sent',
  createdAt: row.created_at,
  sortOrder: row.sort_order,
});

// Fetch all mailing lists with counts
export const useMailingLists = () => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['mailingLists', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data: lists, error } = await supabase
        .from('mailing_lists')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Get counts for each list
      const listsWithCounts = await Promise.all(
        (lists || []).map(async (list) => {
          const { count: totalCount } = await supabase
            .from('mailing_list_items')
            .select('*', { count: 'exact', head: true })
            .eq('mailing_list_id', list.id);
          
          return {
            ...transformMailingList(list),
            totalCount: totalCount || 0,
          };
        })
      );
      
      return listsWithCounts;
    },
    enabled: !!company?.id,
  });
};

// Fetch items for a specific mailing list with property and owner data
export const useMailingListItems = (listId: string | null) => {
  const { company } = useAuth();
  
  return useQuery({
    queryKey: ['mailingListItems', listId],
    queryFn: async () => {
      if (!listId || !company?.id) return [];
      
      // Fetch all mailing list items in batches (bypass 1000-row limit)
      let allItems: any[] = [];
      let offset = 0;
      const batchSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: batch, error } = await supabase
          .from('mailing_list_items')
          .select('*')
          .eq('mailing_list_id', listId)
          .order('sort_order', { ascending: true })
          .range(offset, offset + batchSize - 1);
        
        if (error) throw error;
        allItems.push(...(batch || []));
        hasMore = (batch?.length || 0) === batchSize;
        offset += batchSize;
      }
      
      // Get unique property IDs
      const propertyIds = [...new Set(allItems.map(item => item.property_id))];
      
      if (propertyIds.length === 0) return [];
      
      // Batch fetch properties (chunk .in() to avoid limits)
      const chunkSize = 100;
      const allProperties: any[] = [];
      for (let i = 0; i < propertyIds.length; i += chunkSize) {
        const chunk = propertyIds.slice(i, i + chunkSize);
        const { data, error: propError } = await supabase
          .from('properties')
          .select('*')
          .in('id', chunk);
        if (propError) throw propError;
        allProperties.push(...(data || []));
      }
      
      // Batch fetch owners (chunk .in() to avoid limits)
      const allOwners: any[] = [];
      for (let i = 0; i < propertyIds.length; i += chunkSize) {
        const chunk = propertyIds.slice(i, i + chunkSize);
        const { data, error: ownerError } = await supabase
          .from('owners')
          .select('*')
          .in('property_id', chunk);
        if (ownerError) throw ownerError;
        allOwners.push(...(data || []));
      }
      
      // Map owners to properties
      const ownerMap = new Map();
      allOwners.forEach(owner => {
        ownerMap.set(owner.property_id, owner);
      });
      
      // Transform properties
      const propertyMap = new Map<string, Property>();
      allProperties.forEach(prop => {
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
          bookingLink: prop.booking_link,
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
      return allItems.map(item => ({
        ...transformMailingListItem(item),
        property: propertyMap.get(item.property_id),
      }));
    },
    enabled: !!listId && !!company?.id,
  });
};

// Create a new mailing list
export const useCreateMailingList = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();
  
  return useMutation({
    mutationFn: async (name: string) => {
      if (!company?.id) throw new Error('No company');
      
      const { data, error } = await supabase
        .from('mailing_lists')
        .insert({
          company_id: company.id,
          name,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return transformMailingList(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
    },
  });
};

// Add properties to a mailing list
export const useAddToMailingList = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      listId, 
      properties,
      dedupeByAddress = true,
    }: { 
      listId: string; 
      properties: Property[];
      dedupeByAddress?: boolean;
    }) => {
      if (!company?.id) throw new Error('No company');
      
      // If deduping, get existing items in the list
      let existingNormalizedAddresses = new Set<string>();
      if (dedupeByAddress) {
        const { data: existingItems } = await supabase
          .from('mailing_list_items')
          .select('property_id')
          .eq('mailing_list_id', listId);
        
        if (existingItems && existingItems.length > 0) {
          // Get the owners to check mailing addresses
          const { data: existingOwners } = await supabase
            .from('owners')
            .select('mailing_address, mailing_city, mailing_state, mailing_zip')
            .in('property_id', existingItems.map(i => i.property_id));
          
          existingOwners?.forEach(owner => {
            // Use deriveMailingFields to get corrected components
            const derived = deriveMailingFields(
              {
                mailingAddress: owner.mailing_address || '',
                mailingCity: owner.mailing_city || '',
                mailingState: owner.mailing_state || '',
                mailingZip: owner.mailing_zip || '',
              },
              null
            );
            const key = normalizeMailingAddress(
              derived.mailingAddress,
              derived.mailingCity,
              derived.mailingState,
              derived.mailingZip
            );
            existingNormalizedAddresses.add(key);
          });
        }
      }
      
      const items: any[] = [];
      let sortOrder = 0;
      let skippedCount = 0;
      
      properties.forEach(property => {
        // Check if mailing address already exists using derived + normalized key
        if (dedupeByAddress) {
          const derived = deriveMailingFields(property.owner, property);
          const key = normalizeMailingAddress(
            derived.mailingAddress,
            derived.mailingCity,
            derived.mailingState,
            derived.mailingZip
          );
          if (existingNormalizedAddresses.has(key)) {
            skippedCount++;
            return;
          }
          existingNormalizedAddresses.add(key);
        }
        
        items.push({
          mailing_list_id: listId,
          property_id: property.id,
          company_id: company.id,
          status: 'pending',
          sort_order: sortOrder++,
        });
      });
      
      if (items.length === 0) {
        return { added: 0, skipped: skippedCount };
      }
      
      const { error } = await supabase
        .from('mailing_list_items')
        .insert(items);
      
      if (error) throw error;
      
      return { added: items.length, skipped: skippedCount };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
      queryClient.invalidateQueries({ queryKey: ['mailingListItems'] });
      const skippedMsg = result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : '';
      toast.success(`Added ${result.added} addresses to mailing list${skippedMsg}`);
    },
    onError: (error) => {
      toast.error(`Failed to add to mailing list: ${error.message}`);
    },
  });
};

// Update export tracking on a mailing list
export const useUpdateMailingListExport = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (listId: string) => {
      // Get current export count
      const { data: current, error: fetchError } = await supabase
        .from('mailing_lists')
        .select('export_count')
        .eq('id', listId)
        .single();
      
      if (fetchError) throw fetchError;
      
      const { error } = await supabase
        .from('mailing_lists')
        .update({
          exported_at: new Date().toISOString(),
          export_count: (current?.export_count || 0) + 1,
        })
        .eq('id', listId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
    },
  });
};

// Delete a mailing list
export const useDeleteMailingList = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('mailing_lists')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
      toast.success('Mailing list deleted');
    },
    onError: () => {
      toast.error('Failed to delete mailing list');
    },
  });
};

// Remove item from mailing list with optimistic update
export const useRemoveMailingListItem = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('mailing_list_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      return itemId;
    },
    onMutate: async (itemId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['mailingListItems'] });
      
      // Snapshot all mailingListItems queries
      const previousData = queryClient.getQueriesData({ queryKey: ['mailingListItems'] });
      
      // Optimistically remove from all matching queries
      queryClient.setQueriesData(
        { queryKey: ['mailingListItems'] },
        (old: any[] | undefined) => old?.filter(item => item.id !== itemId) ?? []
      );
      
      return { previousData };
    },
    onError: (_err, _itemId, context) => {
      // Rollback on error
      context?.previousData?.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      toast.error('Failed to remove from mailing list');
    },
    onSettled: () => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['mailingListItems'] });
      queryClient.invalidateQueries({ queryKey: ['mailingLists'] });
    },
  });
};
