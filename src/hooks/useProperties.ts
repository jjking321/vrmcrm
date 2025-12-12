import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Property, Owner, Activity, MarketData } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useState, useCallback } from 'react';

interface DbProperty {
  id: string;
  company_id: string;
  stage_id: string | null;
  address: string;
  city: string;
  state: string;
  zip: string;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  guests: number | null;
  square_feet: number | null;
  year_built: number | null;
  lot_size: number | null;
  property_type: string | null;
  image: string | null;
  airbnb_url: string | null;
  zillow_url: string | null;
  property_url: string | null;
  booking_link: string | null;
  listing_title: string | null;
  room_type: string | null;
  property_manager: string | null;
  host: string | null;
  market_data: MarketData | null;
  tags: string[];
  custom_fields: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

interface DbOwner {
  id: string;
  property_id: string;
  company_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  owners: any[] | null;
  phones: any[] | null;
  mailing_address: string | null;
  mailing_city: string | null;
  mailing_state: string | null;
  mailing_zip: string | null;
  ownership_length_months: number | null;
  owner_type: string | null;
  owner_occupied: boolean | null;
  litigator: boolean;
  contact_name: string | null;
  age: number | null;
  notes: string | null;
  last_verified_date: string | null;
}

interface DbActivity {
  id: string;
  property_id: string;
  company_id: string;
  created_by: string | null;
  type: string;
  content: string;
  outcome: string | null;
  date: string;
  owner_name: string | null;
}

// Convert DB property to app Property type
const toProperty = (
  dbProp: DbProperty,
  dbOwner: DbOwner | null,
  dbActivities: DbActivity[],
  profilesMap?: Map<string, string>
): Property => ({
  id: dbProp.id,
  companyId: dbProp.company_id,
  address: dbProp.address,
  city: dbProp.city,
  state: dbProp.state,
  zip: dbProp.zip,
  latitude: dbProp.latitude || undefined,
  longitude: dbProp.longitude || undefined,
  bedrooms: dbProp.bedrooms,
  bathrooms: dbProp.bathrooms,
  guests: dbProp.guests || undefined,
  squareFeet: dbProp.square_feet || undefined,
  yearBuilt: dbProp.year_built || undefined,
  lotSize: dbProp.lot_size || undefined,
  propertyType: dbProp.property_type || undefined,
  image: dbProp.image || '',
  stageId: dbProp.stage_id || undefined,
  tags: dbProp.tags || [],
  airbnbUrl: dbProp.airbnb_url || undefined,
  zillowUrl: dbProp.zillow_url || undefined,
  propertyUrl: dbProp.property_url || undefined,
  bookingLink: dbProp.booking_link || undefined,
  listingTitle: dbProp.listing_title || undefined,
  roomType: dbProp.room_type || undefined,
  propertyManager: dbProp.property_manager || undefined,
  host: dbProp.host || undefined,
  marketData: dbProp.market_data || {
    adr: 0,
    occupancyRate: 0,
    projectedRevenue: 0,
    propertyValue: 0,
  },
  customFields: dbProp.custom_fields || {},
  owner: dbOwner ? {
    name: dbOwner.name,
    email: dbOwner.email || '',
    phone: dbOwner.phone || '',
    owners: dbOwner.owners || undefined,
    phones: dbOwner.phones || undefined,
    mailingAddress: dbOwner.mailing_address || undefined,
    mailingCity: dbOwner.mailing_city || undefined,
    mailingState: dbOwner.mailing_state || undefined,
    mailingZip: dbOwner.mailing_zip || undefined,
    ownershipLengthMonths: dbOwner.ownership_length_months || undefined,
    ownerType: dbOwner.owner_type || undefined,
    ownerOccupied: dbOwner.owner_occupied || undefined,
    litigator: dbOwner.litigator,
    contactName: dbOwner.contact_name || undefined,
    age: dbOwner.age || undefined,
    notes: dbOwner.notes || undefined,
    lastVerifiedDate: dbOwner.last_verified_date || undefined,
  } : {
    name: '',
    email: '',
    phone: '',
  },
  activities: dbActivities.map(a => ({
    id: a.id,
    type: a.type as Activity['type'],
    date: a.date,
    content: a.content,
    outcome: a.outcome || undefined,
    createdBy: a.created_by || undefined,
    createdByName: a.created_by && profilesMap ? profilesMap.get(a.created_by) : undefined,
    ownerName: a.owner_name || undefined,
    propertyId: a.property_id,
  })),
});

const PAGE_SIZE = 500;

// Fetch a single property by ID (used when property isn't in loaded batch)
export const usePropertyById = (propertyId: string | null) => {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['property', propertyId],
    queryFn: async (): Promise<Property | null> => {
      if (!propertyId || !companyId) return null;

      // Fetch property
      const { data: prop, error: propError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', propertyId)
        .eq('company_id', companyId)
        .maybeSingle();

      if (propError) throw propError;
      if (!prop) return null;

      // Fetch owner, activities, and profiles in parallel
      const [ownerRes, activitiesRes, profilesRes] = await Promise.all([
        supabase
          .from('owners')
          .select('*')
          .eq('property_id', propertyId)
          .maybeSingle(),
        supabase
          .from('activity_logs')
          .select('*')
          .eq('property_id', propertyId)
          .order('date', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, name')
          .eq('company_id', companyId),
      ]);

      if (ownerRes.error) throw ownerRes.error;
      if (activitiesRes.error) throw activitiesRes.error;

      // Create profiles lookup map
      const profilesMap = new Map<string, string>();
      (profilesRes.data || []).forEach(p => {
        profilesMap.set(p.id, p.name);
      });

      return toProperty(
        prop as unknown as DbProperty,
        ownerRes.data as unknown as DbOwner | null,
        (activitiesRes.data || []) as unknown as DbActivity[],
        profilesMap
      );
    },
    enabled: !!propertyId && !!companyId,
  });
};

export const useTotalPropertyCount = () => {
  const { company } = useAuth();
  const companyId = company?.id;

  return useQuery({
    queryKey: ['properties-count', companyId],
    queryFn: async (): Promise<number> => {
      if (!companyId) return 0;
      
      const { count, error } = await supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId);

      if (error) throw error;
      return count || 0;
    },
    enabled: !!companyId,
  });
};

export const useProperties = () => {
  const { company } = useAuth();
  const companyId = company?.id;
  const [offset, setOffset] = useState(0);
  const [allLoadedProperties, setAllLoadedProperties] = useState<Property[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);

  const fetchBatch = async (currentOffset: number): Promise<Property[]> => {
    if (!companyId) return [];

    // Fetch properties with limit and offset
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .range(currentOffset, currentOffset + PAGE_SIZE - 1);

    if (propError) throw propError;
    if (!properties?.length) return [];

    const propertyIds = properties.map(p => p.id);

    // Fetch owners, activities, and profiles in parallel
    const [ownersRes, activitiesRes, profilesRes] = await Promise.all([
      supabase
        .from('owners')
        .select('*')
        .in('property_id', propertyIds),
      supabase
        .from('activity_logs')
        .select('*')
        .in('property_id', propertyIds)
        .order('date', { ascending: false }),
      supabase
        .from('profiles')
        .select('id, name')
        .eq('company_id', companyId),
    ]);

    if (ownersRes.error) throw ownersRes.error;
    if (activitiesRes.error) throw activitiesRes.error;

    // Create profiles lookup map
    const profilesMap = new Map<string, string>();
    (profilesRes.data || []).forEach(p => {
      profilesMap.set(p.id, p.name);
    });

    // Group by property_id
    const ownersByProp = new Map<string, DbOwner>();
    (ownersRes.data || []).forEach(o => {
      ownersByProp.set(o.property_id, o as unknown as DbOwner);
    });

    const activitiesByProp = new Map<string, DbActivity[]>();
    (activitiesRes.data || []).forEach(a => {
      const list = activitiesByProp.get(a.property_id) || [];
      list.push(a as unknown as DbActivity);
      activitiesByProp.set(a.property_id, list);
    });

    return properties.map(p =>
      toProperty(
        p as unknown as DbProperty,
        ownersByProp.get(p.id) || null,
        activitiesByProp.get(p.id) || [],
        profilesMap
      )
    );
  };

  const query = useQuery({
    queryKey: ['properties', companyId],
    queryFn: async (): Promise<Property[]> => {
      const initialBatch = await fetchBatch(0);
      setHasMore(initialBatch.length === PAGE_SIZE);
      setOffset(PAGE_SIZE);
      setAllLoadedProperties(initialBatch);
      return initialBatch;
    },
    enabled: !!companyId,
  });

  const loadMore = useCallback(async () => {
    if (!hasMore || isFetchingMore || !companyId) return;
    
    setIsFetchingMore(true);
    try {
      const nextBatch = await fetchBatch(offset);
      setHasMore(nextBatch.length === PAGE_SIZE);
      setOffset(prev => prev + PAGE_SIZE);
      setAllLoadedProperties(prev => [...prev, ...nextBatch]);
    } catch (error) {
      console.error('Failed to load more properties:', error);
      toast.error('Failed to load more properties');
    } finally {
      setIsFetchingMore(false);
    }
  }, [hasMore, isFetchingMore, companyId, offset]);

  // Return combined data from initial query + loaded more
  return {
    ...query,
    data: allLoadedProperties.length > 0 ? allLoadedProperties : (query.data || []),
    hasMore,
    loadMore,
    isFetchingMore,
  };
};

export const useAddProperty = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      address: string;
      city: string;
      state: string;
      zip: string;
      ownerName: string;
      ownerEmail: string;
      ownerPhone: string;
      stageId?: string;
    }) => {
      if (!company?.id) throw new Error('No company');

      // Insert property
      const { data: prop, error: propError } = await supabase
        .from('properties')
        .insert({
          company_id: company.id,
          address: data.address,
          city: data.city,
          state: data.state,
          zip: data.zip,
          stage_id: data.stageId || null,
          tags: [],
          market_data: { adr: 0, occupancyRate: 0, projectedRevenue: 0, propertyValue: 0 },
        })
        .select()
        .single();

      if (propError) throw propError;

      // Insert owner
      const { error: ownerError } = await supabase
        .from('owners')
        .insert({
          property_id: prop.id,
          company_id: company.id,
          name: data.ownerName,
          email: data.ownerEmail,
          phone: data.ownerPhone,
        });

      if (ownerError) throw ownerError;

      return prop;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success('Property added');
    },
    onError: (error) => {
      toast.error(`Failed to add property: ${error.message}`);
    },
  });
};

export const useUpdateProperty = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Property> }) => {
      if (!company?.id) throw new Error('No company');

      // Build property update object
      const propUpdates: Record<string, any> = {};
      
      if (updates.address !== undefined) propUpdates.address = updates.address;
      if (updates.city !== undefined) propUpdates.city = updates.city;
      if (updates.state !== undefined) propUpdates.state = updates.state;
      if (updates.zip !== undefined) propUpdates.zip = updates.zip;
      if (updates.latitude !== undefined) propUpdates.latitude = updates.latitude;
      if (updates.longitude !== undefined) propUpdates.longitude = updates.longitude;
      if (updates.bedrooms !== undefined) propUpdates.bedrooms = updates.bedrooms;
      if (updates.bathrooms !== undefined) propUpdates.bathrooms = updates.bathrooms;
      if (updates.guests !== undefined) propUpdates.guests = updates.guests;
      if (updates.squareFeet !== undefined) propUpdates.square_feet = updates.squareFeet;
      if (updates.yearBuilt !== undefined) propUpdates.year_built = updates.yearBuilt;
      if (updates.lotSize !== undefined) propUpdates.lot_size = updates.lotSize;
      if (updates.propertyType !== undefined) propUpdates.property_type = updates.propertyType;
      if (updates.image !== undefined) propUpdates.image = updates.image;
      if (updates.stageId !== undefined) propUpdates.stage_id = updates.stageId || null;
      if (updates.tags !== undefined) propUpdates.tags = updates.tags;
      if (updates.airbnbUrl !== undefined) propUpdates.airbnb_url = updates.airbnbUrl;
      if (updates.zillowUrl !== undefined) propUpdates.zillow_url = updates.zillowUrl;
      if (updates.propertyUrl !== undefined) propUpdates.property_url = updates.propertyUrl;
      if (updates.bookingLink !== undefined) propUpdates.booking_link = updates.bookingLink;
      if (updates.listingTitle !== undefined) propUpdates.listing_title = updates.listingTitle;
      if (updates.roomType !== undefined) propUpdates.room_type = updates.roomType;
      if (updates.propertyManager !== undefined) propUpdates.property_manager = updates.propertyManager;
      if (updates.host !== undefined) propUpdates.host = updates.host;
      if (updates.marketData !== undefined) propUpdates.market_data = updates.marketData;
      if (updates.customFields !== undefined) propUpdates.custom_fields = updates.customFields;

      // Update property if there are changes
      if (Object.keys(propUpdates).length > 0) {
        const { error } = await supabase
          .from('properties')
          .update(propUpdates)
          .eq('id', id)
          .eq('company_id', company.id);

        if (error) throw error;
      }

      // Update owner if included
      if (updates.owner) {
        const ownerUpdates: Record<string, any> = {
          name: updates.owner.name,
          email: updates.owner.email,
          phone: updates.owner.phone,
        };
        
        if (updates.owner.owners !== undefined) ownerUpdates.owners = updates.owner.owners;
        if (updates.owner.phones !== undefined) ownerUpdates.phones = updates.owner.phones;
        if (updates.owner.mailingAddress !== undefined) ownerUpdates.mailing_address = updates.owner.mailingAddress;
        if (updates.owner.mailingCity !== undefined) ownerUpdates.mailing_city = updates.owner.mailingCity;
        if (updates.owner.mailingState !== undefined) ownerUpdates.mailing_state = updates.owner.mailingState;
        if (updates.owner.mailingZip !== undefined) ownerUpdates.mailing_zip = updates.owner.mailingZip;
        if (updates.owner.ownershipLengthMonths !== undefined) ownerUpdates.ownership_length_months = updates.owner.ownershipLengthMonths;
        if (updates.owner.ownerType !== undefined) ownerUpdates.owner_type = updates.owner.ownerType;
        if (updates.owner.ownerOccupied !== undefined) ownerUpdates.owner_occupied = updates.owner.ownerOccupied;
        if (updates.owner.litigator !== undefined) ownerUpdates.litigator = updates.owner.litigator;
        if (updates.owner.contactName !== undefined) ownerUpdates.contact_name = updates.owner.contactName;
        if (updates.owner.age !== undefined) ownerUpdates.age = updates.owner.age;
        if (updates.owner.notes !== undefined) ownerUpdates.notes = updates.owner.notes;
        if (updates.owner.lastVerifiedDate !== undefined) ownerUpdates.last_verified_date = updates.owner.lastVerifiedDate;

        // Upsert owner (might not exist)
        const { data: existingOwner } = await supabase
          .from('owners')
          .select('id')
          .eq('property_id', id)
          .maybeSingle();

        if (existingOwner) {
          await supabase
            .from('owners')
            .update(ownerUpdates)
            .eq('property_id', id);
        } else {
          await supabase
            .from('owners')
            .insert({
              property_id: id,
              company_id: company.id,
              ...ownerUpdates,
            });
        }
      }

      return { id, updates };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
};

export const useDeleteProperties = () => {
  const queryClient = useQueryClient();
  const { company } = useAuth();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!company?.id) throw new Error('No company');

      const { error } = await supabase
        .from('properties')
        .delete()
        .in('id', ids)
        .eq('company_id', company.id);

      if (error) throw error;
      return ids;
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast.success(`Deleted ${ids.length} properties`);
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });
};

export const useAddActivity = () => {
  const queryClient = useQueryClient();
  const { company, user } = useAuth();

  return useMutation({
    mutationFn: async ({ propertyId, activity, ownerName }: { 
      propertyId: string; 
      activity: Omit<Activity, 'id'>; 
      ownerName?: string;
    }) => {
      if (!company?.id) throw new Error('No company');

      const { data, error } = await supabase
        .from('activity_logs')
        .insert({
          property_id: propertyId,
          company_id: company.id,
          created_by: user?.id,
          type: activity.type,
          content: activity.content,
          outcome: activity.outcome,
          date: activity.date,
          owner_name: ownerName || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['ownerActivities'] });
      queryClient.invalidateQueries({ queryKey: ['propertyOwnerActivities'] });
      toast.success('Activity added');
    },
    onError: (error) => {
      toast.error(`Failed to add activity: ${error.message}`);
    },
  });
};

export const useUpdateActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string; 
      updates: { type?: string; content?: string; outcome?: string };
    }) => {
      const { data, error } = await supabase
        .from('activity_logs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['ownerActivities'] });
      queryClient.invalidateQueries({ queryKey: ['propertyOwnerActivities'] });
      toast.success('Activity updated');
    },
    onError: (error) => {
      toast.error(`Failed to update activity: ${error.message}`);
    },
  });
};

export const useDeleteActivity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('activity_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['ownerActivities'] });
      queryClient.invalidateQueries({ queryKey: ['propertyOwnerActivities'] });
      toast.success('Activity deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete activity: ${error.message}`);
    },
  });
};
