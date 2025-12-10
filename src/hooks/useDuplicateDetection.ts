import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Property } from '@/types';

interface DbPropertyWithOwner {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  guests: number | null;
  square_feet: number | null;
  year_built: number | null;
  property_type: string | null;
  tags: string[];
  airbnb_url: string | null;
  zillow_url: string | null;
  property_url: string | null;
  market_data: any;
  created_at: string;
  latitude: number | null;
  longitude: number | null;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    mailing_address: string | null;
    mailing_city: string | null;
    mailing_state: string | null;
    mailing_zip: string | null;
    notes: string | null;
    owners: any;
    phones: any;
  } | null;
}

export interface DuplicateProperty {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  guests: number | null;
  squareFeet: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  tags: string[];
  airbnbUrl: string | null;
  zillowUrl: string | null;
  propertyUrl: string | null;
  marketData: any;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    mailingAddress: string | null;
    mailingCity: string | null;
    mailingState: string | null;
    mailingZip: string | null;
    notes: string | null;
    owners: any;
    phones: any;
  } | null;
}

export interface DuplicateGroup {
  normalizedAddress: string;
  displayAddress: string;
  properties: DuplicateProperty[];
}

// Normalize address for duplicate matching
function normalizeAddress(address: string, city: string, state: string): string {
  const normalized = `${address} ${city} ${state}`
    .toLowerCase()
    .replace(/[.,#\-']/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\b(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|place|pl|boulevard|blvd|circle|cir|way|highway|hwy|parkway|pkwy)\b/g, (m) => {
      const map: Record<string, string> = {
        street: 'st', st: 'st',
        avenue: 'ave', ave: 'ave',
        road: 'rd', rd: 'rd',
        drive: 'dr', dr: 'dr',
        lane: 'ln', ln: 'ln',
        court: 'ct', ct: 'ct',
        place: 'pl', pl: 'pl',
        boulevard: 'blvd', blvd: 'blvd',
        circle: 'cir', cir: 'cir',
        way: 'way',
        highway: 'hwy', hwy: 'hwy',
        parkway: 'pkwy', pkwy: 'pkwy'
      };
      return map[m] || m;
    })
    .trim();
  return normalized;
}

export function useDuplicates() {
  return useQuery({
    queryKey: ['duplicates'],
    queryFn: async (): Promise<DuplicateGroup[]> => {
      // Fetch all properties with their owners
      const { data: properties, error } = await supabase
        .from('properties')
        .select(`
          id,
          address,
          city,
          state,
          zip,
          bedrooms,
          bathrooms,
          guests,
          square_feet,
          year_built,
          property_type,
          tags,
          airbnb_url,
          zillow_url,
          property_url,
          market_data,
          created_at,
          latitude,
          longitude,
          owners!inner (
            id,
            name,
            email,
            phone,
            mailing_address,
            mailing_city,
            mailing_state,
            mailing_zip,
            notes,
            owners,
            phones
          )
        `)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by normalized address
      const groups = new Map<string, DuplicateProperty[]>();
      
      for (const prop of (properties || [])) {
        const normalized = normalizeAddress(prop.address, prop.city, prop.state);
        const ownerData = Array.isArray(prop.owners) ? prop.owners[0] : prop.owners;
        
        const dupProp: DuplicateProperty = {
          id: prop.id,
          address: prop.address,
          city: prop.city,
          state: prop.state,
          zip: prop.zip,
          bedrooms: prop.bedrooms,
          bathrooms: prop.bathrooms,
          guests: prop.guests,
          squareFeet: prop.square_feet,
          yearBuilt: prop.year_built,
          propertyType: prop.property_type,
          tags: prop.tags || [],
          airbnbUrl: prop.airbnb_url,
          zillowUrl: prop.zillow_url,
          propertyUrl: prop.property_url,
          marketData: prop.market_data || {},
          createdAt: prop.created_at,
          latitude: prop.latitude,
          longitude: prop.longitude,
          owner: ownerData ? {
            id: ownerData.id,
            name: ownerData.name,
            email: ownerData.email,
            phone: ownerData.phone,
            mailingAddress: ownerData.mailing_address,
            mailingCity: ownerData.mailing_city,
            mailingState: ownerData.mailing_state,
            mailingZip: ownerData.mailing_zip,
            notes: ownerData.notes,
            owners: ownerData.owners,
            phones: ownerData.phones,
          } : null,
        };

        const existing = groups.get(normalized);
        if (existing) {
          existing.push(dupProp);
        } else {
          groups.set(normalized, [dupProp]);
        }
      }

      // Filter to only groups with 2+ properties
      const duplicateGroups: DuplicateGroup[] = [];
      for (const [normalized, props] of groups) {
        if (props.length >= 2) {
          duplicateGroups.push({
            normalizedAddress: normalized,
            displayAddress: `${props[0].address}, ${props[0].city}, ${props[0].state}`,
            properties: props,
          });
        }
      }

      // Sort by number of duplicates descending
      duplicateGroups.sort((a, b) => b.properties.length - a.properties.length);

      return duplicateGroups;
    },
  });
}

interface MergeParams {
  keepPropertyId: string;
  deletePropertyIds: string[];
  mergedData: Partial<DuplicateProperty>;
  mergedOwnerData: Partial<DuplicateProperty['owner']>;
}

export function useMergeDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ keepPropertyId, deletePropertyIds, mergedData, mergedOwnerData }: MergeParams) => {
      // 1. Move activities from deleted properties to the kept property
      for (const deleteId of deletePropertyIds) {
        await supabase
          .from('activity_logs')
          .update({ property_id: keepPropertyId })
          .eq('property_id', deleteId);
      }

      // 2. Update the kept property with merged data
      const propertyUpdate: any = {};
      if (mergedData.bedrooms !== undefined) propertyUpdate.bedrooms = mergedData.bedrooms;
      if (mergedData.bathrooms !== undefined) propertyUpdate.bathrooms = mergedData.bathrooms;
      if (mergedData.guests !== undefined) propertyUpdate.guests = mergedData.guests;
      if (mergedData.squareFeet !== undefined) propertyUpdate.square_feet = mergedData.squareFeet;
      if (mergedData.yearBuilt !== undefined) propertyUpdate.year_built = mergedData.yearBuilt;
      if (mergedData.propertyType !== undefined) propertyUpdate.property_type = mergedData.propertyType;
      if (mergedData.tags !== undefined) propertyUpdate.tags = mergedData.tags;
      if (mergedData.airbnbUrl !== undefined) propertyUpdate.airbnb_url = mergedData.airbnbUrl;
      if (mergedData.zillowUrl !== undefined) propertyUpdate.zillow_url = mergedData.zillowUrl;
      if (mergedData.propertyUrl !== undefined) propertyUpdate.property_url = mergedData.propertyUrl;
      if (mergedData.marketData !== undefined) propertyUpdate.market_data = mergedData.marketData;
      if (mergedData.latitude !== undefined) propertyUpdate.latitude = mergedData.latitude;
      if (mergedData.longitude !== undefined) propertyUpdate.longitude = mergedData.longitude;

      if (Object.keys(propertyUpdate).length > 0) {
        const { error: propError } = await supabase
          .from('properties')
          .update(propertyUpdate)
          .eq('id', keepPropertyId);
        if (propError) throw propError;
      }

      // 3. Update the kept property's owner with merged data
      if (mergedOwnerData && Object.keys(mergedOwnerData).length > 0) {
        const ownerUpdate: any = {};
        if (mergedOwnerData.name !== undefined) ownerUpdate.name = mergedOwnerData.name;
        if (mergedOwnerData.email !== undefined) ownerUpdate.email = mergedOwnerData.email;
        if (mergedOwnerData.phone !== undefined) ownerUpdate.phone = mergedOwnerData.phone;
        if (mergedOwnerData.mailingAddress !== undefined) ownerUpdate.mailing_address = mergedOwnerData.mailingAddress;
        if (mergedOwnerData.mailingCity !== undefined) ownerUpdate.mailing_city = mergedOwnerData.mailingCity;
        if (mergedOwnerData.mailingState !== undefined) ownerUpdate.mailing_state = mergedOwnerData.mailingState;
        if (mergedOwnerData.mailingZip !== undefined) ownerUpdate.mailing_zip = mergedOwnerData.mailingZip;
        if (mergedOwnerData.notes !== undefined) ownerUpdate.notes = mergedOwnerData.notes;
        if (mergedOwnerData.owners !== undefined) ownerUpdate.owners = mergedOwnerData.owners;
        if (mergedOwnerData.phones !== undefined) ownerUpdate.phones = mergedOwnerData.phones;

        if (Object.keys(ownerUpdate).length > 0) {
          await supabase
            .from('owners')
            .update(ownerUpdate)
            .eq('property_id', keepPropertyId);
        }
      }

      // 4. Delete owners of the duplicate properties
      for (const deleteId of deletePropertyIds) {
        await supabase
          .from('owners')
          .delete()
          .eq('property_id', deleteId);
      }

      // 5. Delete the duplicate properties
      const { error: deleteError } = await supabase
        .from('properties')
        .delete()
        .in('id', deletePropertyIds);

      if (deleteError) throw deleteError;

      return { merged: 1, deleted: deletePropertyIds.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
      toast.success(`Merged ${result.deleted + 1} properties into 1`);
    },
    onError: (error) => {
      console.error('Merge error:', error);
      toast.error('Failed to merge duplicates');
    },
  });
}

export function useAutoMergeDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groups, strategy }: { groups: DuplicateGroup[]; strategy: 'oldest' | 'newest' }) => {
      let totalMerged = 0;
      let totalDeleted = 0;

      for (const group of groups) {
        const sorted = [...group.properties].sort((a, b) => 
          strategy === 'oldest' 
            ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        const keep = sorted[0];
        const deleteIds = sorted.slice(1).map(p => p.id);

        // Merge tags from all properties
        const allTags = new Set<string>();
        for (const prop of group.properties) {
          prop.tags.forEach(t => allTags.add(t));
        }

        // Move activities
        for (const deleteId of deleteIds) {
          await supabase
            .from('activity_logs')
            .update({ property_id: keep.id })
            .eq('property_id', deleteId);
        }

        // Update kept property with merged tags
        await supabase
          .from('properties')
          .update({ tags: Array.from(allTags) })
          .eq('id', keep.id);

        // Delete owners
        for (const deleteId of deleteIds) {
          await supabase
            .from('owners')
            .delete()
            .eq('property_id', deleteId);
        }

        // Delete duplicates
        await supabase
          .from('properties')
          .delete()
          .in('id', deleteIds);

        totalMerged++;
        totalDeleted += deleteIds.length;
      }

      return { totalMerged, totalDeleted };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['property-count'] });
      toast.success(`Merged ${result.totalMerged} groups, removed ${result.totalDeleted} duplicates`);
    },
    onError: (error) => {
      console.error('Auto-merge error:', error);
      toast.error('Failed to auto-merge duplicates');
    },
  });
}
